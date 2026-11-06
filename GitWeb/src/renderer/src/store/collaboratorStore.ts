import { create } from 'zustand'
import type { RemoteInfo } from '../lib/github'
import {
  normalizeGitHubUsername,
  type RepositoryCollaborator,
  type RepositoryCollaborators,
  type RepositoryRole
} from '../../../shared/github'
import { usePullRequestStore } from './pullRequestStore'
import { getT } from '../lib/i18n'

interface CollaboratorStoreState {
  /** The repository and account `data` belongs to, so the view never shows it to anyone else. */
  sessionKey: string | null
  data: RepositoryCollaborators | null
  isLoading: boolean
  isSaving: boolean
  /** Only when there is nothing to show; a failed refresh keeps the list and goes to the banner. */
  loadError: string | null
  /** Why the username in the form can't be invited; shown next to the field. */
  fieldError: string | null

  load: () => Promise<void>
  /** Resolves true when the person was invited or added, so the view can clear the field. */
  add: (input: string, role?: RepositoryRole) => Promise<boolean>
  remove: (login: string) => Promise<void>
  cancelInvitation: (id: number, login: string) => Promise<void>
  changeRole: (login: string, role: RepositoryRole) => Promise<void>
  clearFieldError: () => void
}

/** What one write needs: where it goes, and how to record its outcome once it lands. */
interface WriteScope {
  remote: RemoteInfo
  patch: (change: (data: RepositoryCollaborators) => Partial<RepositoryCollaborators>) => void
  reportSuccess: (message: string) => void
}

