import { create } from 'zustand'
import {
  parseGitHubRemote,
  type GitHubUser,
  type PullRequest,
  type PullRequestComment,
  type PullRequestFile,
  type PullRequestState,
  type RemoteInfo
} from '../lib/github'
import { useRepoStore } from './repoStore'
import { useGithubAuthStore } from './githubAuthStore'

interface PullRequestDetail {
  pr: PullRequest
  files: PullRequestFile[]
  comments: PullRequestComment[]
  selectedFile: string | null
}

interface PullRequestStoreState {
  remote: RemoteInfo | null
  // No token here: main holds it. `user` non-null means "we have a working
  // session for remote.host" and is what gates every call below.
  user: GitHubUser | null
  stateFilter: PullRequestState
  pullRequests: PullRequest[]
  detail: PullRequestDetail | null
  isBusy: boolean
  isMerging: boolean
  error: string | null
  successMessage: string | null
  /** The PR merged from this screen, for the follow-up actions (switch to base, delete branch). */
  lastMerged: { number: number; headRef: string; baseRef: string } | null

  detectRemote: () => Promise<void>
  loginWithToken: (token: string) => Promise<void>
  loginSuccess: (user: GitHubUser) => void
  logout: () => Promise<void>
  reset: () => void
  setStateFilter: (state: PullRequestState) => void
  refreshPullRequests: () => Promise<void>
  createPullRequest: (input: {
    title: string
    body: string
    head: string
    base: string
    draft: boolean
  }) => Promise<boolean>
  selectPullRequest: (number: number) => Promise<void>
  clearPullRequestDetail: () => void
  selectPullRequestFile: (filename: string) => void
  addComment: (body: string) => Promise<void>
  addLineComment: (path: string, line: number, body: string) => Promise<void>
  submitReview: (
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
    body: string,
    comments?: { path: string; body: string; line: number }[]
  ) => Promise<void>
  merge: (method: 'merge' | 'squash' | 'rebase', title?: string, message?: string) => Promise<void>
  setState: (state: 'open' | 'closed') => Promise<void>
  clearError: () => void
  clearSuccessMessage: () => void
  dismissLastMerged: () => void
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function ensurePullRequestStillOpen(remote: RemoteInfo, pr: PullRequest): Promise<PullRequest> {
  const fresh = await window.api.github.getPullRequest(remote.host, remote.owner, remote.repo, pr.number)
  if (fresh.state !== 'open') {
    throw new Error(
      `A pull request #${fresh.number} não está mais aberta (estado atual: ${fresh.state === 'closed' ? 'fechada' : fresh.state}).`
    )
  }
  return fresh
}

let detectRemoteGeneration = 0
let selectPullRequestGeneration = 0

// A failed review/merge/state change refreshes the list first and only then
// records the error: refreshPullRequests starts by clearing `error`, so setting
// it earlier would wipe it before anyone saw it. The open PR view is kept (with
// whatever the user typed) unless the PR is gone from the list or changed state.
async function reportActionFailure(
  get: () => PullRequestStoreState,
  set: (partial: Partial<PullRequestStoreState>) => void,
  pr: PullRequest,
  err: unknown
): Promise<void> {
  const message = describeError(err)
  await get().refreshPullRequests()
  const fresh = get().pullRequests.find((p) => p.number === pr.number)
  const stillValid = !!fresh && fresh.state === pr.state
  set(stillValid ? { error: message } : { error: message, detail: null })
}

export const usePullRequestStore = create<PullRequestStoreState>((set, get) => ({
  remote: null,
  user: null,
  stateFilter: 'open',
  pullRequests: [],
  detail: null,
  isBusy: false,
  isMerging: false,
  error: null,
  successMessage: null,
  lastMerged: null,

  detectRemote: async () => {
    const generation = ++detectRemoteGeneration
    const repoPath = useRepoStore.getState().currentRepoPath
    set({ remote: null, user: null, pullRequests: [], detail: null, error: null })
    if (!repoPath) return

    try {
      const url = await window.api.git.remoteUrl(repoPath)
      if (generation !== detectRemoteGeneration) return
      if (!url) return
      const remote = parseGitHubRemote(url)
      if (!remote) return
      if (generation !== detectRemoteGeneration) return
      set({ remote })

      // null when there is no stored token or it no longer works — either way
      // the user stays logged out and can re-enter credentials.
      const user = await window.api.github.getSession(remote.host)
      if (generation !== detectRemoteGeneration) return
      if (user) {
        set({ user })
        await get().refreshPullRequests()
      }
    } catch (err) {
      if (generation !== detectRemoteGeneration) return
      set({ error: describeError(err) })
    }
  },

  loginWithToken: async (token: string) => {
    const { remote } = get()
    if (!remote) return
    set({ isBusy: true, error: null })
    try {
      const user = await useGithubAuthStore.getState().loginWithPat(remote.host, token)
      set({ user })
      await get().refreshPullRequests()
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  loginSuccess: (user: GitHubUser) => {
    set({ user })
    void get().refreshPullRequests()
  },

  logout: async () => {
    const { remote } = get()
    if (remote) await useGithubAuthStore.getState().logout(remote.host)
    set({ user: null, pullRequests: [], detail: null })
  },

  reset: () => {
    detectRemoteGeneration++
    selectPullRequestGeneration++
    set({
      remote: null,
      user: null,
      pullRequests: [],
      detail: null,
      error: null,
      isBusy: false,
      isMerging: false,
      successMessage: null,
      lastMerged: null
    })
  },

  setStateFilter: (stateFilter) => {
    set({ stateFilter })
    get().refreshPullRequests()
  },

  refreshPullRequests: async () => {
    const { remote, user, stateFilter } = get()
    if (!remote || !user) return
    const generation = detectRemoteGeneration
    set({ isBusy: true, error: null })
    try {
      const pullRequests = await window.api.github.listPullRequests(
        remote.host,
        remote.owner,
        remote.repo,
        stateFilter
      )
      if (generation !== detectRemoteGeneration) return
      set({ pullRequests })
    } catch (err) {
      if (generation !== detectRemoteGeneration) return
      set({ error: describeError(err) })
    } finally {
      if (generation === detectRemoteGeneration) set({ isBusy: false })
    }
  },

  createPullRequest: async (input) => {
    const { remote, user } = get()
    if (!remote || !user) return false
    set({ isBusy: true, error: null })
    try {
      const created = await window.api.github.createPullRequest(remote.host, remote.owner, remote.repo, input)
      await get().refreshPullRequests()
      if (get().error) return false
      // Land on what was just created instead of an empty "select a PR" pane.
      // The list can lag a moment behind the create, so the new PR is added
      // to it here when the refetch did not bring it yet.
      if (!get().pullRequests.some((p) => p.number === created.number)) {
        set((state) => ({ pullRequests: [created, ...state.pullRequests] }))
      }
      void get().selectPullRequest(created.number)
      return true
    } catch (err) {
      set({ error: describeError(err) })
      return false
    } finally {
      set({ isBusy: false })
    }
  },

  selectPullRequest: async (number: number) => {
    const { remote, user, pullRequests } = get()
    if (!remote || !user) return
    const pr = pullRequests.find((p) => p.number === number)
    if (!pr) return
    const generation = ++selectPullRequestGeneration
    set({ isBusy: true, error: null })
    try {
      const [files, comments] = await Promise.all([
        window.api.github.listPullRequestFiles(remote.host, remote.owner, remote.repo, number),
        window.api.github.listPullRequestComments(remote.host, remote.owner, remote.repo, number)
      ])
      if (generation !== selectPullRequestGeneration) return
      set({ detail: { pr, files, comments, selectedFile: files[0]?.filename ?? null } })

      // The list endpoint never includes `mergeable`, so without this the
      // screen could not tell a conflicting PR apart from a clean one until
      // the merge itself failed. Loaded after the detail so it never delays it.
      if (pr.state === 'open' && !pr.merged) {
        void window.api.github
          .getPullRequest(remote.host, remote.owner, remote.repo, number)
          .then((fresh) => {
            const current = get().detail
            if (generation !== selectPullRequestGeneration || current?.pr.number !== number) return
            set({ detail: { ...current, pr: { ...current.pr, ...fresh } } })
          })
          .catch(() => undefined)
      }
    } catch (err) {
      if (generation !== selectPullRequestGeneration) return
      set({ error: describeError(err) })
    } finally {
      if (generation === selectPullRequestGeneration) set({ isBusy: false })
    }
  },

  selectPullRequestFile: (filename: string) => {
    const { detail } = get()
    if (!detail) return
    set({ detail: { ...detail, selectedFile: filename || null } })
  },

  clearPullRequestDetail: () => {
    selectPullRequestGeneration++
    set({ detail: null })
  },

  addComment: async (body: string) => {
    const { remote, user, detail } = get()
    if (!remote || !user || !detail) return
    set({ isBusy: true, error: null })
    try {
      const created = await window.api.github.addPullRequestComment(
        remote.host,
        remote.owner,
        remote.repo,
        detail.pr.number,
        body
      )
      const listed = await window.api.github.listPullRequestComments(
        remote.host,
        remote.owner,
        remote.repo,
        detail.pr.number
      )
      // GitHub's list can lag behind the write that just succeeded — keep the
      // new comment visible even when the refetch does not include it yet.
      const comments = listed.some((c) => c.id === created.id) ? listed : [...listed, created]
      const current = get().detail
      if (current?.pr.number === detail.pr.number) set({ detail: { ...current, comments } })
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  addLineComment: async (path: string, line: number, body: string) => {
    const { remote, user, detail } = get()
    if (!remote || !user || !detail) return
    set({ isBusy: true, error: null })
    try {
      const pr = detail.pr.headSha
        ? detail.pr
        : await window.api.github.getPullRequest(remote.host, remote.owner, remote.repo, detail.pr.number)
      const created = await window.api.github.addPullRequestReviewComment(
        remote.host,
        remote.owner,
        remote.repo,
        detail.pr.number,
        body,
        pr.headSha,
        path,
        line
      )
      const listed = await window.api.github.listPullRequestComments(
        remote.host,
        remote.owner,
        remote.repo,
        detail.pr.number
      )
      const comments = listed.some((c) => c.id === created.id) ? listed : [...listed, created]
      const current = get().detail
      if (current?.pr.number === detail.pr.number) {
        set({ detail: { ...current, pr: { ...current.pr, ...pr }, comments } })
      }
    } catch (err) {
      set({ error: describeError(err) })
    } finally {
      set({ isBusy: false })
    }
  },

  submitReview: async (event, body, comments = []) => {
    const { remote, user, detail } = get()
    if (!remote || !user || !detail) return
    set({ isBusy: true, error: null })
    try {
      const pr = await ensurePullRequestStillOpen(remote, detail.pr)
      await window.api.github.submitPullRequestReview(
        remote.host,
        remote.owner,
        remote.repo,
        detail.pr.number,
        event,
        body,
        pr.headSha,
        comments
      )
      const nextComments = await window.api.github.listPullRequestComments(
        remote.host,
        remote.owner,
        remote.repo,
        detail.pr.number
      )
      set({ detail: { ...detail, pr: { ...detail.pr, ...pr }, comments: nextComments } })
    } catch (err) {
      await reportActionFailure(get, set, detail.pr, err)
    } finally {
      set({ isBusy: false })
    }
  },

  merge: async (method, title, message) => {
    const { remote, user, detail } = get()
    if (!remote || !user || !detail) return
    const { number, title: prTitle } = detail.pr
    set({ isBusy: true, isMerging: true, error: null })
    try {
      await ensurePullRequestStillOpen(remote, detail.pr)
      await window.api.github.mergePullRequest(
        remote.host,
        remote.owner,
        remote.repo,
        number,
        method,
        title,
        message
      )
      await get().refreshPullRequests()
      set({
        detail: null,
        successMessage: `Pull request #${number} "${prTitle}" mesclado com sucesso.`,
        lastMerged: { number, headRef: detail.pr.headRef, baseRef: detail.pr.baseRef }
      })
    } catch (err) {
      await reportActionFailure(get, set, detail.pr, err)
    } finally {
      set({ isBusy: false, isMerging: false })
    }
  },

  setState: async (state) => {
    const { remote, user, detail } = get()
    if (!remote || !user || !detail) return
    set({ isBusy: true, error: null })
    try {
      if (state === 'closed') {
        await ensurePullRequestStillOpen(remote, detail.pr)
      }
      await window.api.github.setPullRequestState(remote.host, remote.owner, remote.repo, detail.pr.number, state)
      await get().refreshPullRequests()
      // Same feedback a merge gets — otherwise the PR just vanishes from the
      // filtered list with no sign that anything happened.
      set({
        detail: null,
        successMessage:
          state === 'closed'
            ? `Pull request #${detail.pr.number} "${detail.pr.title}" fechada.`
            : `Pull request #${detail.pr.number} "${detail.pr.title}" reaberta.`
      })
    } catch (err) {
      await reportActionFailure(get, set, detail.pr, err)
    } finally {
      set({ isBusy: false })
    }
  },

  clearError: () => set({ error: null }),
  clearSuccessMessage: () => set({ successMessage: null }),
  dismissLastMerged: () => set({ lastMerged: null })
}))
