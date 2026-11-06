import { ipcMain, app, BrowserWindow, Notification, type WebContents, type WebFrameMain } from 'electron'
import {
  abortMerge,
  applyPatch,
  applyStash,
  cancelClone,
  cloneRepository,
  commit,
  commitAmend,
  createBranch,
  checkoutRemoteBranch,
  deleteBranch,
  deleteIntegratedBranches,
  deleteRemoteBranch,
  forcePushBranch,
  getRemoteBranches,
  renameBranch,
  getStashPatch,
  revertCommit,
  discardFiles,
  dropStash,
  fetchDryRun,
  fetchRemote,
  getBranchDiff,
  getBranches,
  getBranchIntegration,
  getBranchDeleteCheck,
  deleteCheckedBranch,
  getCommitDetails,
  getCommitDiff,
  getCommitFiles,
  getCommitPatch,
  getDiff,
  getGitIdentity,
  getLog,
  getRemoteUrl,
  getRepoUpdateStatus,
  getStagedDiffAll,
  listRepoFiles,
  readFileForAgent,
  getStatus,
  getUnstagedDiffAll,
  initRepository,
  isGitRepository,
  listStashes,
  mergeBranch,
  popStash,
  pull,
  pushBranch,
  pushStash,
  readRepoFile,
  resetSoftHead,
  setGitIdentity,
  stageFiles,
  switchBranch,
  unstageFiles,
  updateToDefaultBranch,
  writeRepoFile,
  addToGitIgnore,
  stopTracking,
  locateFileInHistory,
  isCommitPublished,
  undoUnpublishedCommit,
  isPathIgnored,
  resolveRepoPath,
  getGraphLog,
  getLogWithStats,
  getCommitFileStats,
  getCommitRange,
  getRefsContaining,
  getFileBlame,
  getFileTimeline,
  listTags,
  createTag,
  pushTag,
  getLatestTag,
  getLocalRebaseInfo,
  runLocalRebase,
  getWorkingTreeStats,
  getBranchOverview,
  getRepoChurn
} from './gitProcess'
import { openPath, pathExists, showItemInFolder } from './shell'
import { saveSecret, getSecret, deleteSecret } from './credentials'
import { startDeviceFlow, pollDeviceFlow, cancelDeviceFlow, getOAuthAppInfo } from './githubDeviceFlow'
import * as githubApi from './githubApi'
import { isAppOrigin } from './security'
import type { CreatePullRequestInput, MergeMethod, PublishRepositoryInput, PullRequestState, RepositoryRole } from '../shared/github'
import { openDirectoryDialog } from './dialogs'
import {
  addRecentRepositories,
  addRecentRepository,
  createRepoGroup,
  deleteRepoGroup,
  listRecentRepositories,
  removeRecentRepository,
  renameRepoGroup,
  setRepoGroup,
  setRepoGroupCollapsed
} from './recentRepositories'
import { scanForRepositories } from './repoScan'
import { planReorganization, reorganizeRepositories } from './repoOrganize'
import type { RepoMove } from '../shared/repoOrganize'
import { assertNoBlockedSensitive, scanHistory, scanSensitive, type SensitiveScanScope } from './sensitiveScan'
import { createInitialCommit, publishRepository } from './publishRepository'
import { assertAgentMayRead, redactForAi } from './aiRedaction'
import { sensitiveFileKind } from '../shared/sensitiveFiles'
import { getAiSettings, getSettings, setAiSettings, setAppSettings, setLastRepositoryPath } from './settings'
import { applyLanguagePreference, systemLocale } from './language'
import { sendChatRequest, sendToolAwareChatRequest, listModels, abortChatRequest } from './aiProxy'
import type { AiSettings, ResolvedAiConfig } from '../shared/ai'
import type { AiRequestOptions, ChatMessage, ToolDefinition } from '../shared/aiChat'
import type { RebaseStep } from '../shared/git'
import { withProjectCoAuthor, type AppSettings } from '../shared/settings'
import { checkForUpdates, getUpdateStatus, quitAndInstall } from './updater'

