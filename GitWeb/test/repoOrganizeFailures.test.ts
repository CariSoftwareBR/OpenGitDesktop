import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))

// Failures a real disk only produces with bad timing: a lock on the folder that
// stepped aside, and a recents file that can't be written.
const lock = { whenLeavingAside: false, alsoOnTheWayBack: false, original: '' }
vi.mock('fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('fs/promises')>()
  return {
    ...real,
    rename: vi.fn(async (from: string, to: string) => {
      const goingBack = to === lock.original
      if (lock.whenLeavingAside && from.includes('.ogd-move-') && (!goingBack || lock.alsoOnTheWayBack)) {
        throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' })
      }
      return real.rename(from, to)
    })
  }
})

const recents = { failWrite: false, file: undefined as unknown }
vi.mock('../src/main/appDataStore', () => ({
  readJson: vi.fn(async (_name: string, fallback: unknown) => recents.file ?? fallback),
  writeJson: vi.fn(async () => undefined),
  updateJson: vi.fn(async (_name: string, fallback: unknown, updater: (current: unknown) => unknown) => {
    if (recents.failWrite) throw new Error('EPERM: recent-repos.json')
    recents.file = updater(recents.file ?? fallback)
    return recents.file
  })
}))

const { applyReorganization, reorganizeRepositories } = await import('../src/main/repoOrganize')

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' })
}

describe('when moving goes wrong', () => {
  let root: string

  function repo(relativePath: string, origin: string): string {
    const path = join(root, relativePath)
    mkdirSync(path, { recursive: true })
    git(path, 'init', '-q', '-b', 'main')
    git(path, 'remote', 'add', 'origin', origin)
    writeFileSync(join(path, 'work.txt'), 'uncommitted\n')
    return path
  }

  beforeEach(() => {
    root = resolve(mkdtempSync(join(tmpdir(), 'ogd-organize-fail-')))
    Object.assign(lock, { whenLeavingAside: false, alsoOnTheWayBack: false, original: '' })
    Object.assign(recents, { failWrite: false, file: undefined })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  it('puts a repository moving into itself back, even as the only thing in its parent folder', async () => {
    const from = repo('a/b', 'https://gitlab.com/a/b/b.git')
    Object.assign(lock, { whenLeavingAside: true, original: from })

    const result = await applyReorganization(root, [{ from, to: join(root, 'a', 'b', 'b') }])

    expect(result.moved).toEqual([])
    expect(result.failed).toEqual([expect.objectContaining({ from, reason: 'inUse' })])
    expect(existsSync(join(from, 'work.txt'))).toBe(true)
    expect(readdirSync(root)).toEqual(['a'])
  }, 15000)

  it('says where the repository is when it can not even be put back', async () => {
    const from = repo('acme', 'https://github.com/acme/acme.git')
    Object.assign(lock, { whenLeavingAside: true, alsoOnTheWayBack: true, original: from })

    const result = await applyReorganization(root, [{ from, to: join(root, 'acme', 'acme') }])

    const [failure] = result.failed
    expect(failure.reason).toBe('stranded')
    expect(failure.detail).toContain('.ogd-move-')
    expect(existsSync(join(failure.detail as string, 'work.txt'))).toBe(true)
  }, 15000)

  it('still reports what moved when the recents can not be saved', async () => {
    const from = repo('site', 'https://github.com/acme/site.git')
    recents.failWrite = true

    const result = await reorganizeRepositories(root, [{ from, to: join(root, 'acme', 'site') }])

    expect(result.moved).toEqual([{ from, to: join(root, 'acme', 'site') }])
    expect(result.recentError).toContain('EPERM')
    expect(result.recent.repos).toEqual([])
  })

  it('reports no problem when the recents were saved', async () => {
    const from = repo('site', 'https://github.com/acme/site.git')
    const result = await reorganizeRepositories(root, [{ from, to: join(root, 'acme', 'site') }])
    expect(result.moved).toHaveLength(1)
    expect(result.recentError).toBeUndefined()
  })
})
