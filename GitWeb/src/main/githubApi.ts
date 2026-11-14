import { apiBaseForHost, credentialKey, graphqlUrlForHost, nextPageUrl } from '../shared/githubRemote'
import { getSecret, saveSecret, deleteSecret } from './credentials'
import { httpFetch } from './httpFetch'
import { tMain } from './i18n'
import type {
  AddCollaboratorResult,
  BranchRules,
  CreatePullRequestInput,
  GitHubRepoSummary,
  GitHubNotification,
  GitHubUser,
  GitHubUserSuggestion,
  MergeMethod,
  PullRequest,
  PullRequestCheck,
  PullRequestComment,
  PullRequestFile,
  PullRequestReviewSummary,
  PullRequestState,
  PullRequestStatus,
  ReceivedInvitation,
  RepositoryCollaborators,
  RepositoryInvitation,
  RepositoryOwner,
  RepositoryRole,
  RepositoryStar,
  ReviewDecision
} from '../shared/github'

// Every GitHub REST call runs here, in main, so the access token never crosses
// the IPC boundary. The renderer names a host (plus owner/repo) and gets back
// mapped objects; the token is resolved from the OS secret store per call and
// stays in this process. This mirrors what aiProxy.ts already does for AI
// providers.

// Carries the HTTP status so callers can tell "this token is dead" (401) apart
// from "GitHub or the network is having a bad day" (5xx, rate limit, offline).
// Only the first justifies throwing the stored credential away.
class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'GitHubApiError'
  }
}

async function requireToken(host: string): Promise<string> {
  const token = await getSecret(credentialKey(host))
  if (!token) {
    throw new Error(tMain().github.notAuthenticated(host))
  }
  return token
}

async function request<T>(host: string, path: string, token: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  return (await send<T>(`${apiBaseForHost(host)}${path}`, token, init, timeoutMs)).data
}

async function send<T>(
  url: string,
  token: string,
  init?: RequestInit,
  timeoutMs?: number
): Promise<{ data: T; next: string | null }> {
  const response = await httpFetch(url, {
    // GitHub answers GETs with "Cache-Control: private, max-age=60" and
    // Chromium's net.fetch honours it, so without this a list re-read right
    // after a write (new comment, created PR) or the mergeable retry came back
    // from cache, up to a minute stale. "no-cache" still revalidates with the
    // ETag, so an unchanged resource costs a 304, not a full response.
    cache: 'no-cache',
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      // Honoured by Chromium's cache layer itself, whatever net.fetch does
      // with the `cache` option above.
      'Cache-Control': 'no-cache',
      ...init?.headers
    }
  }, timeoutMs ? { timeoutMs } : undefined)

  if (!response.ok) {
    let message = tMain().github.requestRejected(response.status)
    try {
      // `errors` comes as objects ({ message }) from most endpoints but as bare
      // strings from others (reviews: "Review Can not request changes on your
      // own pull request") — reading only `.message` turned those into the
      // generic "(422)" with the actual reason thrown away.
      const body = (await response.json()) as { message?: string; errors?: (string | { message?: string })[] }
      const parts = [body.message, ...(body.errors ?? []).map((e) => (typeof e === 'string' ? e : e?.message))].filter(
        Boolean
      )
      if (parts.length > 0 && !(parts.length === 1 && parts[0] === 'Unprocessable Entity')) {
        message = parts.join(' — ')
      }
    } catch {
      // ignore body parse failure, keep generic message
    }
    throw new GitHubApiError(message, response.status)
  }

  const next = nextPageUrl(response.headers.get('link'))
  if (response.status === 204 || response.status === 205) return { data: undefined as T, next }
  return { data: (await response.json()) as T, next }
}

/**
 * GraphQL answers 200 even on failure, with the reasons in `errors`.
 * `partial` keeps a payload that arrived next to those errors. Stars need it:
 * one repository the token cannot see comes back as a null node plus an error,
 * and throwing there used to drop every star and fail the whole inbox refresh.
 * Callers that require a complete answer leave it off.
 */
async function graphql<T>(
  host: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
  partial = false
): Promise<T> {
  const { data } = await send<{ data?: T; errors?: { message: string }[] }>(graphqlUrlForHost(host), token, {
    method: 'POST',
    body: JSON.stringify({ query, variables })
  })
  if (!data.data || (data.errors?.length && !partial)) {
    throw new GitHubApiError(data.errors?.map((e) => e.message).join(' — ') || tMain().github.requestRejected(200), 200)
  }
  return data.data
}

