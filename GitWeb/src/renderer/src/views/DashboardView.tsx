import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  FileCode2,
  FilePen,
  GitBranch,
  Loader2,
  Minus,
  RefreshCw,
  Tag,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react'
import { useRepoStore } from '../store/repoStore'
import type { BranchOverview, CommitSummary, RepoChurn, TagInfo } from '../../../shared/git'
import { BranchList, ChurnChart, ContributionCalendar, Hotspots, RecentCommits } from '../components/RepoInsights'
import type { Messages } from '../../../shared/i18n'
import { useFormatters, useT } from '../lib/i18n'

type DashboardMessages = Messages['dashboard']

// ---------------------------------------------------------------------------
// Data shaping
// ---------------------------------------------------------------------------

type Period = '30d' | '90d' | '12m' | 'all'

const PERIODS: Period[] = ['30d', '90d', '12m', 'all']

const DAY = 86_400_000
const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { '30d': 30, '90d': 91, '12m': 364 }
// Enough history for a year of a busy repo without making the log call slow.
const LOG_LIMIT = 5000

// Heatmap rows start on Monday, the way a work week reads.
const HEATMAP_ROWS = [1, 2, 3, 4, 5, 6, 0]

// Sentinels, translated only when shown.
const IMAGES = '\u0000images'
const OTHER = '\u0000other'

const LANGUAGES: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  mts: 'TypeScript',
  cts: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  css: 'CSS',
  scss: 'CSS',
  sass: 'CSS',
  less: 'CSS',
  html: 'HTML',
  htm: 'HTML',
  md: 'Markdown',
  mdx: 'Markdown',
  json: 'JSON',
  yml: 'YAML',
  yaml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  py: 'Python',
  cs: 'C#',
  xaml: 'XAML',
  csproj: 'MSBuild',
  sln: 'MSBuild',
  props: 'MSBuild',
  java: 'Java',
  kt: 'Kotlin',
  go: 'Go',
  rs: 'Rust',
  rb: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  c: 'C',
  h: 'C',
  cpp: 'C++',
  cc: 'C++',
  hpp: 'C++',
  sh: 'Shell',
  bash: 'Shell',
  ps1: 'PowerShell',
  bat: 'Batch',
  cmd: 'Batch',
  sql: 'SQL',
  vue: 'Vue',
  svelte: 'Svelte',
  dart: 'Dart',
  png: IMAGES,
  jpg: IMAGES,
  jpeg: IMAGES,
  gif: IMAGES,
  svg: IMAGES,
  webp: IMAGES,
  ico: IMAGES
}

const MAX_LANGUAGE_SLOTS = 7

