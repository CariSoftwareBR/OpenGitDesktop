import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  DownloadCloud,
  FileDiff,
  FolderGit2,
  GitBranch,
  GitMerge,
  GitPullRequest,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  UploadCloud
} from 'lucide-react'
import { basename } from '../lib/path'
import DeleteBranchDialog from './DeleteBranchDialog'
import { sanitizeBranchInput, validateBranchName } from '../lib/branchName'
import { useClickOutside } from '../lib/useClickOutside'
import { useMenuKeyboard } from '../lib/useMenuKeyboard'
import { NARROW_LAYOUT_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import { updateStatusLabel, useUpdateStatus } from '../lib/useUpdateStatus'
import { useRepoStore } from '../store/repoStore'
import { useGithubAuthStore } from '../store/githubAuthStore'
import ConfirmDialog, { PromptDialog } from './ConfirmDialog'
import Github from './icons/Github'
import { openSettings } from '../lib/openAiSettings'
import { useT } from '../lib/i18n'
import type { Messages } from '../../../shared/i18n'
import ThemeToggle from './ThemeToggle'

function timeAgo(t: Messages['topBar'], timestamp: number | null): string {
  if (!timestamp) return t.neverFetched
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return t.justNow
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t.minutesAgo(minutes)
  const hours = Math.floor(minutes / 60)
  return t.hoursAgo(hours)
}

const STATUS_TRIGGER =
  'flex h-[46px] items-center gap-3 px-4 text-left transition-[background-color,transform] duration-100 hover:bg-hover-overlay active:bg-primary-text/15 disabled:opacity-40'
const CHEVRON = 'ml-1 shrink-0 text-tertiary-text transition-transform duration-200'
// Portaled to document.body (see RepoCard/BranchCard) and positioned via
// inline style rather than being an absolute descendant of the trigger —
// the header row needs overflow-x-auto for narrow layouts, and per the CSS
// overflow spec, setting only overflow-x forces the used value of
// overflow-y to 'auto' as well (even when overflow-y is left at its default
// 'visible'), turning the header into a clipped scroll container. An
// absolutely-positioned menu nested inside it would get clipped/scrolled
// along with it instead of floating freely below the toolbar.
const MENU_PANEL =
  'fixed z-30 min-w-[220px] max-h-80 overflow-y-auto rounded-md border border-default-border bg-coal-raised p-1.5 shadow-floating'
const ROW_ICON =
  'rounded-sm p-1.5 text-tertiary-text transition-[background-color,transform] duration-100 hover:bg-hover-overlay hover:text-primary-text active:scale-90'
const MENU_ITEM =
  'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-body text-primary-text transition-[background-color,transform] duration-100 hover:bg-hover-overlay focus-visible:bg-hover-overlay focus-visible:outline-none active:scale-[0.98] active:bg-primary-text/15'

interface MenuPosition {
  top: number
  left: number
}

function menuPositionFromTrigger(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect()
  return { top: rect.bottom + 6, left: rect.left }
}

/** Paths from the recents list and from a dialog may differ in slashes/case. */
function samePath(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const norm = (p: string): string => p.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase()
  return norm(a) === norm(b)
}

function RepoCard({ compact }: { compact: boolean }): JSX.Element {
  const repoPath = useRepoStore((s) => s.currentRepoPath)
  const recentRepos = useRepoStore((s) => s.recentRepos)
  const openRepository = useRepoStore((s) => s.openRepository)
  const t = useT().topBar
  const [repoFilter, setRepoFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])
  useClickOutside([ref, menuRef], close)
  useMenuKeyboard(menuRef, open, close)

  const name = repoPath ? basename(repoPath) : ''

  function toggle(): void {
    if (!open && triggerRef.current) setMenuPos(menuPositionFromTrigger(triggerRef.current))
    setOpen((v) => !v)
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={`${STATUS_TRIGGER} ${compact ? 'max-w-[140px]' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? t.currentRepoAria(name) : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            toggle()
          }
        }}
      >
        <FolderGit2 size={16} className="shrink-0 text-secondary-text" aria-hidden />
        {compact ? (
          <span title={name} className="truncate text-body font-medium text-primary-text">{name}</span>
        ) : (
          <span className="flex flex-col gap-0.5 leading-tight">
            <span className="text-label uppercase tracking-wide text-tertiary-text">{t.currentRepo}</span>
            <span title={name} className="max-w-48 truncate text-body font-medium text-primary-text">{name}</span>
          </span>
        )}
        <ChevronDown size={14} className={`${CHEVRON} ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open &&
        menuPos &&
        createPortal(
          <div ref={menuRef} role="menu" style={{ top: menuPos.top, left: menuPos.left }} className={`${MENU_PANEL} max-w-[360px]`}>
            {recentRepos.length > 8 && (
              <input
                type="search"
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                placeholder={t.filterReposPlaceholder}
                aria-label={t.filterRepos}
                className="field mb-1.5 w-full py-1.5"
              />
            )}
            {recentRepos
              .filter((repo) => !repoFilter.trim() || repo.name.toLowerCase().includes(repoFilter.trim().toLowerCase()))
              .map((repo) => {
                const isCurrent = samePath(repo.path, repoPath)
                return (
                  <button
                    key={repo.path}
                    type="button"
                    role="menuitem"
                    className={MENU_ITEM}
                    title={repo.missing ? t.folderMissing(repo.path) : repo.path}
                    disabled={repo.missing}
                    onClick={() => {
                      setOpen(false)
                      if (!isCurrent) openRepository(repo.path)
                    }}
                  >
                    <span className={`truncate ${isCurrent ? 'font-semibold' : ''} ${repo.missing ? 'opacity-50' : ''}`}>{repo.name}</span>
                    {isCurrent && <Check size={14} className="ml-auto shrink-0 text-command-blue" aria-label={t.currentMarker} />}
                  </button>
                )
              })}
          </div>,
          document.body
        )}
    </div>
  )
}