export function sessionKeyOf(remote: RemoteInfo, login: string): string {
  return `${remote.host}/${remote.owner}/${remote.repo}:${login}`.toLowerCase()
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function sameLogin(a: string | null, b: string): boolean {
  return a?.toLowerCase() === b.toLowerCase()
}

function byLogin(a: RepositoryCollaborator, b: RepositoryCollaborator): number {
  return a.login.localeCompare(b.login, undefined, { sensitivity: 'base' })
}

function currentSessionKey(): string | null {
  const { remote, user } = usePullRequestStore.getState()
  return remote && user ? sessionKeyOf(remote, user.login) : null
}

// A slower answer must not overwrite what came after it: a newer load, or a
// write, whose result the older list doesn't know about yet.
let loadGeneration = 0

export const useCollaboratorStore = create<CollaboratorStoreState>((set, get) => {
  /**
   * Runs a write against the repository on screen. Outcomes go through the pull
   * request store because that is what feeds the shell's GitHub banners. The
   * user may have moved on by the time it lands, so the list is only touched if
   * it is still this session's, and a banner about another repository names it.
   */
  async function save(write: (scope: WriteScope) => Promise<void>): Promise<boolean> {
    const { remote, user } = usePullRequestStore.getState()
    if (!remote || !user || get().isSaving) return false
    const key = sessionKeyOf(remote, user.login)
    const describe = (message: string): string =>
      currentSessionKey() === key ? message : `${remote.owner}/${remote.repo}: ${message}`

    loadGeneration++
    set({ isSaving: true, isLoading: false })
    usePullRequestStore.setState({ error: null, successMessage: null })
    try {
      await write({
        remote,
        patch: (change) =>
          set((state) => (state.sessionKey === key && state.data ? { data: { ...state.data, ...change(state.data) } } : {})),
        reportSuccess: (message) => usePullRequestStore.setState({ successMessage: describe(message) })
      })
      return true
    } catch (err) {
      usePullRequestStore.setState({ error: describe(describeError(err)) })
      return false
    } finally {
      set({ isSaving: false })
    }
  }

  return {
    sessionKey: null,
    data: null,
    isLoading: false,
    isSaving: false,
    loadError: null,
    fieldError: null,

    load: async () => {
      const { remote, user } = usePullRequestStore.getState()
      if (!remote || !user) return
      const key = sessionKeyOf(remote, user.login)
      // Whatever a read returns now could predate the write in progress.
      if (get().isSaving && get().sessionKey === key) return
      const generation = ++loadGeneration
      set((state) =>
        state.sessionKey === key
          ? { isLoading: true, loadError: null }
          : { sessionKey: key, data: null, isLoading: true, loadError: null, fieldError: null }
      )
      try {
        const data = await window.api.github.getRepositoryCollaborators(remote.host, remote.owner, remote.repo)
        if (generation === loadGeneration) set({ data })
      } catch (err) {
        if (generation !== loadGeneration) return
        if (get().data) usePullRequestStore.setState({ error: describeError(err) })
        else set({ loadError: describeError(err) })
      } finally {
        if (generation === loadGeneration) set({ isLoading: false })
      }
    },

    add: async (input, role) => {
      const t = getT().collaborators
      const login = normalizeGitHubUsername(input)
      if (!login) {
        set({ fieldError: input.trim().replace(/^@/, '').includes('@') ? t.emailNotAccepted : t.invalidUsername })
        return false
      }
      // Adding someone already here is a role change on GitHub's side, and the
      // default role would quietly demote an admin.
      const { data } = get()
      if (data?.collaborators.some((c) => c.direct && sameLogin(c.login, login))) {
        set({ fieldError: t.alreadyCollaborator(login) })
        return false
      }
      if (data?.invitations.some((i) => !i.expired && sameLogin(i.login, login))) {
        set({ fieldError: t.alreadyInvited(login) })
        return false
      }

      set({ fieldError: null })
      return save(async ({ remote, patch, reportSuccess }) => {
        const result = await window.api.github.addCollaborator(remote.host, remote.owner, remote.repo, login, role)
        if (result.kind === 'invited') {
          // Takes the place of an expired invitation for the same person.
          patch((current) => ({
            invitations: [result.invitation, ...current.invitations.filter((i) => i.id !== result.invitation.id && !sameLogin(i.login, login))]
          }))
          reportSuccess(t.invited(login))
          return
        }
        // Not read back: a list read right after the write can still show the old state.
        patch((current) => {
          const existing = current.collaborators.find((c) => sameLogin(c.login, login))
          const added: RepositoryCollaborator = {
            login: existing?.login ?? login,
            avatarUrl: existing?.avatarUrl ?? '',
            role: role ?? existing?.role ?? 'write',
            direct: true
          }
          return { collaborators: [...current.collaborators.filter((c) => c !== existing), added].sort(byLogin) }
        })
        reportSuccess(t.added(login))
      })
    },

    remove: async (login) => {
      const t = getT().collaborators
      // On an organization, a team or the org itself can still grant access this call can't see.
      const isOrg = get().data?.ownerKind === 'org'
      await save(async ({ remote, patch, reportSuccess }) => {
        await window.api.github.removeCollaborator(remote.host, remote.owner, remote.repo, login)
        patch((current) => ({ collaborators: current.collaborators.filter((c) => c.login !== login) }))
        reportSuccess(isOrg ? t.directAccessRemoved(login) : t.removed(login))
      })
    },

    cancelInvitation: async (id, login) => {
      await save(async ({ remote, patch, reportSuccess }) => {
        await window.api.github.cancelRepositoryInvitation(remote.host, remote.owner, remote.repo, id)
        patch((current) => ({ invitations: current.invitations.filter((i) => i.id !== id) }))
        reportSuccess(getT().collaborators.inviteCancelled(login))
      })
    },

    changeRole: async (login, role) => {
      await save(async ({ remote, patch, reportSuccess }) => {
        const t = getT().collaborators
        const result = await window.api.github.addCollaborator(remote.host, remote.owner, remote.repo, login, role)
        if (result.kind === 'invited') {
          patch((current) => ({
            collaborators: current.collaborators.filter((c) => c.login !== login),
            invitations: [result.invitation, ...current.invitations]
          }))
          reportSuccess(t.invited(login))
        } else {
          patch((current) => ({ collaborators: current.collaborators.map((c) => (c.login === login ? { ...c, role } : c)) }))
          reportSuccess(t.roleChanged(login, t.roles[role]))
        }
      })
    },

    clearFieldError: () => set({ fieldError: null })
  }
})
