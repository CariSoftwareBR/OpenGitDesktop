import { describe, expect, it } from 'vitest'
import { remoteBranchesToOffer, sameRepoStatus, type RepoStatus } from '../src/shared/git'

const base: RepoStatus = {
  entries: [
    { path: 'a.ts', index: 'M', worktree: ' ' },
    { path: 'b.ts', index: 'R', worktree: ' ', renamedFrom: 'old-b.ts' }
  ],
  branch: 'main',
  ahead: 1,
  behind: 0,
  upstream: 'origin/main'
}

function copy(overrides: Partial<RepoStatus> = {}): RepoStatus {
  return { ...base, entries: base.entries.map((e) => ({ ...e })), ...overrides }
}

describe('sameRepoStatus', () => {
  it('treats a fresh but identical snapshot as the same', () => {
    expect(sameRepoStatus(base, copy())).toBe(true)
    expect(sameRepoStatus(base, copy({ mergeInProgress: false }))).toBe(true)
    expect(sameRepoStatus(null, null)).toBe(true)
  })

  it('notices every field that can change between polls', () => {
    expect(sameRepoStatus(base, null)).toBe(false)
    expect(sameRepoStatus(null, base)).toBe(false)
    expect(sameRepoStatus(base, copy({ branch: 'dev' }))).toBe(false)
    expect(sameRepoStatus(base, copy({ ahead: 2 }))).toBe(false)
    expect(sameRepoStatus(base, copy({ behind: 1 }))).toBe(false)
    expect(sameRepoStatus(base, copy({ upstream: null }))).toBe(false)
    expect(sameRepoStatus(base, copy({ mergeInProgress: true }))).toBe(false)
    expect(sameRepoStatus(base, copy({ entries: base.entries.slice(0, 1) }))).toBe(false)
  })

  it('compares entries by path, codes, and rename source', () => {
    const worktree = copy()
    worktree.entries[0].worktree = 'M'
    expect(sameRepoStatus(base, worktree)).toBe(false)
    const renamed = copy()
    renamed.entries[1].renamedFrom = 'other.ts'
    expect(sameRepoStatus(base, renamed)).toBe(false)
    const reordered = copy({ entries: [...base.entries].reverse() })
    expect(sameRepoStatus(base, reordered)).toBe(false)
  })
})

describe('remoteBranchesToOffer', () => {
  const remote = ['origin/main', 'origin/feature', 'upstream/main', 'upstream/feature']

  it('hides origin branches that already have a local branch, and keeps the other remote', () => {
    expect(remoteBranchesToOffer(remote, ['main', 'feature'])).toEqual(['upstream/main', 'upstream/feature'])
  })

  it('hides a remote once a local branch is already named after it', () => {
    expect(remoteBranchesToOffer(remote, ['main', 'upstream/main'])).toEqual(['origin/feature', 'upstream/feature'])
  })
})
