import { useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  Check,
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
import GithubLoginModal from '../components/GithubLoginModal'
import AiSettingsForm from '../components/AiSettingsForm'
import { AI_SETTINGS_SECTION_ID, useSettingsTabStore, type SettingsTab } from '../lib/openAiSettings'
import { NARROW_LAYOUT_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import { useT } from '../lib/i18n'
import { LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES, type LanguagePreference } from '../../../shared/i18n/locales'

const GITHUB_HOST = 'github.com'

function GithubAccountSection(): JSX.Element {
  const tAll = useT().settings
  const t = tAll.github
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
    <section className="flex flex-col gap-2.5">
      <h2 className="settings-heading">GitHub</h2>
      <div className="settings-group">
        {user ? (
          <div className="flex items-center gap-4 px-4 py-4">
            <span className="relative shrink-0">
              <img src={user.avatarUrl} alt="" className="size-11 rounded-full shadow-[0_0_0_2px_var(--color-obsidian-panel),0_0_0_3.5px_var(--color-success-green)]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-title font-semibold text-primary-text">{user.name ?? user.login}</div>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-secondary-text">
                <span className="truncate">@{user.login}</span>
                <span aria-hidden>·</span>
                <span className="flex shrink-0 items-center gap-1 text-success-green">
                  <span className="size-1.5 rounded-full bg-success-green" aria-hidden />
                  {tAll.connectedTo(GITHUB_HOST)}
                </span>
              </p>
            </div>
            <button onClick={handleLogout} className="btn-secondary shrink-0">
              {t.signOut}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 px-4 py-4">
            <span className="settings-icon is-neutral size-11 rounded-full">
              <Github size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-title font-semibold text-primary-text">{t.account}</div>
              <p className="mt-0.5 text-caption text-secondary-text">{userLoading ? t.checkingSession : t.signInHint}</p>
            </div>
            {!userLoading && (
              <button onClick={() => setLoginModalOpen(true)} className="btn-primary shrink-0">
                <Github size={15} aria-hidden /> {t.signIn}
              </button>
            )}
          </div>
        )}

        {showRevokeHint && !user && revokeUrl && (
          <p className="settings-row text-caption text-secondary-text">
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
  tone = 'neutral',
  label,
  description,
  checked,
  onChange,
  children
}: {
  icon: typeof UploadCloud
  tone?: 'blue' | 'orange' | 'green' | 'neutral'
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Extra detail under the description. */
  children?: React.ReactNode
}): JSX.Element {
  const labelId = useId()
  return (
    <div className="settings-row flex items-center gap-3.5">
      <span className={`settings-icon is-${tone}`}>
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div id={labelId} className="text-body font-semibold text-primary-text">
          {label}
        </div>
        <p className="mt-0.5 text-caption text-secondary-text">{description}</p>
        {children}
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabelledBy={labelId} />
    </div>
  )
}

/** A miniature of the app in one theme: top bar, sidebar and the lane motif. */
function ThemeMock({ variant }: { variant: 'dark' | 'light' }): JSX.Element {
  return (
    <span className={`theme-mock is-${variant}`} aria-hidden>
      <span className="tm-top">
        <i />
        <i />
      </span>
      <span className="tm-body">
        <span className="tm-side">
          <i className="is-active" />
          <i />
          <i />
          <i />
        </span>
        <span className="tm-main">
          <svg viewBox="0 0 120 54" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
            <path d="M 8 27 L 40 27 C 52 27, 48 12, 62 12 L 108 12" className="tm-lane is-remote" />
            <path d="M 40 27 C 52 27, 48 42, 62 42 L 96 42" className="tm-lane is-local" />
            <circle cx="40" cy="27" r="3.4" className="tm-node" />
            <circle cx="80" cy="12" r="3.4" className="tm-node is-remote" />
            <circle cx="94" cy="12" r="3.4" className="tm-node is-remote" />
            <circle cx="78" cy="42" r="3.4" className="tm-node is-local" />
          </svg>
        </span>
      </span>
    </span>
  )
}

const LANGUAGE_SAMPLES: Record<string, string> = { 'pt-BR': 'Olá', en: 'Hello', es: 'Hola' }

function GeneralPanel(): JSX.Element {
  const settings = useAppSettingsStore((s) => s.settings)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)
  const setView = useRepoStore((s) => s.setView)
  const t = useT().settings

  return (
    <>
      <GithubAccountSection />

      <section className="flex flex-col gap-2.5">
        <h2 className="settings-heading">{t.commit.heading}</h2>
        <div className="settings-group">
        <SettingRow
          icon={UploadCloud}
          tone="blue"
          label={t.commit.autoPush}
          description={t.commit.autoPushHint}
          checked={settings?.commitAndPush ?? false}
          onChange={(checked) => updateSettings({ commitAndPush: checked })}
        />
        <SettingRow
          icon={HeartHandshake}
          tone="orange"
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
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="settings-heading">{t.app.heading}</h2>
        <div className="settings-group">
          <button type="button" onClick={() => setView('about')} className="settings-row settings-link flex w-full items-center gap-3.5 text-left">
            <span className="settings-icon is-neutral">
              <Info size={16} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-semibold text-primary-text">{t.app.about}</span>
              <span className="text-caption text-secondary-text">{t.app.aboutHint}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-tertiary-text" aria-hidden />
          </button>
        </div>
      </section>
    </>
  )
}

function AppearancePanel(): JSX.Element {
  const settings = useAppSettingsStore((s) => s.settings)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)
  const tAll = useT().settings
  const t = tAll.appearance

  const colorSchemeOptions: { value: ColorSchemePreference; label: string }[] = [
    { value: 'system', label: t.themeSystem },
    { value: 'dark', label: t.themeDark },
    { value: 'light', label: t.themeLight }
  ]
  const languageOptions: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: t.languageSystem },
    ...SUPPORTED_LOCALES.map((locale) => ({ value: locale, label: LOCALE_NATIVE_NAMES[locale] }))
  ]

  const scheme = settings?.colorScheme ?? 'system'
  const language = settings?.language ?? 'system'

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <h2 className="settings-heading">
          <Monitor size={14} aria-hidden /> {t.theme}
        </h2>
        <div role="radiogroup" aria-label={tAll.themeAria} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {colorSchemeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={scheme === option.value}
              onClick={() => updateSettings({ colorScheme: option.value })}
              className="choice-tile"
            >
              {option.value === 'system' ? (
                <span className="theme-mock-split" aria-hidden>
                  <ThemeMock variant="dark" />
                  <span className="theme-mock-half">
                    <ThemeMock variant="light" />
                  </span>
                </span>
              ) : (
                <ThemeMock variant={option.value} />
              )}
              <span className="flex items-center justify-between gap-2 px-1 pt-2.5">
                <span className="text-body font-medium text-primary-text">{option.label}</span>
                <span className="choice-check" aria-hidden>
                  <Check size={11} strokeWidth={3} />
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="text-caption text-tertiary-text">{t.themeHint}</p>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="settings-heading">
          <Languages size={14} aria-hidden /> {t.language}
        </h2>
        <div role="radiogroup" aria-label={tAll.languageAria} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {languageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={language === option.value}
              onClick={() => updateSettings({ language: option.value })}
              className="choice-tile is-compact text-left"
              title={option.value === 'system' ? tAll.followsSystem : undefined}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="language-sample">{option.value === 'system' ? <Monitor size={20} aria-hidden /> : LANGUAGE_SAMPLES[option.value]}</span>
                <span className="choice-check" aria-hidden>
                  <Check size={11} strokeWidth={3} />
                </span>
              </span>
              <span className="mt-3 block truncate text-body font-medium text-primary-text">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="text-caption text-tertiary-text">{t.languageHint}</p>
      </section>
    </>
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
        <h1 className="flex items-center gap-2.5 text-headline font-semibold text-primary-text">
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
