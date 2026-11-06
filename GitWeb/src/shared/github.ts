// Shapes returned by the GitHub REST layer. They live in shared/ because the
// calls themselves run in the main process (main/githubApi.ts) — the renderer
// only ever sees these already-mapped objects, never a token.

export interface GitHubUser {
  login: string
  name: string | null
  avatarUrl: string
}

export interface GitHubRepoSummary {
  fullName: string
  name: string
  owner: string
  cloneUrl: string
  private: boolean
  /** Optional enrichments — older callers and the token flow may omit them. */
  description?: string | null
  language?: string | null
  /** Last push (falls back to last update), ISO 8601. */
  updatedAt?: string | null
  fork?: boolean
  archived?: boolean
}

export type PullRequestState = 'open' | 'closed' | 'all'

export type MergeMethod = 'merge' | 'squash' | 'rebase'

export interface PullRequest {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  draft: boolean
  merged: boolean
  headRef: string
  headSha: string
  /** Owner of the repository the head branch lives in — differs from the base's on PRs from forks. */
  headOwner?: string | null
  baseRef: string
  /** Only the single-PR endpoint reports these; null from list results, and
   *  null from GitHub itself while it is still computing the merge. */
  mergeable: boolean | null
  /** 'clean' | 'dirty' | 'blocked' | 'behind' | 'unstable' | 'draft' | 'unknown' */
  mergeableState: string | null
  authorLogin: string
  htmlUrl: string
  createdAt: string
}

export interface PullRequestFile {
  filename: string
  status: string
  additions: number
  deletions: number
  patch?: string
}

export interface PullRequestComment {
  id: number
  authorLogin: string
  body: string
  createdAt: string
}

/** A check run or a commit status on the PR's head commit, in one shape. */
export interface PullRequestCheck {
  name: string
  /** 'queued' | 'in_progress' | 'completed' (commit statuses: 'pending' maps to 'in_progress'). */
  status: string
  /** 'success' | 'failure' | 'neutral' | 'skipped' | 'cancelled' | 'timed_out' | 'error' | …; null while running. */
  conclusion: string | null
  url: string | null
}

export interface PullRequestReviewSummary {
  authorLogin: string
  /** 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' */
  state: string
}

/** What a branch demands before changes land on it (rulesets + classic protection). */
export interface BranchRules {
  /** Changes may only arrive through a pull request. */
  requiresPullRequest: boolean
  /** Null when neither rulesets nor protection could be read. */
  requiredChecks: string[] | null
  requiredApprovals: number | null
}

/** GraphQL's reviewDecision, with its "no review rule applies" null spelled out. */
export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | 'NOT_REQUIRED'

/** What decides whether a PR can be merged right now. */
export interface PullRequestStatus {
  pr: PullRequest
  checks: PullRequestCheck[]
  /** Set when the checks or statuses could not be read (e.g. a token without that permission). */
  checksError: string | null
  /** Latest review per reviewer. */
  reviews: PullRequestReviewSummary[]
  /** Set when the reviews could not be read — an empty list then means "unknown", not "no approvals". */
  reviewsError: string | null
  /** GitHub's own verdict on reviews, readable without admin; null when it could not be read. */
  reviewDecision: ReviewDecision | null
  /** From branch protection and rulesets on the base branch; null when unreadable. */
  requiredChecks: string[] | null
  requiredApprovals: number | null
}

export interface CreatePullRequestInput {
  title: string
  body: string
  head: string
  base: string
  draft: boolean
}

/** Where a new repository can be created: the signed-in account or one of its organizations. */
export interface RepositoryOwner {
  login: string
  kind: 'user' | 'org'
  avatarUrl: string
}

export interface PublishRepositoryInput {
  /** Account or organization login; the signed-in user's own login creates it under the account. */
  owner: string
  name: string
  description: string
  private: boolean
}

export interface PublishRepositoryResult {
  fullName: string
  htmlUrl: string
  branch: string
}

/** Valid GitHub repository name: letters, digits, '.', '-', '_' (spaces become '-'). */
export function sanitizeRepositoryName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 100)
}

