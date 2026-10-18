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
