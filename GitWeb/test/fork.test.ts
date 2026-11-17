import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseForkTarget } from '../src/shared/github'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => 'token'), saveSecret: vi.fn(), deleteSecret: vi.fn() }))
vi.mock('../src/main/httpFetch', () => ({ httpFetch: vi.fn() }))

const { httpFetch } = await import('../src/main/httpFetch')
const { forkRepository, getForkSource } = await import('../src/main/githubApi')
const { addUpstreamRemote, fetchUpstream, getUpstreamStatus, syncWithUpstream } = await import('../src/main/gitProcess')

describe('parseForkTarget', () => {
  it('reads owner/repo, clone URLs and page URLs', () => {
    const kan = { owner: 'kanbn', name: 'kan' }
    expect(parseForkTarget('kanbn/kan')).toEqual(kan)
    expect(parseForkTarget('  https://github.com/kanbn/kan  ')).toEqual(kan)
    expect(parseForkTarget('https://github.com/kanbn/kan.git')).toEqual(kan)
    expect(parseForkTarget('github.com/kanbn/kan')).toEqual(kan)
    expect(parseForkTarget('https://www.github.com/kanbn/kan/tree/main/apps')).toEqual(kan)
    expect(parseForkTarget('git@github.com:kanbn/kan.git')).toEqual(kan)
    expect(parseForkTarget('ssh://git@github.com/kanbn/kan')).toEqual(kan)
    expect(parseForkTarget('vercel/next.js')).toEqual({ owner: 'vercel', name: 'next.js' })
  })

  it('refuses other hosts and things that are not a repository', () => {
    expect(parseForkTarget('')).toBeNull()
    expect(parseForkTarget('kanbn')).toBeNull()
    expect(parseForkTarget('https://github.com/kanbn')).toBeNull()
    expect(parseForkTarget('https://gitlab.com/kanbn/kan')).toBeNull()
    expect(parseForkTarget('file:///github.com/a/b')).toBeNull()
    expect(parseForkTarget('a b/kan')).toBeNull()
    expect(parseForkTarget('kanbn/..')).toBeNull()
  })
})

type Route = { status: number; body?: unknown } | Route[]

/** Routes by path; an array answers in turn, repeating its last entry. */
function serve(routes: Record<string, Route>): void {
  const calls = new Map<string, number>()
  vi.mocked(httpFetch).mockImplementation(async (url: string | URL) => {
    const { pathname, search } = new URL(String(url), 'https://api.github.com')
    const key = routes[pathname + search] ? pathname + search : pathname
    let route = routes[key] ?? { status: 404, body: { message: 'Not Found' } }
    if (Array.isArray(route)) {
      const n = calls.get(key) ?? 0
      calls.set(key, n + 1)
      route = route[Math.min(n, route.length - 1)]
    }
    const { status, body } = route as { status: number; body?: unknown }
    return new Response(body === undefined ? null : JSON.stringify(body), { status })
  })
}

const kan = {
  full_name: 'kanbn/kan',
  name: 'kan',
  owner: { login: 'kanbn' },
  html_url: 'https://github.com/kanbn/kan',
  clone_url: 'https://github.com/kanbn/kan.git',
  default_branch: 'main',
  private: false,
  description: 'Kanban',
  stargazers_count: 4200,
  forks_count: 300,
  size: 5000,
  permissions: { push: false }
}
const myFork = {
  ...kan,
  full_name: 'paulo/kan',
  owner: { login: 'paulo' },
  html_url: 'https://github.com/paulo/kan',
  clone_url: 'https://github.com/paulo/kan.git',
  fork: true,
  parent: { full_name: 'kanbn/kan' }
}

beforeEach(() => vi.mocked(httpFetch).mockReset())

