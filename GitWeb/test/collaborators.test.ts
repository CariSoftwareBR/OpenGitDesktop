import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canManageCollaborator, normalizeGitHubUsername } from '../src/shared/github'
import { getMessages } from '../src/shared/i18n'

vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => 'token'), saveSecret: vi.fn(), deleteSecret: vi.fn() }))
vi.mock('../src/main/httpFetch', () => ({ httpFetch: vi.fn() }))

const { httpFetch } = await import('../src/main/httpFetch')
const { addCollaborator, cancelRepositoryInvitation, getRepositoryCollaborators, removeCollaborator } = await import(
  '../src/main/githubApi'
)

type Route = { status: number; body?: unknown }

function serve(routes: Record<string, Route>): void {
  vi.mocked(httpFetch).mockImplementation(async (url: string) => {
    const { pathname, search } = new URL(url)
    const route = routes[pathname + search] ?? routes[pathname] ?? { status: 404, body: { message: 'Not Found' } }
    return new Response(route.body === undefined ? null : JSON.stringify(route.body), { status: route.status })
  })
}

function requestedUrls(): string[] {
  return vi.mocked(httpFetch).mock.calls.map(([url]) => String(url))
}

const person = (login: string, role_name = 'write'): object => ({ login, avatar_url: `https://a/${login}`, role_name })
const repo = (type: string, permissions: object): Route => ({ status: 200, body: { owner: { login: 'current-owner', type }, permissions } })

const ALL = '/repos/o/r/collaborators?affiliation=all&per_page=100'
const DIRECT = '/repos/o/r/collaborators?affiliation=direct&per_page=100'
const INVITATIONS = '/repos/o/r/invitations?per_page=100'

beforeEach(() => {
  vi.mocked(httpFetch).mockReset()
})

describe('getRepositoryCollaborators', () => {
  it('treats everyone on a personal repository as direct, without asking twice', async () => {
    serve({
      '/repos/o/r': repo('User', { admin: true, push: true }),
      [ALL]: { status: 200, body: [person('zed'), person('Ana', 'admin')] },
      [INVITATIONS]: { status: 200, body: [] }
    })
    const result = await getRepositoryCollaborators('github.com', 'o', 'r')
    expect(result.ownerKind).toBe('user')
    expect(result.ownerLogin).toBe('current-owner')
    expect(result.collaborators.map((c) => [c.login, c.role, c.direct])).toEqual([
      ['Ana', 'admin', true],
      ['zed', 'write', true]
    ])
    expect(requestedUrls().some((url) => url.includes('affiliation=direct'))).toBe(false)
  })

  it('marks organization access that only comes from a team or the org as inherited', async () => {
    serve({
      '/repos/o/r': repo('Organization', { admin: true, push: true }),
      [ALL]: { status: 200, body: [person('direct-one'), person('via-team', 'maintain')] },
      [DIRECT]: { status: 200, body: [person('direct-one')] },
      [INVITATIONS]: { status: 200, body: [] }
    })
    const { collaborators } = await getRepositoryCollaborators('github.com', 'o', 'r')
    expect(collaborators.map((c) => [c.login, c.direct])).toEqual([
      ['direct-one', true],
      ['via-team', false]
    ])
  })

  it('does not ask for a list GitHub would refuse to an account without write access', async () => {
    serve({ '/repos/o/r': repo('User', { admin: false, push: false }) })
    const result = await getRepositoryCollaborators('github.com', 'o', 'r')
    expect(result).toMatchObject({ canView: false, canAdminister: false, collaborators: [] })
    expect(requestedUrls()).toHaveLength(1)
  })

  it('only reads invitations for admins, since they are the ones GitHub lists them to', async () => {
    serve({
      '/repos/o/r': repo('User', { admin: false, push: true }),
      [ALL]: { status: 200, body: [person('me')] }
    })
    const result = await getRepositoryCollaborators('github.com', 'o', 'r')
    expect(result).toMatchObject({ canView: true, canAdminister: false, invitations: [] })
    expect(requestedUrls().some((url) => url.includes('/invitations'))).toBe(false)
  })

  it('still shows the collaborators when only the invitations fail', async () => {
    serve({
      '/repos/o/r': repo('User', { admin: true }),
      [ALL]: { status: 200, body: [person('me')] },
      [INVITATIONS]: { status: 403, body: { message: 'Resource not accessible by personal access token' } }
    })
    const result = await getRepositoryCollaborators('github.com', 'o', 'r')
    expect(result.collaborators).toHaveLength(1)
    expect(result.invitationsError).toBe('Resource not accessible by personal access token')
  })

  it('explains an organization refusing the list, keeping GitHub\'s reason', async () => {
    serve({
      '/repos/o/r': repo('Organization', { admin: true }),
      [ALL]: { status: 403, body: { message: 'Forbidden' } },
      [DIRECT]: { status: 403, body: { message: 'Forbidden' } }
    })
    await expect(getRepositoryCollaborators('github.com', 'o', 'r')).rejects.toThrow(
      getMessages('pt-BR').main.github.collaboratorsForbidden('Forbidden')
    )
  })
})

