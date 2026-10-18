import type { ResolvedAiConfig } from '../../../../shared/ai'
import type { ChatMessage, ChatRequestOutcome, ChatResponse, ToolDefinition } from '../../../../shared/aiChat'

export type { ChatMessage, ChatRequestOutcome, ChatResponse, ToolCallRequest, ToolDefinition } from '../../../../shared/aiChat'

// Electron prefixes every rejected ipcRenderer.invoke with this, which is
// noise in the commit-composer error banner.
const IPC_INVOKE_PREFIX = /^Error invoking remote method '[^']+': (?:(?:TypeError|Error|AiRequestError): )?/

function unwrapIpcError(err: unknown): Error {
  if (!(err instanceof Error)) return new Error(String(err))
  const stripped = err.message.replace(IPC_INVOKE_PREFIX, '').trim()
  return stripped === err.message ? err : new Error(stripped)
}

// The actual HTTP calls run in the main process (Chromium net.fetch, no CORS)
// — see main/aiProxy.ts and main/httpFetch.ts. This module is just the
// IPC-calling façade the rest of the renderer already imports from.
export async function sendChatRequest(
  config: ResolvedAiConfig,
  apiKey: string,
  messages: ChatMessage[],
  tools: ToolDefinition[] = [],
  requestId?: string
): Promise<ChatResponse> {
  try {
    return await window.api.ai.sendChatRequest(config, apiKey, messages, tools, requestId)
  } catch (err) {
    throw unwrapIpcError(err)
  }
}

export async function listModels(config: ResolvedAiConfig, apiKey: string): Promise<string[]> {
  try {
    return await window.api.ai.listModels(config, apiKey)
  } catch (err) {
    throw unwrapIpcError(err)
  }
}

// Never rejects — used by the chat store, which needs the HTTP status code
// to decide whether to retry with the textual tool-calling fallback.
export function sendToolAwareChatRequest(
  config: ResolvedAiConfig,
  apiKey: string,
  messages: ChatMessage[],
  tools: ToolDefinition[] = [],
  requestId?: string
): Promise<ChatRequestOutcome> {
  return window.api.ai.sendToolAwareChatRequest(config, apiKey, messages, tools, requestId)
}

export function abortChatRequest(requestId: string): Promise<void> {
  return window.api.ai.abortChatRequest(requestId)
}
