import { useEffect, useId, useState } from 'react'
import { AlertTriangle, Check, FolderOpen, Loader2, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react'
import GithubIcon from '../icons/Github'
import { useAppSettingsStore } from '../../store/appSettingsStore'
import { useGithubAuthStore } from '../../store/githubAuthStore'
import { useRepoStore } from '../../store/repoStore'
import { useT } from '../../lib/i18n'
import {
  identityProblem,
  isValidEmail,
  isValidName,
  type GithubIdentitySuggestion,
  type IdentityOverview,
  type IdentityProfile,
  type RepoIdentity
} from '../../../../shared/identity'

const GITHUB_HOST = 'github.com'

function errorText(err: unknown): string {
  return err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)
}

/** Initials for the identity disc: "Paulo Carinhena" → "PC". */
function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase()
}

function IdentityDisc({ name, tone = 'blue' }: { name: string | null | undefined; tone?: 'blue' | 'amber' | 'red' }): JSX.Element {
  const toneClass =
    tone === 'red'
      ? 'border-danger-red/35 bg-danger-red-soft text-danger-red'
      : tone === 'amber'
        ? 'border-warning-amber/35 bg-warning-amber-soft text-warning-amber'
        : 'border-command-blue/30 bg-command-blue-soft text-command-blue'
  return (
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-full border text-caption font-semibold tracking-wide ${toneClass}`} aria-hidden>
      {initials(name)}
    </span>
  )
}

/** How commits in the open repository will be signed, and what to do when that looks wrong. */
function RepoIdentityCard({
  repo,
  profiles,
  onApplied
}: {
  repo: RepoIdentity
  profiles: IdentityProfile[]
  onApplied: (repo: RepoIdentity) => void
}): JSX.Element {
  const t = useT().settings.identity
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problem = identityProblem(repo, profiles)
  const profile = repo.profileId ? profiles.find((p) => p.id === repo.profileId) : null

  const source =
    repo.source === 'profile'
      ? t.sourceProfile(profile?.account ?? profile?.name ?? '?')
      : repo.source === 'local'
        ? t.sourceLocal
        : repo.source === 'global'
          ? t.sourceGlobal
          : repo.source === 'other'
            ? t.sourceOther
            : null

  async function apply(profileId: string): Promise<void> {
    if (!currentRepoPath) return
    setBusy(true)
    setError(null)
    try {
      onApplied(await window.api.identity.applyProfile(currentRepoPath, profileId))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-group">
      <div className="settings-row flex items-center gap-3.5">
        <IdentityDisc name={repo.name} tone={problem?.kind === 'missing' ? 'red' : problem ? 'amber' : 'blue'} />
        <div className="min-w-0 flex-1">
          <div className="text-caption text-secondary-text">{t.commitsAs}</div>
          {repo.email && repo.name ? (
            <div className="mt-0.5 truncate text-body text-primary-text">
              <span className="font-semibold">{repo.name}</span>{' '}
              <span className="font-mono text-caption text-secondary-text">&lt;{repo.email}&gt;</span>
            </div>
          ) : (
            <div className="mt-0.5 text-body font-semibold text-danger-red">{t.notConfigured}</div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {source && (
              <span className="rounded-pill border border-default-border bg-coal-raised px-2 py-0.5 text-label text-secondary-text">{source}</span>
            )}
            {repo.remoteOwner && (
              <span className="rounded-pill border border-default-border bg-coal-raised px-2 py-0.5 text-label text-secondary-text">
                {t.remoteOwner(repo.remoteOwner)}
              </span>
            )}
          </div>
        </div>
      </div>
      {problem?.kind === 'mismatch' && (
        <div className="settings-row flex flex-col gap-2.5 bg-warning-amber-soft">
          <p className="flex items-start gap-2.5 text-caption text-primary-text">
            <AlertTriangle size={15} className="mt-px shrink-0 text-warning-amber" aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">{t.mismatch(problem.profile.account ?? '', problem.profile.email)}</span>
          </p>
          <button type="button" className="btn-secondary self-end" disabled={busy} onClick={() => void apply(problem.profile.id)}>
            {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Check size={13} aria-hidden />}
            {t.applyProfileHere(problem.profile.account ?? '')}
          </button>
        </div>
      )}
      {error && <p className="settings-row text-caption text-danger-red" role="alert">{error}</p>}
    </div>
  )
}

function GlobalIdentityForm({ overview, onSaved }: { overview: IdentityOverview; onSaved: (o: IdentityOverview) => void }): JSX.Element {
  const t = useT().settings.identity
  const nameId = useId()
  const emailId = useId()
  const [name, setName] = useState(overview.global.name ?? '')
  const [email, setEmail] = useState(overview.global.email ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const changed = name.trim() !== (overview.global.name ?? '') || email.trim() !== (overview.global.email ?? '')
  const emailInvalid = email.trim() !== '' && !isValidEmail(email)
  const canSave = changed && isValidName(name) && isValidEmail(email) && state !== 'saving'

  useEffect(() => {
    if (state !== 'saved') return
    const timer = setTimeout(() => setState('idle'), 2200)
    return () => clearTimeout(timer)
  }, [state])

  async function save(): Promise<void> {
    setState('saving')
    setError(null)
    try {
      onSaved(await window.api.identity.setGlobal({ name: name.trim(), email: email.trim() }))
      setState('saved')
    } catch (err) {
      setError(t.saveError(errorText(err)))
      setState('idle')
    }
  }

  return (
    <form
      className="settings-group"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSave) void save()
      }}
    >
      <div className="settings-row grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label htmlFor={nameId} className="flex flex-col gap-1.5 text-caption text-secondary-text">
          {t.name}
          <input id={nameId} className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} autoComplete="name" />
        </label>
        <label htmlFor={emailId} className="flex flex-col gap-1.5 text-caption text-secondary-text">
          {t.email}
          <input
            id={emailId}
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            aria-invalid={emailInvalid || undefined}
            autoComplete="email"
          />
          {emailInvalid && <span className="text-danger-red">{t.invalidEmail}</span>}
        </label>
      </div>
      <div className="settings-row flex items-center justify-end gap-3">
        {error && <p className="min-w-0 flex-1 text-caption text-danger-red" role="alert">{error}</p>}
        {state === 'saved' && (
          <span className="flex items-center gap-1 text-caption text-success-green" role="status">
            <Check size={13} aria-hidden /> {t.saved}
          </span>
        )}
        <button type="submit" className="btn-primary h-8 px-3" disabled={!canSave}>
          {state === 'saving' ? t.saving : t.save}
        </button>
      </div>
    </form>
  )
}

interface ProfileDraft {
  id: string
  account: string
  folder: string
  name: string
  email: string
}

function toDraft(profile: IdentityProfile | null, fallbackName: string): ProfileDraft {
  return {
    id: profile?.id ?? crypto.randomUUID(),
    account: profile?.account ?? '',
    folder: profile?.folder ?? '',
    name: profile?.name ?? fallbackName,
    email: profile?.email ?? ''
  }
}

function joinFolder(base: string, child: string): string {
  const separator = base.includes('\\') ? '\\' : '/'
  return `${base.replace(/[\\/]+$/, '')}${separator}${child}`
}

function ProfileForm({
  initial,
  onCancel,
  onSubmit
}: {
  initial: ProfileDraft
  onCancel: () => void
  onSubmit: (draft: ProfileDraft) => Promise<void>
}): JSX.Element {
  const t = useT().settings.identity
  const settings = useAppSettingsStore((s) => s.settings)
  const githubUser = useGithubAuthStore((s) => s.user)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<GithubIdentitySuggestion | null>(null)
  const ids = { account: useId(), name: useId(), email: useId() }

  useEffect(() => {
    if (!githubUser) return
    let alive = true
    window.api.identity
      .githubSuggestion(GITHUB_HOST)
      .then((s) => alive && setSuggestion(s))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [githubUser])

  // With "Organizar por conta" on, the account's folder is predictable:
  // <last clone base>/<account>. Offered, never filled in silently.
  const base = settings?.cloneOrganizeByOwner ? settings.lastCloneBaseFolder : null
  const suggestedFolder = base && draft.account.trim() && !draft.folder ? joinFolder(base, draft.account.trim()) : null

  const set = (patch: Partial<ProfileDraft>): void => setDraft((d) => ({ ...d, ...patch }))
  const emailInvalid = draft.email.trim() !== '' && !isValidEmail(draft.email)
  const problem = !isValidName(draft.name)
    ? t.invalidName
    : !isValidEmail(draft.email)
      ? t.invalidEmail
      : !draft.account.trim() && !draft.folder.trim()
        ? t.needsAccountOrFolder
        : null

  async function chooseFolder(): Promise<void> {
    const folder = await window.api.dialogs.openDirectory()
    if (folder) set({ folder })
  }

  async function submit(): Promise<void> {
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(draft)
    } catch (err) {
      setError(t.saveError(errorText(err)))
      setSaving(false)
    }
  }

  const emailChoices = suggestion
    ? [{ email: suggestion.noreply, noreply: true }, ...suggestion.emails.map((email) => ({ email, noreply: false }))]
    : []

  return (
    <form
      className="settings-row flex flex-col gap-3 bg-midnight-base/40"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label htmlFor={ids.account} className="flex flex-col gap-1.5 text-caption text-secondary-text">
          {t.account}
          <input
            id={ids.account}
            className="field"
            value={draft.account}
            onChange={(e) => set({ account: e.target.value })}
            placeholder={t.accountPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="flex flex-col gap-1.5 text-caption text-secondary-text sm:col-span-2">
          {t.folder}
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={`field flex min-w-0 flex-1 items-center truncate font-mono text-caption ${draft.folder ? 'text-primary-text' : 'text-tertiary-text'}`}
              title={draft.folder || undefined}
            >
              {draft.folder || t.noFolder}
            </span>
            {draft.folder ? (
              <button type="button" className="btn-ghost w-[34px] shrink-0 px-0" onClick={() => set({ folder: '' })} title={t.clearFolder} aria-label={t.clearFolder}>
                <X size={14} aria-hidden />
              </button>
            ) : null}
            <button type="button" className="btn-secondary shrink-0" onClick={() => void chooseFolder()}>
              <FolderOpen size={13} aria-hidden /> {t.chooseFolder}
            </button>
          </div>
          {suggestedFolder && (
            <button
              type="button"
              onClick={() => set({ folder: suggestedFolder })}
              className="self-start truncate rounded-pill border border-dashed border-command-blue/40 px-2 py-0.5 text-left font-mono text-label text-command-blue transition-colors duration-100 hover:bg-command-blue-soft"
              title={t.folderSuggested}
            >
              + {suggestedFolder}
            </button>
          )}
        </div>
        <label htmlFor={ids.name} className="flex flex-col gap-1.5 text-caption text-secondary-text">
          {t.name}
          <input id={ids.name} className="field" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder={t.namePlaceholder} />
        </label>
        <label htmlFor={ids.email} className="flex flex-col gap-1.5 text-caption text-secondary-text">
          {t.email}
          <input
            id={ids.email}
            className="field"
            type="email"
            value={draft.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder={t.emailPlaceholder}
            aria-invalid={emailInvalid || undefined}
            spellCheck={false}
          />
        </label>
      </div>

      {emailChoices.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-label text-tertiary-text">
            <GithubIcon size={12} aria-hidden /> {t.githubSuggestions}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {emailChoices.map((choice) => {
              const selected = draft.email.trim().toLowerCase() === choice.email.toLowerCase()
              return (
                <button
                  key={choice.email}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    set({
                      email: choice.email,
                      name: draft.name.trim() ? draft.name : (suggestion?.name ?? draft.name),
                      account: draft.account.trim() ? draft.account : (suggestion?.login ?? '')
                    })
                  }
                  title={choice.noreply ? t.noreplyHint : undefined}
                  className={`flex max-w-full items-center gap-1.5 rounded-pill border px-2.5 py-1 font-mono text-label transition-colors duration-100 ${
                    selected
                      ? 'border-command-blue/50 bg-command-blue-soft text-command-blue'
                      : 'border-default-border bg-coal-raised text-secondary-text hover:text-primary-text'
                  }`}
                >
                  <span className="truncate">{choice.email}</span>
                  {choice.noreply && (
                    <span className="rounded-pill bg-success-green-soft px-1.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-success-green">
                      {t.noreply}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && <p className="min-w-0 flex-1 text-caption text-danger-red" role="alert">{error}</p>}
        <button type="button" className="btn-secondary h-8 px-3" onClick={onCancel} disabled={saving}>
          {t.cancel}
        </button>
        <button type="submit" className="btn-primary h-8 px-3" disabled={saving}>
          {saving ? t.saving : t.saveProfile}
        </button>
      </div>
    </form>
  )
}

function ProfileRow({ profile, onEdit, onRemove, busy }: { profile: IdentityProfile; onEdit: () => void; onRemove: () => void; busy: boolean }): JSX.Element {
  const t = useT().settings.identity
  return (
    <div className="settings-row flex items-center gap-3.5">
      <IdentityDisc name={profile.account ?? profile.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-semibold text-primary-text">{profile.account ?? profile.name}</span>
          {profile.account && <span className="truncate text-caption text-secondary-text">{profile.name}</span>}
        </div>
        <div className="truncate font-mono text-caption text-secondary-text">{profile.email}</div>
        {profile.folder && (
          <div className="mt-1 flex min-w-0 items-center gap-1 text-label text-tertiary-text" title={profile.folder}>
            <FolderOpen size={11} className="shrink-0" aria-hidden />
            <span className="truncate font-mono">{profile.folder}</span>
          </div>
        )}
      </div>
      <button type="button" className="btn-ghost w-[34px] shrink-0 px-0" onClick={onEdit} disabled={busy} title={t.editProfile} aria-label={t.editProfile}>
        <Pencil size={14} aria-hidden />
      </button>
      <button type="button" className="btn-ghost w-[34px] shrink-0 px-0 hover:text-danger-red" onClick={onRemove} disabled={busy} title={t.removeProfile} aria-label={t.removeProfile}>
        <Trash2 size={14} aria-hidden />
      </button>
    </div>
  )
}

export default function IdentityPanel(): JSX.Element {
  const t = useT().settings.identity
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const [overview, setOverview] = useState<IdentityOverview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.api.identity
      .getOverview(currentRepoPath)
      .then((o) => alive && setOverview(o))
      .catch((err) => alive && setLoadError(errorText(err)))
    return () => {
      alive = false
    }
  }, [currentRepoPath])

  /** Saves the list, then re-reads the repository so its card follows the new profiles. */
  async function saveProfiles(profiles: IdentityProfile[]): Promise<void> {
    const saved = await window.api.identity.saveProfiles(profiles)
    const repo = currentRepoPath ? (await window.api.identity.getOverview(currentRepoPath)).repo : null
    setOverview({ ...saved, repo })
    // Settings store mirrors settings.json; keep it in step for the commit box.
    await useAppSettingsStore.getState().loadSettings()
  }

  async function submitDraft(draft: ProfileDraft): Promise<void> {
    if (!overview) return
    const profile: IdentityProfile = {
      id: draft.id,
      account: draft.account.trim() || null,
      folder: draft.folder.trim() || null,
      name: draft.name.trim(),
      email: draft.email.trim()
    }
    const exists = overview.profiles.some((p) => p.id === profile.id)
    await saveProfiles(exists ? overview.profiles.map((p) => (p.id === profile.id ? profile : p)) : [...overview.profiles, profile])
    setEditing(null)
  }

  async function remove(id: string): Promise<void> {
    if (!overview) return
    setBusy(true)
    setListError(null)
    try {
      await saveProfiles(overview.profiles.filter((p) => p.id !== id))
    } catch (err) {
      setListError(t.saveError(errorText(err)))
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <p className="text-caption text-danger-red" role="alert">{loadError}</p>
  if (!overview) {
    return (
      <div className="flex items-center gap-2 text-caption text-secondary-text">
        <Loader2 size={14} className="animate-spin" aria-hidden />
      </div>
    )
  }

  return (
    <>
      {overview.repo && (
        <section className="flex flex-col gap-2.5">
          <h2 className="settings-heading">{t.repoHeading}</h2>
          <RepoIdentityCard repo={overview.repo} profiles={overview.profiles} onApplied={(repo) => setOverview({ ...overview, repo })} />
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="settings-heading">{t.globalHeading}</h2>
        <GlobalIdentityForm
          key={`${overview.global.name}|${overview.global.email}`}
          overview={overview}
          onSaved={(saved) => setOverview({ ...saved, repo: overview.repo })}
        />
        <p className="text-caption text-tertiary-text">{t.globalHint}</p>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="settings-heading">
            {t.profilesHeading}
            {overview.profiles.length > 0 && (
              <span className="rounded-pill bg-coal-raised px-1.5 font-normal tabular-nums text-tertiary-text">{overview.profiles.length}</span>
            )}
          </h2>
          {editing !== 'new' && (
            <button type="button" className="btn-secondary h-8 px-3" onClick={() => setEditing('new')}>
              <Plus size={13} aria-hidden /> {t.addProfile}
            </button>
          )}
        </div>
        <p className="text-caption text-secondary-text">{t.profilesHint}</p>
        <div className="settings-group">
          {overview.profiles.length === 0 && editing !== 'new' && (
            <div className="settings-row flex items-center gap-3 text-caption text-tertiary-text">
              <UserRound size={16} aria-hidden /> {t.noProfiles}
            </div>
          )}
          {overview.profiles.map((profile) =>
            editing === profile.id ? (
              <ProfileForm key={profile.id} initial={toDraft(profile, '')} onCancel={() => setEditing(null)} onSubmit={submitDraft} />
            ) : (
              <ProfileRow key={profile.id} profile={profile} busy={busy} onEdit={() => setEditing(profile.id)} onRemove={() => void remove(profile.id)} />
            )
          )}
          {editing === 'new' && (
            <ProfileForm initial={toDraft(null, overview.global.name ?? '')} onCancel={() => setEditing(null)} onSubmit={submitDraft} />
          )}
        </div>
        {listError && <p className="text-caption text-danger-red" role="alert">{listError}</p>}
        <p className="text-caption text-tertiary-text">{t.applyNote}</p>
      </section>
    </>
  )
}
