import { create } from 'zustand'
import {
  DEFAULT_CHAT_REASONING_EFFORT,
  resolveActiveConfig,
  type AiProvider,
  type AiSettings,
  type ResolvedAiConfig
} from '../../../shared/ai'
import {
  aiNotConfiguredMessage,
  appSystemPrompt,
  askAsTeacherInstruction,
  askAsTeacherUserMessage,
  contactProviderFailedMessage,
  diffExplanationHeader,
  diffTruncationNote,
  explainBannerErrorInstruction,
  extractRejectedLargeFiles,
  formatFileLocationFacts,
  explainBugDescriptionPrompt,
  explainBugFallback,
  explainDiffFallback,
  explainDiffPrompt,
  formatRepoContext,
  investigationFailedMessage,
  languageInstruction,
  openRepoBeforeFixMessage,
  proposeFixMissingFileError,
  proposeFixStaleFileError,
  reasoningInstruction,
  shouldIncludePrSkills,
  selectScmSkills,
  type AiLanguage,
  type ScmSkillId,
  userRequestLabel
} from '../../../shared/aiPrompts'
import {
  TOOL_CATALOG,
  TOOL_RULES_SECTION,
  buildTextualToolsPrompt,
  parseTextualToolCall,
  type ToolCallRequest
} from '../../../shared/aiChat'
import { listModels, sendToolAwareChatRequest, sendChatRequest, abortChatRequest, type ChatMessage } from '../lib/ai/providers'
import { prepareToolCall, executeToolCall, toolSeverity, type ToolPreview } from '../lib/ai/tools'
import { useRepoStore } from './repoStore'
import CREATE_PULL_REQUEST_SKILL_PT from '../lib/ai/skills/pt-BR/create-pull-request.md?raw'
import MERGE_PULL_REQUEST_SKILL_PT from '../lib/ai/skills/pt-BR/merge-pull-request.md?raw'
import REVIEW_PULL_REQUEST_SKILL_PT from '../lib/ai/skills/pt-BR/review-pull-request.md?raw'
import CREATE_PULL_REQUEST_SKILL_EN from '../lib/ai/skills/en/create-pull-request.md?raw'
import MERGE_PULL_REQUEST_SKILL_EN from '../lib/ai/skills/en/merge-pull-request.md?raw'
import REVIEW_PULL_REQUEST_SKILL_EN from '../lib/ai/skills/en/review-pull-request.md?raw'
import CREATE_PULL_REQUEST_SKILL_ES from '../lib/ai/skills/es/create-pull-request.md?raw'
import MERGE_PULL_REQUEST_SKILL_ES from '../lib/ai/skills/es/merge-pull-request.md?raw'
import REVIEW_PULL_REQUEST_SKILL_ES from '../lib/ai/skills/es/review-pull-request.md?raw'
import GIT_WORKFLOW_SKILL_PT from '../lib/ai/skills/pt-BR/git-workflow.md?raw'
import MERGE_BRANCH_SKILL_PT from '../lib/ai/skills/pt-BR/merge-branch.md?raw'
import CODEOWNERS_SKILL_PT from '../lib/ai/skills/pt-BR/codeowners.md?raw'
import REPOSITORY_RISK_SKILL_PT from '../lib/ai/skills/pt-BR/repository-risk.md?raw'
import UNWANTED_FILE_SKILL_PT from '../lib/ai/skills/pt-BR/unwanted-file.md?raw'
import GIT_WORKFLOW_SKILL_EN from '../lib/ai/skills/en/git-workflow.md?raw'
import MERGE_BRANCH_SKILL_EN from '../lib/ai/skills/en/merge-branch.md?raw'
import CODEOWNERS_SKILL_EN from '../lib/ai/skills/en/codeowners.md?raw'
import REPOSITORY_RISK_SKILL_EN from '../lib/ai/skills/en/repository-risk.md?raw'
import UNWANTED_FILE_SKILL_EN from '../lib/ai/skills/en/unwanted-file.md?raw'
import GIT_WORKFLOW_SKILL_ES from '../lib/ai/skills/es/git-workflow.md?raw'
import MERGE_BRANCH_SKILL_ES from '../lib/ai/skills/es/merge-branch.md?raw'
import CODEOWNERS_SKILL_ES from '../lib/ai/skills/es/codeowners.md?raw'
import REPOSITORY_RISK_SKILL_ES from '../lib/ai/skills/es/repository-risk.md?raw'
import UNWANTED_FILE_SKILL_ES from '../lib/ai/skills/es/unwanted-file.md?raw'
import { investigateCommitWithWorkers } from '../lib/ai/commitInvestigation'
import type { InvestigationFinding, InvestigationStep } from '../lib/ai/commitInvestigation'
import { proposeFileFix } from '../lib/ai/proposeFix'
import { formatAiError } from '../lib/ai/errors'
import { getLocale, getT } from '../lib/i18n'

