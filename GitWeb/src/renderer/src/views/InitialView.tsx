import { useEffect, useRef, useState, type ComponentType } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  Check,
  CloudDownload,
  Folder,
  FolderInput,
  GitBranch,
  Pencil,
  CloudOff,
  DownloadCloud,
  FolderOpen,
  FolderPlus,
  Info,
  Loader2,
  Search,
  Settings2,
  Trash2,
  X,
  type LucideIcon
} from 'lucide-react'
import Github from '../components/icons/Github'
import { useRepoStore } from '../store/repoStore'
import { useGithubAuthStore } from '../store/githubAuthStore'
import GithubLoginModal from '../components/GithubLoginModal'
import RepoPickerModal from '../components/RepoPickerModal'
import CloneModal from '../components/CloneModal'
import ConfirmDialog from '../components/ConfirmDialog'
import RepoGroupSection, { REPO_DRAG_TYPE } from '../components/RepoGroupSection'
import { useClickOutside } from '../lib/useClickOutside'
import { useDragAutoScroll } from '../lib/useDragAutoScroll'
import type {
  RecentRepository,
  RepoGroup,
  RepoUpdateResult,
  RepoUpdateStatus
} from '../../../shared/git'
import type { Messages } from '../../../shared/i18n'
import { useT } from '../lib/i18n'
import ThemeToggle from '../components/ThemeToggle'
import RepoLane, { LaneMark } from '../components/RepoLane'

type InitialMessages = Messages['initial']

/** Local re-check of the recent repos (no network) while the start screen is visible. */
const RECENT_LOCAL_INTERVAL_MS = 4000
/** How often that re-check also fetches, so "behind" counts follow the remote. */
const RECENT_FETCH_INTERVAL_MS = 5 * 60 * 1000

function FetchCheckBadge({ check }: { check?: RepoUpdateStatus }): JSX.Element | null {
  if (!check) return null
  if (check.refreshing) return <Loader2 size={14} className="shrink-0 animate-spin text-tertiary-text" />
  switch (check.state) {
    case 'checking':
      return <Loader2 size={14} className="shrink-0 animate-spin text-tertiary-text" />
    case 'upToDate':
      return <Check size={14} className="shrink-0 text-success-green" />
    case 'behind':
      return <CloudDownload size={14} className="shrink-0 text-attention-orange" />
    case 'diverged':
      return <AlertTriangle size={14} className="shrink-0 text-attention-orange" />
    case 'noRemote':
    case 'noDefaultBranch':
      return <CloudOff size={14} className="shrink-0 text-tertiary-text" />
    case 'failed':
      return <AlertTriangle size={14} className="shrink-0 text-danger-red" />
    default:
      return null
  }
}

interface StatusChip {
  icon: LucideIcon
  value: string
  /** Full sentence, shown on hover and to screen readers. */
  title: string
}


/**
 * Per-repo status as icon + number only. Words here repeat on every card and
 * are what made the list bulky; the meaning lives in the tooltip, and the
 * badge at the end of the row already carries the overall state.
 */
function repoStatusChips(t: InitialMessages, check: RepoUpdateStatus): StatusChip[] {
  const chips: StatusChip[] = []
  const def = check.defaultBranch ?? ''
  // Plural forms are whole words — suffix concatenation produced "alteraçãoões".
  const commits = t.commits

  if (check.state === 'diverged') {
    chips.push({
      icon: GitBranch,
      value: `↑${check.localDefaultAhead} ↓${check.localDefaultBehind}`,
      title: t.chipDiverged(def, commits(check.localDefaultAhead), commits(check.localDefaultBehind))
    })
  } else if (check.state === 'behind') {
    chips.push({
      icon: ArrowDown,
      value: String(check.behindDefault),
      title: t.chipBehind(commits(check.behindDefault), def)
    })
    // On another branch the headline number is not what a pull would fix, so
    // the local default branch gets its own chip.
    if (check.branch !== def && check.hasLocalDefault && check.localDefaultBehind > 0) {
      chips.push({
        icon: GitBranch,
        value: String(check.localDefaultBehind),
        title: t.chipLocalDefaultBehind(def, commits(check.localDefaultBehind))
      })
    } else if (!check.hasLocalDefault) {
      // No local default branch means no checkbox and no batch update for this
      // card. Without this chip the row shows a warning it offers no way to act
      // on, and the reason is only visible by hovering the badge.
      chips.push({
        icon: GitBranch,
        value: t.chipNoLocalDefault(def),
        title: t.chipNoLocalDefaultTitle(def)
      })
    }
  }

  if (check.ahead > 0) {
    chips.push({
      icon: ArrowUp,
      value: String(check.ahead),
      title: t.chipAhead(commits(check.ahead))
    })
  }
  if (check.localChanges > 0) {
    chips.push({
      icon: Pencil,
      value: String(check.localChanges),
      title: t.chipLocalChanges(check.localChanges)
    })
  }

  return chips
}