/**
 * Follows the `Link: rel="next"` chain. A single page stops at per_page=100, so
 * anyone with more repositories (or a PR touching more files) silently lost the
 * rest. maxPages is only a guard against a runaway loop — GitHub itself caps a
 * PR's file list at 3000 entries.
 */
async function requestAll<T>(host: string, path: string, token: string, maxPages = 50): Promise<T[]> {
  const items: T[] = []
  const base = apiBaseForHost(host)
  let url: string | null = `${base}${path}`
  for (let page = 0; url && page < maxPages; page++) {
    const { data, next }: { data: T[]; next: string | null } = await send<T[]>(url, token)
    items.push(...data)
    // The token rides along on every page, so only follow links that stay on
    // the API host we were asked to talk to.
    url = next && new URL(next).origin === new URL(base).origin ? next : null
  }
  return items
}

// --- shapes as GitHub returns them, mapped to shared/github.ts below ---

interface ApiUser {
  login: string
  name: string | null
  avatar_url: string
}

interface ApiRepo {
  full_name: string
  html_url?: string
  default_branch?: string
  name: string
  owner: { login: string }
  clone_url: string
  private: boolean
  description?: string | null
  language?: string | null
  pushed_at?: string | null
  updated_at?: string | null
  fork?: boolean
  archived?: boolean
}

interface ApiPullRequest {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  draft: boolean
  merged_at: string | null
  head: { ref: string; sha: string; repo?: { owner?: { login: string } } | null }
  base: { ref: string }
  mergeable?: boolean | null
  mergeable_state?: string | null
  user: { login: string }
  html_url: string
  created_at: string
}

function toUser(user: ApiUser): GitHubUser {
  return { login: user.login, name: user.name, avatarUrl: user.avatar_url }
}

function toRepo(repo: ApiRepo): GitHubRepoSummary {
  return {
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner.login,
    cloneUrl: repo.clone_url,
    private: repo.private,
    description: repo.description ?? null,
    language: repo.language ?? null,
    updatedAt: repo.pushed_at ?? repo.updated_at ?? null,
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived)
  }
}

function toPullRequest(pr: ApiPullRequest): PullRequest {
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    draft: pr.draft,
    merged: Boolean(pr.merged_at),
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    headOwner: pr.head.repo?.owner?.login ?? null,
    baseRef: pr.base.ref,
    mergeable: pr.mergeable ?? null,
    mergeableState: pr.mergeable_state ?? null,
    authorLogin: pr.user.login,
    htmlUrl: pr.html_url,
    createdAt: pr.created_at
  }
}

// --- session ---

/** Validates a token against /user without persisting it. */
export async function fetchUser(host: string, token: string): Promise<GitHubUser> {
  return toUser(await request<ApiUser>(host, '/user', token))
}

/** Persists a token only after it proves valid, so a typo never gets stored. */
export async function saveToken(host: string, token: string): Promise<GitHubUser> {
  const trimmed = token.trim()
  if (!trimmed) throw new Error(tMain().github.tokenRequired)
  const user = await fetchUser(host, trimmed)
  await saveSecret(credentialKey(host), trimmed)
  return user
}

/**
 * Null when there is no stored token or it no longer works — not an error.
 *
 * A 401 means the user revoked the grant (or the token was deleted), so the
 * stored credential is dead and gets removed here. That matters beyond tidiness:
 * buildAuthEnv() in gitProcess.ts injects the stored token *and* disables the
 * system credential helper for that invocation, so leaving a dead token behind
 * makes push/fetch fail with 401 instead of falling back to Git Credential
 * Manager. Anything other than a 401 — offline, 5xx, rate limit — is not proof
 * the token is bad, and must never cost a working user their credential.
 */
export async function getSession(host: string): Promise<GitHubUser | null> {
  const token = await getSecret(credentialKey(host))
  if (!token) return null
  try {
    return await fetchUser(host, token)
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 401) {
      await deleteSecret(credentialKey(host))
    }
    return null
  }
}

export async function logout(host: string): Promise<void> {
  await deleteSecret(credentialKey(host))
}

// --- repositories ---

export async function listUserRepos(host: string): Promise<GitHubRepoSummary[]> {
  const token = await requireToken(host)
  return listUserReposWithToken(host, token)
}

/**
 * The "Personal Token" tab lists repositories for a token the user just typed,
 * for an account that is deliberately not the signed-in one, so this variant
 * takes the token instead of reading the store — and never persists it.
 */
export async function listUserReposWithToken(host: string, token: string): Promise<GitHubRepoSummary[]> {
  const repos = await requestAll<ApiRepo>(host, '/user/repos?per_page=100&sort=updated', token.trim())
  return repos.map(toRepo)
}

// --- pull requests ---

