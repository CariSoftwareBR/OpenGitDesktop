import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMessages } from '../src/shared/i18n'
import type { PullRequestStatus } from '../src/shared/github'

vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => 'token'), saveSecret: vi.fn(), deleteSecret: vi.fn() }))
vi.mock('../src/main/httpFetch', () => ({ httpFetch: vi.fn() }))

const { httpFetch } = await import('../src/main/httpFetch')
const { getBranchRules, getPullRequestStatus } = await import('../src/main/githubApi')
const { formatPullRequestStatus } = await import('../src/renderer/src/lib/ai/prStatus')

const PR = {
  number: 84,
  title: 'Add feed parser',
  body: null,
  state: 'open',
  draft: false,
  merged_at: null,
  head: { ref: 'feature', sha: 'abc1234def' },
  base: { ref: 'main' },
  mergeable: false,
  mergeable_state: 'blocked',
  user: { login: 'author' },
  html_url: 'https://github.com/o/r/pull/84',
  created_at: '2026-10-23T10:00:00Z'
}

type Route = { status: number; body: unknown }

// Answers each GitHub endpoint the status read touches; anything unrouted is a 404.
function serve(routes: Record<string, Route>): void {
  vi.mocked(httpFetch).mockImplementation(async (url: string) => {
    const path = new URL(url).pathname.replace(/^\/repos\/o\/r/, '')
    const route = routes[path] ?? { status: 404, body: { message: 'Not Found' } }
    return new Response(JSON.stringify(route.body), { status: route.status, headers: { 'content-type': 'application/json' } })
  })
}

const ok = (body: unknown): Route => ({ status: 200, body })
const denied: Route = { status: 403, body: { message: 'Resource not accessible by integration' } }

beforeEach(() => {
  vi.mocked(httpFetch).mockReset()
})

describe('getPullRequestStatus', () => {
  it('keeps only the newest run per check name and merges every source of requirements', async () => {
    serve({
      '/pulls/84': ok(PR),
      '/commits/abc1234def/check-runs': ok({
        total_count: 3,
        check_runs: [
          { name: 'quality', status: 'completed', conclusion: 'failure', html_url: null, started_at: '2026-10-23T10:00:00Z' },
          { name: 'quality', status: 'in_progress', conclusion: null, html_url: null, started_at: '2026-10-23T10:05:00Z' },
          { name: 'lint', status: 'completed', conclusion: 'success', html_url: null, started_at: '2026-10-23T10:01:00Z' }
        ]
      }),
      '/commits/abc1234def/status': ok({ statuses: [{ context: 'ci/external', state: 'pending', target_url: null }] }),
      '/pulls/84/reviews': ok([
        { user: { login: 'alice' }, state: 'APPROVED' },
        { user: { login: 'alice' }, state: 'COMMENTED' },
        { user: { login: 'bob' }, state: 'CHANGES_REQUESTED' }
      ]),
      '/rules/branches/main': ok([{ type: 'pull_request', parameters: { required_approving_review_count: 1 } }]),
      '/branches/main': ok({ protection: { required_status_checks: { contexts: ['quality', 'deploy-preview'] } } }),
      '/branches/main/protection': ok({ required_pull_request_reviews: { required_approving_review_count: 2 } }),
      '/graphql': ok({ data: { repository: { pullRequest: { reviewDecision: 'CHANGES_REQUESTED' } } } })
    })

    const status = await getPullRequestStatus('github.com', 'o', 'r', 84)

    expect(status.checks.filter((c) => c.name === 'quality')).toEqual([
      { name: 'quality', status: 'in_progress', conclusion: null, url: null }
    ])
    expect(status.checks.find((c) => c.name === 'ci/external')).toMatchObject({ status: 'in_progress', conclusion: null })
    expect(status.checksError).toBeNull()
    expect(status.reviews).toEqual([
      { authorLogin: 'alice', state: 'APPROVED' },
      { authorLogin: 'bob', state: 'CHANGES_REQUESTED' }
    ])
    expect(status.requiredChecks).toEqual(['quality', 'deploy-preview'])
    expect(status.requiredApprovals).toBe(2)
    expect(status.reviewDecision).toBe('CHANGES_REQUESTED')
  })

  it('reports each refused read on its own instead of failing or guessing', async () => {
    serve({
      '/pulls/84': ok(PR),
      '/commits/abc1234def/check-runs': denied,
      '/commits/abc1234def/status': ok({ statuses: [] }),
      '/pulls/84/reviews': denied,
      '/graphql': ok({ data: { repository: { pullRequest: { reviewDecision: null } } } })
    })

    const status = await getPullRequestStatus('github.com', 'o', 'r', 84)

    expect(status.checksError).toContain('Resource not accessible')
    expect(status.reviewsError).toContain('Resource not accessible')
    expect(status.requiredChecks).toBeNull()
    expect(status.requiredApprovals).toBeNull()
    // null from GraphQL means no review rule applies — not "unknown".
    expect(status.reviewDecision).toBe('NOT_REQUIRED')
  })

  it('leaves the review decision unknown when GraphQL answers with errors', async () => {
    serve({
      '/pulls/84': ok(PR),
      '/graphql': ok({ errors: [{ message: 'Resource not accessible' }] })
    })

    expect((await getPullRequestStatus('github.com', 'o', 'r', 84)).reviewDecision).toBeNull()
  })
})

