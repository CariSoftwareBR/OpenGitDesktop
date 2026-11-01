import type { RepoUpdateStatus } from '../../../shared/git'

/**
 * A repository's relation to its remote, drawn in the History graph's own
 * vocabulary: a shared trunk forks into the remote's lane (top) and the local
 * branch's lane (bottom). Commits waiting on the remote sit on the top lane
 * in Attention Orange, unpushed commits on the bottom lane in Command Blue,
 * and uncommitted work is a dashed, hollow node at the tip. In sync, the two
 * lanes never split and the trunk ends on a green node.
 *
 * Decorative twin of the status chips beside it — the numbers and words live
 * there (and in this glyph's title), so the drawing is aria-hidden.
 */

const W = 128
const H = 40
const MID = 20
const TOP = 10
const BOTTOM = 30
const FORK = 30
const STEP = 11
const FIRST = 52
const MAX_DOTS = 6

const NEUTRAL = 'var(--color-tertiary-text)'
const REMOTE = 'var(--color-attention-orange)'
const LOCAL = 'var(--color-command-blue)'
const OK = 'var(--color-success-green)'
const DANGER = 'var(--color-danger-red)'

type LaneModel =
  | { kind: 'checking' }
  | { kind: 'missing' }
  | { kind: 'failed' }
  | { kind: 'local'; ahead: number; dirty: number }
  | { kind: 'remote'; behind: number; ahead: number; dirty: number }

function model(check: RepoUpdateStatus | undefined, missing: boolean): LaneModel {
  if (missing) return { kind: 'missing' }
  if (!check || check.state === 'checking') return { kind: 'checking' }
  if (check.state === 'failed') return { kind: 'failed' }
  if (check.state === 'noRemote' || check.state === 'noDefaultBranch') {
    return { kind: 'local', ahead: check.ahead, dirty: check.localChanges }
  }
  const diverged = check.state === 'diverged'
  return {
    kind: 'remote',
    behind: diverged ? check.localDefaultBehind : check.behindDefault,
    ahead: diverged ? check.localDefaultAhead : check.ahead,
    dirty: check.localChanges
  }
}

function signature(m: LaneModel): string {
  return JSON.stringify(m)
}

function Dots({ count, y, color, delay }: { count: number; y: number; color: string; delay: number }): JSX.Element {
  const shown = Math.min(count, MAX_DOTS)
  return (
    <>
      {Array.from({ length: shown }, (_, i) => {
        const overflow = i === MAX_DOTS - 1 && count > MAX_DOTS
        return (
          <circle
            key={i}
            cx={FIRST + i * STEP}
            cy={y}
            r={overflow ? 2 : 3.6}
            fill={color}
            opacity={overflow ? 0.6 : 1}
            className="lane-node"
            style={{ animationDelay: `${delay + i * 45}ms` }}
          />
        )
      })}
    </>
  )
}

function laneEnd(count: number): number {
  return count === 0 ? FIRST - 6 : FIRST + (Math.min(count, MAX_DOTS) - 1) * STEP
}

function DirtyNode({ x, y }: { x: number; y: number }): JSX.Element {
  return (
    <>
      <path d={`M ${x - 7} ${y} L ${x - 4.5} ${y}`} stroke={REMOTE} strokeWidth={2} strokeLinecap="round" strokeDasharray="1 2.5" />
      <circle cx={x} cy={y} r={4} fill="var(--color-obsidian-panel)" stroke={REMOTE} strokeWidth={1.75} strokeDasharray="2 1.6" className="lane-node" style={{ animationDelay: '420ms' }} />
    </>
  )
}

