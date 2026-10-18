import { useEffect, useId, useState } from 'react'
import { ArrowLeft, ChevronRight, Info, Monitor, Settings2, UploadCloud } from 'lucide-react'
import Github from '../components/icons/Github'
import { useAppSettingsStore } from '../store/appSettingsStore'
import { useGithubAuthStore } from '../store/githubAuthStore'
import { useRepoStore } from '../store/repoStore'
import { usePullRequestStore } from '../store/pullRequestStore'
import type { ColorSchemePreference } from '../../../shared/settings'
import Switch from '../components/Switch'
import Combobox from '../components/Combobox'
import GithubLoginModal from '../components/GithubLoginModal'
import AiSettingsForm from '../components/AiSettingsForm'
import { AI_SETTINGS_SECTION_ID } from '../lib/openAiSettings'

const GITHUB_HOST = 'github.com'

const COLOR_SCHEME_OPTIONS: { value: ColorSchemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'dark', label: 'Escuro' },
  { value: 'light', label: 'Claro' }
]

function GithubAccountSection(): JSX.Element {
  const user = useGithubAuthStore((s) => s.user)
  const userLoading = useGithubAuthStore((s) => s.userLoading)
  const logout = useGithubAuthStore((s) => s.logout)
  const loadCurrentUser = useGithubAuthStore((s) => s.loadCurrentUser)
  const setCurrentUser = useGithubAuthStore((s) => s.setCurrentUser)
  const resetPullRequests = usePullRequestStore((s) => s.reset)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [revokeUrl, setRevokeUrl] = useState<string | null>(null)
  const [showRevokeHint, setShowRevokeHint] = useState(false)

  useEffect(() => {
    void loadCurrentUser(GITHUB_HOST)
    void window.api.github.getOAuthAppInfo().then((info) => setRevokeUrl(info.revokeUrl))
  }, [loadCurrentUser])

  async function handleLogout(): Promise<void> {
    await logout(GITHUB_HOST)
    // The PR view caches its own session for the current remote's host.
    resetPullRequests()
    // Deleting the local token does not revoke the authorization on GitHub —
    // revoking needs a client secret, which a public Device Flow client can't
    // have. Point the user at the page where they can do it themselves.
    setShowRevokeHint(true)
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label uppercase tracking-wide text-tertiary-text">GitHub</h2>
      <div className="flex flex-col gap-3 rounded-lg border border-default-border bg-obsidian-panel p-4">
        {user ? (
          <div className="flex items-center gap-3">
            <img src={user.avatarUrl} alt={user.login} className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1">
              <div className="text-title font-semibold text-primary-text">{user.name ?? user.login}</div>
              <p className="text-caption text-secondary-text">@{user.login}</p>
            </div>
            <button onClick={handleLogout} className="btn-secondary shrink-0">
              Sair
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
              <Github size={17} />
            </span>
            <div className="flex-1">
              <div className="text-title font-semibold text-primary-text">Conta do GitHub</div>
              <p className="mt-0.5 text-caption text-secondary-text">
                {userLoading
                  ? 'Verificando sessão…'
                  : 'Entre para listar e gerenciar Pull Requests dos seus repositórios.'}
              </p>
            </div>
            {!userLoading && (
              <button onClick={() => setLoginModalOpen(true)} className="btn-secondary shrink-0">
                Entrar com GitHub
              </button>
            )}
          </div>
        )}

        {showRevokeHint && !user && revokeUrl && (
          <p className="rounded-md border border-default-border bg-coal-raised px-3 py-2.5 text-caption text-secondary-text">
            O token foi apagado desta máquina. A autorização do GitWeb continua ativa na sua conta do GitHub — para
            removê-la de vez,{' '}
            <a href={revokeUrl} target="_blank" rel="noreferrer" className="text-command-blue underline hover:opacity-80">
              revogue o acesso do aplicativo no GitHub
            </a>
            .
          </p>
        )}
      </div>

      <GithubLoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        host={GITHUB_HOST}
        onSuccess={(loggedInUser) => {
          setCurrentUser(loggedInUser, GITHUB_HOST)
          setLoginModalOpen(false)
        }}
      />
    </section>
  )
}

function SettingRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange
}: {
  icon: typeof UploadCloud
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  const labelId = useId()
  return (
    <div className="flex items-center gap-3 rounded-lg border border-default-border bg-obsidian-panel p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div id={labelId} className="text-title font-semibold text-primary-text">
          {label}
        </div>
        <p className="mt-0.5 text-caption text-secondary-text">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabelledBy={labelId} />
    </div>
  )
}

function SettingsView(): JSX.Element {
  const settings = useAppSettingsStore((s) => s.settings)
  const loadSettings = useAppSettingsStore((s) => s.loadSettings)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)
  const setView = useRepoStore((s) => s.setView)
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-10">
      <h1 className="flex items-center gap-2 text-headline font-semibold text-primary-text">
        {!currentRepoPath && (
          <button type="button" onClick={() => setView('changes')} className="btn-ghost -ml-2 px-2" title="Voltar à tela inicial" aria-label="Voltar à tela inicial">
            <ArrowLeft size={17} aria-hidden />
          </button>
        )}
        <Settings2 size={20} aria-hidden /> Configurações
      </h1>

      <GithubAccountSection />

      <section className="flex flex-col gap-2">
        <h2 className="text-label uppercase tracking-wide text-tertiary-text">Commit</h2>
        <SettingRow
          icon={UploadCloud}
          label="Enviar (push) automaticamente após o commit"
          description='Ao commitar, envia as alterações para o remoto em seguida, sem precisar clicar em "Push" separadamente.'
          checked={settings?.commitAndPush ?? false}
          onChange={(checked) => updateSettings({ commitAndPush: checked })}
        />
      </section>

      <section id={AI_SETTINGS_SECTION_ID} className="flex flex-col gap-2">
        <h2 className="text-label uppercase tracking-wide text-tertiary-text">IA</h2>
        <p className="text-caption text-secondary-text">
          Provedor, chave e modelo do assistente supervisionado.
        </p>
        <AiSettingsForm />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label uppercase tracking-wide text-tertiary-text">Aparência</h2>
        <div className="flex items-center gap-3 rounded-lg border border-default-border bg-obsidian-panel p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
            <Monitor size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-title font-semibold text-primary-text">Tema</div>
            <p className="mt-0.5 text-caption text-secondary-text">
              Sistema segue o SO; contraste alto do sistema ativa as variantes HC automaticamente.
            </p>
          </div>
          <Combobox
            value={settings?.colorScheme ?? 'system'}
            onChange={(v) => updateSettings({ colorScheme: v as ColorSchemePreference })}
            options={COLOR_SCHEME_OPTIONS}
            ariaLabel="Tema"
            placeholder="Tema"
            className="w-36 shrink-0"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label uppercase tracking-wide text-tertiary-text">Aplicativo</h2>
        <button
          type="button"
          onClick={() => setView('about')}
          className="flex items-start gap-3 rounded-lg border border-default-border bg-obsidian-panel p-4 text-left transition-[background-color,border-color,transform] duration-150 hover:border-primary-text/25 hover:bg-hover-overlay active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
            <Info size={17} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-title font-semibold text-primary-text">Sobre o GitWeb</span>
            <span className="text-caption text-secondary-text">Nome, versão e data da build.</span>
          </span>
          <ChevronRight size={16} className="mt-1.5 shrink-0 text-tertiary-text" />
        </button>
      </section>
      </div>
    </div>
  )
}

export default SettingsView
