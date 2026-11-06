import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMessages } from '../src/shared/i18n'
import type { GitHubNotification, ReceivedInvitation, RepositoryStar } from '../src/shared/github'

vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => 'token'), saveSecret: vi.fn(), deleteSecret: vi.fn() }))
vi.mock('../src/main/httpFetch', () => ({ httpFetch: vi.fn() }))

const github = {
  getReceivedInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  getRecentStars: vi.fn()
}
const app = { showNotification: vi.fn(async () => undefined) }
vi.stubGlobal('window', { api: { github, app } })
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value)
})
// The store picks its language from the OS, and the assertions below are in pt-BR.
vi.stubGlobal('navigator', { languages: ['pt-BR'] })

const { getSecret } = await import('../src/main/credentials')
const { httpFetch } = await import('../src/main/httpFetch')
const { tMain } = await import('../src/main/i18n')
const { acceptInvitation, declineInvitation, getNotifications, getReceivedInvitations, getRecentStars, markAllNotificationsRead, markNotificationRead } =
  await import('../src/main/githubApi')
const { pendingMessageCount, useInboxStore } = await import('../src/renderer/src/store/inboxStore')
const { buildTimeline } = await import('../src/renderer/src/lib/messageTimeline')
const { layoutSky } = await import('../src/renderer/src/lib/activitySky')

const t = getMessages('pt-BR').inbox
const store = (): ReturnType<typeof useInboxStore.getState> => useInboxStore.getState()

// The store remembers what it announced for the whole run, so each test gets its own ids.
let nextId = 1
function invitation(repoFullName = 'ana/financeiro'): ReceivedInvitation {
  return {
    id: nextId++,
    repoFullName,
    htmlUrl: `https://github.com/${repoFullName}/invitations`,
    isPrivate: true,
    inviterLogin: 'ana',
    inviterAvatarUrl: null,
    role: 'write',
    createdAt: '2026-11-06T19:32:23Z'
  }
}

function notification(id: string, change: Partial<GitHubNotification> = {}): GitHubNotification {
  return {
    id,
    kind: 'PullRequest',
    reason: 'review_requested',
    title: 'Corrige o frete',
    repoFullName: 'ana/financeiro',
    htmlUrl: 'https://github.com/ana/financeiro/pull/1',
    updatedAt: '2026-11-06T19:00:00Z',
    ...change
  }
}

function star(login: string, starredAt: string, repoFullName = 'me/app'): RepositoryStar {
  return { repoFullName, login, avatarUrl: '', profileUrl: `https://github.com/${login}`, starredAt }
}

const daysAgo = (days: number): string => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

function respond(status: number, body?: unknown): void {
  vi.mocked(httpFetch).mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSecret).mockResolvedValue('token')
  github.getNotifications.mockResolvedValue([])
  github.getRecentStars.mockResolvedValue([])
  useInboxStore.setState({
    invitations: [],
    notifications: [],
    stars: [],
    starsSeenAt: Date.now() - 1000,
    signedIn: null,
    isLoading: false,
    answeringId: null,
    error: null,
    notice: null
  })
})

describe('getNotifications', () => {
  const api = (id: string, type: string, url: string | null, reason = 'mention'): object => ({
    id,
    reason,
    updated_at: '2026-11-06T19:00:00Z',
    subject: { title: `t${id}`, type, url },
    repository: { full_name: 'o/r', html_url: 'https://github.com/o/r' }
  })

  it('turns API addresses into pages a person can open, and leaves invitations to their own list', async () => {
    respond(200, [
      api('1', 'PullRequest', 'https://api.github.com/repos/o/r/pulls/5'),
      api('2', 'Issue', 'https://api.github.com/repos/o/r/issues/6'),
      api('3', 'Commit', 'https://api.github.com/repos/o/r/commits/abc'),
      api('4', 'Release', 'https://api.github.com/repos/o/r/releases/9'),
      api('5', 'Discussion', null),
      api('6', 'CheckSuite', null),
      api('7', 'RepositoryInvitation', null)
    ])
    const result = await getNotifications('github.com')
    expect(result?.map((n) => [n.id, n.htmlUrl])).toEqual([
      ['1', 'https://github.com/o/r/pull/5'],
      ['2', 'https://github.com/o/r/issues/6'],
      ['3', 'https://github.com/o/r/commit/abc'],
      ['4', 'https://github.com/o/r/releases'],
      ['5', 'https://github.com/o/r/discussions'],
      ['6', 'https://github.com/o/r/actions']
    ])
  })

  it('marks one thread, or everything up to a date, as read', async () => {
    // GitHub answers these with 205, which has no body to parse.
    respond(205)
    await markNotificationRead('github.com', '42')
    respond(205)
    await markAllNotificationsRead('github.com', '2026-11-06T19:00:00Z')
    const [first, second] = vi.mocked(httpFetch).mock.calls
    expect([new URL(String(first[0])).pathname, first[1]?.method]).toEqual(['/notifications/threads/42', 'PATCH'])
    expect([new URL(String(second[0])).pathname, second[1]?.method]).toEqual(['/notifications', 'PUT'])
    expect(JSON.parse(String(second[1]?.body))).toEqual({ last_read_at: '2026-11-06T19:00:00Z' })
  })
})