export async function listPullRequests(
  host: string,
  owner: string,
  repo: string,
  state: PullRequestState = 'open'
): Promise<PullRequest[]> {
  const token = await requireToken(host)
  const prs = await request<ApiPullRequest[]>(
    host,
    `/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`,
    token
  )
  return prs.map(toPullRequest)
}

export async function getPullRequest(
  host: string,
  owner: string,
  repo: string,
  number: number
): Promise<PullRequest> {
  const token = await requireToken(host)
  const path = `/repos/${owner}/${repo}/pulls/${number}`
  const pr = await request<ApiPullRequest>(host, path, token)

  // GitHub computes `mergeable` lazily: the first read of a PR it has not
  // examined recently returns null and kicks off the background check. One
  // retry is enough in practice, and a still-null answer is reported honestly
  // rather than guessed at. Only open PRs are worth retrying — a closed or
  // merged one reports null permanently, so retrying would just add a second
  // request and a delay to every closed PR opened in the UI.
  const worthRetrying = pr.state === 'open' && !pr.merged_at
  if (worthRetrying && (pr.mergeable === null || pr.mergeable === undefined)) {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const retried = await request<ApiPullRequest>(host, path, token).catch(() => null)
    if (retried) return toPullRequest(retried)
  }
  return toPullRequest(pr)
}

interface ApiCheckRun {
  name: string
  status: string
  conclusion: string | null
  html_url: string | null
  started_at: string | null
}

interface ApiCommitStatus {
  context: string
  state: 'pending' | 'success' | 'failure' | 'error'
  target_url: string | null
}

interface ApiRule {
  type: string
  parameters?: {
    required_status_checks?: { context: string }[]
    required_approving_review_count?: number
  }
}

interface ApiBranchProtection {
  required_pull_request_reviews?: { required_approving_review_count?: number } | null
}

interface ApiBranch {
  protection?: {
    required_status_checks?: { contexts?: string[]; checks?: { context: string }[] } | null
  }
}

/**
 * What the branch demands of changes headed into it. Requirements may come
 * from rulesets, classic protection, or both; any of the reads may be refused
 * (the protection endpoint is admin-only), so this never throws and leaves
 * null for what no read could establish.
 */
async function readBranchRules(
  host: string,
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  timeoutMs?: number
): Promise<BranchRules> {
  const base = `/repos/${owner}/${repo}`
  const branch = branchName.split('/').map(encodeURIComponent).join('/')
  const [rules, branchInfo, protection] = await Promise.allSettled([
    request<ApiRule[]>(host, `${base}/rules/branches/${branch}`, token, undefined, timeoutMs),
    request<ApiBranch>(host, `${base}/branches/${branch}`, token, undefined, timeoutMs),
    // Admin-only: the one place classic protection states its review rule.
    request<ApiBranchProtection>(host, `${base}/branches/${branch}/protection`, token, undefined, timeoutMs)
  ])

  let requiresPullRequest = false
  let requiredChecks: string[] | null = null
  let requiredApprovals: number | null = null
  if (rules.status === 'fulfilled') {
    requiredChecks = []
    for (const rule of rules.value) {
      if (rule.type === 'required_status_checks') {
        requiredChecks.push(...(rule.parameters?.required_status_checks ?? []).map((c) => c.context))
      } else if (rule.type === 'pull_request') {
        requiresPullRequest = true
        const count = rule.parameters?.required_approving_review_count ?? 0
        requiredApprovals = Math.max(requiredApprovals ?? 0, count)
      }
    }
  }
  if (branchInfo.status === 'fulfilled') {
    const classic = branchInfo.value.protection?.required_status_checks
    const contexts = [...(classic?.contexts ?? []), ...(classic?.checks ?? []).map((c) => c.context)]
    requiredChecks = [...(requiredChecks ?? []), ...contexts]
  }
  if (protection.status === 'fulfilled' && protection.value.required_pull_request_reviews) {
    requiresPullRequest = true
    const count = protection.value.required_pull_request_reviews.required_approving_review_count ?? 0
    requiredApprovals = Math.max(requiredApprovals ?? 0, count)
  }

  return { requiresPullRequest, requiredChecks: requiredChecks ? [...new Set(requiredChecks)] : null, requiredApprovals }
}

// Asked on every commit, in front of the user: a slow or absent network must
// cost a few seconds, not the 30 s default, before the commit goes ahead.
const BRANCH_RULES_TIMEOUT_MS = 5_000

export async function getBranchRules(host: string, owner: string, repo: string, branch: string): Promise<BranchRules> {
  return readBranchRules(host, await requireToken(host), owner, repo, branch, BRANCH_RULES_TIMEOUT_MS)
}

