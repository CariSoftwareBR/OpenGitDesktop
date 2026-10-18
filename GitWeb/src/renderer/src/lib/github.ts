// The renderer no longer talks to the GitHub API directly — every call goes
// through `window.api.github.*`, which runs in main where the access token
// lives. What is left here is the type surface plus the remote-URL parsing
// that both processes share.
export type {
  CreatePullRequestInput,
  GitHubRepoSummary,
  GitHubUser,
  MergeMethod,
  PullRequest,
  PullRequestComment,
  PullRequestFile,
  PullRequestState
} from '../../../shared/github'

export type { RemoteInfo } from '../../../shared/githubRemote'
export { parseGitHubRemote, apiBaseForHost } from '../../../shared/githubRemote'
