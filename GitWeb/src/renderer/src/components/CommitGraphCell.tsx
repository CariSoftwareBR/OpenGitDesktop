import { memo } from 'react'
import type { GraphRow } from '../lib/commitGraph'

export const GRAPH_LANE_WIDTH = 16
export const GRAPH_PADDING = 13

export function graphColumnWidth(lanes: number): number {
  return GRAPH_PADDING * 2 + Math.max(0, lanes - 1) * GRAPH_LANE_WIDTH + 2
}

const laneX = (lane: number): number => GRAPH_PADDING + lane * GRAPH_LANE_WIDTH
const color = (index: number): string => `var(--graph-${index})`

/**
 * One row of the graph. Edges are drawn in two bands around the node (see
 * computeGraphLayout), with a vertical S-curve when a line changes lanes so a
 * branch visibly "peels off" its parent instead of cutting diagonally.
 */
function CommitGraphCell({
  row,
  width,
  height,
  isHead,
  localOnly,
  focused
}: {
  row: GraphRow
  width: number
  height: number
  isHead: boolean
  /** Not on any remote yet: drawn hollow, like a draft. */
  localOnly: boolean
  focused: boolean
}): JSX.Element {
  const mid = height / 2
  const paths: JSX.Element[] = []

  row.edges.forEach((edge, i) => {
    const x1 = laneX(edge.from)
    const x2 = laneX(edge.to)
    let d: string
    if (edge.part === 'full') d = `M ${x1} 0 L ${x1} ${height}`
    else if (edge.part === 'top') {
      d = x1 === x2 ? `M ${x1} 0 L ${x2} ${mid}` : `M ${x1} 0 C ${x1} ${mid * 0.75} ${x2} ${mid * 0.25} ${x2} ${mid}`
    } else {
      d =
        x1 === x2
          ? `M ${x1} ${mid} L ${x2} ${height}`
          : `M ${x1} ${mid} C ${x1} ${mid + mid * 0.75} ${x2} ${mid + mid * 0.25} ${x2} ${height}`
    }
    paths.push(
      <path key={i} d={d} fill="none" stroke={color(edge.color)} strokeWidth={2} strokeLinecap="round" opacity={edge.part === 'full' ? 0.85 : 1} />
    )
  })

  const cx = laneX(row.lane)
  const nodeColor = color(row.color)

  return (
    <svg width={width} height={height} className="block shrink-0 overflow-hidden" aria-hidden>
      {paths}
      {focused && <circle cx={cx} cy={mid} r={6} fill={nodeColor} className="graph-node-pulse" />}
      {isHead && <circle cx={cx} cy={mid} r={7.5} fill="none" stroke={nodeColor} strokeWidth={1.5} opacity={0.55} />}
      {row.isMerge ? (
        <circle cx={cx} cy={mid} r={4} fill="var(--color-obsidian-panel)" stroke={nodeColor} strokeWidth={2.25} />
      ) : localOnly ? (
        <circle cx={cx} cy={mid} r={4.25} fill="var(--color-obsidian-panel)" stroke={nodeColor} strokeWidth={2} strokeDasharray="2.2 1.6" />
      ) : (
        <circle cx={cx} cy={mid} r={4.5} fill={nodeColor} stroke="var(--color-obsidian-panel)" strokeWidth={1.5} />
      )}
    </svg>
  )
}

export default memo(CommitGraphCell)