/**
 * Everything that decides whether the merge button is green: mergeable_state,
 * the head commit's check runs and commit statuses, the reviews, and what the
 * base branch requires. Each side read is allowed to fail on its own — a
 * fine-grained token without "Checks" access must still get the reviews back.
 */
export async function getPullRequestStatus(
  host: string,
  owner: string,
  repo: string,
  number: number
): Promise<PullRequestStatus> {
  const pr = await getPullRequest(host, owner, repo, number)
  const token = await requireToken(host)
  const base = `/repos/${owner}/${repo}`

  const pendingRules = readBranchRules(host, token, owner, repo, pr.baseRef)
  const [runs, statuses, reviews, decision] = await Promise.allSettled([
    request<{ total_count: number; check_runs: ApiCheckRun[] }>(host, `${base}/commits/${pr.headSha}/check-runs?per_page=100`, token),
    request<{ statuses: ApiCommitStatus[] }>(host, `${base}/commits/${pr.headSha}/status?per_page=100`, token),
    requestAll<{ user: { login: string } | null; state: string }>(host, `${base}/pulls/${number}/reviews?per_page=100`, token),
    graphql<{ repository: { pullRequest: { reviewDecision: Exclude<ReviewDecision, 'NOT_REQUIRED'> | null } | null } | null }>(
      host,
      token,
      'query($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { pullRequest(number: $number) { reviewDecision } } }',
      { owner, repo, number }
    )
  ])

  const checks: PullRequestCheck[] = []
  const checkErrors: string[] = []
  if (runs.status === 'fulfilled') {
    // A workflow triggered by both push and pull_request leaves one run per
    // event on the same commit, under the same name; the newest is the one
    // that counts. A run not started yet (null) is newer than any started one.
    const newest = new Map<string, ApiCheckRun>()
    for (const r of runs.value.check_runs) {
      const kept = newest.get(r.name)
      const newer = !kept || (kept.started_at !== null && (r.started_at === null || r.started_at > kept.started_at))
      if (newer) newest.set(r.name, r)
    }
    for (const r of newest.values()) {
      checks.push({ name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url })
    }
    if (runs.value.total_count > runs.value.check_runs.length) {
      checkErrors.push(tMain().github.checkRunsTruncated(runs.value.check_runs.length, runs.value.total_count))
    }
  } else {
    checkErrors.push(String(runs.reason?.message ?? runs.reason))
  }
  // The combined status already holds only the latest state per context.
  if (statuses.status === 'fulfilled') {
    for (const s of statuses.value.statuses) {
      const pending = s.state === 'pending'
      checks.push({
        name: s.context,
        status: pending ? 'in_progress' : 'completed',
        conclusion: pending ? null : s.state,
        url: s.target_url
      })
    }
  } else {
    checkErrors.push(String(statuses.reason?.message ?? statuses.reason))
  }

  // Reviews come oldest first. A plain comment does not withdraw an earlier
  // approval or change request, so it only counts when it is all there is.
  const latestReview = new Map<string, PullRequestReviewSummary>()
  if (reviews.status === 'fulfilled') {
    for (const r of reviews.value) {
      if (!r.user || r.state === 'PENDING') continue
      const previous = latestReview.get(r.user.login)
      if (r.state === 'COMMENTED' && previous && previous.state !== 'COMMENTED') continue
      latestReview.set(r.user.login, { authorLogin: r.user.login, state: r.state })
    }
  }
  const reviewsError = reviews.status === 'rejected' ? String(reviews.reason?.message ?? reviews.reason) : null

  let reviewDecision: ReviewDecision | null = null
  if (decision.status === 'fulfilled' && decision.value.repository?.pullRequest) {
    reviewDecision = decision.value.repository.pullRequest.reviewDecision ?? 'NOT_REQUIRED'
  }
  const rules = await pendingRules

  return {
    pr,
    checks,
    checksError: checkErrors.length > 0 ? checkErrors.join(' — ') : null,
    reviews: [...latestReview.values()],
    reviewsError,
    reviewDecision,
    requiredChecks: rules.requiredChecks,
    requiredApprovals: rules.requiredApprovals
  }
}

export async function createPullRequest(
  host: string,
  owner: string,
  repo: string,
  input: CreatePullRequestInput
): Promise<PullRequest> {
  const token = await requireToken(host)
  const pr = await request<ApiPullRequest>(host, `/repos/${owner}/${repo}/pulls`, token, {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return toPullRequest(pr)
}

export async function listPullRequestFiles(
  host: string,
  owner: string,
  repo: string,
  number: number
): Promise<PullRequestFile[]> {
  const token = await requireToken(host)
  const files = await requestAll<
    { filename: string; status: string; additions: number; deletions: number; patch?: string }
  >(host, `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`, token)
  return files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch
  }))
}

