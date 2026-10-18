import { useEffect, useId, useState } from 'react'
import { ArrowLeft, ChevronRight, Info, Languages, Monitor, Settings2, UploadCloud } from 'lucide-react'
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
import { useT } from '../lib/i18n'
import { LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES, type LanguagePreference } from '../../../shared/i18n/locales'

const GITHUB_HOST = 'github.com'

function GithubAccountSection(): JSX.Element {
  const t = useT().settings.github
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
              {t.signOut}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
              <Github size={17} />
            </span>
            <div className="flex-1">
              <div className="text-title font-semibold text-primary-text">{t.account}</div>
              <p className="mt-0.5 text-caption text-secondary-text">
                {userLoading ? t.checkingSession : t.signInHint}
              </p>
            </div>
            {!userLoading && (
              <button onClick={() => setLoginModalOpen(true)} className="btn-secondary shrink-0">
                {t.signIn}
              </button>
            )}
          </div>
        )}

        {showRevokeHint && !user && revokeUrl && (
          <p className="rounded-md border border-default-border bg-coal-raised px-3 py-2.5 text-caption text-secondary-text">
            {t.revokeHintBefore}
            <a href={revokeUrl} target="_blank" rel="noreferrer" className="text-command-blue underline hover:opacity-80">
              {t.revokeHintLink}
            </a>
            {t.revokeHintAfter}
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
  const t = useT().settings

  const colorSchemeOptions: { value: ColorSchemePreference; label: string }[] = [
    { value: 'system', label: t.appearance.themeSystem },
    { value: 'dark', label: t.appearance.themeDark },
    { value: 'light', label: t.appearance.themeLight }
  ]
  const languageOptions: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: t.appearance.languageSystem },
    ...SUPPORTED_LOCALES.map((locale) => ({ value: locale, label: LOCALE_NATIVE_NAMES[locale] }))
  ]

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-10">
      <h1 className="flex items-center gap-2 text-headline font-semibold text-primary-text">
        {!currentRepoPath && (
          <button type="button" onClick={() => setView('changes')} className="btn-ghost -ml-2 px-2" title={t.backToStart} aria-label={t.backToStart}>
            <ArrowLeft size={17} aria-hidden />
          </button>
        )}
        <Settings2 size={20} aria-hidden /> {t.title}
      </h1>

      <GithubAccountSection />

      <section className="flex flex-col gap-2">
        <h2 className="text-label uppercase tracking-wide text-tertiary-text">{t.commit.heading}</h2>
        <SettingRow
          icon={UploadCloud}
          label={t.commit.autoPush}
          description={t.commit.autoPushHint}
          checked={settings?.commitAndPush ?? false}
          onChange={(checked) => updateSettings({ commitAndPush: checked })}
        />
      </section>

      <section id={AI_SETTINGS_SECTION_ID} className="flex flex-col gap-2">
        <h2 className="text-label uppercase tracking-wide text-tertiary-text">{t.ai.heading}</h2>
        <p className="text-caption text-secondary-text">{t.ai.hint}</p>
        <AiSettingsForm />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label uppercase tracking-wide text-tertiary-text">{t.appearance.heading}</h2>
        <div className="flex items-center gap-3 rounded-lg border border-default-border bg-obsidian-panel p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
            <Languages size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-title font-semibold text-primary-text">{t.appearance.language}</div>
            <p className="mt-0.5 text-caption text-secondary-text">{t.appearance.languageHint}</p>
          </div>
          <Combobox
            value={settings?.language ?? 'system'}
            onChange={(v) => updateSettings({ language: v as LanguagePreference })}
            options={languageOptions}
            ariaLabel={t.appearance.language}
            placeholder={t.appearance.language}
            className="w-44 shrink-0"
          />
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-default-border bg-obsidian-panel p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
            <Monitor size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-title font-semibold text-primary-text">{t.appearance.theme}</div>
            <p className="mt-0.5 text-caption text-secondary-text">{t.appearance.themeHint}</p>
          </div>
          <Combobox
            value={settings?.colorScheme ?? 'system'}
            onChange={(v) => updateSettings({ colorScheme: v as ColorSchemePreference })}
            options={colorSchemeOptions}
            ariaLabel={t.appearance.theme}
            placeholder={t.appearance.theme}
            className="w-36 shrink-0"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label uppercase tracking-wide text-tertiary-text">{t.app.heading}</h2>
        <button
          type="button"
          onClick={() => setView('about')}
          className="flex items-start gap-3 rounded-lg border border-default-border bg-obsidian-panel p-4 text-left transition-[background-color,border-color,transform] duration-150 hover:border-primary-text/25 hover:bg-hover-overlay active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
            <Info size={17} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-title font-semibold text-primary-text">{t.app.about}</span>
            <span className="text-caption text-secondary-text">{t.app.aboutHint}</span>
          </span>
          <ChevronRight size={16} className="mt-1.5 shrink-0 text-tertiary-text" />
        </button>
      </section>
      </div>
    </div>
  )
}

export default SettingsView
