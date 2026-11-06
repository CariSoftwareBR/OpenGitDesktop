import type { GitHubNotification, RepositoryStar } from '../../../shared/github'

export type TimelineItem =
  | { type: 'notification'; at: string; key: string; notification: GitHubNotification }
  | { type: 'star'; at: string; key: string; star: RepositoryStar }

export type TimelineBucket = 'today' | 'yesterday' | 'week' | 'earlier'

export interface TimelineGroup {
  bucket: TimelineBucket
  items: TimelineItem[]
}

const BUCKETS: TimelineBucket[] = ['today', 'yesterday', 'week', 'earlier']

function bucketOf(iso: string, now: Date): TimelineBucket {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const time = Date.parse(iso)
  const day = 24 * 60 * 60 * 1000
  if (time >= midnight) return 'today'
  if (time >= midnight - day) return 'yesterday'
  if (time >= midnight - 6 * day) return 'week'
  return 'earlier'
}

/** Everything that happened, newest first, under the day it happened on the person's own clock. */
export function buildTimeline(notifications: GitHubNotification[], stars: RepositoryStar[], now = new Date()): TimelineGroup[] {
  const items: TimelineItem[] = [
    ...notifications.map((notification) => ({
      type: 'notification' as const,
      at: notification.updatedAt,
      key: `notification:${notification.id}`,
      notification
    })),
    ...stars.map((star) => ({ type: 'star' as const, at: star.starredAt, key: `star:${star.repoFullName}:${star.login}`, star }))
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  return BUCKETS.map((bucket) => ({ bucket, items: items.filter((item) => bucketOf(item.at, now) === bucket) })).filter(
    (group) => group.items.length > 0
  )
}
