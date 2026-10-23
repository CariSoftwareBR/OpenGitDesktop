import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))

const { deleteCheckedBranch, deleteIntegratedBranches, getBranchDeleteCheck, getBranchIntegration } = await import(
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

let repo: string

// main ← merged (true merge), squashed (squash merge), rebased (cherry-picked),
// plus pending (work main does not have). HEAD ends on main.
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'ogd-integration-'))
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'config', 'user.name', 'Test')
  git(repo, 'config', 'user.email', 'test@example.com')
  commitFile(repo, 'a.txt', 'a\n', 'initial')

  git(repo, 'checkout', '-q', '-b', 'merged')
  commitFile(repo, 'merged.txt', 'm\n', 'merged work')
  git(repo, 'checkout', '-q', '-b', 'squashed', 'main')
  commitFile(repo, 's1.txt', '1\n', 'squash part 1')
  commitFile(repo, 's2.txt', '2\n', 'squash part 2')
  git(repo, 'checkout', '-q', '-b', 'rebased', 'main')
  commitFile(repo, 'r.txt', 'r\n', 'rebased work')
  git(repo, 'checkout', '-q', '-b', 'pending', 'main')
  commitFile(repo, 'p.txt', 'p\n', 'pending work')

  git(repo, 'checkout', '-q', 'main')
  git(repo, 'merge', '-q', '--no-ff', '-m', 'merge merged', 'merged')
  git(repo, 'merge', '-q', '--squash', 'squashed')
  git(repo, 'commit', '-q', '-m', 'squashed (#1)')
  git(repo, 'cherry-pick', 'rebased')
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('getBranchIntegration', () => {
  it('tells merged, squash/rebase-equivalent and pending branches apart', async () => {
    const report = await getBranchIntegration(repo, 'main')
    const states = Object.fromEntries(report.branches.map((b) => [b.name, b.state]))

    expect(report.base).toBe('main')
    expect(states).toEqual({ merged: 'merged', squashed: 'equivalent', rebased: 'equivalent', pending: 'unmerged' })
    expect(report.protectedNames).toEqual(expect.arrayContaining(['main', 'master']))
  })

  it('does not treat a whitespace-only difference as integrated', async () => {
    // Same change as a commit on main, except for one trailing space.
    git(repo, 'checkout', '-q', '-b', 'spaces', 'main~3')
    commitFile(repo, 'merged.txt', 'm \n', 'merged work, with a trailing space')
    git(repo, 'checkout', '-q', 'main')

    const report = await getBranchIntegration(repo, 'main')
    expect(report.branches.find((b) => b.name === 'spaces')?.state).toBe('unmerged')
  })
})

describe('deleteIntegratedBranches', () => {
  it('deletes integrated branches and refuses main, pending work and the current branch', async () => {
    git(repo, 'checkout', '-q', 'merged')
    const results = await deleteIntegratedBranches(repo, ['squashed', 'rebased', 'pending', 'main', 'Main', 'merged', 'ghost'], 'main')
    const byName = Object.fromEntries(results.map((r) => [r.name, r.deleted]))

    expect(byName).toEqual({ squashed: true, rebased: true, pending: false, main: false, Main: false, merged: false, ghost: false })
    const left = git(repo, 'branch', '--format=%(refname:short)').split('\n').sort()
    expect(left).toEqual(['main', 'merged', 'pending'])
  })

  it('never deletes anything it was not asked for', async () => {
    await deleteIntegratedBranches(repo, ['merged'], 'main')
    const left = git(repo, 'branch', '--format=%(refname:short)').split('\n').sort()
    expect(left).toEqual(['main', 'pending', 'rebased', 'squashed'])
  })
})

describe('getBranchDeleteCheck', () => {
  it('calls a squash-merged branch safe to delete, with nothing missing', async () => {
    const check = await getBranchDeleteCheck(repo, 'squashed')
    expect(check.base).toBe('main')
    expect(check.branch.state).toBe('equivalent')
    expect(check.missingCommits).toEqual([])
  })

  it('lists the commits main does not have, and flags them as local-only without an upstream', async () => {
    const check = await getBranchDeleteCheck(repo, 'pending')
    expect(check.branch.state).toBe('unmerged')
    expect(check.missingCommits.map((c) => c.summary)).toEqual(['pending work'])
    expect(check.localOnly).toBeNull()
  })

  it('counts only the commits on neither main nor the upstream', async () => {
    git(repo, 'remote', 'add', 'origin', repo)
    git(repo, 'update-ref', 'refs/remotes/origin/pending', 'pending')
    git(repo, 'branch', '-q', '--set-upstream-to', 'origin/pending', 'pending')
    expect((await getBranchDeleteCheck(repo, 'pending')).localOnly).toBe(0)

    git(repo, 'checkout', '-q', 'pending')
    commitFile(repo, 'p2.txt', 'p2\n', 'more pending work')
    git(repo, 'checkout', '-q', 'main')
    expect((await getBranchDeleteCheck(repo, 'pending')).localOnly).toBe(1)
  })
})

describe('deleteCheckedBranch', () => {
  it('refuses when the branch moved after the check, and deletes once the tip matches', async () => {
    const { branch } = await getBranchDeleteCheck(repo, 'pending')
    git(repo, 'checkout', '-q', 'pending')
    commitFile(repo, 'late.txt', 'late\n', 'late work')
    git(repo, 'checkout', '-q', 'main')

    await expect(deleteCheckedBranch(repo, 'pending', branch.tip)).rejects.toThrow()
    expect(git(repo, 'branch', '--list', 'pending')).not.toBe('')

    const fresh = await getBranchDeleteCheck(repo, 'pending')
    await deleteCheckedBranch(repo, 'pending', fresh.branch.tip)
    expect(git(repo, 'branch', '--list', 'pending')).toBe('')
  })
})
