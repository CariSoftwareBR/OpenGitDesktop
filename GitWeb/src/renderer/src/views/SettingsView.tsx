import { useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  HeartHandshake,
  Info,
  Languages,
  Monitor,
  Palette,
  Settings2,
  SlidersHorizontal,
  UploadCloud
} from 'lucide-react'
import Github from '../components/icons/Github'
import { useAppSettingsStore } from '../store/appSettingsStore'
import { useGithubAuthStore } from '../store/githubAuthStore'
import { useRepoStore } from '../store/repoStore'
import { usePullRequestStore } from '../store/pullRequestStore'
import { PROJECT_CO_AUTHOR_TRAILER, type ColorSchemePreference } from '../../../shared/settings'
import Switch from '../components/Switch'
import Combobox from '../components/Combobox'
import GithubLoginModal from '../components/GithubLoginModal'
import AiSettingsForm from '../components/AiSettingsForm'
import { AI_SETTINGS_SECTION_ID, useSettingsTabStore, type SettingsTab } from '../lib/openAiSettings'
import { NARROW_LAYOUT_QUERY, useMediaQuery } from '../lib/useMediaQuery'
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
  onChange,
  children
}: {
  icon: typeof UploadCloud
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Extra detail under the description. */
  children?: React.ReactNode
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
        {children}
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabelledBy={labelId} />
    </div>
  )
}

function SettingsCard({
  icon: Icon,
  label,
  description,
  children
}: {
  icon: typeof UploadCloud
  label: string
  description: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-default-border bg-obsidian-panel p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
        <Icon size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-title font-semibold text-primary-text">{label}</div>
        <p className="mt-0.5 text-caption text-secondary-text">{description}</p>
      </div>
      {children}
    </div>
  )
}

function GeneralPanel(): JSX.Element {
  const settings = useAppSettingsStore((s) => s.settings)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)
  const setView = useRepoStore((s) => s.setView)
  const t = useT().settings

  return (
    <>
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
        <SettingRow
          icon={HeartHandshake}
          label={t.commit.coAuthor}
          description={t.commit.coAuthorHint}
          checked={settings?.coAuthorProject ?? false}
          onChange={(checked) => updateSettings({ coAuthorProject: checked })}
        >
          {/* The exact trailer, so nobody has to guess what goes into their commits. */}
          <p className="mt-2 text-label font-normal text-tertiary-text">{t.commit.coAuthorPreview}</p>
          <code
            className={`mt-1 block truncate rounded-md border border-default-border bg-midnight-base px-2.5 py-1.5 font-mono text-caption transition-opacity duration-200 ${
              (settings?.coAuthorProject ?? false) ? 'text-primary-text' : 'text-tertiary-text line-through opacity-60'
            }`}
            title={PROJECT_CO_AUTHOR_TRAILER}
          >
            {PROJECT_CO_AUTHOR_TRAILER}
          </code>
        </SettingRow>
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
    </>
  )
}

function AppearancePanel(): JSX.Element {
  const settings = useAppSettingsStore((s) => s.settings)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)
  const t = useT().settings.appearance

  const colorSchemeOptions: { value: ColorSchemePreference; label: string }[] = [
    { value: 'system', label: t.themeSystem },
    { value: 'dark', label: t.themeDark },
    { value: 'light', label: t.themeLight }
  ]
  const languageOptions: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: t.languageSystem },
    ...SUPPORTED_LOCALES.map((locale) => ({ value: locale, label: LOCALE_NATIVE_NAMES[locale] }))
  ]

  return (
    <section className="flex flex-col gap-2">
      <SettingsCard icon={Languages} label={t.language} description={t.languageHint}>
        <Combobox
          value={settings?.language ?? 'system'}
          onChange={(v) => updateSettings({ language: v as LanguagePreference })}
          options={languageOptions}
          ariaLabel={t.language}
          placeholder={t.language}
          className="w-44 shrink-0"
        />
      </SettingsCard>
      <SettingsCard icon={Monitor} label={t.theme} description={t.themeHint}>
        <Combobox
          value={settings?.colorScheme ?? 'system'}
          onChange={(v) => updateSettings({ colorScheme: v as ColorSchemePreference })}
          options={colorSchemeOptions}
          ariaLabel={t.theme}
          placeholder={t.theme}
          className="w-36 shrink-0"
        />
      </SettingsCard>
    </section>
  )
}

const TABS: { id: SettingsTab; icon: typeof UploadCloud }[] = [
  { id: 'general', icon: SlidersHorizontal },
  { id: 'ai', icon: Bot },
  { id: 'appearance', icon: Palette }
]

