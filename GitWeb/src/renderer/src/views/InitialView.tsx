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
  FolderGit2,
  FolderOpen,
  FolderPlus,
  Info,
  Loader2,
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

function FetchCheckBadge({ check }: { check?: RepoUpdateStatus }): JSX.Element | null {
  if (!check) return null
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

/** Plural forms are whole words — suffix concatenation produced "alteraçãoões". */
function commits(n: number): string {
  return `${n} commit${n === 1 ? '' : 's'}`
}

/**
 * Per-repo status as icon + number only. Words here repeat on every card and
 * are what made the list bulky; the meaning lives in the tooltip, and the
 * badge at the end of the row already carries the overall state.
 */
function repoStatusChips(check: RepoUpdateStatus): StatusChip[] {
  const chips: StatusChip[] = []
  const def = check.defaultBranch

  if (check.state === 'diverged') {
    chips.push({
      icon: GitBranch,
      value: `↑${check.localDefaultAhead} ↓${check.localDefaultBehind}`,
      title: `"${def}" local divergiu de origin/${def}: ${commits(check.localDefaultAhead)} só seus, ${commits(check.localDefaultBehind)} no remote`
    })
  } else if (check.state === 'behind') {
    chips.push({
      icon: ArrowDown,
      value: String(check.behindDefault),
      title: `${commits(check.behindDefault)} atrás de origin/${def}`
    })
    // On another branch the headline number is not what a pull would fix, so
    // the local default branch gets its own chip.
    if (check.branch !== def && check.hasLocalDefault && check.localDefaultBehind > 0) {
      chips.push({
        icon: GitBranch,
        value: String(check.localDefaultBehind),
        title: `"${def}" local está ${commits(check.localDefaultBehind)} atrás`
      })
    } else if (!check.hasLocalDefault) {
      // No local default branch means no checkbox and no batch update for this
      // card. Without this chip the row shows a warning it offers no way to act
      // on, and the reason is only visible by hovering the badge.
      chips.push({
        icon: GitBranch,
        value: `sem ${def}`,
        title: `Não existe um branch "${def}" local, então a atualização em lote não alcança este repositório — abra-o e faça checkout de "${def}", ou um pull no branch atual`
      })
    }
  }

  if (check.ahead > 0) {
    chips.push({
      icon: ArrowUp,
      value: String(check.ahead),
      title: `${commits(check.ahead)} ainda não enviados`
    })
  }
  if (check.localChanges > 0) {
    chips.push({
      icon: Pencil,
      value: String(check.localChanges),
      title:
        check.localChanges === 1 ? '1 arquivo com alteração local' : `${check.localChanges} arquivos com alterações locais`
    })
  }

  return chips
}

const OUTCOME_LABEL: Record<RepoUpdateResult['outcome'], string> = {
  updated: 'atualizado',
  alreadyUpToDate: 'já estava em dia',
  skippedDirty: 'pulado',
  skippedDiverged: 'pulado',
  skippedNoDefault: 'pulado',
  failed: 'falhou'
}

function outcomeClass(outcome: RepoUpdateResult['outcome']): string {
  if (outcome === 'updated' || outcome === 'alreadyUpToDate') return 'text-success-green'
  if (outcome === 'failed') return 'text-danger-red'
  return 'text-attention-orange'
}

function summarizeBatch(results: Record<string, RepoUpdateResult>): string | null {
  const all = Object.values(results)
  if (all.length === 0) return null

  const updated = all.filter((r) => r.outcome === 'updated').length
  const commits = all.reduce((sum, r) => sum + r.commitsPulled, 0)
  const skipped = all.filter((r) => r.outcome.startsWith('skipped')).length
  const failed = all.filter((r) => r.outcome === 'failed').length
  const alreadyOk = all.filter((r) => r.outcome === 'alreadyUpToDate').length

  const parts: string[] = []
  if (updated > 0) parts.push(`${updated} atualizado${updated === 1 ? '' : 's'} (${commits} commit${commits === 1 ? '' : 's'})`)
  if (alreadyOk > 0) parts.push(`${alreadyOk} já estava${alreadyOk === 1 ? '' : 'm'} em dia`)
  if (skipped > 0) parts.push(`${skipped} pulado${skipped === 1 ? '' : 's'}`)
  if (failed > 0) parts.push(`${failed} com falha`)
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
  useClickOutside(ref, onClose)

  const options: { id: string | null; name: string }[] = [
    { id: null, name: 'Sem pasta' },
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
        <p className="px-2.5 py-1.5 text-caption text-tertiary-text">Crie uma pasta primeiro.</p>
      )}
    </div>
  )
}

