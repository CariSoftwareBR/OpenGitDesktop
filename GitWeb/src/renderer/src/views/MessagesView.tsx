import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  CircleCheck,
  CircleDot,
  ExternalLink,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  Lock,
  MessagesSquare,
  RefreshCw,
  Star,
  Tag,
  X,
  type LucideIcon
} from 'lucide-react'
import ActivitySky from '../components/ActivitySky'
import ConfirmDialog from '../components/ConfirmDialog'
import Github from '../components/icons/Github'
import { Avatar } from './PullRequestsView'
import { isNewStar, useInboxStore } from '../store/inboxStore'
import { useGithubAuthStore } from '../store/githubAuthStore'
import { usePullRequestStore } from '../store/pullRequestStore'
import { useRepoStore } from '../store/repoStore'
import { useLocale, useT } from '../lib/i18n'
import { relativeTime } from '../lib/relativeTime'
import { buildTimeline, type TimelineItem } from '../lib/messageTimeline'
import { REPOSITORY_ROLES, type GitHubNotification, type ReceivedInvitation, type RepositoryRole, type RepositoryStar } from '../../../shared/github'

const KIND_ICONS: Record<string, LucideIcon> = {
  PullRequest: GitPullRequest,
  Issue: CircleDot,
  Commit: GitCommitHorizontal,
  Release: Tag,
  Discussion: MessagesSquare,
  CheckSuite: CircleCheck
}

// The ones waiting on this person, as opposed to news about something they follow.
const NEEDS_YOU = new Set(['review_requested', 'mention', 'team_mention', 'assign', 'security_alert'])
const needsYou = (reason: string): boolean => NEEDS_YOU.has(reason)

type Filter = 'all' | 'notifications' | 'stars'

type MergeState = 'pending' | 'merging' | 'merged'

/**
 * An invitation drawn as what it is in Git terms: the person's own branch coming
 * in to join the repository's line. Dashed until accepted, and accepting
 * completes the merge.
 */
function InvitationGraph({ inviter, viewer, state }: { inviter: ReceivedInvitation | null; viewer: { login: string; avatarUrl: string } | null; state: MergeState }): JSX.Element {
  return (
    <div className={`inbox-merge is-${state}`} aria-hidden>
      <svg width="132" height="84" viewBox="0 0 132 84" fill="none">
        <path className="inbox-merge-main" pathLength={1} d="M20 22 H132" />
        <path className="inbox-merge-branch" pathLength={1} d="M20 62 H48 C74 62 74 22 102 22" />
        <circle className="inbox-merge-node" cx="102" cy="22" r="7" />
      </svg>
      <span className="inbox-merge-avatar" style={{ top: 2 }}>
        <Avatar login={inviter?.inviterLogin ?? ''} src={inviter?.inviterAvatarUrl} size={40} />
      </span>
      <span className="inbox-merge-avatar" style={{ top: 42 }}>
        <Avatar login={viewer?.login ?? ''} src={viewer?.avatarUrl} size={40} />
      </span>
    </div>
  )
}

interface RowProps {
  active: boolean
  style: CSSProperties
  onActivate: (active: boolean) => void
}

function NotificationRow({ notification, onRead, active, style, onActivate }: RowProps & { notification: GitHubNotification; onRead: (id: string) => void }): JSX.Element {
  const t = useT().inbox
  const locale = useLocale()
  const Icon = KIND_ICONS[notification.kind] ?? Bell
  const reason = t.reasons[notification.reason]
  const urgent = needsYou(notification.reason)
  return (
    // Hover only mirrors the row onto the sky above; the row's link stays the control.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li className={`inbox-row ${active ? 'is-active' : ''}`} style={style} onMouseEnter={() => onActivate(true)} onMouseLeave={() => onActivate(false)}>
      <span className={`inbox-tile ${urgent ? 'is-attention' : ''}`}>
        <Icon size={17} aria-hidden />
      </span>
      {/* Opening it is reading it, the same way it would be on GitHub. */}
      <a href={notification.htmlUrl} target="_blank" rel="noreferrer" onClick={() => onRead(notification.id)} onFocus={() => onActivate(true)} onBlur={() => onActivate(false)} className="inbox-row-body">
        <span className="inbox-row-title">{notification.title}</span>
        <span className="inbox-row-meta">
          {notification.repoFullName} · {t.kinds[notification.kind] ?? notification.kind}
          {reason && (
            <>
              {' · '}
              <span className={urgent ? 'text-attention-orange' : undefined}>{reason}</span>
            </>
          )}
        </span>
      </a>
      <button type="button" onClick={() => onRead(notification.id)} title={t.markRead} aria-label={t.markReadAria(notification.title)} className="inbox-row-action">
        <Check size={15} aria-hidden />
      </button>
      <time dateTime={notification.updatedAt} className="inbox-row-time">
        {relativeTime(locale, notification.updatedAt)}
      </time>
    </li>
  )
}

