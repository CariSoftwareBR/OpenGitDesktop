import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CircleHelp,
  GitBranch,
  GitBranchPlus,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react'
import Github from '../components/icons/Github'
import PostMergeActions from '../components/PostMergeActions'
import { usePullRequestStore } from '../store/pullRequestStore'
import { useRepoStore } from '../store/repoStore'
import { getActiveAiConfig, isAiConfigured, useAiStore } from '../store/aiStore'
import { generatePrDraft } from '../lib/ai/prDraft'
import { reviewPrDraft } from '../lib/ai/prReview'
import { useClickOutside } from '../lib/useClickOutside'
import { NARROW_LAYOUT_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import DiffViewer from '../components/DiffViewer'
import Combobox from '../components/Combobox'
import Switch from '../components/Switch'
import ConfirmDialog, { PromptDialog } from '../components/ConfirmDialog'
import GithubLoginModal from '../components/GithubLoginModal'
import Markdown from '../components/Markdown'
import Pagination from '../components/Pagination'
import type { PullRequestState } from '../lib/github'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return iso
  }
}

const STATE_FILTER_OPTIONS = [
  { value: 'open', label: 'Abertas' },
  { value: 'closed', label: 'Fechadas' },
  { value: 'all', label: 'Todas' }
]

const MERGE_METHOD_OPTIONS = [
  { value: 'merge', label: 'Commit de merge' },
  { value: 'squash', label: 'Squash e merge' },
  { value: 'rebase', label: 'Rebase e merge' }
]

const MIN_LIST_WIDTH = 240
const MAX_LIST_WIDTH = 640
const DEFAULT_LIST_WIDTH = 360

const MIN_FILES_WIDTH = 180
const MAX_FILES_WIDTH = 560
const DEFAULT_FILES_WIDTH = 280

const MIN_COMMENTS_HEIGHT = 120
const MAX_COMMENTS_HEIGHT = 520
const DEFAULT_COMMENTS_HEIGHT = 224

const MIN_HEADER_HEIGHT = 120
const MAX_HEADER_HEIGHT = 480

const PR_PAGE_SIZE = 10

const MERGE_METHOD_HELP: Record<(typeof MERGE_METHOD_OPTIONS)[number]['value'], string> = {
  merge:
    'Cria um commit de merge na branch base, preservando todos os commits da branch da PR e o histórico completo.',
  squash:
    'Junta todos os commits da PR em um único commit na branch base. O histórico da branch fica limpo, com só um commit.',
  rebase:
    'Reaplica cada commit da PR um a um em cima da branch base, sem criar um commit de merge. O histórico fica linear.'
}