function ActionTile({
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
      onClick={onClick}
      disabled={disabled}
      // Feeds the pointer position to the tile's spotlight and edge light
      // (see .action-tile in global.css) — purely visual.
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`)
        e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`)
      }}
      className={`action-tile group/tile flex min-h-[152px] flex-col justify-between gap-6 rounded-lg border p-5 text-left shadow-[var(--shadow-raised)] ${
        active ? 'is-active' : ''
      }`}
    >
      <span className="flex w-full items-start justify-between">
        <span
          className={`flex size-10 items-center justify-center rounded-md border shadow-[var(--shadow-raised)] transition-[background-color,border-color,color,transform] duration-300 ease-[var(--ease-out-expo)] group-hover/tile:-rotate-3 group-hover/tile:scale-105 ${
            active
              ? 'border-command-blue/40 bg-command-blue-soft text-command-blue'
              : 'border-default-border bg-coal-raised text-secondary-text group-hover/tile:border-command-blue/40 group-hover/tile:bg-command-blue-soft group-hover/tile:text-command-blue'
          }`}
        >
          <Icon size={18} />
        </span>
        <ArrowRight
          size={16}
          className={`mt-1 transition-[opacity,transform,color] duration-300 ease-[var(--ease-out-expo)] ${
            active
              ? 'text-command-blue opacity-100'
              : '-translate-x-1.5 text-tertiary-text opacity-0 group-hover/tile:translate-x-0 group-hover/tile:text-command-blue group-hover/tile:opacity-100 group-focus-visible/tile:translate-x-0 group-focus-visible/tile:opacity-100'
          }`}
          aria-hidden
        />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-title font-semibold text-primary-text">{label}</span>
        <span className="min-h-[2lh] text-caption text-pretty text-secondary-text">{description}</span>
      </span>
    </button>
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

  useEffect(() => {
    void loadCurrentUser('github.com').finally(() => setAccountChecked(true))
  }, [loadCurrentUser])

  // Tri-state (null while the initial check is in flight) avoids a flash of
  // the "Entrar com GitHub" tile for the common case where the user is
  // already signed in.
  const hasGithubAccount = accountChecked ? Boolean(user) : null

  const updatablePaths = recentRepos.map((r) => r.path).filter((path) => recentRepoChecks[path]?.canFastForward)
  const selectedCount = selectedRepoPaths.filter((path) => recentRepoChecks[path]?.canFastForward).length
  const allUpdatableSelected = updatablePaths.length > 0 && selectedCount === updatablePaths.length
  const batchSummary = summarizeBatch(batchUpdateResults)
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
    await createRepoGroup('Nova pasta')
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
        setError(`Nenhum repositório git encontrado em "${path}".`)
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

  function renderRepoCard(repo: RecentRepository): JSX.Element {
    const check = repo.missing ? undefined : recentRepoChecks[repo.path]
    const result = batchUpdateResults[repo.path]
    const selectable = Boolean(check?.canFastForward)
    const chips = check && check.state !== 'checking' ? repoStatusChips(check) : []

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
        className={
          repo.missing
            ? 'group relative flex cursor-grab items-start gap-1 rounded-md border border-dashed border-default-border bg-obsidian-panel py-3 pl-3 pr-2 opacity-60'
            : 'repo-card group relative flex cursor-grab items-start gap-1 rounded-md border py-3 pl-3 pr-2 shadow-[var(--shadow-raised)]'
        }
      >
        {showSelection && (
          <span className="flex h-9 w-6 shrink-0 items-center justify-start">
            {selectable && (
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-command-blue"
                checked={selectedRepoPaths.includes(repo.path)}
                onChange={() => toggleRepoSelection(repo.path)}
                disabled={isBusy}
                aria-label={`Selecionar ${repo.name} para atualizar`}
              />
            )}
          </span>
        )}
        <button
          onClick={() => openRepository(repo.path)}
          disabled={isBusy || repo.missing}
          className="flex min-w-0 flex-1 items-start gap-3 text-left active:scale-[0.99]"
        >
          <span className="repo-card-icon flex size-10 shrink-0 items-center justify-center rounded-md border shadow-[var(--shadow-raised)]">
            <FolderGit2 size={17} />
          </span>
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
            <span className="truncate text-caption text-tertiary-text">{repo.path}</span>
            {repo.missing ? (
              <span className="mt-0.5 flex items-center gap-1 text-caption text-attention-orange">
                <AlertTriangle size={12} aria-hidden />
                pasta não encontrada
              </span>
            ) : (
              // Empty for a clean, up-to-date repo — rendering the span anyway
              // would leave a blank line's worth of padding.
              chips.length > 0 && (
                <span className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold leading-4 text-attention-orange">
                  {chips.map((chip) => (
                    <span
                      key={chip.title}
                      className="inline-flex items-center gap-1 rounded-pill bg-attention-orange-soft px-1.5 py-px tabular-nums"
                      title={chip.title}
                      aria-label={chip.title}
                    >
                      <chip.icon size={11} aria-hidden />
                      {chip.value}
                    </span>
                  ))}
                </span>
              )
            )}
            {result && (
              <span className={`mt-0.5 text-caption ${outcomeClass(result.outcome)}`}>
                {OUTCOME_LABEL[result.outcome]}: {result.message}
              </span>
            )}
          </span>
        </button>

        {/* Half-width cards leave no room for always-visible actions, so
            they follow the same reveal-on-hover rule the remove button
            already used. */}
        <span className="flex h-9 shrink-0 items-center opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover:opacity-100">
          {/* Keyboard-reachable equivalent of dragging the card. */}
          <button
            type="button"
            onClick={() => setMoveTarget(moveTarget === repo.path ? null : repo.path)}
            className="btn-ghost shrink-0 px-1.5 text-caption"
            title="Mover para pasta"
            aria-label={`Mover ${repo.name} para uma pasta`}
            aria-expanded={moveTarget === repo.path}
          >
            <FolderInput size={14} />
          </button>
          {!repo.missing && check && check.state !== 'checking' && check.state !== 'noRemote' && (
            <button
              type="button"
              onClick={() => void fetchRecentRepo(repo.path)}
              disabled={isBusy}
              className="btn-ghost shrink-0 px-1.5 text-caption"
              title="Fetch (rechecar)"
              aria-label={`Fetch em ${repo.name}`}
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
              title="Pull"
              aria-label={`Pull em ${repo.name}`}
            >
              <ArrowDownToLine size={14} />
            </button>
          )}
          <button
            onClick={() => removeRecentRepo(repo.path)}
            disabled={isBusy}
            className="shrink-0 rounded-md p-1.5 text-tertiary-text hover:bg-danger-red-soft hover:text-danger-red"
            aria-label={`Remover ${repo.name} da lista de recentes`}
            title="Remover da lista (não apaga a pasta)"
          >
            <Trash2 size={15} />
          </button>
        </span>

        {/* Last in the row so it anchors the card's right edge — the action
            icons sit before it. h-9 keeps it on the title's line rather than
            centred against the whole (variable-height) text stack. Hidden
            elements above still occupy their width, so nothing shifts on hover. */}
        <span className="flex h-9 shrink-0 items-center pl-0.5 pr-1" title={check?.message}>
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

  return (
    <main ref={scrollRef} className="h-screen w-full overflow-y-auto bg-midnight-base">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-14">
      <div className="rise-in flex w-full items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-command-blue/25 bg-obsidian-panel text-command-blue shadow-[var(--shadow-raised),var(--shadow-command-glow)]">
          <FolderGit2 size={26} />
        </div>
        <div>
          <h1 className="text-display font-semibold text-primary-text">GitWeb</h1>
          <p className="mt-1 text-body text-secondary-text">Cliente Git multiplataforma inspirado no GitHub Desktop.</p>
        </div>
      </div>

      {/* While cloning, the modal shows this same error inside itself. */}
      {error && !showClone && (
        <div className="flex w-full items-center gap-2 rounded-md border border-danger-red/30 bg-danger-red-soft px-4 py-2.5 text-body text-danger-red" role="alert">
          <AlertCircle size={14} className="shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button type="button" className="hit-area rounded-sm p-1 hover:bg-hover-overlay" onClick={clearError} aria-label="Fechar aviso de erro">
            <X size={14} />
          </button>
        </div>
      )}

      <div
        className={
          hasGithubAccount === false
            ? 'grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'
            : 'grid w-full grid-cols-1 gap-3 sm:grid-cols-3'
        }
      >
        {hasGithubAccount === false && (
          <ActionTile
            icon={Github}
            label="Entrar com GitHub"
            description="Autentique-se para acessar seus repositórios."
            onClick={() => setLoginModalOpen(true)}
            disabled={isBusy}
          />
        )}
        <ActionTile
          icon={FolderOpen}
          label="Abrir"
          description="Uma pasta com um ou vários repositórios git."
          onClick={handleOpen}
          disabled={isBusy || isScanningFolder}
        />
        <ActionTile
          icon={DownloadCloud}
          label="Clonar"
          description="Um repositório remoto do GitHub ou de uma URL."
          onClick={() => setShowClone(true)}
          disabled={isBusy}
          active={showClone}
        />
        <ActionTile
          icon={FolderPlus}
          label="Criar"
          description="Um repositório git novo do zero."
          onClick={handleCreate}
          disabled={isBusy}
        />
      </div>

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-label uppercase tracking-wide text-tertiary-text">Recentes</h2>
          <button
            type="button"
            onClick={() => void handleCreateGroup()}
            disabled={isBusy}
            className="flex items-center gap-1 text-caption text-command-blue hover:underline disabled:opacity-50 disabled:hover:no-underline"
          >
            <FolderPlus size={13} aria-hidden />
            Nova pasta
          </button>
          {updatablePaths.length > 0 && (
            <button
              type="button"
              onClick={() => (allUpdatableSelected ? clearRepoSelection() : selectAllUpdatableRepos())}
              disabled={isBusy}
              className="text-caption text-command-blue hover:underline disabled:opacity-50 disabled:hover:no-underline"
            >
              {allUpdatableSelected
                ? 'Desmarcar todos'
                : `Selecionar os ${updatablePaths.length} desatualizado${updatablePaths.length === 1 ? '' : 's'}`}
            </button>
          )}
          {showSelection && (
            <button
              type="button"
              onClick={() => void updateSelectedRepos()}
              disabled={isBusy || selectedCount === 0}
              className="btn-primary ml-auto flex items-center gap-1.5 px-3 py-1.5 text-caption"
            >
              {isBatchUpdating ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <ArrowDownToLine size={13} aria-hidden />
              )}
              {isBatchUpdating
                ? 'Atualizando…'
                : `Atualizar ${selectedCount || ''} selecionado${selectedCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>

        {batchSummary && (
          <div className="flex items-center gap-2 rounded-md border border-default-border bg-obsidian-panel px-3 py-2 text-caption text-secondary-text">
            <Check size={13} className="shrink-0 text-success-green" aria-hidden />
            <span className="flex-1">{batchSummary}</span>
            <button
              type="button"
              className="hit-area rounded-sm p-1 hover:bg-hover-overlay"
              onClick={clearBatchResults}
              aria-label="Fechar resumo da atualização"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {recentRepos.length === 0 ? (
          <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-2 rounded-lg border border-default-border px-4 py-10 text-center">
            <FolderGit2 size={22} className="text-tertiary-text" />
            <p className="text-body text-secondary-text">Nenhum repositório recente.</p>
            <p className="text-caption text-tertiary-text">Abra, clone ou crie um repositório para começar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
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
                <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                  {(reposByGroup.get(group.id) ?? []).map(renderRepoCard)}
                </ul>
              </RepoGroupSection>
            ))}

            {/* Stays mounted while dragging even when empty, so a card can be
                pulled back out of a folder. */}
            {(ungrouped.length > 0 || repoGroups.length === 0 || draggingPath !== null) && (
              <RepoGroupSection
                id={null}
                name="Sem pasta"
                count={ungrouped.length}
                collapsed={ungroupedCollapsed}
                onToggleCollapsed={() => setUngroupedCollapsed((v) => !v)}
                onDropRepo={(path) => void moveRepoToGroup(path, null)}
              >
                <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">{ungrouped.map(renderRepoCard)}</ul>
              </RepoGroupSection>
            )}
          </div>
        )}
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

      <footer className="mx-auto flex w-full max-w-4xl justify-center gap-4 pt-2">
        <button
          type="button"
          onClick={() => setView('settings')}
          className="flex items-center gap-1.5 text-caption text-tertiary-text transition-colors duration-100 hover:text-secondary-text"
        >
          <Settings2 size={13} aria-hidden />
          Configurações
        </button>
        <button
          type="button"
          onClick={() => useRepoStore.getState().setView('about')}
          className="flex items-center gap-1.5 text-caption text-tertiary-text transition-colors duration-100 hover:text-secondary-text"
        >
          <Info size={13} aria-hidden />
          Sobre o GitWeb
        </button>
      </footer>
      </div>
      <ConfirmDialog
        open={groupToDelete !== null}
        title={`Excluir a pasta "${groupToDelete?.name ?? ''}"?`}
        message="Os repositórios dentro dela voltam para “Sem pasta”. Nenhum repositório é apagado do disco."
        confirmLabel="Excluir pasta"
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
        title={`Pull em ${pullTarget?.name ?? ''}?`}
        message="Isso altera o working tree desse repositório (git pull), mesmo que ele não esteja aberto agora."
        confirmLabel="Fazer pull"
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

export default InitialView