interface Bin {
  start: number
  end: number
  count: number
  label: string
  /** Long form for the tooltip. */
  title: string
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Local midnight `n` calendar days away — DST-safe, unlike adding n × 24h. */
function addDays(ts: number, n: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime()
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDay(t: DashboardMessages, ts: number): string {
  const d = new Date(ts)
  return t.day(d.getDate(), t.months[d.getMonth()])
}

function relativeTime(t: DashboardMessages, ts: number, now: number): string {
  // Rounded: across a DST change two local midnights are 23h or 25h apart.
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY)
  if (days <= 0) return t.today
  if (days === 1) return t.yesterday
  if (days < 30) return t.daysAgo(days)
  if (days < 365) return t.monthsAgo(Math.min(11, Math.floor(days / 30)))
  return t.yearsAgo(Math.floor(days / 365))
}

function buildBins(t: DashboardMessages, times: number[], period: Period, now: number): Bin[] {
  const today = startOfDay(now)
  const bins: Bin[] = []
  const MONTHS = t.months

  if (period === '30d') {
    for (let i = 29; i >= 0; i--) {
      const start = addDays(today, -i)
      bins.push({ start, end: addDays(start, 1), count: 0, label: formatDay(t, start), title: formatDay(t, start) })
    }
  } else if (period === '90d' || period === '12m') {
    const weeks = period === '90d' ? 13 : 52
    const lastStart = addDays(today, -6)
    for (let i = weeks - 1; i >= 0; i--) {
      const start = addDays(lastStart, -7 * i)
      bins.push({
        start,
        end: addDays(start, 7),
        count: 0,
        label: formatDay(t, start),
        title: t.weekOf(formatDay(t, start))
      })
    }
  } else {
    const oldest = times.length ? Math.min(...times) : now
    const first = new Date(oldest)
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1)
    const end = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1)
    // Always at least two points so the line has somewhere to go.
    if ((end.getFullYear() - cursor.getFullYear()) * 12 + end.getMonth() - cursor.getMonth() < 2) {
      cursor.setMonth(cursor.getMonth() - 1)
    }
    while (cursor < end) {
      const start = cursor.getTime()
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      // "ago/26", not "ago 26": the daily view labels read "26 ago" (day 26).
      const label = `${MONTHS[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`
      bins.push({ start, end: next.getTime(), count: 0, label, title: t.monthOf(MONTHS[cursor.getMonth()], cursor.getFullYear()) })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  for (const time of times) {
    // Bins are contiguous and sorted, so a binary search would do — but even
    // 5 000 commits × 52 bins is trivial, and the linear scan stays obvious.
    for (const bin of bins) {
      if (time >= bin.start && time < bin.end) {
        bin.count++
        break
      }
    }
  }
  return bins
}

interface Contributor {
  key: string
  name: string
  count: number
}

interface LanguageShare {
  name: string
  files: number
  share: number
  /** CSS colour reference — a categorical slot, or the neutral "other". */
  color: string
}

interface Stats {
  total: number
  previous: number | null
  bins: Bin[]
  heatmap: number[][]
  heatmapMax: number
  contributors: Contributor[]
  contributorCount: number
  activeDays: number
  longestStreak: number
  perWeek: number
  lastCommit: CommitSummary | null
}

function computeStats(
  t: DashboardMessages,
  commits: CommitSummary[],
  period: Period,
  now: number,
  truncated: boolean
): Stats {
  const times = commits.map((c) => Date.parse(c.date)).filter((time) => Number.isFinite(time))
  const bins = buildBins(t, times, period, now)
  const periodStart = bins[0]?.start ?? now
  const periodEnd = bins[bins.length - 1]?.end ?? now

  const inPeriod = commits.filter((c) => {
    const time = Date.parse(c.date)
    return time >= periodStart && time < periodEnd
  })

  let previous: number | null = null
  if (period !== 'all') {
    const previousStart = addDays(periodStart, -PERIOD_DAYS[period])
    // When the log hit LOG_LIMIT, the previous window may reach past the oldest
    // fetched commit; comparing against a partial count would fake a jump.
    const oldest = times.length ? Math.min(...times) : now
    previous =
      truncated && previousStart < oldest ? null : times.filter((time) => time >= previousStart && time < periodStart).length
  }

  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  const people = new Map<string, Contributor>()
  const days = new Set<string>()
  for (const c of inPeriod) {
    const time = Date.parse(c.date)
    const d = new Date(time)
    heatmap[d.getDay()][d.getHours()]++
    days.add(dayKey(time))
    const key = (c.authorEmail || c.authorName).toLowerCase()
    const entry = people.get(key)
    if (entry) entry.count++
    else people.set(key, { key, name: c.authorName || c.authorEmail, count: 1 })
  }

  // Longest run of consecutive calendar days with at least one commit.
  let longestStreak = 0
  let run = 0
  for (let day = startOfDay(periodStart); day < periodEnd; day = addDays(day, 1)) {
    if (days.has(dayKey(day))) {
      run++
      longestStreak = Math.max(longestStreak, run)
    } else {
      run = 0
    }
  }

  const weeks = Math.max(1, (Math.min(periodEnd, now) - periodStart) / (7 * DAY))
  const contributors = [...people.values()].sort((a, b) => b.count - a.count)

  return {
    total: inPeriod.length,
    previous,
    bins,
    heatmap,
    heatmapMax: Math.max(0, ...heatmap.flat()),
    contributors: contributors.slice(0, 6),
    contributorCount: contributors.length,
    activeDays: days.size,
    longestStreak,
    perWeek: inPeriod.length / weeks,
    lastCommit: commits[0] ?? null
  }
}

function computeLanguages(files: string[]): LanguageShare[] {
  const counts = new Map<string, number>()
  for (const file of files) {
    const base = file.split('/').pop() ?? file
    const dot = base.lastIndexOf('.')
    const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
    const lang = LANGUAGES[ext] ?? OTHER
    counts.set(lang, (counts.get(lang) ?? 0) + 1)
  }
  const total = files.length || 1
  const named = [...counts.entries()].filter(([name]) => name !== OTHER).sort((a, b) => b[1] - a[1])
  const top = named.slice(0, MAX_LANGUAGE_SLOTS)
  const rest = named.slice(MAX_LANGUAGE_SLOTS).reduce((sum, [, n]) => sum + n, 0) + (counts.get(OTHER) ?? 0)

  // The language set only changes when files do, never with the period filter,
  // so rank-ordered slots stay attached to the same language while viewing.
  const shares: LanguageShare[] = top.map(([name, n], i) => ({
    name,
    files: n,
    share: n / total,
    color: `var(--viz-${i + 1})`
  }))
  if (rest > 0) shares.push({ name: OTHER, files: rest, share: rest / total, color: 'var(--viz-other)' })
  return shares
}

// Even steps only, so the middle gridline (max / 2) is always a whole number
// of commits — never a "2,5" tick on a count axis.
function niceMax(value: number): number {
  if (value <= 4) return 4
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const step of [2, 4, 6, 8, 10]) {
    const candidate = step * magnitude
    if (candidate >= value) return candidate
  }
  return 10 * magnitude
}

