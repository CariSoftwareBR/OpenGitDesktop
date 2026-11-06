import type { TimelineItem } from './messageTimeline'

const DAY = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 30
const MAX_LANES = 5
const TICK_DAYS = [7, 14, 30]
// Below 1 stretches the recent end of the axis: today matters more than last month.
const TIME_CURVE = 0.55
const LABEL_GUTTER = 172
const RIGHT_GUTTER = 64
const TOP = 118
const BOTTOM_GUTTER = 100
const MAX_LANE_GAP = 44
const COLLISION_PX = 20

export interface SkyPoint {
  key: string
  x: number
  y: number
  item: TimelineItem
}

export interface SkyLayout {
  lanes: { repo: string; y: number }[]
  points: SkyPoint[]
  ticks: { x: number; days: number }[]
  head: { x: number; y: number }
  left: number
  /** The line through everything, oldest to newest, ending at the present. */
  path: string
}

function repoOf(item: TimelineItem): string {
  return item.type === 'notification' ? item.notification.repoFullName : item.star.repoFullName
}

/**
 * Places the account's activity on a map: one lane per repository, time running
 * left to right to the present. The busiest-lately repositories get a lane; the
 * rest still appear in the list below, which is the complete record.
 */
export function layoutSky(items: TimelineItem[], width: number, height: number, now = Date.now()): SkyLayout {
  const left = LABEL_GUTTER
  const right = Math.max(left + 40, width - RIGHT_GUTTER)
  const xForAge = (age: number): number => right - (right - left) * Math.pow(Math.min(Math.max(age, 0) / (WINDOW_DAYS * DAY), 1), TIME_CURVE)

  const newestFirst = [...items].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const repos = [...new Set(newestFirst.map(repoOf))].slice(0, MAX_LANES)
  const available = Math.max(0, height - BOTTOM_GUTTER - TOP)
  const gap = repos.length > 1 ? Math.min(MAX_LANE_GAP, available / (repos.length - 1)) : 0
  const spread = gap * Math.max(0, repos.length - 1)
  const firstY = TOP + (available - spread) / 2
  const lanes = repos.map((repo, index) => ({ repo, y: firstY + index * gap }))
  const laneY = new Map(lanes.map((lane) => [lane.repo, lane.y]))

  const points: SkyPoint[] = []
  for (const item of newestFirst) {
    const y = laneY.get(repoOf(item))
    if (y === undefined) continue
    const x = xForAge(now - Date.parse(item.at))
    // Things that happened together fan out instead of landing on top of each other.
    const crowd = points.filter((point) => Math.abs(point.x - x) < COLLISION_PX && Math.abs(point.y - y) < MAX_LANE_GAP / 2).length
    const nudge = crowd === 0 ? 0 : (crowd % 2 === 1 ? -1 : 1) * Math.ceil(crowd / 2) * 13
    points.push({ key: item.key, x, y: y + nudge, item })
  }

  const head = { x: right + 26, y: points[0]?.y ?? firstY }
  const oldestFirst = [...points].reverse()
  let path = ''
  if (oldestFirst.length > 0) {
    const route = [...oldestFirst.map(({ x, y }) => ({ x, y })), head]
    path = `M${left - 8} ${route[0].y} L${route[0].x} ${route[0].y}`
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1]
      const to = route[i]
      const middle = (from.x + to.x) / 2
      path += ` C${middle} ${from.y} ${middle} ${to.y} ${to.x} ${to.y}`
    }
  }

  return {
    lanes,
    points,
    ticks: TICK_DAYS.map((days) => ({ x: xForAge(days * DAY), days })),
    head,
    left,
    path
  }
}

/** The same scatter on every render, so the background never jumps. */
export function skyDust(count: number): { x: number; y: number; r: number; o: number }[] {
  let seed = 48271
  const next = (): number => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: count }, () => ({ x: next(), y: next(), r: 0.4 + next() * 0.9, o: 0.12 + next() * 0.5 }))
}