function RepoLane({ check, missing, title }: { check?: RepoUpdateStatus; missing: boolean; title?: string }): JSX.Element {
  const m = model(check, missing)

  let body: JSX.Element
  if (m.kind === 'checking') {
    body = (
      <>
        <path d={`M 4 ${MID} L ${FORK} ${MID}`} stroke={NEUTRAL} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
        <path d={`M ${FORK} ${MID} C ${FORK + 9} ${MID}, ${FORK + 5} ${TOP}, ${FORK + 14} ${TOP} L ${W - 8} ${TOP}`} className="lane-scan" stroke={NEUTRAL} />
        <path d={`M ${FORK} ${MID} C ${FORK + 9} ${MID}, ${FORK + 5} ${BOTTOM}, ${FORK + 14} ${BOTTOM} L ${W - 8} ${BOTTOM}`} className="lane-scan" stroke={NEUTRAL} />
        <circle cx={FORK} cy={MID} r={3.5} fill={NEUTRAL} opacity={0.6} />
      </>
    )
  } else if (m.kind === 'missing') {
    body = (
      <path d={`M 4 ${MID} L ${W - 8} ${MID}`} stroke={NEUTRAL} strokeWidth={2} strokeLinecap="round" strokeDasharray="2 5" opacity={0.6} />
    )
  } else if (m.kind === 'failed') {
    body = (
      <>
        <path d={`M 4 ${MID} L ${FORK} ${MID}`} stroke={NEUTRAL} strokeWidth={2} strokeLinecap="round" opacity={0.55} className="lane-path" />
        <path d={`M ${FORK} ${MID} L ${W - 22} ${MID}`} stroke={DANGER} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 4" />
        <circle cx={W - 14} cy={MID} r={5} fill="var(--color-danger-red-soft)" stroke={DANGER} strokeWidth={1.75} className="lane-node" style={{ animationDelay: '300ms' }} />
        <path d={`M ${W - 16} ${MID - 2} L ${W - 12} ${MID + 2} M ${W - 12} ${MID - 2} L ${W - 16} ${MID + 2}`} stroke={DANGER} strokeWidth={1.5} strokeLinecap="round" />
      </>
    )
  } else if (m.kind === 'local') {
    const end = laneEnd(m.ahead)
    body = (
      <>
        {/* No remote to compare with: the remote lane is a ghost. */}
        <path d={`M ${FORK + 14} ${TOP} L ${W - 8} ${TOP}`} stroke={NEUTRAL} strokeWidth={1.5} strokeDasharray="1.5 4" strokeLinecap="round" opacity={0.45} />
        <path d={`M 4 ${MID} L ${FORK} ${MID} C ${FORK + 9} ${MID}, ${FORK + 5} ${BOTTOM}, ${FORK + 14} ${BOTTOM} L ${end} ${BOTTOM}`} stroke={LOCAL} strokeWidth={2} fill="none" strokeLinecap="round" className="lane-path" />
        <circle cx={FORK} cy={MID} r={3.5} fill={NEUTRAL} />
        <Dots count={m.ahead} y={BOTTOM} color={LOCAL} delay={220} />
        {m.dirty > 0 && <DirtyNode x={end + 12} y={BOTTOM} />}
      </>
    )
  } else if (m.behind === 0 && m.ahead === 0) {
    // In sync: one trunk, no fork.
    const tip = m.dirty > 0 ? W - 26 : W - 12
    body = (
      <>
        <path d={`M 4 ${MID} L ${tip} ${MID}`} stroke={NEUTRAL} strokeWidth={2} strokeLinecap="round" opacity={0.55} className="lane-path" />
        <circle cx={FORK} cy={MID} r={3} fill={NEUTRAL} opacity={0.7} />
        <circle cx={tip} cy={MID} r={4.75} fill={OK} stroke="var(--color-obsidian-panel)" strokeWidth={1.5} className="lane-node" style={{ animationDelay: '260ms' }} />
        {m.dirty > 0 && <DirtyNode x={tip + 14} y={MID} />}
      </>
    )
  } else {
    const remoteEnd = laneEnd(m.behind)
    const localEnd = laneEnd(m.ahead)
    body = (
      <>
        <path d={`M 4 ${MID} L ${FORK} ${MID}`} stroke={NEUTRAL} strokeWidth={2} strokeLinecap="round" opacity={0.55} className="lane-path" />
        <path
          d={`M ${FORK} ${MID} C ${FORK + 9} ${MID}, ${FORK + 5} ${TOP}, ${FORK + 14} ${TOP} L ${remoteEnd} ${TOP}`}
          stroke={m.behind > 0 ? REMOTE : NEUTRAL}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          opacity={m.behind > 0 ? 1 : 0.55}
          className="lane-path"
        />
        <path
          d={`M ${FORK} ${MID} C ${FORK + 9} ${MID}, ${FORK + 5} ${BOTTOM}, ${FORK + 14} ${BOTTOM} L ${localEnd} ${BOTTOM}`}
          stroke={m.ahead > 0 ? LOCAL : NEUTRAL}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          opacity={m.ahead > 0 ? 1 : 0.55}
          className="lane-path"
        />
        <circle cx={FORK} cy={MID} r={3.5} fill={NEUTRAL} />
        <Dots count={m.behind} y={TOP} color={REMOTE} delay={200} />
        <Dots count={m.ahead} y={BOTTOM} color={LOCAL} delay={260} />
        {m.dirty > 0 && <DirtyNode x={localEnd + 12} y={BOTTOM} />}
      </>
    )
  }

  return (
    <span className="flex shrink-0 items-center" title={title}>
      {/* Keyed on the state, so the lanes draw themselves again only when a
          fetch actually changed what they show. */}
      <svg key={signature(m)} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" aria-hidden>
        {body}
      </svg>
    </span>
  )
}

/** The app's mark: a branch leaving its trunk — the gesture every lane on the bench repeats. */
export function LaneMark({ size = 44 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden className="block">
      <path d="M 13 37 L 13 7" stroke="var(--color-command-blue)" strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M 13 30 C 13 21, 31 23, 31 14" stroke="var(--color-attention-orange)" strokeWidth={3} strokeLinecap="round" fill="none" />
      <circle cx={13} cy={37} r={4} fill="var(--color-command-blue)" />
      <circle cx={13} cy={7} r={4} fill="var(--color-command-blue)" />
      <circle cx={31} cy={11} r={4.5} fill="var(--color-obsidian-panel)" stroke="var(--color-attention-orange)" strokeWidth={3} />
    </svg>
  )
}

export default RepoLane