export async function listPullRequestComments(
  host: string,
  owner: string,
  repo: string,
  number: number
): Promise<PullRequestComment[]> {
  const token = await requireToken(host)
  const [issueComments, reviewComments] = await Promise.all([
    requestAll<{ id: number; user: { login: string }; body: string; created_at: string }>(
      host,
      `/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`,
      token
    ),
    requestAll<{ id: number; user: { login: string }; body: string; created_at: string; path: string; line: number | null }>(
      host,
      `/repos/${owner}/${repo}/pulls/${number}/comments?per_page=100`,
      token
    )
  ])
  const conversation = issueComments.map((c) => ({
    id: c.id,
    authorLogin: c.user.login,
    body: c.body,
    createdAt: c.created_at
  }))
  const inline = reviewComments.map((c) => ({
    id: c.id,
    authorLogin: c.user.login,
    body: c.line != null ? `\`${c.path}:${c.line}\`\n\n${c.body}` : `\`${c.path}\`\n\n${c.body}`,
    createdAt: c.created_at
  }))
  return [...conversation, ...inline].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function addPullRequestComment(
  host: string,
  owner: string,
  repo: string,
  number: number,
  body: string
): Promise<PullRequestComment> {
  const token = await requireToken(host)
  // The created comment is returned so the UI can show it right away: GitHub's
  // list endpoint often lags a moment behind the write that just succeeded.
  const created = await request<{ id: number; user: { login: string }; body: string; created_at: string }>(
    host,
    `/repos/${owner}/${repo}/issues/${number}/comments`,
    token,
    { method: 'POST', body: JSON.stringify({ body }) }
  )
  return { id: created.id, authorLogin: created.user.login, body: created.body, createdAt: created.created_at }
}

export async function mergePullRequest(
  host: string,
  owner: string,
  repo: string,
  number: number,
  method: MergeMethod,
  commitTitle?: string,
  commitMessage?: string
): Promise<void> {
  const token = await requireToken(host)
  await request(host, `/repos/${owner}/${repo}/pulls/${number}/merge`, token, {
    method: 'PUT',
    body: JSON.stringify({ merge_method: method, commit_title: commitTitle, commit_message: commitMessage })
  })
}

export async function setPullRequestState(
  host: string,
  owner: string,
  repo: string,
  number: number,
  state: 'open' | 'closed'
): Promise<void> {
  const token = await requireToken(host)
  await request(host, `/repos/${owner}/${repo}/pulls/${number}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ state })
  })
}

/**
 * A single inline comment. The review endpoint would need a top-level body too
 * (GitHub requires it for the COMMENT event), which would publish the same text
 * twice — once on the line and once in the conversation timeline.
 */
export async function addPullRequestReviewComment(
  host: string,
  owner: string,
  repo: string,
  number: number,
  body: string,
  commitId: string,
  path: string,
  line: number
): Promise<PullRequestComment> {
  const token = await requireToken(host)
  const created = await request<{ id: number; user: { login: string }; body: string; created_at: string }>(
    host,
    `/repos/${owner}/${repo}/pulls/${number}/comments`,
    token,
    { method: 'POST', body: JSON.stringify({ body, commit_id: commitId, path, line, side: 'RIGHT' }) }
  )
  // Same shape listPullRequestComments gives inline comments.
  return {
    id: created.id,
    authorLogin: created.user.login,
    body: `\`${path}:${line}\`\n\n${created.body}`,
    createdAt: created.created_at
  }
}

export async function submitPullRequestReview(
  host: string,
  owner: string,
  repo: string,
  number: number,
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  body: string,
  commitId: string,
  comments: { path: string; body: string; line: number }[] = []
): Promise<void> {
  const token = await requireToken(host)
  await request(host, `/repos/${owner}/${repo}/pulls/${number}/reviews`, token, {
    method: 'POST',
    body: JSON.stringify({
      commit_id: commitId,
      event,
      body,
      comments: comments.map((comment) => ({
        path: comment.path,
        body: comment.body,
        line: comment.line,
        side: 'RIGHT'
      }))
    })
  })
}

// --- New repositories ---------------------------------------------------------

/**
 * The account plus its organizations. An organization that has not approved
 * this OAuth app, or a token without read:org, simply leaves orgs out — the
 * account itself is always offered.
 */
export async function listRepositoryOwners(host: string): Promise<RepositoryOwner[]> {
  const token = await requireToken(host)
  const me = await request<ApiUser>(host, '/user', token)
  const owners: RepositoryOwner[] = [{ login: me.login, kind: 'user', avatarUrl: me.avatar_url }]
  const orgs = await requestAll<{ login: string; avatar_url: string }>(host, '/user/orgs?per_page=100', token, 5).catch(() => [])
  for (const org of orgs) owners.push({ login: org.login, kind: 'org', avatarUrl: org.avatar_url })
  return owners
}

/** POST /user/repos, or /orgs/{org}/repos when `owner` is not the signed-in account. Never auto-initialized: the local history is what gets pushed. */
export async function createRepository(
  host: string,
  input: { owner: string; name: string; description: string; private: boolean }
): Promise<{ fullName: string; htmlUrl: string; cloneUrl: string }> {
  const token = await requireToken(host)
  const me = await request<ApiUser>(host, '/user', token)
  const path = input.owner.toLowerCase() === me.login.toLowerCase() ? '/user/repos' : `/orgs/${encodeURIComponent(input.owner)}/repos`
  const repo = await request<ApiRepo>(host, path, token, {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description || undefined,
      private: input.private,
      auto_init: false
    })
  })
  return { fullName: repo.full_name, htmlUrl: repo.html_url ?? `https://${host}/${repo.full_name}`, cloneUrl: repo.clone_url }
}

