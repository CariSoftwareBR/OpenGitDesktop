import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Clock,
  ExternalLink,
  Eye,
  Loader2,
  Lock,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Tags,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wrench,
  X,
  type LucideIcon
} from 'lucide-react'
import Github from '../components/icons/Github'
import ConfirmDialog from '../components/ConfirmDialog'
import Combobox from '../components/Combobox'
import UserSearchField from '../components/UserSearchField'
import { Avatar, LoginForm } from './PullRequestsView'
import { usePullRequestStore } from '../store/pullRequestStore'
import { sessionKeyOf, useCollaboratorStore } from '../store/collaboratorStore'
import { useLocale, useT } from '../lib/i18n'
import { relativeTime } from '../lib/relativeTime'
import type { GitHubUser, RemoteInfo } from '../lib/github'
import { canManageCollaborator, REPOSITORY_ROLES, type RepositoryRole } from '../../../shared/github'

type PendingAction =
  | { kind: 'remove'; login: string }
  | { kind: 'cancel'; id: number; login: string }
  | { kind: 'role'; login: string; role: RepositoryRole }

const AVATAR_SIZE = 36

/** One glyph per standard role, so the list reads at a glance. */
const ROLE_ICONS: Record<RepositoryRole, LucideIcon> = {
  read: Eye,
  triage: Tags,
  write: PenLine,
  maintain: Wrench,
  admin: ShieldCheck
}

