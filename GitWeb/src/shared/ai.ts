export type AiProvider = 'openai' | 'claude' | 'openrouter' | 'ollama' | 'local'
// Values mirror OpenAI's `reasoning_effort`; 'off' means the field is omitted.
export const REASONING_EFFORT_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh'] as const
export type ReasoningEffort = (typeof REASONING_EFFORT_LEVELS)[number]

/** Level every new chat starts at; independent of the saved `reasoningEffort` setting. */
export const DEFAULT_CHAT_REASONING_EFFORT: ReasoningEffort = 'low'

export function normalizeReasoningEffort(value: unknown): ReasoningEffort {
  // 'max' was the old top level; OpenAI calls it 'xhigh'.
  if (value === 'max') return 'xhigh'
  return REASONING_EFFORT_LEVELS.includes(value as ReasoningEffort) ? (value as ReasoningEffort) : 'off'
}

/** Sampling fields sent with every AI request (see main/aiProxy.ts applySampling). */
export interface SamplingParams {
  temperature: number
  topP: number
  topK: number
  minP: number
  presencePenalty: number
  repetitionPenalty: number
}

/** One set for requests with reasoning effort on ("thinking") and one for effort off. */
export interface SamplingProfile {
  thinking: SamplingParams
  nonThinking: SamplingParams
}

/** 'system' = SYSTEM_SAMPLING, 'user' = the user's own profile, 'none' = send no sampling fields. */
export type SamplingMode = 'system' | 'user' | 'none'
const SAMPLING_MODES: SamplingMode[] = ['system', 'user', 'none']

export const SYSTEM_SAMPLING: SamplingProfile = {
  thinking: { temperature: 0.6, topP: 0.95, topK: 20, minP: 0, presencePenalty: 0, repetitionPenalty: 1 },
  nonThinking: { temperature: 1, topP: 0.95, topK: 20, minP: 0, presencePenalty: 1.5, repetitionPenalty: 1 }
}

// Settings saved before sampling profiles existed (or edited by hand) fall back
// to the system profile, so existing installs keep working without any action.
export function normalizeSamplingMode(value: unknown): SamplingMode {
  return SAMPLING_MODES.includes(value as SamplingMode) ? (value as SamplingMode) : 'system'
}

function normalizeSamplingParams(value: unknown, fallback: SamplingParams): SamplingParams {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof SamplingParams, unknown>>
  const pick = (key: keyof SamplingParams): number => {
    const n = source[key]
    return typeof n === 'number' && Number.isFinite(n) ? n : fallback[key]
  }
  return {
    temperature: pick('temperature'),
    topP: pick('topP'),
    topK: pick('topK'),
    minP: pick('minP'),
    presencePenalty: pick('presencePenalty'),
    repetitionPenalty: pick('repetitionPenalty')
  }
}

export function normalizeSampling(value: unknown): SamplingProfile {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof SamplingProfile, unknown>>
  return {
    thinking: normalizeSamplingParams(source.thinking, SYSTEM_SAMPLING.thinking),
    nonThinking: normalizeSamplingParams(source.nonThinking, SYSTEM_SAMPLING.nonThinking)
  }
}

export interface AiProviderConfig {
  model: string
  apiBaseUrl: string
}

// Sane defaults for this project specifically (small-ish diffs, quick
// commit-message/tool-call turnaround) — editable, with a "restore default"
// affordance in the settings panel.
export const DEFAULT_MAX_DIFF_CHARS = 6000
/** Default worker budget for the commit bug investigation. */
export const DEFAULT_INVESTIGATION_CONCURRENCY = 1
export const DEFAULT_INVESTIGATION_CONTEXT_TOKENS = 32_768

// Persisted to <userData>/ai-settings.json (never committed to the repo,
// survives app updates). One AiProviderConfig per provider so switching
// providers doesn't clobber the model/URL you had set for the previous one.
// API keys are deliberately NOT part of this shape — they live only in the
// OS-backed secret store (see main/credentials.ts), keyed per provider.
export interface AiSettings {
  activeProvider: AiProvider
  samplingMode: SamplingMode
  userSampling: SamplingProfile
  maxDiffChars: number
  /** Maximum number of independent commit-investigation workers running at once. */
  investigationConcurrency: number
  /** Prompt budget per investigation worker. This does not change the model's actual context window. */
  investigationContextTokens: number
  reasoningEffort: ReasoningEffort
  providers: Record<AiProvider, AiProviderConfig>
}

export interface ResolvedAiConfig {
  provider: AiProvider
  model: string
  apiBaseUrl: string
  /** Sampling fields to send; undefined when the mode is "sem padrão". */
  sampling?: SamplingParams
  reasoningEffort: ReasoningEffort
}

/**
 * `effort` defaults to the saved setting; the chat passes its own effort so the
 * thinking / non-thinking sampling set follows the chat's slider.
 */
export function resolveActiveConfig(settings: AiSettings, effort: ReasoningEffort = settings.reasoningEffort): ResolvedAiConfig {
  const providerConfig = settings.providers[settings.activeProvider]
  const mode = normalizeSamplingMode(settings.samplingMode)
  const profile = mode === 'user' ? normalizeSampling(settings.userSampling) : SYSTEM_SAMPLING
  return {
    provider: settings.activeProvider,
    model: providerConfig.model,
    apiBaseUrl: providerConfig.apiBaseUrl,
    sampling: mode === 'none' ? undefined : effort !== 'off' ? profile.thinking : profile.nonThinking,
    reasoningEffort: effort
  }
}
