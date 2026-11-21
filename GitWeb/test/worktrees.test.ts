import { execFileSync } from 'child_process'
import { mkdtempSync, realpathSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, normalize } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseWorktreeConflict } from '../src/shared/git'
import { parseWorktreeList } from '../src/shared/gitParsing'
import { displayFolder } from '../src/renderer/src/lib/path'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))

const { getBranches, listWorktrees, pruneWorktrees, switchBranch, deleteBranch } = await import('../src/main/gitProcess')

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

describe('parseWorktreeConflict', () => {
  it('reads the branch and folder from the checkout refusal (current and older git)', () => {
    expect(parseWorktreeConflict("fatal: 'paulo/Dublagem' is already used by worktree at 'C:/Users/p/orca/Dublagem'")).toEqual({
      branch: 'paulo/Dublagem',
      path: 'C:/Users/p/orca/Dublagem'
    })
    expect(parseWorktreeConflict("fatal: 'feat' is already checked out at '/home/p/wt'")).toEqual({ branch: 'feat', path: '/home/p/wt' })
  })

  it('reads the delete refusal too, even wrapped in the IPC error', () => {
    const message = "Error invoking remote method 'git:deleteBranch': Error: error: cannot delete branch 'main' used by worktree at 'C:/Github/Dublagem'"
    expect(parseWorktreeConflict(message)).toEqual({ branch: 'main', path: 'C:/Github/Dublagem' })
  })

  it('returns null for any other failure', () => {
    expect(parseWorktreeConflict("error: pathspec 'nope' did not match any file(s) known to git")).toBeNull()
  })
})

describe('parseWorktreeList', () => {
  it('parses branches, detached heads, locked and prunable entries; the first one is the main worktree', () => {
    const porcelain = [
      'worktree C:/Github/Dublagem',
      'HEAD 4556382b1540d5758cef1cbfe3621f2ff5608a28',
      'branch refs/heads/main',
      '',
      'worktree C:/Users/p/orca/Dublagem',
      'HEAD 4556382b1540d5758cef1cbfe3621f2ff5608a28',
      'branch refs/heads/paulo/Dublagem',
      'locked',
      '',
      'worktree /tmp/detached',
      'HEAD 1111111111111111111111111111111111111111',
      'detached',
      '',
      'worktree /tmp/gone',
      'HEAD 2222222222222222222222222222222222222222',
      'branch refs/heads/old',
      'prunable gitdir file points to non-existent location',
      ''
    ].join('\r\n')
    expect(parseWorktreeList(porcelain)).toEqual([
      { path: 'C:/Github/Dublagem', branch: 'main', head: '4556382b1540d5758cef1cbfe3621f2ff5608a28', isMain: true, locked: false, missing: false },
      { path: 'C:/Users/p/orca/Dublagem', branch: 'paulo/Dublagem', head: '4556382b1540d5758cef1cbfe3621f2ff5608a28', isMain: false, locked: true, missing: false },
      { path: '/tmp/detached', branch: null, head: '1111111111111111111111111111111111111111', isMain: false, locked: false, missing: false },
      { path: '/tmp/gone', branch: 'old', head: '2222222222222222222222222222222222222222', isMain: false, locked: false, missing: true }
    ])
  })
})

describe('displayFolder', () => {
  it('writes Windows folders with backslashes and leaves POSIX ones alone', () => {
    expect(displayFolder('C:/Users/p/orca/Dublagem')).toBe('C:\\Users\\p\\orca\\Dublagem')
    expect(displayFolder('/home/p/wt')).toBe('/home/p/wt')
  })
})

describe('worktrees in a real repository', () => {
  let root: string
  let repo: string
  let worktree: string

  beforeEach(() => {
    // .native expands Windows 8.3 names (CI's temp is C:\Users\RUNNER~1\…),
    // which git always prints in full.
    root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ogd-worktrees-')))
    repo = join(root, 'repo')
    worktree = join(root, 'wt')
    execFileSync('git', ['init', '-q', '-b', 'main', repo])
    git(repo, 'config', 'user.email', 'test@example.com')
    git(repo, 'config', 'user.name', 'Test')
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'init')
    git(repo, 'worktree', 'add', '-q', worktree, '-b', 'feat')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('getBranches says which folder holds each branch that is open elsewhere', async () => {
    expect(await getBranches(repo)).toEqual([
      { name: 'feat', isCurrent: false, worktreePath: normalize(worktree), worktreeMissing: false },
      { name: 'main', isCurrent: true }
    ])
  })

  it('switchBranch returns the worktree folder instead of throwing git\'s fatal', async () => {
    expect(await switchBranch('feat', repo)).toEqual({ switched: false, worktreePath: normalize(worktree) })
    expect(git(repo, 'branch', '--show-current')).toBe('main')
  })

  it('a refused delete still carries the folder, for the renderer to explain', async () => {
    await expect(deleteBranch('feat', repo, true)).rejects.toThrow(/used by worktree at|checked out at/)
  })

  it('listWorktrees marks the main worktree and the one open in the app', async () => {
    const fromRepo = await listWorktrees(repo)
    expect(fromRepo.map((w) => ({ path: w.path, branch: w.branch, isMain: w.isMain, isCurrent: w.isCurrent, missing: w.missing }))).toEqual([
      { path: normalize(repo), branch: 'main', isMain: true, isCurrent: true, missing: false },
      { path: normalize(worktree), branch: 'feat', isMain: false, isCurrent: false, missing: false }
    ])
    const fromWorktree = await listWorktrees(worktree)
    expect(fromWorktree.find((w) => w.isCurrent)?.branch).toBe('feat')
  })

  it('a deleted worktree folder keeps holding its branch until pruneWorktrees frees it', async () => {
    rmSync(worktree, { recursive: true, force: true })
    expect((await getBranches(repo)).find((b) => b.name === 'feat')?.worktreeMissing).toBe(true)
    expect((await listWorktrees(repo))[1].missing).toBe(true)
    expect(await switchBranch('feat', repo)).toEqual({ switched: false, worktreePath: normalize(worktree) })

    expect(await pruneWorktrees(repo)).toEqual([normalize(worktree)])
    expect(await listWorktrees(repo)).toHaveLength(1)
    expect(await switchBranch('feat', repo)).toEqual({ switched: true })
  })

  it('a locked worktree survives the prune even with its folder gone (the store reports it instead of looping)', async () => {
    git(repo, 'worktree', 'lock', worktree)
    rmSync(worktree, { recursive: true, force: true })
    expect(await pruneWorktrees(repo)).toEqual([])
    const held = (await listWorktrees(repo)).find((w) => w.branch === 'feat')
    expect(held).toMatchObject({ locked: true, missing: true })
    expect(await switchBranch('feat', repo)).toEqual({ switched: false, worktreePath: normalize(worktree) })
  })

  it('pruneWorktrees leaves worktrees whose folder still exists', async () => {
    expect(await pruneWorktrees(repo)).toEqual([])
    expect(await listWorktrees(repo)).toHaveLength(2)
  })
})