/** GitHub's five standard repository roles, as `role_name` spells them. */
export const REPOSITORY_ROLES = ['read', 'triage', 'write', 'maintain', 'admin'] as const
export type RepositoryRole = (typeof REPOSITORY_ROLES)[number]

export interface RepositoryCollaborator {
  login: string
  avatarUrl: string
  /** A standard role, or the name of a custom role defined by the organization. */
  role: string
  /** False when access only comes from the organization or a team, which this repository cannot take away. */
  direct: boolean
}

export interface RepositoryInvitation {
  id: number
  /** Null when the invitation went to an e-mail address with no account behind it. */
  login: string | null
  avatarUrl: string | null
  role: string
  createdAt: string
  expired: boolean
}

export interface RepositoryCollaborators {
  /** As GitHub reports it: the remote URL can still name the owner from before a transfer or rename. */
  ownerLogin: string
  ownerKind: 'user' | 'org'
  /** GitHub only lists collaborators to accounts with write access or higher. */
  canView: boolean
  canAdminister: boolean
  collaborators: RepositoryCollaborator[]
  invitations: RepositoryInvitation[]
  /** Set when the invitations could not be read — an empty list then means "unknown", not "none". */
  invitationsError: string | null
}

/** 201 means GitHub sent an invitation; 204 means access changed right away. */
export type AddCollaboratorResult = { kind: 'invited'; invitation: RepositoryInvitation } | { kind: 'added' }

/**
 * The login in whatever the user typed or pasted (`@octocat`, a profile URL),
 * or null when it cannot be one, such as an e-mail address. Underscores are
 * legal only for Enterprise Managed Users, but those are real logins.
 */
export function normalizeGitHubUsername(input: string): string | null {
  const login = input
    .trim()
    .replace(/^(?:https?:\/\/[^/]+|(?:[a-z\d-]+\.)+[a-z]{2,}(?::\d+)?)\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/^@/, '')
  return /^[a-z\d](?:[a-z\d_-]{0,37}[a-z\d_])?$/i.test(login) ? login : null
}

/** An invitation the signed-in account received to join someone's repository. */
export interface ReceivedInvitation {
  id: number
  repoFullName: string
  /** The invitation's page on GitHub. */
  htmlUrl: string
  isPrivate: boolean
  /** GitHub can leave this out, for instance when the account that invited was deleted. */
  inviterLogin: string | null
  inviterAvatarUrl: string | null
  role: string
  createdAt: string
}

/** An unread item from GitHub's notifications: a pull request, an issue, a mention, and so on. */
export interface GitHubNotification {
  id: string
  /** GitHub's subject type, such as PullRequest or Issue. */
  kind: string
  /** Why GitHub notified this account, such as review_requested or mention. */
  reason: string
  title: string
  repoFullName: string
  htmlUrl: string
  updatedAt: string
}

/** Someone starring a repository the signed-in account owns or works on through an organization. */
export interface RepositoryStar {
  repoFullName: string
  login: string
  avatarUrl: string
  profileUrl: string
  starredAt: string
}

/** One account offered while typing who to invite. */
export interface GitHubUserSuggestion {
  login: string
  /** The profile name, when the person set one. It is what tells two similar logins apart. */
  name: string | null
  avatarUrl: string
}

/** What to look up for the text in the field: the login in a pasted `@octocat` or URL, otherwise the words as typed. */
export function userSearchQuery(input: string): string {
  return normalizeGitHubUsername(input) ?? input.trim()
}

/**
 * Whether this person's access can be changed from here. The owner cannot lose
 * access, inherited access is not this repository's to remove, and an admin
 * changing their own access could lock themselves out with no way back.
 */
export function canManageCollaborator(
  collaborator: RepositoryCollaborator,
  context: { canAdminister: boolean; owner: string; viewer: string }
): boolean {
  const login = collaborator.login.toLowerCase()
  return (
    context.canAdminister &&
    collaborator.direct &&
    login !== context.owner.toLowerCase() &&
    login !== context.viewer.toLowerCase()
  )
}

export type PullRequestReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'

export interface PullRequestReviewCommentInput {
  path: string
  body: string
  line: number
}
