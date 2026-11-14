import { useState } from 'react'
import type { Locale } from '../../../shared/i18n'
import { relativeTime } from '../lib/relativeTime'

/**
 * The signed-in user as HEAD: a branch leaves the bottom of their avatar and
 * runs right, carrying one node per repository at the age of its last commit —
 * near the avatar is now, the far end is WINDOW_DAYS ago (older ones rest
 * there, faded). The same gesture as the app's mark and the row lanes, so the
 * footer reads as part of the bench rather than as a profile widget.
 *
 * Monochrome on purpose: hue on this screen means repository state, and age is
 * not a state. Recency is carried by opacity and the newest node's size.
 */

const W = 292
const H = 30
const TRUNK = 18 // avatar centre, in the footer's own coordinates
const LANE_Y = 20
const X0 = 44
const X1 = W - 58
const DAY = 86_400_000
export const WINDOW_DAYS = 60

export interface PulsePoint {
  name: string
  date: string
}

function ageRatio(iso: string, now: number): number {
  const days = Math.max(0, (now - Date.parse(iso)) / DAY)
  // sqrt spreads the recent end, where most of the interest is.
  return Math.min(1, Math.sqrt(days / WINDOW_DAYS))
}

function BenchPulse({
  points,
  locale,
  windowLabel,
  title
}: {
  points: PulsePoint[]
  locale: Locale
  windowLabel: string
  title: string
}): JSX.Element | null {
  const [now] = useState(Date.now)
  const placed = points
    .filter((p) => Number.isFinite(Date.parse(p.date)))
    .map((p) => ({ ...p, t: ageRatio(p.date, now) }))
    // Oldest first, so the newest nodes paint on top where they overlap.
    .sort((a, b) => b.t - a.t)
  if (placed.length === 0) return null
  const newest = placed[placed.length - 1]

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="-mt-2 block overflow-visible" role="img" aria-label={title}>
      <title>{title}</title>
      {/* Out of the avatar, bend, and away — the branch gesture. */}
      <path
        d={`M ${TRUNK} 0 L ${TRUNK} ${LANE_Y - 10} C ${TRUNK} ${LANE_Y - 2}, ${TRUNK + 6} ${LANE_Y}, ${TRUNK + 16} ${LANE_Y} L ${X1 + 6} ${LANE_Y}`}
        pathLength={220}
        stroke="var(--color-tertiary-text)"
        strokeOpacity={0.45}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        className="lane-path"
      />
      {/* Past the window: the lane fades out instead of ending on a cap. */}
      <path
        d={`M ${X1 + 10} ${LANE_Y} L ${X1 + 18} ${LANE_Y}`}
        stroke="var(--color-tertiary-text)"
        strokeOpacity={0.35}
        strokeWidth={1.5}
        strokeDasharray="1 3"
        strokeLinecap="round"
      />
      {placed.map((p, i) => {
        const isNewest = p === newest
        return (
          <circle
            key={`${p.name}-${i}`}
            cx={X0 + p.t * (X1 - X0)}
            cy={LANE_Y}
            r={isNewest ? 4 : p.t >= 1 ? 2 : 2.75}
            fill="var(--color-primary-text)"
            fillOpacity={isNewest ? 1 : 0.85 - 0.6 * p.t}
            stroke="var(--color-obsidian-panel)"
            strokeWidth={1.5}
            className="lane-node"
            style={{ animationDelay: `${240 + p.t * 360}ms` }}
          >
            <title>{`${p.name} · ${relativeTime(locale, p.date, now)}`}</title>
          </circle>
        )
      })}
      <text x={W} y={LANE_Y + 3.5} textAnchor="end" className="fill-tertiary-text text-meta tabular-nums">
        {windowLabel}
      </text>
    </svg>
  )
}

export default BenchPulse
