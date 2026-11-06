import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Avatar } from '../views/PullRequestsView'
import { useLocale, useT } from '../lib/i18n'
import { relativeTime } from '../lib/relativeTime'
import { layoutSky, skyDust, type SkyPoint } from '../lib/activitySky'
import type { TimelineItem } from '../lib/messageTimeline'
import { isNewStar } from '../store/inboxStore'

const HEIGHT = 340
const DUST = skyDust(90)
const TWINKLING = DUST.filter((_, index) => index % 11 === 0)
const DAY = 24 * 60 * 60 * 1000
const STAR_SHAPE = 'M0 -10 Q1.1 -1.1 10 0 Q1.1 1.1 0 10 Q-1.1 1.1 -10 0 Q-1.1 -1.1 0 -10Z'

interface ActivitySkyProps {
  items: TimelineItem[]
  needsYou: (reason: string) => boolean
  newStarsSince: number
  activeKey: string | null
  onActivate: (key: string | null) => void
  /** The page's title and refresh control, which sit over the sky. */
  children: ReactNode
}

function pointClass(point: SkyPoint, newStarsSince: number, needsYou: (reason: string) => boolean): string {
  if (point.item.type === 'star') return isNewStar(point.item.star, newStarsSince) ? 'sky-star is-new' : 'sky-star'
  return needsYou(point.item.notification.reason) ? 'sky-event is-attention' : 'sky-event'
}

/**
 * The account's last 30 days as a night sky: repositories as lanes, stars as
 * stars, and a single line through all of it reaching the present. It duplicates
 * the list below on purpose, as a picture, so it is hidden from screen readers
 * and every point can be reached there instead.
 */
function ActivitySky({ items, needsYou, newStarsSince, activeKey, onActivate, children }: ActivitySkyProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const t = useT().inbox
  const locale = useLocale()

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const sky = useMemo(() => layoutSky(items, width, HEIGHT), [items, width])
  const active = sky.points.find((point) => point.key === activeKey)
  const now = Date.now()

  return (
    <div ref={ref} className="sky" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg className="sky-canvas" width={width} height={HEIGHT} aria-hidden>
          <defs>
            <linearGradient id="sky-line" gradientUnits="userSpaceOnUse" x1={sky.left} x2={sky.head.x} y1="0" y2="0">
              <stop offset="0" className="sky-line-start" />
              <stop offset="0.65" className="sky-line-middle" />
              <stop offset="1" className="sky-line-end" />
            </linearGradient>
          </defs>

          <g className="sky-dust">
            {DUST.map((dot, index) => (
              <circle key={index} cx={dot.x * width} cy={dot.y * HEIGHT} r={dot.r} opacity={dot.o} />
            ))}
          </g>

          {sky.points.length > 0 && (
            <>
              {sky.ticks.map(({ x, days }) => (
                <g key={days} className="sky-tick">
                  <line x1={x} x2={x} y1={HEIGHT - 92} y2={HEIGHT - 82} />
                  <text x={x} y={HEIGHT - 66} textAnchor="middle">
                    {relativeTime(locale, new Date(now - days * DAY).toISOString(), now)}
                  </text>
                </g>
              ))}
              {sky.lanes.map(({ repo, y }) => (
                <g key={repo} className="sky-lane">
                  <line x1={sky.left - 8} x2={width} y1={y} y2={y} />
                  <text x={sky.left - 18} y={y + 4} textAnchor="end">
                    {repo.split('/').pop()}
                  </text>
                </g>
              ))}
              <path className="sky-path" pathLength={1} d={sky.path} stroke="url(#sky-line)" />
              {sky.points.map((point, index) => (
                <g
                  key={point.key}
                  transform={`translate(${point.x} ${point.y})`}
                  className={`sky-point ${pointClass(point, newStarsSince, needsYou)} ${point.key === activeKey ? 'is-active' : ''}`}
                  onMouseEnter={() => onActivate(point.key)}
                  onMouseLeave={() => onActivate(null)}
                >
                  {/* Larger than the mark, so a small point is still easy to land on. */}
                  <circle className="sky-hit" r="16" />
                  <g className="sky-mark" style={{ animationDelay: `${500 + index * 60}ms` }}>
                    <circle className="sky-halo" r="15" />
                    {point.item.type === 'star' ? <path d={STAR_SHAPE} /> : <circle className="sky-dot" r="5" />}
                  </g>
                </g>
              ))}
              <g className="sky-head" transform={`translate(${sky.head.x} ${sky.head.y})`}>
                <circle className="sky-head-core" r="4" />
                <text y="-16" textAnchor="middle">
                  {t.skyNow}
                </text>
              </g>
            </>
          )}
        </svg>
      )}

      {/* Everything that keeps moving lives out here as its own layer: animating
          inside the SVG would repaint all of it, filters included, on every frame. */}
      {width > 0 && (
        <div className="sky-lights" aria-hidden>
          {TWINKLING.map((dot, index) => (
            <span key={index} className="sky-twinkle" style={{ left: dot.x * width, top: dot.y * HEIGHT, animationDelay: `${index * 0.8}s` }} />
          ))}
          {sky.points.map(
            (point, index) =>
              point.item.type === 'star' &&
              isNewStar(point.item.star, newStarsSince) && <span key={point.key} className="sky-glint" style={{ left: point.x, top: point.y, animationDelay: `${index * 0.35}s` }} />
          )}
          {sky.points.length > 0 && <span className="sky-head-pulse" style={{ left: sky.head.x, top: sky.head.y }} />}
        </div>
      )}

      {active && (
        <div className={`sky-tip ${active.x > width - 260 ? 'is-flipped' : ''}`} style={{ left: active.x, top: active.y }}>
          {active.item.type === 'star' ? (
            <>
              <Avatar login={active.item.star.login} src={active.item.star.avatarUrl} size={24} />
              <span className="min-w-0">
                <strong>{active.item.star.login}</strong> {t.starredVerb}
                <small>
                  {active.item.star.repoFullName} · {relativeTime(locale, active.item.star.starredAt, now)}
                </small>
              </span>
            </>
          ) : (
            <span className="min-w-0">
              <strong>{active.item.notification.title}</strong>
              <small>
                {active.item.notification.repoFullName} · {relativeTime(locale, active.item.notification.updatedAt, now)}
              </small>
            </span>
          )}
        </div>
      )}

      <div className="sky-header">{children}</div>
    </div>
  )
}

export default ActivitySky