// Secrets the renderer may still read back: AI provider keys, which the
// settings form shows so the user can edit them. Deliberately a prefix
// allowlist and not a free-form key — `GitWeb/GitHub/<host>` must stay
// unreachable from the renderer, otherwise moving the access token into main
// would buy nothing.
const RENDERER_SECRET_PREFIX = 'GitWeb/AI/'

function assertRendererSecretKey(key: string): void {
  if (!key.startsWith(RENDERER_SECRET_PREFIX)) {
    throw new Error(`Chave de segredo não permitida: "${key}".`)
  }
}

function isTrustedFrame(frame: WebFrameMain | null): boolean {
  return frame !== null && isAppOrigin(frame.url)
}

/**
 * Wrapper around ipcMain.handle that refuses calls from any frame that is not
 * our own UI. Every channel below goes through it — a handler registered
 * directly on ipcMain would silently skip the check.
 */
function handle(channel: string, listener: Parameters<typeof ipcMain.handle>[1]): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedFrame(event.senderFrame)) {
      throw new Error(`IPC "${channel}" recusado: origem não confiável.`)
    }
    return listener(event, ...args)
  })
}

// Held until dismissed: Electron drops the click handler of a notification that gets garbage collected.
const liveNotifications = new Set<Notification>()

/** Lives here because the session's permission handler refuses the renderer's own Notification API. */
function showDesktopNotification(sender: WebContents, title: string, body: string): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({ title, body })
  liveNotifications.add(notification)
  notification.on('close', () => liveNotifications.delete(notification))
  notification.on('failed', (_event, error) => {
    liveNotifications.delete(notification)
    console.error('Desktop notification failed:', error)
  })
  notification.on('click', () => {
    liveNotifications.delete(notification)
    if (sender.isDestroyed()) return
    const window = BrowserWindow.fromWebContents(sender)
    if (window?.isMinimized()) window.restore()
    window?.show()
    window?.focus()
    sender.send('app:notification-clicked')
  })
  notification.show()
}

