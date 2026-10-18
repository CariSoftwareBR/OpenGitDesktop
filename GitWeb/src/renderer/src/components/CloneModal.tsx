import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { KeyRound, Link2, LogOut, RefreshCw, X } from 'lucide-react'
import Github from './icons/Github'
import { useRepoStore } from '../store/repoStore'
import { useGithubAuthStore } from '../store/githubAuthStore'
import { useAppSettingsStore } from '../store/appSettingsStore'
import type { GitHubRepoSummary, GitHubUser } from '../lib/github'
import { useFocusTrap } from '../lib/useFocusTrap'
import { dirname, joinPath, pathsEqual } from '../lib/path'
import {
  collectCloneBaseFolders,
  destinationForRepo,
  destinationWithBase,
  rememberCloneBaseFolder,
  repoNameFromCloneUrl
} from '../lib/cloneDestination'
import GithubLoginModal from './GithubLoginModal'
import CloneDestinationField from './CloneDestinationField'
import ProgressBar from './ProgressBar'
import { clonePhaseLabel, useCloneProgress } from '../lib/useCloneProgress'

type CloneTab = 'github' | 'url' | 'token'

interface CloneModalProps {
  open: boolean
  onClose: () => void
}

const TAB_BUTTON_ACTIVE = 'flex items-center gap-1.5 rounded-md bg-active-overlay px-3 py-1.5 text-caption font-medium text-command-blue'
const TAB_BUTTON = 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-caption text-secondary-text hover:bg-hover-overlay'

function RepoList({
  repos,
  cloneUrl,
  onSelect
}: {
  repos: GitHubRepoSummary[]
  cloneUrl: string
  onSelect: (repo: GitHubRepoSummary) => void
}): JSX.Element | null {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return repos
    return repos.filter((repo) => repo.fullName.toLowerCase().includes(needle))
  }, [repos, query])

  if (repos.length === 0) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input
        type="search"
        placeholder="Buscar repositório…"
        aria-label="Buscar repositório"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="field shrink-0"
      />
      <ul className="min-h-0 flex-1 overflow-y-auto rounded-md border border-default-border">
        {filtered.map((repo) => (
          <li key={repo.fullName}>
            <button
              onClick={() => onSelect(repo)}
              className={
                cloneUrl === repo.cloneUrl
                  ? 'flex w-full items-center justify-between bg-active-overlay px-3 py-2 text-left text-caption text-command-blue'
                  : 'flex w-full items-center justify-between px-3 py-2 text-left text-caption text-primary-text hover:bg-hover-overlay'
              }
            >
              {repo.fullName}
              {repo.private && <span className="rounded-pill border border-default-border px-2 py-0.5 text-label text-tertiary-text">privado</span>}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-center text-caption text-tertiary-text">Nenhum repositório corresponde à busca.</li>
        )}
      </ul>
    </div>
  )
}

/** Git emits progress continuously; this much silence means something is wrong. */
const STALL_AFTER_SECONDS = 10

