import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMessages } from '../src/shared/i18n'
import type { RepositoryCollaborators } from '../src/shared/github'

const github = {
  getRepositoryCollaborators: vi.fn(),
  addCollaborator: vi.fn(),
  removeCollaborator: vi.fn(),
  cancelRepositoryInvitation: vi.fn()
}
vi.stubGlobal('window', { api: { github } })

const { usePullRequestStore } = await import('../src/renderer/src/store/pullRequestStore')
const { sessionKeyOf, useCollaboratorStore } = await import('../src/renderer/src/store/collaboratorStore')

const t = getMessages('pt-BR').collaborators

const REPO_A = { host: 'github.com', apiBase: 'https://api.github.com', owner: 'acme', repo: 'a' }
const REPO_B = { ...REPO_A, repo: 'b' }
const ME = { login: 'me', name: null, avatarUrl: '' }

function snapshot(change: Partial<RepositoryCollaborators> = {}): RepositoryCollaborators {
  return {
    ownerLogin: 'acme',
    ownerKind: 'org',
    canView: true,
    canAdminister: true,
    collaborators: [
      { login: 'alice', avatarUrl: '', role: 'write', direct: true },
      { login: 'team-only', avatarUrl: '', role: 'maintain', direct: false }
    ],
    invitations: [],
    invitationsError: null,
    ...change
  }
}

const store = (): ReturnType<typeof useCollaboratorStore.getState> => useCollaboratorStore.getState()
const logins = (): string[] | undefined => store().data?.collaborators.map((c) => c.login)
const banners = (): { error: string | null; success: string | null } => {
  const { error, successMessage } = usePullRequestStore.getState()
  return { error, success: successMessage }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: Error) => void } {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
  usePullRequestStore.setState({ remote: REPO_A, user: ME, error: null, successMessage: null })
  useCollaboratorStore.setState({
    sessionKey: sessionKeyOf(REPO_A, ME.login),
    data: snapshot(),
    isLoading: false,
    isSaving: false,
    loadError: null,
    fieldError: null
  })
})

describe('whose data the store holds', () => {
  it('does not keep one account\'s list for the next account on the same repository', async () => {
    usePullRequestStore.setState({ user: { ...ME, login: 'someone-else' } })
    const answer = deferred<RepositoryCollaborators>()
    github.getRepositoryCollaborators.mockReturnValue(answer.promise)

    const loading = store().load()

    expect(store().data).toBeNull()
    expect(store().sessionKey).toBe(sessionKeyOf(REPO_A, 'someone-else'))
    answer.resolve(snapshot({ canAdminister: false }))
    await loading
    expect(store().data?.canAdminister).toBe(false)
  })

  it('ignores a slower answer about the previous repository', async () => {
    const slow = deferred<RepositoryCollaborators>()
    github.getRepositoryCollaborators.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(snapshot({ ownerLogin: 'for-b' }))

    const first = store().load()
    usePullRequestStore.setState({ remote: REPO_B })
    await store().load()
    slow.resolve(snapshot({ ownerLogin: 'for-a' }))
    await first

    expect(store().data?.ownerLogin).toBe('for-b')
    expect(store().isLoading).toBe(false)
  })
})

describe('a write that lands after the user moved on', () => {
  it('leaves the new repository\'s list alone and names its own repository in the banner', async () => {
    const write = deferred<void>()
    github.removeCollaborator.mockReturnValue(write.promise)
    github.getRepositoryCollaborators.mockResolvedValue(snapshot())

    const removing = store().remove('alice')
    usePullRequestStore.setState({ remote: REPO_B })
    await store().load()
    write.resolve()
    await removing

    expect(logins()).toContain('alice')
    expect(banners().success).toBe(`acme/a: ${t.directAccessRemoved('alice')}`)
  })

  it('does the same for a failure, which must not look like it happened here', async () => {
    const write = deferred<void>()
    github.removeCollaborator.mockReturnValue(write.promise)

    const removing = store().remove('alice')
    usePullRequestStore.setState({ remote: REPO_B })
    write.reject(new Error('Forbidden'))
    await removing

    expect(banners().error).toBe('acme/a: Forbidden')
  })
})

describe('reads and writes overlapping', () => {
  it('does not let a load already in flight bring back someone just removed', async () => {
    const list = deferred<RepositoryCollaborators>()
    github.getRepositoryCollaborators.mockReturnValue(list.promise)
    github.removeCollaborator.mockResolvedValue(undefined)

    const loading = store().load()
    await store().remove('alice')
    list.resolve(snapshot())
    await loading

    expect(logins()).toEqual(['team-only'])
    expect(store().isLoading).toBe(false)
  })

  it('does not start a read of the same repository during a write', async () => {
    const write = deferred<void>()
    github.removeCollaborator.mockReturnValue(write.promise)

    const removing = store().remove('alice')
    await store().load()
    write.resolve()
    await removing

    expect(github.getRepositoryCollaborators).not.toHaveBeenCalled()
  })
})

