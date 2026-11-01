import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, CloudOff, GitBranch, GitCommitHorizontal, Laptop } from 'lucide-react'
import type { BranchOverview, ChurnPoint, CommitSummary, FileHotspot } from '../../../shared/git'
import { useFormatters, useLocale, useT } from '../lib/i18n'
import { relativeTime } from '../lib/relativeTime'

/**
 * The Dashboard's second act: what the code itself did (volume, hotspots),
 * a year at a glance, and the state of every branch. Pure presentation —
 * the view loads the data and hands it down.
 */

interface PeriodBin {
  start: number
  end: number
  label: string
  title: string
}

const DAY = 86_400_000

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function addDays(ts: number, n: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime()
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** 1 234 → "1,2 mil" style compaction, through the locale. */
function useCompact(): (n: number) => string {
  const locale = useLocale()
  return useMemo(() => {
    const format = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
    return (n: number) => format.format(n)
  }, [locale])
}

function HoverTip({ x, y, children }: { x: number; y: number; children: React.ReactNode }): JSX.Element {
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-20 min-w-28 -translate-x-1/2 -translate-y-full rounded-md border border-default-border bg-coal-raised px-2.5 py-1.5 text-caption shadow-floating"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  )
}

/* ── Code volume ───────────────────────────────────────────────────────── */

export function ChurnChart({ points, bins }: { points: ChurnPoint[]; bins: PeriodBin[] }): JSX.Element {
  const t = useT().dashboard
  const compact = useCompact()
  const fmt = useFormatters()
  const [active, setActive] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const series = useMemo(() => {
    const sums = bins.map(() => ({ additions: 0, deletions: 0 }))
    for (const point of points) {
      const time = Date.parse(point.date)
      // Bins are contiguous and ordered: a binary search would do, but a
      // year is at most 53 bins — a scan is clearer.
      const index = bins.findIndex((b) => time >= b.start && time < b.end)
      if (index >= 0) {
        sums[index].additions += point.additions
        sums[index].deletions += point.deletions
      }
    }
    return sums
  }, [points, bins])

  const totals = series.reduce((acc, s) => ({ additions: acc.additions + s.additions, deletions: acc.deletions + s.deletions }), { additions: 0, deletions: 0 })
  const max = Math.max(1, ...series.map((s) => Math.max(s.additions, s.deletions)))
  const n = Math.max(1, series.length)
  const barGap = n > 40 ? 1 : 2

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-diff-add-ink tabular-nums">+{compact(totals.additions)}</span>
          <span className="text-caption text-tertiary-text">{t.linesAdded}</span>
        </p>
        <p className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-danger-red tabular-nums">−{compact(totals.deletions)}</span>
          <span className="text-caption text-tertiary-text">{t.linesRemoved}</span>
        </p>
      </div>

      <div ref={wrapRef} className="relative" onPointerLeave={() => setActive(null)} role="img" aria-label={t.churnAria}>
        <div className="churn-chart flex h-44 items-stretch" style={{ gap: barGap }}>
          {series.map((s, i) => (
            <div
              key={bins[i]?.start ?? i}
              className={`churn-col relative flex min-w-0 flex-1 flex-col ${active === i ? 'is-active' : ''}`}
              onPointerEnter={() => setActive(i)}
            >
              <div className="flex flex-1 items-end">
                <span
                  className="churn-bar is-add w-full"
                  style={{ height: `${(s.additions / max) * 100}%`, animationDelay: `${Math.min(i, 40) * 12}ms` }}
                />
              </div>
              <span className="churn-axis" />
              <div className="flex flex-1 items-start">
                <span
                  className="churn-bar is-del w-full"
                  style={{ height: `${(s.deletions / max) * 100}%`, animationDelay: `${Math.min(i, 40) * 12}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-tertiary-text" aria-hidden>
          <span>{bins[0]?.label}</span>
          {bins.length > 2 && <span>{bins[Math.floor(bins.length / 2)]?.label}</span>}
          <span>{bins[bins.length - 1]?.label}</span>
        </div>
        {active !== null && bins[active] && wrapRef.current && (
          <HoverTip x={((active + 0.5) / n) * wrapRef.current.clientWidth} y={8}>
            <p className="font-medium text-primary-text">{bins[active].title}</p>
            <p className="tabular-nums">
              <span className="text-diff-add-ink">+{fmt.number(series[active].additions)}</span>{' '}
              <span className="text-danger-red">−{fmt.number(series[active].deletions)}</span>
            </p>
          </HoverTip>
        )}
      </div>
    </div>
  )
}

/* ── Hotspots ──────────────────────────────────────────────────────────── */

export function Hotspots({ items }: { items: FileHotspot[] }): JSX.Element {
  const t = useT().dashboard
  const fmt = useFormatters()
  if (items.length === 0) return <p className="text-caption text-tertiary-text">{t.noHotspots}</p>
  const max = Math.max(1, ...items.map((item) => item.commits))
  return (
    <ol className="flex flex-col gap-3">
      {items.slice(0, 8).map((item, i) => {
        const slash = item.path.lastIndexOf('/')
        const name = slash < 0 ? item.path : item.path.slice(slash + 1)
        const dir = slash < 0 ? '' : item.path.slice(0, slash)
        return (
          <li key={item.path} className="flex min-w-0 flex-col gap-1.5" title={item.path}>
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="max-w-full shrink-0 truncate text-body text-primary-text">{name}</span>
              <span className="min-w-0 flex-1 truncate text-caption text-tertiary-text">{dir}</span>
              <span className="shrink-0 text-caption tabular-nums">
                <span className="text-diff-add-ink">+{fmt.number(item.additions)}</span>{' '}
                <span className="text-danger-red">−{fmt.number(item.deletions)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-hover-overlay">
                <div
                  className="hotspot-bar h-full origin-left rounded-full animate-[viz-grow-x_900ms_cubic-bezier(0.16,1,0.3,1)_both]"
                  style={{ width: `${(item.commits / max) * 100}%`, animationDelay: `${i * 60}ms`, opacity: 1 - i * 0.07 }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-caption text-secondary-text">{t.inCommits(item.commits)}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ── Contribution calendar ─────────────────────────────────────────────── */

const CAL_ROWS = [1, 2, 3, 4, 5, 6, 0]
const CAL_WEEKS = 53

export function ContributionCalendar({ commits, now }: { commits: CommitSummary[]; now: number }): JSX.Element {
  const t = useT().dashboard
  const fmt = useFormatters()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ ts: number; count: number; x: number; y: number } | null>(null)

  const { weeks, max, monthMarks } = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of commits) {
      const time = Date.parse(c.date)
      if (Number.isFinite(time)) counts.set(dayKey(time), (counts.get(dayKey(time)) ?? 0) + 1)
    }
    // The last column is this week; columns start on Monday like the heatmap.
    const today = startOfDay(now)
    const mondayOffset = (new Date(today).getDay() + 6) % 7
    const firstMonday = addDays(today, -mondayOffset - (CAL_WEEKS - 1) * 7)
    const weeks: { ts: number; count: number; future: boolean }[][] = []
    const monthMarks: { week: number; month: number }[] = []
    let lastMonth = -1
    let max = 0
    for (let w = 0; w < CAL_WEEKS; w++) {
      const column: { ts: number; count: number; future: boolean }[] = []
      for (let d = 0; d < 7; d++) {
        const ts = addDays(firstMonday, w * 7 + d)
        const count = counts.get(dayKey(ts)) ?? 0
        max = Math.max(max, count)
        column.push({ ts, count, future: ts > today })
      }
      const month = new Date(column[0].ts).getMonth()
      if (month !== lastMonth) {
        if (w > 0 || new Date(column[0].ts).getDate() <= 7) monthMarks.push({ week: w, month })
        lastMonth = month
      }
      weeks.push(column)
    }
    return { weeks, max, monthMarks }
  }, [commits, now])

  const level = (count: number): number => (count === 0 || max === 0 ? 0 : Math.min(5, Math.max(1, Math.ceil((count / max) * 5))))
  const fill = (lvl: number): string => (lvl === 0 ? 'var(--color-coal-raised)' : `var(--viz-seq-${lvl})`)

  return (
    <div ref={wrapRef} className="relative" onPointerLeave={() => setHover(null)}>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `22px repeat(${CAL_WEEKS}, minmax(0, 1fr))` }}>
        <span />
        {weeks.map((_, w) => {
          const mark = monthMarks.find((m) => m.week === w)
          return (
            <span key={w} className="h-4 overflow-visible whitespace-nowrap text-[10px] text-tertiary-text">
              {mark ? t.months[mark.month] : ''}
            </span>
          )
        })}
        {CAL_ROWS.map((weekday, row) => (
          <div key={weekday} className="contents">
            <span className="flex items-center text-[10px] text-tertiary-text">{row % 2 === 0 ? t.weekdays[weekday] : ''}</span>
            {weeks.map((column, w) => {
              const cell = column[row]
              if (cell.future) return <span key={w} className="aspect-square" />
              return (
                <span
                  key={w}
                  className="aspect-square rounded-[2px] transition-transform duration-150 hover:scale-125"
                  style={{ backgroundColor: fill(level(cell.count)) }}
                  onPointerEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const box = wrapRef.current?.getBoundingClientRect()
                    if (!box) return
                    setHover({ ts: cell.ts, count: cell.count, x: rect.left - box.left + rect.width / 2, y: rect.top - box.top })
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-tertiary-text" aria-hidden>
        {t.less}
        {[0, 1, 2, 3, 4, 5].map((lvl) => (
          <span key={lvl} className="size-2.5 rounded-[2px]" style={{ backgroundColor: fill(lvl) }} />
        ))}
        {t.more}
      </div>
      {hover && (
        <HoverTip x={hover.x} y={hover.y}>
          <p className="font-semibold tabular-nums text-primary-text">
            {fmt.number(hover.count)} {t.commitCount(hover.count)}
          </p>
          <p className="text-tertiary-text">
            {t.weekdaysLong[new Date(hover.ts).getDay()]}, {t.day(new Date(hover.ts).getDate(), t.months[new Date(hover.ts).getMonth()])}
          </p>
        </HoverTip>
      )}
    </div>
  )
}

/* ── Branches ──────────────────────────────────────────────────────────── */

const STALE_AFTER_DAYS = 30

export function BranchList({ branches, now }: { branches: BranchOverview[]; now: number }): JSX.Element {
  const t = useT().dashboard
  const locale = useLocale()
  return (
    <ul className="flex flex-col">
      {branches.slice(0, 8).map((branch) => {
        const stale = !branch.isCurrent && now - Date.parse(branch.date) > STALE_AFTER_DAYS * DAY
        return (
          <li key={branch.name} className={`branch-row flex min-w-0 items-center gap-3 py-2.5 ${stale ? 'is-stale' : ''}`}>
            <span className={`branch-row-icon ${branch.isCurrent ? 'is-current' : ''}`} aria-hidden>
              <GitBranch size={14} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-[13px] text-primary-text" title={branch.name}>
                  {branch.name}
                </span>
                {branch.isCurrent && <span className="insight-chip is-blue">{t.current}</span>}
                {stale && <span className="insight-chip">{t.stale}</span>}
              </span>
              <span className="mt-0.5 truncate text-caption text-tertiary-text" title={branch.subject}>
                {branch.subject} · {relativeTime(locale, branch.date, now)}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {branch.gone ? (
                <span className="insight-chip is-red">
                  <CloudOff size={11} aria-hidden /> {t.upstreamGone}
                </span>
              ) : !branch.upstream ? (
                <span className="insight-chip">
                  <Laptop size={11} aria-hidden /> {t.localOnly}
                </span>
              ) : branch.ahead === 0 && branch.behind === 0 ? (
                <span className="insight-chip is-green">
                  <Check size={11} aria-hidden /> {t.inSync}
                </span>
              ) : (
                <>
                  {branch.ahead > 0 && (
                    <span className="insight-chip is-blue tabular-nums" aria-label={t.aheadAria(branch.ahead)}>
                      <ArrowUp size={11} aria-hidden /> {branch.ahead}
                    </span>
                  )}
                  {branch.behind > 0 && (
                    <span className="insight-chip is-orange tabular-nums" aria-label={t.behindAria(branch.behind)}>
                      <ArrowDown size={11} aria-hidden /> {branch.behind}
                    </span>
                  )}
                </>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Recent commits ────────────────────────────────────────────────────── */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function RecentCommits({ commits, now, onOpen }: { commits: CommitSummary[]; now: number; onOpen: (hash: string) => void }): JSX.Element {
  const locale = useLocale()
  const authors = useMemo(() => {
    const order = new Map<string, number>()
    for (const c of commits) {
      const key = (c.authorEmail || c.authorName).toLowerCase()
      if (!order.has(key)) order.set(key, order.size)
    }
    return order
  }, [commits])
  return (
    <ol className="relative flex flex-col">
      <span className="recent-spine" aria-hidden />
      {commits.slice(0, 7).map((c) => {
        const slot = (authors.get((c.authorEmail || c.authorName).toLowerCase()) ?? 0) % 8
        return (
          <li key={c.hash}>
            <button type="button" onClick={() => onOpen(c.hash)} className="recent-row flex w-full min-w-0 items-center gap-3 rounded-sm py-2 pr-2 text-left">
              <span
                className="relative z-[1] grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
                style={{ backgroundColor: `var(--viz-${slot + 1})`, color: `var(--viz-${slot + 1}-ink)` }}
                aria-hidden
              >
                {initials(c.authorName)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-body text-primary-text" title={c.summary}>
                  {c.summary}
                </span>
                <span className="mt-0.5 truncate text-caption text-tertiary-text">
                  {c.authorName} · {relativeTime(locale, c.date, now)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-tertiary-text">
                <GitCommitHorizontal size={12} aria-hidden />
                {c.shortHash}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