// --- Collaborators ------------------------------------------------------------

interface ApiCollaborator {
  login: string
  avatar_url: string
  role_name: string
}

interface ApiInvitation {
  id: number
  invitee: { login: string; avatar_url?: string } | null
  permissions: string
  created_at: string
  expired?: boolean
}

// The write endpoint still takes the role names GitHub used before read/write.
const API_PERMISSION: Record<RepositoryRole, string> = {
  read: 'pull',
  triage: 'triage',
  write: 'push',
  maintain: 'maintain',
  admin: 'admin'
}

function repositoryPath(owner: string, repo: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
}

function toInvitation(invitation: ApiInvitation): RepositoryInvitation {
  return {
    id: invitation.id,
    login: invitation.invitee?.login ?? null,
    avatarUrl: invitation.invitee?.avatar_url ?? null,
    role: invitation.permissions,
    createdAt: invitation.created_at,
    expired: Boolean(invitation.expired)
  }
}

/**
 * Who has access and what the signed-in account may do about it. Invitations
 * are allowed to fail on their own: a list of collaborators without them is
 * still worth showing.
 */
export async function getRepositoryCollaborators(host: string, owner: string, repo: string): Promise<RepositoryCollaborators> {
  const token = await requireToken(host)
  const base = repositoryPath(owner, repo)
  const info = await request<{ owner: { login: string; type: string }; permissions?: { admin?: boolean; push?: boolean } }>(host, base, token)
  const ownerLogin = info.owner.login
  const ownerKind = info.owner.type === 'Organization' ? 'org' : 'user'
  const canAdminister = Boolean(info.permissions?.admin)
  const canView = canAdminister || Boolean(info.permissions?.push)
  if (!canView) return { ownerLogin, ownerKind, canView, canAdminister, collaborators: [], invitations: [], invitationsError: null }

  const list = (affiliation: 'all' | 'direct'): Promise<ApiCollaborator[]> =>
    requestAll<ApiCollaborator>(host, `${base}/collaborators?affiliation=${affiliation}&per_page=100`, token)

  let everyone: ApiCollaborator[]
  let direct: Set<string> | null = null
  try {
    // On a personal repository everyone is direct, so asking twice would only cost a request.
    const [all, directOnly] = await Promise.all([list('all'), ownerKind === 'org' ? list('direct') : null])
    everyone = all
    if (directOnly) direct = new Set(directOnly.map((c) => c.login))
  } catch (err) {
    // An organization can refuse this list to a sign-in that works everywhere
    // else, so a bare "Forbidden" would not say where to go next.
    if (ownerKind === 'org' && err instanceof GitHubApiError && (err.status === 403 || err.status === 404)) {
      throw new GitHubApiError(tMain().github.collaboratorsForbidden(err.message), err.status)
    }
    throw err
  }

  let invitations: RepositoryInvitation[] = []
  let invitationsError: string | null = null
  if (canAdminister) {
    try {
      invitations = (await requestAll<ApiInvitation>(host, `${base}/invitations?per_page=100`, token)).map(toInvitation)
    } catch (err) {
      invitationsError = err instanceof Error ? err.message : String(err)
    }
  }

  return {
    ownerLogin,
    ownerKind,
    canView,
    canAdminister,
    collaborators: everyone
      .map((c) => ({ login: c.login, avatarUrl: c.avatar_url, role: c.role_name, direct: direct ? direct.has(c.login) : true }))
      .sort((a, b) => a.login.localeCompare(b.login, undefined, { sensitivity: 'base' })),
    invitations,
    invitationsError
  }
}