/** A role as a quiet chip; custom roles get the chip without a glyph. */
function RoleChip({ role, label }: { role: string; label: string }): JSX.Element {
  const Icon = isStandardRole(role) ? ROLE_ICONS[role] : null
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-pill border border-default-border bg-coal-raised px-2.5 text-caption ${
        role === 'admin' ? 'text-primary-text' : 'text-secondary-text'
      }`}
    >
      {Icon && <Icon size={12} aria-hidden />}
      {label}
    </span>
  )
}

function isStandardRole(role: string): role is RepositoryRole {
  return (REPOSITORY_ROLES as readonly string[]).includes(role)
}

/** The same pill the pull request list uses to mark the current branch. */
function NameBadge({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center rounded-pill bg-command-blue-soft px-2 py-px text-label font-medium text-command-blue">
      {children}
    </span>
  )
}

/** Full-pane message for when there is no list to show. */
function PaneMessage({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }): JSX.Element {
  return (
    <div className="rise-in flex flex-col items-center gap-3 py-12 text-center">
      <span className="empty-medallion">{icon}</span>
      <h2 className="text-body font-medium text-primary-text">{title}</h2>
      {children}
    </div>
  )
}

function CollaboratorsPanel({ remote, user }: { remote: RemoteInfo; user: GitHubUser }): JSX.Element {
  const sessionKey = useCollaboratorStore((s) => s.sessionKey)
  const storedData = useCollaboratorStore((s) => s.data)
  const isLoading = useCollaboratorStore((s) => s.isLoading)
  const isSaving = useCollaboratorStore((s) => s.isSaving)
  const storedLoadError = useCollaboratorStore((s) => s.loadError)
  const fieldError = useCollaboratorStore((s) => s.fieldError)
  const load = useCollaboratorStore((s) => s.load)
  const add = useCollaboratorStore((s) => s.add)
  const remove = useCollaboratorStore((s) => s.remove)
  const cancelInvitation = useCollaboratorStore((s) => s.cancelInvitation)
  const changeRole = useCollaboratorStore((s) => s.changeRole)
  const clearFieldError = useCollaboratorStore((s) => s.clearFieldError)

  const [username, setUsername] = useState('')
  const [newRole, setNewRole] = useState<RepositoryRole>('write')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const baseId = useId()
  const t = useT().collaborators
  const locale = useLocale()

  useEffect(() => {
    void load()
  }, [load])

  // Between mounting and the first load the store still holds the previous repository or account.
  const current = sessionKey === sessionKeyOf(remote, user.login)
  const data = current ? storedData : null
  const loadError = current ? storedLoadError : null
  const shownFieldError = current ? fieldError : null
  const repoName = `${remote.owner}/${remote.repo}`
  const isOrg = data?.ownerKind === 'org'

  const roleLabel = (role: string): string => (isStandardRole(role) ? t.roles[role] : role)
  const roleOptions = (extra?: string): { value: string; label: string }[] => [
    ...REPOSITORY_ROLES.map((value) => ({ value, label: t.roles[value] })),
    // A custom role isn't in the list, and the field must not claim someone holds another one.
    ...(extra && !isStandardRole(extra) ? [{ value: extra, label: extra }] : [])
  ]

  function accessStatus(login: string): string | null {
    const same = (other: string | null): boolean => other?.toLowerCase() === login.toLowerCase()
    if (data?.collaborators.some((c) => same(c.login))) return t.hasAccess
    if (data?.invitations.some((i) => !i.expired && same(i.login))) return t.pendingChip
    return null
  }

  async function handleAdd(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (await add(username, isOrg ? newRole : undefined)) setUsername('')
  }

  function confirmPending(): void {
    if (!pending) return
    if (pending.kind === 'remove') void remove(pending.login)
    else if (pending.kind === 'cancel') void cancelInvitation(pending.id, pending.login)
    else void changeRole(pending.login, pending.role)
    setPending(null)
  }

  // How many people hold each role, in the order GitHub ranks them.
  const roleCounts = data
    ? REPOSITORY_ROLES.map((role) => ({ role, count: data.collaborators.filter((c) => c.role === role).length }))
        .filter((r) => r.count > 0)
        .reverse()
    : []

  const addForm = data?.canAdminister ? (
    <section className="flex flex-col gap-2.5" aria-labelledby={`${baseId}-add`}>
      <h2 id={`${baseId}-add`} className="settings-heading">
        <UserPlus size={13} aria-hidden />
        {t.addTitle}
      </h2>
      {/* Visible overflow: the group would clip the permission list otherwise. */}
      <form onSubmit={(event) => void handleAdd(event)} className="settings-group overflow-visible">
        <div className="settings-row flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${baseId}-username`} className="text-caption text-secondary-text">
              {t.usernameLabel}
            </label>
            <UserSearchField
              id={`${baseId}-username`}
              host={remote.host}
              value={username}
              onChange={(value) => {
                setUsername(value)
                if (shownFieldError) clearFieldError()
              }}
              statusOf={accessStatus}
              placeholder={t.usernamePlaceholder}
              invalid={Boolean(shownFieldError)}
              describedBy={`${baseId}-hint`}
            />
          </div>
          {isOrg && (
            <div className="flex flex-col gap-1.5">
              <p className="text-caption text-secondary-text">{t.roleLabel}</p>
              <Combobox
                value={newRole}
                onChange={(value) => setNewRole(value as RepositoryRole)}
                options={roleOptions()}
                ariaLabel={t.roleLabel}
                disabled={isSaving}
              />
            </div>
          )}
          <button type="submit" disabled={!username.trim() || isSaving} className="btn-primary w-full justify-center">
            {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <UserPlus size={14} aria-hidden />}
            {t.invite}
          </button>
          {shownFieldError ? (
            <p id={`${baseId}-hint`} role="alert" className="flex items-start gap-1.5 text-caption text-danger-red">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
              {shownFieldError}
            </p>
          ) : (
            <p id={`${baseId}-hint`} className="text-caption text-pretty text-tertiary-text">
              {t.addHint}
            </p>
          )}
        </div>
      </form>
    </section>
  ) : (
    <div className="settings-group">
      <div className="settings-row flex items-center gap-3">
        <span className="settings-icon">
          <Lock size={15} aria-hidden />
        </span>
        <p className="min-w-0 text-caption text-secondary-text">{t.readOnly}</p>
      </div>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-8 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="flex items-center gap-2.5 text-headline font-semibold text-primary-text">
              <Users size={20} aria-hidden />
              {t.title}
              {data && data.collaborators.length > 0 && <span className="count-badge">{data.collaborators.length}</span>}
            </h1>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-caption text-secondary-text">
              <span className="flex min-w-0 items-center gap-1.5">
                <Github size={12} className="shrink-0" />
                <span className="truncate font-mono">{repoName}</span>
              </span>
              {roleCounts.length > 0 && (
                <span className="flex flex-wrap items-center gap-1.5">
                  {roleCounts.map(({ role, count }) => {
                    const Icon = ROLE_ICONS[role]
                    return (
                      <span key={role} className="inline-flex items-center gap-1 rounded-pill border border-default-border bg-coal-raised px-2 py-0.5 text-meta">
                        <Icon size={11} aria-hidden />
                        <span className="tabular-nums text-primary-text">{count}</span>
                        {t.roles[role]}
                      </span>
                    )
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={`https://${remote.host}/${remote.owner}/${remote.repo}/settings/access`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost h-8 gap-1.5 px-2.5 text-caption"
            >
              <ExternalLink size={13} aria-hidden />
              {t.manageOnGithub}
            </a>
            <button
              type="button"
              onClick={() => void load()}
              disabled={isLoading || isSaving}
              className="btn-ghost size-8 shrink-0 px-0"
              aria-label={t.refreshAria}
              title={t.refresh}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : undefined} aria-hidden />
            </button>
          </div>
        </header>

        {loadError ? (
          <PaneMessage icon={<AlertCircle size={20} className="text-danger-red" aria-hidden />} title={t.loadFailedTitle}>
            <p role="alert" className="max-w-md break-words text-caption text-secondary-text">
              {loadError}
            </p>
            <button type="button" onClick={() => void load()} disabled={isLoading} className="btn-secondary mt-1">
              {t.retry}
            </button>
          </PaneMessage>
        ) : !data ? (
          <p role="status" className="flex items-center justify-center gap-2 py-12 text-body text-secondary-text">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            {t.loading}
          </p>
        ) : !data.canView ? (
          <PaneMessage icon={<Lock size={20} aria-hidden />} title={t.noAccessTitle}>
            <p className="max-w-sm text-caption text-secondary-text">{t.noAccess}</p>
          </PaneMessage>
        ) : (
          // Wide: people on the left, the invite card held beside them. Narrow:
          // one column, inviting first.
          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:order-last">{addForm}</aside>

            <div className="flex min-w-0 flex-col gap-7">
              {data.invitationsError && (
                <p role="alert" className="flex items-start gap-1.5 text-caption text-warning-amber">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{t.invitationsFailed(data.invitationsError)}</span>
                </p>
              )}

              {data.invitations.length > 0 && (
                <section className="flex flex-col gap-2.5" aria-labelledby={`${baseId}-pending`}>
                  <h2 id={`${baseId}-pending`} className="settings-heading">
                    <Clock size={13} aria-hidden />
                    {t.pendingTitle}
                    <span className="count-badge">{data.invitations.length}</span>
                  </h2>
                  <ul className="settings-group">
                    {data.invitations.map((invitation, index) => {
                      const name = invitation.login ?? t.unknownInvitee
                      return (
                        <li
                          key={invitation.id}
                          className="collab-row settings-row group flex flex-wrap items-center gap-x-3 gap-y-2"
                          style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
                        >
                          <Avatar login={invitation.login ?? ''} src={invitation.avatarUrl} size={AVATAR_SIZE} />
                          <div className="min-w-32 flex-1">
                            <p className="truncate text-body font-medium text-primary-text">{name}</p>
                            <p className="truncate text-caption text-tertiary-text">{t.invitedAt(relativeTime(locale, invitation.createdAt))}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <RoleChip role={invitation.role} label={roleLabel(invitation.role)} />
                            <span className={invitation.expired ? 'chip-danger' : 'chip-attention'}>
                              <Clock size={11} aria-hidden />
                              {invitation.expired ? t.expiredChip : t.pendingChip}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPending({ kind: 'cancel', id: invitation.id, login: name })}
                              disabled={isSaving}
                              aria-label={t.cancelInviteAria(name)}
                              className="collab-action section-action is-danger"
                            >
                              <X size={13} aria-hidden />
                              {t.cancelInvite}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              <section className="flex flex-col gap-2.5" aria-labelledby={`${baseId}-people`}>
                <h2 id={`${baseId}-people`} className="settings-heading">
                  <Users size={13} aria-hidden />
                  {t.peopleTitle}
                </h2>
                {data.collaborators.length === 0 ? (
                  <PaneMessage icon={<Users size={20} aria-hidden />} title={t.empty} />
                ) : (
                  <ul className="settings-group overflow-visible">
                    {data.collaborators.map((collaborator, index) => {
                      const { login, role, direct } = collaborator
                      const manageable = canManageCollaborator(collaborator, {
                        canAdminister: data.canAdminister,
                        owner: data.ownerLogin,
                        viewer: user.login
                      })
                      const roleEditable = manageable && isOrg
                      return (
                        <li
                          key={login}
                          className="collab-row settings-row group flex flex-wrap items-center gap-x-3 gap-y-2"
                          style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
                        >
                          <Avatar login={login} src={collaborator.avatarUrl} size={AVATAR_SIZE} />
                          <div className="min-w-32 flex-1">
                            <p className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate text-body font-medium text-primary-text">{login}</span>
                              {login.toLowerCase() === user.login.toLowerCase() && <NameBadge>{t.you}</NameBadge>}
                              {login.toLowerCase() === data.ownerLogin.toLowerCase() && <NameBadge>{t.owner}</NameBadge>}
                            </p>
                            {isOrg && (
                              <p
                                className="flex min-w-0 items-center gap-1.5 text-caption text-tertiary-text"
                                title={direct ? undefined : t.inheritedTitle}
                              >
                                {direct ? <UserCheck size={12} className="shrink-0" aria-hidden /> : <Building2 size={12} className="shrink-0" aria-hidden />}
                                <span className="truncate">{direct ? t.direct : t.inherited}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {roleEditable ? (
                              <Combobox
                                value={role}
                                onChange={(value) => {
                                  if (value !== role && isStandardRole(value)) setPending({ kind: 'role', login, role: value })
                                }}
                                options={roleOptions(role)}
                                ariaLabel={t.roleAria(login)}
                                disabled={isSaving}
                                className="w-36"
                              />
                            ) : (
                              <RoleChip role={role} label={roleLabel(role)} />
                            )}
                            {manageable && (
                              <button
                                type="button"
                                onClick={() => setPending({ kind: 'remove', login })}
                                disabled={isSaving}
                                aria-label={t.removeAria(login)}
                                className="collab-action section-action is-danger"
                              >
                                <UserMinus size={13} aria-hidden />
                                {t.remove}
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending?.kind === 'remove'}
        danger
        title={t.removeDialogTitle}
        message={pending?.kind === 'remove' ? t.removeDialogMessage(pending.login, repoName) : ''}
        confirmLabel={t.removeConfirm}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'cancel'}
        danger
        title={t.cancelDialogTitle}
        message={pending?.kind === 'cancel' ? t.cancelDialogMessage(pending.login) : ''}
        confirmLabel={t.cancelConfirm}
        cancelLabel={t.keepInvite}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'role'}
        title={t.roleDialogTitle}
        message={pending?.kind === 'role' ? t.roleDialogMessage(pending.login, t.roles[pending.role]) : ''}
        confirmLabel={t.roleConfirm}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

function CollaboratorsView(): JSX.Element {
  const remote = usePullRequestStore((s) => s.remote)
  const user = usePullRequestStore((s) => s.user)
  const t = useT().collaborators

  if (!remote) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-secondary-text">
        <h1 className="sr-only">{t.title}</h1>
        <Users size={32} aria-hidden />
        <p>{t.noRemote}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <h1 className="sr-only">{t.title}</h1>
        <LoginForm hint={t.loginHint} />
      </div>
    )
  }

  // Keyed so a half-typed username or an open dialog never carries over to another repository.
  return <CollaboratorsPanel key={sessionKeyOf(remote, user.login)} remote={remote} user={user} />
}

export default CollaboratorsView
