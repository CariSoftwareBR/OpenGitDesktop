import { apiBaseForHost, credentialKey, nextPageUrl } from '../shared/githubRemote'
import { getSecret, saveSecret, deleteSecret } from './credentials'
import { httpFetch } from './httpFetch'
import { tMain } from './i18n'
import type {
  CreatePullRequestInput,
  GitHubRepoSummary,
  GitHubUser,
  MergeMethod,
  PullRequest,
  PullRequestComment,
  PullRequestFile,
  PullRequestState
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

async function request<T>(host: string, path: string, token: string, init?: RequestInit): Promise<T> {
  return (await send<T>(`${apiBaseForHost(host)}${path}`, token, init)).data
}

async function send<T>(url: string, token: string, init?: RequestInit): Promise<{ data: T; next: string | null }> {
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
  })

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
  if (response.status === 204) return { data: undefined as T, next }
  return { data: (await response.json()) as T, next }
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
  name: string
  owner: { login: string }
  clone_url: string
  private: boolean
}

interface ApiPullRequest {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  draft: boolean
  merged_at: string | null
  head: { ref: string; sha: string }
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
    private: repo.private
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
