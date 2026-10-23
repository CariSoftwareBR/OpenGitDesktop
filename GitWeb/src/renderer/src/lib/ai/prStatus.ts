import type { PullRequestStatus } from '../../../../shared/github'
import type { Messages } from '../../../../shared/i18n'

const PASSED_CONCLUSIONS = new Set(['success', 'neutral', 'skipped'])

// Leads with GitHub's own verdict (mergeable_state), then the evidence behind
// it, so the model can say both "not yet" and exactly what is still missing.
// Kept free of stores so it can be tested with plain data.
export function formatPullRequestStatus(status: PullRequestStatus, t: Messages['tools']): string {
  const { pr, checks, reviews, requiredChecks, requiredApprovals } = status
  const state = pr.merged ? 'merged' : pr.draft ? 'draft' : pr.state
  const lines = [
    `PR #${pr.number} [${state}] ${pr.title}`,
    `Head -> Base: ${pr.headRef} -> ${pr.baseRef} (commit ${pr.headSha.slice(0, 7)})`,
    `mergeable: ${pr.mergeable ?? 'null'} · mergeable_state: ${pr.mergeableState ?? 'null'}`,
    t.mergeStateMeaning(pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : (pr.mergeableState ?? 'unknown'))
  ]

  const required = new Set(requiredChecks ?? [])
  const passed = checks.filter((c) => c.status === 'completed' && PASSED_CONCLUSIONS.has(c.conclusion ?? ''))
  const running = checks.filter((c) => c.status !== 'completed')
  const failed = checks.filter((c) => c.status === 'completed' && !PASSED_CONCLUSIONS.has(c.conclusion ?? ''))
  lines.push('', t.checksSummary(checks.length, passed.length, running.length, failed.length))
  if (status.checksError) lines.push(t.checksUnreadable(status.checksError))
  for (const c of [...failed, ...running, ...passed]) {
    const mark = running.includes(c) ? '…' : passed.includes(c) ? '✓' : '✗'
    const tag = required.has(c.name) ? ` [${t.requiredTag}]` : ''
    lines.push(`- ${mark} ${c.name}: ${c.conclusion ?? c.status}${tag}`)
  }
  if (requiredChecks === null) {
    lines.push(t.requiredChecksUnknown)
  } else {
    const reported = new Set(checks.map((c) => c.name))
    const missing = requiredChecks.filter((name) => !reported.has(name))
    if (missing.length > 0) lines.push(t.requiredChecksMissing(missing.join(', ')))
  }

  lines.push('')
  if (status.reviewsError) {
    lines.push(t.reviewsUnreadable(status.reviewsError))
  } else {
    const approvals = reviews.filter((r) => r.state === 'APPROVED').length
    lines.push(t.reviewsSummary(approvals, requiredApprovals))
  }
  // Readable even when the count above is not, so it is the line to trust
  // when the two seem to disagree.
  if (status.reviewDecision) lines.push(t.reviewDecisionLine(status.reviewDecision))
  if (!status.reviewsError) for (const r of reviews) lines.push(`- ${r.authorLogin}: ${r.state}`)
  return lines.join('\n')
}
