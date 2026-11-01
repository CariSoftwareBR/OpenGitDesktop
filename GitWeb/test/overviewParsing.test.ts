import { describe, expect, it } from 'vitest'
import { parseBranchOverview, parseChurnLog, parseNumstatZ, renamedPath } from '../src/shared/gitParsing'

describe('parseNumstatZ', () => {
  it('reads plain rows, binaries and renames', () => {
    const out = '3\t1\tsrc/a.ts\0-\t-\timg.png\0' + '5\t0\t\0old/b.ts\0new/b.ts\0'
    expect(parseNumstatZ(out)).toEqual([
      { path: 'src/a.ts', additions: 3, deletions: 1, binary: false },
      { path: 'img.png', additions: 0, deletions: 0, binary: true },
      { path: 'new/b.ts', additions: 5, deletions: 0, binary: false }
    ])
  })
})

describe('parseBranchOverview', () => {
  it('reads ahead/behind, gone and the current branch', () => {
    const row = (...f: string[]): string => f.join('\x1f')
    const out = [
      row('main', '*', '2026-10-01T10:00:00-03:00', 'origin/main', 'ahead 2, behind 1', 'Fix a | b'),
      row('old', ' ', '2026-01-01T10:00:00-03:00', 'origin/old', 'gone', 'Old'),
      row('local', ' ', '2026-02-01T10:00:00-03:00', '', '', 'Local only')
    ].join('\n')
    const [main, old, local] = parseBranchOverview(out)
    expect(main).toMatchObject({ name: 'main', isCurrent: true, ahead: 2, behind: 1, gone: false, upstream: 'origin/main', subject: 'Fix a | b' })
    expect(old).toMatchObject({ isCurrent: false, gone: true, ahead: 0, behind: 0 })
    expect(local).toMatchObject({ upstream: null, gone: false })
  })
})

describe('parseChurnLog', () => {
  it('sums per commit and ranks hotspots, following renames', () => {
    const out =
      '\x1e2026-10-02T10:00:00Z\n\n10\t2\tsrc/a.ts\n1\t1\tREADME.md\n' +
      '\x1e2026-10-01T10:00:00Z\n\n4\t0\tsrc/{old => a}.ts\n-\t-\tlogo.png\n'
    const churn = parseChurnLog(out, 100)
    expect(churn.commits).toEqual([
      { date: '2026-10-02T10:00:00Z', additions: 11, deletions: 3 },
      { date: '2026-10-01T10:00:00Z', additions: 4, deletions: 0 }
    ])
    expect(churn.hotspots[0]).toEqual({ path: 'src/a.ts', commits: 2, additions: 14, deletions: 2 })
    expect(churn.truncated).toBe(false)
    expect(parseChurnLog(out, 2).truncated).toBe(true)
  })

  it('resolves both rename spellings', () => {
    expect(renamedPath('src/{lib => util}/x.ts')).toBe('src/util/x.ts')
    expect(renamedPath('a.ts => b.ts')).toBe('b.ts')
    expect(renamedPath('src/{ => sub}/x.ts')).toBe('src/sub/x.ts')
  })
})