// Same language as the rest of the prompt: small models follow a playbook far
// better when it doesn't switch language mid-prompt.
const PR_SKILLS: Record<AiLanguage, string[]> = {
  'pt-BR': [CREATE_PULL_REQUEST_SKILL_PT, MERGE_PULL_REQUEST_SKILL_PT, REVIEW_PULL_REQUEST_SKILL_PT],
  en: [CREATE_PULL_REQUEST_SKILL_EN, MERGE_PULL_REQUEST_SKILL_EN, REVIEW_PULL_REQUEST_SKILL_EN],
  es: [CREATE_PULL_REQUEST_SKILL_ES, MERGE_PULL_REQUEST_SKILL_ES, REVIEW_PULL_REQUEST_SKILL_ES]
}

const SCM_SKILLS: Record<AiLanguage, Record<ScmSkillId, string>> = {
  'pt-BR': {
    'git-workflow': GIT_WORKFLOW_SKILL_PT,
    'merge-branch': MERGE_BRANCH_SKILL_PT,
    codeowners: CODEOWNERS_SKILL_PT,
    'repository-risk': REPOSITORY_RISK_SKILL_PT,
    'unwanted-file': UNWANTED_FILE_SKILL_PT
  },
  en: {
    'git-workflow': GIT_WORKFLOW_SKILL_EN,
    'merge-branch': MERGE_BRANCH_SKILL_EN,
    codeowners: CODEOWNERS_SKILL_EN,
    'repository-risk': REPOSITORY_RISK_SKILL_EN,
    'unwanted-file': UNWANTED_FILE_SKILL_EN
  },
  es: {
    'git-workflow': GIT_WORKFLOW_SKILL_ES,
    'merge-branch': MERGE_BRANCH_SKILL_ES,
    codeowners: CODEOWNERS_SKILL_ES,
    'repository-risk': REPOSITORY_RISK_SKILL_ES,
    'unwanted-file': UNWANTED_FILE_SKILL_ES
  }
}

export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type AssistantPhase = 'idle' | 'thinking' | 'executing'

export interface UiToolCall {
  call: ToolCallRequest
  preview: ToolPreview
  // What prepareToolCall resolved (generated commit message, detected head
  // branch, etc.) — this, not the model's raw arguments, is what actually
  // gets executed on approval.
  resolvedArgs: Record<string, string>
  status: ToolCallStatus
  result?: string
}

export interface ToolFeedbackEntry {
  name: string
  result: string
}

export interface ChatUiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: UiToolCall[]
  // Present only on synthetic follow-up messages that report tool results
  // back into the conversation — lets the UI render a friendly icon/label
  // per tool instead of the raw "[Tool feedback] tool_name: ..." text that
  // still goes into `content` for the model to read.
  toolFeedback?: ToolFeedbackEntry[]
  /** Sent to the model only — never rendered in the chat UI. */
  modelInstruction?: string
  /** Live per-file progress for the specialized commit bug investigation. */
  investigation?: {
    completed: number
    total: number
    active: number
    stage: 'exploring' | 'consolidating' | 'completed'
    steps: InvestigationStep[]
    problemPaths: string[]
    findings: InvestigationFinding[]
  }
}

export interface PendingFix {
  finding: InvestigationFinding
  path: string
  diff: string
  newContent: string
  /** File content the proposal was computed from, to detect edits made while it waited. */
  baseContent: string
  status: 'proposing' | 'ready' | 'applying'
}

export function credentialKey(provider: string): string {
  return `GitWeb/AI/${provider}`
}

// Self-hosted servers (Ollama, a local OpenAI-compatible endpoint) typically
// don't check auth at all, so an empty key there is a valid, configured
// state — only the cloud providers actually require one.
const KEYLESS_PROVIDERS = new Set<AiProvider>(['ollama', 'local'])

// The one place that decides "is there a usable AI provider right now" —
// every gate that disables an AI feature (chat composer, commit-message
// button, …) must go through this, so a fresh install with a default model
// but no API key reads as NOT configured instead of sailing through to a
// 401 from the provider.
export function isAiConfigured(settings: AiSettings | null, apiKey: string): boolean {
  if (!settings) return false
  const hasModel = Boolean(settings.providers[settings.activeProvider].model.trim())
  if (!hasModel) return false
  if (KEYLESS_PROVIDERS.has(settings.activeProvider)) return true
  return apiKey.trim().length > 0
}

// The single place every call site (chat, commit-message generation, tool
// execution) goes through to get a validated AI config. Centralizing this
// here is what stops each caller from re-implementing its own settings/apiKey
// check — and drifting out of sync, like the commit tool's stale `!apiKey`
// check once did, breaking self-hosted servers that don't require a key.
export async function getActiveAiConfig(): Promise<{ settings: AiSettings; apiKey: string; config: ResolvedAiConfig }> {
  let { settings, apiKey } = useAiStore.getState()
  if (!settings) {
    await useAiStore.getState().loadSettings()
    ;({ settings, apiKey } = useAiStore.getState())
  }
  if (!settings || !isAiConfigured(settings, apiKey)) {
    throw new Error(aiNotConfiguredMessage(getLocale()))
  }
  return { settings, apiKey, config: resolveActiveConfig(settings) }
}

