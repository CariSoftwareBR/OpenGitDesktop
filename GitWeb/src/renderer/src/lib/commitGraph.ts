/**
 * Lane layout for the History graph. Commits arrive newest first with every
 * parent listed after all of its children (`git log --date-order`). Each lane
 * remembers the hash it is waiting for; a commit takes the lane that waited
 * for it, its first parent inherits that lane and colour, and any other parent
 * opens (or joins) another one. Lanes freed by a converging branch are reused,
 * so the graph stays narrow.
 *
 * Every row is drawn on its own, as two half-height bands around the commit's
 * node: `top` edges come in from the row above, `bottom` edges leave towards
 * the row below, and `full` edges pass straight through. That makes each row
 * independent — fine for a virtualized list that only renders what is on screen.
 */

export interface GraphEdge {
  from: number
  to: number
  color: number
  part: 'top' | 'bottom' | 'full'
}

export interface GraphRow {
  hash: string
  lane: number
  color: number
  isMerge: boolean
  edges: GraphEdge[]
  /** Lanes in use on this row (for its own width). */
  width: number
}

export interface GraphLayout {
  rows: GraphRow[]
  /** Widest row, in lanes. */
  maxLanes: number
}

export const GRAPH_COLORS = 8

export function computeGraphLayout(commits: { hash: string; parents: string[] }[]): GraphLayout {
  const lanes: (string | null)[] = []
  const laneColors: number[] = []
  let nextColor = 0
  const rows: GraphRow[] = []
  let maxLanes = 0

  const freeLane = (): number => {
    const index = lanes.indexOf(null)
    return index === -1 ? lanes.length : index
  }

  for (const commit of commits) {
    const before = [...lanes]
    const beforeColors = [...laneColors]

    let lane = lanes.indexOf(commit.hash)
    if (lane === -1) {
      // A branch tip nobody pointed at yet: it opens a lane of its own.
      lane = freeLane()
      lanes[lane] = commit.hash
      laneColors[lane] = nextColor++ % GRAPH_COLORS
    }
    const color = laneColors[lane]

    const edges: GraphEdge[] = []
    for (let j = 0; j < before.length; j++) {
      if (before[j] === null || before[j] === undefined) continue
      if (before[j] === commit.hash) edges.push({ from: j, to: lane, color: beforeColors[j], part: 'top' })
      else edges.push({ from: j, to: j, color: beforeColors[j], part: 'full' })
    }

    // Every lane that waited for this commit ends here.
    for (let j = 0; j < lanes.length; j++) {
      if (j !== lane && lanes[j] === commit.hash) lanes[j] = null
    }

    const [first, ...others] = commit.parents
    lanes[lane] = first ?? null
    if (first) edges.push({ from: lane, to: lane, color, part: 'bottom' })

    for (const parent of others) {
      let target = lanes.indexOf(parent)
      if (target === -1) {
        target = freeLane()
        lanes[target] = parent
        laneColors[target] = nextColor++ % GRAPH_COLORS
      }
      edges.push({ from: lane, to: target, color: laneColors[target], part: 'bottom' })
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop()
      laneColors.pop()
    }

    const width = Math.max(lane + 1, ...edges.map((e) => Math.max(e.from, e.to) + 1))
    maxLanes = Math.max(maxLanes, width)
    rows.push({ hash: commit.hash, lane, color, isMerge: commit.parents.length > 1, edges, width })
  }

  return { rows, maxLanes }
}