function StarRow({ star, isNew, active, style, onActivate }: RowProps & { star: RepositoryStar; isNew: boolean }): JSX.Element {
  const t = useT().inbox
  const locale = useLocale()
  return (
    // Hover only mirrors the row onto the sky above; the row's link stays the control.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li className={`inbox-row ${active ? 'is-active' : ''}`} style={style} onMouseEnter={() => onActivate(true)} onMouseLeave={() => onActivate(false)}>
      <span className="inbox-person">
        <Avatar login={star.login} src={star.avatarUrl} size={38} />
        <span className="inbox-person-star">
          <Star size={10} fill="currentColor" strokeWidth={0} aria-hidden />
        </span>
      </span>
      <a href={star.profileUrl} target="_blank" rel="noreferrer" aria-label={t.viewProfileAria(star.login)} onFocus={() => onActivate(true)} onBlur={() => onActivate(false)} className="inbox-row-body">
        <span className="inbox-row-title">
          {star.login} <span className="font-normal text-secondary-text">{t.starredVerb}</span>
        </span>
        <span className="inbox-row-meta">{star.repoFullName}</span>
      </a>
      {isNew && <span className="chip-command shrink-0">{t.newStar}</span>}
      <time dateTime={star.starredAt} className="inbox-row-time">
        {relativeTime(locale, star.starredAt)}
      </time>
    </li>
  )
}

function PaneMessage({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 pb-10 text-center">
      <span className="empty-medallion">{icon}</span>
      <h2 className="text-title font-semibold text-primary-text">{title}</h2>
      <p className="max-w-sm text-body text-secondary-text">{children}</p>
    </div>
  )
}

