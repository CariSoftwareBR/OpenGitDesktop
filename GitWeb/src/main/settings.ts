import { readJson, updateJson, writeJson } from './appDataStore'
import {
  DEFAULT_INVESTIGATION_CONCURRENCY,
  DEFAULT_INVESTIGATION_CONTEXT_TOKENS,
  DEFAULT_MAX_DIFF_CHARS,
  SYSTEM_SAMPLING,
  normalizeReasoningEffort,
  normalizeSampling,
  normalizeSamplingMode,
  type AiProvider,
  type AiSettings
} from '../shared/ai'
import { DEFAULT_APP_SETTINGS, MAX_CLONE_BASE_FOLDERS, type AppSettings } from '../shared/settings'

const FILE_NAME = 'settings.json'
const DEFAULTS: AppSettings = DEFAULT_APP_SETTINGS

function sanitizeCloneBaseFolders(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) continue
    const key = item.trim().replace(/[\\/]+$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item.trim())
  }
  return result.slice(0, MAX_CLONE_BASE_FOLDERS)
}

// Merged field-by-field (not just a fallback for a missing file) so a
// settings.json written before a new field existed still picks up its
// default instead of coming back `undefined`.
function normalizeSettings(stored: Partial<AppSettings>): AppSettings {
  const colorScheme: AppSettings['colorScheme'] =
    stored.colorScheme === 'dark' || stored.colorScheme === 'light' || stored.colorScheme === 'system'
      ? stored.colorScheme
      : DEFAULTS.colorScheme
  const lastCloneBaseFolder =
    typeof stored.lastCloneBaseFolder === 'string' && stored.lastCloneBaseFolder.trim()
      ? stored.lastCloneBaseFolder.trim()
      : null
  return {
    ...DEFAULTS,
    ...stored,
    colorScheme,
    cloneBaseFolders: sanitizeCloneBaseFolders(stored.cloneBaseFolders),
    lastCloneBaseFolder
  }
}

export async function getSettings(): Promise<AppSettings> {
  return normalizeSettings(await readJson<Partial<AppSettings>>(FILE_NAME, DEFAULTS))
}

// Both writers go through updateJson: as two separate read-then-write steps,
// opening a repo (lastRepositoryPath) racing a settings change could have
// either one clobber the other with its stale snapshot.
export async function setLastRepositoryPath(path: string | null): Promise<void> {
  await updateJson<Partial<AppSettings>>(FILE_NAME, DEFAULTS, (current) => ({
    ...normalizeSettings(current),
    lastRepositoryPath: path
  }))
}

export async function setAppSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const next = await updateJson<Partial<AppSettings>>(FILE_NAME, DEFAULTS, (current) => ({
    ...normalizeSettings(current),
    ...partial
  }))
  return next as AppSettings
}

// AI provider/model preferences only — API keys are never written here, they
// live exclusively in the OS-backed secret store (see credentials.ts).
const AI_FILE_NAME = 'ai-settings.json'
const AI_DEFAULTS: AiSettings = {
  activeProvider: 'openai',
  samplingMode: 'system',
  userSampling: SYSTEM_SAMPLING,
  maxDiffChars: DEFAULT_MAX_DIFF_CHARS,
  investigationConcurrency: DEFAULT_INVESTIGATION_CONCURRENCY,
  investigationContextTokens: DEFAULT_INVESTIGATION_CONTEXT_TOKENS,
  language: 'pt-BR',
  reasoningEffort: 'off',
  providers: {
    openai: { model: 'gpt-4o-mini', apiBaseUrl: 'https://api.openai.com/v1' },
    claude: { model: 'claude-sonnet-5', apiBaseUrl: 'https://api.anthropic.com/v1' },
    openrouter: { model: '', apiBaseUrl: 'https://openrouter.ai/api/v1' },
    ollama: { model: 'llama3', apiBaseUrl: 'http://localhost:11434/v1' },
    // Same starting point as Ollama — the most common "local server" case —
    // the user overwrites it with their own address if they run something else.
    local: { model: '', apiBaseUrl: 'http://localhost:11434/v1' }
  }
}

export async function getAiSettings(): Promise<AiSettings> {
  const stored = await readJson<AiSettings>(AI_FILE_NAME, AI_DEFAULTS)
  // Merge in defaults field-by-field rather than replacing whole provider
  // blocks, so a settings file saved before default base URLs existed still
  // picks them up instead of staying stuck on an empty string forever.
  const providers = {} as AiSettings['providers']
  for (const key of Object.keys(AI_DEFAULTS.providers) as AiProvider[]) {
    const defaults = AI_DEFAULTS.providers[key]
    const savedProvider = stored.providers?.[key]
    providers[key] = {
      model: savedProvider?.model || defaults.model,
      apiBaseUrl: savedProvider?.apiBaseUrl || defaults.apiBaseUrl
    }
  }
  return {
    ...AI_DEFAULTS,
    ...stored,
    // Installs from before sampling profiles have neither field: both fall back
    // to the system profile instead of breaking.
    samplingMode: normalizeSamplingMode(stored.samplingMode),
    userSampling: normalizeSampling(stored.userSampling),
    maxDiffChars: typeof stored.maxDiffChars === 'number' ? stored.maxDiffChars : AI_DEFAULTS.maxDiffChars,
    investigationConcurrency: clampInteger(stored.investigationConcurrency, 0, 8, AI_DEFAULTS.investigationConcurrency),
    investigationContextTokens: clampInteger(
      stored.investigationContextTokens,
      32_768,
      131_072,
      AI_DEFAULTS.investigationContextTokens
    ),
    language: stored.language === 'en' || stored.language === 'pt-BR' ? stored.language : AI_DEFAULTS.language,
    reasoningEffort: normalizeReasoningEffort(stored.reasoningEffort),
    activeProvider: stored.activeProvider ?? AI_DEFAULTS.activeProvider,
    providers
  }
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export async function setAiSettings(settings: AiSettings): Promise<void> {
  await writeJson(AI_FILE_NAME, settings)
}
