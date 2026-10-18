import type { ResolvedAiConfig, SamplingParams } from '../shared/ai'
import type { ChatMessage, ChatRequestOutcome, ChatResponse, ToolCallRequest, ToolDefinition } from '../shared/aiChat'
import { httpFetch } from './httpFetch'

// Carries the HTTP status code so callers can tell "provider doesn't support
// this feature" (400/404/422/501 — worth falling back for) apart from any
// other failure. Ported from the C# app's AiRequestException.
export class AiRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message)
  }
}

// Every AI provider call is made from here (the main process) instead of the
// renderer. Browser fetch() enforces CORS — a local OpenAI-compatible server
// that doesn't answer the preflight OPTIONS request correctly (very common
// for small self-hosted servers) makes the renderer's fetch fail with an
// opaque "Failed to fetch" no matter how correct the URL is. Chromium's
// net.fetch (see httpFetch.ts) has no CORS concept and avoids Node/undici's
// Windows TLS ECONNRESET against HTTPS APIs.

// Users routinely paste the full endpoint URL shown in a local server's docs
// (e.g. ".../v1/chat/completions") instead of just the base ("/v1") we
// actually need — strip a trailing known endpoint so we don't end up
// double-appending it (".../v1/chat/completions/chat/completions").
const KNOWN_ENDPOINT_SUFFIXES = ['/chat/completions', '/completions', '/embeddings', '/models', '/messages']

// Chat completions are not streamed, so the whole answer has to arrive within
// the timeout — a local model on modest hardware routinely needs minutes. The
// user can always stop earlier; the default 30s httpFetch cap is for the
// quick calls (model list, GitHub).
const CHAT_TIMEOUT_MS = 10 * 60 * 1000

const activeRequests = new Map<string, AbortController>()

export function abortChatRequest(requestId: string): void {
  activeRequests.get(requestId)?.abort()
  activeRequests.delete(requestId)
}

function normalizeBaseUrl(url: string): string {
  let trimmed = url.trim().replace(/\/+$/, '')
  for (const suffix of KNOWN_ENDPOINT_SUFFIXES) {
    if (trimmed.toLowerCase().endsWith(suffix)) {
      trimmed = trimmed.slice(0, -suffix.length)
      break
    }
  }
  return trimmed
}

function defaultBaseUrl(settings: ResolvedAiConfig): string {
  if (settings.apiBaseUrl.trim()) return normalizeBaseUrl(settings.apiBaseUrl)
  switch (settings.provider) {
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'openrouter':
      return 'https://openrouter.ai/api/v1'
    case 'ollama':
      return 'http://localhost:11434/v1'
    case 'claude':
      return 'https://api.anthropic.com/v1'
    case 'local':
      throw new Error('Configure a URL base para o provedor local nas configurações de IA.')
  }
}

// <think>...</think> blocks some reasoning models prepend to their answer.
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

// The AI settings' sampling profile. Sent as-is to every provider; no profile
// ("sem padrão") means none of these fields go out and the server decides.
function applySampling(body: Record<string, unknown>, sampling: SamplingParams | undefined): void {
  if (!sampling) return
  body.temperature = sampling.temperature
  body.top_p = sampling.topP
  body.top_k = sampling.topK
  body.min_p = sampling.minP
  body.presence_penalty = sampling.presencePenalty
  body.repetition_penalty = sampling.repetitionPenalty
}

function toOpenAiMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content }
    }
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments ?? {}) }
        }))
      }
    }
    return { role: m.role, content: m.content }
  })
}

async function sendOpenAiCompatible(
  settings: ResolvedAiConfig,
  apiKey: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  signal?: AbortSignal
): Promise<ChatResponse> {
  const baseUrl = defaultBaseUrl(settings)
  const body: Record<string, unknown> = {
    model: settings.model,
    messages: toOpenAiMessages(messages)
  }
  applySampling(body, settings.sampling)
  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }))
  }
  if (settings.reasoningEffort !== 'off') {
    body.reasoning_effort = settings.reasoningEffort
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  }
  // OpenRouter rejects or silently drops requests that omit these; they are
  // public app identity, not secrets.
  if (settings.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/CariSoftwareBR/OpenGitDesktop'
    headers['X-Title'] = 'GitWeb'
  }

  const response = await httpFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    // Self-hosted OpenAI-compatible servers commonly skip auth entirely — an
    // empty API key is a valid, deliberate configuration, not "not configured".
    headers,
    body: JSON.stringify(body),
    signal
  }, { timeoutMs: CHAT_TIMEOUT_MS })

  if (!response.ok) {
    const text = await response.text()
    throw new AiRequestError(response.status, `${settings.provider} respondeu ${response.status}: ${text.slice(0, 300)}`)
  }

  const json = await response.json()
  const message = json.choices?.[0]?.message ?? {}
  const toolCalls: ToolCallRequest[] = (message.tool_calls ?? []).map(
    (tc: { id: string; function: { name: string; arguments: string } }) => {
      let args: Record<string, string> = {}
      try {
        args = JSON.parse(tc.function.arguments || '{}')
      } catch {
        // malformed tool arguments JSON; treat as no-arg call
      }
      return { id: tc.id, name: tc.function.name, arguments: args }
    }
  )

  return { content: stripThinkTags(message.content ?? ''), toolCalls }
}

