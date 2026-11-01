import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, GitFork, HardDrive, KeyRound, Link2, Lock, LogOut, RefreshCw, Search, X } from 'lucide-react'
import Github from './icons/Github'
import { useRepoStore } from '../store/repoStore'
import { useGithubAuthStore } from '../store/githubAuthStore'
import { useAppSettingsStore } from '../store/appSettingsStore'
import type { GitHubRepoSummary, GitHubUser } from '../lib/github'
import { useFocusTrap } from '../lib/useFocusTrap'
import { basename, dirname, joinPath, pathsEqual } from '../lib/path'
import {
  collectCloneBaseFolders,
  destinationForRepo,
  destinationWithBase,
  rememberCloneBaseFolder,
  repoNameFromCloneUrl
} from '../lib/cloneDestination'
import GithubLoginModal from './GithubLoginModal'
import CloneDestinationField from './CloneDestinationField'
import { useCloneProgress } from '../lib/useCloneProgress'
import { useFormatters, useLocale, useT } from '../lib/i18n'
import { relativeTime } from '../lib/relativeTime'

type CloneTab = 'github' | 'url' | 'token'

interface CloneModalProps {
  open: boolean
  onClose: () => void
}

/** Git emits progress continuously; this much silence means something is wrong. */
const STALL_AFTER_SECONDS = 10

/* ── Small pure helpers ─────────────────────────────────────────────────── */

/** Owners keep one color across the list, picked from the History graph's lanes. */
function ownerLane(owner: string): number {
  let hash = 0
  for (let i = 0; i < owner.length; i++) hash = (hash * 31 + owner.charCodeAt(i)) >>> 0
  return hash % 8
}

/** Spread the lanes so the first few owners never sit on neighbouring hues. */
const RANKED_LANES = [0, 2, 1, 3, 5, 6, 4, 7]

/** Owners ranked by how many repos they have; each rank gets a distinct lane. */
function rankOwners(repos: GitHubRepoSummary[]): { counts: [string, number][]; lanes: Map<string, number> } {
  const tally = new Map<string, number>()
  for (const repo of repos) tally.set(repo.owner, (tally.get(repo.owner) ?? 0) + 1)
  const counts = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const lanes = new Map(counts.map(([name], i) => [name, i < RANKED_LANES.length ? RANKED_LANES[i] : ownerLane(name)]))
  return { counts, lanes }
}