describe('getRecentStars', () => {
  const answer = (edges: object[], login = 'me'): object => ({
    data: { viewer: { login, repositories: { nodes: [{ nameWithOwner: 'me/app', stargazers: { edges } }] } } }
  })
  const edge = (who: string, starredAt: string): object => ({
    starredAt,
    node: { login: who, avatarUrl: `https://a/${who}`, url: `https://github.com/${who}` }
  })

  it('lists stars newest first, without the account itself or old ones', async () => {
    respond(200, answer([edge('old', daysAgo(60)), edge('me', daysAgo(0)), edge('ana', daysAgo(5)), edge('bia', daysAgo(1))]))
    const result = await getRecentStars('github.com')
    expect(result?.map((s) => s.login)).toEqual(['bia', 'ana'])
    expect(result?.[0]).toMatchObject({ repoFullName: 'me/app', profileUrl: 'https://github.com/bia' })
  })

  it('treats no sign-in as null', async () => {
    vi.mocked(getSecret).mockResolvedValue(null)
    await expect(getRecentStars('github.com')).resolves.toBeNull()
  })
})

describe('getReceivedInvitations', () => {
  const api = (id: number, change: object = {}): object => ({
    id,
    html_url: `https://github.com/o/r${id}/invitations`,
    permissions: 'write',
    created_at: '2026-11-06T19:32:23Z',
    repository: { full_name: `o/r${id}`, private: true },
    inviter: { login: 'ana', avatar_url: 'https://a/ana' },
    ...change
  })

  it('maps pending invitations and leaves out expired ones', async () => {
    respond(200, [api(1), api(2, { expired: true }), api(3, { inviter: null })])
    await expect(getReceivedInvitations('github.com')).resolves.toEqual([
      {
        id: 1,
        repoFullName: 'o/r1',
        htmlUrl: 'https://github.com/o/r1/invitations',
        isPrivate: true,
        inviterLogin: 'ana',
        inviterAvatarUrl: 'https://a/ana',
        role: 'write',
        createdAt: '2026-11-06T19:32:23Z'
      },
      {
        id: 3,
        repoFullName: 'o/r3',
        htmlUrl: 'https://github.com/o/r3/invitations',
        isPrivate: true,
        inviterLogin: null,
        inviterAvatarUrl: null,
        role: 'write',
        createdAt: '2026-11-06T19:32:23Z'
      }
    ])
  })

  it('treats no sign-in as null without calling GitHub', async () => {
    vi.mocked(getSecret).mockResolvedValue(null)
    await expect(getReceivedInvitations('github.com')).resolves.toBeNull()
    expect(httpFetch).not.toHaveBeenCalled()
  })

  it('treats a dead token as null, but reports any other failure', async () => {
    respond(401, { message: 'Bad credentials' })
    await expect(getReceivedInvitations('github.com')).resolves.toBeNull()
    respond(500, { message: 'Server Error' })
    await expect(getReceivedInvitations('github.com')).rejects.toThrow('Server Error')
  })
})

describe('answering an invitation', () => {
  it('uses PATCH to accept and DELETE to decline', async () => {
    respond(204)
    await acceptInvitation('github.com', 7)
    respond(204)
    await declineInvitation('github.com', 7)
    const calls = vi.mocked(httpFetch).mock.calls.map(([url, init]) => [new URL(String(url)).pathname, init?.method])
    expect(calls).toEqual([
      ['/user/repository_invitations/7', 'PATCH'],
      ['/user/repository_invitations/7', 'DELETE']
    ])
  })

  it('explains an invitation that no longer exists', async () => {
    respond(404, { message: 'Not Found' })
    await expect(acceptInvitation('github.com', 7)).rejects.toThrow(tMain().github.invitationGone)
  })
})