/** The POST that created the fork: its URL and JSON body. */
function forkPost(): { url: string; method?: string; body: unknown } {
  const call = vi.mocked(httpFetch).mock.calls.find(([url]) => String(url).endsWith('/forks'))
  if (!call) throw new Error('no fork request')
  const init = call[1] as RequestInit
  return { url: String(call[0]), method: init.method, body: JSON.parse(String(init.body)) }
}

describe('getForkSource', () => {
  it('describes the repository and finds the fork the account already has', async () => {
    serve({ '/repos/kanbn/kan': { status: 200, body: kan }, '/user': { status: 200, body: { login: 'paulo' } }, '/repos/paulo/kan': { status: 200, body: myFork } })
    const source = await getForkSource('github.com', 'kanbn', 'kan')
    expect(source).toMatchObject({ fullName: 'kanbn/kan', stars: 4200, forks: 300, defaultBranch: 'main', canPush: false, ownedByViewer: false, viewerLogin: 'paulo' })
    expect(source.existingFork).toEqual({ owner: 'paulo', name: 'kan', fullName: 'paulo/kan', cloneUrl: 'https://github.com/paulo/kan.git', htmlUrl: 'https://github.com/paulo/kan' })
  })

  it('does not take a same-named repository that is not a fork of it', async () => {
    serve({
      '/repos/kanbn/kan': { status: 200, body: kan },
      '/user': { status: 200, body: { login: 'paulo' } },
      '/repos/paulo/kan': { status: 200, body: { ...myFork, fork: false, parent: undefined } }
    })
    expect((await getForkSource('github.com', 'kanbn', 'kan')).existingFork).toBeNull()
  })

  it('knows a repository of the account itself', async () => {
    serve({ '/repos/paulo/app': { status: 200, body: { ...kan, full_name: 'paulo/app', owner: { login: 'Paulo' } } }, '/user': { status: 200, body: { login: 'paulo' } } })
    const source = await getForkSource('github.com', 'paulo', 'app')
    expect(source.ownedByViewer).toBe(true)
    expect(source.existingFork).toBeNull()
  })

  it('says plainly when the repository does not exist', async () => {
    serve({ '/user': { status: 200, body: { login: 'paulo' } } })
    await expect(getForkSource('github.com', 'kanbn', 'nope')).rejects.toThrow('kanbn/nope')
  })
})

