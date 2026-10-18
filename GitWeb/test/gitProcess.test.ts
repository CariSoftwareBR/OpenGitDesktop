import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))

const { isCommitPublished, locateFileInHistory, parseStatusEntries, pushBranch, readGit, runGit, undoUnpublishedCommit } = await import(
  '../src/main/gitProcess'
)

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function commitFile(cwd: string, name: string, content: string, message: string): void {
  writeFileSync(join(cwd, name), content)
  git(cwd, 'add', name)
  git(cwd, 'commit', '-q', '-m', message)
}

describe('parseStatusEntries', () => {
  it('parses plain and renamed entries', () => {
    const raw = ' M a.txt\0R  new.txt\0old.txt\0?? n.txt\0'
    expect(parseStatusEntries(raw)).toEqual([
      { path: 'a.txt', index: ' ', worktree: 'M' },
      { path: 'new.txt', index: 'R', worktree: ' ', renamedFrom: 'old.txt' },
      { path: 'n.txt', index: '?', worktree: '?' }
    ])
  })
})

describe('with real repositories', () => {
  let root: string
  let remote: string
  let local: string
  let other: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gitweb-test-'))
    remote = join(root, 'remote.git')
    local = join(root, 'local')
    other = join(root, 'other')
    git(root, 'init', '-q', '--bare', '-b', 'main', remote)
    for (const dir of [local, other]) {
      git(root, 'clone', '-q', remote, dir)
      git(dir, 'config', 'user.name', 'Test')
      git(dir, 'config', 'user.email', 'test@example.com')
      git(dir, 'config', 'commit.gpgsign', 'false')
      git(dir, 'checkout', '-q', '-B', 'main')
    }
    commitFile(local, 'base.txt', 'base\n', 'base')
    git(local, 'push', '-q', '-u', 'origin', 'main')
    git(other, 'pull', '-q', 'origin', 'main')
    git(other, 'branch', '-q', '--set-upstream-to=origin/main')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  it('push keeps a local merge commit instead of flattening it', async () => {
    // Local: a feature branch merged into main (a real merge commit).
    git(local, 'checkout', '-q', '-b', 'feature')
    commitFile(local, 'feature.txt', 'f\n', 'feature work')
    git(local, 'checkout', '-q', 'main')
    commitFile(local, 'main.txt', 'm\n', 'main work')
    git(local, 'merge', '-q', '--no-ff', '--no-edit', 'feature')

    // Meanwhile someone else pushed, so push has to integrate first.
    commitFile(other, 'other.txt', 'o\n', 'teammate work')
    git(other, 'push', '-q')

    await pushBranch(local, 'main', false)

    const subjects = git(remote, 'log', '--format=%s', 'main')
    expect(subjects).toContain("Merge branch 'feature'")
    expect(subjects).toContain('teammate work')
    expect(subjects).toContain('feature work')
  })

  it('push keeps a local merge even with pull.ff=only configured', async () => {
    git(local, 'config', 'pull.ff', 'only')
    git(local, 'checkout', '-q', '-b', 'feature')
    commitFile(local, 'feature.txt', 'f\n', 'feature work')
    git(local, 'checkout', '-q', 'main')
    commitFile(local, 'main.txt', 'm\n', 'main work')
    git(local, 'merge', '-q', '--no-ff', '--no-edit', 'feature')
    commitFile(other, 'other.txt', 'o\n', 'teammate work')
    git(other, 'push', '-q')

    await pushBranch(local, 'main', false)

    const subjects = git(remote, 'log', '--format=%s', 'main')
    expect(subjects).toContain("Merge branch 'feature'")
    expect(subjects).toContain('teammate work')
  })

  it('push still rebases a linear branch', async () => {
    commitFile(local, 'mine.txt', 'x\n', 'my work')
    commitFile(other, 'other.txt', 'o\n', 'teammate work')
    git(other, 'push', '-q')

    await pushBranch(local, 'main', false)

    expect(git(remote, 'rev-list', '--merges', '--count', 'main')).toBe('0')
    expect(git(remote, 'log', '-1', '--format=%s', 'main')).toBe('my work')
  })

  it('read-only commands do not wait behind a slow queued command', async () => {
    // A serialized command that holds the repo queue for ~2s, standing in for
    // a fetch on a slow network.
    let slowDone = false
    const slow = runGit(['-c', 'alias.slow=!sleep 2', 'slow'], local).then((r) => {
      slowDone = true
      return r
    })

    const read = await readGit(['status', '--porcelain'], local)
    expect(read.exitCode).toBe(0)
    expect(slowDone).toBe(false)

    // A write queued behind it still waits its turn.
    const write = await runGit(['rev-parse', 'HEAD'], local)
    expect(slowDone).toBe(true)
    expect(write.exitCode).toBe(0)
    await slow
  })

  it('locateFileInHistory: a file only in unpushed commits, deleted from disk', async () => {
    commitFile(local, 'big.sql', 'dump\n', 'add dump')
    commitFile(local, 'later.txt', 'l\n', 'later work')
    git(local, 'rm', '-q', 'big.sql')

    const info = await locateFileInHistory(local, 'big.sql')
    expect(info.upstream).toBe('origin/main')
    expect(info.localCommits.map((c) => c.summary)).toEqual(['add dump'])
    // "add dump" is the second commit ahead, so two undos get past it.
    expect(info.undoCount).toBe(2)
    expect(info.onRemote).toBe(false)
    expect(info.existsOnDisk).toBe(false)
    expect(info.inIndex).toBe(false)
  })

  it('locateFileInHistory: a small version on the upstream, replaced by a local commit', async () => {
    commitFile(local, 'backup.sql', 'small\n', 'small backup')
    git(local, 'push', '-q')
    commitFile(local, 'backup.sql', 'huge\n', 'huge backup')

    const info = await locateFileInHistory(local, 'backup.sql')
    expect(info.onRemote).toBe(true)
    expect(info.localCommits.map((c) => c.summary)).toEqual(['huge backup'])
    expect(info.undoCount).toBe(1)
  })

  it('locateFileInHistory: the fix commit that only removes the file is not a culprit', async () => {
    commitFile(local, 'backup.sql', 'small\n', 'small backup')
    git(local, 'push', '-q')
    commitFile(local, 'backup.sql', 'huge\n', 'huge backup')
    // The flow: undo, stop tracking, commit the removal.
    git(local, 'reset', '-q', '--soft', 'HEAD~1')
    git(local, 'rm', '-q', '--cached', 'backup.sql')
    git(local, 'commit', '-q', '-m', 'stop tracking backup')

    const info = await locateFileInHistory(local, 'backup.sql')
    expect(info.localCommits).toEqual([])
    expect(info.undoCount).toBe(0)
  })

  it('locateFileInHistory: a removal on top does not hide the commit that added it', async () => {
    commitFile(local, 'big.sql', 'dump\n', 'add dump')
    git(local, 'rm', '-q', 'big.sql')
    git(local, 'commit', '-q', '-m', 'remove dump')

    const info = await locateFileInHistory(local, 'big.sql')
    // push would still send "add dump"
    expect(info.localCommits.map((c) => c.summary)).toEqual(['add dump'])
    expect(info.undoCount).toBe(2)
  })

  it('locateFileInHistory: finds a file added and removed inside a merged branch', async () => {
    git(local, 'checkout', '-q', '-b', 'feature')
    commitFile(local, 'big.sql', 'dump\n', 'add dump')
    git(local, 'rm', '-q', 'big.sql')
    git(local, 'commit', '-q', '-m', 'remove dump')
    commitFile(local, 'more.txt', 'x\n', 'more feature work')
    git(local, 'checkout', '-q', 'main')
    commitFile(local, 'main.txt', 'm\n', 'main work')
    git(local, 'merge', '-q', '--no-ff', '--no-edit', 'feature')

    const info = await locateFileInHistory(local, 'big.sql')
    // The merge result never has the file, but push sends "add dump". It sits
    // behind the merge, which is HEAD: one first-parent undo, not four.
    expect(info.localCommits.map((c) => c.summary)).toEqual(['add dump'])
    expect(info.undoCount).toBe(1)
  })

  it.each(['added', 'modified'])('locateFileInHistory: finds a file %s by the merge resolution itself', async (change) => {
    if (change === 'modified') {
      commitFile(local, 'backup.sql', 'small\n', 'small backup')
      git(local, 'push', '-q')
    }
    git(local, 'checkout', '-q', '-b', 'feature')
    commitFile(local, 'base.txt', 'feature\n', 'feature work')
    git(local, 'checkout', '-q', 'main')
    commitFile(local, 'base.txt', 'main\n', 'main work')
    expect(() => git(local, 'merge', '--no-ff', '--no-edit', 'feature')).toThrow()

    // The rejected content exists only in the merge resolution, not in either
    // parent's history. Later work also needs undoing to get past the merge.
    writeFileSync(join(local, 'base.txt'), 'resolved\n')
    git(local, 'add', 'base.txt')
    commitFile(local, 'backup.sql', 'large dump\n', 'resolve merge with dump')
    const mergeHash = git(local, 'rev-parse', 'HEAD')
    expect(git(local, 'rev-list', '--parents', '-1', 'HEAD').split(' ')).toHaveLength(3)
    commitFile(local, 'later.txt', 'later\n', 'later work')

    const info = await locateFileInHistory(local, 'backup.sql')
    expect(info.localCommits.map((c) => c.hash)).toEqual([mergeHash])
    expect(info.undoCount).toBe(2)
    expect(info.onRemote).toBe(change === 'modified')
  })

  it('locateFileInHistory: a branch pushed without -u counts as published', async () => {
    git(local, 'checkout', '-q', '-b', 'topic')
    commitFile(local, 'big.sql', 'dump\n', 'add dump')
    expect(await isCommitPublished(local)).toBe(false)
    git(local, 'push', '-q', 'origin', 'topic')

    const info = await locateFileInHistory(local, 'big.sql')
    expect(info.upstream).toBeNull()
    expect(info.localCommits).toEqual([])
    expect(await isCommitPublished(local)).toBe(true)
  })

  it('undoUnpublishedCommit: undoes a local commit, keeping its changes staged', async () => {
    commitFile(local, 'big.sql', 'dump\n', 'add dump')
    await undoUnpublishedCommit(local, git(local, 'rev-parse', 'HEAD'))
    expect(git(local, 'log', '-1', '--format=%s')).toBe('base')
    expect(git(local, 'diff', '--cached', '--name-only')).toBe('big.sql')
  })

  it('undoUnpublishedCommit: undoes an unpublished root without deadlocking the queue', async () => {
    git(local, 'checkout', '-q', '--orphan', 'new-root')
    git(local, 'rm', '-q', '-r', '-f', '.')
    commitFile(local, 'first.txt', 'first\n', 'first commit')

    await undoUnpublishedCommit(local, git(local, 'rev-parse', 'HEAD'))

    expect(() => git(local, 'rev-parse', '--verify', 'HEAD')).toThrow()
    expect(git(local, 'diff', '--cached', '--name-only')).toBe('first.txt')
    // A following queued command must still be able to run.
    expect((await runGit(['status', '--porcelain'], local)).stdout.trim()).toBe('A  first.txt')
  })

  it('undoUnpublishedCommit: refuses once the commit was pushed after approval', async () => {
    git(local, 'checkout', '-q', '-b', 'topic')
    commitFile(local, 'big.sql', 'dump\n', 'add dump')
    const approved = git(local, 'rev-parse', 'HEAD')
    git(local, 'push', '-q', 'origin', 'topic')

    await expect(undoUnpublishedCommit(local, approved)).rejects.toThrow(/já foi enviado/)
    expect(git(local, 'rev-parse', 'HEAD')).toBe(approved)
  })

  it('undoUnpublishedCommit: refuses when HEAD moved since approval', async () => {
    commitFile(local, 'a.txt', 'a\n', 'a')
    const approved = git(local, 'rev-parse', 'HEAD')
    commitFile(local, 'b.txt', 'b\n', 'b')

    await expect(undoUnpublishedCommit(local, approved)).rejects.toThrow(/mudou desde a aprovação/)
    expect(git(local, 'log', '-1', '--format=%s')).toBe('b')
  })

  it('locateFileInHistory: a file already on the upstream', async () => {
    const info = await locateFileInHistory(local, 'base.txt')
    expect(info.localCommits).toEqual([])
    expect(info.undoCount).toBe(0)
    expect(info.onRemote).toBe(true)
    expect(info.existsOnDisk).toBe(true)
    expect(info.inIndex).toBe(true)
  })
})