describe('getBranchRules', () => {
  it('sees a ruleset that demands a pull request', async () => {
    serve({ '/rules/branches/main': ok([{ type: 'pull_request', parameters: { required_approving_review_count: 1 } }]) })
    expect(await getBranchRules('github.com', 'o', 'r', 'main')).toEqual({
      requiresPullRequest: true,
      requiredChecks: [],
      requiredApprovals: 1
    })
  })

  it('reads required checks from classic protection without admin access', async () => {
    serve({
      '/rules/branches/main': ok([]),
      '/branches/main': ok({ protection: { required_status_checks: { contexts: [], checks: [{ context: 'quality' }] } } }),
      '/branches/main/protection': denied
    })
    expect(await getBranchRules('github.com', 'o', 'r', 'main')).toEqual({
      requiresPullRequest: false,
      requiredChecks: ['quality'],
      requiredApprovals: null
    })
  })

  it('takes the classic pull-request rule when the admin-only read is allowed', async () => {
    serve({
      '/branches/release/1.0/protection': ok({ required_pull_request_reviews: { required_approving_review_count: 0 } })
    })
    const rules = await getBranchRules('github.com', 'o', 'r', 'release/1.0')
    expect(rules.requiresPullRequest).toBe(true)
    expect(rules.requiredChecks).toBeNull()
  })
})

describe('formatPullRequestStatus', () => {
  const t = getMessages('pt-BR').tools
  const base: PullRequestStatus = {
    pr: {
      number: 84,
      title: 'Add feed parser',
      body: null,
      state: 'open',
      draft: false,
      merged: false,
      headRef: 'feature',
      headSha: 'abc1234def',
      baseRef: 'main',
      mergeable: false,
      mergeableState: 'blocked',
      authorLogin: 'author',
      htmlUrl: '',
      createdAt: ''
    },
    checks: [
      { name: 'lint', status: 'completed', conclusion: 'success', url: null },
      { name: 'quality', status: 'in_progress', conclusion: null, url: null }
    ],
    checksError: null,
    reviews: [{ authorLogin: 'alice', state: 'APPROVED' }],
    reviewsError: null,
    reviewDecision: 'REVIEW_REQUIRED',
    requiredChecks: ['quality', 'deploy-preview'],
    requiredApprovals: 2
  }

  it('says what is still missing: running required checks, unreported ones and approvals', () => {
    const text = formatPullRequestStatus(base, t)
    expect(text).toContain('mergeable_state: blocked')
    expect(text).toContain('- … quality: in_progress [obrigatório]')
    expect(text).toContain('- ✓ lint: success')
    expect(text).toContain(t.requiredChecksMissing('deploy-preview'))
    expect(text).toContain(t.reviewsSummary(1, 2))
    expect(text).toContain(t.reviewDecisionLine('REVIEW_REQUIRED'))
  })

  it('never turns unreadable reviews into "0 approvals"', () => {
    const text = formatPullRequestStatus({ ...base, reviews: [], reviewsError: 'denied' }, t)
    expect(text).toContain(t.reviewsUnreadable('denied'))
    expect(text).not.toContain(t.reviewsSummary(0, 2))
    expect(text).toContain(t.reviewDecisionLine('REVIEW_REQUIRED'))
  })
})