function CloneModal({ open, onClose }: CloneModalProps): JSX.Element | null {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

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
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [loadingTokenRepos, setLoadingTokenRepos] = useState(false)

  useFocusTrap(panelRef, open, { onEscape: onClose })

  const baseFolders = useMemo(
    () =>
      collectCloneBaseFolders(
        settings?.cloneBaseFolders ?? [],
        settings?.lastCloneBaseFolder ?? null,
        recentRepos.map((repo) => repo.path)
      ),
    [settings?.cloneBaseFolders, settings?.lastCloneBaseFolder, recentRepos]
  )

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

  async function handleClone(): Promise<void> {
    if (!cloneUrl.trim() || !cloneDestination.trim()) return
    const repoName = appliedRepoName || repoNameFromCloneUrl(cloneUrl)
    let destination = cloneDestination.trim()
    if (repoName && pathsEqual(destination, baseFolder)) {
      destination = joinPath(destination, repoName)
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[min(34rem,calc(100vh-2rem))] w-full max-w-xl flex-col gap-3 overflow-hidden rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 id={titleId} className="text-title font-semibold text-primary-text">
            Clonar repositório
          </h2>
          <button type="button" onClick={onClose} className="hit-area rounded-sm p-1 text-tertiary-text hover:bg-hover-overlay" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="flex shrink-0 gap-1" role="tablist" aria-label="Método de clone">
          <button
            type="button"
            role="tab"
            aria-selected={cloneTab === 'github'}
            onClick={() => setCloneTab('github')}
            className={cloneTab === 'github' ? TAB_BUTTON_ACTIVE : TAB_BUTTON}
          >
            <Github size={14} aria-hidden /> GitHub
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cloneTab === 'url'}
            onClick={() => setCloneTab('url')}
            className={cloneTab === 'url' ? TAB_BUTTON_ACTIVE : TAB_BUTTON}
          >
            <Link2 size={14} aria-hidden /> URL
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cloneTab === 'token'}
            onClick={() => setCloneTab('token')}
            className={cloneTab === 'token' ? TAB_BUTTON_ACTIVE : TAB_BUTTON}
          >
            <KeyRound size={14} aria-hidden /> Personal Token
          </button>
        </div>

        {cloneTab === 'github' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3" role="tabpanel">
            {signedIn && user ? (
              <div className="flex shrink-0 items-center gap-3 rounded-md border border-default-border bg-coal-raised px-3 py-2.5">
                <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-default-border" />
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-body font-medium text-primary-text">{user.name?.trim() || user.login}</span>
                  <span className="truncate text-caption text-tertiary-text">@{user.login}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void loadOauthRepos()}
                  disabled={loadingOauthRepos}
                  className="btn-ghost shrink-0 border border-default-border px-2"
                  title="Recarregar repositórios"
                  aria-label="Recarregar repositórios"
                >
                  <RefreshCw size={14} className={loadingOauthRepos ? 'animate-spin' : undefined} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSwitchAccount()}
                  className="btn-ghost shrink-0 border border-default-border px-2"
                  title="Trocar conta"
                  aria-label="Trocar conta"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLoginModalOpen(true)}
                disabled={loadingOauthRepos}
                className="btn-primary flex shrink-0 items-center justify-center gap-2"
              >
                <Github size={16} /> Continuar com GitHub
              </button>
            )}

            {oauthError && (
              <p className="shrink-0 rounded-md border border-danger-red/30 bg-danger-red-soft px-3 py-2 text-caption text-danger-red">{oauthError}</p>
            )}
            <RepoList repos={oauthRepos} cloneUrl={cloneUrl} onSelect={handleSelectRepo} />
          </div>
        )}

        {cloneTab === 'url' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3" role="tabpanel">
            <input
              type="text"
              placeholder="URL do repositório (https://…)"
              aria-label="URL do repositório"
              value={cloneUrl}
              onChange={(e) => handleCloneUrlChange(e.target.value)}
              className="field shrink-0"
            />
          </div>
        )}

        {cloneTab === 'token' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3" role="tabpanel">
            <p className="shrink-0 text-caption text-secondary-text">Para github.com ou uma instância GitHub Enterprise, com uma conta independente do login acima.</p>
            <div className="flex min-w-0 shrink-0 flex-col gap-2">
              <input
                type="text"
                placeholder="github.com ou host da Enterprise"
                aria-label="Host do GitHub"
                value={tokenHost}
                onChange={(e) => setTokenHost(e.target.value)}
                className="field min-w-0"
              />
              <div className="flex min-w-0 items-center gap-2">
                <input
                  type="password"
                  placeholder="Personal Access Token"
                  aria-label="Personal Access Token do GitHub"
                  value={tokenValue}
                  onChange={(e) => setTokenValue(e.target.value)}
                  className="field h-[34px] min-w-0 flex-1 py-0"
                />
                <button onClick={handleLoadTokenRepos} disabled={!tokenValue.trim() || loadingTokenRepos} className="btn-secondary shrink-0">
                  {loadingTokenRepos ? 'Carregando…' : 'Carregar'}
                </button>
              </div>
            </div>
            {tokenError && (
              <p className="shrink-0 rounded-md border border-danger-red/30 bg-danger-red-soft px-3 py-2 text-caption text-danger-red">{tokenError}</p>
            )}
            <RepoList repos={tokenRepos} cloneUrl={cloneUrl} onSelect={handleSelectRepo} />
          </div>
        )}

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <CloneDestinationField
            value={cloneDestination}
            baseFolders={baseFolders}
            selectedBase={baseFolder}
            onValueChange={setCloneDestination}
            onSelectBase={handleSelectBase}
            disabled={isCloning}
          />
          <button
            type="button"
            onClick={() => void handlePickCloneDestination()}
            disabled={isCloning}
            className="btn-secondary shrink-0"
          >
            Escolher pasta…
          </button>
        </div>

        {error && <p className="shrink-0 rounded-md border border-danger-red/30 bg-danger-red-soft px-3 py-2 text-caption text-danger-red">{error}</p>}

        {isCloning && (
          <div className="shrink-0 space-y-1.5" role="status" aria-live="polite">
            <p className="text-caption text-secondary-text">
              {progress ? clonePhaseLabel(progress.phase) : 'Iniciando…'}
              {progress && <span className="ml-1.5 tabular-nums text-tertiary-text">{progress.percent}%</span>}
            </p>
            <ProgressBar percent={progress?.percent ?? 0} label="Progresso do clone" />
            {stalledFor >= STALL_AFTER_SECONDS ? (
              <p className="text-caption tabular-nums text-attention-orange">
                Sem resposta há {stalledFor}s — a conexão pode ter travado.
              </p>
            ) : (
              progress && (
                <p className="text-caption tabular-nums text-tertiary-text">
                  {progress.objects.toLocaleString('pt-BR')}/{progress.totalObjects.toLocaleString('pt-BR')} objetos
                  {progress.transferred && ` · ${progress.transferred}`}
                  {progress.rate && ` · ${progress.rate}`}
                </p>
              )
            )}
          </div>
        )}

        {isCloning ? (
          <button
            type="button"
            onClick={() => void cancelClone(cloningPath)}
            className="btn-secondary shrink-0"
          >
            Cancelar clone
          </button>
        ) : (
          <button
            onClick={handleClone}
            disabled={isBusy || !cloneUrl.trim() || !cloneDestination.trim()}
            className="btn-primary shrink-0"
          >
            Clonar
          </button>
        )}
      </div>

      <GithubLoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} host="github.com" onSuccess={handleLoginSuccess} />
    </div>
  )
}

export default CloneModal