const USER_SEARCH_LIMIT = 8

/**
 * Accounts matching a login or profile name. GraphQL because the REST search
 * leaves the name out, and the name is how someone recognizes the right person.
 */
export async function searchUsers(host: string, query: string): Promise<GitHubUserSuggestion[]> {
  const token = await requireToken(host)
  const { search } = await graphql<{
    search: { nodes: ({ login?: string; name?: string | null; avatarUrl?: string } | null)[] }
  }>(
    host,
    token,
    'query($q: String!, $first: Int!) { search(query: $q, type: USER, first: $first) { nodes { ... on User { login name avatarUrl } } } }',
    { q: `${query} type:user`, first: USER_SEARCH_LIMIT }
  )
  return search.nodes.flatMap((node) =>
    node?.login ? [{ login: node.login, name: node.name || null, avatarUrl: node.avatarUrl ?? '' }] : []
  )
}

/**
 * Adds a person, or changes the role of one already there — GitHub has a single
 * endpoint for both. Without a role GitHub applies its default, and on personal
 * repositories a role is not accepted at all.
 */
export async function addCollaborator(
  host: string,
  owner: string,
  repo: string,
  username: string,
  role?: RepositoryRole
): Promise<AddCollaboratorResult> {
  const token = await requireToken(host)
  try {
    const invitation = await request<ApiInvitation | undefined>(
      host,
      `${repositoryPath(owner, repo)}/collaborators/${encodeURIComponent(username)}`,
      token,
      { method: 'PUT', body: JSON.stringify(role ? { permission: API_PERMISSION[role] } : {}) }
    )
    return invitation ? { kind: 'invited', invitation: toInvitation(invitation) } : { kind: 'added' }
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 404) {
      throw new GitHubApiError(tMain().github.collaboratorNotFound(username), err.status)
    }
    throw err
  }
}

export async function removeCollaborator(host: string, owner: string, repo: string, username: string): Promise<void> {
  const token = await requireToken(host)
  await request(host, `${repositoryPath(owner, repo)}/collaborators/${encodeURIComponent(username)}`, token, { method: 'DELETE' })
}

export async function cancelRepositoryInvitation(host: string, owner: string, repo: string, invitationId: number): Promise<void> {
  const token = await requireToken(host)
  await request(host, `${repositoryPath(owner, repo)}/invitations/${invitationId}`, token, { method: 'DELETE' })
}

// --- What the Messages tab shows ------------------------------------------------

/**
 * Runs a read that happens on every start, signed in or not: null means there is
 * no working sign-in, which is not an error. Doesn't delete a dead token —
 * getSession already owns that decision.
 */
async function whenSignedIn<T>(host: string, read: (token: string) => Promise<T>): Promise<T | null> {
  const token = await getSecret(credentialKey(host))
  if (!token) return null
  try {
    return await read(token)
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 401) return null
    throw err
  }
}

interface ApiNotification {
  id: string
  reason: string
  updated_at: string
  subject: { title: string; type: string; url: string | null }
  repository: { full_name: string; html_url: string }
}

/** The page to open: GitHub only gives the API address of a subject, and not even that for some kinds. */
function notificationWebUrl({ subject, repository }: ApiNotification): string {
  const repo = repository.html_url
  const match = subject.url?.match(/\/(pulls|issues|commits)\/([^/]+)$/)
  if (match) {
    const section = { pulls: 'pull', issues: 'issues', commits: 'commit' }[match[1]]
    return `${repo}/${section}/${match[2]}`
  }
  if (subject.type === 'Release') return `${repo}/releases`
  if (subject.type === 'Discussion') return `${repo}/discussions`
  if (subject.type === 'CheckSuite') return `${repo}/actions`
  return repo
}

/** Unread notifications, newest first. Invitations are left out: they have their own list, with their own actions. */
export function getNotifications(host: string): Promise<GitHubNotification[] | null> {
  return whenSignedIn(host, async (token) => {
    const notifications = await request<ApiNotification[]>(host, '/notifications?per_page=50', token)
    return notifications
      .filter((notification) => notification.subject.type !== 'RepositoryInvitation')
      .map((notification) => ({
        id: notification.id,
        kind: notification.subject.type,
        reason: notification.reason,
        title: notification.subject.title,
        repoFullName: notification.repository.full_name,
        htmlUrl: notificationWebUrl(notification),
        updatedAt: notification.updated_at
      }))
  })
}