function monogram(owner: string): string {
  const parts = owner.split(/[-_.\s]+|(?=[A-Z])/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : owner.slice(0, 2)
  return letters.toUpperCase()
}

/** GitHub's own language colors, so the dot matches what people see on github.com. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  'C#': '#178600',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Shell: '#89e051',
  PowerShell: '#012456',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Dart: '#00B4AB',
  'C++': '#f34b7d',
  C: '#555555',
  Vue: '#41b883',
  Lua: '#000080',
  'Jupyter Notebook': '#DA5B0B',
  Dockerfile: '#384d54',
  Svelte: '#ff3e00',
  Astro: '#ff5a03'
}

interface ParsedRemote {
  host: string
  owner: string
  name: string
}

function parseRemoteUrl(raw: string): ParsedRemote | null {
  const url = raw.trim()
  if (!url) return null
  const ssh = /^(?:ssh:\/\/)?[\w.-]+@([^:/\s]+)[:/](.+?)(?:\.git)?\/?$/.exec(url)
  if (ssh) {
    const segments = ssh[2].split('/').filter(Boolean)
    if (segments.length < 2) return null
    return { host: ssh[1], owner: segments.slice(0, -1).join('/'), name: segments[segments.length - 1] }
  }
  try {
    const parsed = new URL(url)
    if (!/^(https?|git):$/.test(parsed.protocol)) return null
    const segments = parsed.pathname.replace(/\.git\/?$/, '').split('/').filter(Boolean)
    if (segments.length < 2) return null
    return { host: parsed.host, owner: segments.slice(0, -1).join('/'), name: segments[segments.length - 1] }
  } catch {
    return null
  }
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function Monogram({ owner, lane = ownerLane(owner), size = 36 }: { owner: string; lane?: number; size?: number }): JSX.Element {
  return (
    <span
      aria-hidden
      className="clone-monogram grid shrink-0 place-items-center rounded-md font-semibold"
      style={{ '--lane': `var(--graph-${lane})`, width: size, height: size, fontSize: size * 0.34 } as React.CSSProperties}
    >
      {monogram(owner)}
    </span>
  )
}

function RepoRowSkeleton({ index }: { index: number }): JSX.Element {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5" aria-hidden style={{ opacity: 1 - index * 0.13 }}>
      <span className="size-9 shrink-0 animate-pulse rounded-md bg-hover-overlay" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="h-3 animate-pulse rounded-sm bg-hover-overlay" style={{ width: `${38 + ((index * 17) % 30)}%` }} />
        <span className="h-2.5 animate-pulse rounded-sm bg-hover-overlay/70" style={{ width: `${52 + ((index * 23) % 34)}%` }} />
      </span>
      <span className="h-2.5 w-16 animate-pulse rounded-sm bg-hover-overlay" />
    </li>
  )
}

function RepoList({
  repos,
  loading,
  cloneUrl,
  benchByName,
  onSelect,
  onActivate
}: {
  repos: GitHubRepoSummary[]
  loading: boolean
  cloneUrl: string
  benchByName: Map<string, string>
  onSelect: (repo: GitHubRepoSummary) => void
  onActivate: () => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const t = useT().clone
  const locale = useLocale()

  const inputRef = useRef<HTMLInputElement>(null)
  const { counts: owners, lanes } = useMemo(() => rankOwners(repos), [repos])

  // The dialog opens on its method tab while the list loads; once there is
  // something to search, move straight to the search field.
  const hasRepos = repos.length > 0
  useEffect(() => {
    if (hasRepos && document.activeElement?.getAttribute('role') === 'tab') inputRef.current?.focus()
  }, [hasRepos])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return repos.filter((repo) => {
      if (owner && repo.owner !== owner) return false
      if (!needle) return true
      return (
        repo.fullName.toLowerCase().includes(needle) ||
        (repo.description ?? '').toLowerCase().includes(needle) ||
        (repo.language ?? '').toLowerCase() === needle
      )
    })
  }, [repos, query, owner])

  const selectedIndex = filtered.findIndex((repo) => repo.cloneUrl === cloneUrl)

  function moveSelection(delta: number): void {
    if (filtered.length === 0) return
    const next = selectedIndex < 0 ? (delta > 0 ? 0 : filtered.length - 1) : Math.min(filtered.length - 1, Math.max(0, selectedIndex + delta))
    const repo = filtered[next]
    onSelect(repo)
    listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveSelection(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveSelection(-1)
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      onActivate()
    }
  }

  const showOwners = owners.length > 1

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex shrink-0 items-center gap-3">
        <label className="field flex h-[36px] min-w-0 flex-1 items-center gap-2 py-0">
          <Search size={15} className="shrink-0 text-tertiary-text" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            placeholder={t.searchRepoPlaceholder}
            aria-label={t.searchRepo}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            disabled={loading && repos.length === 0}
            className="min-w-0 flex-1 bg-transparent text-body text-primary-text outline-none placeholder:text-tertiary-text"
          />
        </label>
        {repos.length > 0 && (
          <span className="shrink-0 text-caption tabular-nums text-tertiary-text">{t.repoCount(filtered.length)}</span>
        )}
      </div>

      {showOwners && (
        <div className="clone-owner-strip -mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label={t.ownerFilterAria}>
          <button type="button" aria-pressed={owner === null} onClick={() => setOwner(null)} className="clone-owner-chip">
            {t.allOwners}
            <span className="tabular-nums opacity-70">{repos.length}</span>
          </button>
          {owners.map(([name, count]) => (
            <button
              key={name}
              type="button"
              aria-pressed={owner === name}
              onClick={() => setOwner((current) => (current === name ? null : name))}
              className="clone-owner-chip"
              style={{ '--lane': `var(--graph-${lanes.get(name) ?? 0})` } as React.CSSProperties}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: 'var(--lane)' }} aria-hidden />
              {name}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      <ul
        ref={listRef}
        aria-label={t.listAria}
        aria-busy={loading}
        className="clone-list min-h-0 flex-1 overflow-y-auto rounded-md border border-default-border bg-midnight-base p-1"
      >
        {loading && repos.length === 0 && Array.from({ length: 7 }, (_, i) => <RepoRowSkeleton key={i} index={i} />)}

        {filtered.map((repo, index) => {
          const selected = repo.cloneUrl === cloneUrl
          const benchPath = benchByName.get(repo.name.toLowerCase())
          return (
            <li key={repo.fullName} style={{ '--i': Math.min(index, 14) } as React.CSSProperties} className="clone-row-enter">
              <button
                type="button"
                data-index={index}
                aria-pressed={selected}
                onClick={() => onSelect(repo)}
                onDoubleClick={onActivate}
                className={`list-row w-full gap-3 px-3 py-2 text-left ${selected ? 'is-selected' : ''}`}
              >
                <Monogram owner={repo.owner} lane={lanes.get(repo.owner)} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`truncate text-body font-medium ${selected ? 'text-command-blue' : 'text-primary-text'}`}>{repo.name}</span>
                    {repo.private && (
                      <Lock size={12} className="shrink-0 text-tertiary-text" aria-label={t.privateTitle}>
                        <title>{t.privateTitle}</title>
                      </Lock>
                    )}
                    {repo.fork && (
                      <GitFork size={12} className="shrink-0 text-tertiary-text" aria-label={t.forkTitle}>
                        <title>{t.forkTitle}</title>
                      </GitFork>
                    )}
                    {repo.archived && (
                      <span className="shrink-0 rounded-pill border border-warning-amber/30 px-1.5 text-label leading-4 text-warning-amber">{t.archived}</span>
                    )}
                    {benchPath && (
                      <span className="shrink-0 rounded-pill bg-success-green-soft px-1.5 text-label leading-4 text-success-green" title={t.onBenchTitle(benchPath)}>
                        {t.onBench}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-caption text-tertiary-text">
                    <span className="text-secondary-text">{repo.owner}</span>
                    {repo.description ? ` · ${repo.description}` : ''}
                  </span>
                </span>
                <span className="flex w-[7.5rem] shrink-0 flex-col items-end gap-0.5 text-caption">
                  {repo.language && (
                    <span className="flex max-w-full items-center gap-1.5 text-secondary-text">
                      <span className="size-2 shrink-0 rounded-full ring-1 ring-primary-text/15" style={{ background: LANGUAGE_COLORS[repo.language] ?? 'var(--color-tertiary-text)' }} aria-hidden />
                      <span className="truncate">{repo.language}</span>
                    </span>
                  )}
                  {repo.updatedAt && <span className="tabular-nums text-tertiary-text">{relativeTime(locale, repo.updatedAt)}</span>}
                </span>
              </button>
            </li>
          )
        })}

        {!loading && repos.length === 0 && <li className="px-3 py-10 text-center text-caption text-tertiary-text">{t.emptyAccount}</li>}
        {repos.length > 0 && filtered.length === 0 && <li className="px-3 py-10 text-center text-caption text-tertiary-text">{t.noMatch}</li>}
      </ul>
    </div>
  )
}

/**
 * The clone drawn as the trip it is: the remote's node (Attention Orange, the
 * remote lane's color everywhere else in the app) on the left, the folder on
 * this machine (Command Blue, the local lane) on the right, and a lane between
 * them that draws itself when both ends are known and fills while git works.
 */
function CloneRoute({
  sourceName,
  sourceSub,
  destName,
  destParent,
  state,
  percent
}: {
  sourceName: string | null
  sourceSub: string
  destName: string | null
  destParent: string
  state: 'idle' | 'ready' | 'cloning'
  percent: number
}): JSX.Element {
  const t = useT().clone
  return (
    <div className="flex min-w-0 items-center gap-3" role="group" aria-label={t.routeAria}>
      <div className="flex min-w-0 max-w-[40%] items-center gap-2.5">
        <span className={`clone-end grid size-9 shrink-0 place-items-center rounded-md ${sourceName ? 'is-remote' : ''}`} aria-hidden>
          <Github size={16} />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={`truncate text-body font-medium ${sourceName ? 'text-primary-text' : 'text-tertiary-text'}`}>{sourceName ?? t.routeSourceEmpty}</span>
          {sourceName && <span className="truncate text-caption text-tertiary-text">{sourceSub}</span>}
        </span>
      </div>

      <div
        key={`${state === 'idle' ? 'idle' : 'on'}:${sourceName}`}
        className="clone-lane relative h-7 min-w-14 flex-1"
        data-state={state}
        style={{ '--p': Math.max(0, Math.min(100, percent)) / 100 } as React.CSSProperties}
        aria-hidden
      >
        <span className="clone-lane-track" />
        <span className="clone-lane-fill" />
        <span className="clone-lane-node is-start" />
        <span className="clone-lane-node is-end" />
        {state === 'cloning' && <span className="clone-lane-head" />}
      </div>

      <div className="flex min-w-0 max-w-[40%] items-center gap-2.5">
        <span className={`clone-end grid size-9 shrink-0 place-items-center rounded-md ${destName ? 'is-local' : ''}`} aria-hidden>
          <HardDrive size={16} />
        </span>
        <span className="flex min-w-0 flex-col leading-tight" title={destName ? joinPath(destParent, destName) : undefined}>
          <span className={`truncate text-body font-medium ${destName ? 'text-primary-text' : 'text-tertiary-text'}`}>{destName ?? t.routeDestEmpty}</span>
          {destName && <span className="truncate text-caption text-tertiary-text">{destParent}</span>}
        </span>
      </div>
    </div>
  )
}

function ErrorNote({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="shrink-0 rounded-md border border-danger-red/30 bg-danger-red-soft px-3 py-2 text-caption text-danger-red">{children}</p>
}

/* ── Dialog ─────────────────────────────────────────────────────────────── */

function CloneModal({ open, onClose }: CloneModalProps): JSX.Element | null {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)
  const messages = useT()
  const t = messages.clone
  const fmt = useFormatters()

  const isBusy = useRepoStore((s) => s.isBusy)
  const error = useRepoStore((s) => s.error)
  const cloneRepository = useRepoStore((s) => s.cloneRepository)
  const cancelClone = useRepoStore((s) => s.cancelClone)
  const clearError = useRepoStore((s) => s.clearError)
  const recentRepos = useRepoStore((s) => s.recentRepos)

  const settings = useAppSettingsStore((s) => s.settings)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)

  const user = useGithubAuthStore((s) => s.user)
  const userHost = useGithubAuthStore((s) => s.userHost)
  const logout = useGithubAuthStore((s) => s.logout)

  const [cloneTab, setCloneTab] = useState<CloneTab>('github')
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloneDestination, setCloneDestination] = useState('')
  const [baseFolder, setBaseFolder] = useState('')
  const [appliedRepoName, setAppliedRepoName] = useState('')
  const [loginModalOpen, setLoginModalOpen] = useState(false)

  // Destination of the clone in flight — also the flag that puts the dialog in
  // its progress state, since isBusy is shared with every other store action.
  const [cloningPath, setCloningPath] = useState<string | null>(null)
  const isCloning = cloningPath !== null
  const { progress, stalledFor, reset: resetProgress } = useCloneProgress(cloningPath)

  // "GitHub" tab (OAuth — signed-in account, github.com only).
  const [oauthRepos, setOauthRepos] = useState<GitHubRepoSummary[]>([])
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [loadingOauthRepos, setLoadingOauthRepos] = useState(false)
  const signedIn = Boolean(user) && userHost?.toLowerCase() === 'github.com'

  // "Personal Token" tab (any host, manual token — independent account).
  const [tokenHost, setTokenHost] = useState('github.com')
  const [tokenValue, setTokenValue] = useState('')
  const [tokenRepos, setTokenRepos] = useState<GitHubRepoSummary[]>([])
  const [tokenLoadedHost, setTokenLoadedHost] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [loadingTokenRepos, setLoadingTokenRepos] = useState(false)

  useFocusTrap(panelRef, open, { onEscape: onClose, initialFocusRef: activeTabRef })

  const baseFolders = useMemo(
    () =>
      collectCloneBaseFolders(
        settings?.cloneBaseFolders ?? [],
        settings?.lastCloneBaseFolder ?? null,
        recentRepos.map((repo) => repo.path)
      ),
    [settings?.cloneBaseFolders, settings?.lastCloneBaseFolder, recentRepos]
  )

  // Repositories already on the bench, by folder name — a hint on matching rows.
  const benchByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const repo of recentRepos) map.set(basename(repo.path).toLowerCase(), repo.path)
    return map
  }, [recentRepos])

  useEffect(() => {
    if (!open) {
      clearError()
      setOauthError(null)
      setTokenError(null)
      return
    }
    const preferred = settings?.lastCloneBaseFolder || baseFolders[0] || ''
    if (!preferred) return
    setBaseFolder((current) => current || preferred)
    setCloneDestination((current) => current.trim() || preferred)
  }, [open, clearError, settings?.lastCloneBaseFolder, baseFolders])

  // Already authenticated via OAuth — load their repos automatically
  // instead of asking to "Continuar com GitHub" again.
  useEffect(() => {
    if (!open || cloneTab !== 'github' || !signedIn || loadingOauthRepos || oauthRepos.length > 0) return
    void loadOauthRepos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cloneTab, signedIn])

  async function loadReposFor(host: string): Promise<void> {
    setOauthError(null)
    setLoadingOauthRepos(true)
    try {
      // Uses the session main already holds for this host.
      setOauthRepos(await window.api.github.listUserRepos(host))
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingOauthRepos(false)
    }
  }

  async function loadOauthRepos(): Promise<void> {
    await loadReposFor('github.com')
  }

  async function handleLoginSuccess(_loggedInUser: GitHubUser, host: string): Promise<void> {
    setLoginModalOpen(false)
    await loadReposFor(host)
  }

  async function handleSwitchAccount(): Promise<void> {
    await logout('github.com')
    setOauthRepos([])
  }

  async function handleLoadTokenRepos(): Promise<void> {
    const host = tokenHost.trim() || 'github.com'
    setTokenError(null)
    setLoadingTokenRepos(true)
    try {
      // Deliberately an independent account: main uses this token for the
      // listing only and does not persist it.
      setTokenRepos(await window.api.github.listUserReposWithToken(host, tokenValue.trim()))
      setTokenLoadedHost(host)
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingTokenRepos(false)
    }
  }

  async function rememberBase(folder: string): Promise<void> {
    const next = rememberCloneBaseFolder(folder, settings?.cloneBaseFolders ?? [])
    await updateSettings(next)
  }

  function applyRepoName(repoName: string): void {
    if (!repoName) return
    setCloneDestination((dest) => destinationForRepo(dest, baseFolder, appliedRepoName, repoName))
    setAppliedRepoName(repoName)
  }

  function handleSelectRepo(repo: GitHubRepoSummary): void {
    setCloneUrl(repo.cloneUrl)
    applyRepoName(repo.name)
  }

  function handleCloneUrlChange(url: string): void {
    setCloneUrl(url)
    applyRepoName(repoNameFromCloneUrl(url))
  }

  function handleSelectBase(folder: string): void {
    setCloneDestination((dest) => destinationWithBase(dest, baseFolder, folder, appliedRepoName))
    setBaseFolder(folder)
    void rememberBase(folder)
  }

  async function handlePickCloneDestination(): Promise<void> {
    const path = await window.api.dialogs.openDirectory()
    if (!path) return
    const repoName = appliedRepoName || repoNameFromCloneUrl(cloneUrl)
    setBaseFolder(path)
    setCloneDestination(destinationWithBase(cloneDestination, baseFolder, path, repoName))
    await rememberBase(path)
  }

  function resolvedDestination(): string {
    const repoName = appliedRepoName || repoNameFromCloneUrl(cloneUrl)
    const destination = cloneDestination.trim()
    if (repoName && destination && pathsEqual(destination, baseFolder)) return joinPath(destination, repoName)
    return destination
  }

  const canClone = !isBusy && !isCloning && Boolean(cloneUrl.trim()) && Boolean(cloneDestination.trim())

  async function handleClone(): Promise<void> {
    if (!canClone) return
    const destination = resolvedDestination()
    const parent = dirname(destination)
    if (parent) await rememberBase(parent)

    setCloningPath(destination)
    try {
      const outcome = await cloneRepository(cloneUrl.trim(), destination)
      // The dialog now follows the clone to the end, so it closes itself on
      // success; cancel and failure leave it open with the reason visible.
      if (outcome === 'ok') onClose()
    } finally {
      setCloningPath(null)
      resetProgress()
    }
  }

  if (!open) return null

  // What the route shows: the chosen repo (from a list or a parsed URL) and
  // the folder it will land in.
  const listRepos = cloneTab === 'token' ? tokenRepos : oauthRepos
  const pickedRepo = listRepos.find((repo) => repo.cloneUrl === cloneUrl) ?? [...oauthRepos, ...tokenRepos].find((repo) => repo.cloneUrl === cloneUrl)
  const parsedUrl = parseRemoteUrl(cloneUrl)
  const sourceName = pickedRepo?.name ?? parsedUrl?.name ?? (cloneUrl.trim() ? repoNameFromCloneUrl(cloneUrl) || null : null)
  const sourceSub = pickedRepo
    ? `${pickedRepo.owner} · ${cloneTab === 'token' ? tokenLoadedHost || 'github.com' : 'github.com'}`
    : parsedUrl
      ? `${parsedUrl.owner} · ${parsedUrl.host}`
      : ''
  const finalDestination = cloneUrl.trim() ? resolvedDestination() : ''
  const destName = finalDestination ? basename(finalDestination) : null
  const destParent = finalDestination ? dirname(finalDestination) : ''
  const routeState: 'idle' | 'ready' | 'cloning' = isCloning ? 'cloning' : sourceName && destName ? 'ready' : 'idle'

  const tabs: { id: CloneTab; label: string; icon: JSX.Element }[] = [
    { id: 'github', label: 'GitHub', icon: <Github size={14} aria-hidden /> },
    { id: 'url', label: 'URL', icon: <Link2 size={14} aria-hidden /> },
    { id: 'token', label: 'Personal Token', icon: <KeyRound size={14} aria-hidden /> }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`clone-sheet flex ${cloneTab === 'url' || (cloneTab === 'token' && tokenRepos.length === 0 && !loadingTokenRepos) ? 'max-h-[calc(100vh-2rem)]' : 'h-[min(40rem,calc(100vh-2rem))]'} w-full max-w-[48rem] flex-col overflow-hidden rounded-lg border border-default-border bg-obsidian-panel shadow-floating`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: title, method switch and — on the GitHub tab — whose repos these are. */}
        <div className="flex shrink-0 flex-col gap-4 px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id={titleId} className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-primary-text">
                {t.title}
              </h2>
              <p id={descId} className="text-caption text-secondary-text">
                {t.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hit-area -mr-1.5 rounded-sm p-1.5 text-tertiary-text hover:bg-hover-overlay hover:text-primary-text"
              aria-label={messages.common.close}
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="clone-segmented" role="tablist" aria-label={t.methodAria}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  ref={cloneTab === tab.id ? activeTabRef : undefined}
                  type="button"
                  role="tab"
                  aria-selected={cloneTab === tab.id}
                  onClick={() => setCloneTab(tab.id)}
                  disabled={isCloning}
                  className="clone-segment"
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {cloneTab === 'github' && signedIn && user && (
              <div className="flex min-w-0 items-center gap-1 rounded-pill border border-default-border bg-midnight-base py-1 pr-1 pl-1">
                <img src={user.avatarUrl} alt="" className="size-6 shrink-0 rounded-full" />
                <span className="min-w-0 truncate pr-1 pl-1 text-caption text-secondary-text" title={user.name?.trim() || user.login}>
                  @{user.login}
                </span>
                <button
                  type="button"
                  onClick={() => void loadOauthRepos()}
                  disabled={loadingOauthRepos || isCloning}
                  className="hit-area grid size-6 shrink-0 place-items-center rounded-full text-tertiary-text hover:bg-hover-overlay hover:text-primary-text"
                  title={t.reloadRepos}
                  aria-label={t.reloadRepos}
                >
                  <RefreshCw size={13} className={loadingOauthRepos ? 'animate-spin' : undefined} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSwitchAccount()}
                  disabled={isCloning}
                  className="hit-area grid size-6 shrink-0 place-items-center rounded-full text-tertiary-text hover:bg-hover-overlay hover:text-primary-text"
                  title={t.switchAccount}
                  aria-label={t.switchAccount}
                >
                  <LogOut size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Source: where the repository comes from. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-4" role="tabpanel">
          {cloneTab === 'github' &&
            (signedIn && user ? (
              <>
                {oauthError && <ErrorNote>{oauthError}</ErrorNote>}
                <RepoList
                  repos={oauthRepos}
                  loading={loadingOauthRepos}
                  cloneUrl={cloneUrl}
                  benchByName={benchByName}
                  onSelect={handleSelectRepo}
                  onActivate={() => void handleClone()}
                />
              </>
            ) : (
              <div className="clone-invite flex flex-1 flex-col items-center justify-center gap-4 rounded-md border border-dashed border-default-border px-6 text-center">
                <span className="clone-end is-remote grid size-14 place-items-center rounded-lg" aria-hidden>
                  <Github size={26} />
                </span>
                <div className="flex max-w-sm flex-col gap-1">
                  <p className="text-title font-semibold text-primary-text">{t.signInTitle}</p>
                  <p className="text-caption text-secondary-text">{t.signInBody}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button onClick={() => setLoginModalOpen(true)} disabled={loadingOauthRepos} className="btn-primary">
                    <Github size={15} aria-hidden /> {t.continueGithub}
                  </button>
                  <button type="button" onClick={() => setCloneTab('url')} className="btn-ghost">
                    <Link2 size={14} aria-hidden /> URL
                  </button>
                </div>
                {oauthError && <ErrorNote>{oauthError}</ErrorNote>}
              </div>
            ))}

          {cloneTab === 'url' && (
            <div className="flex flex-col gap-3">
              <label className="field flex h-[44px] items-center gap-2.5 py-0">
                <Link2 size={16} className="shrink-0 text-tertiary-text" aria-hidden />
                <input
                  type="text"
                  placeholder={t.urlPlaceholder}
                  aria-label={t.urlAria}
                  value={cloneUrl}
                  onChange={(e) => handleCloneUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleClone()
                  }}
                  spellCheck={false}
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-primary-text outline-none placeholder:font-sans placeholder:text-body placeholder:text-tertiary-text"
                />
              </label>
              {parsedUrl ? (
                <div className="clone-row-enter flex items-center gap-3 rounded-md bg-hover-overlay px-3 py-2.5">
                  <Monogram owner={parsedUrl.owner} size={32} />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-body font-medium text-primary-text">{parsedUrl.name}</span>
                    <span className="truncate text-caption text-tertiary-text">
                      {parsedUrl.owner} · {parsedUrl.host}
                    </span>
                  </span>
                  <span className="shrink-0 text-caption text-success-green">{t.urlRecognized}</span>
                </div>
              ) : (
                <p className="text-caption text-tertiary-text">{t.urlHint}</p>
              )}
            </div>
          )}

          {cloneTab === 'token' && (
            <>
              <p className="shrink-0 text-caption text-secondary-text">{t.tokenHint}</p>
              <div className="flex min-w-0 shrink-0 items-center gap-2">
                <input
                  type="text"
                  placeholder={t.hostPlaceholder}
                  aria-label={t.hostAria}
                  value={tokenHost}
                  onChange={(e) => setTokenHost(e.target.value)}
                  className="field h-[34px] w-[13rem] min-w-0 shrink py-0"
                />
                <input
                  type="password"
                  placeholder="Personal Access Token"
                  aria-label={t.tokenAria}
                  value={tokenValue}
                  onChange={(e) => setTokenValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tokenValue.trim()) void handleLoadTokenRepos()
                  }}
                  className="field h-[34px] min-w-0 flex-1 py-0"
                />
                <button onClick={handleLoadTokenRepos} disabled={!tokenValue.trim() || loadingTokenRepos} className="btn-secondary shrink-0">
                  {loadingTokenRepos ? t.loading : t.load}
                </button>
              </div>
              {tokenError && <ErrorNote>{tokenError}</ErrorNote>}
              {(tokenRepos.length > 0 || loadingTokenRepos) && (
                <RepoList
                  repos={tokenRepos}
                  loading={loadingTokenRepos}
                  cloneUrl={cloneUrl}
                  benchByName={benchByName}
                  onSelect={handleSelectRepo}
                  onActivate={() => void handleClone()}
                />
              )}
            </>
          )}
        </div>

        {/* Route: from there to here, then the controls that make it happen. */}
        <div className="clone-dock flex shrink-0 flex-col gap-3.5 border-t border-default-border px-6 pt-4 pb-5">
          <CloneRoute
            sourceName={sourceName}
            sourceSub={sourceSub}
            destName={destName}
            destParent={destParent}
            state={routeState}
            percent={progress?.percent ?? 0}
          />

          {error && <ErrorNote>{error}</ErrorNote>}

          {isCloning ? (
            <div className="flex min-w-0 items-center gap-3" role="status" aria-live="polite">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-body text-primary-text">
                  {progress ? t.phase[progress.phase] : t.starting}
                  {progress && <span className="ml-2 tabular-nums font-medium text-command-blue">{progress.percent}%</span>}
                </p>
                {stalledFor >= STALL_AFTER_SECONDS ? (
                  <p className="truncate text-caption tabular-nums text-attention-orange">{t.stalled(stalledFor)}</p>
                ) : (
                  progress && (
                    <p className="truncate text-caption tabular-nums text-tertiary-text">
                      {fmt.number(progress.objects)}/{fmt.number(progress.totalObjects)} {t.objects}
                      {progress.transferred && ` · ${progress.transferred}`}
                      {progress.rate && ` · ${progress.rate}`}
                    </p>
                  )
                )}
                <span className="sr-only" role="progressbar" aria-label={t.progressAria} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.percent ?? 0} />
              </div>
              <button type="button" onClick={() => void cancelClone(cloningPath)} className="btn-secondary shrink-0">
                {t.cancelClone}
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <CloneDestinationField
                value={cloneDestination}
                baseFolders={baseFolders}
                selectedBase={baseFolder}
                onValueChange={setCloneDestination}
                onSelectBase={handleSelectBase}
                disabled={isCloning}
              />
              <button type="button" onClick={() => void handlePickCloneDestination()} className="btn-secondary shrink-0">
                {t.chooseFolder}
              </button>
              <button onClick={() => void handleClone()} disabled={!canClone} className="btn-primary shrink-0 px-5">
                <ArrowDownToLine size={15} aria-hidden />
                {t.clone}
              </button>
            </div>
          )}
        </div>
      </div>

      <GithubLoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} host="github.com" onSuccess={handleLoginSuccess} />
    </div>
  )
}

export default CloneModal