function SettingsView(): JSX.Element {
  const loadSettings = useAppSettingsStore((s) => s.loadSettings)
  const setView = useRepoStore((s) => s.setView)
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const tab = useSettingsTabStore((s) => s.tab)
  const setTab = useSettingsTabStore((s) => s.setTab)
  const narrow = useMediaQuery(NARROW_LAYOUT_QUERY)
  const baseId = useId()
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({})
  const t = useT().settings

  // `hint` is the short line under each tab; `description` heads the panel.
  const tabText: Record<SettingsTab, { label: string; hint: string; description: string }> = {
    general: { label: t.tabs.general, hint: t.tabs.generalHint, description: t.tabs.generalHint },
    ai: { label: t.tabs.ai, hint: t.tabs.aiHint, description: t.ai.hint },
    appearance: { label: t.tabs.appearance, hint: t.tabs.appearanceHint, description: t.tabs.appearanceHint }
  }

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Arrow keys move between tabs and select them (automatic activation);
  // Home/End jump to the ends.
  function handleTabKeyDown(e: React.KeyboardEvent): void {
    const prev = narrow ? 'ArrowLeft' : 'ArrowUp'
    const next = narrow ? 'ArrowRight' : 'ArrowDown'
    const index = TABS.findIndex((x) => x.id === tab)
    let target: number | null = null
    if (e.key === prev) target = (index - 1 + TABS.length) % TABS.length
    else if (e.key === next) target = (index + 1) % TABS.length
    else if (e.key === 'Home') target = 0
    else if (e.key === 'End') target = TABS.length - 1
    if (target === null) return
    e.preventDefault()
    const id = TABS[target].id
    setTab(id)
    tabRefs.current[id]?.focus()
  }

  const tabId = (id: SettingsTab): string => `${baseId}-tab-${id}`
  const panelId = `${baseId}-panel`

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-8 py-10">
        <h1 className="flex items-center gap-2 text-headline font-semibold text-primary-text">
          {!currentRepoPath && (
            <button type="button" onClick={() => setView('changes')} className="btn-ghost -ml-2 px-2" title={t.backToStart} aria-label={t.backToStart}>
              <ArrowLeft size={17} aria-hidden />
            </button>
          )}
          <Settings2 size={20} aria-hidden /> {t.title}
        </h1>

        {/* Tabs on the left with the panel beside them, so the page uses the
            window's width instead of one long column; a top strip when narrow. */}
        <div className={narrow ? 'flex flex-col gap-6' : 'grid grid-cols-[232px_minmax(0,1fr)] items-start gap-10'}>
          <div
            role="tablist"
            aria-label={t.tabs.label}
            aria-orientation={narrow ? 'horizontal' : 'vertical'}
            onKeyDown={handleTabKeyDown}
            className={narrow ? 'flex gap-1 overflow-x-auto border-b border-default-border' : 'sticky top-0 flex flex-col gap-1'}
          >
            {TABS.map(({ id, icon: Icon }) => {
              const selected = tab === id
              const tabProps = {
                ref: (el: HTMLButtonElement | null) => {
                  tabRefs.current[id] = el
                },
                id: tabId(id),
                type: 'button' as const,
                role: 'tab',
                'aria-selected': selected,
                'aria-controls': panelId,
                tabIndex: selected ? 0 : -1,
                onClick: () => setTab(id)
              }
              return narrow ? (
                <button
                  key={id}
                  {...tabProps}
                  aria-current={selected ? 'page' : undefined}
                  className={`tab-indicator flex shrink-0 items-center gap-2 px-3 py-2.5 text-body transition-colors duration-100 ${
                    selected ? 'font-medium text-primary-text' : 'text-secondary-text hover:text-primary-text'
                  }`}
                >
                  <Icon size={15} aria-hidden />
                  {tabText[id].label}
                </button>
              ) : (
                <button key={id} {...tabProps} className={`list-row w-full gap-3 py-2.5 pl-3 text-left ${selected ? 'is-selected' : ''}`}>
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${
                      selected
                        ? 'border-command-blue/30 bg-command-blue-soft text-command-blue'
                        : 'border-default-border bg-coal-raised text-secondary-text'
                    }`}
                  >
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className={`text-body font-medium ${selected ? 'text-primary-text' : 'text-secondary-text'}`}>
                      {tabText[id].label}
                    </span>
                    <span className="truncate text-caption text-tertiary-text">{tabText[id].hint}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Remounted per tab so .view-enter replays its entrance. */}
          <div
            key={tab}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId(tab)}
            className="view-enter flex min-w-0 max-w-2xl flex-col gap-6"
          >
            <header className="flex flex-col gap-1">
              <h2 className="text-title font-semibold text-primary-text">{tabText[tab].label}</h2>
              <p className="text-caption text-secondary-text">{tabText[tab].description}</p>
            </header>

            {tab === 'general' && <GeneralPanel />}
            {tab === 'ai' && (
              <section id={AI_SETTINGS_SECTION_ID}>
                <AiSettingsForm />
              </section>
            )}
            {tab === 'appearance' && <AppearancePanel />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsView
