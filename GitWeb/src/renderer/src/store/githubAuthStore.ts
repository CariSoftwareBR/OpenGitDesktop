import { create } from 'zustand'
import type { GitHubUser } from '../lib/github'
import type { DeviceFlowPollStatus } from '../../../shared/githubAuth'

const DEFAULT_HOST = 'github.com'

interface DeviceFlowUiState {
  host: string
  flowId: string
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
  status: 'polling' | DeviceFlowPollStatus
  errorMessage?: string
}

interface GithubAuthStoreState {
  user: GitHubUser | null
  userHost: string | null
  userLoading: boolean
  deviceFlow: DeviceFlowUiState | null

  loadCurrentUser: (host?: string) => Promise<void>
  setCurrentUser: (user: GitHubUser | null, host?: string) => void
  startDeviceFlowLogin: (host: string) => Promise<GitHubUser | null>
  cancelDeviceFlowLogin: () => void
  clearDeviceFlow: () => void
  loginWithPat: (host: string, token: string) => Promise<GitHubUser>
  logout: (host: string) => Promise<void>
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export const useGithubAuthStore = create<GithubAuthStoreState>((set, get) => ({
  user: null,
  userHost: null,
  userLoading: false,
  deviceFlow: null,

  loadCurrentUser: async (host = DEFAULT_HOST) => {
    set({ userLoading: true })
    try {
      // main validates the stored token and returns only the identity —
      // a null here means "no session", not an error.
      const user = await window.api.github.getSession(host)
      set({ user, userHost: user ? host : null, userLoading: false })
    } catch {
      set({ user: null, userHost: null, userLoading: false })
    }
  },

  setCurrentUser: (user, host = DEFAULT_HOST) => {
    set({ user, userHost: user ? host : null })
  },

  startDeviceFlowLogin: async (host: string) => {
    try {
      const start = await window.api.github.deviceFlowStart(host)
      set({
        deviceFlow: {
          host,
          flowId: start.flowId,
          userCode: start.userCode,
          verificationUri: start.verificationUri,
          verificationUriComplete: start.verificationUriComplete,
          status: 'polling'
        }
      })

      // On success main has already stored the token; all we get is the user.
      const result = await window.api.github.deviceFlowPoll(start.flowId)

      if (result.status === 'success' && result.user) {
        set((state) => ({
          deviceFlow: state.deviceFlow ? { ...state.deviceFlow, status: 'success' } : null,
          user: result.user ?? null,
          userHost: host
        }))
        return result.user
      }

      set((state) => ({
        deviceFlow: state.deviceFlow ? { ...state.deviceFlow, status: result.status, errorMessage: result.errorMessage } : null
      }))
      return null
    } catch (err) {
      set((state) => ({
        deviceFlow: state.deviceFlow ? { ...state.deviceFlow, status: 'error', errorMessage: describeError(err) } : null
      }))
      return null
    }
  },

  cancelDeviceFlowLogin: () => {
    const { deviceFlow } = get()
    if (!deviceFlow) return
    void window.api.github.deviceFlowCancel(deviceFlow.flowId)
  },

  clearDeviceFlow: () => set({ deviceFlow: null }),

  loginWithPat: async (host: string, token: string) => {
    // Write-only direction: the token the user typed goes to main, which
    // validates and stores it. It is never readable from the renderer again.
    const user = await window.api.github.loginWithPat(host, token)
    set({ user, userHost: host })
    return user
  },

  logout: async (host: string) => {
    await window.api.github.logout(host)
    const { userHost } = get()
    if (!userHost || userHost === host) {
      set({ user: null, userHost: null })
    }
  }
}))