function BranchCard({ compact }: { compact: boolean }): JSX.Element {
  const branches = useRepoStore((s) => s.branches)
  const remoteBranches = useRepoStore((s) => s.remoteBranches)
  const status = useRepoStore((s) => s.status)
  const isBusy = useRepoStore((s) => s.isBusy)
  const switchBranch = useRepoStore((s) => s.switchBranch)
  const createBranch = useRepoStore((s) => s.createBranch)
  const mergeBranch = useRepoStore((s) => s.mergeBranch)
  const checkoutRemoteBranch = useRepoStore((s) => s.checkoutRemoteBranch)
  const deleteBranch = useRepoStore((s) => s.deleteBranch)
  const deleteCheckedBranch = useRepoStore((s) => s.deleteCheckedBranch)
  const repoPath = useRepoStore((s) => s.currentRepoPath)
  const renameBranch = useRepoStore((s) => s.renameBranch)
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null)
  const t = useT().topBar
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [newBranchOpen, setNewBranchOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  // The checked delete (compared with main) comes first; deleteTarget is git's
  // own -d / -D flow, kept as the fallback when that comparison cannot run.
  const [checkTarget, setCheckTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; force: boolean } | null>(null)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])
  useClickOutside([ref, menuRef], close)
  useMenuKeyboard(menuRef, open, close)

  const currentBranch = branches.find((b) => b.isCurrent)?.name ?? status?.branch ?? '—'
  const query = filter.trim().toLowerCase()
  const visibleLocal = query ? branches.filter((b) => b.name.toLowerCase().includes(query)) : branches
  const visibleRemote = query ? remoteBranches.filter((b) => b.toLowerCase().includes(query)) : remoteBranches
  // The filter only earns its space once the list stops fitting at a glance.
  const showFilter = branches.length + remoteBranches.length > 6

  function toggle(): void {
    if (!open && triggerRef.current) setMenuPos(menuPositionFromTrigger(triggerRef.current))
    setFilter('')
    setOpen((v) => !v)
  }

  function handleNewBranch(): void {
    setOpen(false)
    setNewBranchOpen(true)
  }

  function requestMerge(name: string): void {
    setOpen(false)
    setMergeTarget(name)
  }

  function requestRename(name: string): void {
    setOpen(false)
    setRenameTarget(name)
  }

  function requestDelete(name: string): void {
    setOpen(false)
    setCheckTarget(name)
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={`${STATUS_TRIGGER} ${compact ? 'max-w-[140px]' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? t.currentBranchAria(currentBranch) : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            toggle()
          }
        }}
        disabled={isBusy}
      >
        <GitBranch size={16} className="shrink-0 text-secondary-text" aria-hidden />
        {compact ? (
          <span title={currentBranch} className="truncate text-body font-medium text-primary-text">
            {currentBranch}
          </span>
        ) : (
          <span className="flex flex-col gap-0.5 leading-tight">
            <span className="text-label uppercase tracking-wide text-tertiary-text">{t.currentBranch}</span>
            <span title={currentBranch} className="max-w-60 truncate text-body font-medium text-primary-text">
              {currentBranch}
            </span>
          </span>
        )}
        <ChevronDown size={14} className={`${CHEVRON} ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            className={`${MENU_PANEL} max-w-[360px]`}
          >
            <button type="button" role="menuitem" className={`${MENU_ITEM} text-command-blue`} onClick={handleNewBranch}>
              <Plus size={14} aria-hidden /> {t.newBranch}
            </button>
            {showFilter && (
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t.filterBranchesPlaceholder}
                aria-label={t.filterBranches}
                className="field mt-1.5 w-full py-1.5"
              />
            )}
            <div className="my-1.5 h-px bg-default-border" role="separator" />
            {visibleLocal.length === 0 && visibleRemote.length === 0 && (
              <p className="px-2.5 py-1.5 text-caption text-tertiary-text">{t.noBranchFound}</p>
            )}
            {visibleLocal.map((branch) => (
              <div key={branch.name} className="flex items-center">
                <button
                  type="button"
                  role="menuitem"
                  className={`${MENU_ITEM} min-w-0 flex-1`}
                  title={branch.name}
                  onClick={() => {
                    setOpen(false)
                    if (!branch.isCurrent) switchBranch(branch.name)
                  }}
                >
                  {branch.isCurrent ? (
                    <>
                      <span className="truncate font-semibold">{branch.name}</span>
                      <Check size={14} className="ml-auto shrink-0 text-command-blue" aria-label={t.currentMarker} />
                    </>
                  ) : (
                    <span className="truncate">{branch.name}</span>
                  )}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={ROW_ICON}
                  title={t.renameBranchAria(branch.name)}
                  aria-label={t.renameBranchAria(branch.name)}
                  onClick={() => requestRename(branch.name)}
                >
                  <Pencil size={14} aria-hidden />
                </button>
                {!branch.isCurrent && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className={ROW_ICON}
                      title={t.mergeIntoCurrentAria(branch.name)}
                      aria-label={t.mergeIntoCurrentAria(branch.name)}
                      onClick={() => requestMerge(branch.name)}
                    >
                      <GitMerge size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${ROW_ICON} hover:text-danger-red`}
                      title={t.deleteBranchAria(branch.name)}
                      aria-label={t.deleteBranchAria(branch.name)}
                      onClick={() => requestDelete(branch.name)}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </>
                )}
              </div>
            ))}
            {visibleRemote.length > 0 && (
              <>
                <div className="mt-2 px-2.5 pb-1 text-label uppercase tracking-wide text-tertiary-text">{t.remotes}</div>
                {visibleRemote.map((remote) => (
                  <button
                    key={remote}
                    type="button"
                    role="menuitem"
                    className={MENU_ITEM}
                    title={t.checkoutRemoteTitle(remote.slice(remote.indexOf('/') + 1), remote)}
                    onClick={() => {
                      setOpen(false)
                      void checkoutRemoteBranch(remote)
                    }}
                  >
                    <DownloadCloud size={14} className="shrink-0 text-tertiary-text" aria-hidden />
                    <span className="truncate">{remote}</span>
                  </button>
                ))}
              </>
            )}
          </div>,
          document.body
        )}
      <ConfirmDialog
        open={mergeTarget !== null}
        title={t.mergeTitle}
        message={mergeTarget ? t.mergeMessage(mergeTarget, currentBranch) : ''}
        confirmLabel={t.mergeConfirm}
        onCancel={() => setMergeTarget(null)}
        onConfirm={() => {
          const name = mergeTarget
          setMergeTarget(null)
          if (name) void mergeBranch(name)
        }}
      />
      <DeleteBranchDialog
        name={checkTarget}
        repoPath={repoPath}
        onCancel={() => setCheckTarget(null)}
        onDelete={(name, tip) => {
          setCheckTarget(null)
          void deleteCheckedBranch(name, tip)
        }}
        onFallback={(name) => {
          setCheckTarget(null)
          setDeleteTarget({ name, force: false })
        }}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        danger
        title={deleteTarget?.force ? t.deleteForceTitle : t.deleteTitle}
        message={
          !deleteTarget
            ? ''
            : deleteTarget.force
              ? t.deleteForceMessage(deleteTarget.name)
              : t.deleteMessage(deleteTarget.name)
        }
        confirmLabel={deleteTarget?.force ? t.deleteForceConfirm : t.deleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget
          setDeleteTarget(null)
          if (!target) return
          void deleteBranch(target.name, target.force).then((done) => {
            // git refused the safe delete: ask once more, now spelling out the loss.
            if (!done) setDeleteTarget({ name: target.name, force: true })
          })
        }}
      />
      <PromptDialog
        open={newBranchOpen}
        title={t.newBranch}
        label={t.branchName}
        placeholder="feature/…"
        confirmLabel={t.createBranch}
        transform={sanitizeBranchInput}
        validate={(name) => validateBranchName(name, branches.map((b) => b.name))}
        onCancel={() => {
          setNewBranchOpen(false)
          triggerRef.current?.focus()
        }}
        onConfirm={(name) => {
          setNewBranchOpen(false)
          void createBranch(name, true)
        }}
      />
      <PromptDialog
        open={renameTarget !== null}
        title={t.renameTitle}
        message={renameTarget ? t.renameMessage(renameTarget) : undefined}
        label={t.newName}
        initialValue={renameTarget ?? ''}
        confirmLabel={t.renameConfirm}
        transform={sanitizeBranchInput}
        validate={(name) =>
          name === renameTarget
            ? t.renameSameName
            : validateBranchName(
                name,
                branches.map((b) => b.name).filter((b) => b !== renameTarget)
              )
        }
        onCancel={() => setRenameTarget(null)}
        onConfirm={(name) => {
          const oldName = renameTarget
          setRenameTarget(null)
          if (oldName) void renameBranch(oldName, name)
        }}
      />
    </div>
  )
}

function SyncCard({ compact }: { compact: boolean }): JSX.Element {
  const status = useRepoStore((s) => s.status)
  const isBusy = useRepoStore((s) => s.isBusy)
  const lastFetchedAt = useRepoStore((s) => s.lastFetchedAt)
  const sync = useRepoStore((s) => s.sync)
  const forcePushPrompt = useRepoStore((s) => s.forcePushPrompt)
  const forcePush = useRepoStore((s) => s.forcePush)
  const dismissForcePush = useRepoStore((s) => s.dismissForcePush)
  const t = useT().topBar

  const forcePushDialog = (
    <ConfirmDialog
      open={forcePushPrompt !== null}
      danger
      title={t.forcePushTitle}
      message={forcePushPrompt ? t.forcePushMessage(forcePushPrompt.branch) : ''}
      confirmLabel={t.forcePushConfirm}
      onCancel={dismissForcePush}
      onConfirm={() => void forcePush()}
    />
  )

  let icon = <RefreshCw size={16} className="text-secondary-text" aria-hidden />
  let label = t.fetchOrigin
  let subtitle = timeAgo(t, lastFetchedAt)

  if (status && !status.upstream) {
    icon = <UploadCloud size={16} className="text-command-blue" aria-hidden />
    label = t.publishBranch
    subtitle = t.notPublished
  } else if (status && status.behind > 0 && status.ahead > 0) {
    icon = <RefreshCw size={16} className="text-warning-amber" aria-hidden />
    label = t.syncDiverged(status.behind, status.ahead)
    subtitle = t.divergedFromRemote
  } else if (status && status.behind > 0) {
    icon = <DownloadCloud size={16} className="text-warning-amber" aria-hidden />
    label = t.pullOrigin(status.behind)
    subtitle = t.commitsBehind(status.behind)
  } else if (status && status.ahead > 0) {
    icon = <UploadCloud size={16} className="text-command-blue" aria-hidden />
    label = t.pushOrigin(status.ahead)
    subtitle = t.commitsAhead(status.ahead)
  }

  if (isBusy) icon = <Loader2 size={16} className="animate-spin text-secondary-text" aria-hidden />

  if (compact) {
    return (
      <>
      {forcePushDialog}
      <button
        type="button"
        className="flex h-[46px] w-[46px] items-center justify-center text-secondary-text transition-[background-color,transform] duration-100 hover:bg-hover-overlay hover:text-primary-text disabled:opacity-40"
        onClick={() => sync()}
        disabled={isBusy}
        title={`${label} — ${subtitle}`}
        aria-label={`${label}. ${subtitle}`}
      >
        {icon}
      </button>
      </>
    )
  }

  return (
    <>
    {forcePushDialog}
    <button type="button" className={STATUS_TRIGGER} onClick={() => sync()} disabled={isBusy}>
      {icon}
      <span className="flex flex-col items-start gap-0.5 leading-tight">
        <span className="text-body font-medium text-primary-text">{label}</span>
        <span className="text-label font-normal text-tertiary-text">{subtitle}</span>
      </span>
    </button>
    </>
  )
}

function GithubUserCard({ compact }: { compact: boolean }): JSX.Element | null {
  const user = useGithubAuthStore((s) => s.user)
  const loadCurrentUser = useGithubAuthStore((s) => s.loadCurrentUser)
  const t = useT().topBar

  useEffect(() => {
    void loadCurrentUser('github.com')
  }, [loadCurrentUser])

  if (!user) return null

  const displayName = user.name?.trim() || user.login

  // The photo leads: framed by a blue→green ring (the app's interaction and
  // "connected" colors) that turns half a lap on hover. The panel-colored
  // border between ring and photo keeps the two from bleeding together.
  const avatar = (
    <span className="relative z-10 size-11 shrink-0">
      <span
        className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,var(--color-command-blue),var(--color-success-green),var(--color-command-blue))] opacity-80 transition-[transform,opacity] duration-700 ease-out group-hover/account:opacity-100 motion-safe:group-hover/account:rotate-180"
        aria-hidden
      />
      <img
        src={user.avatarUrl}
        alt=""
        className="absolute inset-[2px] size-10 rounded-full border-2 border-obsidian-panel bg-coal-raised object-cover"
      />
    </span>
  )

  if (compact) {
    return (
      <button
        type="button"
        className="group/account flex h-[46px] shrink-0 items-center rounded-pill transition-transform duration-100 active:scale-95"
        onClick={() => openSettings('general')}
        title={t.githubAccountTitle(displayName, user.login)}
        aria-label={t.githubAccountAria(displayName)}
      >
        {avatar}
      </button>
    )
  }

  return (
    <button
      type="button"
      className="group/account flex h-[46px] shrink-0 items-center text-left transition-transform duration-100 active:scale-[0.98]"
      onClick={() => openSettings('general')}
      title={t.githubAccountTitle(displayName, user.login)}
      aria-label={t.githubAccountAria(displayName)}
    >
      {avatar}
      {/* A name tag that starts from under the photo, so the photo seems to
          sit on its end — one piece, not a picture beside a box. */}
      <span className="-ml-[22px] flex h-9 min-w-0 flex-col justify-center gap-px rounded-r-pill border border-default-border/70 bg-coal-raised/60 pl-[30px] pr-4 leading-tight transition-[background-color,border-color] duration-200 group-hover/account:border-command-blue/40 group-hover/account:bg-hover-overlay">
        <span className="max-w-40 truncate text-body font-semibold text-primary-text">{displayName}</span>
        <span className="flex min-w-0 items-center gap-1 text-label font-normal text-tertiary-text transition-colors duration-200 group-hover/account:text-secondary-text">
          <Github size={10} className="shrink-0" />
          <span className="max-w-36 truncate">{user.login}</span>
        </span>
      </span>
    </button>
  )
}

// Only rendered — right after "Sobre" — while there's actually an update
// to report; idle/checking/not-available/disabled/error stay invisible.
function UpdateIconButton({ iconBtn }: { iconBtn: (active: boolean) => string }): JSX.Element | null {
  const status = useUpdateStatus()
  const setView = useRepoStore((s) => s.setView)

  const label = updateStatusLabel(useT().about, status)
  if (!label) return null

  const ready = status.state === 'downloaded'

  return (
    <button
      type="button"
      className={`relative ${ready ? 'flex h-[42px] w-[42px] items-center justify-center rounded-md border border-command-blue bg-command-blue-soft text-command-blue transition-transform duration-100 active:scale-95' : iconBtn(false)} shrink-0`}
      onClick={() => setView('about')}
      title={label}
      aria-label={label}
    >
      <DownloadCloud size={16} className={status.state === 'downloading' ? 'animate-pulse' : undefined} />
      {ready && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-command-blue" aria-hidden />}
    </button>
  )
}

const MAX_BLOCKING_FILES_SHOWN = 8

// Mounted once for the whole repo screen: any switch (menu, PR flow, post-merge
// action) can be refused by git because of local changes.
function SwitchBlockedDialog(): JSX.Element {
  const switchBlocked = useRepoStore((s) => s.switchBlocked)
  const changeCount = useRepoStore((s) => s.status?.entries.length ?? 0)
  const stashAndSwitch = useRepoStore((s) => s.stashAndSwitch)
  const cancelBlockedSwitch = useRepoStore((s) => s.cancelBlockedSwitch)
  const t = useT().topBar
  const files = switchBlocked?.files ?? []
  const shown = files.slice(0, MAX_BLOCKING_FILES_SHOWN)

  return (
    <ConfirmDialog
      open={switchBlocked !== null}
      title={t.switchBlockedTitle}
      message={switchBlocked ? t.switchBlockedMessage(switchBlocked.from, switchBlocked.target) : ''}
      // Fixed and short: a long branch name would wrap inside the 34px button.
      confirmLabel={t.stashAndSwitch}
      onCancel={cancelBlockedSwitch}
      onConfirm={() => void stashAndSwitch()}
    >
      <ul className="mt-3 max-h-48 overflow-y-auto rounded-md border border-default-border bg-midnight-base px-3 py-2 font-mono text-caption text-secondary-text">
        {shown.map((file) => (
          <li key={file} className="truncate" title={file}>
            {file}
          </li>
        ))}
        {files.length > shown.length && (
          <li className="font-sans text-tertiary-text">{t.switchBlockedMore(files.length - shown.length)}</li>
        )}
      </ul>
      {switchBlocked && (
        <p className="mt-3 text-caption text-tertiary-text">
          {t.switchBlockedNote(switchBlocked.from, Math.max(changeCount, files.length))}
        </p>
      )}
    </ConfirmDialog>
  )
}

function TopBar(): JSX.Element {
  const view = useRepoStore((s) => s.view)
  const setView = useRepoStore((s) => s.setView)
  const closeRepository = useRepoStore((s) => s.closeRepository)
  const t = useT().topBar
  const narrow = useMediaQuery(NARROW_LAYOUT_QUERY)

  const tabs = [
    { id: 'changes' as const, label: t.tabs.changes, icon: FileDiff },
    { id: 'history' as const, label: t.tabs.history, icon: Clock },
    { id: 'stash' as const, label: t.tabs.stash, icon: Archive },
    { id: 'pullRequests' as const, label: t.tabs.pullRequests, icon: GitPullRequest },
    { id: 'dashboard' as const, label: t.tabs.dashboard, icon: LayoutDashboard },
    { id: 'settings' as const, label: t.tabs.settings, icon: Settings2 }
  ]

  const iconBtn = (active: boolean): string =>
    active
      ? 'flex h-[42px] w-[42px] items-center justify-center rounded-md border border-command-blue bg-command-blue-soft text-command-blue transition-transform duration-100 active:scale-95'
      : 'flex h-[42px] w-[42px] items-center justify-center rounded-md border border-default-border bg-coal-raised text-secondary-text shadow-[var(--shadow-raised)] transition-[background-color,transform] duration-100 hover:bg-hover-overlay hover:text-primary-text active:scale-95'

  return (
    <>
      <header className="flex items-center gap-2 overflow-x-auto bg-obsidian-panel px-3 pb-1.5 pt-2">
        {/* Back, repo, branch and sync read as one cluster — the path from
            "which project" to "what state it is in" — instead of loose tiles. */}
        <div
          className="flex h-[46px] shrink-0 items-stretch overflow-hidden rounded-md border border-default-border bg-coal-raised shadow-[var(--shadow-raised)]"
          aria-label={t.repoBranchSync}
        >
          <button
            type="button"
            className="flex w-[46px] shrink-0 items-center justify-center text-secondary-text transition-[background-color,color] duration-100 hover:bg-hover-overlay hover:text-primary-text active:bg-primary-text/15 [&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:-translate-x-0.5"
            onClick={closeRepository}
            title={t.backToRecents}
            aria-label={t.backToRecents}
          >
            <ArrowLeft size={16} />
          </button>
          <span className="w-px self-stretch bg-default-border" aria-hidden />
          <RepoCard compact={narrow} />
          <span className="w-px self-stretch bg-default-border" aria-hidden />
          <BranchCard compact={narrow} />
          <span className="w-px self-stretch bg-default-border" aria-hidden />
          <SyncCard compact={narrow} />
        </div>
        <span className="min-w-2 flex-1" />
        <GithubUserCard compact={narrow} />
        <ThemeToggle className="size-[42px] shrink-0" />
        <UpdateIconButton iconBtn={iconBtn} />
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-default-border bg-obsidian-panel px-3" aria-label={t.repoViews}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              title={tab.label}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? `tab-indicator flex shrink-0 items-center gap-1.5 ${narrow ? 'px-2.5' : 'px-3'} py-2.5 text-body font-medium text-primary-text [&>svg]:text-command-blue`
                  : `tab-indicator group/tab flex shrink-0 items-center gap-1.5 ${narrow ? 'px-2.5' : 'px-3'} py-2.5 text-body text-secondary-text transition-colors duration-150 hover:text-primary-text`
              }
            >
              <Icon size={14} aria-hidden />
              {!narrow && tab.label}
            </button>
          )
        })}
      </nav>
      <SwitchBlockedDialog />
    </>
  )
}

export default TopBar