describe('addCollaborator', () => {
  it('reports a 201 as a pending invitation', async () => {
    serve({
      '/repos/o/r/collaborators/new-person': {
        status: 201,
        body: { id: 7, invitee: { login: 'new-person', avatar_url: 'https://a/new-person' }, permissions: 'write', created_at: '2026-11-06T10:00:00Z', expired: false }
      }
    })
    await expect(addCollaborator('github.com', 'o', 'r', 'new-person')).resolves.toEqual({
      kind: 'invited',
      invitation: { id: 7, login: 'new-person', avatarUrl: 'https://a/new-person', role: 'write', createdAt: '2026-11-06T10:00:00Z', expired: false }
    })
  })

  it('reports a 204 as access changed right away', async () => {
    serve({ '/repos/o/r/collaborators/member': { status: 204 } })
    await expect(addCollaborator('github.com', 'o', 'r', 'member', 'maintain')).resolves.toEqual({ kind: 'added' })
  })

  it('translates the role to the name the endpoint expects, and sends none when there is none', async () => {
    serve({ '/repos/o/r/collaborators/member': { status: 204 } })
    await addCollaborator('github.com', 'o', 'r', 'member', 'read')
    await addCollaborator('github.com', 'o', 'r', 'member', 'write')
    await addCollaborator('github.com', 'o', 'r', 'member')
    const bodies = vi.mocked(httpFetch).mock.calls.map(([, init]) => init?.body)
    expect(bodies).toEqual(['{"permission":"pull"}', '{"permission":"push"}', '{}'])
    expect(vi.mocked(httpFetch).mock.calls[0][1]?.method).toBe('PUT')
  })

  it('names the person when GitHub answers 404', async () => {
    serve({})
    await expect(addCollaborator('github.com', 'o', 'r', 'ghost')).rejects.toThrow(
      getMessages('pt-BR').main.github.collaboratorNotFound('ghost')
    )
  })

  it('passes along why GitHub refused', async () => {
    serve({ '/repos/o/r/collaborators/x': { status: 403, body: { message: 'Must have admin rights to Repository.' } } })
    await expect(addCollaborator('github.com', 'o', 'r', 'x')).rejects.toThrow('Must have admin rights to Repository.')
  })
})

describe('removal', () => {
  it('deletes the collaborator and the invitation on their own endpoints', async () => {
    serve({ '/repos/o/r/collaborators/someone': { status: 204 }, '/repos/o/r/invitations/9': { status: 204 } })
    await removeCollaborator('github.com', 'o', 'r', 'someone')
    await cancelRepositoryInvitation('github.com', 'o', 'r', 9)
    expect(vi.mocked(httpFetch).mock.calls.map(([url, init]) => [new URL(String(url)).pathname, init?.method])).toEqual([
      ['/repos/o/r/collaborators/someone', 'DELETE'],
      ['/repos/o/r/invitations/9', 'DELETE']
    ])
  })

  it('cannot be aimed at another path through the username', async () => {
    serve({})
    await removeCollaborator('github.com', 'o', 'r', '../../../user').catch(() => undefined)
    expect(requestedUrls()[0]).toContain('/collaborators/..%2F..%2F..%2Fuser')
  })
})

describe('normalizeGitHubUsername', () => {
  it.each([
    ['octocat', 'octocat'],
    ['  octocat  ', 'octocat'],
    ['@octocat', 'octocat'],
    ['https://github.com/octocat', 'octocat'],
    ['https://github.com/octocat/', 'octocat'],
    ['https://github.com/octocat?tab=repositories', 'octocat'],
    ['https://github.com/octocat#readme', 'octocat'],
    ['github.com/octocat', 'octocat'],
    ['www.github.com/octocat/', 'octocat'],
    ['https://github.example.com:8443/octocat', 'octocat'],
    ['octo-cat', 'octo-cat'],
    ['octo_corp', 'octo_corp'],
    ['a', 'a']
  ])('reads %j as %j', (input, expected) => {
    expect(normalizeGitHubUsername(input)).toBe(expected)
  })

  it.each(['', '   ', 'someone@example.com', '-octocat', 'octocat-', 'two words', 'octocat/repo', 'github.com/octocat/repo', 'github.com', 'a'.repeat(40)])(
    'rejects %j',
    (input) => {
      expect(normalizeGitHubUsername(input)).toBeNull()
    }
  )
})

describe('canManageCollaborator', () => {
  const context = { canAdminister: true, owner: 'Owner', viewer: 'Me' }
  const collaborator = (login: string, direct = true): { login: string; avatarUrl: string; role: string; direct: boolean } => ({
    login,
    avatarUrl: '',
    role: 'write',
    direct
  })

  it('allows a direct collaborator for an admin', () => {
    expect(canManageCollaborator(collaborator('someone'), context)).toBe(true)
  })

  it('never offers the owner or the signed-in account, whatever the casing', () => {
    expect(canManageCollaborator(collaborator('owner'), context)).toBe(false)
    expect(canManageCollaborator(collaborator('ME'), context)).toBe(false)
  })

  it('leaves inherited access alone', () => {
    expect(canManageCollaborator(collaborator('via-team', false), context)).toBe(false)
  })

  it('offers nothing to someone who is not an admin', () => {
    expect(canManageCollaborator(collaborator('someone'), { ...context, canAdminister: false })).toBe(false)
  })
})