function outcomeClass(outcome: RepoUpdateResult['outcome']): string {
  if (outcome === 'updated' || outcome === 'alreadyUpToDate') return 'text-success-green'
  if (outcome === 'failed') return 'text-danger-red'
  return 'text-attention-orange'
}

function summarizeBatch(t: InitialMessages, results: Record<string, RepoUpdateResult>): string | null {
  const all = Object.values(results)
  if (all.length === 0) return null

  const updated = all.filter((r) => r.outcome === 'updated').length
  const commits = all.reduce((sum, r) => sum + r.commitsPulled, 0)
  const skipped = all.filter((r) => r.outcome.startsWith('skipped')).length
  const failed = all.filter((r) => r.outcome === 'failed').length
  const alreadyOk = all.filter((r) => r.outcome === 'alreadyUpToDate').length

  const parts: string[] = []
  if (updated > 0) parts.push(t.batchUpdated(updated, commits))
  if (alreadyOk > 0) parts.push(t.batchAlreadyOk(alreadyOk))
  if (skipped > 0) parts.push(t.batchSkipped(skipped))
  if (failed > 0) parts.push(t.batchFailed(failed))
  return parts.join(' · ')
}

/** Keyboard/click path to the same thing dragging a card does. */
function MoveToGroupMenu({
  groups,
  currentGroupId,
  onSelect,
  onClose
}: {
  groups: RepoGroup[]
  currentGroupId: string | null
  onSelect: (groupId: string | null) => void
  onClose: () => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const t = useT().initial
  useClickOutside(ref, onClose)

  const options: { id: string | null; name: string }[] = [
    { id: null, name: t.noFolder },
    ...groups.map((g) => ({ id: g.id as string | null, name: g.name }))
  ]

  return (
    <div
      ref={ref}
      className="absolute right-2 top-10 z-20 min-w-44 rounded-md border border-default-border bg-obsidian-panel p-1 shadow-floating"
      role="menu"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {options.map((option) => (
        <button
          key={option.id ?? 'none'}
          type="button"
          role="menuitem"
          disabled={option.id === currentGroupId}
          onClick={() => onSelect(option.id)}
          className="flex w-full items-center gap-2 rounded-sm px-2.5 py-[7px] text-left text-body text-primary-text transition-colors duration-75 hover:bg-hover-overlay disabled:text-tertiary-text disabled:hover:bg-transparent"
        >
          <Folder size={13} className="shrink-0 text-tertiary-text" aria-hidden />
          <span className="truncate">{option.name}</span>
          {option.id === currentGroupId && <Check size={12} className="ml-auto shrink-0 text-tertiary-text" />}
        </button>
      ))}
      {groups.length === 0 && (
        <p className="px-2.5 py-1.5 text-caption text-tertiary-text">{t.createFolderFirst}</p>
      )}
    </div>
  )
}

function InitialView(): JSX.Element {
  const recentRepos = useRepoStore((s) => s.recentRepos)
  const recentRepoChecks = useRepoStore((s) => s.recentRepoChecks)
  const selectedRepoPaths = useRepoStore((s) => s.selectedRepoPaths)
  const batchUpdateResults = useRepoStore((s) => s.batchUpdateResults)
  const isBatchUpdating = useRepoStore((s) => s.isBatchUpdating)
  const toggleRepoSelection = useRepoStore((s) => s.toggleRepoSelection)
  const selectAllUpdatableRepos = useRepoStore((s) => s.selectAllUpdatableRepos)
  const clearRepoSelection = useRepoStore((s) => s.clearRepoSelection)
  const clearBatchResults = useRepoStore((s) => s.clearBatchResults)
  const repoGroups = useRepoStore((s) => s.repoGroups)
  const createRepoGroup = useRepoStore((s) => s.createRepoGroup)
  const renameRepoGroup = useRepoStore((s) => s.renameRepoGroup)
  const deleteRepoGroup = useRepoStore((s) => s.deleteRepoGroup)
  const moveRepoToGroup = useRepoStore((s) => s.moveRepoToGroup)
  const toggleRepoGroupCollapsed = useRepoStore((s) => s.toggleRepoGroupCollapsed)
  const updateSelectedRepos = useRepoStore((s) => s.updateSelectedRepos)
  const isBusy = useRepoStore((s) => s.isBusy)
  const error = useRepoStore((s) => s.error)
  const loadRecentRepos = useRepoStore((s) => s.loadRecentRepos)
  const openRepository = useRepoStore((s) => s.openRepository)
  const createRepository = useRepoStore((s) => s.createRepository)
  const addRecentRepositories = useRepoStore((s) => s.addRecentRepositories)
  const removeRecentRepo = useRepoStore((s) => s.removeRecentRepo)
  const fetchRecentRepo = useRepoStore((s) => s.fetchRecentRepo)
  const pullRecentRepo = useRepoStore((s) => s.pullRecentRepo)
  const clearError = useRepoStore((s) => s.clearError)
  const setError = useRepoStore((s) => s.setError)
  const setView = useRepoStore((s) => s.setView)
  const messages = useT()
  const t = messages.initial

  // Single source of truth for "is the user signed in to GitHub" — shared
  // with CloneModal's GitHub tab, so cloning reflects an existing login
  // instead of re-asking to "Continuar com GitHub".
  const user = useGithubAuthStore((s) => s.user)
  const loadCurrentUser = useGithubAuthStore((s) => s.loadCurrentUser)

  const [showClone, setShowClone] = useState(false)
  const [accountChecked, setAccountChecked] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [isScanningFolder, setIsScanningFolder] = useState(false)
  const [foundRepoPaths, setFoundRepoPaths] = useState<string[] | null>(null)
  const [pullTarget, setPullTarget] = useState<{ path: string; name: string } | null>(null)
  /** Group just created by "Nova pasta", so its header opens in edit mode. */
  const [newGroupId, setNewGroupId] = useState<string | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<RepoGroup | null>(null)
  const [moveTarget, setMoveTarget] = useState<string | null>(null)
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [ungroupedCollapsed, setUngroupedCollapsed] = useState(false)

  // The page itself is the scroll container; without this a card at the bottom
  // cannot be dragged to a folder scrolled off the top.
  const scrollRef = useRef<HTMLElement>(null)
  useDragAutoScroll(scrollRef, draggingPath !== null)

  useEffect(() => {
    loadRecentRepos()
  }, [loadRecentRepos])

  // Keep the bench honest while it sits open: files edited in another program,
  // a commit from the terminal, a pull in another tool. Local state (git status
  // and the counts against the remote refs already on disk) is re-read the
  // moment the window comes back and every few seconds while it is visible;
  // the network is touched only every few minutes.
  const refreshRecentRepoChecks = useRepoStore((s) => s.refreshRecentRepoChecks)
  useEffect(() => {
    let lastFetch = Date.now()
    function tick(): void {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      const fetch = now - lastFetch >= RECENT_FETCH_INTERVAL_MS
      if (fetch) lastFetch = now
      void refreshRecentRepoChecks({ fetch })
    }
    const interval = window.setInterval(tick, RECENT_LOCAL_INTERVAL_MS)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refreshRecentRepoChecks])

  useEffect(() => {
    void loadCurrentUser('github.com').finally(() => setAccountChecked(true))
  }, [loadCurrentUser])

  // Tri-state (null while the initial check is in flight) avoids a flash of
  // the "Entrar com GitHub" tile for the common case where the user is
  // already signed in.
  const hasGithubAccount = accountChecked ? Boolean(user) : null

  // A check still waiting on its fetch may be stale — only offer what was just measured.
  const canUpdate = (path: string): boolean =>
    Boolean(recentRepoChecks[path]?.canFastForward && !recentRepoChecks[path]?.refreshing)
  const updatablePaths = recentRepos.map((r) => r.path).filter(canUpdate)
  const selectedCount = selectedRepoPaths.filter(canUpdate).length
  const allUpdatableSelected = updatablePaths.length > 0 && selectedCount === updatablePaths.length
  const batchSummary = summarizeBatch(t, batchUpdateResults)
  // Kept visible during and after a run: `canFastForward` flips to false as
  // repos get updated, and the column vanishing mid-run would shift the layout.
  const showSelection = updatablePaths.length > 0 || isBatchUpdating || batchSummary !== null

  const reposByGroup = new Map<string, RecentRepository[]>()
  const ungrouped: RecentRepository[] = []
  for (const repo of recentRepos) {
    if (repo.groupId === null) ungrouped.push(repo)
    else {
      const bucket = reposByGroup.get(repo.groupId)
      if (bucket) bucket.push(repo)
      else reposByGroup.set(repo.groupId, [repo])
    }
  }

  async function handleCreateGroup(): Promise<void> {
    const before = new Set(useRepoStore.getState().repoGroups.map((g) => g.id))
    await createRepoGroup(t.newFolder)
    // The id is minted in main, so the only way to know which one to focus is
    // to diff against the ids we had before the call.
    const created = useRepoStore.getState().repoGroups.find((g) => !before.has(g.id))
    setNewGroupId(created?.id ?? null)
  }

  async function handleOpen(): Promise<void> {
    const path = await window.api.dialogs.openDirectory()
    if (!path) return

    const isRepo = await window.api.git.isRepository(path)
    if (isRepo) {
      await openRepository(path)
      return
    }

    setIsScanningFolder(true)
    try {
      const found = await window.api.git.scanForRepositories(path)
      if (found.length === 0) {
        setError(t.noRepoFound(path))
      } else if (found.length === 1) {
        await openRepository(found[0])
      } else {
        setFoundRepoPaths(found)
      }
    } finally {
      setIsScanningFolder(false)
    }
  }

  async function handleConfirmRepoPicker(selectedPaths: string[]): Promise<void> {
    setFoundRepoPaths(null)
    await addRecentRepositories(selectedPaths)
  }

  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const matches = (repo: RecentRepository): boolean =>
    !needle ||
    repo.name.toLowerCase().includes(needle) ||
    repo.path.toLowerCase().includes(needle) ||
    (recentRepoChecks[repo.path]?.branch ?? '').toLowerCase().includes(needle)
  const filtered = needle ? recentRepos.filter(matches) : []

  // One line that says how the whole bench is doing, before any row is read.
  const summary = (() => {
    let behind = 0
    let diverged = 0
    let changes = 0
    let ok = 0
    let failed = 0
    let checking = false
    for (const repo of recentRepos) {
      if (repo.missing) continue
      const check = recentRepoChecks[repo.path]
      if (!check || check.state === 'checking' || check.refreshing) checking = true
      if (!check || check.state === 'checking') continue
      if (check.state === 'behind') behind++
      else if (check.state === 'diverged') diverged++
      else if (check.state === 'failed') failed++
      if (check.localChanges > 0) changes++
      else if (check.state === 'upToDate') ok++
    }
    return { behind, diverged, changes, ok, failed, checking }
  })()

  function renderRepoCard(repo: RecentRepository): JSX.Element {
    const check = repo.missing ? undefined : recentRepoChecks[repo.path]
    const result = batchUpdateResults[repo.path]
    const selectable = Boolean(check?.canFastForward && !check.refreshing)
    const chips = check && check.state !== 'checking' ? repoStatusChips(t, check) : []
    const laneTitle = chips.length > 0 ? chips.map((c) => c.title).join('\n') : check?.message

    return (
      <li
        key={repo.path}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(REPO_DRAG_TYPE, repo.path)
          e.dataTransfer.effectAllowed = 'move'
          setDraggingPath(repo.path)
        }}
        onDragEnd={() => setDraggingPath(null)}
        className={`workbench-row group flex cursor-grab items-center gap-1 py-1.5 pl-2 pr-1.5 ${repo.missing ? 'opacity-60' : ''}`}
      >
        {showSelection && (
          <span className="flex w-6 shrink-0 items-center justify-start">
            {selectable && (
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-command-blue"
                checked={selectedRepoPaths.includes(repo.path)}
                onChange={() => toggleRepoSelection(repo.path)}
                disabled={isBusy}
                aria-label={t.selectToUpdate(repo.name)}
              />
            )}
          </span>
        )}
        <button
          onClick={() => openRepository(repo.path)}
          disabled={isBusy || repo.missing}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-sm py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-border active:scale-[0.995]"
        >
          <RepoLane check={check} missing={repo.missing} title={laneTitle} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-body font-semibold text-primary-text">{repo.name}</span>
              {check?.branch && (
                <span className="inline-flex min-w-0 shrink items-center gap-1 rounded-pill border border-default-border bg-coal-raised px-1.5 py-px font-mono text-[11px] leading-4 text-secondary-text">
                  <GitBranch size={10} className="shrink-0" aria-hidden />
                  <span className="truncate">{check.branch}</span>
                </span>
              )}
            </span>
            <span className="truncate text-caption text-tertiary-text" title={repo.path}>
              {repo.path}
            </span>
            {repo.missing && (
              <span className="flex items-center gap-1 text-caption text-attention-orange">
                <AlertTriangle size={12} aria-hidden />
                {t.folderNotFound}
              </span>
            )}
            {result && (
              <span className={`text-caption ${outcomeClass(result.outcome)}`}>
                {t.outcome[result.outcome]}: {result.message}
              </span>
            )}
          </span>
        </button>

        {/* State, said in numbers: the lane draws it, these count it. */}
        {!repo.missing && (
          <span className="hidden w-[232px] shrink-0 items-center gap-1 overflow-hidden md:flex">
            {chips.length > 0 ? (
              chips.map((chip) => (
                <span
                  key={chip.title}
                  className="inline-flex items-center gap-1 rounded-pill bg-attention-orange-soft px-1.5 py-px text-[11px] font-semibold leading-4 tabular-nums text-attention-orange"
                  title={chip.title}
                  aria-label={chip.title}
                >
                  <chip.icon size={11} aria-hidden />
                  {chip.value}
                </span>
              ))
            ) : (
              <span
                className={`truncate text-[11px] leading-4 ${check?.state === 'failed' ? 'text-danger-red' : 'text-tertiary-text'}`}
                title={check?.message}
              >
                {check?.message ?? ''}
              </span>
            )}
          </span>
        )}

        <span className="flex w-[116px] shrink-0 items-center justify-end opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover:opacity-100">
          {/* Keyboard-reachable equivalent of dragging the row. */}
          <button
            type="button"
            onClick={() => setMoveTarget(moveTarget === repo.path ? null : repo.path)}
            className="btn-ghost shrink-0 px-1.5 text-caption"
            title={t.moveToFolder}
            aria-label={t.moveToFolderAria(repo.name)}
            aria-expanded={moveTarget === repo.path}
          >
            <FolderInput size={14} />
          </button>
          {!repo.missing && check && check.state !== 'checking' && !check.refreshing && check.state !== 'noRemote' && (
            <button
              type="button"
              onClick={() => void fetchRecentRepo(repo.path)}
              disabled={isBusy}
              className="btn-ghost shrink-0 px-1.5 text-caption"
              title={t.fetchRecheck}
              aria-label={t.fetchAria(repo.name)}
            >
              <CloudDownload size={14} />
            </button>
          )}
          {(check?.behind ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setPullTarget({ path: repo.path, name: repo.name })}
              disabled={isBusy}
              className="btn-ghost shrink-0 px-1.5 text-caption"
              title={t.pull}
              aria-label={t.pullAria(repo.name)}
            >
              <ArrowDownToLine size={14} />
            </button>
          )}
          <button
            onClick={() => removeRecentRepo(repo.path)}
            disabled={isBusy}
            className="shrink-0 rounded-md p-1.5 text-tertiary-text hover:bg-danger-red-soft hover:text-danger-red"
            aria-label={t.removeAria(repo.name)}
            title={t.removeTitle}
          >
            <Trash2 size={15} />
          </button>
        </span>

        <span className="flex w-6 shrink-0 items-center justify-center" title={check?.message}>
          <FetchCheckBadge check={check} />
        </span>

        {moveTarget === repo.path && (
          <MoveToGroupMenu
            groups={repoGroups}
            currentGroupId={repo.groupId}
            onSelect={(groupId) => {
              setMoveTarget(null)
              void moveRepoToGroup(repo.path, groupId)
            }}
            onClose={() => setMoveTarget(null)}
          />
        )}
      </li>
    )
  }

  async function handleCreate(): Promise<void> {
    const path = await window.api.dialogs.openDirectory()
    if (path) await createRepository(path)
  }

  const summaryParts: { tone: string; text: string }[] = [
    summary.behind > 0 && { tone: 'bg-attention-orange', text: t.summaryBehind(summary.behind) },
    summary.diverged > 0 && { tone: 'bg-warning-amber', text: t.summaryDiverged(summary.diverged) },
    summary.changes > 0 && { tone: 'bg-command-blue', text: t.summaryChanges(summary.changes) },
    summary.failed > 0 && { tone: 'bg-danger-red', text: t.summaryFailed(summary.failed) },
    summary.ok > 0 && { tone: 'bg-success-green', text: t.summaryOk(summary.ok) }
  ].filter(Boolean) as { tone: string; text: string }[]

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-midnight-base lg:flex-row">
      {/* The bench: who you are, and the three ways in. Stays put while the
          repository list scrolls beside it. */}
      <aside className="flex shrink-0 flex-col border-b border-default-border bg-obsidian-panel lg:h-full lg:w-[340px] lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6 px-6 pb-5 pt-6 lg:flex-1 lg:gap-8 lg:overflow-y-auto lg:pt-10">
          <div className="rise-in flex items-center gap-3.5">
            <span className="flex size-[52px] shrink-0 items-center justify-center rounded-lg border border-default-border bg-midnight-base shadow-[var(--shadow-raised)]">
              <LaneMark size={34} />
            </span>
            <div className="min-w-0">
              <h1 className="text-headline font-semibold text-primary-text">OpenGitDesktop</h1>
              <p className="mt-0.5 text-caption text-pretty text-secondary-text">{t.tagline}</p>
            </div>
          </div>

          <nav aria-label={t.repositories} className="rise-in grid gap-2 [animation-delay:60ms] sm:grid-cols-3 lg:grid-cols-1">
            <button
              type="button"
              onClick={handleOpen}
              disabled={isBusy || isScanningFolder}
              className="group/open flex h-auto flex-col items-start gap-1 rounded-lg bg-action-surface px-4 py-3.5 text-left text-action-ink shadow-[var(--shadow-button)] transition-[filter,transform] duration-150 [transition-timing-function:var(--ease-out-expo)] hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:col-span-3 lg:col-span-1"
            >
              <span className="flex w-full items-center gap-2.5 text-title font-semibold">
                {isScanningFolder ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <FolderOpen size={18} aria-hidden />}
                {t.openRepository}
                <ArrowRight
                  size={16}
                  className="ml-auto transition-transform duration-200 [transition-timing-function:var(--ease-out-expo)] group-hover/open:translate-x-1"
                  aria-hidden
                />
              </span>
              <span className="text-caption opacity-70">{t.openHint}</span>
            </button>
            <RailAction icon={DownloadCloud} label={t.clone} description={t.cloneHint} onClick={() => setShowClone(true)} disabled={isBusy} active={showClone} />
            <RailAction icon={FolderPlus} label={t.create} description={t.createHint} onClick={handleCreate} disabled={isBusy} />
            {hasGithubAccount === false && (
              <RailAction icon={Github} label={t.signInGithub} description={t.signInGithubHint} onClick={() => setLoginModalOpen(true)} disabled={isBusy} />
            )}
          </nav>
        </div>

        <footer className="hidden flex-col gap-3 border-t border-default-border px-6 py-4 lg:flex">
          {user && (
            <div className="flex min-w-0 items-center gap-2.5" title={t.githubAccount(user.login)}>
              <span className="relative shrink-0">
                <img src={user.avatarUrl} alt="" className="size-8 rounded-full border border-default-border object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-obsidian-panel bg-success-green" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-caption font-semibold text-primary-text">{user.name || user.login}</span>
                <span className="truncate text-[11px] text-tertiary-text">
                  @{user.login} · {t.githubConnected}
                </span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setView('settings')}
              className="flex items-center gap-1.5 text-caption text-tertiary-text transition-colors duration-100 hover:text-primary-text"
            >
              <Settings2 size={13} aria-hidden />
              {t.settings}
            </button>
            <button
              type="button"
              onClick={() => setView('about')}
              className="flex items-center gap-1.5 text-caption text-tertiary-text transition-colors duration-100 hover:text-primary-text"
            >
              <Info size={13} aria-hidden />
              {t.about}
            </button>
          </div>
        </footer>
      </aside>

      {/* The full-width scroller, so its thumb rides the window's right edge. */}
      <section ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 px-5 pb-12 pt-6 sm:px-8 lg:px-10 lg:pt-10">
          <header className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="flex items-baseline gap-2.5 text-headline font-semibold text-primary-text">
                {t.repositories}
                {recentRepos.length > 0 && <span className="text-title font-medium tabular-nums text-tertiary-text">{recentRepos.length}</span>}
              </h2>
              {recentRepos.length > 0 && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-secondary-text" aria-live="polite">
                  {summaryParts.map((part) => (
                    <span key={part.text} className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${part.tone}`} aria-hidden />
                      {part.text}
                    </span>
                  ))}
                  {summary.checking && (
                    <span className="flex items-center gap-1.5 text-tertiary-text">
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                      {t.summaryChecking}
                    </span>
                  )}
                </p>
              )}
            </div>
            <ThemeToggle className="size-9 shrink-0" />
          </header>

          {/* While cloning, the modal shows this same error inside itself. */}
          {error && !showClone && (
            <div className="flex w-full items-center gap-2 rounded-md border border-danger-red/30 bg-danger-red-soft px-4 py-2.5 text-body text-danger-red" role="alert">
              <AlertCircle size={14} className="shrink-0" aria-hidden />
              <span className="flex-1">{error}</span>
              <button type="button" className="hit-area rounded-sm p-1 hover:bg-hover-overlay" onClick={clearError} aria-label={messages.common.dismissError}>
                <X size={14} />
              </button>
            </div>
          )}

          {recentRepos.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-default-border pb-4">
              <label className="relative flex w-full items-center sm:w-72">
                <Search size={14} className="pointer-events-none absolute left-3 text-tertiary-text" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.filterPlaceholder}
                  aria-label={t.filterAria}
                  className="field h-[34px] w-full py-0 pl-9"
                />
              </label>
              <button type="button" onClick={() => void handleCreateGroup()} disabled={isBusy} className="btn-ghost h-[34px] gap-1.5 px-2.5 text-caption">
                <FolderPlus size={14} aria-hidden />
                {t.newFolder}
              </button>
              {updatablePaths.length > 0 && (
                <button
                  type="button"
                  onClick={() => (allUpdatableSelected ? clearRepoSelection() : selectAllUpdatableRepos())}
                  disabled={isBusy}
                  className="btn-ghost h-[34px] px-2.5 text-caption text-command-blue"
                >
                  {allUpdatableSelected ? t.deselectAll : t.selectOutdated(updatablePaths.length)}
                </button>
              )}
              {showSelection && (
                <button
                  type="button"
                  onClick={() => void updateSelectedRepos()}
                  disabled={isBusy || selectedCount === 0}
                  className="btn-primary ml-auto gap-1.5 px-3 text-caption"
                >
                  {isBatchUpdating ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <ArrowDownToLine size={13} aria-hidden />}
                  {isBatchUpdating ? t.updating : t.updateSelected(selectedCount)}
                </button>
              )}
            </div>
          )}

          {batchSummary && (
            <div className="flex items-center gap-2 rounded-md border border-default-border bg-obsidian-panel px-3 py-2 text-caption text-secondary-text">
              <Check size={13} className="shrink-0 text-success-green" aria-hidden />
              <span className="flex-1">{batchSummary}</span>
              <button type="button" className="hit-area rounded-sm p-1 hover:bg-hover-overlay" onClick={clearBatchResults} aria-label={t.dismissBatchSummary}>
                <X size={13} />
              </button>
            </div>
          )}

          {recentRepos.length === 0 ? (
            <EmptyBench title={t.emptyTitle} body={t.emptyBody} />
          ) : needle ? (
            filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-body text-secondary-text">{t.noMatches(query.trim())}</p>
            ) : (
              <ul className="flex flex-col gap-0.5">{filtered.map(renderRepoCard)}</ul>
            )
          ) : (
            <div className="-mx-2 flex flex-col gap-1">
              {repoGroups.map((group) => (
                <RepoGroupSection
                  key={group.id}
                  id={group.id}
                  name={group.name}
                  count={reposByGroup.get(group.id)?.length ?? 0}
                  collapsed={group.collapsed}
                  startEditing={group.id === newGroupId}
                  onToggleCollapsed={() => void toggleRepoGroupCollapsed(group.id)}
                  onRename={(name) => {
                    setNewGroupId(null)
                    void renameRepoGroup(group.id, name)
                  }}
                  onDelete={() => setGroupToDelete(group)}
                  onDropRepo={(path) => void moveRepoToGroup(path, group.id)}
                >
                  <ul className="flex flex-col gap-0.5">{(reposByGroup.get(group.id) ?? []).map(renderRepoCard)}</ul>
                </RepoGroupSection>
              ))}

              {/* Stays mounted while dragging even when empty, so a row can be
                  pulled back out of a folder. */}
              {(ungrouped.length > 0 || repoGroups.length === 0 || draggingPath !== null) && (
                <RepoGroupSection
                  id={null}
                  name={t.noFolder}
                  count={ungrouped.length}
                  collapsed={ungroupedCollapsed}
                  onToggleCollapsed={() => setUngroupedCollapsed((v) => !v)}
                  onDropRepo={(path) => void moveRepoToGroup(path, null)}
                >
                  <ul className="flex flex-col gap-0.5">{ungrouped.map(renderRepoCard)}</ul>
                </RepoGroupSection>
              )}
            </div>
          )}

          {/* Narrow windows hide the rail's footer; its links live here instead. */}
          <footer className="flex justify-center gap-4 pt-2 lg:hidden">
            <button
              type="button"
              onClick={() => setView('settings')}
              className="flex items-center gap-1.5 text-caption text-tertiary-text transition-colors duration-100 hover:text-primary-text"
            >
              <Settings2 size={13} aria-hidden />
              {t.settings}
            </button>
            <button
              type="button"
              onClick={() => setView('about')}
              className="flex items-center gap-1.5 text-caption text-tertiary-text transition-colors duration-100 hover:text-primary-text"
            >
              <Info size={13} aria-hidden />
              {t.about}
            </button>
          </footer>
        </div>
      </section>

      <GithubLoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} host="github.com" onSuccess={() => setLoginModalOpen(false)} />

      <CloneModal
        open={showClone}
        onClose={() => {
          setShowClone(false)
          // The error belonged to the attempt shown inside the modal.
          useRepoStore.getState().clearError()
        }}
      />

      <RepoPickerModal
        open={foundRepoPaths !== null}
        repoPaths={foundRepoPaths ?? []}
        onConfirm={handleConfirmRepoPicker}
        onCancel={() => setFoundRepoPaths(null)}
      />

      <ConfirmDialog
        open={groupToDelete !== null}
        title={t.deleteFolderTitle(groupToDelete?.name ?? '')}
        message={t.deleteFolderMessage}
        confirmLabel={t.deleteFolderConfirm}
        danger
        onCancel={() => setGroupToDelete(null)}
        onConfirm={() => {
          const target = groupToDelete
          setGroupToDelete(null)
          if (target) void deleteRepoGroup(target.id)
        }}
      />
      <ConfirmDialog
        open={pullTarget !== null}
        title={t.pullTitle(pullTarget?.name ?? '')}
        message={t.pullMessage}
        confirmLabel={t.pullConfirm}
        onCancel={() => setPullTarget(null)}
        onConfirm={() => {
          const target = pullTarget
          setPullTarget(null)
          if (target) void pullRecentRepo(target.path)
        }}
      />
    </main>
  )
}

/** Clone / create / sign in: secondary ways onto the bench, under the primary Open. */
function RailAction({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
  active
}: {
  icon: LucideIcon | ComponentType<{ size?: number | string; className?: string }>
  label: string
  description: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group/rail flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color] duration-150 ${
        active
          ? 'border-command-blue/50 bg-active-overlay'
          : 'border-default-border bg-midnight-base hover:border-command-blue/40 hover:bg-active-overlay'
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-md border transition-[color,border-color,transform] duration-200 [transition-timing-function:var(--ease-out-expo)] group-hover/rail:-rotate-3 ${
          active
            ? 'border-command-blue/40 bg-command-blue-soft text-command-blue'
            : 'border-default-border bg-coal-raised text-secondary-text group-hover/rail:border-command-blue/40 group-hover/rail:text-command-blue'
        }`}
      >
        <Icon size={17} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body font-semibold text-primary-text">{label}</span>
        <span className="text-caption text-pretty text-secondary-text">{description}</span>
      </span>
    </button>
  )
}

/** First run: the bench drawn empty — a trunk waiting for its first branch. */
function EmptyBench({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-5 px-4 py-14 text-center">
      <svg width="260" height="96" viewBox="0 0 260 96" aria-hidden className="rise-in">
        <path d="M 10 48 L 90 48" stroke="var(--color-tertiary-text)" strokeWidth={2.5} strokeLinecap="round" opacity={0.5} className="lane-path" />
        <path d="M 90 48 C 112 48, 104 22, 128 22 L 210 22" stroke="var(--color-attention-orange)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray="2 7" />
        <path d="M 90 48 C 112 48, 104 74, 128 74 L 210 74" stroke="var(--color-command-blue)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray="2 7" />
        <circle cx={90} cy={48} r={6} fill="var(--color-obsidian-panel)" stroke="var(--color-tertiary-text)" strokeWidth={2.5} />
        <circle cx={222} cy={22} r={7} fill="var(--color-obsidian-panel)" stroke="var(--color-attention-orange)" strokeWidth={2.5} strokeDasharray="3 2.5" />
        <circle cx={222} cy={74} r={7} fill="var(--color-obsidian-panel)" stroke="var(--color-command-blue)" strokeWidth={2.5} strokeDasharray="3 2.5" />
      </svg>
      <div className="flex max-w-[46ch] flex-col gap-2">
        <h3 className="text-headline font-semibold text-primary-text">{title}</h3>
        <p className="text-body text-pretty text-secondary-text">{body}</p>
      </div>
    </div>
  )
}

export default InitialView