export async function markNotificationRead(host: string, threadId: string): Promise<void> {
  const token = await requireToken(host)
  await request(host, `/notifications/threads/${encodeURIComponent(threadId)}`, token, { method: 'PATCH' })
}

/** Up to `lastReadAt`, so something that arrives after the list was read stays unread. */
export async function markAllNotificationsRead(host: string, lastReadAt: string): Promise<void> {
  const token = await requireToken(host)
  await request(host, '/notifications', token, { method: 'PUT', body: JSON.stringify({ last_read_at: lastReadAt }) })
}

const RECENT_STARS_DAYS = 30
const RECENT_STARS_LIMIT = 20

/**
 * GitHub doesn't notify about stars, so they are read from the repositories
 * themselves: the latest few of each is enough to catch up between checks.
 * Costs a single GraphQL request however many repositories there are.
 */
interface ApiStarRepository {
  nameWithOwner?: string
  stargazers?: {
    edges?: ({ starredAt?: string; node?: { login?: string; avatarUrl?: string; url?: string } | null } | null)[] | null
  } | null
}

export function getRecentStars(host: string): Promise<RepositoryStar[] | null> {
  return whenSignedIn(host, async (token) => {
    const { viewer } = await graphql<{
      viewer: { login?: string; repositories?: { nodes?: (ApiStarRepository | null)[] | null } | null } | null
    }>(
      host,
      token,
      'query { viewer { login repositories(first: 100, ownerAffiliations: [OWNER, ORGANIZATION_MEMBER], orderBy: { field: PUSHED_AT, direction: DESC }) { nodes { nameWithOwner stargazers(first: 5, orderBy: { field: STARRED_AT, direction: DESC }) { edges { starredAt node { login avatarUrl url } } } } } } }',
      {},
      true
    )
    if (!viewer?.login) throw new GitHubApiError(tMain().github.requestRejected(200), 200)
    const since = Date.now() - RECENT_STARS_DAYS * 24 * 60 * 60 * 1000
    return (viewer.repositories?.nodes ?? [])
      .flatMap((repository) => {
        const repoFullName = repository?.nameWithOwner
        if (!repoFullName) return []
        return (repository.stargazers?.edges ?? []).flatMap((edge) => {
          const login = edge?.node?.login
          if (!edge?.starredAt || !login) return []
          return [
            {
              repoFullName,
              login,
              avatarUrl: edge.node?.avatarUrl ?? '',
              profileUrl: edge.node?.url ?? '',
              starredAt: edge.starredAt
            }
          ]
        })
      })
      .filter((star) => star.login !== viewer.login && Date.parse(star.starredAt) >= since)
      .sort((a, b) => Date.parse(b.starredAt) - Date.parse(a.starredAt))
      .slice(0, RECENT_STARS_LIMIT)
  })
}

interface ApiReceivedInvitation {
  id: number
  html_url: string
  permissions: string
  created_at: string
  expired?: boolean
  repository: { full_name: string; private?: boolean }
  inviter: { login: string; avatar_url?: string } | null
}

/** Pending invitations. Expired ones are left out because GitHub no longer lets anyone act on them. */
export function getReceivedInvitations(host: string): Promise<ReceivedInvitation[] | null> {
  return whenSignedIn(host, async (token) => {
    const invitations = await requestAll<ApiReceivedInvitation>(host, '/user/repository_invitations?per_page=100', token)
    return invitations
      .filter((invitation) => !invitation.expired)
      .map((invitation) => ({
        id: invitation.id,
        repoFullName: invitation.repository.full_name,
        htmlUrl: invitation.html_url,
        isPrivate: Boolean(invitation.repository.private),
        inviterLogin: invitation.inviter?.login ?? null,
        inviterAvatarUrl: invitation.inviter?.avatar_url ?? null,
        role: invitation.permissions,
        createdAt: invitation.created_at
      }))
  })
}

/** A 404 here means the invitation was cancelled, already answered, or expired since the list was read. */
async function answerInvitation(host: string, invitationId: number, method: 'PATCH' | 'DELETE'): Promise<void> {
  const token = await requireToken(host)
  try {
    await request(host, `/user/repository_invitations/${invitationId}`, token, { method })
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 404) {
      throw new GitHubApiError(tMain().github.invitationGone, err.status)
    }
    throw err
  }
}

export function acceptInvitation(host: string, invitationId: number): Promise<void> {
  return answerInvitation(host, invitationId, 'PATCH')
}

export function declineInvitation(host: string, invitationId: number): Promise<void> {
  return answerInvitation(host, invitationId, 'DELETE')
}