export function registerIpcHandlers(): void {
  handle('app:showNotification', (event, title: string, body: string) => showDesktopNotification(event.sender, title, body))
  handle('app:getVersion', () => app.getVersion())
  handle('app:getUpdateStatus', () => getUpdateStatus())
  handle('app:checkForUpdates', () => checkForUpdates())
  handle('app:quitAndInstall', () => {
    quitAndInstall()
  })
  // Snapshot of a region of the caller's own page (CSS px), for visual
  // effects like the chat's "turn to dust" on clear. Returns a PNG data URL.
  handle('app:capturePage', async (event, rect: { x: number; y: number; width: number; height: number }) => {
    const zoom = event.sender.getZoomFactor()
    const image = await event.sender.capturePage({
      x: Math.round(rect.x * zoom),
      y: Math.round(rect.y * zoom),
      width: Math.max(1, Math.round(rect.width * zoom)),
      height: Math.max(1, Math.round(rect.height * zoom))
    })
    return image.toDataURL()
  })

  handle('git:isRepository', (_e, cwd: string) => isGitRepository(cwd))
  handle('git:scanForRepositories', (_e, rootPath: string) => scanForRepositories(rootPath))
  handle('git:init', (_e, cwd: string) => initRepository(cwd))
  handle('git:initialCommit', (_e, cwd: string) => createInitialCommit(cwd))
  // Uses the event so progress goes only to the frame that asked for the clone.
  handle('git:clone', (event, url: string, destination: string) =>
    cloneRepository(url, destination, (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('git:clone-progress', progress)
    })
  )
  handle('git:cancelClone', (_e, destination: string) => cancelClone(destination))
  handle('git:status', (_e, cwd: string) => getStatus(cwd))
  handle('git:stage', (_e, paths: string[], cwd: string) => stageFiles(paths, cwd))
  handle('git:unstage', (_e, paths: string[], cwd: string) => unstageFiles(paths, cwd))
  handle('git:discard', async (_e, paths: string[], cwd: string) => {
    const status = await getStatus(cwd)
    const statusByPath = new Map(status.entries.map((entry) => [entry.path, entry]))
    return discardFiles(paths, cwd, statusByPath)
  })
  handle('git:diff', (_e, path: string, cwd: string, staged: boolean) => getDiff(path, cwd, staged))
  handle('git:diffStagedAll', (_e, cwd: string) => getStagedDiffAll(cwd))
  handle('git:diffUnstagedAll', (_e, cwd: string) => getUnstagedDiffAll(cwd))
  handle('git:branchDiff', (_e, cwd: string, base: string, head: string) => getBranchDiff(cwd, base, head))
  // Applied here rather than in the renderer so every commit path — the
  // Changes view and the AI agent alike — honors the setting. A merge being
  // concluded (empty summary) keeps git's prepared message untouched.
  handle('git:commit', async (_e, summary: string, description: string, cwd: string) => {
    await assertNoBlockedSensitive(cwd)
    const credit = summary.trim() && (await getSettings()).coAuthorProject
    return commit(summary, credit ? withProjectCoAuthor(description) : description, cwd)
  })
  handle('git:applyPatch', (_e, cwd: string, patch: string, cached: boolean, reverse: boolean) =>
    applyPatch(cwd, patch, { cached, reverse })
  )
  handle('git:resetSoftHead', (_e, cwd: string) => resetSoftHead(cwd))
  handle('git:commitAmend', async (_e, cwd: string, summary?: string, description?: string) => {
    await assertNoBlockedSensitive(cwd)
    return commitAmend(cwd, summary, description)
  })
  handle('git:scanSensitiveHistory', (_e, cwd: string) => scanHistory(cwd))
  handle('git:scanSensitive', (_e, cwd: string, scope: SensitiveScanScope) =>
    scanSensitive(cwd, scope === 'all' ? 'all' : 'staged')
  )
  handle('git:branches', (_e, cwd: string) => getBranches(cwd))
  handle('git:createBranch', (_e, name: string, cwd: string, checkout: boolean, from?: string) =>
    createBranch(name, cwd, checkout, from)
  )
  handle('git:switchBranch', (_e, name: string, cwd: string) => switchBranch(name, cwd))
  handle('git:remoteBranches', (_e, cwd: string) => getRemoteBranches(cwd))
  handle('git:branchIntegration', (_e, cwd: string, base?: string) => getBranchIntegration(cwd, base))
  handle('git:deleteIntegratedBranches', (_e, cwd: string, names: string[], base?: string) =>
    deleteIntegratedBranches(cwd, names, base)
  )
  handle('git:checkoutRemoteBranch', (_e, remoteBranch: string, cwd: string) => checkoutRemoteBranch(remoteBranch, cwd))
  handle('git:deleteBranch', (_e, name: string, cwd: string, force: boolean) => deleteBranch(name, cwd, force))
  handle('git:branchDeleteCheck', (_e, cwd: string, name: string) => getBranchDeleteCheck(cwd, name))
  handle('git:deleteCheckedBranch', (_e, cwd: string, name: string, expectedTip: string) =>
    deleteCheckedBranch(cwd, name, expectedTip)
  )
  handle('git:renameBranch', (_e, oldName: string, newName: string, cwd: string) => renameBranch(oldName, newName, cwd))
  handle('git:deleteRemoteBranch', (_e, name: string, cwd: string) => deleteRemoteBranch(name, cwd))
  handle('git:log', (_e, cwd: string, limit?: number, path?: string) => getLog(cwd, limit, path))
  handle('git:commitFiles', (_e, hash: string, cwd: string) => getCommitFiles(hash, cwd))
  handle('git:commitDiff', (_e, hash: string, path: string, cwd: string) => getCommitDiff(hash, path, cwd))
  handle('git:commitDetails', (_e, cwd: string, ref: string) => getCommitDetails(cwd, ref))
  handle('git:commitPatch', (_e, cwd: string, ref: string) => getCommitPatch(cwd, ref))
  handle('git:graphLog', (_e, cwd: string, limit?: number, path?: string, allBranches?: boolean) =>
    getGraphLog(cwd, limit, path, allBranches)
  )
  handle('git:logWithStats', (_e, cwd: string, limit?: number) => getLogWithStats(cwd, limit))
  handle('git:commitFileStats', (_e, cwd: string, ref: string) => getCommitFileStats(cwd, ref))
  handle('git:commitRange', (_e, cwd: string, head: string, base: string | null, limit?: number) =>
    getCommitRange(cwd, head, base, limit)
  )
  handle('git:refsContaining', (_e, cwd: string, ref: string) => getRefsContaining(cwd, ref))
  handle('git:fileBlame', (_e, cwd: string, path: string, rev?: string) => getFileBlame(cwd, path, rev))
  handle('git:fileTimeline', (_e, cwd: string, path: string, limit?: number) => getFileTimeline(cwd, path, limit))
  handle('git:listTags', (_e, cwd: string) => listTags(cwd))
  handle('git:createTag', (_e, cwd: string, name: string, ref?: string, message?: string) => createTag(cwd, name, ref, message))
  handle('git:pushTag', (_e, cwd: string, name: string) => pushTag(cwd, name))
  handle('git:latestTag', (_e, cwd: string, ref?: string, strict?: boolean) => getLatestTag(cwd, ref, strict))
  handle('git:localRebaseInfo', (_e, cwd: string) => getLocalRebaseInfo(cwd))
  handle('git:workingTreeStats', (_e, cwd: string) => getWorkingTreeStats(cwd))
  handle('git:branchOverview', (_e, cwd: string) => getBranchOverview(cwd))
  handle('git:repoChurn', (_e, cwd: string, sinceDays: number | null, limit?: number) => getRepoChurn(cwd, sinceDays, limit))
  handle('git:runLocalRebase', (_e, cwd: string, steps: RebaseStep[], expectedHead: string) =>
    runLocalRebase(cwd, steps, expectedHead)
  )

  handle('git:remoteUrl', (_e, cwd: string, remoteName?: string) => getRemoteUrl(cwd, remoteName))

  handle('git:getIdentity', (_e, cwd: string) => getGitIdentity(cwd))
  handle('git:setIdentity', (_e, cwd: string, scope: 'local' | 'global', values: { name?: string; email?: string }) =>
    setGitIdentity(cwd, scope, values)
  )

  handle('git:listFiles', (_e, cwd: string, pattern?: string) => listRepoFiles(cwd, pattern))
  handle('git:readFileForAgent', async (_e, cwd: string, path: string) => {
    await assertAgentMayRead(path, sensitiveFileKind(path) !== null)
    return readFileForAgent(cwd, path)
  })

  handle('git:fetch', (_e, cwd: string) => fetchRemote(cwd))
  handle('git:fetchDryRun', (_e, cwd: string) => fetchDryRun(cwd))
  handle('git:pull', (_e, cwd: string) => pull(cwd))
  handle('git:push', (_e, cwd: string, branch: string, setUpstream: boolean) =>
    pushBranch(cwd, branch, setUpstream)
  )
  handle('git:forcePush', (_e, cwd: string) => forcePushBranch(cwd))

  handle('git:repoUpdateStatus', (_e, cwd: string, options?: { fetch?: boolean }) =>
    getRepoUpdateStatus(cwd, options)
  )
  handle('git:updateToDefaultBranch', (_e, cwd: string) => updateToDefaultBranch(cwd))

  handle('git:merge', (_e, branchName: string, cwd: string) => mergeBranch(branchName, cwd))
  handle('git:revertCommit', (_e, hash: string, cwd: string) => revertCommit(hash, cwd))
  handle('git:mergeAbort', (_e, cwd: string) => abortMerge(cwd))

  handle('git:stashList', (_e, cwd: string) => listStashes(cwd))
  handle('git:stashPush', (_e, cwd: string, message: string) => pushStash(cwd, message))
  handle('git:stashPatch', (_e, cwd: string, ref: string) => getStashPatch(cwd, ref))
  handle('git:stashApply', (_e, cwd: string, ref: string) => applyStash(cwd, ref))
  handle('git:stashPop', (_e, cwd: string, ref: string) => popStash(cwd, ref))
  handle('git:stashDrop', (_e, cwd: string, ref: string) => dropStash(cwd, ref))

  handle('fs:readRepoFile', (_e, cwd: string, path: string) => readRepoFile(cwd, path))
  handle('fs:writeRepoFile', (_e, cwd: string, path: string, content: string) =>
    writeRepoFile(cwd, path, content)
  )
  handle('fs:resolveRepoPath', (_e, cwd: string, path: string) => resolveRepoPath(cwd, path))
  handle('fs:pathExists', (_e, fullPath: string) => pathExists(fullPath))

  handle('git:addToGitIgnore', (_e, cwd: string, patterns: string[]) => addToGitIgnore(cwd, patterns))
  handle('git:stopTracking', (_e, cwd: string, paths: string[]) => stopTracking(cwd, paths))
  handle('git:locateFileInHistory', (_e, cwd: string, path: string) => locateFileInHistory(cwd, path))
  handle('git:isPathIgnored', (_e, cwd: string, path: string) => isPathIgnored(cwd, path))
  handle('git:isCommitPublished', (_e, cwd: string, ref?: string) => isCommitPublished(cwd, ref))
  handle('git:undoUnpublishedCommit', (_e, cwd: string, expectedHash: string) =>
    undoUnpublishedCommit(cwd, expectedHash)
  )

  handle('shell:showItemInFolder', (_e, cwd: string, relativePath: string) =>
    showItemInFolder(cwd, relativePath)
  )
  handle('shell:openPath', (_e, cwd: string, relativePath: string) => openPath(cwd, relativePath))

  handle('dialog:openDirectory', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return openDirectoryDialog(window)
  })

  handle('secrets:save', (_e, key: string, value: string) => {
    assertRendererSecretKey(key)
    return saveSecret(key, value)
  })
  handle('secrets:get', (_e, key: string) => {
    assertRendererSecretKey(key)
    return getSecret(key)
  })
  handle('secrets:delete', (_e, key: string) => {
    assertRendererSecretKey(key)
    return deleteSecret(key)
  })

  // GitHub: the renderer names a host and gets back mapped objects. No channel
  // here accepts or returns an access token, except `github:loginWithPat`,
  // which is write-only (the user typed it, main stores it, it never comes
  // back out).
  handle('github:getOAuthAppInfo', () => getOAuthAppInfo())
  handle('github:deviceFlowStart', (_e, host: string) => startDeviceFlow(host))
  handle('github:deviceFlowPoll', (_e, flowId: string) => pollDeviceFlow(flowId))
  handle('github:deviceFlowCancel', (_e, flowId: string) => cancelDeviceFlow(flowId))

  handle('github:getSession', (_e, host: string) => githubApi.getSession(host))
  handle('github:loginWithPat', (_e, host: string, token: string) => githubApi.saveToken(host, token))
  handle('github:logout', (_e, host: string) => githubApi.logout(host))

  handle('github:listUserRepos', (_e, host: string) => githubApi.listUserRepos(host))
  handle('github:listRepositoryOwners', (_e, host: string) => githubApi.listRepositoryOwners(host))
  handle('github:publishRepository', (_e, cwd: string, input: PublishRepositoryInput) => publishRepository(cwd, input))
  handle('github:listUserReposWithToken', (_e, host: string, token: string) =>
    githubApi.listUserReposWithToken(host, token)
  )

  handle('github:getRepositoryCollaborators', (_e, host: string, owner: string, repo: string) =>
    githubApi.getRepositoryCollaborators(host, owner, repo)
  )
  handle('github:getReceivedInvitations', (_e, host: string) => githubApi.getReceivedInvitations(host))
  handle('github:acceptInvitation', (_e, host: string, invitationId: number) => githubApi.acceptInvitation(host, invitationId))
  handle('github:declineInvitation', (_e, host: string, invitationId: number) => githubApi.declineInvitation(host, invitationId))
  handle('github:getNotifications', (_e, host: string) => githubApi.getNotifications(host))
  handle('github:markNotificationRead', (_e, host: string, threadId: string) => githubApi.markNotificationRead(host, threadId))
  handle('github:markAllNotificationsRead', (_e, host: string, lastReadAt: string) => githubApi.markAllNotificationsRead(host, lastReadAt))
  handle('github:getRecentStars', (_e, host: string) => githubApi.getRecentStars(host))
  handle('github:searchUsers', (_e, host: string, query: string) => githubApi.searchUsers(host, query))
  handle('github:addCollaborator', (_e, host: string, owner: string, repo: string, username: string, role?: RepositoryRole) =>
    githubApi.addCollaborator(host, owner, repo, username, role)
  )
  handle('github:removeCollaborator', (_e, host: string, owner: string, repo: string, username: string) =>
    githubApi.removeCollaborator(host, owner, repo, username)
  )
  handle('github:cancelRepositoryInvitation', (_e, host: string, owner: string, repo: string, invitationId: number) =>
    githubApi.cancelRepositoryInvitation(host, owner, repo, invitationId)
  )

  handle('github:listPullRequests', (_e, host: string, owner: string, repo: string, state: PullRequestState) =>
    githubApi.listPullRequests(host, owner, repo, state)
  )
  handle('github:getPullRequest', (_e, host: string, owner: string, repo: string, number: number) =>
    githubApi.getPullRequest(host, owner, repo, number)
  )
  handle('github:getBranchRules', (_e, host: string, owner: string, repo: string, branch: string) =>
    githubApi.getBranchRules(host, owner, repo, branch)
  )
  handle('github:getPullRequestStatus', (_e, host: string, owner: string, repo: string, number: number) =>
    githubApi.getPullRequestStatus(host, owner, repo, number)
  )
  handle('github:createPullRequest', (_e, host: string, owner: string, repo: string, input: CreatePullRequestInput) =>
    githubApi.createPullRequest(host, owner, repo, input)
  )
  handle('github:listPullRequestFiles', (_e, host: string, owner: string, repo: string, number: number) =>
    githubApi.listPullRequestFiles(host, owner, repo, number)
  )
  handle('github:listPullRequestComments', (_e, host: string, owner: string, repo: string, number: number) =>
    githubApi.listPullRequestComments(host, owner, repo, number)
  )
  handle('github:addPullRequestComment', (_e, host: string, owner: string, repo: string, number: number, body: string) =>
    githubApi.addPullRequestComment(host, owner, repo, number, body)
  )
  handle(
    'github:mergePullRequest',
    (_e, host: string, owner: string, repo: string, number: number, method: MergeMethod, title?: string, message?: string) =>
      githubApi.mergePullRequest(host, owner, repo, number, method, title, message)
  )
  handle('github:setPullRequestState', (_e, host: string, owner: string, repo: string, number: number, state: 'open' | 'closed') =>
    githubApi.setPullRequestState(host, owner, repo, number, state)
  )
  handle(
    'github:addPullRequestReviewComment',
    (
      _e,
      host: string,
      owner: string,
      repo: string,
      number: number,
      body: string,
      commitId: string,
      path: string,
      line: number
    ) => githubApi.addPullRequestReviewComment(host, owner, repo, number, body, commitId, path, line)
  )
  handle(
    'github:submitPullRequestReview',
    (
      _e,
      host: string,
      owner: string,
      repo: string,
      number: number,
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
      body: string,
      commitId: string,
      comments: { path: string; body: string; line: number }[]
    ) => githubApi.submitPullRequestReview(host, owner, repo, number, event, body, commitId, comments)
  )

  handle('repoOrganize:plan', (_e, rootPath: string) => planReorganization(rootPath))
  handle('repoOrganize:apply', (_e, rootPath: string, confirmedMoves: RepoMove[]) =>
    reorganizeRepositories(rootPath, confirmedMoves)
  )
  handle('recentRepos:list', () => listRecentRepositories())
  handle('recentRepos:add', (_e, path: string) => addRecentRepository(path))
  handle('recentRepos:addMany', (_e, paths: string[]) => addRecentRepositories(paths))
  handle('recentRepos:remove', (_e, path: string) => removeRecentRepository(path))

  handle('recentRepos:createGroup', (_e, name: string) => createRepoGroup(name))
  handle('recentRepos:renameGroup', (_e, id: string, name: string) => renameRepoGroup(id, name))
  handle('recentRepos:deleteGroup', (_e, id: string) => deleteRepoGroup(id))
  handle('recentRepos:setRepoGroup', (_e, path: string, groupId: string | null) =>
    setRepoGroup(path, groupId)
  )
  handle('recentRepos:setGroupCollapsed', (_e, id: string, collapsed: boolean) =>
    setRepoGroupCollapsed(id, collapsed)
  )

  handle('settings:get', () => getSettings())
  handle('settings:setLastRepositoryPath', (_e, path: string | null) => setLastRepositoryPath(path))
  handle('settings:setAppSettings', async (_e, partial: Partial<AppSettings>) => {
    const next = await setAppSettings(partial)
    if (partial.language) applyLanguagePreference(next.language)
    return next
  })
  handle('settings:getSystemLocale', () => systemLocale())

  handle('ai:getSettings', () => getAiSettings())
  handle('ai:setSettings', (_e, settings: AiSettings) => setAiSettings(settings))

  // Run from the main process (Chromium net.fetch, no CORS) — a browser
  // fetch() from the renderer fails against local OpenAI-compatible servers
  // that don't answer CORS preflight requests correctly, which is common.
  handle(
    'ai:sendChatRequest',
    async (
      _e,
      config: ResolvedAiConfig,
      apiKey: string,
      messages: ChatMessage[],
      tools?: ToolDefinition[],
      requestId?: string,
      options?: AiRequestOptions
    ) =>
      // keepContent: flows whose answer is written back into the file
      // (conflict resolution, proposed fix) — a masked line would end up in it.
      sendChatRequest(config, apiKey, options?.keepContent ? messages : await redactForAi(messages), tools, requestId)
  )
  handle('ai:listModels', (_e, config: ResolvedAiConfig, apiKey: string) => listModels(config, apiKey))
  handle('ai:abortChatRequest', (_e, requestId: string) => abortChatRequest(requestId))

  // Structured outcome (never rejects) so the renderer can inspect the HTTP
  // status code and decide whether to retry with the textual tool-calling
  // fallback — see shared/aiChat.ts and aiStore.ts.
  handle(
    'ai:sendToolAwareChatRequest',
    async (_e, config: ResolvedAiConfig, apiKey: string, messages: ChatMessage[], tools?: ToolDefinition[], requestId?: string) =>
      sendToolAwareChatRequest(config, apiKey, await redactForAi(messages), tools, requestId)
  )
}