// Providers that rejected a native `tools` array, keyed by provider|baseUrl|model.
// Remembered for the app session so the retry penalty is paid only once —
// ported from AiChatService's NativeToolsUnsupported dictionary.
const nativeToolsUnsupported = new Set<string>()
const UNSUPPORTED_TOOLS_STATUS_CODES = new Set([400, 404, 422, 501])
// Models that rejected `reasoning_effort` (gpt-4o, many Ollama/local servers),
// keyed like nativeToolsUnsupported; the chat then sends requests without it.
const reasoningEffortUnsupported = new Set<string>()
const UNSUPPORTED_REASONING_STATUS_CODES = new Set([400, 422])
const MAX_TOOL_ROUNDS_PER_REQUEST = 25

function configKey(config: ResolvedAiConfig): string {
  return `${config.provider}|${config.apiBaseUrl}|${config.model}`
}

function buildRepoContext(language: AiLanguage): string {
  const repo = useRepoStore.getState()
  const branch = repo.branches.find((b) => b.isCurrent)?.name ?? repo.status?.branch ?? '?'
  const statusLines = (repo.status?.entries ?? []).map((e) => `${e.index}${e.worktree} ${e.path}`).join('\n')
  const lastCommits = repo.log
    .slice(0, 5)
    .map((c) => `${c.shortHash} ${c.summary}`)
    .join('\n')

  return formatRepoContext(language, {
    repoPath: repo.currentRepoPath,
    branch,
    upstream: repo.status?.upstream
      ? { name: repo.status.upstream, ahead: repo.status.ahead, behind: repo.status.behind }
      : null,
    statusLines,
    lastCommits
  })
}

// Recomputed every turn from the whole conversation (the error may be many
// messages back) so the facts follow the repo as each tool runs. Best effort:
// a failed lookup only means the model gets the skill without the facts.
async function unwantedFileFacts(messages: ChatUiMessage[], language: AiLanguage): Promise<string> {
  const repoPath = useRepoStore.getState().currentRepoPath
  if (!repoPath) return ''
  const userText = messages
    .filter((m) => m.role === 'user' && !m.toolFeedback)
    .map((m) => m.content)
    .join('\n')
  const paths = extractRejectedLargeFiles(userText)
  if (paths.length === 0) return ''

  try {
    const facts = await Promise.all(
      paths.map(async (path) => ({
        ...(await window.api.git.locateFileInHistory(repoPath, path)),
        ignored: await window.api.git.isPathIgnored(repoPath, path)
      }))
    )
    return formatFileLocationFacts(language, facts)
  } catch {
    return ''
  }
}

interface AiState {
  settings: AiSettings | null
  apiKey: string
  messages: ChatUiMessage[]
  isBusy: boolean
  phase: AssistantPhase
  error: string | null
  testResult: string | null
  models: string[]
  /** Docked chat panel open alongside the current Git view. */
  panelOpen: boolean
  /** Chat detached into a freely movable/resizable floating window. */
  floating: boolean
  floatingRect: { x: number; y: number; width: number; height: number }
  pendingFix: PendingFix | null