function LoadingRows({ label }: { label: string }): JSX.Element {
  return (
    <div role="status" className="inbox-panel">
      <span className="sr-only">{label}</span>
      {[58, 42, 50].map((width) => (
        <div key={width} className="inbox-row" aria-hidden>
          <span className="inbox-tile" />
          <span className="inbox-row-body">
            <span className="inbox-ghost" style={{ width: `${width}%` }} />
            <span className="inbox-ghost is-small" style={{ width: `${width - 16}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

function MessagesView(): JSX.Element {
  const invitations = useInboxStore((s) => s.invitations)
  const notifications = useInboxStore((s) => s.notifications)
  const stars = useInboxStore((s) => s.stars)
  const signedIn = useInboxStore((s) => s.signedIn)
  const isLoading = useInboxStore((s) => s.isLoading)
  const answeringId = useInboxStore((s) => s.answeringId)
  const checkedAt = useInboxStore((s) => s.checkedAt)
  const error = useInboxStore((s) => s.error)
  const notice = useInboxStore((s) => s.notice)
  const refresh = useInboxStore((s) => s.refresh)
  const accept = useInboxStore((s) => s.accept)
  const decline = useInboxStore((s) => s.decline)
  const markRead = useInboxStore((s) => s.markRead)
  const markAllRead = useInboxStore((s) => s.markAllRead)
  const markStarsSeen = useInboxStore((s) => s.markStarsSeen)
  const clearNotice = useInboxStore((s) => s.clearNotice)
  const prUser = usePullRequestStore((s) => s.user)
  const startScreenUser = useGithubAuthStore((s) => s.user)
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const setView = useRepoStore((s) => s.setView)
  const [declining, setDeclining] = useState<ReceivedInvitation | null>(null)
  const [joined, setJoined] = useState<ReceivedInvitation | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  // Opening the tab counts as seeing the stars, but they stay marked for this visit.
  const [newStarsSince] = useState(() => useInboxStore.getState().starsSeenAt)
  const invitationsHeading = useId()
  const timelineHeading = useId()
  const messages = useT()
  const t = messages.inbox
  const locale = useLocale()

  useEffect(() => {
    // What the background check last saw can be minutes old by the time someone
    // looks, but one already on its way is as fresh as this one would be.
    if (!useInboxStore.getState().isLoading) void refresh()
    markStarsSeen()
  }, [refresh, markStarsSeen])

  const viewer = prUser ?? startScreenUser
  const busy = answeringId !== null
  const newStars = stars.filter((star) => isNewStar(star, newStarsSince)).length
  const roleLabel = (role: string): string =>
    (REPOSITORY_ROLES as readonly string[]).includes(role) ? messages.collaborators.roles[role as RepositoryRole] : role

  const summaryParts = [
    invitations.length > 0 && t.summaryInvitations(invitations.length),
    notifications.length > 0 && t.summaryNotifications(notifications.length),
    newStars > 0 && t.summaryStars(newStars)
  ].filter((part): part is string => Boolean(part))
  const summary =
    summaryParts.length > 0
      ? t.summary(new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(summaryParts))
      : stars.length > 0
        ? t.allClearWithStars(stars.length)
        : t.allClear

  async function handleAccept(invitation: ReceivedInvitation): Promise<void> {
    await accept(invitation)
    if (!useInboxStore.getState().invitations.some((i) => i.id === invitation.id)) setJoined(invitation)
  }

  function dismissJoined(): void {
    setJoined(null)
    clearNotice()
  }

  const showBoth = notifications.length > 0 && stars.length > 0
  const shownFilter = showBoth ? filter : 'all'
  const groups = buildTimeline(shownFilter === 'stars' ? [] : notifications, shownFilter === 'notifications' ? [] : stars)
  // Stable between renders: the sky lays itself out from this, and hovering a row must not redraw it.
  const everything = useMemo(() => buildTimeline(notifications, stars).flatMap((group) => group.items), [notifications, stars])
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: t.filterAll, count: notifications.length + stars.length },
    { id: 'notifications', label: t.filterNotifications, count: notifications.length },
    { id: 'stars', label: t.filterStars, count: stars.length }
  ]
  const hasMessages = invitations.length + notifications.length + stars.length > 0 || joined !== null

  let rowIndex = 0
  const renderItem = (item: TimelineItem): JSX.Element => {
    const shared = {
      active: activeKey === item.key,
      style: { '--i': rowIndex++ } as CSSProperties,
      onActivate: (active: boolean) => setActiveKey(active ? item.key : null)
    }
    return item.type === 'notification' ? (
      <NotificationRow key={item.key} notification={item.notification} onRead={(id) => void markRead(id)} {...shared} />
    ) : (
      <StarRow key={item.key} star={item.star} isNew={isNewStar(item.star, newStarsSince)} {...shared} />
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <ActivitySky items={everything} needsYou={needsYou} newStarsSince={newStarsSince} activeKey={activeKey} onActivate={setActiveKey}>
        <header className="inbox-column flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {!currentRepoPath && (
              <button
                type="button"
                onClick={() => setView('changes')}
                className="btn-ghost -ml-2 mt-1 px-2"
                title={messages.settings.backToStart}
                aria-label={messages.settings.backToStart}
              >
                <ArrowLeft size={17} aria-hidden />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-display font-semibold text-primary-text">{t.title}</h1>
              {signedIn && (
                <p className="mt-2 text-body text-secondary-text" aria-live="polite">
                  {summary}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {checkedAt !== null && <span className="text-meta tabular-nums text-secondary-text">{t.checkedAt(relativeTime(locale, new Date(checkedAt).toISOString()))}</span>}
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isLoading || busy}
              className="btn-ghost size-8 px-0"
              aria-label={t.refreshAria}
              title={t.refresh}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : undefined} aria-hidden />
            </button>
          </div>
        </header>
      </ActivitySky>

      <div className="inbox-column inbox-content">
        {error && (
          <p role="alert" className="flex items-start gap-1.5 rounded-md border border-danger-red/30 bg-danger-red-soft px-3 py-2 text-caption text-danger-red">
            <AlertCircle size={13} className="mt-px shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        )}
        {notice && !joined && (
          <div role="status" className="flex items-center gap-1.5 rounded-md border border-success-green/30 bg-success-green-soft px-3 py-2 text-caption text-success-green">
            <CheckCircle2 size={13} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 break-words">{notice}</span>
            <button type="button" onClick={clearNotice} className="hit-area shrink-0 rounded-sm p-0.5 hover:bg-hover-overlay" aria-label={messages.common.dismissSuccess}>
              <X size={13} aria-hidden />
            </button>
          </div>
        )}

        {signedIn === false ? (
          <PaneMessage icon={<Github size={20} aria-hidden />} title={t.signedOutTitle}>
            {t.signedOut}
          </PaneMessage>
        ) : hasMessages ? (
          <>
            {(invitations.length > 0 || joined) && (
              <section className="flex flex-col gap-3" aria-labelledby={invitationsHeading}>
                <h2 id={invitationsHeading} className="sr-only">
                  {t.invitationsTitle}
                </h2>
                {joined && (
                  <article className="inbox-invite is-merged">
                    <InvitationGraph inviter={joined} viewer={viewer} state="merged" />
                    <div className="min-w-48 flex-1">
                      <h3 className="truncate text-headline font-semibold text-primary-text">{joined.repoFullName}</h3>
                      <p role="status" className="mt-1 text-body text-success-green">
                        {t.acceptedShort}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a href={joined.htmlUrl.replace(/\/invitations$/, '')} target="_blank" rel="noreferrer" className="btn-secondary">
                        <ExternalLink size={14} aria-hidden />
                        {t.openOnGitHub}
                      </a>
                      <button type="button" onClick={dismissJoined} className="btn-ghost size-8 px-0" aria-label={messages.common.dismissSuccess}>
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  </article>
                )}
                {invitations.map((invitation) => {
                  const repo = invitation.repoFullName
                  const accepting = answeringId === invitation.id
                  return (
                    <article key={invitation.id} className="inbox-invite">
                      <InvitationGraph inviter={invitation} viewer={viewer} state={accepting ? 'merging' : 'pending'} />
                      <div className="min-w-48 flex-1">
                        <h3 className="flex min-w-0 items-center gap-2 text-headline font-semibold text-primary-text">
                          <span className="truncate">{repo}</span>
                          {invitation.isPrivate && (
                            <span className="shrink-0 text-tertiary-text" title={t.privateRepo}>
                              <Lock size={14} aria-label={t.privateRepo} />
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 text-body text-secondary-text">
                          {t.invitedBy(invitation.inviterLogin ?? t.someone, roleLabel(invitation.role), relativeTime(locale, invitation.createdAt))}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <a href={invitation.htmlUrl} target="_blank" rel="noreferrer" className="btn-ghost size-[34px] px-0" title={t.viewOnGitHub} aria-label={t.viewOnGitHubAria(repo)}>
                          <ExternalLink size={14} aria-hidden />
                        </a>
                        <button type="button" onClick={() => setDeclining(invitation)} disabled={busy} aria-label={t.declineAria(repo)} className="btn-secondary">
                          {t.decline}
                        </button>
                        <button type="button" onClick={() => void handleAccept(invitation)} disabled={busy} aria-label={t.acceptAria(repo)} className="btn-primary inbox-accept">
                          {accepting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
                          {t.accept}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </section>
            )}

            {notifications.length + stars.length > 0 && (
              <section className="flex flex-col gap-4" aria-labelledby={timelineHeading}>
                <h2 id={timelineHeading} className="sr-only">
                  {t.timelineTitle}
                </h2>
                {(showBoth || notifications.length > 0) && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {showBoth ? (
                      <div role="radiogroup" aria-label={t.filterAria} className="inbox-filter">
                        {filters.map(({ id, label, count }) => (
                          <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={shownFilter === id}
                            onClick={() => setFilter(id)}
                            className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-caption transition-colors ${
                              shownFilter === id ? 'bg-selection font-medium text-primary-text' : 'text-secondary-text hover:bg-hover-overlay hover:text-primary-text'
                            }`}
                          >
                            {label}
                            <span className="tabular-nums text-tertiary-text">{count}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span />
                    )}
                    {notifications.length > 0 && shownFilter !== 'stars' && (
                      <button type="button" onClick={() => void markAllRead()} className="section-action">
                        <Check size={13} aria-hidden />
                        {t.markAllRead}
                      </button>
                    )}
                  </div>
                )}
                <div key={shownFilter} className="flex flex-col gap-5">
                  {groups.map((group) => (
                    <div key={group.bucket} className="flex flex-col gap-2">
                      <h3 className="settings-heading">{t.buckets[group.bucket]}</h3>
                      <ul className="inbox-panel">{group.items.map(renderItem)}</ul>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : signedIn === null ? (
          isLoading && <LoadingRows label={t.loading} />
        ) : (
          <PaneMessage icon={<CheckCircle2 size={20} className="text-success-green" aria-hidden />} title={t.emptyTitle}>
            {t.empty}
          </PaneMessage>
        )}
      </div>

      <ConfirmDialog
        open={declining !== null}
        danger
        title={t.declineDialogTitle}
        message={declining ? t.declineDialogMessage(declining.repoFullName) : ''}
        confirmLabel={t.decline}
        onConfirm={() => {
          if (declining) void decline(declining)
          setDeclining(null)
        }}
        onCancel={() => setDeclining(null)}
      />
    </div>
  )
}

export default MessagesView