describe('forkRepository', () => {
  const fast = { pollMs: 1, timeoutMs: 200 }

  it('creates the fork and waits until GitHub has copied it', async () => {
    serve({
      '/repos/kanbn/kan': { status: 200, body: kan },
      '/repos/kanbn/kan/forks': { status: 202, body: myFork },
      '/repos/paulo/kan/branches': [{ status: 404 }, { status: 409, body: { message: 'Git Repository is empty.' } }, { status: 200, body: [{ name: 'main' }] }]
    })
    const result = await forkRepository('github.com', 'kanbn', 'kan', { defaultBranchOnly: true }, fast)
    expect(result).toEqual({
      owner: 'paulo',
      name: 'kan',
      fullName: 'paulo/kan',
      cloneUrl: 'https://github.com/paulo/kan.git',
      htmlUrl: 'https://github.com/paulo/kan',
      upstreamCloneUrl: 'https://github.com/kanbn/kan.git',
      upstreamDefaultBranch: 'main'
    })
    expect(forkPost()).toEqual({ url: 'https://api.github.com/repos/kanbn/kan/forks', method: 'POST', body: { default_branch_only: true } })
    expect(vi.mocked(httpFetch).mock.calls.filter(([url]) => String(url).includes('/branches'))).toHaveLength(3)
  })

  it('sends the organization when the fork goes to one', async () => {
    serve({
      '/repos/kanbn/kan': { status: 200, body: kan },
      '/repos/kanbn/kan/forks': { status: 202, body: { ...myFork, owner: { login: 'acme' }, full_name: 'acme/kan' } },
      '/repos/acme/kan/branches': { status: 200, body: [{ name: 'main' }] }
    })
    await forkRepository('github.com', 'kanbn', 'kan', { organization: 'acme', defaultBranchOnly: false }, fast)
    expect(forkPost().body).toEqual({ organization: 'acme', default_branch_only: false })
  })

  it('does not wait for a source with no commits', async () => {
    serve({ '/repos/kanbn/kan': { status: 200, body: { ...kan, size: 0 } }, '/repos/kanbn/kan/forks': { status: 202, body: myFork } })
    await forkRepository('github.com', 'kanbn', 'kan', { defaultBranchOnly: true }, fast)
    expect(vi.mocked(httpFetch).mock.calls.some(([url]) => String(url).includes('/branches'))).toBe(false)
  })

  it('stops waiting on a real failure instead of polling until the timeout', async () => {
    serve({
      '/repos/kanbn/kan': { status: 200, body: kan },
      '/repos/kanbn/kan/forks': { status: 202, body: myFork },
      '/repos/paulo/kan/branches': { status: 401, body: { message: 'Bad credentials' } }
    })
    await expect(forkRepository('github.com', 'kanbn', 'kan', { defaultBranchOnly: true }, fast)).rejects.toThrow('Bad credentials')
  })

  it('gives up with the fork address when GitHub takes too long', async () => {
    serve({
      '/repos/kanbn/kan': { status: 200, body: kan },
      '/repos/kanbn/kan/forks': { status: 202, body: myFork },
      '/repos/paulo/kan/branches': { status: 409, body: { message: 'Git Repository is empty.' } }
    })
    await expect(forkRepository('github.com', 'kanbn', 'kan', { defaultBranchOnly: true }, { pollMs: 1, timeoutMs: 20 })).rejects.toThrow(
      'https://github.com/paulo/kan'
    )
  })
})

describe('addUpstreamRemote', () => {
  let dir: string

  function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ogd-fork-'))
    const original = join(dir, 'original')
    git(dir, 'init', '-q', '-b', 'main', original)
    git(original, 'config', 'user.email', 't@t')
    git(original, 'config', 'user.name', 't')
    writeFileSync(join(original, 'a.txt'), 'a\n')
    git(original, 'add', 'a.txt')
    git(original, 'commit', '-q', '-m', 'a')
    git(original, 'branch', 'feature')
    git(dir, 'clone', '-q', original, 'fork')
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('adds the original as upstream and fetches its branches', async () => {
    const fork = join(dir, 'fork')
    await addUpstreamRemote(fork, join(dir, 'original'))
    expect(git(fork, 'remote', 'get-url', 'upstream')).toBe(join(dir, 'original'))
    expect(git(fork, 'branch', '-r').split('\n').map((b) => b.trim())).toEqual(expect.arrayContaining(['upstream/main', 'upstream/feature']))
  })

  it('keeps an upstream the clone already has', async () => {
    const fork = join(dir, 'fork')
    git(fork, 'remote', 'add', 'upstream', 'https://example.com/other.git')
    await addUpstreamRemote(fork, join(dir, 'original'))
    expect(git(fork, 'remote', 'get-url', 'upstream')).toBe('https://example.com/other.git')
  })

  it('refuses a URL git would read as an option', async () => {
    await expect(addUpstreamRemote(join(dir, 'fork'), '--upload-pack=evil')).rejects.toThrow()
    expect(() => git(join(dir, 'fork'), 'remote', 'get-url', 'upstream')).toThrow()
  })

  it('follows only the given branch, so the branch menu is not flooded', async () => {
    const fork = join(dir, 'fork')
    await addUpstreamRemote(fork, join(dir, 'original'), 'main')
    const remotes = git(fork, 'branch', '-r').split('\n').map((b) => b.trim())
    expect(remotes).toContain('upstream/main')
    expect(remotes.some((b) => b.startsWith('upstream/feature'))).toBe(false)
    expect(git(fork, 'symbolic-ref', '--short', 'refs/remotes/upstream/HEAD')).toBe('upstream/main')
  })
})

describe('syncing a fork with its original', () => {
  let dir: string
  let original: string
  let forkOnGithub: string
  let local: string

  function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  }

  function commit(repo: string, file: string, message: string): void {
    writeFileSync(join(repo, file), `${message}\n`)
    git(repo, 'add', file)
    git(repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', message)
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'ogd-sync-'))
    original = join(dir, 'original')
    forkOnGithub = join(dir, 'fork.git')
    local = join(dir, 'local')
    git(dir, 'init', '-q', '-b', 'main', original)
    commit(original, 'a.txt', 'a')
    git(dir, 'clone', '-q', '--bare', original, forkOnGithub)
    git(dir, 'clone', '-q', forkOnGithub, local)
    await addUpstreamRemote(local, original, 'main')
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('has no status without an upstream remote', async () => {
    git(local, 'remote', 'remove', 'upstream')
    await expect(getUpstreamStatus(local)).resolves.toBeNull()
  })

  it('counts the original commits the local main does not have, after a fetch', async () => {
    commit(original, 'b.txt', 'b')
    commit(original, 'c.txt', 'c')
    expect(await getUpstreamStatus(local)).toMatchObject({ branch: 'main', behind: 0, ahead: 0, hasLocalBranch: true })
    await fetchUpstream(local)
    expect(await getUpstreamStatus(local)).toMatchObject({ branch: 'main', behind: 2, ahead: 0 })
  })

  it('brings them into the checked-out main and pushes it to the fork', async () => {
    commit(original, 'b.txt', 'b')
    commit(original, 'c.txt', 'c')
    await expect(syncWithUpstream(local)).resolves.toEqual({ branch: 'main', brought: 2, pushed: true })
    const tip = git(original, 'rev-parse', 'main')
    expect(git(local, 'rev-parse', 'main')).toBe(tip)
    expect(git(forkOnGithub, 'rev-parse', 'main')).toBe(tip)
    expect(git(local, 'status', '--porcelain')).toBe('')
    expect(await getUpstreamStatus(local)).toMatchObject({ behind: 0, ahead: 0 })
  })

  it('moves main without touching the working tree when another branch is checked out', async () => {
    git(local, 'switch', '-q', '-c', 'work')
    writeFileSync(join(local, 'draft.txt'), 'not committed\n')
    commit(original, 'b.txt', 'b')
    await expect(syncWithUpstream(local)).resolves.toMatchObject({ brought: 1, pushed: true })
    expect(git(local, 'rev-parse', 'main')).toBe(git(original, 'rev-parse', 'main'))
    expect(git(local, 'symbolic-ref', '--short', 'HEAD')).toBe('work')
    expect(git(local, 'status', '--porcelain')).toBe('?? draft.txt')
  })

  it('does nothing when the original has nothing new', async () => {
    await expect(syncWithUpstream(local)).resolves.toEqual({ branch: 'main', brought: 0, pushed: false })
  })

  it('refuses to mix when the local main has commits of its own', async () => {
    commit(local, 'mine.txt', 'mine')
    commit(original, 'b.txt', 'b')
    const before = git(local, 'rev-parse', 'main')
    await expect(syncWithUpstream(local)).rejects.toThrow('upstream/main')
    expect(git(local, 'rev-parse', 'main')).toBe(before)
  })

  it('keeps the local update when pushing to the fork fails', async () => {
    git(local, 'remote', 'set-url', 'origin', join(dir, 'gone.git'))
    commit(original, 'b.txt', 'b')
    const result = await syncWithUpstream(local)
    expect(result).toMatchObject({ branch: 'main', brought: 1, pushed: false })
    expect(result.pushError).toBeTruthy()
    expect(git(local, 'rev-parse', 'main')).toBe(git(original, 'rev-parse', 'main'))
  })
})