  loadSettings: () => Promise<void>
  saveSettings: (settings: AiSettings) => Promise<void>
  updateInvestigationSettings: (partial: Partial<Pick<AiSettings, 'investigationConcurrency' | 'investigationContextTokens'>>) => Promise<void>
  /** Chat-only effort: starts at the chat default on every new chat and is never saved to settings. */
  chatReasoningEffort: AiSettings['reasoningEffort']
  setChatReasoningEffort: (effort: AiSettings['reasoningEffort']) => void
  setApiKey: (key: string) => void
  testConnection: () => Promise<void>
  loadModels: () => Promise<void>
  explainBugDescription: (description: string) => Promise<string>
  /** Explains one visible file diff in an isolated AI request. */
  explainDiff: (path: string, diff: string) => Promise<void>
  /** Explains a red-banner error via a system prompt; the reply appears in chat. */
  explainBannerError: (errorText: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  /** Opens the chat and asks about a topic; the teacher framing is hidden from the UI. */
  askAsTeacher: (topic: string) => Promise<void>
  investigateCommit: (commit: { hash: string; shortHash: string; summary: string }) => Promise<void>
  proposeFix: (finding: InvestigationFinding) => Promise<void>
  applyPendingFix: () => Promise<void>
  dismissPendingFix: () => void
  approveToolCall: (messageId: string, callId: string) => Promise<void>
  cancelToolCall: (messageId: string, callId: string) => void
  retryToolCall: (messageId: string, callId: string) => Promise<void>
  retryAssistantTurn: () => Promise<void>
  stopGeneration: () => void
  clearChat: () => void
  clearError: () => void
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  setFloating: (floating: boolean) => void
  setFloatingRect: (rect: Partial<AiState['floatingRect']>) => void
}

function newId(): string {
  return Math.random().toString(36).slice(2)
}

/** Bumped on stop / new send so in-flight turns discard their result. */
let activeTurn = 0
let activeRequestId: string | null = null
const activeInvestigationRequestIds = new Set<string>()

function abortInvestigationRequests(): void {
  for (const requestId of activeInvestigationRequestIds) void abortChatRequest(requestId)
  activeInvestigationRequestIds.clear()
}

function nextRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useAiStore = create<AiState>((set, get) => ({
  settings: null,
  apiKey: '',
  messages: [],
  chatReasoningEffort: DEFAULT_CHAT_REASONING_EFFORT,
  isBusy: false,
  phase: 'idle',
  error: null,
  testResult: null,
  models: [],
  panelOpen: false,
  floating: false,
  floatingRect: { x: 200, y: 100, width: 480, height: 620 },
  pendingFix: null,

  loadSettings: async () => {
    const settings = await window.api.ai.getSettings()
    const apiKey = (await window.api.secrets.get(credentialKey(settings.activeProvider))) ?? ''
    set({ settings, apiKey })
  },

  saveSettings: async (settings: AiSettings) => {
    const live = get().settings
    const merged = {
      ...settings,
      investigationConcurrency: live?.investigationConcurrency ?? settings.investigationConcurrency,
      investigationContextTokens: live?.investigationContextTokens ?? settings.investigationContextTokens
    }
    await window.api.ai.setSettings(merged)
    const apiKey = (await window.api.secrets.get(credentialKey(merged.activeProvider))) ?? ''
    set({ settings: merged, apiKey, models: [] })
  },

  updateInvestigationSettings: async (partial) => {
    const current = get().settings
    if (!current) return
    const settings = { ...current, ...partial }
    set({ settings })
    await window.api.ai.setSettings(settings)
  },

  setChatReasoningEffort: (effort) => set({ chatReasoningEffort: effort }),

  setApiKey: (key: string) => {
    const { settings } = get()
    set({ apiKey: key })
    if (settings) {
      void window.api.secrets.save(credentialKey(settings.activeProvider), key).catch((err) => {
        set({ error: err instanceof Error ? err.message : String(err) })
      })
    }
  },

  testConnection: async () => {
    const { settings, apiKey } = get()
    if (!settings) return
    set({ isBusy: true, error: null, testResult: null })
    try {
      const response = await sendChatRequest(resolveActiveConfig(settings), apiKey, [
        { role: 'user', content: getT().stores.aiPing }
      ])
      set({ testResult: response.content || getT().stores.connectionOk })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), testResult: null })
    } finally {
      set({ isBusy: false })
    }
  },