function toClaudeMessages(messages: ChatMessage[]): { role: string; content: unknown }[] {
  const conversation: { role: string; content: unknown }[] = []

  for (const m of messages) {
    if (m.role === 'system') continue

    if (m.role === 'tool') {
      const last = conversation[conversation.length - 1]
      const toolResult = {
        type: 'tool_result',
        tool_use_id: m.toolCallId,
        content: m.content
      }
      // Claude expects tool_result blocks in a user turn — merge consecutive ones.
      if (last?.role === 'user' && Array.isArray(last.content)) {
        ;(last.content as unknown[]).push(toolResult)
      } else {
        conversation.push({ role: 'user', content: [toolResult] })
      }
      continue
    }

    if (m.role === 'assistant') {
      if (m.toolCalls && m.toolCalls.length > 0) {
        const blocks: unknown[] = []
        if (m.content.trim()) blocks.push({ type: 'text', text: m.content })
        for (const tc of m.toolCalls) {
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments ?? {} })
        }
        conversation.push({ role: 'assistant', content: blocks })
      } else {
        conversation.push({ role: 'assistant', content: m.content })
      }
      continue
    }

    conversation.push({ role: 'user', content: m.content })
  }

  return conversation
}

async function sendClaude(
  settings: ResolvedAiConfig,
  apiKey: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  signal?: AbortSignal
): Promise<ChatResponse> {
  const baseUrl = defaultBaseUrl(settings)
  const systemMessage = messages.find((m) => m.role === 'system')?.content
  const conversation = toClaudeMessages(messages)

  const body: Record<string, unknown> = {
    model: settings.model,
    max_tokens: 4096,
    system: systemMessage,
    messages: conversation
  }
  applySampling(body, settings.sampling)
  if (tools.length > 0) {
    body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }))
  }

  const response = await httpFetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  }, { timeoutMs: CHAT_TIMEOUT_MS })

  if (!response.ok) {
    const text = await response.text()
    throw new AiRequestError(response.status, `claude respondeu ${response.status}: ${text.slice(0, 300)}`)
  }

  const json = await response.json()
  const blocks: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> =
    json.content ?? []

  const content = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
  const toolCalls: ToolCallRequest[] = blocks
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({
      id: b.id ?? '',
      name: b.name ?? '',
      arguments: Object.fromEntries(Object.entries(b.input ?? {}).map(([k, v]) => [k, String(v)]))
    }))

  return { content: stripThinkTags(content), toolCalls }
}

// Models whose provider rejected the sampling fields (official APIs may refuse
// top_k/min_p/repetition_penalty, or temperature together with top_p), keyed by
// provider|URL|model. Later requests to them go out without sampling.
const samplingUnsupported = new Set<string>()
const UNSUPPORTED_SAMPLING_STATUS_CODES = new Set([400, 422])

export async function sendChatRequest(
  settings: ResolvedAiConfig,
  apiKey: string,
  messages: ChatMessage[],
  tools: ToolDefinition[] = [],
  requestId?: string
): Promise<ChatResponse> {
  const controller = new AbortController()
  if (requestId) activeRequests.set(requestId, controller)

  const key = `${settings.provider}|${settings.apiBaseUrl}|${settings.model}`
  const config = samplingUnsupported.has(key) ? { ...settings, sampling: undefined } : settings
  const send = (cfg: ResolvedAiConfig): Promise<ChatResponse> =>
    cfg.provider === 'claude'
      ? sendClaude(cfg, apiKey, messages, tools, controller.signal)
      : sendOpenAiCompatible(cfg, apiKey, messages, tools, controller.signal)

  try {
    try {
      return await send(config)
    } catch (err) {
      const rejected = err instanceof AiRequestError && UNSUPPORTED_SAMPLING_STATUS_CODES.has(err.statusCode)
      if (!config.sampling || !rejected) throw err
      // Retry once without sampling. If this also fails, the 400 had another
      // cause (tools, reasoning effort) and that error surfaces to the caller.
      const response = await send({ ...config, sampling: undefined })
      samplingUnsupported.add(key)
      return response
    }
  } finally {
    if (requestId) activeRequests.delete(requestId)
  }
}

// Never rejects — callers that need to decide whether to retry with the
// textual tool-calling fallback (see shared/aiChat.ts) need the status code,
// which doesn't survive a thrown error across the IPC boundary.
export async function sendToolAwareChatRequest(
  settings: ResolvedAiConfig,
  apiKey: string,
  messages: ChatMessage[],
  tools: ToolDefinition[] = [],
  requestId?: string
): Promise<ChatRequestOutcome> {
  try {
    const response = await sendChatRequest(settings, apiKey, messages, tools, requestId)
    return { ok: true, response }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, errorMessage: 'Requisição cancelada.' }
    }
    return {
      ok: false,
      statusCode: err instanceof AiRequestError ? err.statusCode : undefined,
      errorMessage: err instanceof Error ? err.message : String(err)
    }
  }
}

const CLAUDE_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5', 'claude-haiku-4-5-20251001']

export async function listModels(settings: ResolvedAiConfig, apiKey: string): Promise<string[]> {
  if (settings.provider === 'claude') return CLAUDE_MODELS

  const baseUrl = defaultBaseUrl(settings)
  const response = await httpFetch(`${baseUrl}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} })
  if (!response.ok) throw new Error(`Não foi possível listar modelos (HTTP ${response.status}).`)
  const json = await response.json()
  const list: { id: string }[] = json.data ?? json.models ?? []
  return list.map((m) => m.id).sort()
}
