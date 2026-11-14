import { useId } from 'react'
import type { UpdateStatus } from '../../../shared/updates'
import { LaneMark } from './RepoLane'

/**
 * About's hero: OpenGitDesktop drawn as one of the repositories it manages.
 * History runs in from the left — commits fading with distance, two branches
 * that forked and merged back — into HEAD, which is the app's own mark: the
 * installed version. To the right is origin/main, and it tells the update
 * state in the lanes' own vocabulary: a release on the remote forks off in
 * Attention Orange (commits waiting on the remote, as on the start screen),
 * the download pulls it in by filling that branch in Command Blue, and a
 * finished download turns the tip Success Green — ready to fast-forward.
 *
 * The words live in the update panel below; this drawing is its twin, so it
 * carries one summary label for screen readers and nothing else.
 */

const VW = 1400
const VH = 230
const HX = 700
const HY = 115
const EDGE = 40 // half the emblem tile plus its ring, where lanes stop short
const BRANCH = 54

// Trunk commits, nearest to HEAD first, one step apart.
const HISTORY = [630, 566, 502, 438, 374, 310, 246, 182, 118]

/** Nearer HEAD reads stronger; the far past fades into the window edge. */
function fade(x: number): number {
  return 0.15 + 0.75 * (x / HISTORY[0])
}

function mergedBranch(from: number, to: number, y: number): string {
  return `M ${from} ${HY} C ${from + 24} ${HY}, ${from + 24} ${y}, ${from + 48} ${y} L ${to - 48} ${y} C ${to - 24} ${y}, ${to - 24} ${HY}, ${to} ${HY}`
}

function Node({ x, y, color, opacity, delay, r = 4 }: { x: number; y: number; color: string; opacity: number; delay: number; r?: number }): JSX.Element {
  return (
    <circle
      cx={x}
      cy={y}
      r={r}
      fill={color}
      fillOpacity={opacity}
      stroke="var(--color-midnight-base)"
      strokeWidth={2}
      className="lane-node"
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}

function AboutGraph({
  state,
  percent,
  targetVersion,
  label
}: {
  state: UpdateStatus['state']
  percent: number
  targetVersion: string | null
  label: string
}): JSX.Element {
  const id = useId().replace(/:/g, '')
  const past = `about-past-${id}`
  const future = `about-future-${id}`

  const inFlow = state === 'available' || state === 'downloading' || state === 'downloaded'
  const ready = state === 'downloaded'
  const tipX = HX + 310
  const tipY = HY - BRANCH
  const forkPath = `M ${HX + EDGE} ${HY} C ${HX + 76} ${HY}, ${HX + 76} ${tipY}, ${HX + 112} ${tipY} L ${tipX - 10} ${tipY}`

  return (
    <div
      className="relative h-[230px] w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)]"
      role="img"
      aria-label={label}
    >
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id={past} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={HX} y2={0}>
            <stop offset="0" stopColor="var(--color-tertiary-text)" stopOpacity={0} />
            <stop offset="1" stopColor="var(--color-tertiary-text)" stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id={future} gradientUnits="userSpaceOnUse" x1={HX} y1={0} x2={VW} y2={0}>
            <stop offset="0" stopColor="var(--color-success-green)" stopOpacity={0.8} />
            <stop offset="0.6" stopColor="var(--color-success-green)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* History: the trunk and two branches that came home. */}
        <path d={`M 0 ${HY} L ${HX - EDGE} ${HY}`} stroke={`url(#${past})`} strokeWidth={2} strokeLinecap="round" fill="none" pathLength={220} className="lane-path" />
        <path
          d={mergedBranch(182, 502, HY - BRANCH)}
          stroke="var(--color-attention-orange)"
          strokeOpacity={0.4}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          pathLength={220}
          className="lane-path"
        />
        <path
          d={mergedBranch(374, 566, HY + BRANCH)}
          stroke="var(--color-command-blue)"
          strokeOpacity={0.45}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          pathLength={220}
          className="lane-path"
        />
        <Node x={278} y={HY - BRANCH} color="var(--color-attention-orange)" opacity={0.55} delay={520} />
        <Node x={406} y={HY - BRANCH} color="var(--color-attention-orange)" opacity={0.65} delay={460} />
        <Node x={470} y={HY + BRANCH} color="var(--color-command-blue)" opacity={0.75} delay={380} />
        {HISTORY.map((x, i) => (
          <Node key={x} x={x} y={HY} color="var(--color-tertiary-text)" opacity={fade(x)} delay={140 + i * 55} r={i === 0 ? 4.5 : 4} />
        ))}

        {/* The remote side, one shape per update state. */}
        {inFlow ? (
          <>
            {/* Local main stays where it is until the pull lands. */}
            <path d={`M ${HX + EDGE} ${HY} L ${HX + 250} ${HY}`} stroke="var(--color-tertiary-text)" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="2 8" strokeLinecap="round" />
            <path
              d={forkPath}
              stroke="var(--color-attention-orange)"
              strokeOpacity={0.6}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              pathLength={220}
              className="lane-path"
            />
            <path
              d={forkPath}
              stroke={ready ? 'var(--color-success-green)' : 'var(--color-command-blue)'}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
              pathLength={100}
              strokeDasharray={`${ready ? 100 : Math.max(percent, 1)} 100`}
              className="transition-[stroke-dasharray] duration-300 ease-out"
            />
            <circle
              cx={tipX}
              cy={tipY}
              r={7}
              fill={ready ? 'var(--color-success-green)' : 'var(--color-obsidian-panel)'}
              stroke={ready ? 'var(--color-success-green)' : 'var(--color-attention-orange)'}
              strokeWidth={2.5}
              className="lane-node"
              style={{ animationDelay: '420ms' }}
            />
            <text x={tipX + 16} y={tipY - 14} className="fill-tertiary-text font-mono" fontSize={11}>
              origin/main
            </text>
            <text
              x={tipX + 16}
              y={tipY + 4}
              className={`font-mono ${ready ? 'fill-success-green' : 'fill-attention-orange'}`}
              fontSize={12}
              fontWeight={600}
            >
              {targetVersion ? `v${targetVersion}` : '…'}
            </text>
          </>
        ) : state === 'not-available' ? (
          <>
            {/* HEAD and origin/main are the same commit: one line, no fork. */}
            <path d={`M ${HX + EDGE} ${HY} L ${VW} ${HY}`} stroke={`url(#${future})`} strokeWidth={2} strokeLinecap="round" />
            <text x={HX + EDGE + 18} y={HY - 12} className="fill-success-green font-mono" fontSize={11}>
              origin/main
            </text>
          </>
        ) : (
          <>
            {/* Not known yet (or not reachable): the remote is only a promise. */}
            <path
              d={`M ${HX + EDGE} ${HY} L ${HX + 400} ${HY}`}
              stroke="var(--color-tertiary-text)"
              strokeWidth={2}
              className={state === 'checking' ? 'lane-scan' : undefined}
              strokeDasharray={state === 'checking' ? undefined : '2 9'}
              strokeOpacity={state === 'checking' ? undefined : 0.4}
              strokeLinecap="round"
            />
            <text x={HX + 412} y={HY + 4} className="fill-tertiary-text font-mono" fontSize={11} opacity={0.8}>
              origin/main
            </text>
          </>
        )}
      </svg>

      {/* HEAD: the app's own mark, sitting on its trunk. */}
      {/* Positioned by the wrapper, animated by the tile: rise-in owns the
          tile's transform, so it must not also carry the centring translate. */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="rise-in about-emblem">
          <LaneMark size={40} />
        </span>
      </span>
    </div>
  )
}

export default AboutGraph
