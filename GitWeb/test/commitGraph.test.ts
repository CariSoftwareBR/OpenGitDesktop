import { describe, expect, it } from 'vitest'
import { computeGraphLayout } from '../src/renderer/src/lib/commitGraph'

const c = (hash: string, ...parents: string[]): { hash: string; parents: string[] } => ({ hash, parents })

describe('computeGraphLayout', () => {
  it('keeps a linear history on one lane', () => {
    const layout = computeGraphLayout([c('c', 'b'), c('b', 'a'), c('a')])
    expect(layout.rows.map((r) => r.lane)).toEqual([0, 0, 0])
    expect(layout.maxLanes).toBe(1)
  })

  it('opens a lane for a merged branch and closes it at the fork point', () => {
    // m merges f into main; both come from base.
    const layout = computeGraphLayout([c('m', 'x', 'f'), c('x', 'base'), c('f', 'base'), c('base')])
    const [m, x, f, base] = layout.rows
    expect(m.isMerge).toBe(true)
    expect(m.edges.filter((e) => e.part === 'bottom').map((e) => e.to)).toEqual([0, 1])
    expect(x.lane).toBe(0)
    expect(f.lane).toBe(1)
    // At the fork point the side lane converges back into lane 0.
    expect(base.lane).toBe(0)
    expect(base.edges.some((e) => e.part === 'top' && e.from === 1 && e.to === 0)).toBe(true)
    expect(layout.maxLanes).toBe(2)
  })

  it('gives an unmerged branch tip its own lane and reuses freed lanes', () => {
    const layout = computeGraphLayout([c('t1', 'a'), c('t2', 'a'), c('a', 'r'), c('t3', 'r'), c('r')])
    expect(layout.rows.map((r) => r.lane)).toEqual([0, 1, 0, 1, 0])
    expect(layout.maxLanes).toBe(2)
  })
})
