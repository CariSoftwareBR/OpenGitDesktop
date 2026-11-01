import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))

const { getRepoUpdateStatus } = await import('../src/main/gitProcess')

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function commit(cwd: string, name: string, message: string): void {
  writeFileSync(join(cwd, name), `${message}\n`)
  git(cwd, 'add', name)
  git(cwd, 'commit', '-q', '-m', message)
}

function configure(cwd: string): void {
  git(cwd, 'config', 'user.name', 'Test')
  git(cwd, 'config', 'user.email', 'test@example.com')
  git(cwd, 'config', 'commit.gpgsign', 'false')
}

// The Start screen polls this every few seconds; the ahead/behind part is
// cached by the commits it compares. These cases move each of those commits
// and expect the very next call to see it.
describe('getRepoUpdateStatus between polls', () => {
  let remote: string
  let repo: string
  let other: string

  beforeEach(() => {
    remote = mkdtempSync(join(tmpdir(), 'ogd-poll-remote-'))
    git(remote, 'init', '-q', '--bare', '-b', 'main')
    repo = mkdtempSync(join(tmpdir(), 'ogd-poll-'))
    git(repo, 'init', '-q', '-b', 'main')
    configure(repo)
    git(repo, 'remote', 'add', 'origin', remote)
    commit(repo, 'a.txt', 'initial')
    git(repo, 'push', '-q', '-u', 'origin', 'main')
    git(repo, 'remote', 'set-head', 'origin', 'main')
    other = mkdtempSync(join(tmpdir(), 'ogd-poll-other-'))
    git(other, 'clone', '-q', remote, '.')
    configure(other)
  })

  afterEach(() => {
    for (const dir of [repo, remote, other]) rmSync(dir, { recursive: true, force: true })
  })

  it('starts up to date and stays so on a repeated poll', async () => {
    expect(await getRepoUpdateStatus(repo)).toMatchObject({ state: 'upToDate', behindDefault: 0, aheadOfDefault: 0 })
    expect(await getRepoUpdateStatus(repo)).toMatchObject({ state: 'upToDate', behindDefault: 0, aheadOfDefault: 0 })
  })

  it('sees a local commit on the next poll', async () => {
    await getRepoUpdateStatus(repo)
    commit(repo, 'b.txt', 'local work')
    expect(await getRepoUpdateStatus(repo)).toMatchObject({ aheadOfDefault: 1, behindDefault: 0 })
  })

  it('sees the remote move after a fetch', async () => {
    await getRepoUpdateStatus(repo)
    commit(other, 'c.txt', 'pushed elsewhere')
    git(other, 'push', '-q', 'origin', 'main')
    expect(await getRepoUpdateStatus(repo, { fetch: true })).toMatchObject({
      state: 'behind',
      behindDefault: 1,
      localDefaultBehind: 1,
      canFastForward: true
    })
    // Fetched refs stay put, so a local-only poll still reports it.
    expect(await getRepoUpdateStatus(repo)).toMatchObject({ state: 'behind', behindDefault: 1 })
    git(repo, 'merge', '-q', '--ff-only', 'origin/main')
    expect(await getRepoUpdateStatus(repo)).toMatchObject({ state: 'upToDate', behindDefault: 0, localDefaultBehind: 0 })
  })

  it('follows a branch switch and a detached HEAD', async () => {
    commit(other, 'c.txt', 'pushed elsewhere')
    git(other, 'push', '-q', 'origin', 'main')
    await getRepoUpdateStatus(repo, { fetch: true })
    git(repo, 'checkout', '-q', '-b', 'feature', 'origin/main')
    commit(repo, 'f.txt', 'feature work')
    expect(await getRepoUpdateStatus(repo)).toMatchObject({ branch: 'feature', aheadOfDefault: 1, behindDefault: 0 })
    git(repo, 'checkout', '-q', '--detach', 'main')
    expect(await getRepoUpdateStatus(repo)).toMatchObject({ aheadOfDefault: 0, behindDefault: 1 })
  })

  it('notices a remote removed and added back between polls', async () => {
    expect((await getRepoUpdateStatus(repo)).state).toBe('upToDate')
    git(repo, 'remote', 'remove', 'origin')
    expect((await getRepoUpdateStatus(repo)).state).toBe('noRemote')
    git(repo, 'remote', 'add', 'origin', remote)
    git(repo, 'fetch', '-q', 'origin')
    expect((await getRepoUpdateStatus(repo)).state).not.toBe('noRemote')
  })

  it('counts edited files on every poll', async () => {
    expect((await getRepoUpdateStatus(repo)).localChanges).toBe(0)
    writeFileSync(join(repo, 'a.txt'), 'edited elsewhere\n')
    expect((await getRepoUpdateStatus(repo)).localChanges).toBe(1)
  })
})