function MergeMethodHint({ method }: { method: keyof typeof MERGE_METHOD_HELP }): JSX.Element {
  const [open, setOpen] = useState(false)
  const hintId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const settings = useAiStore((s) => s.settings)
  const apiKey = useAiStore((s) => s.apiKey)
  const loadSettings = useAiStore((s) => s.loadSettings)
  const askAsTeacher = useAiStore((s) => s.askAsTeacher)
  const isBusy = useAiStore((s) => s.isBusy)
  const aiReady = isAiConfigured(settings, apiKey)

  useClickOutside(rootRef, () => setOpen(false))

  useEffect(() => {
    if (!settings) void loadSettings()
  }, [settings, loadSettings])

  async function askAiAbout(topicLabel: string): Promise<void> {
    if (!aiReady || isBusy) return
    setOpen(false)
    await askAsTeacher(topicLabel)
  }

  return (
    <span ref={rootRef} className="relative inline-flex shrink-0 items-center">
      <button
        type="button"
        className="hit-area rounded-sm p-1 text-tertiary-text transition-colors hover:text-secondary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue"
        aria-label="O que significa este método de merge?"
        aria-expanded={open}
        aria-controls={hintId}
        onClick={() => setOpen((v) => !v)}
      >
        <CircleHelp size={15} aria-hidden />
      </button>
      {open && (
        <div
          id={hintId}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1 w-80 rounded-md border border-default-border bg-coal-raised px-2 py-2 text-caption leading-snug text-secondary-text shadow-floating"
        >
          <ul className="flex flex-col gap-0.5">
            {MERGE_METHOD_OPTIONS.map((o) => {
              const selected = o.value === method
              return (
                <li
                  key={o.value}
                  className={`group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors ${
                    selected ? 'bg-active-overlay' : 'hover:bg-hover-overlay'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-primary-text">{o.label}</p>
                    <p className="mt-0.5">{MERGE_METHOD_HELP[o.value]}</p>
                  </div>
                  {aiReady && (
                    <button
                      type="button"
                      title={`Perguntar à IA sobre ${o.label}`}
                      aria-label={`Perguntar à IA sobre ${o.label}`}
                      disabled={isBusy}
                      onClick={() => void askAiAbout(o.label)}
                      className="hit-area mt-0.5 shrink-0 rounded-sm p-1 text-command-blue opacity-0 transition-[opacity,background-color,transform] duration-100 hover:bg-command-blue-soft group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 active:scale-90 disabled:opacity-30"
                    >
                      <Bot size={14} aria-hidden />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </span>
  )
}

function LoginForm(): JSX.Element {
  const remote = usePullRequestStore((s) => s.remote)
  const isBusy = usePullRequestStore((s) => s.isBusy)
  const loginWithToken = usePullRequestStore((s) => s.loginWithToken)
  const loginSuccess = usePullRequestStore((s) => s.loginSuccess)
  const [token, setToken] = useState('')
  const [loginModalOpen, setLoginModalOpen] = useState(false)

  return (
    <div className="rise-in w-full max-w-md rounded-lg border border-default-border bg-obsidian-panel p-6 shadow-[var(--shadow-raised)]">
      <span className="empty-medallion mb-4 text-primary-text">
        <Github size={20} />
      </span>
      <p className="mb-4 text-body text-secondary-text">
        Remote detectado: <strong className="text-primary-text">{remote?.owner}/{remote?.repo}</strong> em{' '}
        <span className="text-tertiary-text">{remote?.host}</span>. Entre com o GitHub para listar e gerenciar Pull
        Requests.
      </p>

      <button
        onClick={() => setLoginModalOpen(true)}
        disabled={isBusy}
        className="btn-primary mb-3 flex w-full items-center justify-center gap-2"
      >
        <Github size={16} /> Continuar com GitHub
      </button>

      <div className="mb-2 flex items-center gap-2 text-label uppercase tracking-wide text-tertiary-text">
        <span className="h-px flex-1 bg-default-border" /> ou use um token <span className="h-px flex-1 bg-default-border" />
      </div>

      <div className="flex gap-2">
        <input
          type="password"
          placeholder="ghp_… (ou GitHub Enterprise)"
          aria-label="Personal Access Token do GitHub"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="field flex-1"
        />
        <button onClick={() => loginWithToken(token.trim())} disabled={!token.trim() || isBusy} className="btn-secondary shrink-0">
          Entrar
        </button>
      </div>

      <GithubLoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        host={remote?.host ?? 'github.com'}
        onSuccess={(user) => {
          loginSuccess(user)
          setLoginModalOpen(false)
        }}
      />
    </div>
  )
}

const PR_WIZARD_STEPS = [
  { n: 1, label: 'Origem' },
  { n: 2, label: 'Título' },
  { n: 3, label: 'Destino' },
  { n: 4, label: 'Revisão' }
] as const

// Only the conventional default names are guessed; anything else keeps "main",
// which GitHub accepts as long as it exists on the remote.
function pickDefaultBase(branches: { name: string }[], head: string): string {
  const names = branches.map((b) => b.name).filter((n) => n !== head)
  const preferred = ['main', 'master', 'develop'].find((n) => names.includes(n))
  if (preferred) return preferred
  if (head !== 'main') return 'main'
  return names[0] ?? ''
}

// A subset of `git check-ref-format`, enough to catch what people actually
// type (spaces, "..", trailing slash) before git rejects it with a raw error.
function branchNameProblem(name: string, branches: { name: string }[], currentBranch?: string): string | null {
  if (!name) return null
  if (/\s/.test(name)) return 'O nome da branch não pode ter espaços.'
  if (/[~^:?*[\\]/.test(name) || name.includes('..') || name.includes('@{')) {
    return 'Caracteres inválidos. Use letras, números, "-", "_", "." e "/".'
  }
  if (
    name.startsWith('/') ||
    name.endsWith('/') ||
    name.startsWith('-') ||
    name.endsWith('.') ||
    name.endsWith('.lock') ||
    name.includes('//') ||
    name.split('/').some((part) => part.startsWith('.'))
  ) {
    return 'Nome de branch inválido para o Git.'
  }
  if (name !== currentBranch && branches.some((b) => b.name === name)) return 'Já existe uma branch com esse nome.'
  return null
}

// The review prompt asks for a one-line ✅/⚠️ verdict first; lifting it out of
// the markdown lets the panel show it as a headline. Anything else renders as-is.
function splitReviewVerdict(text: string): { tone: 'success' | 'attention' | 'neutral'; verdict: string | null; rest: string } {
  const trimmed = text.trim()
  const newline = trimmed.indexOf('\n')
  const first = (newline >= 0 ? trimmed.slice(0, newline) : trimmed).trim()
  const tone = first.startsWith('✅') ? 'success' : first.startsWith('⚠') ? 'attention' : 'neutral'
  if (tone === 'neutral') return { tone, verdict: null, rest: trimmed }
  return {
    tone,
    verdict: first.replace(/^(✅|⚠️?)\s*/u, ''),
    rest: newline >= 0 ? trimmed.slice(newline + 1).trim() : ''
  }
}

const REVIEW_TONE = {
  success: { medallion: 'border-success-green/30 bg-success-green-soft text-success-green', verdict: 'text-success-green' },
  attention: { medallion: 'border-attention-orange/30 bg-attention-orange-soft text-attention-orange', verdict: 'text-attention-orange' },
  neutral: { medallion: 'border-command-blue/30 bg-command-blue-soft text-command-blue', verdict: 'text-secondary-text' }
} as const

function BranchChip({ name }: { name: string }): JSX.Element {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-pill border border-default-border bg-coal-raised px-2 py-0.5 font-mono text-[12px] leading-4 text-primary-text">
      <GitBranch size={11} className="shrink-0 text-tertiary-text" aria-hidden />
      <span className="truncate">{name || '—'}</span>
    </span>
  )
}

function WizardSteps({ step }: { step: 1 | 2 | 3 | 4 }): JSX.Element {
  const last = PR_WIZARD_STEPS.length - 1
  return (
    <>
      <p className="sr-only" aria-live="polite">
        Passo {step} de {PR_WIZARD_STEPS.length}: {PR_WIZARD_STEPS[step - 1].label}
      </p>
      <ol className="flex items-center" aria-hidden>
        {PR_WIZARD_STEPS.map((s, i) => {
          const done = step > s.n
          const active = step === s.n
          return (
            <li key={s.n} className={`flex items-center ${i < last ? 'flex-1' : ''}`}>
              <span className="flex items-center gap-2">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold tabular-nums transition-[background-color,border-color,color,box-shadow] duration-300 ${
                    active
                      ? 'border-command-blue bg-command-blue text-midnight-base shadow-[0_0_0_4px_var(--color-command-blue-soft)]'
                      : done
                        ? 'border-command-blue/50 bg-command-blue-soft text-command-blue'
                        : 'border-default-border bg-coal-raised text-tertiary-text'
                  }`}
                >
                  {done ? <Check size={13} strokeWidth={2.5} aria-hidden /> : s.n}
                </span>
                <span
                  className={`text-caption font-medium transition-colors duration-300 ${
                    active ? 'text-primary-text' : done ? 'hidden text-secondary-text @[520px]:inline' : 'hidden text-tertiary-text @[520px]:inline'
                  }`}
                >
                  {s.label}
                </span>
              </span>
              {i < last && (
                <span className="mx-3 h-px flex-1 overflow-hidden rounded-full bg-default-border">
                  <span
                    className="block h-full origin-left bg-command-blue transition-transform duration-500 ease-[var(--ease-out-expo)]"
                    style={{ transform: `scaleX(${done ? 1 : 0})` }}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}

const UNTRACKED_PREVIEW_CHARS = 20_000
const MAX_UNTRACKED_FILES = 50

// Everything fase 3 will turn into the PR: commits already on the branch, plus
// staged and unstaged edits, plus new untracked files (which `git diff` omits),
// rendered as additions so the model sees their content.
async function getDraftDiff(
  repoPath: string,
  base: string,
  head: string,
  entries: { path: string; index: string; worktree: string }[]
): Promise<string> {
  // git status lists a brand-new folder as a single "dir/" entry; expand it to
  // the files inside (all untracked, since nothing in it is tracked yet).
  const untrackedEntries = entries.filter((e) => e.index === '?' && e.worktree === '?')
  const untracked = (
    await Promise.all(
      untrackedEntries.map((e) =>
        e.path.endsWith('/')
          ? window.api.git.listFiles(repoPath, e.path).catch((): string[] => [])
          : Promise.resolve([e.path])
      )
    )
  )
    .flat()
    .slice(0, MAX_UNTRACKED_FILES)
  const [committed, staged, unstaged, newFiles] = await Promise.all([
    // The branch may not exist on the base yet (e.g. a just-created branch); the
    // working-tree parts still make a usable draft.
    window.api.git.branchDiff(repoPath, base, head).catch(() => ''),
    window.api.git.diffStagedAll(repoPath),
    window.api.git.diffUnstagedAll(repoPath),
    Promise.all(
      untracked.map(async (path) => {
        const content = await window.api.fs.readRepoFile(repoPath, path).catch(() => '')
        const preview = content.length > UNTRACKED_PREVIEW_CHARS ? content.slice(0, UNTRACKED_PREVIEW_CHARS) : content
        const lines = preview.split('\n').map((line) => `+${line}`)
        return `diff --git a/${path} b/${path}\nnew file\n--- /dev/null\n+++ b/${path}\n${lines.join('\n')}`
      })
    )
  ])
  return [committed, staged, unstaged, ...newFiles].filter((d) => d.trim()).join('\n')
}

function NewPullRequestWizard({
  onClose,
  onBusyChange
}: {
  onClose: () => void
  /** Lets the parent refuse to close the wizard mid commit/push/branch creation. */
  onBusyChange: (busy: boolean) => void
}): JSX.Element {
  const branches = useRepoStore((s) => s.branches)
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const status = useRepoStore((s) => s.status)
  const createBranch = useRepoStore((s) => s.createBranch)
  const stagePaths = useRepoStore((s) => s.stagePaths)
  const commitChanges = useRepoStore((s) => s.commitChanges)
  const syncBranch = useRepoStore((s) => s.sync)
  const isBusy = usePullRequestStore((s) => s.isBusy)
  const createPullRequest = usePullRequestStore((s) => s.createPullRequest)
  const aiSettings = useAiStore((s) => s.settings)
  const aiApiKey = useAiStore((s) => s.apiKey)
  const aiReady = isAiConfigured(aiSettings, aiApiKey)
  const currentBranch = branches.find((b) => b.isCurrent)?.name
  const hasUncommittedChanges = (status?.entries.length ?? 0) > 0

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [head, setHead] = useState(currentBranch ?? '')
  const [base, setBase] = useState(() => pickDefaultBase(branches, currentBranch ?? ''))
  const [draft, setDraft] = useState(false)
  const [branchMode, setBranchMode] = useState<'current' | 'new'>('current')
  const [newBranchName, setNewBranchName] = useState('')
  const draftLabelId = useId()
  const titleId = useId()
  const newBranchInputId = useId()
  const newBranchProblem = branchMode === 'new' ? branchNameProblem(newBranchName.trim(), branches, currentBranch) : null

  function goToStep(next: 1 | 2 | 3 | 4): void {
    setDirection(next > step ? 'forward' : 'back')
    setStep(next)
  }

  const [preparingBranch, setPreparingBranch] = useState(false)
  const [branchError, setBranchError] = useState<string | null>(null)

  // Fase 1 settles what "origem" actually is before anything else happens:
  // if the user asked for a new branch, create+checkout it right here (from
  // whatever's currently checked out) so every later phase — the diff fase 2
  // drafts from, the branch fase 4 commits/pushes — already sees the real
  // branch, never a placeholder.
  async function handleOriginAdvance(): Promise<void> {
    if (preparingBranch) return
    if (branchMode === 'current') {
      setHead(currentBranch ?? '')
      goToStep(2)
      return
    }
    const name = newBranchName.trim()
    if (!name) {
      setBranchError('Informe um nome para a nova branch.')
      return
    }
    if (newBranchProblem) return
    // Coming back to fase 1 after the branch was already created and checked
    // out: creating it again would fail with "already exists".
    if (currentBranch === name) {
      setHead(name)
      goToStep(2)
      return
    }
    setPreparingBranch(true)
    setBranchError(null)
    try {
      // Clear any unrelated earlier repo error so the check below only sees this operation's.
      useRepoStore.setState({ error: null })
      await createBranch(name, true)
      const err = useRepoStore.getState().error
      if (err) throw new Error(err)
      setHead(name)
      goToStep(2)
    } catch (err) {
      setBranchError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreparingBranch(false)
    }
  }

  const [descTab, setDescTab] = useState<'normal' | 'preview'>('normal')

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [justGenerated, setJustGenerated] = useState(false)
  const [flashKey, setFlashKey] = useState(0)

  async function handleGenerateDraft(): Promise<void> {
    if (!currentRepoPath || generating) return
    const effectiveHead = head || currentBranch || ''
    const effectiveBase = base || 'main'
    setGenerating(true)
    setGenerateError(null)
    try {
      const { settings, apiKey } = await getActiveAiConfig()
      const diff = hasUncommittedChanges
        ? await getDraftDiff(currentRepoPath, effectiveBase, effectiveHead, useRepoStore.getState().status?.entries ?? [])
        : await window.api.git.branchDiff(currentRepoPath, effectiveBase, effectiveHead)
      if (!diff.trim()) throw new Error('Não há diferenças para gerar um título e descrição.')
      const draftResult = await generatePrDraft(settings, apiKey, {
        headBranch: effectiveHead,
        baseBranch: effectiveBase,
        diff
      })
      setTitle(draftResult.title)
      setBody(draftResult.body)
      setFlashKey((k) => k + 1)
      setJustGenerated(true)
      window.setTimeout(() => setJustGenerated(false), 1400)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  const [preparing, setPreparing] = useState(false)
  const [prepareError, setPrepareError] = useState<string | null>(null)

  // Fase 3's "Próximo" doesn't just flip a step: it makes the branch match
  // what fase 4 is about to show (commit whatever's dirty, push) so the
  // review is always of something that could actually become a PR — the
  // wizard never expects the user to leave it to prep the branch elsewhere.
  async function handleDestinationAdvance(): Promise<void> {
    if (!currentRepoPath || preparing || !canGoNext) return
    setPreparing(true)
    setPrepareError(null)
    try {
      // Each step reports failure only through repoStore.error, so clear it
      // before every step — otherwise an unrelated earlier error blocks the wizard.
      const currentStatus = useRepoStore.getState().status
      if (currentStatus && currentStatus.entries.length > 0) {
        useRepoStore.setState({ error: null })
        await stagePaths(currentStatus.entries.map((e) => e.path))
        const stageErr = useRepoStore.getState().error
        if (stageErr) throw new Error(stageErr)

        useRepoStore.setState({ error: null })
        await commitChanges(title.trim() || 'Atualização', body.trim())
        const commitErr = useRepoStore.getState().error
        if (commitErr) throw new Error(commitErr)
      }

      useRepoStore.setState({ error: null })
      await syncBranch()
      const syncErr = useRepoStore.getState().error
      if (syncErr) throw new Error(syncErr)

      goToStep(4)
    } catch (err) {
      setPrepareError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreparing(false)
    }
  }

  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewResult, setReviewResult] = useState<string | null>(null)
  const [reviewExpanded, setReviewExpanded] = useState(true)
  const [reviewKey, setReviewKey] = useState(0)
  const [justReviewed, setJustReviewed] = useState(false)

  async function handleReview(): Promise<void> {
    if (!currentRepoPath || reviewing) return
    setReviewing(true)
    setReviewError(null)
    try {
      const { settings, apiKey } = await getActiveAiConfig()
      const diff = await window.api.git.branchDiff(currentRepoPath, base, head)
      const result = await reviewPrDraft(settings, apiKey, { title, body, headBranch: head, baseBranch: base, diff })
      setReviewResult(result)
      setReviewExpanded(true)
      setReviewKey((k) => k + 1)
      setJustReviewed(true)
      window.setTimeout(() => setJustReviewed(false), 1400)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : String(err))
    } finally {
      setReviewing(false)
    }
  }

  async function handleCreate(): Promise<void> {
    if (!title.trim() || !head || !base) return
    const ok = await createPullRequest({ title: title.trim(), body: body.trim(), head, base, draft })
    if (ok) onClose()
  }

  const canGoNext =
    step === 1
      ? branchMode === 'current'
        ? Boolean(currentBranch)
        : newBranchName.trim().length > 0 && !newBranchProblem
      : step === 2
        ? title.trim().length > 0
        : head.trim().length > 0 && base.trim().length > 0 && head !== base

  // The destination list never offers the origin itself, and arriving at fase
  // 3 with base === head (e.g. PR from "main" while on main) picks a sensible
  // default instead of greeting the user with an error they didn't cause.
  const baseOptions = branches.filter((b) => b.name !== head).map((b) => ({ value: b.name, label: b.name }))
  // Until the user picks a destination themselves, the default follows the
  // origin chosen in fase 1 (a branch created there must still target main).
  const [baseTouched, setBaseTouched] = useState(false)
  useEffect(() => {
    if (!baseTouched || !base || base === head) setBase(pickDefaultBase(branches, head))
  }, [head, base, branches, baseTouched])

  // Async steps that change the repository must not be walked away from.
  const stepBusy = preparingBranch || preparing || (step === 4 && isBusy)
  useEffect(() => {
    onBusyChange(stepBusy)
  }, [stepBusy, onBusyChange])
  useEffect(() => () => onBusyChange(false), [onBusyChange])

  const optionCard = (selected: boolean, disabled = false): string =>
    `rounded-md border p-3.5 transition-[background-color,border-color] duration-150 ${
      selected
        ? 'border-command-blue/60 bg-active-overlay'
        : disabled
          ? 'border-default-border bg-obsidian-panel opacity-60'
          : 'border-default-border bg-obsidian-panel hover:border-primary-text/20 hover:bg-hover-overlay'
    }`
  const fieldLabel = 'text-caption font-medium text-secondary-text'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="@container shrink-0 border-b border-default-border px-5 pb-4 pt-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="empty-medallion size-9 text-command-blue">
              <GitPullRequest size={17} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-title font-semibold text-primary-text">Nova Pull Request</h2>
              {step > 1 && (
                <div className="mt-1 flex min-w-0 items-center gap-1.5 text-caption text-tertiary-text">
                  <BranchChip name={head} />
                  <ArrowRight size={12} className="shrink-0" aria-hidden />
                  <BranchChip name={base} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={stepBusy}
              aria-label="Fechar"
              className="shrink-0 rounded-sm p-1.5 text-tertiary-text transition-colors hover:bg-hover-overlay hover:text-primary-text"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <WizardSteps step={step} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div
          key={step}
          className={`mx-auto w-full max-w-[640px] px-5 py-6 ${
            direction === 'forward' ? 'animate-[wizard-step-in-forward_0.28s_ease-out]' : 'animate-[wizard-step-in-back_0.28s_ease-out]'
          }`}
        >
          {step === 1 && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-3 text-body text-secondary-text">De qual branch as mudanças vão sair?</legend>

              <div className={optionCard(branchMode === 'current', !currentBranch)}>
                <label className={`flex items-start gap-3 ${currentBranch ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <input
                    type="radio"
                    name="pr-branch-mode"
                    checked={branchMode === 'current'}
                    onChange={() => setBranchMode('current')}
                    disabled={!currentBranch}
                    className="mt-2.5 size-4 shrink-0 accent-command-blue"
                  />
                  <span className="empty-medallion size-9 shrink-0">
                    <GitBranch size={16} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col items-start gap-1">
                    <span className="text-body font-medium text-primary-text">Usar a branch atual</span>
                    {currentBranch ? (
                      <BranchChip name={currentBranch} />
                    ) : (
                      <span className="text-caption text-tertiary-text">Nenhuma branch ativa (HEAD destacado).</span>
                    )}
                  </span>
                </label>
              </div>

              <div className={optionCard(branchMode === 'new')}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="pr-branch-mode"
                    checked={branchMode === 'new'}
                    onChange={() => setBranchMode('new')}
                    className="mt-2.5 size-4 shrink-0 accent-command-blue"
                  />
                  <span className="empty-medallion size-9 shrink-0">
                    <GitBranchPlus size={16} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-body font-medium text-primary-text">Criar nova branch</span>
                    {currentBranch && (
                      <span className="flex min-w-0 items-center gap-1.5 text-caption text-tertiary-text">
                        a partir de <BranchChip name={currentBranch} />
                      </span>
                    )}
                  </span>
                </label>
                {branchMode === 'new' && (
                  <div className="mt-3 flex flex-col gap-1.5 pl-[76px] animate-[wizard-panel-in_0.2s_ease-out]">
                    <label htmlFor={newBranchInputId} className="sr-only">
                      Nome da nova branch
                    </label>
                    <input
                      id={newBranchInputId}
                      type="text"
                      placeholder="feature/…"
                      aria-label="Nome da nova branch"
                      aria-invalid={Boolean(newBranchProblem)}
                      autoFocus
                      spellCheck={false}
                      value={newBranchName}
                      onChange={(e) => {
                        setNewBranchName(e.target.value)
                        setBranchError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canGoNext && !preparingBranch) {
                          e.preventDefault()
                          void handleOriginAdvance()
                        }
                      }}
                      className={`field font-mono ${newBranchProblem ? 'border-danger-red!' : ''}`}
                    />
                    {newBranchProblem && (
                      <p className="flex items-center gap-1.5 text-caption text-danger-red">
                        <AlertTriangle size={12} className="shrink-0" aria-hidden />
                        {newBranchProblem}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {branchError && (
                <p role="alert" className="flex items-start gap-1.5 text-caption text-danger-red">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
                  {branchError}
                </p>
              )}
            </fieldset>
          )}

          {step === 2 && (
            <div key={flashKey} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={titleId} className={fieldLabel}>
                    Título
                  </label>
                  {aiReady && (
                    <button
                      type="button"
                      onClick={() => void handleGenerateDraft()}
                      disabled={generating}
                      title="Gerar título e descrição com IA a partir do diff da branch"
                      aria-label="Gerar título e descrição com IA"
                      className="btn-agent"
                    >
                      {generating ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                      ) : justGenerated ? (
                        <Check size={13} className="animate-[pop_0.3s_ease-out] text-success-green" aria-hidden />
                      ) : (
                        <Sparkles size={13} aria-hidden />
                      )}
                      <span className={generating ? 'agent-busy-shimmer' : undefined}>
                        {generating ? 'Gerando…' : 'Gerar com Agente'}
                      </span>
                    </button>
                  )}
                </div>
                <input
                  id={titleId}
                  type="text"
                  placeholder="Resuma a mudança em uma linha"
                  aria-label="Título da pull request"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canGoNext) {
                      e.preventDefault()
                      goToStep(3)
                    }
                  }}
                  className={`field text-body font-medium ${flashKey > 0 ? 'animate-[wizard-field-flash_1s_ease-out]' : ''}`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={fieldLabel}>Descrição</span>
                  <div
                    className="relative inline-flex w-44 shrink-0 overflow-hidden rounded-md bg-coal-raised p-1"
                    role="tablist"
                    aria-label="Modo de edição da descrição"
                  >
                    <div
                      aria-hidden
                      className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-sm bg-obsidian-panel shadow-[var(--shadow-raised)] transition-transform duration-200 ease-[var(--ease-out-expo)] ${
                        descTab === 'preview' ? 'translate-x-full' : 'translate-x-0'
                      }`}
                    />
                    <button
                      type="button"
                      role="tab"
                      aria-selected={descTab === 'normal'}
                      onClick={() => setDescTab('normal')}
                      className={`relative z-10 flex-1 rounded-sm py-1 text-center text-caption font-medium transition-colors duration-150 ${
                        descTab === 'normal' ? 'text-primary-text' : 'text-secondary-text hover:text-primary-text'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={descTab === 'preview'}
                      onClick={() => setDescTab('preview')}
                      className={`relative z-10 flex-1 rounded-sm py-1 text-center text-caption font-medium transition-colors duration-150 ${
                        descTab === 'preview' ? 'text-primary-text' : 'text-secondary-text hover:text-primary-text'
                      }`}
                    >
                      Prévia
                    </button>
                  </div>
                </div>
                <div className="overflow-hidden">
                  <div
                    key={descTab}
                    className={
                      descTab === 'preview'
                        ? 'animate-[wizard-step-in-forward_0.22s_ease-out]'
                        : 'animate-[wizard-step-in-back_0.22s_ease-out]'
                    }
                  >
                    {descTab === 'normal' ? (
                      <textarea
                        placeholder="Descrição (markdown suportado)"
                        aria-label="Descrição da pull request"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={10}
                        className={`field resize-y leading-relaxed ${flashKey > 0 ? 'animate-[wizard-field-flash_1s_ease-out]' : ''}`}
                      />
                    ) : (
                      <div className="min-h-[236px] rounded-sm border border-default-border bg-obsidian-panel px-3 py-2.5 text-body text-secondary-text">
                        {body.trim() ? (
                          <Markdown text={body} />
                        ) : (
                          <p className="text-caption text-tertiary-text">Nada para pré-visualizar.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {generateError && (
                <p role="alert" className="flex items-start gap-1.5 text-caption text-danger-red">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
                  {generateError}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-default-border bg-obsidian-panel p-4 shadow-[var(--shadow-raised)]">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className={fieldLabel}>Origem</span>
                    <div className="flex h-[34px] min-w-0 items-center gap-2 rounded-sm border border-default-border bg-coal-raised px-3 text-primary-text">
                      <GitBranch size={13} className="shrink-0 text-tertiary-text" aria-hidden />
                      <span className="truncate font-mono text-[13px]">{head}</span>
                    </div>
                  </div>
                  <span className="mb-[5px] flex size-6 items-center justify-center rounded-full bg-command-blue-soft text-command-blue">
                    <ArrowRight size={13} aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className={fieldLabel}>Destino</span>
                    <Combobox
                      value={base}
                      onChange={(value) => {
                        setBaseTouched(true)
                        setBase(value)
                      }}
                      options={baseOptions}
                      ariaLabel="Branch de destino"
                      placeholder="Destino"
                    />
                  </div>
                </div>
                {head && base && head === base && (
                  <p className="mt-3 flex items-center gap-1.5 text-caption text-danger-red">
                    <AlertTriangle size={12} className="shrink-0" aria-hidden />
                    Origem e destino não podem ser iguais.
                  </p>
                )}
                {baseOptions.length === 0 && (
                  <p className="mt-3 text-caption text-tertiary-text">
                    Não há outra branch local para usar como destino.
                  </p>
                )}
              </div>

              {hasUncommittedChanges && (
                <div className="flex items-start gap-2.5 rounded-md border border-attention-orange/25 bg-attention-orange-soft px-3.5 py-3 text-caption text-secondary-text">
                  <AlertTriangle size={14} className="mt-px shrink-0 text-attention-orange" aria-hidden />
                  <p>
                    Há {status?.entries.length} arquivo{status?.entries.length === 1 ? '' : 's'} com alterações — serão
                    adicionados, commitados e enviados automaticamente ao avançar, com a mensagem{' '}
                    <strong className="font-medium text-primary-text">“{title.trim() || 'Atualização'}”</strong>.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 rounded-md border border-default-border bg-obsidian-panel p-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="empty-medallion size-9 shrink-0">
                    <GitPullRequestDraft size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p id={draftLabelId} className="text-body font-medium text-primary-text">
                      Rascunho
                    </p>
                    <p className="text-caption text-secondary-text">
                      A PR abre como rascunho e só pode ser mesclada depois de marcada como pronta.
                    </p>
                  </div>
                </div>
                <Switch checked={draft} onChange={setDraft} ariaLabelledBy={draftLabelId} />
              </div>

              {prepareError && (
                <p role="alert" className="flex items-start gap-1.5 text-caption text-danger-red">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
                  {prepareError}
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <article className="overflow-hidden rounded-md border border-default-border bg-obsidian-panel shadow-[var(--shadow-raised)]">
                <header className="flex items-start gap-3 border-b border-default-border p-4">
                  {draft ? (
                    <GitPullRequestDraft size={18} className="mt-0.5 shrink-0 text-tertiary-text" aria-hidden />
                  ) : (
                    <GitPullRequest size={18} className="mt-0.5 shrink-0 text-success-green" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-title font-semibold text-primary-text [overflow-wrap:anywhere]">
                      {title || '(sem título)'}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-caption text-tertiary-text">
                      <BranchChip name={head} />
                      <ArrowRight size={12} className="shrink-0" aria-hidden />
                      <BranchChip name={base} />
                      {draft && (
                        <span className="rounded-pill border border-default-border px-2 py-0.5 text-label uppercase text-tertiary-text">
                          Rascunho
                        </span>
                      )}
                    </div>
                  </div>
                </header>
                <div className="p-4 text-body text-secondary-text">
                  {body ? <Markdown text={body} /> : <p className="text-caption text-tertiary-text">Sem descrição.</p>}
                </div>
              </article>

              {aiReady && (
                <div className="flex flex-col gap-3">
                  <button type="button" onClick={() => void handleReview()} disabled={reviewing} className="btn-agent w-fit">
                    {reviewing ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                    ) : justReviewed ? (
                      <Check size={13} className="animate-[pop_0.3s_ease-out] text-success-green" aria-hidden />
                    ) : (
                      <Sparkles size={13} aria-hidden />
                    )}
                    <span className={reviewing ? 'agent-busy-shimmer' : undefined}>
                      {reviewing ? 'Analisando…' : reviewResult ? 'Analisar novamente' : 'Analisar PR com Agente'}
                    </span>
                  </button>
                  {reviewError && (
                    <p role="alert" className="flex items-start gap-1.5 text-caption text-danger-red">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
                      {reviewError}
                    </p>
                  )}
                  {reviewResult &&
                    ((): JSX.Element => {
                      const { tone, verdict, rest } = splitReviewVerdict(reviewResult)
                      return (
                        <section
                          key={reviewKey}
                          className="animate-[wizard-panel-in_0.25s_ease-out] overflow-hidden rounded-md border border-default-border bg-obsidian-panel shadow-[var(--shadow-raised)]"
                        >
                          <button
                            type="button"
                            onClick={() => setReviewExpanded((v) => !v)}
                            aria-expanded={reviewExpanded}
                            className="flex w-full items-center gap-3 px-4 pb-3 pt-4 text-left"
                          >
                            <span
                              className={`flex size-8 shrink-0 items-center justify-center rounded-md border shadow-[var(--shadow-raised)] ${REVIEW_TONE[tone].medallion}`}
                            >
                              {tone === 'success' ? <Check size={15} aria-hidden /> : tone === 'attention' ? <AlertTriangle size={15} aria-hidden /> : <Bot size={15} aria-hidden />}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="text-body font-semibold text-primary-text">Parecer da IA</span>
                              {verdict && <span className={`text-caption font-medium ${REVIEW_TONE[tone].verdict}`}>{verdict}</span>}
                            </span>
                            <ChevronDown
                              size={16}
                              className={`shrink-0 text-tertiary-text transition-transform duration-200 ${reviewExpanded ? '' : '-rotate-90'}`}
                              aria-hidden
                            />
                          </button>
                          {reviewExpanded && rest && (
                            <div className="animate-[wizard-panel-in_0.2s_ease-out] px-4 pb-4 pl-[60px] text-body leading-relaxed text-secondary-text">
                              <Markdown text={rest} />
                            </div>
                          )}
                        </section>
                      )
                    })()}
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-default-border px-5 py-3">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => (step === 1 ? onClose() : goToStep((step - 1) as 1 | 2 | 3))}
            disabled={stepBusy}
            className="btn-ghost"
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          <div className="flex items-center gap-2">
            {step === 4 && (
              <button type="button" onClick={onClose} disabled={stepBusy} className="btn-ghost">
                Cancelar
              </button>
            )}
            {step === 1 && (
              <button
                type="button"
                onClick={() => void handleOriginAdvance()}
                disabled={!canGoNext || preparingBranch}
                className="btn-primary"
              >
                {preparingBranch ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden /> Criando branch…
                  </>
                ) : (
                  <>
                    Próximo <ArrowRight size={14} aria-hidden />
                  </>
                )}
              </button>
            )}
            {step === 2 && (
              <button type="button" onClick={() => goToStep(3)} disabled={!canGoNext} className="btn-primary">
                Próximo <ArrowRight size={14} aria-hidden />
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={() => void handleDestinationAdvance()}
                disabled={!canGoNext || preparing}
                className="btn-primary"
              >
                {preparing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden /> Preparando…
                  </>
                ) : (
                  <>
                    Próximo <ArrowRight size={14} aria-hidden />
                  </>
                )}
              </button>
            )}
            {step === 4 && (
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={isBusy || !title.trim() || !head || !base}
                className="btn-primary"
              >
                {isBusy ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden /> Criando…
                  </>
                ) : (
                  <>
                    <GitPullRequest size={14} aria-hidden /> Criar Pull Request
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

function PullRequestDetail(): JSX.Element | null {
  const detail = usePullRequestStore((s) => s.detail)
  const isBusy = usePullRequestStore((s) => s.isBusy)
  const isMerging = usePullRequestStore((s) => s.isMerging)
  const selectPullRequestFile = usePullRequestStore((s) => s.selectPullRequestFile)
  const addComment = usePullRequestStore((s) => s.addComment)
  const merge = usePullRequestStore((s) => s.merge)
  const setState = usePullRequestStore((s) => s.setState)
  const submitReview = usePullRequestStore((s) => s.submitReview)
  const addLineComment = usePullRequestStore((s) => s.addLineComment)
  const user = usePullRequestStore((s) => s.user)
  const integrateBaseIntoBranch = useRepoStore((s) => s.integrateBaseIntoBranch)
  const repoBusy = useRepoStore((s) => s.isBusy)
  const [comment, setComment] = useState('')
  const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('merge')
  const [confirmAction, setConfirmAction] = useState<null | 'merge' | 'close' | 'approve' | 'changes'>(null)
  const [lineComment, setLineComment] = useState<{ line: number; path: string } | null>(null)
  const narrow = useMediaQuery(NARROW_LAYOUT_QUERY)

  const [headerHeight, setHeaderHeight] = useState<number | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const headerDraggingRef = useRef(false)
  const handleHeaderResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      headerDraggingRef.current = true
      const startY = e.clientY
      const startHeight = headerHeight ?? headerRef.current?.getBoundingClientRect().height ?? MIN_HEADER_HEIGHT
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(moveEvent: MouseEvent): void {
        if (!headerDraggingRef.current) return
        // Dragging the bottom edge: moving down grows the header.
        const next = startHeight + (moveEvent.clientY - startY)
        setHeaderHeight(Math.min(MAX_HEADER_HEIGHT, Math.max(MIN_HEADER_HEIGHT, next)))
      }
      function onMouseUp(): void {
        headerDraggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [headerHeight]
  )

  const [filesWidth, setFilesWidth] = useState(DEFAULT_FILES_WIDTH)
  const filesDraggingRef = useRef(false)
  const handleFilesResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      filesDraggingRef.current = true
      const startX = e.clientX
      const startWidth = filesWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(moveEvent: MouseEvent): void {
        if (!filesDraggingRef.current) return
        const next = startWidth + (moveEvent.clientX - startX)
        setFilesWidth(Math.min(MAX_FILES_WIDTH, Math.max(MIN_FILES_WIDTH, next)))
      }
      function onMouseUp(): void {
        filesDraggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [filesWidth]
  )

  const [commentsHeight, setCommentsHeight] = useState(DEFAULT_COMMENTS_HEIGHT)
  const commentsDraggingRef = useRef(false)
  const handleCommentsResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      commentsDraggingRef.current = true
      const startY = e.clientY
      const startHeight = commentsHeight
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(moveEvent: MouseEvent): void {
        if (!commentsDraggingRef.current) return
        // Dragging the top edge: moving up grows the panel.
        const next = startHeight - (moveEvent.clientY - startY)
        setCommentsHeight(Math.min(MAX_COMMENTS_HEIGHT, Math.max(MIN_COMMENTS_HEIGHT, next)))
      }
      function onMouseUp(): void {
        commentsDraggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [commentsHeight]
  )

  if (!detail) return null
  const selectedFile = detail.files.find((f) => f.filename === detail.selectedFile)
  const isOwnPr = !!user && user.login.toLowerCase() === detail.pr.authorLogin.toLowerCase()
  const isOpen = detail.pr.state === 'open' && !detail.pr.merged
  // Why GitHub would refuse the merge, said before the click instead of as an
  // English API error after it. mergeable/mergeableState arrive a moment after
  // the detail (see selectPullRequest); until then nothing is claimed.
  const mergeBlocker = !isOpen
    ? null
    : detail.pr.draft
      ? 'Esta PR é um rascunho: marque-a como pronta para revisão no GitHub antes de mesclar.'
      : detail.pr.mergeable === false && detail.pr.mergeableState === 'dirty'
        ? `Há conflitos entre "${detail.pr.headRef}" e "${detail.pr.baseRef}". Traga "${detail.pr.baseRef}" para a branch, resolva os conflitos em Alterações e faça commit e push.`
        : null
  const mergeWarning =
    !isOpen || mergeBlocker
      ? null
      : detail.pr.mergeableState === 'blocked'
        ? 'Bloqueada pelas regras de proteção da branch (revisões ou checks obrigatórios).'
        : detail.pr.mergeableState === 'unstable'
          ? 'Alguns checks desta PR falharam.'
          : detail.pr.mergeableState === 'behind'
            ? `"${detail.pr.headRef}" está atrás de "${detail.pr.baseRef}".`
            : null

  async function handleComment(): Promise<void> {
    if (!comment.trim()) return
    await addComment(comment.trim())
    setComment('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header
        ref={headerRef}
        className={`shrink-0 px-5 py-4 ${narrow ? 'border-b border-default-border' : ''} ${headerHeight !== null ? 'overflow-y-auto' : ''}`}
        style={headerHeight !== null ? { maxHeight: headerHeight } : undefined}
      >
        <h2 className="text-title font-semibold text-primary-text">
          {detail.pr.title} <span className="font-normal text-tertiary-text">#{detail.pr.number}</span>
        </h2>
        <p className="mt-1 text-body text-secondary-text">
          {detail.pr.merged
            ? `${detail.pr.authorLogin} mesclou ${detail.pr.headRef} em ${detail.pr.baseRef}`
            : `${detail.pr.authorLogin} quer mesclar ${detail.pr.headRef} → ${detail.pr.baseRef}`}
        </p>
        {detail.pr.body && (
          <div className="mt-3 max-h-36 overflow-y-auto text-body text-secondary-text">
            <Markdown text={detail.pr.body} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MergeMethodHint method={mergeMethod} />
          <Combobox
            value={mergeMethod}
            onChange={(v) => setMergeMethod(v as typeof mergeMethod)}
            options={MERGE_METHOD_OPTIONS}
            ariaLabel="Método de merge"
            className="w-48"
          />
          <button
            type="button"
            onClick={() => setConfirmAction('merge')}
            disabled={isBusy || !isOpen || Boolean(mergeBlocker)}
            title={mergeBlocker ?? undefined}
            className="btn-primary flex items-center gap-1.5"
          >
            {isMerging && <Loader2 size={13} className="animate-spin" aria-hidden />}
            {isMerging ? 'Mesclando…' : 'Mesclar Pull Request'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('approve')}
            disabled={isBusy || detail.pr.state !== 'open' || detail.pr.merged || isOwnPr}
            title={isOwnPr ? 'Você não pode aprovar sua própria pull request' : undefined}
            className="btn-secondary"
          >
            Aprovar
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('changes')}
            disabled={isBusy || detail.pr.state !== 'open' || detail.pr.merged || isOwnPr}
            title={isOwnPr ? 'O GitHub não permite pedir mudanças na sua própria pull request' : undefined}
            className="btn-ghost"
          >
            Pedir mudanças
          </button>
          <button
            type="button"
            onClick={() => (detail.pr.state === 'open' ? setConfirmAction('close') : void setState('open'))}
            disabled={isBusy || detail.pr.merged}
            title={detail.pr.merged ? 'Pull requests mescladas não podem ser reabertas' : undefined}
            className="btn-ghost"
          >
            {detail.pr.merged ? 'Mesclada' : detail.pr.state === 'open' ? 'Fechar PR' : 'Reabrir PR'}
          </button>
          <a
            href={detail.pr.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost inline-flex items-center gap-1.5"
            title="Abrir esta pull request no navegador"
          >
            <ExternalLink size={13} aria-hidden /> Abrir no GitHub
          </a>
        </div>
        {(mergeBlocker || mergeWarning) && (
          <p
            role="status"
            className={`mt-2 flex items-start gap-1.5 text-caption ${mergeBlocker ? 'text-danger-red' : 'text-warning-amber'}`}
          >
            <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden />
            <span>{mergeBlocker ?? mergeWarning}</span>
          </p>
        )}
        {isOpen && detail.pr.mergeable === false && detail.pr.mergeableState === 'dirty' && (
          <button
            type="button"
            className="btn-secondary mt-2"
            disabled={repoBusy}
            onClick={() => void integrateBaseIntoBranch(detail.pr.headRef, detail.pr.baseRef)}
            title={`Busca o remoto, troca para "${detail.pr.headRef}" e mescla "origin/${detail.pr.baseRef}" nela`}
          >
            <GitMerge size={13} aria-hidden /> Trazer "{detail.pr.baseRef}" para esta branch
          </button>
        )}
      </header>

      {!narrow && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Redimensionar detalhes da pull request"
          aria-valuemin={MIN_HEADER_HEIGHT}
          aria-valuemax={MAX_HEADER_HEIGHT}
          aria-valuenow={headerHeight ?? MIN_HEADER_HEIGHT}
          tabIndex={0}
          onMouseDown={handleHeaderResizeStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHeaderHeight((h) => Math.max(MIN_HEADER_HEIGHT, (h ?? headerRef.current?.getBoundingClientRect().height ?? MIN_HEADER_HEIGHT) - 16))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHeaderHeight((h) => Math.min(MAX_HEADER_HEIGHT, (h ?? headerRef.current?.getBoundingClientRect().height ?? MIN_HEADER_HEIGHT) + 16))
            }
          }}
          className="h-1.5 shrink-0 cursor-row-resize border-t border-default-border bg-transparent transition-colors hover:bg-command-blue/40 active:bg-command-blue/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
        />
      )}

      <div className={`flex min-h-0 flex-1 overflow-hidden ${narrow ? 'flex-col' : ''}`}>
        <aside
          className={`min-h-0 overflow-y-auto ${narrow ? 'w-full' : 'shrink-0'} ${narrow && detail.selectedFile ? 'hidden' : ''}`}
          style={narrow ? undefined : { width: filesWidth }}
        >
          <h3 className="sticky top-0 z-10 border-b border-default-border bg-obsidian-panel px-3 py-2 text-label uppercase tracking-wide text-tertiary-text">
            Arquivos ({detail.files.length})
          </h3>
          <ul>
            {detail.files.map((file) => (
              <li key={file.filename}>
                <button
                  type="button"
                  onClick={() => selectPullRequestFile(file.filename)}
                  className={`list-row w-full justify-between text-left ${file.filename === detail.selectedFile ? 'is-selected' : ''}`}
                >
                  <span className="truncate text-body text-primary-text" title={file.filename}>
                    {file.filename}
                  </span>
                  <span className="shrink-0 text-caption tabular-nums">
                    <span className="text-success-green">+{file.additions}</span>{' '}
                    <span className="text-danger-red">-{file.deletions}</span>
                  </span>
                </button>
              </li>
            ))}
            {detail.files.length === 0 && (
              <li className="px-3 py-4 text-center text-caption text-tertiary-text">Nenhum arquivo neste PR.</li>
            )}
          </ul>
        </aside>

        {!narrow && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar lista de arquivos"
            aria-valuemin={MIN_FILES_WIDTH}
            aria-valuemax={MAX_FILES_WIDTH}
            aria-valuenow={filesWidth}
            tabIndex={0}
            onMouseDown={handleFilesResizeStart}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setFilesWidth((w) => Math.max(MIN_FILES_WIDTH, w - 16))
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                setFilesWidth((w) => Math.min(MAX_FILES_WIDTH, w + 16))
              }
            }}
            className="w-1 shrink-0 cursor-col-resize border-r border-default-border bg-transparent transition-colors hover:bg-command-blue/40 active:bg-command-blue/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
          />
        )}

        <section
          className={`h-full min-h-0 min-w-0 flex-1 overflow-hidden ${narrow && !detail.selectedFile ? 'hidden' : ''}`}
          aria-label="Diff do arquivo"
        >
          {narrow && detail.selectedFile && (
            <button
              type="button"
              onClick={() => selectPullRequestFile('')}
              className="flex h-10 w-full items-center gap-2 border-b border-default-border px-3 text-body text-secondary-text hover:bg-hover-overlay hover:text-primary-text"
              aria-label="Voltar para a lista de arquivos"
            >
              <ArrowLeft size={16} aria-hidden /> Arquivos
            </button>
          )}
          {selectedFile?.patch ? (
            <DiffViewer
              diffText={selectedFile.patch}
              onCommentLine={(line) => setLineComment({ line, path: selectedFile.filename })}
            />
          ) : selectedFile ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-body text-secondary-text">
              Sem patch disponível para este arquivo (binário ou muito grande).
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-body text-tertiary-text">
              Selecione um arquivo à esquerda para ver o diff.
            </div>
          )}
        </section>
      </div>

      {!narrow && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Redimensionar painel de comentários"
          aria-valuemin={MIN_COMMENTS_HEIGHT}
          aria-valuemax={MAX_COMMENTS_HEIGHT}
          aria-valuenow={commentsHeight}
          tabIndex={0}
          onMouseDown={handleCommentsResizeStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCommentsHeight((h) => Math.min(MAX_COMMENTS_HEIGHT, h + 16))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCommentsHeight((h) => Math.max(MIN_COMMENTS_HEIGHT, h - 16))
            }
          }}
          className="h-1.5 shrink-0 cursor-row-resize border-t border-default-border bg-transparent transition-colors hover:bg-command-blue/40 active:bg-command-blue/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
        />
      )}

      <footer
        className="flex shrink-0 flex-col gap-2 border-t border-default-border px-5 py-3"
        style={{ maxHeight: commentsHeight }}
      >
        <h3 className="shrink-0 text-label uppercase tracking-wide text-tertiary-text">Comentários</h3>
        {/* Only the thread scrolls: the composer stays in view however long it gets. */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {detail.comments.map((c) => (
            <div key={c.id} className="rounded-md border border-default-border bg-obsidian-panel p-2.5">
              <div className="flex items-baseline gap-2">
                <strong className="text-body text-primary-text">{c.authorLogin}</strong>
                <time dateTime={c.createdAt} className="text-caption text-tertiary-text">
                  {new Date(c.createdAt).toLocaleString('pt-BR')}
                </time>
              </div>
              <div className="mt-1 text-body text-secondary-text">
                <Markdown text={c.body} />
              </div>
            </div>
          ))}
          {detail.comments.length === 0 && (
            <p className="text-caption text-tertiary-text">Nenhum comentário ainda.</p>
          )}
        </div>
        <textarea
          placeholder="Escreva um comentário…"
          aria-label="Escreva um comentário"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="field shrink-0 resize-y"
        />
        <button onClick={handleComment} disabled={!comment.trim() || isBusy} className="btn-secondary shrink-0 self-end">
          Comentar
        </button>
      </footer>

      <ConfirmDialog
        open={confirmAction === 'merge'}
        title="Mesclar pull request?"
        message={`Mesclar #${detail.pr.number} “${detail.pr.title}” em ${detail.pr.baseRef} com ${MERGE_METHOD_OPTIONS.find((o) => o.value === mergeMethod)?.label ?? mergeMethod}? Isso não pode ser desfeito pelo GitWeb.`}
        confirmLabel="Mesclar Pull Request"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null)
          void merge(mergeMethod)
        }}
      />
      <ConfirmDialog
        open={confirmAction === 'close'}
        title="Fechar pull request?"
        message={`Fechar #${detail.pr.number} “${detail.pr.title}” sem mesclar? Você poderá reabrir depois.`}
        confirmLabel="Fechar Pull Request"
        danger
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null)
          void setState('closed')
        }}
      />
      <ConfirmDialog
        open={confirmAction === 'approve'}
        title="Aprovar esta pull request?"
        message={`Publicar um review de aprovação em #${detail.pr.number}. Isso aparece no GitHub.`}
        confirmLabel="Aprovar"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null)
          void submitReview('APPROVE', 'Aprovado pelo GitWeb.')
        }}
      />
      <PromptDialog
        open={confirmAction === 'changes'}
        title="Pedir mudanças?"
        message={`Publicar um review pedindo mudanças em #${detail.pr.number}. Isso aparece no GitHub.`}
        label="O que precisa mudar"
        placeholder="Descreva o que falta nesta PR"
        confirmLabel="Pedir mudanças"
        onCancel={() => setConfirmAction(null)}
        onConfirm={(body) => {
          setConfirmAction(null)
          void submitReview('REQUEST_CHANGES', body)
        }}
      />
      <PromptDialog
        open={lineComment !== null}
        title={`Comentar na linha ${lineComment?.line ?? ''}`}
        message={lineComment ? `${lineComment.path}:${lineComment.line}` : undefined}
        label="Comentário"
        placeholder="O que precisa mudar nesta linha?"
        confirmLabel="Publicar no GitHub"
        onCancel={() => setLineComment(null)}
        onConfirm={(body) => {
          const target = lineComment
          setLineComment(null)
          // A standalone review comment, not a review: a COMMENT review requires a
          // top-level body, so the same text would be published twice on the PR.
          if (target) void addLineComment(target.path, target.line, body)
        }}
      />
    </div>
  )
}

function PullRequestsView(): JSX.Element {
  const remote = usePullRequestStore((s) => s.remote)
  const user = usePullRequestStore((s) => s.user)
  const pullRequests = usePullRequestStore((s) => s.pullRequests)
  const stateFilter = usePullRequestStore((s) => s.stateFilter)
  const setStateFilter = usePullRequestStore((s) => s.setStateFilter)
  const selectPullRequest = usePullRequestStore((s) => s.selectPullRequest)
  const clearPullRequestDetail = usePullRequestStore((s) => s.clearPullRequestDetail)
  const detail = usePullRequestStore((s) => s.detail)
  const logout = usePullRequestStore((s) => s.logout)
  const isBusy = usePullRequestStore((s) => s.isBusy)
  const refreshPullRequests = usePullRequestStore((s) => s.refreshPullRequests)
  const [showNewForm, setShowNewForm] = useState(false)
  const [wizardBusy, setWizardBusy] = useState(false)
  const narrow = useMediaQuery(NARROW_LAYOUT_QUERY)

  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(pullRequests.length / PR_PAGE_SIZE))
  useEffect(() => {
    setPage(1)
  }, [stateFilter])
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount))
  }, [pageCount])
  const pagedPullRequests = pullRequests.slice((page - 1) * PR_PAGE_SIZE, page * PR_PAGE_SIZE)

  const [listWidth, setListWidth] = useState(DEFAULT_LIST_WIDTH)
  const listDraggingRef = useRef(false)
  const handleListResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      listDraggingRef.current = true
      const startX = e.clientX
      const startWidth = listWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(moveEvent: MouseEvent): void {
        if (!listDraggingRef.current) return
        const next = startWidth + (moveEvent.clientX - startX)
        setListWidth(Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, next)))
      }
      function onMouseUp(): void {
        listDraggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [listWidth]
  )

  if (!remote) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-secondary-text">
        <h1 className="sr-only">Pull Requests</h1>
        <GitPullRequest size={32} />
        <p>Este repositório não tem um remote do GitHub configurado (origin).</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <h1 className="sr-only">Pull Requests</h1>
        <LoginForm />
      </div>
    )
  }

  const listPane = (
    <div
      className={`flex h-full ${narrow ? 'w-full' : 'shrink-0'} flex-col overflow-hidden`}
      style={narrow ? undefined : { width: listWidth }}
    >
      <div className="shrink-0 p-3 pb-0">
        <div className="mb-3 flex gap-2">
          <Combobox
            value={stateFilter}
            onChange={(v) => setStateFilter(v as PullRequestState)}
            options={STATE_FILTER_OPTIONS}
            ariaLabel="Filtrar pull requests por estado"
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => void refreshPullRequests()}
            disabled={isBusy}
            className="btn-secondary shrink-0"
            aria-label="Atualizar pull requests"
            title="Atualizar"
          >
            <RefreshCw size={14} className={isBusy ? 'animate-spin' : undefined} aria-hidden />
          </button>
          {/* Opens only — closing goes through the wizard's own Cancelar/X, so a
              second click can't silently throw away a half-filled draft. */}
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            aria-pressed={showNewForm}
            className={`btn-secondary shrink-0 ${showNewForm ? 'border-command-blue/50! bg-command-blue-soft! text-command-blue!' : ''}`}
          >
            <Plus size={14} aria-hidden /> Nova
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <ul className="flex flex-col">
          {pagedPullRequests.map((pr) => (
            <li key={pr.number} className="border-b border-default-border">
              <button
                type="button"
                onClick={() => {
                  // A wizard mid commit/push/branch creation can't be walked away from.
                  if (showNewForm && wizardBusy) return
                  setShowNewForm(false)
                  void selectPullRequest(pr.number)
                }}
                aria-disabled={showNewForm && wizardBusy ? true : undefined}
                className={`list-row w-full flex-col items-stretch gap-0.5 py-2.5 text-left ${detail?.pr.number === pr.number ? 'is-selected' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  {pr.merged ? (
                    <GitMerge size={14} className="shrink-0 text-command-blue" aria-label="Mesclada" />
                  ) : pr.state === 'closed' ? (
                    <GitPullRequestClosed size={14} className="shrink-0 text-danger-red" aria-label="Fechada" />
                  ) : pr.draft ? (
                    <GitPullRequestDraft size={14} className="shrink-0 text-tertiary-text" aria-label="Rascunho" />
                  ) : (
                    <GitPullRequest size={14} className="shrink-0 text-success-green" aria-label="Aberta" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-body font-medium text-primary-text">{pr.title}</span>
                  <span className="shrink-0 text-caption tabular-nums text-tertiary-text">#{pr.number}</span>
                </div>
                <div className="whitespace-normal text-caption text-tertiary-text [overflow-wrap:anywhere]">
                  {pr.authorLogin} · {formatDate(pr.createdAt)} · {pr.headRef} → {pr.baseRef}
                </div>
              </button>
            </li>
          ))}
          {pullRequests.length === 0 && <li className="px-2 py-4 text-center text-caption text-tertiary-text">Nenhuma pull request.</li>}
        </ul>
      </div>
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
    </div>
  )

  const detailPane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {narrow && (detail || showNewForm) && (
        <button
          type="button"
          onClick={() => (showNewForm ? setShowNewForm(false) : clearPullRequestDetail())}
          disabled={showNewForm && wizardBusy}
          className="flex h-10 shrink-0 items-center gap-2 border-b border-default-border px-3 text-body text-secondary-text hover:bg-hover-overlay hover:text-primary-text"
          aria-label="Voltar para a lista de pull requests"
        >
          <ArrowLeft size={16} aria-hidden /> Pull Requests
        </button>
      )}
      {showNewForm ? (
        <NewPullRequestWizard onClose={() => setShowNewForm(false)} onBusyChange={setWizardBusy} />
      ) : detail ? (
        <PullRequestDetail />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-body text-tertiary-text">
          <PostMergeActions />
          Selecione uma pull request.
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <h1 className="sr-only">Pull Requests</h1>
      <div className="flex shrink-0 items-center gap-2 border-b border-default-border px-3 py-2">
        <img src={user.avatarUrl} alt={user.login} className="h-6 w-6 rounded-full" />
        <span className="truncate text-body text-primary-text">{user.name ?? user.login}</span>
        <span className="truncate text-caption text-tertiary-text">@{user.login}</span>
        <button type="button" onClick={() => logout()} className="ml-auto shrink-0 text-caption text-command-blue hover:underline">
          Sair
        </button>
      </div>

      {narrow ? (
        <div className="min-h-0 flex-1 overflow-hidden">{detail || showNewForm ? detailPane : listPane}</div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {listPane}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar lista de pull requests"
            aria-valuemin={MIN_LIST_WIDTH}
            aria-valuemax={MAX_LIST_WIDTH}
            aria-valuenow={listWidth}
            tabIndex={0}
            onMouseDown={handleListResizeStart}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setListWidth((w) => Math.max(MIN_LIST_WIDTH, w - 16))
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                setListWidth((w) => Math.min(MAX_LIST_WIDTH, w + 16))
              }
            }}
            className="w-1 shrink-0 cursor-col-resize border-r border-default-border bg-transparent transition-colors hover:bg-command-blue/40 active:bg-command-blue/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
          />
          {detailPane}
        </div>
      )}
    </div>
  )
}

export default PullRequestsView
