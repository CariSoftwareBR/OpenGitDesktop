import { create } from 'zustand'
import type { GitHubNotification, ReceivedInvitation, RepositoryStar } from '../../../shared/github'
import { getT } from '../lib/i18n'

// Everything here belongs to an account rather than a repository, so this
// follows the same default host the start screen signs in to.
const HOST = 'github.com'

const STARS_SEEN_KEY = 'inbox.starsSeenAt'
// GitHub doesn't track stars as read, so "new" has to be remembered here. The
// first time, only the last few days count, not every star in the recent list.
const FIRST_RUN_NEW_STARS_DAYS = 7

function readStarsSeenAt(): number {
  const stored = Number(localStorage.getItem(STARS_SEEN_KEY))
  if (stored) return stored
  const baseline = Date.now() - FIRST_RUN_NEW_STARS_DAYS * 24 * 60 * 60 * 1000
  localStorage.setItem(STARS_SEEN_KEY, String(baseline))
  return baseline
}

export function isNewStar(star: RepositoryStar, seenAt: number): boolean {
  return Date.parse(star.starredAt) > seenAt
}

interface InboxStoreState {
  invitations: ReceivedInvitation[]
  notifications: GitHubNotification[]
  stars: RepositoryStar[]
  starsSeenAt: number
  /** Null until the first answer, so the view doesn't claim "no messages" before it knows. */
  signedIn: boolean | null
  isLoading: boolean
  /** The invitation being accepted or declined. */
  answeringId: number | null
  /** When a check last completed, so the tab can show the background work is alive. */
  checkedAt: number | null
  error: string | null
  notice: string | null

  refresh: () => Promise<void>
  accept: (invitation: ReceivedInvitation) => Promise<void>
  decline: (invitation: ReceivedInvitation) => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  markStarsSeen: () => void
  clearNotice: () => void
}

/** What the count on the tab shows: everything still waiting for this person. */
export function pendingMessageCount(state: Pick<InboxStoreState, 'invitations' | 'notifications' | 'stars' | 'starsSeenAt'>): number {
  return state.invitations.length + state.notifications.length + state.stars.filter((star) => isNewStar(star, state.starsSeenAt)).length
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Kept per run on purpose: something still waiting is announced again the next
// time the program starts, but not on every background check in between. A
// notification's key includes its date, so new activity on it counts as news.
const announced = new Set<string>()

function announce({ invitations, notifications, stars, starsSeenAt }: InboxStoreState): void {
  const t = getT().inbox
  const candidates = [
    ...invitations.map((i) => ({
      key: `invitation:${i.id}`,
      repo: i.repoFullName,
      title: t.notificationInviteTitle,
      body: t.notificationInviteBody(i.inviterLogin ?? t.someone, i.repoFullName)
    })),
    ...notifications.map((n) => ({
      key: `notification:${n.id}:${n.updatedAt}`,
      repo: n.repoFullName,
      title: t.kinds[n.kind] ?? n.kind,
      body: `${n.title} (${n.repoFullName})`
    })),
    ...stars
      .filter((star) => isNewStar(star, starsSeenAt))
      .map((star) => ({
        key: `star:${star.repoFullName}:${star.login}`,
        repo: star.repoFullName,
        title: t.notificationStarTitle,
        body: t.notificationStarBody(star.login, star.repoFullName)
      }))
  ]
  const fresh = candidates.filter((item) => !announced.has(item.key))
  if (fresh.length === 0) return
  fresh.forEach((item) => announced.add(item.key))
  const notification =
    fresh.length === 1
      ? window.api.app.showNotification(fresh[0].title, fresh[0].body)
      : window.api.app.showNotification(t.notificationManyTitle(fresh.length), [...new Set(fresh.map((item) => item.repo))].slice(0, 3).join(', '))
  // The tab's count still shows them, so a refused notification costs nothing more than a log line.
  notification.catch((err: unknown) => console.error('Could not show the notification:', err))
}

// A slower answer must not bring back something answered after it was read.
let loadGeneration = 0

export const useInboxStore = create<InboxStoreState>((set, get) => {
  async function answer(
    invitation: ReceivedInvitation,
    call: (host: string, id: number) => Promise<void>,
    notice: (repo: string) => string
  ): Promise<void> {
    if (get().answeringId !== null) return
    loadGeneration++
    set({ answeringId: invitation.id, isLoading: false, error: null, notice: null })
    try {
      await call(HOST, invitation.id)
      set((state) => ({
        invitations: state.invitations.filter((i) => i.id !== invitation.id),
        notice: notice(invitation.repoFullName)
      }))
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ answeringId: null })
    }
  }

  return {
    invitations: [],
    notifications: [],
    stars: [],
    starsSeenAt: readStarsSeenAt(),
    signedIn: null,
    isLoading: false,
    answeringId: null,
    checkedAt: null,
    error: null,
    notice: null,

    refresh: async () => {
      if (get().answeringId !== null) return
      const generation = ++loadGeneration
      set({ isLoading: true })
      // Each source can fail alone: stars being unavailable shouldn't hide an invitation.
      const [invitations, notifications, stars] = await Promise.allSettled([
        window.api.github.getReceivedInvitations(HOST),
        window.api.github.getNotifications(HOST),
        window.api.github.getRecentStars(HOST)
      ])
      if (generation !== loadGeneration) return
      const signedOut = invitations.status === 'fulfilled' && invitations.value === null
      const failure = [invitations, notifications, stars].find((result) => result.status === 'rejected')
      // A star query that GitHub only half answers must not freeze "last
      // checked". The timestamp moves when anything came back; it stays put
      // only when every source failed, so an offline startup retries from the
      // same clock. The error for the source that failed is still shown.
      const delivered = [invitations, notifications, stars].some((result) => result.status === 'fulfilled')
      set((state) => ({
        invitations: invitations.status === 'fulfilled' ? (invitations.value ?? []) : state.invitations,
        notifications: signedOut ? [] : notifications.status === 'fulfilled' ? (notifications.value ?? []) : state.notifications,
        stars: signedOut ? [] : stars.status === 'fulfilled' ? (stars.value ?? []) : state.stars,
        signedIn: invitations.status === 'fulfilled' ? !signedOut : state.signedIn,
        error: failure ? describeError(failure.reason) : null,
        checkedAt: delivered ? Date.now() : state.checkedAt,
        isLoading: false
      }))
      announce(get())
    },

    accept: (invitation) => answer(invitation, window.api.github.acceptInvitation, getT().inbox.accepted),
    decline: (invitation) => answer(invitation, window.api.github.declineInvitation, getT().inbox.declined),

    markRead: async (id) => {
      const previous = get().notifications
      loadGeneration++
      set({ notifications: previous.filter((n) => n.id !== id), isLoading: false, error: null })
      try {
        await window.api.github.markNotificationRead(HOST, id)
      } catch (err) {
        set({ notifications: previous, error: describeError(err) })
      }
    },

    markAllRead: async () => {
      const previous = get().notifications
      const [newest] = previous
      if (!newest) return
      loadGeneration++
      set({ notifications: [], isLoading: false, error: null })
      try {
        await window.api.github.markAllNotificationsRead(HOST, newest.updatedAt)
      } catch (err) {
        set({ notifications: previous, error: describeError(err) })
      }
    },

    markStarsSeen: () => {
      const now = Date.now()
      localStorage.setItem(STARS_SEEN_KEY, String(now))
      set({ starsSeenAt: now })
    },

    clearNotice: () => set({ notice: null })
  }
})