describe('inbox store', () => {
  it('announces an invitation once per run, however many checks see it', async () => {
    const one = invitation()
    github.getReceivedInvitations.mockResolvedValue([one])
    await store().refresh()
    await store().refresh()
    expect(app.showNotification).toHaveBeenCalledTimes(1)
    expect(app.showNotification).toHaveBeenCalledWith(t.notificationInviteTitle, t.notificationInviteBody('ana', 'ana/financeiro'))
    expect(store().invitations).toEqual([one])
    expect(store().signedIn).toBe(true)
  })

  it('announces several new invitations in a single notification', async () => {
    github.getReceivedInvitations.mockResolvedValue([invitation('a/one'), invitation('b/two')])
    await store().refresh()
    expect(app.showNotification).toHaveBeenCalledTimes(1)
    expect(app.showNotification).toHaveBeenCalledWith(t.notificationManyTitle(2), 'a/one, b/two')
    expect(pendingMessageCount(store())).toBe(2)
  })

  it('stays quiet and empties every list when signed out', async () => {
    useInboxStore.setState({ invitations: [invitation()], notifications: [notification('gone')], stars: [star('ana', daysAgo(0))], signedIn: true })
    github.getReceivedInvitations.mockResolvedValue(null)
    github.getNotifications.mockResolvedValue(null)
    github.getRecentStars.mockResolvedValue(null)
    await store().refresh()
    expect(store().invitations).toEqual([])
    expect(store().notifications).toEqual([])
    expect(store().stars).toEqual([])
    expect(store().signedIn).toBe(false)
    expect(app.showNotification).not.toHaveBeenCalled()
  })

  it('keeps the list when a check fails', async () => {
    const one = invitation()
    useInboxStore.setState({ invitations: [one], signedIn: true })
    github.getReceivedInvitations.mockRejectedValue(new Error('offline'))
    await store().refresh()
    expect(store().invitations).toEqual([one])
    expect(store().error).toBe('offline')
    expect(store().isLoading).toBe(false)
  })

  it('still delivers the rest when one source fails', async () => {
    const one = invitation()
    github.getReceivedInvitations.mockResolvedValue([one])
    github.getRecentStars.mockRejectedValue(new Error('stars unavailable'))
    await store().refresh()
    expect(store().invitations).toEqual([one])
    expect(store().error).toBe('stars unavailable')
    expect(app.showNotification).toHaveBeenCalledTimes(1)
  })

  it('announces new activity on a notification it already announced', async () => {
    github.getReceivedInvitations.mockResolvedValue([])
    github.getNotifications.mockResolvedValue([notification('thread-1')])
    await store().refresh()
    await store().refresh()
    expect(app.showNotification).toHaveBeenCalledTimes(1)
    github.getNotifications.mockResolvedValue([notification('thread-1', { updatedAt: '2026-11-06T20:00:00Z' })])
    await store().refresh()
    expect(app.showNotification).toHaveBeenCalledTimes(2)
  })

  it('counts and announces only stars newer than the last visit', async () => {
    useInboxStore.setState({ starsSeenAt: Date.parse(daysAgo(2)) })
    github.getReceivedInvitations.mockResolvedValue([])
    github.getRecentStars.mockResolvedValue([star('fresh', daysAgo(1)), star('stale', daysAgo(3))])
    await store().refresh()
    expect(pendingMessageCount(store())).toBe(1)
    expect(app.showNotification).toHaveBeenCalledTimes(1)
    expect(app.showNotification).toHaveBeenCalledWith(t.notificationStarTitle, t.notificationStarBody('fresh', 'me/app'))
  })

  it('remembers across runs that the stars were seen', () => {
    useInboxStore.setState({ stars: [star('ana', daysAgo(1))], starsSeenAt: Date.parse(daysAgo(2)) })
    expect(pendingMessageCount(store())).toBe(1)
    store().markStarsSeen()
    expect(pendingMessageCount(store())).toBe(0)
    expect(Number(storage.get('inbox.starsSeenAt'))).toBe(store().starsSeenAt)
  })

  it('removes a notification marked as read, and restores it if GitHub refuses', async () => {
    const one = notification('r1')
    useInboxStore.setState({ notifications: [one] })
    github.markNotificationRead.mockResolvedValueOnce(undefined)
    await store().markRead('r1')
    expect(store().notifications).toEqual([])

    useInboxStore.setState({ notifications: [one] })
    github.markNotificationRead.mockRejectedValueOnce(new Error('denied'))
    await store().markRead('r1')
    expect(store().notifications).toEqual([one])
    expect(store().error).toBe('denied')
  })

  it('marks everything read only up to the newest item on screen', async () => {
    useInboxStore.setState({ notifications: [notification('a', { updatedAt: '2026-11-06T20:00:00Z' }), notification('b')] })
    github.markAllNotificationsRead.mockResolvedValue(undefined)
    await store().markAllRead()
    expect(github.markAllNotificationsRead).toHaveBeenCalledWith('github.com', '2026-11-06T20:00:00Z')
    expect(store().notifications).toEqual([])
  })

  it('removes an answered invitation and confirms it', async () => {
    const one = invitation()
    useInboxStore.setState({ invitations: [one], signedIn: true })
    github.acceptInvitation.mockResolvedValue(undefined)
    await store().accept(one)
    expect(github.acceptInvitation).toHaveBeenCalledWith('github.com', one.id)
    expect(store().invitations).toEqual([])
    expect(store().notice).toBe(t.accepted('ana/financeiro'))
  })

  it('keeps the invitation when answering fails', async () => {
    const one = invitation()
    useInboxStore.setState({ invitations: [one], signedIn: true })
    github.declineInvitation.mockRejectedValue(new Error('denied'))
    await store().decline(one)
    expect(store().invitations).toEqual([one])
    expect(store().error).toBe('denied')
    expect(store().answeringId).toBeNull()
  })

  it('does not let a check that started earlier bring back an answered invitation', async () => {
    const one = invitation()
    useInboxStore.setState({ invitations: [one], signedIn: true })
    let finishCheck: (value: ReceivedInvitation[]) => void = () => undefined
    github.getReceivedInvitations.mockReturnValue(new Promise((resolve) => (finishCheck = resolve)))
    const check = store().refresh()
    github.acceptInvitation.mockResolvedValue(undefined)
    await store().accept(one)
    finishCheck([one])
    await check
    expect(store().invitations).toEqual([])
  })
})