  loadModels: async () => {
    const { settings, apiKey } = get()
    if (!settings) return
    set({ isBusy: true, error: null })
    try {
      const models = await listModels(resolveActiveConfig(settings), apiKey)
      set({ models })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  explainBugDescription: async (description: string) => {
    const { settings, apiKey } = get()
    if (!settings || !isAiConfigured(settings, apiKey)) {
    throw new Error(aiNotConfiguredMessage(getLocale()))
  }
    const response = await sendChatRequest(resolveActiveConfig(settings), apiKey, [
      {
        role: 'system',
        content: explainBugDescriptionPrompt(getLocale())
      },
      { role: 'user', content: description }
    ])
    return response.content.trim() || explainBugFallback(getLocale())
  },

  explainDiff: async (path: string, diff: string) => {
    const { settings, apiKey } = get()
    if (!settings || !diff.trim() || !isAiConfigured(settings, apiKey)) return

    // Each explanation starts a fresh conversation: drop whatever was there
    // (and abort anything still running) so the answer is the whole chat.
    get().clearChat()

    const turn = ++activeTurn
    const maxChars = Math.max(1_000, settings.maxDiffChars)
    const wasTruncated = diff.length > maxChars
    const diffForAnalysis = diff.slice(0, maxChars)
    const requestId = nextRequestId()

    set({ panelOpen: true, isBusy: true, phase: 'thinking', error: null })
    activeRequestId = requestId
    try {
      const response = await sendChatRequest(
        resolveActiveConfig(settings),
        apiKey,
        [
          {
            role: 'system',
            content: explainDiffPrompt(getLocale())
          },
          {
            role: 'user',
            content: `Arquivo: ${path}\n\nDiff:\n\`\`\`diff\n${diffForAnalysis}\n\`\`\``
          }
        ],
        [],
        requestId
      )
      if (activeRequestId === requestId) activeRequestId = null
      if (turn !== activeTurn) return

      const truncationNote = wasTruncated ? diffTruncationNote(getLocale()) : ''
      const content = response.content.trim() || explainDiffFallback(getLocale())
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: newId(),
            role: 'assistant',
            content: `${diffExplanationHeader(getLocale(), path)}${content}${truncationNote}`
          }
        ]
      }))
    } catch (error) {
      if (turn !== activeTurn) return
      set({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (activeRequestId === requestId) activeRequestId = null
      if (turn === activeTurn) set({ isBusy: false, phase: 'idle' })
    }
  },

  explainBannerError: async (errorText: string) => {
    const { settings, apiKey, messages } = get()
    if (!settings || !errorText.trim() || !isAiConfigured(settings, apiKey)) return

    // A regular tool-aware turn with the error as the user's message: it stays
    // in the history, so the skill for it is detected now and on every follow-up.
    const turn = ++activeTurn
    const userMessage: ChatUiMessage = {
      id: newId(),
      role: 'user',
      content: errorText.trim(),
      modelInstruction: explainBannerErrorInstruction(getLocale())
    }
    set({ panelOpen: true, messages: [...messages, userMessage], isBusy: true, phase: 'thinking', error: null })

    await requestAssistantTurn(get, set, turn)
    if (turn !== activeTurn) return
    set({ isBusy: false, phase: 'idle' })
  },

  sendMessage: async (text: string) => {
    const { settings, messages } = get()
    if (!settings || !text.trim()) return

    const turn = ++activeTurn
    const userMessage: ChatUiMessage = { id: newId(), role: 'user', content: text.trim() }
    set({ messages: [...messages, userMessage], isBusy: true, phase: 'thinking', error: null })

    await requestAssistantTurn(get, set, turn)
    if (turn !== activeTurn) return
    set({ isBusy: false, phase: 'idle' })
  },

  askAsTeacher: async (topic: string) => {
    const { settings, messages } = get()
    if (!settings || !topic.trim()) return

    const turn = ++activeTurn
    const subject = topic.trim()
    const userMessage: ChatUiMessage = {
      id: newId(),
      role: 'user',
      content: askAsTeacherUserMessage(getLocale(), subject),
      modelInstruction: askAsTeacherInstruction(getLocale(), subject)
    }
    set({
      panelOpen: true,
      messages: [...messages, userMessage],
      isBusy: true,
      phase: 'thinking',
      error: null
    })

    await requestAssistantTurn(get, set, turn)
    if (turn !== activeTurn) return
    set({ isBusy: false, phase: 'idle' })
  },

  investigateCommit: async (commit: { hash: string; shortHash: string; summary: string }) => {
    const { settings, apiKey } = get()
    const repoPath = useRepoStore.getState().currentRepoPath
    if (!settings || !repoPath || !isAiConfigured(settings, apiKey)) return

    if (activeRequestId) {
      void abortChatRequest(activeRequestId)
      activeRequestId = null
    }
    abortInvestigationRequests()

    const turn = ++activeTurn
    const progressMessageId = newId()
    const progressMessage: ChatUiMessage = {
      id: progressMessageId,
      role: 'assistant',
      content: ''
    }
    set({
      panelOpen: true,
      messages: [progressMessage],
      isBusy: true,
      phase: 'executing',
      error: null
    })

    try {
      const result = await investigateCommitWithWorkers({
        repoPath,
        commit,
        settings,
        apiKey,
        config: resolveActiveConfig(settings),
        isCancelled: () => turn !== activeTurn,
        registerRequest: (requestId) => activeInvestigationRequestIds.add(requestId),
        unregisterRequest: (requestId) => activeInvestigationRequestIds.delete(requestId),
        onProgress: ({ completed, total, active, stage, steps, problemPaths, findings }) => {
          if (turn !== activeTurn) return
          set((state) => ({
            messages: state.messages.map((message) =>
              message.id === progressMessageId
                ? { ...message, investigation: { completed, total, active, stage, steps, problemPaths, findings } }
                : message
            )
          }))
        }
      })
      if (turn !== activeTurn || result === null) return
      set((state) => ({
        messages: state.messages.map((message) => (message.id === progressMessageId ? { ...message, content: result } : message))
      }))
    } catch (error) {
      if (turn !== activeTurn) return
      const message = formatAiError(error)
      set((state) => ({
        messages: state.messages.map((item) =>
          item.id === progressMessageId
            ? {
                ...item,
                content: investigationFailedMessage(getLocale(), message),
                investigation: item.investigation
                  ? { ...item.investigation, stage: 'completed', active: 0 }
                  : item.investigation
              }
            : item
        ),
        error: message
      }))
    } finally {
      if (turn === activeTurn) set({ isBusy: false, phase: 'idle' })
    }
  },

  proposeFix: async (finding) => {
    const repoPath = useRepoStore.getState().currentRepoPath
    const { settings, apiKey } = get()
    if (!repoPath) {
      set({ error: openRepoBeforeFixMessage(getLocale()) })
      return
    }
    if (!settings || !isAiConfigured(settings, apiKey)) {
      set({ error: aiNotConfiguredMessage(getLocale()) })
      return
    }
    const requestId = nextRequestId()
    activeInvestigationRequestIds.add(requestId)
    set({
      pendingFix: { finding, path: finding.path, diff: '', newContent: '', baseContent: '', status: 'proposing' },
      isBusy: true,
      error: null
    })
    try {
      const fileContent = await window.api.fs.readRepoFile(repoPath, finding.path)
      const proposed = await proposeFileFix({
        finding,
        fileContent,
        language: getLocale(),
        config: resolveActiveConfig(settings),
        apiKey,
        requestId
      })
      set({
        pendingFix: {
          finding,
          path: finding.path,
          diff: proposed.diff,
          newContent: proposed.content,
          baseContent: fileContent,
          status: 'ready'
        },
        isBusy: false
      })
    } catch (error) {
      const formatted = formatAiError(error)
      const missing = /ENOENT|no such file or directory/i.test(formatted)
      set({
        pendingFix: null,
        isBusy: false,
        error: missing
          ? proposeFixMissingFileError(getLocale(), finding.path)
          : formatted
      })
    } finally {
      activeInvestigationRequestIds.delete(requestId)
    }
  },

  applyPendingFix: async () => {
    const pending = get().pendingFix
    const repoPath = useRepoStore.getState().currentRepoPath
    const { settings, apiKey } = get()
    if (!pending || pending.status !== 'ready' || !repoPath) return
    const language = getLocale()
    set({ pendingFix: { ...pending, status: 'applying' }, isBusy: true, error: null })
    try {
      // The dialog can sit open for a long time; writing the whole file blindly would
      // silently drop anything that changed on disk meanwhile (editor, pull, other fix).
      const current = await window.api.fs.readRepoFile(repoPath, pending.path)
      if (current !== pending.baseContent) {
        set({
          pendingFix: { ...pending, status: 'ready' },
          isBusy: false,
          error: proposeFixStaleFileError(language, pending.path)
        })
        return
      }
      await window.api.fs.writeRepoFile(repoPath, pending.path, pending.newContent)
      set({ pendingFix: null, isBusy: false })
      await useRepoStore.getState().refreshStatus()
      useRepoStore.getState().setView('changes')
      await useRepoStore.getState().selectFile(pending.path, false)
    } catch (error) {
      set({
        pendingFix: { ...pending, status: 'ready' },
        isBusy: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  },

  dismissPendingFix: () => set({ pendingFix: null }),

  approveToolCall: async (messageId: string, callId: string) => {
    set({ isBusy: true, phase: 'executing' })
    const message = get().messages.find((m) => m.id === messageId)
    const uiCall = message?.toolCalls?.find((c) => c.call.id === callId)
    if (!uiCall) {
      set({ isBusy: false, phase: 'idle' })
      return
    }

    await runToolCall(set, messageId, callId, uiCall)
    await continueIfAllResolved(get, set, messageId)
    set({ isBusy: false, phase: 'idle' })
  },

  cancelToolCall: (messageId: string, callId: string) => {
    updateToolCall(set, messageId, callId, 'cancelled', getT().stores.actionCancelled)
    void continueIfAllResolved(get, set, messageId)
  },

  retryToolCall: async (messageId: string, callId: string) => {
    await get().approveToolCall(messageId, callId)
  },

  retryAssistantTurn: async () => {
    const { settings, messages, phase, isBusy } = get()
    if (!settings || isBusy || phase !== 'idle') return
    if (messages.length === 0) return
    const turn = ++activeTurn
    set({ isBusy: true, phase: 'thinking', error: null })
    await requestAssistantTurn(get, set, turn)
    if (turn !== activeTurn) return
    set({ isBusy: false, phase: 'idle' })
  },

  stopGeneration: () => {
    activeTurn++
    if (activeRequestId) {
      void abortChatRequest(activeRequestId)
      activeRequestId = null
    }
    abortInvestigationRequests()
    set((state) => ({
      messages: state.messages.map((message) =>
        message.investigation
          ? {
              ...message,
              investigation: {
                ...message.investigation,
                active: 0,
                steps: message.investigation.steps.map((step) =>
                  step.status === 'pending' || step.status === 'running' ? { ...step, status: 'cancelled' } : step
                )
              }
            }
          : message
      ),
      isBusy: false,
      phase: 'idle',
      error: null
    }))
  },

  clearChat: () => {
    activeTurn++
    if (activeRequestId) {
      void abortChatRequest(activeRequestId)
      activeRequestId = null
    }
    abortInvestigationRequests()
    set({
      messages: [],
      isBusy: false,
      phase: 'idle',
      error: null,
      pendingFix: null,
      chatReasoningEffort: DEFAULT_CHAT_REASONING_EFFORT
    })
  },
  clearError: () => set({ error: null }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setFloating: (floating) => set({ floating }),
  setFloatingRect: (rect) => set((s) => ({ floatingRect: { ...s.floatingRect, ...rect } }))
}))

async function runToolCall(
  set: (partial: Partial<AiState> | ((state: AiState) => Partial<AiState>)) => void,
  messageId: string,
  callId: string,
  uiCall: UiToolCall
): Promise<void> {
  updateToolCall(set, messageId, callId, 'running', uiCall.result ?? '')

  let result: string
  let status: ToolCallStatus
  try {
    result = await executeToolCall({ ...uiCall.call, arguments: uiCall.resolvedArgs })
    status = 'completed'
  } catch (err) {
    result = err instanceof Error ? err.message : String(err)
    status = 'failed'
  }

  updateToolCall(set, messageId, callId, status, result)
}

function updateToolCall(
  set: (partial: Partial<AiState> | ((state: AiState) => Partial<AiState>)) => void,
  messageId: string,
  callId: string,
  status: ToolCallStatus,
  result: string
): void {
  set((state) => ({
    messages: state.messages.map((m) =>
      m.id !== messageId
        ? m
        : {
            ...m,
            toolCalls: m.toolCalls?.map((c) => (c.call.id === callId ? { ...c, status, result } : c))
          }
    )
  }))
}

async function continueIfAllResolved(
  get: () => AiState,
  set: (partial: Partial<AiState> | ((state: AiState) => Partial<AiState>)) => void,
  messageId: string
): Promise<void> {
  const message = get().messages.find((m) => m.id === messageId)
  if (!message?.toolCalls || message.toolCalls.some((c) => c.status === 'pending')) return

  // Read-only tools run without an approval click, so a model that keeps
  // calling them would loop (and bill) forever. Stop after a bounded number of
  // tool rounds since the user last typed something.
  const messages = get().messages
  let roundsSinceUser = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user' && !m.toolFeedback) break
    if (m.role === 'user') roundsSinceUser++
  }
  if (roundsSinceUser >= MAX_TOOL_ROUNDS_PER_REQUEST) {
    set({
      isBusy: false,
      phase: 'idle',
      error: getT().stores.tooManyToolRounds(MAX_TOOL_ROUNDS_PER_REQUEST)
    })
    return
  }

  const noResult = getT().stores.noResult
  const summary = message.toolCalls
    .map((c) => `[Tool feedback] ${c.call.name}: ${c.result ?? noResult}`)
    .join('\n')
  const toolFeedback: ToolFeedbackEntry[] = message.toolCalls.map((c) => ({
    name: c.call.name,
    result: c.result ?? noResult
  }))
  const followUp: ChatUiMessage = { id: newId(), role: 'user', content: summary, toolFeedback }
  const turn = ++activeTurn
  set((state) => ({ messages: [...state.messages, followUp], isBusy: true, phase: 'thinking' }))
  await requestAssistantTurn(get, set, turn)
  if (turn !== activeTurn) return
  set({ isBusy: false, phase: 'idle' })
}

// Builds UiToolCall entries for every tool call the assistant proposed,
// running prepareToolCall (live, read-only git/GitHub calls) for each one.
// A tool whose prepare step throws (e.g. missing param, no GitHub remote)
// is surfaced as an already-failed card instead of a crash, mirroring how
// AiToolService.PrepareAsync exceptions became tool failures in the C# app.
async function buildUiToolCalls(calls: ToolCallRequest[]): Promise<UiToolCall[]> {
  return Promise.all(
    calls.map(async (call): Promise<UiToolCall> => {
      try {
        const { preview, resolvedArgs } = await prepareToolCall(call)
        return { call, preview, resolvedArgs, status: 'pending' }
      } catch (err) {
        return {
          call,
          preview: { headline: getT().tools.label[call.name] ?? call.name, fields: [], severity: 'read' },
          resolvedArgs: call.arguments,
          status: 'failed',
          result: err instanceof Error ? err.message : String(err)
        }
      }
    })
  )
}

function buildApiHistory(messages: ChatUiMessage[], useNative: boolean, language: AiLanguage): ChatMessage[] {
  const history: ChatMessage[] = []

  for (const m of messages) {
    if (m.role === 'user' && m.toolFeedback) {
      // Native protocol replays tool results from the preceding assistant
      // message; the synthetic user summary is only for textual fallback.
      if (!useNative) history.push({ role: 'user', content: m.content })
      continue
    }

    if (m.role === 'user') {
      // Neutral label: modelInstruction now carries more than the teacher
      // persona, and each instruction names its own role/context anyway.
      const content = m.modelInstruction
        ? `${m.modelInstruction}\n\n${userRequestLabel(language)}: ${m.content}`
        : m.content
      history.push({ role: 'user', content })
      continue
    }

    const resolved = m.toolCalls?.filter(
      (c) => c.status === 'completed' || c.status === 'failed' || c.status === 'cancelled'
    )
    if (useNative && resolved && resolved.length > 0) {
      history.push({
        role: 'assistant',
        content: m.content,
        toolCalls: resolved.map((c) => c.call)
      })
      for (const c of resolved) {
        history.push({
          role: 'tool',
          toolCallId: c.call.id,
          toolName: c.call.name,
          content: c.result ?? ''
        })
      }
    } else {
      history.push({ role: 'assistant', content: m.content })
    }
  }

  return history
}

async function requestAssistantTurn(
  get: () => AiState,
  set: (partial: Partial<AiState> | ((state: AiState) => Partial<AiState>)) => void,
  turn: number
): Promise<void> {
  const { settings, apiKey, messages } = get()
  if (!settings) return
  const activeSettings = settings

  // The chat uses its own effort, not the saved setting (that one still drives
  // commit messages, explanations and investigations).
  const chatEffort = get().chatReasoningEffort
  // Resolved with the chat effort so the sampling set (thinking / non-thinking) follows it too.
  let config: ResolvedAiConfig = resolveActiveConfig(activeSettings, chatEffort)
  const key = configKey(config)
  // Re-resolved (not just effort flipped) so sampling also switches to the
  // non-thinking set, matching what the settings hint promises for effort off.
  if (reasoningEffortUnsupported.has(key)) config = resolveActiveConfig(activeSettings, 'off')
  const reasoning = reasoningInstruction(getLocale(), chatEffort)
  const language = languageInstruction(getLocale())
  const includePrSkills = shouldIncludePrSkills(messages)
  const scmSkillIds = selectScmSkills(messages)
  const scmSkills = scmSkillIds.map((id) => SCM_SKILLS[getLocale()][id])
  const fileFacts = scmSkillIds.includes('unwanted-file') ? await unwantedFileFacts(messages, getLocale()) : ''

  function buildSystemContent(useNative: boolean): string {
    return [
      appSystemPrompt(getLocale()),
      language,
      useNative ? TOOL_RULES_SECTION : buildTextualToolsPrompt(TOOL_CATALOG),
      ...(includePrSkills ? PR_SKILLS[getLocale()] : []),
      ...scmSkills,
      fileFacts,
      reasoning,
      buildRepoContext(getLocale())
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  async function attempt(useNative: boolean): Promise<{ content: string; toolCalls: ToolCallRequest[] } | null> {
    const history = buildApiHistory(messages, useNative, getLocale())
    const fullHistory: ChatMessage[] = [{ role: 'system', content: buildSystemContent(useNative) }, ...history]
    const requestId = nextRequestId()
    activeRequestId = requestId
    const outcome = await sendToolAwareChatRequest(config, apiKey, fullHistory, useNative ? TOOL_CATALOG : [], requestId)
    if (activeRequestId === requestId) activeRequestId = null

    if (outcome.ok && outcome.response) {
      if (useNative) return { content: outcome.response.content, toolCalls: outcome.response.toolCalls }

      // Textual fallback: no native tool_calls come back, so parse the
      // <tool_call> block out of the assistant's own text instead.
      const { call, textWithoutCall } = parseTextualToolCall(outcome.response.content)
      return { content: textWithoutCall, toolCalls: call ? [call] : [] }
    }

    // Checked before the tools fallback: a 400 here may be the effort field, and
    // dropping native tools would not fix that. Retry once without it, and only
    // remember the model as effort-less if that retry got past the 400.
    if (
      config.reasoningEffort !== 'off' &&
      outcome.statusCode !== undefined &&
      UNSUPPORTED_REASONING_STATUS_CODES.has(outcome.statusCode)
    ) {
      const withEffort = config
      config = resolveActiveConfig(activeSettings, 'off')
      const retried = await attempt(useNative)
      if (retried === null) {
        // Still rejected, now as a native-tools problem: the effort field was not
        // the cause, so keep it for the textual fallback request.
        config = withEffort
      } else {
        reasoningEffortUnsupported.add(key)
      }
      return retried
    }

    if (useNative && outcome.statusCode !== undefined && UNSUPPORTED_TOOLS_STATUS_CODES.has(outcome.statusCode)) {
      nativeToolsUnsupported.add(key)
      return null // signal: caller should retry with the textual fallback
    }

    throw new Error(outcome.errorMessage ?? contactProviderFailedMessage(getLocale()))
  }

  try {
    const useNative = !nativeToolsUnsupported.has(key)
    let result = await attempt(useNative)
    if (turn !== activeTurn) return
    if (result === null) result = await attempt(false)
    if (turn !== activeTurn) return
    // attempt(false) never returns null (that only happens on the native-tools
    // rejection path, which requires useNative=true) — this satisfies the type
    // checker for what is otherwise an unreachable case.
    if (result === null) throw new Error(contactProviderFailedMessage(getLocale()))

    const toolCalls = result.toolCalls.length > 0 ? await buildUiToolCalls(result.toolCalls) : undefined
    if (turn !== activeTurn) return
    const assistantMessage: ChatUiMessage = {
      id: newId(),
      role: 'assistant',
      content: result.content,
      toolCalls
    }
    set((state) => ({ messages: [...state.messages, assistantMessage] }))

    // Read-only tools (list branches, check incoming commits, read a PR, …)
    // don't touch the repo or a remote, so they run immediately instead of
    // waiting on the approve/cancel gate — that gate exists for writes.
    const readCalls = toolCalls?.filter((c) => c.status === 'pending' && toolSeverity(c.call.name) === 'read') ?? []
    for (const uiCall of readCalls) {
      await runToolCall(set, assistantMessage.id, uiCall.call.id, uiCall)
      if (turn !== activeTurn) return
    }
    // Also covers a tool that failed during prepare (bad params, branch
    // conflict, etc.) — it never becomes 'pending', so the model should see
    // the failure and react instead of the turn silently ending.
    await continueIfAllResolved(get, set, assistantMessage.id)
  } catch (err) {
    if (turn !== activeTurn) return
    set({ error: err instanceof Error ? err.message : String(err) })
  }
}
