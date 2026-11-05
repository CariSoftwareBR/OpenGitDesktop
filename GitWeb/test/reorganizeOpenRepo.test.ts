import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReorganizeResult, RepoMove } from '../src/shared/repoOrganize'
import type { RepoUpdateResult, RepoUpdateStatus } from '../src/shared/git'

const apply = vi.fn<(root: string, moves: RepoMove[]) => Promise<ReorganizeResult>>()
const setLastRepositoryPath = vi.fn(async () => undefined)
vi.stubGlobal('window', { api: { repoOrganize: { apply }, settings: { setLastRepositoryPath } } })

const { useRepoStore } = await import('../src/renderer/src/store/repoStore')

const refreshed = { refreshStatus: vi.fn(), refreshBranches: vi.fn(), refreshLog: vi.fn() }
const recent = { repos: [], groups: [] }
const approved = [{ from: 'C:\\Git\\site', to: 'C:\\Git\\acme\\site' }]

function moved(from: string, to: string): ReorganizeResult {
  return { moved: [{ from, to }], failed: [], recent }
}

describe('the open repository during a reorganization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepoStore.setState({
      ...refreshed, currentRepoPath: 'C:\\Git\\site', error: null,
      recentRepoChecks: {}, batchUpdateResults: {}, selectedRepoPaths: []
    })
  })

  it('follows the move', async () => {
    apply.mockResolvedValue(moved('C:\\Git\\site', 'C:\\Git\\acme\\site'))
    await useRepoStore.getState().reorganizeRepositories('C:\\Git', approved)
    expect(apply).toHaveBeenCalledWith('C:\\Git', approved)
    expect(useRepoStore.getState().currentRepoPath).toBe('C:\\Git\\acme\\site')
    expect(setLastRepositoryPath).toHaveBeenCalledWith('C:\\Git\\acme\\site')
    expect(refreshed.refreshStatus).toHaveBeenCalled()
  })

  it('follows the move when it was opened with a differently spelled path', async () => {
    useRepoStore.setState({ currentRepoPath: 'C:/Git/SITE/' })
    apply.mockResolvedValue(moved('C:\\Git\\site', 'C:\\Git\\acme\\site'))
    await useRepoStore.getState().reorganizeRepositories('C:\\Git', approved)
    expect(useRepoStore.getState().currentRepoPath).toBe('C:\\Git\\acme\\site')
  })

  it('does not mistake another folder on a case-sensitive system', async () => {
    useRepoStore.setState({ currentRepoPath: '/r/site' })
    apply.mockResolvedValue(moved('/r/Site', '/r/acme/Site'))
    await useRepoStore.getState().reorganizeRepositories('/r', [{ from: '/r/Site', to: '/r/acme/Site' }])
    expect(useRepoStore.getState().currentRepoPath).toBe('/r/site')
  })

  it('drops the error of a refresh that ran on the old path while it moved', async () => {
    apply.mockImplementation(async () => {
      useRepoStore.setState({ error: 'A pasta não existe mais' })
      return moved('C:\\Git\\site', 'C:\\Git\\acme\\site')
    })
    await useRepoStore.getState().reorganizeRepositories('C:\\Git', approved)
    expect(useRepoStore.getState().error).toBeNull()
  })

  it('stays put when another repository moved', async () => {
    useRepoStore.setState({ error: 'erro anterior' })
    apply.mockResolvedValue(moved('C:\\Git\\api', 'C:\\Git\\acme\\api'))
    await useRepoStore.getState().reorganizeRepositories('C:\\Git', [{ from: 'C:\\Git\\api', to: 'C:\\Git\\acme\\api' }])
    expect(useRepoStore.getState().currentRepoPath).toBe('C:\\Git\\site')
    expect(useRepoStore.getState().error).toBe('erro anterior')
    expect(setLastRepositoryPath).not.toHaveBeenCalled()
    expect(refreshed.refreshStatus).not.toHaveBeenCalled()
  })

  it('follows an open descendant and remaps selected and cached paths without matching siblings', async () => {
    const child = 'C:/Git/SITE/nested/Child/'
    const destination = 'C:\\Git\\acme\\site\\nested\\Child'
    const sibling = 'C:\\Git\\site-other\\child'
    const check: RepoUpdateStatus = {
      state: 'upToDate', message: '', branch: 'main', defaultBranch: 'main',
      behindDefault: 0, aheadOfDefault: 0, hasLocalDefault: true,
      localDefaultBehind: 0, localDefaultAhead: 0, ahead: 0, behind: 0,
      localChanges: 0, canFastForward: false
    }
    const batch: RepoUpdateResult = { outcome: 'alreadyUpToDate', message: '', commitsPulled: 0 }
    useRepoStore.setState({
      currentRepoPath: child, view: 'settings', commitSummary: 'keep this draft',
      selectedRepoPaths: [child, sibling],
      recentRepoChecks: { [child]: check, [sibling]: check },
      batchUpdateResults: { [child]: batch, [sibling]: batch }
    })
    apply.mockResolvedValue(moved(approved[0].from, approved[0].to))

    await useRepoStore.getState().reorganizeRepositories('C:\\Git', approved)

    const state = useRepoStore.getState()
    expect(state.currentRepoPath).toBe(destination)
    expect(state.selectedRepoPaths).toEqual([destination, sibling])
    expect(state.recentRepoChecks).toEqual({ [destination]: check, [sibling]: check })
    expect(state.batchUpdateResults).toEqual({ [destination]: batch, [sibling]: batch })
    expect(state.view).toBe('settings')
    expect(state.commitSummary).toBe('keep this draft')
    expect(setLastRepositoryPath).toHaveBeenCalledWith(destination)
    expect(refreshed.refreshStatus).toHaveBeenCalled()
    expect(refreshed.refreshBranches).toHaveBeenCalled()
    expect(refreshed.refreshLog).toHaveBeenCalled()
  })

  it('preserves descendant letter case and boundaries on POSIX paths', async () => {
    const moves = [{ from: '/r/Site', to: '/r/acme/Site' }]
    useRepoStore.setState({ currentRepoPath: '/r/Site/Child', selectedRepoPaths: ['/r/site/child', '/r/Site-other/child'] })
    apply.mockResolvedValue(moved(moves[0].from, moves[0].to))

    await useRepoStore.getState().reorganizeRepositories('/r', moves)

    expect(useRepoStore.getState().currentRepoPath).toBe('/r/acme/Site/Child')
    expect(useRepoStore.getState().selectedRepoPaths).toEqual(['/r/site/child', '/r/Site-other/child'])
  })

  it('maps each original path once when one source becomes another account folder', async () => {
    const moves = [{ from: '/r/a', to: '/r/b/a' }, { from: '/r/b', to: '/r/c/b' }]
    useRepoStore.setState({ currentRepoPath: '/r/a/child', selectedRepoPaths: ['/r/a/child', '/r/b/child'] })
    apply.mockResolvedValue({ moved: moves, failed: [], recent })

    await useRepoStore.getState().reorganizeRepositories('/r', moves)

    expect(useRepoStore.getState().currentRepoPath).toBe('/r/b/a/child')
    expect(useRepoStore.getState().selectedRepoPaths).toEqual(['/r/b/a/child', '/r/c/b/child'])
  })
})
