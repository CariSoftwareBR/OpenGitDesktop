import { create } from 'zustand'
import { isConflicted, isHistoryRewrittenMessage, sameRepoStatus, stashBranchName } from '../../../shared/git'
import type {
  BranchInfo,
  CommitFile,
  GraphCommit,
  RebaseStep,
  RecentReposData,
  RecentRepository,
  RepoGroup,
  RepoStatus,
  RepoUpdateResult,
  RepoUpdateStatus,
  StashEntry,
  StatusEntry
} from '../../../shared/git'
import {
  checkRepoUpdate,
  checkingPlaceholder,
  failedCheck,
  runWithConcurrency,
  scanReposForUpdates
} from '../lib/recentRepoScan'
import { useAppSettingsStore } from './appSettingsStore'
import { getT } from '../lib/i18n'
import { directPushBlock } from '../lib/branchProtection'
import { extractHunkPatch, parseFileDiff } from '../../../shared/patch'

type ViewName = 'changes' | 'history' | 'stash' | 'pullRequests' | 'dashboard' | 'settings' | 'about'

interface SelectedFile {
  path: string
  staged: boolean
  conflicted: boolean
}

interface SelectedCommit {
  hash: string
  files: CommitFile[]
  selectedPath: string | null
}

interface RepoState {
  currentRepoPath: string | null
  recentRepos: RecentRepository[]
  /** User-created folders on the initial screen, in creation order. */
  repoGroups: RepoGroup[]
  recentRepoChecks: Record<string, RepoUpdateStatus>
  /** Paths ticked in the recent-repos list for the batch update. */
  selectedRepoPaths: string[]
  /** Outcome of the last batch update, per repo path. */
  batchUpdateResults: Record<string, RepoUpdateResult>
  isBatchUpdating: boolean
  status: RepoStatus | null
  branches: BranchInfo[]
  /** origin/* branches with no local branch of the same name. */
  remoteBranches: string[]
  /** Set when a push was refused because already-pushed commits were rewritten locally. */
  forcePushPrompt: { branch: string } | null
  /** A switch git refused because it would overwrite these local changes. */
  switchBlocked: { from: string; target: string; remote: boolean; files: string[] } | null
  /** Just switched onto a branch that has changes parked in a stash. */
  branchStashHint: { repoPath: string; branch: string } | null
  /** Every branch, remote and tag with parents and refs — the History graph's input. */
  log: GraphCommit[]
  /** Commit the History view should scroll to and flash (set by the agent's show_in_history). */
  historyFocus: { hash: string; nonce: number } | null
  /** File whose timeline/blame dialog is open, optionally on one line. */
  fileInsight: { path: string; line?: number; nonce: number } | null
  rebasePlannerOpen: boolean
  stashes: StashEntry[]
  view: ViewName
  selectedFile: SelectedFile | null
  diffText: string
  conflictContent: string | null
  selectedCommit: SelectedCommit | null
  commitDiffText: string
  lastFetchedAt: number | null
  logPath: string | null
  isBusy: boolean
  /** A hunk apply is in flight; hunk indexes from the current diff are stale until it settles. */
  isHunkBusy: boolean
  error: string | null
  /**
   * The commit form's text. Kept here rather than in ChangesView so a draft
   * survives switching tabs (the view unmounts); cleared per repository.
   */
  commitSummary: string
  commitDescription: string
  setCommitDraft: (draft: { summary?: string; description?: string }) => void

