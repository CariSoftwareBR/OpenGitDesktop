import type {
  BranchInfo,
  CloneOutcome,
  CloneProgress,
  CommitDetails,
  CommitFile,
  CommitSummary,
  FileHistoryLocation,
  GitIdentity,
  GitResult,
  RecentReposData,
  RepoStatus,
  RepoUpdateResult,
  RepoUpdateStatus,
  StashEntry
} from '../shared/git'
import type { AiSettings, ResolvedAiConfig } from '../shared/ai'
import type { ChatMessage, ChatRequestOutcome, ChatResponse, ToolDefinition } from '../shared/aiChat'
import type { AppSettings } from '../shared/settings'
import type { Locale } from '../shared/i18n/locales'
import type { DeviceFlowPollResult, DeviceFlowStart, OAuthAppInfo } from '../shared/githubAuth'
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
import type { UpdateStatus } from '../shared/updates'

export interface Api {
  app: {
    getVersion: () => Promise<string>
    getUpdateStatus: () => Promise<UpdateStatus>
    checkForUpdates: () => Promise<UpdateStatus>
    quitAndInstall: () => Promise<void>
    capturePage: (rect: { x: number; y: number; width: number; height: number }) => Promise<string>
    onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
  }
  git: {
    isRepository: (cwd: string) => Promise<boolean>
    scanForRepositories: (rootPath: string) => Promise<string[]>
    init: (cwd: string) => Promise<void>
    clone: (url: string, destination: string) => Promise<CloneOutcome>
    cancelClone: (destination: string) => Promise<void>
    onCloneProgress: (callback: (progress: CloneProgress) => void) => () => void
    status: (cwd: string) => Promise<RepoStatus>
    stage: (paths: string[], cwd: string) => Promise<void>
    unstage: (paths: string[], cwd: string) => Promise<void>
    discard: (paths: string[], cwd: string) => Promise<void>
    diff: (path: string, cwd: string, staged: boolean) => Promise<string>
    diffStagedAll: (cwd: string) => Promise<string>
    diffUnstagedAll: (cwd: string) => Promise<string>
    branchDiff: (cwd: string, base: string, head: string) => Promise<string>
    commit: (summary: string, description: string, cwd: string) => Promise<void>
    applyPatch: (cwd: string, patch: string, cached: boolean, reverse: boolean) => Promise<void>
    resetSoftHead: (cwd: string) => Promise<void>
    commitAmend: (cwd: string, summary?: string, description?: string) => Promise<void>
    branches: (cwd: string) => Promise<BranchInfo[]>
    createBranch: (name: string, cwd: string, checkout: boolean, from?: string) => Promise<void>
    switchBranch: (name: string, cwd: string) => Promise<void>
    log: (cwd: string, limit?: number, path?: string) => Promise<CommitSummary[]>
    commitFiles: (hash: string, cwd: string) => Promise<CommitFile[]>
    commitDiff: (hash: string, path: string, cwd: string) => Promise<string>
    commitDetails: (cwd: string, ref: string) => Promise<CommitDetails | null>
    commitPatch: (cwd: string, ref: string) => Promise<string>

    remoteUrl: (cwd: string, remoteName?: string) => Promise<string | null>

    getIdentity: (cwd: string) => Promise<{ local: GitIdentity; global: GitIdentity }>
    setIdentity: (cwd: string, scope: 'local' | 'global', values: { name?: string; email?: string }) => Promise<void>

    listFiles: (cwd: string, pattern?: string) => Promise<string[]>
    readFileForAgent: (cwd: string, path: string) => Promise<string>

    fetch: (cwd: string) => Promise<void>
    fetchDryRun: (cwd: string) => Promise<GitResult>
    pull: (cwd: string) => Promise<GitResult>
    push: (cwd: string, branch: string, setUpstream: boolean) => Promise<void>
    forcePush: (cwd: string) => Promise<void>
    stashPatch: (cwd: string, ref: string) => Promise<string>
    revertCommit: (hash: string, cwd: string) => Promise<GitResult>
    remoteBranches: (cwd: string) => Promise<string[]>
    checkoutRemoteBranch: (remoteBranch: string, cwd: string) => Promise<void>
    deleteBranch: (name: string, cwd: string, force: boolean) => Promise<void>
    renameBranch: (oldName: string, newName: string, cwd: string) => Promise<void>
    deleteRemoteBranch: (name: string, cwd: string) => Promise<void>

    repoUpdateStatus: (cwd: string, options?: { fetch?: boolean }) => Promise<RepoUpdateStatus>
    updateToDefaultBranch: (cwd: string) => Promise<RepoUpdateResult>

    merge: (branchName: string, cwd: string) => Promise<GitResult>
    mergeAbort: (cwd: string) => Promise<void>

    stashList: (cwd: string) => Promise<StashEntry[]>
    stashPush: (cwd: string, message: string) => Promise<void>
    stashApply: (cwd: string, ref: string) => Promise<void>
    stashPop: (cwd: string, ref: string) => Promise<void>
    stashDrop: (cwd: string, ref: string) => Promise<void>
    addToGitIgnore: (cwd: string, patterns: string[]) => Promise<{ success: boolean; message: string }>
    stopTracking: (cwd: string, paths: string[]) => Promise<{ success: boolean; message: string }>
    locateFileInHistory: (cwd: string, path: string) => Promise<FileHistoryLocation>
    isPathIgnored: (cwd: string, path: string) => Promise<boolean>
    isCommitPublished: (cwd: string, ref?: string) => Promise<boolean>
    undoUnpublishedCommit: (cwd: string, expectedHash: string) => Promise<void>
  }
  fs: {
    readRepoFile: (cwd: string, path: string) => Promise<string>
    writeRepoFile: (cwd: string, path: string, content: string) => Promise<void>
    resolveRepoPath: (cwd: string, path: string) => Promise<string>
    pathExists: (fullPath: string) => Promise<boolean>
  }
  shell: {
    showItemInFolder: (cwd: string, relativePath: string) => Promise<void>
    openPath: (cwd: string, relativePath: string) => Promise<string>
  }
  dialogs: {
    openDirectory: () => Promise<string | null>
  }
  /** AI provider keys only — main rejects any other key prefix. */
  secrets: {
    save: (key: string, value: string) => Promise<void>
    get: (key: string) => Promise<string | null>
    delete: (key: string) => Promise<void>
  }
  /** Proxied through main, which owns the GitHub token. Never returns one. */
  github: {
    getOAuthAppInfo: () => Promise<OAuthAppInfo>
    deviceFlowStart: (host: string) => Promise<DeviceFlowStart>
    deviceFlowPoll: (flowId: string) => Promise<DeviceFlowPollResult>
    deviceFlowCancel: (flowId: string) => Promise<void>

    getSession: (host: string) => Promise<GitHubUser | null>
    loginWithPat: (host: string, token: string) => Promise<GitHubUser>
    logout: (host: string) => Promise<void>

    listUserRepos: (host: string) => Promise<GitHubRepoSummary[]>
    listUserReposWithToken: (host: string, token: string) => Promise<GitHubRepoSummary[]>

    listPullRequests: (host: string, owner: string, repo: string, state: PullRequestState) => Promise<PullRequest[]>
    getPullRequest: (host: string, owner: string, repo: string, number: number) => Promise<PullRequest>
    createPullRequest: (
      host: string,
      owner: string,
      repo: string,
      input: CreatePullRequestInput
    ) => Promise<PullRequest>
    listPullRequestFiles: (host: string, owner: string, repo: string, number: number) => Promise<PullRequestFile[]>
    listPullRequestComments: (
      host: string,
      owner: string,
      repo: string,
      number: number
    ) => Promise<PullRequestComment[]>
    addPullRequestComment: (host: string, owner: string, repo: string, number: number, body: string) => Promise<PullRequestComment>
    mergePullRequest: (
      host: string,
      owner: string,
      repo: string,
      number: number,
      method: MergeMethod,
      title?: string,
      message?: string
    ) => Promise<void>
    setPullRequestState: (
      host: string,
      owner: string,
      repo: string,
      number: number,
      state: 'open' | 'closed'
    ) => Promise<void>
    addPullRequestReviewComment: (
      host: string,
      owner: string,
      repo: string,
      number: number,
      body: string,
      commitId: string,
      path: string,
      line: number
    ) => Promise<PullRequestComment>
    submitPullRequestReview: (
      host: string,
      owner: string,
      repo: string,
      number: number,
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
      body: string,
      commitId: string,
      comments?: { path: string; body: string; line: number }[]
    ) => Promise<void>
  }
  recentRepos: {
    list: () => Promise<RecentReposData>
    add: (path: string) => Promise<RecentReposData>
    addMany: (paths: string[]) => Promise<RecentReposData>
    remove: (path: string) => Promise<RecentReposData>

    createGroup: (name: string) => Promise<RecentReposData>
    renameGroup: (id: string, name: string) => Promise<RecentReposData>
    deleteGroup: (id: string) => Promise<RecentReposData>
    setRepoGroup: (path: string, groupId: string | null) => Promise<RecentReposData>
    setGroupCollapsed: (id: string, collapsed: boolean) => Promise<RecentReposData>
  }
  settings: {
    get: () => Promise<AppSettings>
    setLastRepositoryPath: (path: string | null) => Promise<void>
    setAppSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
    getSystemLocale: () => Promise<Locale>
  }
  ai: {
    getSettings: () => Promise<AiSettings>
    setSettings: (settings: AiSettings) => Promise<void>
    sendChatRequest: (
      config: ResolvedAiConfig,
      apiKey: string,
      messages: ChatMessage[],
      tools?: ToolDefinition[],
      requestId?: string
    ) => Promise<ChatResponse>
    listModels: (config: ResolvedAiConfig, apiKey: string) => Promise<string[]>
    abortChatRequest: (requestId: string) => Promise<void>
    sendToolAwareChatRequest: (
      config: ResolvedAiConfig,
      apiKey: string,
      messages: ChatMessage[],
      tools?: ToolDefinition[],
      requestId?: string
    ) => Promise<ChatRequestOutcome>
  }
}

declare global {
  interface Window {
    api: Api
  }
}