function percent(share: number): string {
  if (share > 0 && share < 0.01) return '<1%'
  return `${Math.round(share * 100)}%`
}

function initials(name: string): string {
  const parts = name.replace(/[<>@].*$/, '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

// Monotone cubic interpolation (Fritsch–Carlson): smooth, but never dips below
// zero between two points, so the curve can't invent negative commits.
function monotonePath(points: [number, number][]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${points[0][0]},${points[0][1]}`
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1][0] - points[i][0]
    slope[i] = (points[i + 1][1] - points[i][1]) / dx[i]
  }
  const tangent: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  tangent[n - 1] = slope[n - 2]
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const h = a * a + b * b
    if (h > 9) {
      const s = 3 / Math.sqrt(h)
      tangent[i] = s * a * slope[i]
      tangent[i + 1] = s * b * slope[i]
    }
  }
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${points[i][0] + h},${points[i][1] + tangent[i] * h} ${points[i + 1][0] - h},${points[i + 1][1] - tangent[i + 1] * h} ${points[i + 1][0]},${points[i + 1][1]}`
  }
  return d
}

function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }): JSX.Element {
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-20 min-w-28 -translate-x-1/2 -translate-y-full rounded-md border border-default-border bg-coal-raised px-2.5 py-1.5 text-caption shadow-floating"
      style={{ left: x, top: y - 10 }}
    >
      {children}
    </div>
  )
}

