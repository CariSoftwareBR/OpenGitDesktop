import { describe, expect, it } from 'vitest'
import { pushTargetBranch } from '../src/shared/git'

describe('pushTargetBranch', () => {
  it('follows the upstream on origin, even under another name', () => {
    expect(pushTargetBranch({ branch: 'main', upstream: 'origin/main' })).toBe('main')
    expect(pushTargetBranch({ branch: 'main', upstream: 'origin/master' })).toBe('master')
    expect(pushTargetBranch({ branch: 'fix', upstream: 'origin/feature/fix' })).toBe('feature/fix')
  })

  it('uses the local name for a branch not published yet', () => {
    expect(pushTargetBranch({ branch: 'feature/x', upstream: null })).toBe('feature/x')
  })

  it('has no answer for a push to another remote or a detached HEAD', () => {
    expect(pushTargetBranch({ branch: 'main', upstream: 'fork/main' })).toBeNull()
    expect(pushTargetBranch({ branch: null, upstream: null })).toBeNull()
  })
})