describe('refreshing', () => {
  it('keeps the list on screen and reports through the banner when it fails', async () => {
    github.getRepositoryCollaborators.mockRejectedValue(new Error('offline'))
    await store().load()
    expect(logins()).toEqual(['alice', 'team-only'])
    expect(store().loadError).toBeNull()
    expect(banners().error).toBe('offline')
  })

  it('shows the error in place of the list when there is no list yet', async () => {
    useCollaboratorStore.setState({ data: null })
    github.getRepositoryCollaborators.mockRejectedValue(new Error('offline'))
    await store().load()
    expect(store().loadError).toBe('offline')
    expect(banners().error).toBeNull()
  })
})

describe('add', () => {
  it('shows someone added right away without reading the list back', async () => {
    github.addCollaborator.mockResolvedValue({ kind: 'added' })
    await expect(store().add('bruno', 'read')).resolves.toBe(true)
    expect(github.getRepositoryCollaborators).not.toHaveBeenCalled()
    expect(logins()).toEqual(['alice', 'bruno', 'team-only'])
    expect(store().data?.collaborators[1]).toMatchObject({ role: 'read', direct: true })
    expect(banners().success).toBe(t.added('bruno'))
  })

  it('turns inherited access into direct access instead of listing the person twice', async () => {
    github.addCollaborator.mockResolvedValue({ kind: 'added' })
    await store().add('TEAM-ONLY', 'admin')
    expect(logins()).toEqual(['alice', 'team-only'])
    expect(store().data?.collaborators[1]).toMatchObject({ role: 'admin', direct: true })
  })

  it('refuses someone with direct access, since the call would change their role', async () => {
    await expect(store().add('@ALICE')).resolves.toBe(false)
    expect(github.addCollaborator).not.toHaveBeenCalled()
    expect(store().fieldError).toBe(t.alreadyCollaborator('ALICE'))
  })

  it('refuses a second invitation while one is pending', async () => {
    useCollaboratorStore.setState({
      data: snapshot({ invitations: [{ id: 1, login: 'bruno', avatarUrl: null, role: 'write', createdAt: '', expired: false }] })
    })
    await expect(store().add('bruno')).resolves.toBe(false)
    expect(store().fieldError).toBe(t.alreadyInvited('bruno'))
  })

  it('lets an expired invitation be replaced by a new one', async () => {
    useCollaboratorStore.setState({
      data: snapshot({ invitations: [{ id: 1, login: 'bruno', avatarUrl: null, role: 'write', createdAt: '', expired: true }] })
    })
    const invitation = { id: 2, login: 'bruno', avatarUrl: null, role: 'write', createdAt: '', expired: false }
    github.addCollaborator.mockResolvedValue({ kind: 'invited', invitation })

    await expect(store().add('bruno')).resolves.toBe(true)

    expect(store().data?.invitations).toEqual([invitation])
  })

  it('tells an e-mail address apart from a username that is simply invalid', async () => {
    await store().add('someone@example.com')
    expect(store().fieldError).toBe(t.emailNotAccepted)
    await store().add('not valid')
    expect(store().fieldError).toBe(t.invalidUsername)
    expect(github.addCollaborator).not.toHaveBeenCalled()
  })

  it('sends only the login out of a pasted profile link', async () => {
    github.addCollaborator.mockResolvedValue({ kind: 'added' })
    await store().add('github.com/bruno?tab=repositories')
    expect(github.addCollaborator).toHaveBeenCalledWith('github.com', 'acme', 'a', 'bruno', undefined)
  })
})

describe('what the banner claims after a removal or role change', () => {
  it('only claims the direct access on an organization, where a team can still grant more', async () => {
    github.removeCollaborator.mockResolvedValue(undefined)
    await store().remove('alice')
    expect(banners().success).toBe(t.directAccessRemoved('alice'))
  })

  it('says the person was removed on a personal repository, where direct access is all there is', async () => {
    useCollaboratorStore.setState({ data: snapshot({ ownerKind: 'user' }) })
    github.removeCollaborator.mockResolvedValue(undefined)
    await store().remove('alice')
    expect(banners().success).toBe(t.removed('alice'))
  })

  it('describes a role change as the direct permission', async () => {
    github.addCollaborator.mockResolvedValue({ kind: 'added' })
    await store().changeRole('alice', 'read')
    expect(store().data?.collaborators[0].role).toBe('read')
    expect(banners().success).toBe(t.roleChanged('alice', t.roles.read))
  })

  it('leaves everything as it was when GitHub refuses, and says why', async () => {
    github.removeCollaborator.mockRejectedValue(new Error('Must have admin rights'))
    await store().remove('alice')
    expect(logins()).toContain('alice')
    expect(banners()).toEqual({ error: 'Must have admin rights', success: null })
    expect(store().isSaving).toBe(false)
  })
})