  loadRecentRepos: () => Promise<void>
  createRepoGroup: (name: string) => Promise<void>
  renameRepoGroup: (id: string, name: string) => Promise<void>
  deleteRepoGroup: (id: string) => Promise<void>
  moveRepoToGroup: (path: string, groupId: string | null) => Promise<void>
  toggleRepoGroupCollapsed: (id: string) => Promise<void>
  scanRecentRepos: () => Promise<void>
  /**
   * Re-measures every recent repo in the background without the "checking"
   * placeholders, writing only what changed — keeps the start screen in step
   * with edits made outside the app. `fetch` also refreshes remote refs.
   */
  refreshRecentRepoChecks: (options?: { fetch?: boolean }) => Promise<void>
  addRecentRepositories: (paths: string[]) => Promise<void>
  removeRecentRepo: (path: string) => Promise<void>
  openRepository: (path: string) => Promise<void>
  createRepository: (path: string) => Promise<void>
  cloneRepository: (url: string, destination: string) => Promise<'ok' | 'cancelled' | 'failed'>
  cancelClone: (destination: string) => Promise<void>
  closeRepository: () => void
  refreshStatus: () => Promise<void>
  refreshBranches: () => Promise<void>
  refreshLog: () => Promise<void>
  refreshStashes: () => Promise<void>
  setView: (view: ViewName) => void
  selectFile: (path: string, staged: boolean) => Promise<void>
  clearSelectedFile: () => void
  stagePaths: (paths: string[]) => Promise<void>
  unstagePaths: (paths: string[]) => Promise<void>
  discardPaths: (paths: string[]) => Promise<void>
  ignorePatterns: (patterns: string[], paths: string[], stopTracking: boolean) => Promise<void>
  commitChanges: (summary: string, description: string) => Promise<void>
  /** With `expectedHash`, refuses unless HEAD is still that commit and unpublished. */
  undoLastCommit: (expectedHash?: string) => Promise<void>
  amendCommit: (summary?: string, description?: string) => Promise<void>
  applyHunk: (path: string, hunkIndex: number, action: 'stage' | 'unstage' | 'discard') => Promise<void>
  fetchRecentRepo: (path: string) => Promise<void>
  pullRecentRepo: (path: string) => Promise<void>
  toggleRepoSelection: (path: string) => void
  selectAllUpdatableRepos: () => void
  clearRepoSelection: () => void
  clearBatchResults: () => void
  updateSelectedRepos: () => Promise<void>
  setLogPath: (path: string | null) => Promise<void>
  /**
   * Resolves true once the branch is checked out. When local changes block it,
   * `interactive` (the default) opens the stash-and-switch dialog; otherwise
   * the refusal lands in `error` — what the AI tool path wants.
   */
  switchBranch: (name: string, options?: { interactive?: boolean }) => Promise<boolean>
  /** Same contract as switchBranch, for an origin/* branch with no local counterpart yet. */
  checkoutRemoteBranch: (remoteBranch: string, options?: { interactive?: boolean }) => Promise<boolean>
  /** Shared body of switchBranch / checkoutRemoteBranch. */
  runCheckout: (target: string, remote: boolean, options?: { interactive?: boolean }) => Promise<boolean>
  /** Stashes everything on the current branch, then retries the blocked switch. */
  stashAndSwitch: () => Promise<void>
  cancelBlockedSwitch: () => void
  restoreBranchStash: () => Promise<void>
  dismissBranchStashHint: () => void
  deleteBranch: (name: string, force: boolean) => Promise<boolean>
  /** Deletes a branch the user confirmed after its delete check; false when it failed. */
  deleteCheckedBranch: (name: string, expectedTip: string) => Promise<boolean>
  renameBranch: (oldName: string, newName: string) => Promise<void>
  forcePush: () => Promise<void>
  dismissForcePush: () => void
  createBranch: (name: string, checkout: boolean, from?: string) => Promise<void>
  mergeBranch: (branchName: string) => Promise<void>
  /** Brings origin/<base> into <head> locally (GitHub's "Update branch"), switching to <head> first. */
  integrateBaseIntoBranch: (head: string, base: string) => Promise<void>
  revertCommit: (hash: string) => Promise<void>
  abortMerge: () => Promise<void>
  sync: () => Promise<void>
  pushStash: (message: string) => Promise<void>
  applyStash: (ref: string) => Promise<void>
  popStash: (ref: string) => Promise<void>
  dropStash: (ref: string) => Promise<void>
  resolveConflict: (path: string, content: string) => Promise<void>
  selectCommit: (hash: string) => Promise<void>
  clearSelectedCommit: () => void
  selectCommitFile: (path: string) => Promise<void>
  /** Opens History on `hash` (loading deeper history if needed); false when the commit is unknown. */
  focusCommitInHistory: (hash: string) => Promise<boolean>
  openFileInsight: (path: string, line?: number) => void
  closeFileInsight: () => void
  setRebasePlannerOpen: (open: boolean) => void
  createTag: (name: string, ref: string, message?: string) => Promise<boolean>
  pushTag: (name: string) => Promise<boolean>
  runLocalRebase: (steps: RebaseStep[], expectedHead: string) => Promise<number | null>
  clearError: () => void
  setError: (message: string | null) => void
}

const GRAPH_LOG_LIMIT = 400
const GRAPH_LOG_DEEP_LIMIT = 3000
let historyFocusNonce = 0

/** The order the initial screen renders cards in: each folder, then the loose ones. */
function displayOrderedRepos(state: Pick<RepoState, 'recentRepos' | 'repoGroups'>): RecentRepository[] {
  const ordered: RecentRepository[] = []
  for (const group of state.repoGroups) {
    for (const repo of state.recentRepos) if (repo.groupId === group.id) ordered.push(repo)
  }
  for (const repo of state.recentRepos) if (repo.groupId === null) ordered.push(repo)
  return ordered
}

/** Both halves of a recentRepos:* response always land together. */
function applyRecentData(
  set: (partial: Partial<RepoState>) => void,
  data: RecentReposData
): void {
  set({ recentRepos: data.repos, repoGroups: data.groups })
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function isHistoryRewritten(err: unknown): boolean {
  return isHistoryRewrittenMessage(describeError(err))
}

// Guards against a stale scan (from a previous mount of the recent-repos
// list) overwriting fresher results if two scans overlap.
let recentRepoScanGeneration = 0

// A check still waiting on its fetch may be stale, so it never feeds a fast-forward.
function isUpdatable(check: RepoUpdateStatus | undefined): boolean {
  return Boolean(check?.canFastForward && !check.refreshing)
}
// A full scan owns the checks while it runs (its `refreshing` results are
// placeholders for the fetch pass); a quiet refresh never overlaps it or itself.
let recentScanInFlight = false
let quietRefreshInFlight = false

function sameCheck(a: RepoUpdateStatus | undefined, b: RepoUpdateStatus): boolean {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b)
}

// Bumped on every open/close so in-flight status/log/diff refreshes for a
// previous repo cannot overwrite the newly selected one.
let repoOpenGeneration = 0
// Status reads no longer wait in main's per-repo git queue, so two of them can
// finish out of order: a background poll started before a stage/commit may
// resolve after the refresh that follows it. Only a response newer than the
// last one applied may land.
let statusRequestSeq = 0
let statusAppliedSeq = 0

