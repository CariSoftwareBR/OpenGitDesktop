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

export type PullRequestReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'

export interface PullRequestReviewCommentInput {
  path: string
  body: string
  line: number
}
