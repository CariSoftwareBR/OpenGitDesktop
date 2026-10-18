import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
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
  StashEntry,
  SwitchBranchResult
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

// ipcRenderer.invoke rejects with "Error invoking remote method '<channel>': Error: <msg>".
// That prefix is transport noise that every error banner would otherwise show,
// so it is stripped once here; the message main threw is what the user reads.
const IPC_ERROR_PREFIX = /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invoke(channel: string, ...args: unknown[]): Promise<any> {
  return ipcRenderer.invoke(channel, ...args).catch((err: unknown) => {
    if (err instanceof Error) err.message = err.message.replace(IPC_ERROR_PREFIX, '')
    throw err
  })
}

const api = {
  app: {
    getVersion: (): Promise<string> => invoke('app:getVersion'),
    getUpdateStatus: (): Promise<UpdateStatus> => invoke('app:getUpdateStatus'),
    checkForUpdates: (): Promise<UpdateStatus> => invoke('app:checkForUpdates'),
    quitAndInstall: (): Promise<void> => invoke('app:quitAndInstall'),
    capturePage: (rect: { x: number; y: number; width: number; height: number }): Promise<string> =>
      invoke('app:capturePage', rect),
    onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, status: UpdateStatus): void => {
        callback(status)
      }
      ipcRenderer.on('app:update-status', listener)
      return () => {
        ipcRenderer.removeListener('app:update-status', listener)
      }
    }
  },
  git: {
    isRepository: (cwd: string): Promise<boolean> => invoke('git:isRepository', cwd),
    scanForRepositories: (rootPath: string): Promise<string[]> =>
      invoke('git:scanForRepositories', rootPath),
    init: (cwd: string): Promise<void> => invoke('git:init', cwd),
    clone: (url: string, destination: string): Promise<CloneOutcome> =>
      invoke('git:clone', url, destination),
    cancelClone: (destination: string): Promise<void> =>
      invoke('git:cancelClone', destination),
    onCloneProgress: (callback: (progress: CloneProgress) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, progress: CloneProgress): void => {
        callback(progress)
      }
      ipcRenderer.on('git:clone-progress', listener)
      return () => {
        ipcRenderer.removeListener('git:clone-progress', listener)
      }
    },
    status: (cwd: string): Promise<RepoStatus> => invoke('git:status', cwd),
    stage: (paths: string[], cwd: string): Promise<void> => invoke('git:stage', paths, cwd),
    unstage: (paths: string[], cwd: string): Promise<void> => invoke('git:unstage', paths, cwd),
    discard: (paths: string[], cwd: string): Promise<void> => invoke('git:discard', paths, cwd),
    diff: (path: string, cwd: string, staged: boolean): Promise<string> =>
      invoke('git:diff', path, cwd, staged),
    diffStagedAll: (cwd: string): Promise<string> => invoke('git:diffStagedAll', cwd),
    diffUnstagedAll: (cwd: string): Promise<string> => invoke('git:diffUnstagedAll', cwd),
    branchDiff: (cwd: string, base: string, head: string): Promise<string> =>
      invoke('git:branchDiff', cwd, base, head),
    commit: (summary: string, description: string, cwd: string): Promise<void> =>
      invoke('git:commit', summary, description, cwd),
    applyPatch: (cwd: string, patch: string, cached: boolean, reverse: boolean): Promise<void> =>
      invoke('git:applyPatch', cwd, patch, cached, reverse),
    resetSoftHead: (cwd: string): Promise<void> => invoke('git:resetSoftHead', cwd),
    commitAmend: (cwd: string, summary?: string, description?: string): Promise<void> =>
      invoke('git:commitAmend', cwd, summary, description),
    branches: (cwd: string): Promise<BranchInfo[]> => invoke('git:branches', cwd),
    createBranch: (name: string, cwd: string, checkout: boolean, from?: string): Promise<void> =>
      invoke('git:createBranch', name, cwd, checkout, from),
    switchBranch: (name: string, cwd: string): Promise<SwitchBranchResult> =>
      invoke('git:switchBranch', name, cwd),
    log: (cwd: string, limit?: number, path?: string): Promise<CommitSummary[]> =>
      invoke('git:log', cwd, limit, path),
    commitFiles: (hash: string, cwd: string): Promise<CommitFile[]> =>
      invoke('git:commitFiles', hash, cwd),
    commitDiff: (hash: string, path: string, cwd: string): Promise<string> =>
      invoke('git:commitDiff', hash, path, cwd),
    commitDetails: (cwd: string, ref: string): Promise<CommitDetails | null> =>
      invoke('git:commitDetails', cwd, ref),
    commitPatch: (cwd: string, ref: string): Promise<string> => invoke('git:commitPatch', cwd, ref),

    remoteUrl: (cwd: string, remoteName?: string): Promise<string | null> =>
      invoke('git:remoteUrl', cwd, remoteName),

    getIdentity: (cwd: string): Promise<{ local: GitIdentity; global: GitIdentity }> =>
      invoke('git:getIdentity', cwd),
    setIdentity: (cwd: string, scope: 'local' | 'global', values: { name?: string; email?: string }): Promise<void> =>
      invoke('git:setIdentity', cwd, scope, values),

    listFiles: (cwd: string, pattern?: string): Promise<string[]> =>
      invoke('git:listFiles', cwd, pattern),
    readFileForAgent: (cwd: string, path: string): Promise<string> =>
      invoke('git:readFileForAgent', cwd, path),

    fetch: (cwd: string): Promise<void> => invoke('git:fetch', cwd),
    fetchDryRun: (cwd: string): Promise<GitResult> => invoke('git:fetchDryRun', cwd),
    pull: (cwd: string): Promise<GitResult> => invoke('git:pull', cwd),
    push: (cwd: string, branch: string, setUpstream: boolean): Promise<void> =>
      invoke('git:push', cwd, branch, setUpstream),
    forcePush: (cwd: string): Promise<void> => invoke('git:forcePush', cwd),
    stashPatch: (cwd: string, ref: string): Promise<string> => invoke('git:stashPatch', cwd, ref),
    revertCommit: (hash: string, cwd: string): Promise<GitResult> => invoke('git:revertCommit', hash, cwd),
    remoteBranches: (cwd: string): Promise<string[]> => invoke('git:remoteBranches', cwd),
    checkoutRemoteBranch: (remoteBranch: string, cwd: string): Promise<SwitchBranchResult> =>
      invoke('git:checkoutRemoteBranch', remoteBranch, cwd),
    deleteBranch: (name: string, cwd: string, force: boolean): Promise<void> =>
      invoke('git:deleteBranch', name, cwd, force),
    renameBranch: (oldName: string, newName: string, cwd: string): Promise<void> =>
      invoke('git:renameBranch', oldName, newName, cwd),
    deleteRemoteBranch: (name: string, cwd: string): Promise<void> => invoke('git:deleteRemoteBranch', name, cwd),

    repoUpdateStatus: (cwd: string, options?: { fetch?: boolean }): Promise<RepoUpdateStatus> =>
      invoke('git:repoUpdateStatus', cwd, options),
    updateToDefaultBranch: (cwd: string): Promise<RepoUpdateResult> =>
      invoke('git:updateToDefaultBranch', cwd),

    merge: (branchName: string, cwd: string): Promise<GitResult> => invoke('git:merge', branchName, cwd),
    mergeAbort: (cwd: string): Promise<void> => invoke('git:mergeAbort', cwd),

    stashList: (cwd: string): Promise<StashEntry[]> => invoke('git:stashList', cwd),
    stashPush: (cwd: string, message: string): Promise<void> => invoke('git:stashPush', cwd, message),
    stashApply: (cwd: string, ref: string): Promise<void> => invoke('git:stashApply', cwd, ref),
    stashPop: (cwd: string, ref: string): Promise<void> => invoke('git:stashPop', cwd, ref),
    stashDrop: (cwd: string, ref: string): Promise<void> => invoke('git:stashDrop', cwd, ref),
    addToGitIgnore: (
      cwd: string,
      patterns: string[]
    ): Promise<{ success: boolean; message: string }> => invoke('git:addToGitIgnore', cwd, patterns),
    stopTracking: (
      cwd: string,
      paths: string[]
    ): Promise<{ success: boolean; message: string }> => invoke('git:stopTracking', cwd, paths),
    locateFileInHistory: (cwd: string, path: string): Promise<FileHistoryLocation> =>
      invoke('git:locateFileInHistory', cwd, path),
    isPathIgnored: (cwd: string, path: string): Promise<boolean> => invoke('git:isPathIgnored', cwd, path),
    isCommitPublished: (cwd: string, ref?: string): Promise<boolean> => invoke('git:isCommitPublished', cwd, ref),
    undoUnpublishedCommit: (cwd: string, expectedHash: string): Promise<void> =>
      invoke('git:undoUnpublishedCommit', cwd, expectedHash)
  },
  fs: {
    readRepoFile: (cwd: string, path: string): Promise<string> =>
      invoke('fs:readRepoFile', cwd, path),
    writeRepoFile: (cwd: string, path: string, content: string): Promise<void> =>
      invoke('fs:writeRepoFile', cwd, path, content),
    resolveRepoPath: (cwd: string, path: string): Promise<string> =>
      invoke('fs:resolveRepoPath', cwd, path),
    pathExists: (fullPath: string): Promise<boolean> => invoke('fs:pathExists', fullPath)
  },
  shell: {
    showItemInFolder: (cwd: string, relativePath: string): Promise<void> =>
      invoke('shell:showItemInFolder', cwd, relativePath),
    openPath: (cwd: string, relativePath: string): Promise<string> =>
      invoke('shell:openPath', cwd, relativePath)
  },
  dialogs: {
    openDirectory: (): Promise<string | null> => invoke('dialog:openDirectory')
  },
  // Only AI provider keys are reachable from here; main rejects any other key.
  // GitHub tokens are deliberately absent — see the `github` namespace below.
  secrets: {
    save: (key: string, value: string): Promise<void> => invoke('secrets:save', key, value),
    get: (key: string): Promise<string | null> => invoke('secrets:get', key),
    delete: (key: string): Promise<void> => invoke('secrets:delete', key)
  },
  // Every call is proxied through main, which holds the token. Nothing in this
  // namespace hands an access token back to the renderer.
  github: {
    getOAuthAppInfo: (): Promise<OAuthAppInfo> => invoke('github:getOAuthAppInfo'),
    deviceFlowStart: (host: string): Promise<DeviceFlowStart> => invoke('github:deviceFlowStart', host),
    deviceFlowPoll: (flowId: string): Promise<DeviceFlowPollResult> =>
      invoke('github:deviceFlowPoll', flowId),
    deviceFlowCancel: (flowId: string): Promise<void> => invoke('github:deviceFlowCancel', flowId),

    getSession: (host: string): Promise<GitHubUser | null> => invoke('github:getSession', host),
    loginWithPat: (host: string, token: string): Promise<GitHubUser> =>
      invoke('github:loginWithPat', host, token),
    logout: (host: string): Promise<void> => invoke('github:logout', host),

    listUserRepos: (host: string): Promise<GitHubRepoSummary[]> =>
      invoke('github:listUserRepos', host),
    listUserReposWithToken: (host: string, token: string): Promise<GitHubRepoSummary[]> =>
      invoke('github:listUserReposWithToken', host, token),

    listPullRequests: (host: string, owner: string, repo: string, state: PullRequestState): Promise<PullRequest[]> =>
      invoke('github:listPullRequests', host, owner, repo, state),
    getPullRequest: (host: string, owner: string, repo: string, number: number): Promise<PullRequest> =>
      invoke('github:getPullRequest', host, owner, repo, number),
    createPullRequest: (
      host: string,
      owner: string,
      repo: string,
      input: CreatePullRequestInput
    ): Promise<PullRequest> => invoke('github:createPullRequest', host, owner, repo, input),
    listPullRequestFiles: (host: string, owner: string, repo: string, number: number): Promise<PullRequestFile[]> =>
      invoke('github:listPullRequestFiles', host, owner, repo, number),
    listPullRequestComments: (
      host: string,
      owner: string,
      repo: string,
      number: number
    ): Promise<PullRequestComment[]> =>
      invoke('github:listPullRequestComments', host, owner, repo, number),
    addPullRequestComment: (host: string, owner: string, repo: string, number: number, body: string): Promise<PullRequestComment> =>
      invoke('github:addPullRequestComment', host, owner, repo, number, body),
    mergePullRequest: (
      host: string,
      owner: string,
      repo: string,
      number: number,
      method: MergeMethod,
      title?: string,
      message?: string
    ): Promise<void> =>
      invoke('github:mergePullRequest', host, owner, repo, number, method, title, message),
    setPullRequestState: (
      host: string,
      owner: string,
      repo: string,
      number: number,
      state: 'open' | 'closed'
    ): Promise<void> => invoke('github:setPullRequestState', host, owner, repo, number, state),
    addPullRequestReviewComment: (
      host: string,
      owner: string,
      repo: string,
      number: number,
      body: string,
      commitId: string,
      path: string,
      line: number
    ): Promise<PullRequestComment> =>
      invoke('github:addPullRequestReviewComment', host, owner, repo, number, body, commitId, path, line),
    submitPullRequestReview: (
      host: string,
      owner: string,
      repo: string,
      number: number,
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
      body: string,
      commitId: string,
      comments: { path: string; body: string; line: number }[] = []
    ): Promise<void> =>
      invoke('github:submitPullRequestReview', host, owner, repo, number, event, body, commitId, comments)
  },
  recentRepos: {
    list: (): Promise<RecentReposData> => invoke('recentRepos:list'),
    add: (path: string): Promise<RecentReposData> => invoke('recentRepos:add', path),
    addMany: (paths: string[]): Promise<RecentReposData> => invoke('recentRepos:addMany', paths),
    remove: (path: string): Promise<RecentReposData> => invoke('recentRepos:remove', path),

    createGroup: (name: string): Promise<RecentReposData> =>
      invoke('recentRepos:createGroup', name),
    renameGroup: (id: string, name: string): Promise<RecentReposData> =>
      invoke('recentRepos:renameGroup', id, name),
    deleteGroup: (id: string): Promise<RecentReposData> =>
      invoke('recentRepos:deleteGroup', id),
    setRepoGroup: (path: string, groupId: string | null): Promise<RecentReposData> =>
      invoke('recentRepos:setRepoGroup', path, groupId),
    setGroupCollapsed: (id: string, collapsed: boolean): Promise<RecentReposData> =>
      invoke('recentRepos:setGroupCollapsed', id, collapsed)
  },
  settings: {
    get: (): Promise<AppSettings> => invoke('settings:get'),
    setLastRepositoryPath: (path: string | null): Promise<void> =>
      invoke('settings:setLastRepositoryPath', path),
    setAppSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
      invoke('settings:setAppSettings', partial),
    getSystemLocale: (): Promise<Locale> => invoke('settings:getSystemLocale')
  },
  ai: {
    getSettings: (): Promise<AiSettings> => invoke('ai:getSettings'),
    setSettings: (settings: AiSettings): Promise<void> => invoke('ai:setSettings', settings),
    sendChatRequest: (
      config: ResolvedAiConfig,
      apiKey: string,
      messages: ChatMessage[],
      tools?: ToolDefinition[],
      requestId?: string
    ): Promise<ChatResponse> => invoke('ai:sendChatRequest', config, apiKey, messages, tools, requestId),
    listModels: (config: ResolvedAiConfig, apiKey: string): Promise<string[]> =>
      invoke('ai:listModels', config, apiKey),
    abortChatRequest: (requestId: string): Promise<void> => invoke('ai:abortChatRequest', requestId),
    sendToolAwareChatRequest: (
      config: ResolvedAiConfig,
      apiKey: string,
      messages: ChatMessage[],
      tools?: ToolDefinition[],
      requestId?: string
    ): Promise<ChatRequestOutcome> =>
      invoke('ai:sendToolAwareChatRequest', config, apiKey, messages, tools, requestId)
  }
}

contextBridge.exposeInMainWorld('api', api)
