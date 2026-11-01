import type { Locale } from '../../../shared/i18n'

const cache = new Map<Locale, Intl.RelativeTimeFormat>()

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60]
]

/** "há 3 horas" / "3 hours ago" — compact, for dense lists. */
export function relativeTime(locale: Locale, iso: string, now = Date.now()): string {
  let rtf = cache.get(locale)
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
    cache.set(locale, rtf)
  }
  const seconds = (Date.parse(iso) - now) / 1000
  if (!Number.isFinite(seconds)) return iso
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(0, 'minute')
}

/** 0 for the newest commit of a set, 1 for the oldest — drives blame's age tint. */
export function ageRatio(iso: string, newest: number, oldest: number): number {
  if (newest <= oldest) return 0
  const t = Date.parse(iso)
  return Math.min(1, Math.max(0, (newest - t) / (newest - oldest)))
}