describe('buildTimeline', () => {
  const now = new Date(2026, 10, 6, 15, 0)
  const at = (day: number, hour = 9): string => new Date(2026, 10, day, hour).toISOString()

  it('merges notifications and stars newest first, under the day they happened', () => {
    const groups = buildTimeline(
      [notification('today', { updatedAt: at(6, 8) }), notification('old', { updatedAt: new Date(2026, 9, 20).toISOString() })],
      [star('ana', at(6, 10)), star('bia', at(5)), star('caio', at(3))],
      now
    )
    expect(groups.map((group) => [group.bucket, group.items.map((item) => item.key)])).toEqual([
      ['today', ['star:me/app:ana', 'notification:today']],
      ['yesterday', ['star:me/app:bia']],
      ['week', ['star:me/app:caio']],
      ['earlier', ['notification:old']]
    ])
  })

  it('leaves out days with nothing in them', () => {
    expect(buildTimeline([], [], now)).toEqual([])
  })
})

describe('layoutSky', () => {
  const now = Date.parse('2026-11-06T12:00:00Z')
  const ago = (days: number): string => new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
  const items = (stars: RepositoryStar[]) => buildTimeline([], stars, new Date(now)).flatMap((group) => group.items)

  it('runs time left to right toward the present, with one lane per repository', () => {
    const sky = layoutSky(items([star('new', ago(1), 'a/one'), star('old', ago(20), 'b/two')]), 1000, 340, now)
    expect(sky.lanes.map((lane) => lane.repo)).toEqual(['a/one', 'b/two'])
    const [newest, oldest] = sky.points
    expect(newest.item.key).toBe('star:a/one:new')
    expect(newest.x).toBeGreaterThan(oldest.x)
    expect(newest.y).not.toBe(oldest.y)
    expect(sky.head.x).toBeGreaterThan(newest.x)
  })

  it('keeps the busiest repositories on the map and the page within bounds', () => {
    const many = Array.from({ length: 9 }, (_, index) => star(`p${index}`, ago(index), `o/r${index}`))
    const sky = layoutSky(items(many), 1000, 340, now)
    expect(sky.lanes).toHaveLength(5)
    expect(sky.points).toHaveLength(5)
    for (const point of sky.points) {
      expect(point.x).toBeGreaterThan(0)
      expect(point.x).toBeLessThan(1000)
      expect(point.y).toBeLessThan(340)
    }
  })

  it('fans out things that happened together', () => {
    const sky = layoutSky(items([star('a', ago(1)), star('b', ago(1)), star('c', ago(1))]), 1000, 340, now)
    expect(new Set(sky.points.map((point) => point.y)).size).toBe(3)
  })

  it('draws nothing when there is nothing to place', () => {
    const sky = layoutSky([], 1000, 340, now)
    expect(sky.points).toEqual([])
    expect(sky.path).toBe('')
  })
})