export const useRepoStore = create<RepoState>((set, get) => ({
  currentRepoPath: null,
  recentRepos: [],
  repoGroups: [],
  recentRepoChecks: {},
  selectedRepoPaths: [],
  batchUpdateResults: {},
  isBatchUpdating: false,
  status: null,
  branches: [],
  remoteBranches: [],
  forcePushPrompt: null,
  switchBlocked: null,
  branchStashHint: null,
  log: [],
  historyFocus: null,
  fileInsight: null,
  rebasePlannerOpen: false,
  stashes: [],
  view: 'changes',
  selectedFile: null,
  diffText: '',
  conflictContent: null,
  selectedCommit: null,
  commitDiffText: '',
  lastFetchedAt: null,
  logPath: null,
  isBusy: false,
  isHunkBusy: false,
  error: null,
  commitSummary: '',
  commitDescription: '',
  setCommitDraft: (draft) =>
    set((state) => ({
      commitSummary: draft.summary ?? state.commitSummary,
      commitDescription: draft.description ?? state.commitDescription
    })),

  loadRecentRepos: async () => {
    applyRecentData(set, await window.api.recentRepos.list())
    void get().scanRecentRepos()
  },

  // Fire-and-forget background scan — runs a real `git fetch` against every
  // recent repo (throttled) so the commit counts against origin/<default> are
  // current, without blocking the recent-repos list from rendering. The fetch
  // only moves remote-tracking refs; no working tree is touched.
  scanRecentRepos: async () => {
    const generation = ++recentRepoScanGeneration
    // Scanned in the order the cards are actually rendered (folders first, in
    // their own order, then the loose ones) — `recentRepos` alone is the file's
    // order, which stopped matching the screen once folders existed, so results
    // appeared to land at random.
    const repos = displayOrderedRepos(get()).filter((r) => !r.missing)
    if (repos.length === 0) return

    set((state) => {
      const checking: Record<string, RepoUpdateStatus> = { ...state.recentRepoChecks }
      for (const repo of repos) checking[repo.path] = checkingPlaceholder()
      return { recentRepoChecks: checking }
    })

    recentScanInFlight = true
    try {
      await scanReposForUpdates(
        repos.map((r) => r.path),
        (path, check) => {
          if (generation !== recentRepoScanGeneration) return
          set((state) => ({ recentRepoChecks: { ...state.recentRepoChecks, [path]: check } }))
        }
      )
    } finally {
      if (generation === recentRepoScanGeneration) recentScanInFlight = false
    }
  },

  refreshRecentRepoChecks: async (options) => {
    if (recentScanInFlight || quietRefreshInFlight || get().isBatchUpdating || get().currentRepoPath) return
    const repos = displayOrderedRepos(get()).filter((r) => !r.missing)
    if (repos.length === 0) return
    quietRefreshInFlight = true
    const generation = recentRepoScanGeneration
    try {
      await runWithConcurrency(
        repos.map((r) => r.path),
        async (path) => {
          const current = get().recentRepoChecks[path]
          // A row still waiting on its first real answer belongs to the scan.
          if (current?.state === 'checking' || current?.refreshing) return
          // A failed fetch is only re-judged by another fetch; a local pass
          // would flip the row between "error" and stale counts every tick.
          if (current?.state === 'failed' && !options?.fetch) return
          // No remote: a fetch has nothing to bring, the local check is the answer.
          const fetch = Boolean(options?.fetch) && current?.state !== 'noRemote'
          let check: RepoUpdateStatus
          try {
            check = await checkRepoUpdate(path, fetch)
          } catch {
            // A transient failure (file lock, network blip) keeps the last good answer.
            return
          }
          if (generation !== recentRepoScanGeneration || recentScanInFlight) return
          if (sameCheck(get().recentRepoChecks[path], check)) return
          set((state) => ({ recentRepoChecks: { ...state.recentRepoChecks, [path]: check } }))
        },
        options?.fetch ? 4 : 6
      )
    } finally {
      quietRefreshInFlight = false
    }
  },

  createRepoGroup: async (name: string) => {
    try {
      applyRecentData(set, await window.api.recentRepos.createGroup(name))
    } catch (err) {
      set({ error: describeError(err) })
    }
  },

  renameRepoGroup: async (id: string, name: string) => {
    try {
      applyRecentData(set, await window.api.recentRepos.renameGroup(id, name))
    } catch (err) {
      set({ error: describeError(err) })
    }
  },

  deleteRepoGroup: async (id: string) => {
    try {
      applyRecentData(set, await window.api.recentRepos.deleteGroup(id))
    } catch (err) {
      set({ error: describeError(err) })
    }
  },

  moveRepoToGroup: async (path: string, groupId: string | null) => {
    try {
      applyRecentData(set, await window.api.recentRepos.setRepoGroup(path, groupId))
    } catch (err) {
      set({ error: describeError(err) })
    }
  },

  // Pure UI state, but persisted so a collapsed folder stays collapsed across
  // restarts — hence an IPC round-trip rather than local state.
  toggleRepoGroupCollapsed: async (id: string) => {
    const group = get().repoGroups.find((g) => g.id === id)
    if (!group) return
    try {
      applyRecentData(set, await window.api.recentRepos.setGroupCollapsed(id, !group.collapsed))
    } catch (err) {
      set({ error: describeError(err) })
    }
  },

  addRecentRepositories: async (paths: string[]) => {
    if (paths.length === 0) return
    applyRecentData(set, await window.api.recentRepos.addMany(paths))
    void get().scanRecentRepos()
  },

  removeRecentRepo: async (path: string) => {
    const data = await window.api.recentRepos.remove(path)
    set((state) => {
      const recentRepoChecks = { ...state.recentRepoChecks }
      delete recentRepoChecks[path]
      const batchUpdateResults = { ...state.batchUpdateResults }
      delete batchUpdateResults[path]
      return {
        recentRepos: data.repos,
        repoGroups: data.groups,
        recentRepoChecks,
        batchUpdateResults,
        selectedRepoPaths: state.selectedRepoPaths.filter((p) => p !== path)
      }
    })
  },

  openRepository: async (path: string) => {
    const generation = ++repoOpenGeneration
    set({ isBusy: true, error: null })
    try {
      const isRepo = await window.api.git.isRepository(path)
      if (!isRepo) throw new Error(getT().stores.notARepo(path))
      if (generation !== repoOpenGeneration) return

      const recentData = await window.api.recentRepos.add(path)
      await window.api.settings.setLastRepositoryPath(path)
      if (generation !== repoOpenGeneration) return
      set({
        currentRepoPath: path,
        recentRepos: recentData.repos,
        repoGroups: recentData.groups,
        view: 'changes',
        selectedFile: null,
        diffText: '',
        conflictContent: null,
        selectedCommit: null,
        lastFetchedAt: null,
        logPath: null,
        historyFocus: null,
        fileInsight: null,
        rebasePlannerOpen: false,
        commitSummary: '',
        commitDescription: '',
        switchBlocked: null,
        branchStashHint: null
      })
      await Promise.all([get().refreshStatus(), get().refreshBranches(), get().refreshLog()])
    } catch (err) {
      if (generation !== repoOpenGeneration) return
      set({ error: describeError(err) })
    } finally {
      if (generation === repoOpenGeneration) set({ isBusy: false })
    }
  },

  createRepository: async (path: string) => {
    set({ isBusy: true, error: null })
    try {
      await window.api.git.init(path)
      await get().openRepository(path)
    } catch (err) {
      set({ error: describeError(err), isBusy: false })
    }
  },

  cloneRepository: async (url: string, destination: string) => {
    set({ isBusy: true, error: null })
    try {
      const outcome = await window.api.git.clone(url, destination)
      // Cancelling is not a failure: no error banner, and nothing to open. The
      // success path leaves isBusy to openRepository's finally, so the cancel
      // path has to clear it itself.
      if (outcome.status === 'cancelled') {
        set({ isBusy: false })
        return 'cancelled'
      }
      await get().openRepository(destination)
      // A clone is a full fetch — "never fetched" would be wrong right after it.
      if (get().currentRepoPath === destination) set({ lastFetchedAt: Date.now() })
      return 'ok'
    } catch (err) {
      set({ error: describeError(err), isBusy: false })
      return 'failed'
    }
  },

  cancelClone: async (destination: string) => {
    await window.api.git.cancelClone(destination)
  },

  closeRepository: () => {
    repoOpenGeneration++
    void window.api.settings.setLastRepositoryPath(null)
    set({
      currentRepoPath: null,
      status: null,
      branches: [],
      remoteBranches: [],
      forcePushPrompt: null,
      switchBlocked: null,
      branchStashHint: null,
      log: [],
      stashes: [],
      selectedFile: null,
      diffText: '',
      conflictContent: null,
      selectedCommit: null,
      commitDiffText: '',
      logPath: null,
      historyFocus: null,
      fileInsight: null,
      rebasePlannerOpen: false,
      commitSummary: '',
      commitDescription: ''
    })
  },

  refreshStatus: async () => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    const path = currentRepoPath
    const generation = repoOpenGeneration
    const seq = ++statusRequestSeq
    try {
      const status = await window.api.git.status(path)
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      if (seq < statusAppliedSeq) return
      statusAppliedSeq = seq
      if (sameRepoStatus(get().status, status)) return
      set({ status })
    } catch (err) {
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      set({ error: describeError(err) })
    }
  },

  refreshBranches: async () => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    const path = currentRepoPath
    const generation = repoOpenGeneration
    try {
      const [branches, remote] = await Promise.all([
        window.api.git.branches(path),
        window.api.git.remoteBranches(path).catch(() => [] as string[])
      ])
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      const local = new Set(branches.map((b) => b.name))
      set({ branches, remoteBranches: remote.filter((r) => !local.has(r.slice(r.indexOf('/') + 1))) })
    } catch (err) {
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      set({ error: describeError(err) })
    }
  },

  refreshLog: async () => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    const path = currentRepoPath
    const generation = repoOpenGeneration
    try {
      // Keeps a deeper load (from focusing an old commit) instead of shrinking back.
      const limit = Math.max(GRAPH_LOG_LIMIT, get().log.length)
      const log = await window.api.git.graphLog(path, limit, get().logPath ?? undefined)
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      set({ log })
    } catch (err) {
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      set({ error: describeError(err) })
    }
  },

  refreshStashes: async () => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    const path = currentRepoPath
    const generation = repoOpenGeneration
    try {
      const stashes = await window.api.git.stashList(path)
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      set({ stashes })
    } catch (err) {
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      set({ error: describeError(err) })
    }
  },

  setView: (view) => {
    set({ view })
    if (view === 'stash') get().refreshStashes()
    // Files edited in another program show up now, not at the next poll tick
    // (the Stash view also gates its button on there being changes).
    if (view === 'changes' || view === 'stash') void get().refreshStatus()
  },

  selectFile: async (path: string, staged: boolean) => {
    const { currentRepoPath, status } = get()
    if (!currentRepoPath) return
    const repoPath = currentRepoPath
    const generation = repoOpenGeneration

    const entry = status?.entries.find((e) => e.path === path)
    const conflicted = entry ? isConflicted(entry) : false
    set({ selectedFile: { path, staged, conflicted }, diffText: '', conflictContent: null })

    try {
      if (conflicted) {
        const content = await window.api.fs.readRepoFile(repoPath, path)
        if (generation !== repoOpenGeneration || get().currentRepoPath !== repoPath) return
        set({ conflictContent: content })
        return
      }

      // git status reports an untracked directory as a single entry ending in
      // "/" (it doesn't recurse into it) — that's not a file, so reading it
      // would throw EISDIR.
      if (path.endsWith('/')) {
        set({ diffText: getT().stores.untrackedFolder })
        return
      }

      const isNewUntracked = !staged && entry?.index === '?' && entry?.worktree === '?'
      if (isNewUntracked) {
        // `git diff` shows nothing for untracked files; read the raw content instead.
        const content = await window.api.fs.readRepoFile(repoPath, path)
        if (generation !== repoOpenGeneration || get().currentRepoPath !== repoPath) return
        const preview = content.length > 200_000 ? `${content.slice(0, 200_000)}\n${getT().stores.fileTruncated}` : content
        set({ diffText: preview || getT().stores.emptyNewFile })
      } else {
        const diffText = await window.api.git.diff(path, repoPath, staged)
        if (generation !== repoOpenGeneration || get().currentRepoPath !== repoPath) return
        set({ diffText })
      }
    } catch (err) {
      if (generation !== repoOpenGeneration || get().currentRepoPath !== repoPath) return
      set({ error: describeError(err) })
    }
  },

  clearSelectedFile: () => {
    set({ selectedFile: null, diffText: '', conflictContent: null })
  },

  stagePaths: async (paths: string[]) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    try {
      await window.api.git.stage(paths, currentRepoPath)
      await get().refreshStatus()
    } catch (err) {
      set({ error: describeError(err) })
    }
  },

  unstagePaths: async (paths: string[]) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    try {
      await window.api.git.unstage(paths, currentRepoPath)
      await get().refreshStatus()
    } catch (err) {
      set({ error: describeError(err) })
    }
  },

  discardPaths: async (paths: string[]) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    try {
      await window.api.git.discard(paths, currentRepoPath)
      set({ selectedFile: null, diffText: '' })
      await get().refreshStatus()
    } catch (err) {
      set({ error: describeError(err) })
    }
  },

  ignorePatterns: async (patterns, paths, shouldStopTracking) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      const result = await window.api.git.addToGitIgnore(currentRepoPath, patterns)
      if (!result.success) throw new Error(result.message)
      if (shouldStopTracking && paths.length > 0) {
        const tracked = await window.api.git.stopTracking(currentRepoPath, paths)
        if (!tracked.success) throw new Error(tracked.message)
      }
      set({ selectedFile: null, diffText: '' })
      await get().refreshStatus()
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  commitChanges: async (summary: string, description: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      // Never commit onto a branch that would refuse the push: the commit
      // would be stranded locally, ahead of a remote it can never reach.
      const block = await directPushBlock(get().status)
      if (block) {
        const { branch, rules } = block
        set({ error: getT().stores.protectedBranchBlocked(branch, rules.requiresPullRequest, (rules.requiredChecks ?? []).join(', ')) })
        return
      }

      await window.api.git.commit(summary, description, currentRepoPath)
      set({ selectedFile: null, diffText: '' })
      await Promise.all([get().refreshStatus(), get().refreshLog()])

      if (useAppSettingsStore.getState().settings?.commitAndPush) {
        const status = get().status
        if (status?.branch) {
          try {
            await window.api.git.push(currentRepoPath, status.branch, !status.upstream)
            set({ lastFetchedAt: Date.now() })
            await Promise.all([get().refreshStatus(), get().refreshBranches()])
          } catch (err) {
            if (isHistoryRewritten(err)) set({ forcePushPrompt: { branch: status.branch } })
            else set({ error: getT().stores.pushFailedAfterCommit(describeError(err)) })
          }
        }
      }
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  undoLastCommit: async (expectedHash?: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      if (expectedHash) await window.api.git.undoUnpublishedCommit(currentRepoPath, expectedHash)
      else await window.api.git.resetSoftHead(currentRepoPath)
      set({ selectedFile: null, diffText: '' })
      await Promise.all([get().refreshStatus(), get().refreshLog()])
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  amendCommit: async (summary?: string, description?: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      await window.api.git.commitAmend(currentRepoPath, summary, description)
      set({ selectedFile: null, diffText: '' })
      await Promise.all([get().refreshStatus(), get().refreshLog()])
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  applyHunk: async (path, hunkIndex, action) => {
    const { currentRepoPath, selectedFile, isHunkBusy } = get()
    if (!currentRepoPath) return
    // hunkIndex refers to the diff the user is looking at. While a previous apply
    // is still refreshing, that diff is about to change — a second click would
    // resolve the index against the new diff and stage the wrong hunk.
    if (isHunkBusy) return
    set({ isHunkBusy: true })
    try {
      const stagedDiff = action === 'unstage'
      const diffText = await window.api.git.diff(path, currentRepoPath, stagedDiff)
      // hunkIndex points into the diff on screen. If the file changed on disk
      // since (editor save, background status poll does not refresh the diff),
      // the same index can name a different hunk — show the new diff instead
      // of applying something the user never saw.
      const shown = get()
      if (shown.selectedFile?.path === path && shown.selectedFile.staged === stagedDiff && shown.diffText !== diffText) {
        await get().selectFile(path, stagedDiff)
        throw new Error(getT().stores.fileChangedSinceDiff)
      }
      const parsed = parseFileDiff(diffText)
      if (!parsed) throw new Error(getT().stores.cannotReadHunks)
      const patch = extractHunkPatch(parsed, hunkIndex)
      if (!patch.trim()) throw new Error(getT().stores.invalidHunk)
      await window.api.git.applyPatch(currentRepoPath, patch, action !== 'discard', action !== 'stage')
      await get().refreshStatus()
      const { staged, unstaged } = splitStatus(get().status)
      const stillUnstaged = unstaged.some((entry) => entry.path === path)
      const stillStaged = staged.some((entry) => entry.path === path)
      if (!stillUnstaged && !stillStaged) {
        set({ selectedFile: null, diffText: '' })
        return
      }
      const viewStaged =
        action === 'stage' ? !stillUnstaged && stillStaged : action === 'unstage' ? stillStaged : Boolean(selectedFile?.staged && stillStaged)
      await get().selectFile(path, viewStaged)
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isHunkBusy: false })
    }
  },

  fetchRecentRepo: async (path: string) => {
    set({ isBusy: true, error: null })
    try {
      await window.api.git.fetch(path)
      const check = await checkRepoUpdate(path, false)
      set((state) => ({ recentRepoChecks: { ...state.recentRepoChecks, [path]: check } }))
      if (get().currentRepoPath === path) await get().refreshStatus()
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  pullRecentRepo: async (path: string) => {
    set({ isBusy: true, error: null })
    try {
      const result = await window.api.git.pull(path)
      // git prints "CONFLICT (content): …" to stdout, not stderr.
      if (result.exitCode !== 0 && !/conflict/i.test(`${result.stdout}\n${result.stderr}`)) {
        throw new Error(result.stderr.trim() || getT().stores.pullFailed)
      }
      const check = await checkRepoUpdate(path, false)
      set((state) => ({ recentRepoChecks: { ...state.recentRepoChecks, [path]: check } }))
      if (get().currentRepoPath === path) {
        await Promise.all([get().refreshStatus(), get().refreshLog()])
      }
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  toggleRepoSelection: (path: string) => {
    set((state) => ({
      selectedRepoPaths: state.selectedRepoPaths.includes(path)
        ? state.selectedRepoPaths.filter((p) => p !== path)
        : [...state.selectedRepoPaths, path]
    }))
  },

  selectAllUpdatableRepos: () => {
    const { recentRepos, recentRepoChecks } = get()
    set({
      selectedRepoPaths: recentRepos
        .map((r) => r.path)
        .filter((path) => isUpdatable(recentRepoChecks[path]))
    })
  },

  clearRepoSelection: () => set({ selectedRepoPaths: [] }),

  clearBatchResults: () => set({ batchUpdateResults: {} }),

  // Batch fast-forward. Each repo is independent: a failure or a skip is
  // recorded in batchUpdateResults and the rest keep going, so one offline
  // remote never aborts the run.
  updateSelectedRepos: async () => {
    const { selectedRepoPaths, recentRepoChecks } = get()
    const targets = selectedRepoPaths.filter((path) => isUpdatable(recentRepoChecks[path]))
    if (targets.length === 0) return

    set({ isBatchUpdating: true, isBusy: true, error: null, batchUpdateResults: {} })
    try {
      await runWithConcurrency(targets, async (path) => {
        let result: RepoUpdateResult
        try {
          result = await window.api.git.updateToDefaultBranch(path)
        } catch (err) {
          result = { outcome: 'failed', message: describeError(err), commitsPulled: 0 }
        }

        // updateToDefaultBranch already fetched, so re-check without another
        // network round-trip.
        const check = await checkRepoUpdate(path, false).catch((err) => failedCheck(err))

        set((state) => ({
          batchUpdateResults: { ...state.batchUpdateResults, [path]: result },
          recentRepoChecks: { ...state.recentRepoChecks, [path]: check },
          selectedRepoPaths: state.selectedRepoPaths.filter((p) => p !== path)
        }))

        if (get().currentRepoPath === path) {
          await Promise.all([get().refreshStatus(), get().refreshBranches(), get().refreshLog()])
        }
      })
    } finally {
      set({ isBatchUpdating: false, isBusy: false })
    }
  },

  setLogPath: async (path) => {
    set({ logPath: path, selectedCommit: null, commitDiffText: '' })
    await get().refreshLog()
  },

  switchBranch: (name, options) => get().runCheckout(name, false, options),

  checkoutRemoteBranch: (remoteBranch, options) => get().runCheckout(remoteBranch, true, options),

  runCheckout: async (target, remote, options) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return false
    const from = get().status?.branch ?? 'HEAD'
    set({ isBusy: true, error: null, branchStashHint: null })
    try {
      const result = remote
        ? await window.api.git.checkoutRemoteBranch(target, currentRepoPath)
        : await window.api.git.switchBranch(target, currentRepoPath)
      if (!result.switched) {
        if (options?.interactive === false) {
          set({ error: getT().stores.switchBlocked(target, result.blockingFiles.join(', ')) })
        } else {
          set({ switchBlocked: { from, target, remote, files: result.blockingFiles } })
        }
        return false
      }
      await Promise.all([get().refreshStatus(), get().refreshBranches(), get().refreshLog(), get().refreshStashes()])
      // A branch just created from origin/* can't have stashes of its own yet.
      if (!remote && get().stashes.some((stash) => stashBranchName(stash.message) === target)) {
        set({ branchStashHint: { repoPath: currentRepoPath, branch: target } })
      }
      return true
    } catch (err) {
      set({ error: describeError(err) })
      return false
    } finally {
      set({ isBusy: false })
    }
  },

  stashAndSwitch: async () => {
    const { switchBlocked, currentRepoPath } = get()
    if (!switchBlocked || !currentRepoPath) return
    set({ switchBlocked: null, isBusy: true, error: null })
    try {
      // -u: untracked files can block a checkout just like tracked edits.
      await window.api.git.stashPush(currentRepoPath, getT().stores.leftChangesStash(switchBlocked.from))
      set({ selectedFile: null, diffText: '' })
    } catch (err) {
      set({ error: describeError(err), isBusy: false })
      return
    }
    set({ isBusy: false })
    // Should the switch still fail, the changes are already safe in the stash.
    const switched = await get().runCheckout(switchBlocked.target, switchBlocked.remote, { interactive: false })
    if (!switched) await Promise.all([get().refreshStatus(), get().refreshStashes()])
  },

  cancelBlockedSwitch: () => set({ switchBlocked: null }),

  // Looked up again at click time: stash@{n} indexes shift whenever another
  // stash is pushed or dropped, so a ref captured at switch time can go stale.
  restoreBranchStash: async () => {
    const { branchStashHint, currentRepoPath } = get()
    set({ branchStashHint: null })
    if (!branchStashHint || branchStashHint.repoPath !== currentRepoPath) return
    await get().refreshStashes()
    const parked = get().stashes.find((stash) => stashBranchName(stash.message) === branchStashHint.branch)
    if (parked) await get().popStash(parked.ref)
  },

  dismissBranchStashHint: () => set({ branchStashHint: null }),

  createBranch: async (name: string, checkout: boolean, from?: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      await window.api.git.createBranch(name, currentRepoPath, checkout, from)
      await get().refreshBranches()
      if (checkout) await Promise.all([get().refreshStatus(), get().refreshLog()])
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  mergeBranch: async (branchName: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      const result = await window.api.git.merge(branchName, currentRepoPath)
      await Promise.all([get().refreshStatus(), get().refreshLog()])
      const hasConflicts = get().status?.entries.some(isConflicted)
      if (result.exitCode !== 0 && !hasConflicts) {
        throw new Error(result.stderr.trim() || getT().stores.mergeFailed(branchName))
      }
      if (hasConflicts) {
        set({ error: getT().stores.mergeConflicts })
      }
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  revertCommit: async (hash: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      const result = await window.api.git.revertCommit(hash, currentRepoPath)
      await Promise.all([get().refreshStatus(), get().refreshLog()])
      const hasConflicts = get().status?.entries.some(isConflicted)
      if (hasConflicts) {
        set({ view: 'changes', error: getT().stores.revertConflicts })
      } else if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || getT().stores.revertFailed)
      }
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  integrateBaseIntoBranch: async (head: string, base: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      // The merge must see what origin has now, not the last fetch.
      await window.api.git.fetch(currentRepoPath)
      set({ lastFetchedAt: Date.now() })
      await get().refreshBranches()
    } catch (err) {
      set({ error: describeError(err), isBusy: false })
      return
    }
    set({ isBusy: false })
    if (get().status?.branch !== head) {
      // A switch blocked by local changes opens its dialog and reports false —
      // merging anyway would land origin/<base> on the wrong branch.
      const switched = get().branches.some((b) => b.name === head)
        ? await get().switchBranch(head)
        : await get().checkoutRemoteBranch(`origin/${head}`)
      if (!switched) return
    }
    await get().mergeBranch(`origin/${base}`)
    // Conflicts (the usual reason to be here) are resolved in Alterações.
    set({ view: 'changes' })
  },

  abortMerge: async () => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      await window.api.git.mergeAbort(currentRepoPath)
      set({ selectedFile: null, diffText: '', conflictContent: null })
      await get().refreshStatus()
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  sync: async () => {
    const { currentRepoPath, status } = get()
    if (!currentRepoPath || !status) return
    set({ isBusy: true, error: null })
    try {
      if (!status.upstream) {
        if (!status.branch) throw new Error(getT().stores.noBranchToPublish)
        await window.api.git.push(currentRepoPath, status.branch, true)
      } else if (status.behind > 0 && status.ahead > 0) {
        // Diverged (e.g. remote bot commit + local work): push integrates via rebase.
        await window.api.git.push(currentRepoPath, status.branch ?? '', false)
      } else if (status.behind > 0) {
        const result = await window.api.git.pull(currentRepoPath)
        await get().refreshStatus()
        const hasConflicts = get().status?.entries.some(isConflicted)
        if (result.exitCode !== 0 && !hasConflicts) {
          throw new Error(result.stderr.trim() || getT().stores.pullFailed)
        }
        if (hasConflicts) {
          set({ error: getT().stores.pullConflicts })
        }
      } else if (status.ahead > 0) {
        await window.api.git.push(currentRepoPath, status.branch ?? '', false)
      } else {
        await window.api.git.fetch(currentRepoPath)
      }
      // Every branch above talked to the remote (push fetches first).
      set({ lastFetchedAt: Date.now() })
      await Promise.all([get().refreshStatus(), get().refreshBranches(), get().refreshLog()])
    } catch (err) {
      if (isHistoryRewritten(err) && status.branch) set({ forcePushPrompt: { branch: status.branch } })
      else set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  // Returns false when git refused because the branch has unmerged commits, so
  // the caller can offer the forced delete instead of just showing an error.
  deleteBranch: async (name: string, force: boolean) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return true
    set({ isBusy: true, error: null })
    try {
      await window.api.git.deleteBranch(name, currentRepoPath, force)
      await get().refreshBranches()
      return true
    } catch (err) {
      const message = describeError(err)
      if (!force && /not fully merged/i.test(message)) return false
      set({ error: message })
      return true
    } finally {
      set({ isBusy: false })
    }
  },

  deleteCheckedBranch: async (name: string, expectedTip: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return false
    set({ isBusy: true, error: null })
    try {
      await window.api.git.deleteCheckedBranch(currentRepoPath, name, expectedTip)
      await get().refreshBranches()
      return true
    } catch (err) {
      set({ error: describeError(err) })
      return false
    } finally {
      set({ isBusy: false })
    }
  },

  renameBranch: async (oldName: string, newName: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      await window.api.git.renameBranch(oldName, newName, currentRepoPath)
      await Promise.all([get().refreshStatus(), get().refreshBranches()])
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  forcePush: async () => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null, forcePushPrompt: null })
    try {
      await window.api.git.forcePush(currentRepoPath)
      set({ lastFetchedAt: Date.now() })
      await Promise.all([get().refreshStatus(), get().refreshBranches(), get().refreshLog()])
    } catch (err) {
      const message = describeError(err)
      // The lease did its job: someone pushed after our last fetch.
      set({
        error: /stale info|rejected/i.test(message)
          ? getT().stores.leaseRejected
          : message
      })
    } finally {
      set({ isBusy: false })
    }
  },

  dismissForcePush: () => set({ forcePushPrompt: null }),

  pushStash: async (message: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      await window.api.git.stashPush(currentRepoPath, message)
      set({ selectedFile: null, diffText: '' })
      await Promise.all([get().refreshStatus(), get().refreshStashes()])
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  applyStash: async (ref: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      await window.api.git.stashApply(currentRepoPath, ref)
      await get().refreshStatus()
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  popStash: async (ref: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      await window.api.git.stashPop(currentRepoPath, ref)
      await Promise.all([get().refreshStatus(), get().refreshStashes()])
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  dropStash: async (ref: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      await window.api.git.stashDrop(currentRepoPath, ref)
      await get().refreshStashes()
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  resolveConflict: async (path: string, content: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    set({ isBusy: true, error: null })
    try {
      await window.api.fs.writeRepoFile(currentRepoPath, path, content)
      await window.api.git.stage([path], currentRepoPath)
      // Status first: clearing the selection while the list still shows the
      // file as conflicted let the auto-select re-open it with its new content.
      await get().refreshStatus()
      set({ selectedFile: null, conflictContent: null })
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  selectCommit: async (hash: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    const path = currentRepoPath
    const generation = repoOpenGeneration
    try {
      const files = await window.api.git.commitFiles(hash, path)
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      set({ selectedCommit: { hash, files, selectedPath: null }, commitDiffText: '' })
      // Open straight on the first file, as a PR does, instead of an empty
      // pane asking for a click. With a file filter active, that file.
      const logPath = get().logPath
      const first = files.find((f) => logPath && f.path.split('\t').pop() === logPath) ?? files[0]
      if (first) void get().selectCommitFile(first.path)
    } catch (err) {
      if (generation !== repoOpenGeneration || get().currentRepoPath !== path) return
      set({ error: describeError(err) })
    }
  },

  clearSelectedCommit: () => {
    set({ selectedCommit: null, commitDiffText: '' })
  },

  selectCommitFile: async (path: string) => {
    const { currentRepoPath, selectedCommit } = get()
    if (!currentRepoPath || !selectedCommit) return
    const repoPath = currentRepoPath
    const generation = repoOpenGeneration
    const commitHash = selectedCommit.hash
    try {
      const commitDiffText = await window.api.git.commitDiff(commitHash, path, repoPath)
      if (generation !== repoOpenGeneration || get().currentRepoPath !== repoPath) return
      const current = get().selectedCommit
      if (!current || current.hash !== commitHash) return
      set({ selectedCommit: { ...current, selectedPath: path }, commitDiffText })
    } catch (err) {
      if (generation !== repoOpenGeneration || get().currentRepoPath !== repoPath) return
      set({ error: describeError(err) })
    }
  },

  focusCommitInHistory: async (hash: string) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return false
    const path = currentRepoPath
    // A file filter shows one branch's commits only; the graph needs them all.
    const hadFilter = get().logPath !== null
    if (hadFilter) set({ logPath: null })
    if (hadFilter || !get().log.some((c) => c.hash === hash)) {
      const log = await window.api.git.graphLog(path, GRAPH_LOG_LIMIT, undefined)
      if (get().currentRepoPath !== path) return false
      set({ log })
    }
    if (!get().log.some((c) => c.hash === hash)) {
      const deep = await window.api.git.graphLog(path, GRAPH_LOG_DEEP_LIMIT, undefined)
      if (get().currentRepoPath !== path) return false
      set({ log: deep })
    }
    if (!get().log.some((c) => c.hash === hash)) return false
    set({ view: 'history', historyFocus: { hash, nonce: ++historyFocusNonce } })
    await get().selectCommit(hash)
    return true
  },

  openFileInsight: (path, line) => set({ fileInsight: { path, line, nonce: ++historyFocusNonce } }),
  closeFileInsight: () => set({ fileInsight: null }),
  setRebasePlannerOpen: (open) => set({ rebasePlannerOpen: open }),

  createTag: async (name, ref, message) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return false
    set({ isBusy: true, error: null })
    try {
      await window.api.git.createTag(currentRepoPath, name, ref, message)
      await get().refreshLog()
      return true
    } catch (err) {
      set({ error: describeError(err) })
      return false
    } finally {
      set({ isBusy: false })
    }
  },

  pushTag: async (name) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return false
    set({ isBusy: true, error: null })
    try {
      await window.api.git.pushTag(currentRepoPath, name)
      await get().refreshLog()
      return true
    } catch (err) {
      set({ error: describeError(err) })
      return false
    } finally {
      set({ isBusy: false })
    }
  },

  runLocalRebase: async (steps, expectedHead) => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return null
    set({ isBusy: true, error: null })
    try {
      const result = await window.api.git.runLocalRebase(currentRepoPath, steps, expectedHead)
      set({ selectedCommit: null, commitDiffText: '' })
      await Promise.all([get().refreshStatus(), get().refreshLog()])
      return result.commitCount
    } catch (err) {
      await Promise.all([get().refreshStatus(), get().refreshLog()])
      set({ error: describeError(err) })
      return null
    } finally {
      set({ isBusy: false })
    }
  },

  clearError: () => set({ error: null }),
  setError: (message: string | null) => set({ error: message })
}))

export function splitStatus(status: RepoStatus | null): {
  staged: StatusEntry[]
  unstaged: StatusEntry[]
  conflicted: StatusEntry[]
} {
  if (!status) return { staged: [], unstaged: [], conflicted: [] }
  const staged: StatusEntry[] = []
  const unstaged: StatusEntry[] = []
  const conflicted: StatusEntry[] = []

  for (const entry of status.entries) {
    if (isConflicted(entry)) {
      conflicted.push(entry)
      continue
    }
    const isUntracked = entry.index === '?' && entry.worktree === '?'
    if (isUntracked) {
      unstaged.push(entry)
      continue
    }
    if (entry.index !== ' ') staged.push(entry)
    if (entry.worktree !== ' ') unstaged.push(entry)
  }

  return { staged, unstaged, conflicted }
}