function Card({
  title,
  subtitle,
  children,
  className = ''
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <section
      className={`rise-in flex min-w-0 flex-col rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-[var(--shadow-raised)] ${className}`}
    >
      <header className="mb-4">
        <h2 className="text-body font-semibold text-primary-text">{title}</h2>
        {subtitle && <p className="mt-0.5 text-caption text-tertiary-text">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function Delta({ current, previous, comparison }: { current: number; previous: number | null; comparison: string }): JSX.Element | null {
  const t = useT().dashboard
  if (previous === null) return null
  if (previous === 0 && current === 0) return null
  const change = previous === 0 ? null : (current - previous) / previous
  const up = current > previous
  const flat = current === previous
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  const text = change === null ? t.deltaNew : `${up ? '+' : ''}${Math.round(change * 100)}%`
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-caption font-semibold ${
          flat ? 'bg-hover-overlay text-secondary-text' : up ? 'bg-success-green-soft text-success-green' : 'bg-hover-overlay text-secondary-text'
        }`}
      >
        <Icon size={13} aria-hidden />
        {text}
      </span>
      <span className="text-caption text-tertiary-text">{comparison}</span>
    </div>
  )
}

function ActivityChart({ bins }: { bins: Bin[] }): JSX.Element {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>()
  const t = useT().dashboard
  const fmt = useFormatters()
  const gradientId = useId()
  const [active, setActive] = useState<number | null>(null)
  const height = 232
  const pad = { top: 22, right: 14, bottom: 28, left: 34 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const max = niceMax(Math.max(0, ...bins.map((b) => b.count)))
  const n = bins.length
  const x = (i: number): number => pad.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1))
  const y = (v: number): number => pad.top + innerH - (v / max) * innerH
  const points: [number, number][] = bins.map((b, i) => [x(i), y(b.count)])
  const line = monotonePath(points)
  const baseY = pad.top + innerH
  const area = points.length ? `${line}L${points[points.length - 1][0]},${baseY}L${points[0][0]},${baseY}Z` : ''
  const ticks = [0, max / 2, max]
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 90))))
  const peakIndex = bins.reduce((best, b, i) => (b.count > bins[best].count ? i : best), 0)

  const pick = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (n === 0) return
      const rel = clientX - rect.left - pad.left
      const i = Math.round((rel / Math.max(1, innerW)) * (n - 1))
      setActive(Math.min(n - 1, Math.max(0, i)))
    },
    [n, innerW, pad.left]
  )

  return (
    <div ref={wrapRef} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={t.chartAria}
          tabIndex={0}
          className="block outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-command-blue/50"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? n - 1) - 1))
            if (e.key === 'ArrowRight') setActive((a) => Math.min(n - 1, (a ?? 0) + 1))
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--viz-1)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="var(--viz-1)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
              <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-tertiary-text text-meta tabular-nums">
                {fmt.number(tick)}
              </text>
            </g>
          ))}

          {bins.map((b, i) =>
            // The last label is always drawn (right-aligned); a regular one too
            // close to it would print on top of it ("23 set" + "24 set").
            (i % labelEvery === 0 && (i === n - 1 || x(n - 1) - x(i) >= 72)) || i === n - 1 ? (
              <text key={b.start} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-tertiary-text text-meta">
                {b.label}
              </text>
            ) : null
          )}

          <path d={area} fill={`url(#${gradientId})`} className="animate-[viz-fade_700ms_ease-out_both]" />
          <path
            d={line}
            fill="none"
            stroke="var(--viz-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            className="animate-[viz-draw_1100ms_cubic-bezier(0.16,1,0.3,1)_both]"
          />

          {bins[peakIndex]?.count > 0 && active === null && (
            <g className="animate-[viz-fade_400ms_ease-out_900ms_both]">
              <circle cx={x(peakIndex)} cy={y(bins[peakIndex].count)} r={4} fill="var(--viz-1)" stroke="var(--color-obsidian-panel)" strokeWidth={2} />
              <text
                x={x(peakIndex)}
                y={y(bins[peakIndex].count) - 10}
                // By pixels, not by index share: with few points ("Tudo" = 2 bins) the
                // share test missed the right edge and the label was cut off.
                textAnchor={x(peakIndex) > width - pad.right - 40 ? 'end' : x(peakIndex) < pad.left + 40 ? 'start' : 'middle'}
                className="fill-secondary-text text-meta font-medium"
              >
                {t.peak} · {fmt.number(bins[peakIndex].count)}
              </text>
            </g>
          )}

          {active !== null && bins[active] && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={pad.top} y2={baseY} stroke="var(--viz-axis)" />
              <circle cx={x(active)} cy={y(bins[active].count)} r={5} fill="var(--viz-1)" stroke="var(--color-obsidian-panel)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {active !== null && bins[active] && (
        <Tooltip x={x(active)} y={y(bins[active].count)}>
          <p className="text-body font-semibold tabular-nums text-primary-text">
            {fmt.number(bins[active].count)} {t.commitCount(bins[active].count)}
          </p>
          <p className="flex items-center gap-1.5 text-tertiary-text">
            <span className="h-0.5 w-3 rounded-full bg-[var(--viz-1)]" aria-hidden />
            {bins[active].title}
          </p>
        </Tooltip>
      )}
      <table className="sr-only">
        <caption>{t.commitsByPeriod}</caption>
        <tbody>
          {bins.map((b) => (
            <tr key={b.start}>
              <th scope="row">{b.title}</th>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Heatmap({ grid, max }: { grid: number[][]; max: number }): JSX.Element {
  const [hover, setHover] = useState<{ day: number; hour: number; x: number; y: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const t = useT().dashboard
  const fmt = useFormatters()
  const level = (count: number): number => (count === 0 || max === 0 ? 0 : Math.min(5, Math.max(1, Math.ceil((count / max) * 5))))
  const fill = (lvl: number): string => (lvl === 0 ? 'var(--color-coal-raised)' : `var(--viz-seq-${lvl})`)

  return (
    <div ref={wrapRef} className="relative">
      <div className="grid grid-cols-[28px_repeat(24,minmax(0,1fr))] gap-[3px]" onPointerLeave={() => setHover(null)}>
        {HEATMAP_ROWS.map((day) => (
          <div key={day} className="contents">
            <span className="flex items-center text-meta text-tertiary-text">{t.weekdays[day]}</span>
            {grid[day].map((count, hour) => (
              <span
                key={hour}
                className="aspect-square min-h-3 rounded-[3px] transition-[transform,outline-color] duration-150 hover:scale-125 hover:outline hover:outline-2 hover:outline-offset-1 hover:outline-[var(--viz-axis)]"
                style={{ backgroundColor: fill(level(count)) }}
                onPointerEnter={(e) => {
                  const cell = e.currentTarget.getBoundingClientRect()
                  const box = wrapRef.current?.getBoundingClientRect()
                  if (!box) return
                  setHover({ day, hour, x: cell.left - box.left + cell.width / 2, y: cell.top - box.top })
                }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="pt-1 text-center text-[10px] text-tertiary-text">
            {hour % 6 === 0 ? `${hour}h` : ''}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-meta text-tertiary-text" aria-hidden>
        {t.less}
        {[0, 1, 2, 3, 4, 5].map((lvl) => (
          <span key={lvl} className="size-3 rounded-[3px]" style={{ backgroundColor: fill(lvl) }} />
        ))}
        {t.more}
      </div>

      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <p className="text-body font-semibold tabular-nums text-primary-text">
            {fmt.number(grid[hover.day][hover.hour])} {t.commitCount(grid[hover.day][hover.hour])}
          </p>
          <p className="text-tertiary-text">
            {t.weekdaysLong[hover.day]}, {hover.hour}h–{hover.hour + 1}h
          </p>
        </Tooltip>
      )}

      <table className="sr-only">
        <caption>{t.commitsByWeekday}</caption>
        <tbody>
          {HEATMAP_ROWS.map((day) => (
            <tr key={day}>
              <th scope="row">{t.weekdaysLong[day]}</th>
              <td>{grid[day].reduce((a, b) => a + b, 0)} commits</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Contributors({ people, total }: { people: Contributor[]; total: number }): JSX.Element {
  const max = Math.max(1, ...people.map((p) => p.count))
  const t = useT().dashboard
  const fmt = useFormatters()
  if (people.length === 0) {
    return <p className="text-caption text-tertiary-text">{t.noCommitsInPeriod}</p>
  }
  return (
    <ol className="flex flex-col gap-3.5">
      {people.map((person, i) => (
        <li key={person.key} className="flex items-center gap-3" title={t.personCommits(person.name, person.count)}>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-meta font-semibold shadow-[var(--shadow-raised)]"
            style={{ backgroundColor: `var(--viz-${(i % 8) + 1})`, color: `var(--viz-${(i % 8) + 1}-ink)` }}
            aria-hidden
          >
            {initials(person.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-body text-primary-text">{person.name}</span>
              <span className="shrink-0 text-caption tabular-nums text-secondary-text">
                <span className="font-semibold text-primary-text">{fmt.number(person.count)}</span> · {percent(person.count / Math.max(1, total))}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hover-overlay">
              <div
                className="h-full origin-left rounded-full bg-[var(--viz-1)] animate-[viz-grow-x_900ms_cubic-bezier(0.16,1,0.3,1)_both]"
                style={{ width: `${(person.count / max) * 100}%`, animationDelay: `${i * 70}ms` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Languages({ shares, fileCount }: { shares: LanguageShare[]; fileCount: number }): JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const t = useT().dashboard
  const fmt = useFormatters()
  const displayName = (name: string): string => (name === OTHER ? t.other : name === IMAGES ? t.images : name)
  if (shares.length === 0) return <p className="text-caption text-tertiary-text">{t.noTrackedFiles}</p>
  return (
    // `relative` anchors the sr-only summary; without it the absolutely
    // positioned text escapes the scroll container and stretches the window.
    <div className="relative flex flex-col gap-5">
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full" onPointerLeave={() => setHover(null)}>
        {shares.map((s, i) => (
          <span
            key={s.name}
            className="h-full min-w-[3px] origin-left transition-opacity duration-150 animate-[viz-grow-x_900ms_cubic-bezier(0.16,1,0.3,1)_both]"
            style={{
              width: `${s.share * 100}%`,
              backgroundColor: s.color,
              opacity: hover === null || hover === i ? 1 : 0.35,
              animationDelay: `${i * 60}ms`
            }}
            onPointerEnter={() => setHover(i)}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-3 @[640px]:grid-cols-4">
        {shares.map((s, i) => (
          <li
            key={s.name}
            className={`flex min-w-0 items-start gap-2.5 transition-opacity duration-150 ${hover === null || hover === i ? '' : 'opacity-50'}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="mt-1 size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-body text-primary-text">{displayName(s.name)}</span>
              <span className="text-caption text-tertiary-text">
                <span className="font-semibold text-secondary-text">{percent(s.share)}</span> · {fmt.number(s.files)}{' '}
                {t.fileCount(s.files)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only">{t.totalFiles(fileCount)}</p>
    </div>
  )
}

function StatItem({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof Users
  label: string
  value: string
  detail?: string
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1 p-5">
      <span className="flex items-center gap-1.5 text-caption text-secondary-text">
        <Icon size={14} className="shrink-0 text-tertiary-text" aria-hidden />
        {label}
      </span>
      <span className="text-headline font-semibold text-primary-text">{value}</span>
      {detail && <span className="truncate text-caption text-tertiary-text">{detail}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

interface RepoData {
  commits: CommitSummary[]
  files: string[]
  branches: BranchOverview[]
  tags: TagInfo[]
}

// Churn depends on the period too, so it has its own small cache keyed by both.
const churnCache = new Map<string, RepoChurn>()
const CHURN_LIMIT = 3000

// Views unmount on every tab switch, so without this each visit to the tab
// would rerun a 5 000-commit `git log` and a full `ls-files`. A short-lived
// per-repo cache shows the last result at once; the refresh button (or an
// expired entry) refetches in the background, keeping the frame.
const CACHE_TTL = 60_000
let cache: { path: string; data: RepoData; at: number } | null = null

function DashboardView(): JSX.Element {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const branches = useRepoStore((s) => s.branches)
  const status = useRepoStore((s) => s.status)
  const stashCount = useRepoStore((s) => s.stashes.length)
  const [period, setPeriod] = useState<Period>('12m')
  const [data, setData] = useState<RepoData | null>(() =>
    cache && cache.path === currentRepoPath ? cache.data : null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)
  const t = useT().dashboard
  const fmt = useFormatters()

  const load = useCallback(async () => {
    if (!currentRepoPath) return
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const [commits, files, branchList, tags] = await Promise.all([
        window.api.git.log(currentRepoPath, LOG_LIMIT),
        window.api.git.listFiles(currentRepoPath).catch((): string[] => []),
        window.api.git.branchOverview(currentRepoPath).catch((): BranchOverview[] => []),
        window.api.git.listTags(currentRepoPath).catch((): TagInfo[] => []),
        useRepoStore.getState().refreshStashes()
      ])
      if (request !== requestRef.current) return
      const next = { commits, files, branches: branchList, tags }
      cache = { path: currentRepoPath, data: next, at: Date.now() }
      setData(next)
    } catch (err) {
      if (request === requestRef.current) setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [currentRepoPath])

  useEffect(() => {
    const cached = cache && cache.path === currentRepoPath ? cache : null
    setData(cached ? cached.data : null)
    if (!cached || Date.now() - cached.at > CACHE_TTL) void load()
  }, [load, currentRepoPath])

  const now = useMemo(() => Date.now(), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(
    () => (data ? computeStats(t, data.commits, period, now, data.commits.length >= LOG_LIMIT) : null),
    [t, data, period, now]
  )
  const languages = useMemo(() => (data ? computeLanguages(data.files) : []), [data])

  // Line churn for the selected period — fetched on its own so the rest of
  // the page never waits for a `log --numstat`.
  const churnKey = `${currentRepoPath}|${period}`
  const [churn, setChurn] = useState<RepoChurn | null>(() => churnCache.get(churnKey) ?? null)
  useEffect(() => {
    if (!currentRepoPath || !data) return
    setChurn(churnCache.get(churnKey) ?? null)
    let alive = true
    window.api.git
      .repoChurn(currentRepoPath, period === 'all' ? null : PERIOD_DAYS[period], CHURN_LIMIT)
      .then((result) => {
        churnCache.set(churnKey, result)
        if (alive) setChurn(result)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [currentRepoPath, period, churnKey, data])

  // The latest tag reachable from HEAD, and how many commits came after it.
  const release = useMemo(() => {
    if (!data || data.tags.length === 0) return null
    const position = new Map(data.commits.map((c, i) => [c.hash, i]))
    let best: { name: string; since: number } | null = null
    for (const tag of data.tags) {
      const index = position.get(tag.target)
      if (index !== undefined && (best === null || index < best.since)) best = { name: tag.name, since: index }
    }
    return best
  }, [data])

  const openInHistory = useCallback((hash: string) => {
    const store = useRepoStore.getState()
    store.setView('history')
    void store.focusCommitInHistory(hash)
  }, [])
  const periodInfo = t.period[period]

  const pending = status?.entries.length ?? 0
  const repoName = currentRepoPath?.split(/[\\/]/).filter(Boolean).pop() ?? ''

  return (
    <div className="h-full overflow-y-auto">
      <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-headline font-semibold text-primary-text">Dashboard</h1>
            <p className="mt-0.5 truncate text-body text-secondary-text">
              {t.howIsRepo} <span className="font-medium text-primary-text">{repoName}</span>
            </p>
            {(status?.branch || release) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {status?.branch && (
                  <span className="insight-chip is-blue">
                    <GitBranch size={11} aria-hidden /> {status.branch}
                  </span>
                )}
                {release && (
                  <span className="insight-chip is-green" title={t.releaseTitle}>
                    <Tag size={11} aria-hidden /> {t.releaseChip(release.name, release.since)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-default-border bg-obsidian-panel p-1 shadow-[var(--shadow-raised)]" role="radiogroup" aria-label={t.periodAria}>
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-sm px-3 py-1 text-caption font-medium transition-colors duration-150 ${
                    period === p ? 'bg-command-blue-soft text-command-blue' : 'text-secondary-text hover:bg-hover-overlay hover:text-primary-text'
                  }`}
                >
                  {t.period[p].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="btn-secondary size-[34px] px-0"
              aria-label={t.refresh}
              title={t.refresh}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} aria-hidden />
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-danger-red/30 bg-danger-red-soft px-4 py-3 text-body text-danger-red">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        {!stats && !error && (
          <div className="flex h-80 items-center justify-center gap-2 text-body text-secondary-text">
            <Loader2 size={16} className="animate-spin" aria-hidden /> {t.readingHistory}
          </div>
        )}

        {stats && data && data.commits.length === 0 && (
          <div className="flex h-80 flex-col items-center justify-center gap-3 text-center">
            <span className="empty-medallion rise-in">
              <CalendarDays size={20} aria-hidden />
            </span>
            <p className="text-title font-semibold text-primary-text">{t.noCommitsYet}</p>
            <p className="max-w-sm text-body text-secondary-text">{t.noCommitsYetHint}</p>
          </div>
        )}

        {stats && data && data.commits.length > 0 && (
          <div className={`flex flex-col gap-5 transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}>
            {/* Activity: the hero number and its trend live in one card. */}
            <section className="rise-in grid min-w-0 grid-cols-1 overflow-hidden rounded-lg border border-default-border bg-obsidian-panel shadow-[var(--shadow-raised)] @[820px]:grid-cols-[260px_minmax(0,1fr)]">
              <div className="flex flex-col gap-4 border-b border-default-border p-6 @[820px]:border-b-0 @[820px]:border-r">
                <div>
                  <p className="text-body font-semibold text-primary-text">{t.commits}</p>
                  <p className="text-caption text-tertiary-text">{period === 'all' ? t.allHistory : t.lastPeriod(periodInfo.label)}</p>
                </div>
                <p className="text-[56px] font-semibold leading-none tracking-[-0.03em] text-primary-text">{fmt.number(stats.total)}</p>
                <Delta current={stats.total} previous={stats.previous} comparison={periodInfo.comparison} />
                <dl className="mt-auto flex flex-col gap-2.5 border-t border-default-border pt-4 text-caption">
                  <div className="flex justify-between gap-3">
                    <dt className="text-tertiary-text">{t.perWeek}</dt>
                    <dd className="font-medium text-primary-text">{fmt.decimal(stats.perWeek)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-tertiary-text">{t.longestStreak}</dt>
                    <dd className="font-medium text-primary-text">
                      {stats.longestStreak} {t.days(stats.longestStreak)}
                    </dd>
                  </div>
                  {stats.lastCommit && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-tertiary-text">{t.lastCommit}</dt>
                      <dd className="truncate font-medium text-primary-text" title={stats.lastCommit.summary}>
                        {relativeTime(t, Date.parse(stats.lastCommit.date), now)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="min-w-0 p-6 pb-4">
                <p className="mb-2 text-body font-semibold text-primary-text">{t.activity}</p>
                <ActivityChart key={period} bins={stats.bins} />
              </div>
            </section>

            {/* Repository state, as one strip rather than a grid of look-alike cards. */}
            <section className="rise-in grid grid-cols-2 divide-default-border overflow-hidden rounded-lg border border-default-border bg-obsidian-panel shadow-[var(--shadow-raised)] [animation-delay:60ms] @[720px]:grid-cols-4 @[720px]:divide-x">
              <StatItem
                icon={Users}
                label={t.contributors}
                value={fmt.number(stats.contributorCount)}
                detail={period === 'all' ? t.inAllHistory : t.inLastPeriod(periodInfo.label)}
              />
              <StatItem
                icon={CalendarDays}
                label={t.activeDays}
                value={fmt.number(stats.activeDays)}
                detail={period === 'all' ? t.inAllHistory : t.inLastPeriod(periodInfo.label)}
              />
              <StatItem
                icon={GitBranch}
                label={t.localBranches}
                value={fmt.number(branches.length)}
                detail={status?.branch ? t.currentBranch(status.branch) : undefined}
              />
              <StatItem
                icon={pending > 0 ? FilePen : Archive}
                label={t.pendingChanges}
                value={fmt.number(pending)}
                detail={`${fmt.number(stashCount)} ${t.stashesSaved(stashCount)}`}
              />
            </section>

            <div className="grid grid-cols-1 gap-5 @[900px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <Card title={t.churnTitle} subtitle={t.churnHint} className="[animation-delay:90ms]">
                {churn ? (
                  <ChurnChart key={period} points={churn.commits} bins={stats.bins} />
                ) : (
                  <div className="flex h-56 items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-tertiary-text" aria-hidden />
                  </div>
                )}
              </Card>
              <Card title={t.hotspotsTitle} subtitle={t.hotspotsHint} className="[animation-delay:110ms]">
                {churn ? (
                  <Hotspots key={period} items={churn.hotspots} />
                ) : (
                  <div className="flex h-56 items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-tertiary-text" aria-hidden />
                  </div>
                )}
              </Card>
            </div>

            <Card
              title={t.calendarTitle}
              subtitle={t.calendarHint(fmt.number(data.commits.filter((c) => Date.parse(c.date) > now - 365 * DAY).length))}
              className="[animation-delay:130ms]"
            >
              <ContributionCalendar commits={data.commits} now={now} />
            </Card>

            <div className="grid grid-cols-1 gap-5 @[900px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <Card title={t.whenCommits} subtitle={t.whenCommitsHint} className="[animation-delay:120ms]">
                <Heatmap key={period} grid={stats.heatmap} max={stats.heatmapMax} />
              </Card>
              <Card title={t.topContributors} subtitle={t.commitsInPeriod(fmt.number(stats.total))} className="[animation-delay:160ms]">
                <Contributors key={period} people={stats.contributors} total={stats.total} />
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-5 @[900px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card title={t.branchesTitle} subtitle={t.branchesHint(data.branches.length)} className="[animation-delay:180ms]">
                <BranchList branches={data.branches} now={now} />
              </Card>
              <Card title={t.recentTitle} subtitle={t.recentHint} className="[animation-delay:190ms]">
                <RecentCommits commits={data.commits} now={now} onOpen={openInHistory} />
              </Card>
            </div>

            <Card title={t.languages} subtitle={t.languagesHint(fmt.number(data.files.length))} className="@container [animation-delay:200ms]">
              <Languages shares={languages} fileCount={data.files.length} />
            </Card>

            <p className="flex items-center justify-center gap-1.5 pb-2 text-caption text-tertiary-text">
              <FileCode2 size={12} aria-hidden />
              {data.commits.length >= LOG_LIMIT
                ? t.basedOnRecent(fmt.number(LOG_LIMIT))
                : t.basedOnBranch}
              {churn?.truncated ? ` ${t.churnTruncated(fmt.number(CHURN_LIMIT))}` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardView
