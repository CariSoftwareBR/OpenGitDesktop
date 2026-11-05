import { execFileSync, spawn } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))

// Recents kept in memory, so the test exercises the real merge logic without Electron's userData.
const files = new Map<string, unknown>()
vi.mock('../src/main/appDataStore', () => ({
  readJson: vi.fn(async (name: string, fallback: unknown) => files.get(name) ?? fallback),
  writeJson: vi.fn(async (name: string, value: unknown) => void files.set(name, value)),
  updateJson: vi.fn(async (name: string, fallback: unknown, updater: (current: unknown) => unknown) => {
    const next = updater(files.get(name) ?? fallback)
    files.set(name, next)
    return next
  })
}))

const { applyReorganization, planReorganization, reorganizeRepositories } = await import('../src/main/repoOrganize')
const { addRecentRepositories, createRepoGroup, moveRecentRepositories, setRepoGroup } = await import(
  '../src/main/recentRepositories'
)

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

describe('reorganizing repositories', () => {
  let root: string

  /** A real repository with a commit, an uncommitted file and (optionally) an origin. */
  function repo(relativePath: string, origin?: string): string {
    const path = join(root, relativePath)
    mkdirSync(path, { recursive: true })
    git(path, 'init', '-q', '-b', 'main')
    git(path, 'config', 'user.name', 'Test')
    git(path, 'config', 'user.email', 'test@example.com')
    git(path, 'config', 'commit.gpgsign', 'false')
    writeFileSync(join(path, 'tracked.txt'), 'tracked\n')
    git(path, 'add', '.')
    git(path, 'commit', '-q', '-m', 'first')
    writeFileSync(join(path, 'uncommitted.txt'), 'work in progress\n')
    if (origin) git(path, 'remote', 'add', 'origin', origin)
    return path
  }

  beforeEach(() => {
    // The spelling git reports: tmpdir() can be an 8.3 name (Windows runners) or
    // go through a symlink (/var → /private/var on macOS).
    root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ogd-organize-')))
    files.clear()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  it('plans without touching anything', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([{ from: site, to: join(root, 'acme', 'site') }])
    expect(existsSync(site)).toBe(true)
    expect(existsSync(join(root, 'acme'))).toBe(false)
  })

  it('moves each repository to its account, with history and uncommitted work intact', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const api = repo('nested/api', 'git@github.com:other/api-renamed.git')
    const sha = git(site, 'rev-parse', 'HEAD')

    const result = await applyReorganization(root, [
      { from: site, to: join(root, 'acme', 'site') },
      { from: api, to: join(root, 'other', 'api') }
    ])

    expect(result.failed).toEqual([])
    const movedSite = join(root, 'acme', 'site')
    // The folder keeps its own name, even when the remote's differs.
    const movedApi = join(root, 'other', 'api')
    expect(result.moved).toHaveLength(2)
    expect(git(movedSite, 'rev-parse', 'HEAD')).toBe(sha)
    expect(git(movedSite, 'status', '--porcelain')).toContain('uncommitted.txt')
    expect(existsSync(movedApi)).toBe(true)
    expect(existsSync(site)).toBe(false)
    // The folder that only held `api` went away with it.
    expect(existsSync(join(root, 'nested'))).toBe(false)
  })

  it('keeps a source folder that still has other content', async () => {
    const api = repo('nested/api', 'https://github.com/acme/api.git')
    writeFileSync(join(root, 'nested', 'notes.txt'), 'keep me\n')
    await applyReorganization(root, [{ from: api, to: join(root, 'acme', 'api') }])
    expect(existsSync(join(root, 'nested', 'notes.txt'))).toBe(true)
  })

  it('moves only what was confirmed', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const api = repo('api', 'https://github.com/acme/api.git')
    const result = await applyReorganization(root, [{ from: site, to: join(root, 'acme', 'site') }])
    expect(result.moved.map((move) => move.from)).toEqual([site])
    expect(existsSync(api)).toBe(true)
  })

  it('leaves alone what is already organized, and running twice changes nothing', async () => {
    repo('acme/site', 'https://github.com/acme/site.git')
    const api = repo('api', 'https://github.com/acme/api.git')
    await applyReorganization(root, [{ from: api, to: join(root, 'acme', 'api') }])
    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.alreadyOrganized).toBe(2)
  })

  it('moves a repository named after its own account into itself', async () => {
    const profile = repo('acme', 'https://github.com/acme/acme.git')
    const site = repo('site', 'https://github.com/acme/site.git')
    const result = await applyReorganization(root, [
      { from: site, to: join(root, 'acme', 'site') },
      { from: profile, to: join(root, 'acme', 'acme') }
    ])
    expect(result.failed).toEqual([])
    expect(git(join(root, 'acme', 'acme'), 'log', '--format=%s')).toBe('first')
    expect(existsSync(join(root, 'acme', 'site', 'tracked.txt'))).toBe(true)
    expect(existsSync(join(root, 'acme', '.git'))).toBe(false)
  })

  it('does not nest the account when the chosen folder already is its folder', async () => {
    const parent = root
    root = join(parent, 'acme')
    repo('site', 'https://github.com/acme/site.git')
    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.alreadyOrganized).toBe(1)
    root = parent
  })

  it.each([
    ['no origin', undefined, 'noRemote'],
    ['a local path as origin', 'C:\\repos\\site.git', 'unknownOwner'],
    ['an owner that climbs out of the folder', 'git@evil.com:../../fora/site.git', 'unknownOwner']
  ])('skips a repository with %s', async (_name, origin, reason) => {
    const site = repo('site', origin)
    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.skipped).toEqual([expect.objectContaining({ path: site, reason })])
  })

  it('skips a target that already exists, without overwriting it', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    mkdirSync(join(root, 'acme', 'site'), { recursive: true })
    writeFileSync(join(root, 'acme', 'site', 'existing.txt'), 'mine\n')

    expect((await planReorganization(root)).skipped[0].reason).toBe('targetExists')
    const result = await applyReorganization(root, [{ from: site, to: join(root, 'acme', 'site') }])
    expect(result.moved).toEqual([])
    expect(result.failed[0].reason).toBe('planChanged')
    expect(existsSync(join(site, 'tracked.txt'))).toBe(true)
    expect(existsSync(join(root, 'acme', 'site', 'existing.txt'))).toBe(true)
  })

  it('moves only one of two folders that would land on the same target', async () => {
    repo('a/site', 'https://github.com/acme/site.git')
    repo('b/site', 'https://github.com/acme/site.git')
    const plan = await planReorganization(root)
    expect(plan.moves).toHaveLength(1)
    expect(plan.skipped.map((skip) => skip.reason)).toEqual(['targetExists'])
  })

  it('skips when the account folder is another repository that stays', async () => {
    repo('acme', 'C:\\repos\\no-owner.git')
    repo('site', 'https://github.com/acme/site.git')
    const reasons = (await planReorganization(root)).skipped.map((skip) => skip.reason).sort()
    expect(reasons).toEqual(['ownerFolderIsRepo', 'unknownOwner'])
  })

  it('does not promise a move blocked by a repository that was itself skipped', async () => {
    const acme = repo('acme', 'https://github.com/other/acme.git')
    git(acme, 'worktree', 'add', '-q', '-b', 'side', join(root, '.worktrees', 'side'))
    const site = repo('site', 'https://github.com/acme/site.git')
    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: acme, reason: 'hasWorktrees' }),
        expect.objectContaining({ path: site, reason: 'ownerFolderIsRepo' })
      ])
    )
  })

  it('runs a chain of moves in the order that clears the way', async () => {
    const a = repo('a', 'https://github.com/b/a.git')
    const b = repo('b', 'https://github.com/c/b.git')
    const c = repo('c', 'https://github.com/d/c.git')
    const result = await applyReorganization(root, [
      { from: a, to: join(root, 'b', 'a') },
      { from: b, to: join(root, 'c', 'b') },
      { from: c, to: join(root, 'd', 'c') }
    ])
    expect(result.failed).toEqual([])
    for (const moved of [join(root, 'b', 'a'), join(root, 'c', 'b'), join(root, 'd', 'c')]) {
      expect(existsSync(join(moved, 'tracked.txt'))).toBe(true)
    }
  })

  it('leaves two repositories that wait on each other where they are', async () => {
    const a = repo('a', 'https://github.com/b/a.git')
    const b = repo('b', 'https://github.com/a/b.git')
    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.skipped.map((skip) => [skip.path, skip.reason])).toEqual(
      expect.arrayContaining([
        [a, 'ownerFolderIsRepo'],
        [b, 'ownerFolderIsRepo']
      ])
    )
  })

  it('finds a repository again inside a subgroup, instead of losing track of it', async () => {
    const site = repo('site', 'git@gitlab.com:grupo/time/site.git')
    await applyReorganization(root, [{ from: site, to: join(root, 'grupo', 'time', 'site') }])
    expect(existsSync(join(root, 'grupo', 'time', 'site', 'tracked.txt'))).toBe(true)
    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.alreadyOrganized).toBe(1)
  })

  it('skips a repository with linked worktrees, which record its absolute path', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    git(site, 'worktree', 'add', '-q', '-b', 'side', join(root, '.worktrees', 'side'))
    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.skipped[0].reason).toBe('hasWorktrees')
  })

  it('skips a containing repository when a deeply nested repository has an external worktree', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const child = repo('site/vendor/.nested/a/b/child')
    const worktree = join(root, '.worktrees', 'side')
    git(child, 'worktree', 'add', '-q', '-b', 'side', worktree)

    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.skipped).toContainEqual(expect.objectContaining({ path: site, reason: 'hasWorktrees' }))
    const result = await applyReorganization(root, [{ from: site, to: join(root, 'acme', 'site') }])
    expect(result.moved).toEqual([])
    expect(git(worktree, 'status', '--porcelain')).toBe('')
    expect(existsSync(join(site, 'uncommitted.txt'))).toBe(true)
  })

  it('skips a containing repository when it carries a linked checkout of another repository', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const main = repo('.external/main')
    const worktree = join(site, 'nested', 'side')
    git(main, 'worktree', 'add', '-q', '-b', 'side', worktree)

    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.skipped).toContainEqual(expect.objectContaining({ path: site, reason: 'hasWorktrees' }))
    expect(git(worktree, 'rev-parse', '--show-toplevel').replace(/\\/g, '/')).toBe(worktree.replace(/\\/g, '/'))
  })

  it('checks nested submodules without blocking a normal submodule move', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const source = repo('.external/library')
    git(site, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'vendor/library')

    const plan = await planReorganization(root)
    expect(plan.moves).toHaveLength(1)
    const result = await applyReorganization(root, plan.moves)
    expect(result.failed).toEqual([])
    expect(git(join(root, 'acme', 'site', 'vendor', 'library'), 'log', '--format=%s')).toBe('first')
  })

  it('detects worktrees registered by a nested submodule', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const source = repo('.external/library')
    git(site, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'vendor/library')
    const worktree = join(root, '.worktrees', 'library')
    git(join(site, 'vendor', 'library'), 'worktree', 'add', '-q', '-b', 'side', worktree)

    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.skipped).toContainEqual(expect.objectContaining({ path: site, reason: 'hasWorktrees' }))
    expect(git(worktree, 'status', '--porcelain')).toBe('')
  })

  it('detects submodule worktrees even after the submodule working tree is deinitialized', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const source = repo('.external/library')
    git(site, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'vendor/library')
    const worktree = join(root, '.worktrees', 'library')
    git(join(site, 'vendor', 'library'), 'worktree', 'add', '-q', '-b', 'side', worktree)
    git(site, 'submodule', 'deinit', '-f', '--', 'vendor/library')

    const plan = await planReorganization(root)
    expect(plan.moves).toEqual([])
    expect(plan.skipped).toContainEqual(expect.objectContaining({ path: site, reason: 'hasWorktrees' }))
    expect(git(worktree, 'status', '--porcelain')).toBe('')
  })

  it('refuses a chosen folder that is itself a repository', async () => {
    const parent = repo('parent', 'https://github.com/acme/parent.git')
    repo('parent/inner', 'https://github.com/acme/inner.git')
    const plan = await planReorganization(parent)
    expect(plan.rootIsRepository).toBe(true)
    expect(plan.moves).toEqual([])
  })

  it('reports a repository that changed since the preview', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const gone = join(root, 'gone')
    const result = await applyReorganization(root, [
      { from: site, to: join(root, 'acme', 'site') },
      { from: gone, to: join(root, 'acme', 'gone') }
    ])
    expect(result.moved).toHaveLength(1)
    expect(result.failed).toEqual([expect.objectContaining({ from: gone, reason: 'planChanged' })])
  })

  it('rejects a destination that changed after the preview, while still moving unchanged repositories', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const api = repo('api', 'https://github.com/acme/api.git')
    const preview = await planReorganization(root)
    const approved = preview.moves.find((move) => move.from === site)!
    git(site, 'remote', 'set-url', 'origin', 'https://github.com/other/site.git')

    const result = await applyReorganization(root, preview.moves)

    expect(result.moved).toEqual([{ from: api, to: join(root, 'acme', 'api') }])
    expect(result.failed).toEqual([{ ...approved, reason: 'planChanged', detail: undefined }])
    expect(existsSync(join(site, 'uncommitted.txt'))).toBe(true)
    expect(existsSync(join(root, 'other', 'site'))).toBe(false)
  })

  it('does not trust a destination supplied by the renderer', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const result = await applyReorganization(root, [{ from: site, to: join(root, '..', 'unapproved') }])
    expect(result.moved).toEqual([])
    expect(result.failed[0].reason).toBe('planChanged')
    expect(existsSync(site)).toBe(true)
  })

  it('rechecks nested worktree registrations when applying the preview', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const child = repo('site/child')
    const preview = await planReorganization(root)
    const worktree = join(root, '.worktrees', 'side')
    git(child, 'worktree', 'add', '-q', '-b', 'side', worktree)

    const result = await applyReorganization(root, preview.moves)
    expect(result.moved).toEqual([])
    expect(result.failed[0].reason).toBe('planChanged')
    expect(git(worktree, 'status', '--porcelain')).toBe('')
  })

  // Windows refuses to rename a folder some process has as its working directory.
  it.runIf(process.platform === 'win32')('reports a folder in use, keeps going and leaves nothing half done', async () => {
    const busy = repo('busy', 'https://github.com/acme/busy.git')
    const site = repo('site', 'https://github.com/acme/site.git')
    const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { cwd: busy, stdio: 'ignore' })
    try {
      await new Promise((done) => holder.once('spawn', done))
      const result = await applyReorganization(root, [
        { from: busy, to: join(root, 'acme', 'busy') },
        { from: site, to: join(root, 'acme', 'site') }
      ])
      expect(result.failed).toEqual([expect.objectContaining({ from: busy, reason: 'inUse' })])
      expect(result.moved.map((move) => move.from)).toEqual([site])
      expect(existsSync(join(busy, 'tracked.txt'))).toBe(true)
      expect(existsSync(join(root, 'acme', 'busy'))).toBe(false)
    } finally {
      await new Promise((done) => {
        holder.once('exit', done)
        holder.kill()
      })
    }
  }, 15000)

  it('updates the recents in place, keeping their order and group', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const api = repo('api', 'https://github.com/acme/api.git')
    await addRecentRepositories([api, site])
    const data = await createRepoGroup('Work')
    await setRepoGroup(site, data.groups[0].id)

    const { moved } = await applyReorganization(root, [
      { from: site, to: join(root, 'acme', 'site') },
      { from: api, to: join(root, 'acme', 'api') }
    ])
    const recent = await moveRecentRepositories(moved)

    expect(recent.repos.map((entry) => entry.path)).toEqual([join(root, 'acme', 'api'), join(root, 'acme', 'site')])
    expect(recent.repos[1].groupId).toBe(data.groups[0].id)
    expect(recent.repos.every((entry) => !entry.missing)).toBe(true)
  })

  it('updates descendant recents without losing their order or groups, or matching sibling prefixes', async () => {
    const site = repo('site', 'https://github.com/acme/site.git')
    const child = repo('site/nested/child')
    const sibling = repo('site-other')
    await addRecentRepositories([child, site, sibling])
    const data = await createRepoGroup('Work')
    await setRepoGroup(child, data.groups[0].id)

    const result = await reorganizeRepositories(root, [{ from: site, to: join(root, 'acme', 'site') }])

    expect(result.recent.repos.map((entry) => entry.path)).toEqual([
      join(root, 'acme', 'site', 'nested', 'child'), join(root, 'acme', 'site'), sibling
    ])
    expect(result.recent.repos[0].name).toBe('child')
    expect(result.recent.repos[0].groupId).toBe(data.groups[0].id)
    expect(result.recent.repos.every((entry) => !entry.missing)).toBe(true)
  })
})
