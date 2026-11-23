import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_APP_SETTINGS } from '../src/shared/settings'

// The renderer's tool layer, with the IPC bridge stubbed: only what the
// protected-branch checks touch before they refuse.
const api = {
  github: { getPullRequest: vi.fn() },
  git: { remoteUrl: vi.fn(async () => 'https://github.com/acme/site.git'), branchIntegration: vi.fn(), branches: vi.fn(async () => []) },
  aiLog: { record: vi.fn(async () => null) }
}
vi.stubGlobal('window', { api })

const { AiRuleBlockedError, assertAllowedByRules, prepareToolCall } = await import('../src/renderer/src/lib/ai/tools')
const { useAppSettingsStore } = await import('../src/renderer/src/store/appSettingsStore')
const { useRepoStore } = await import('../src/renderer/src/store/repoStore')
const { usePullRequestStore } = await import('../src/renderer/src/store/pullRequestStore')
const { useAiStore } = await import('../src/renderer/src/store/aiStore')

function protect(...branches: string[]): void {
  useAppSettingsStore.setState({ settings: { ...DEFAULT_APP_SETTINGS, aiProtectedBranches: branches } })
}

function onBranch(statusBranch: string | null, listedCurrent: string): void {
  useRepoStore.setState({
    currentRepoPath: 'C:/r',
    status: statusBranch === null ? null : ({ branch: statusBranch } as never),
    branches: [{ name: listedCurrent, isCurrent: true } as never]
  })
}

beforeEach(() => {
  protect()
  onBranch('feature', 'feature')
  vi.clearAllMocks()
})

describe('protected branches for the assistant', () => {
  it('blocks commit, push, merge and history rewrites on a protected branch, and nothing else', () => {
    protect('main')
    onBranch('main', 'main')
    for (const tool of ['commit', 'push', 'merge_branch', 'undo_last_commit', 'reorganize_local_commits']) {
      expect(() => assertAllowedByRules(tool), tool).toThrow(AiRuleBlockedError)
    }
    expect(() => assertAllowedByRules('create_branch')).not.toThrow()
    expect(() => assertAllowedByRules('switch_branch')).not.toThrow()
  })

  it('trusts the status branch over a stale branch list', () => {
    protect('main')
    // A checkout in a terminal: status already says main, the list still says feature.
    onBranch('main', 'feature')
    expect(() => assertAllowedByRules('commit')).toThrow(AiRuleBlockedError)
  })

  it('applies prefix patterns', () => {
    protect('release/*')
    onBranch('release/2.0', 'release/2.0')
    expect(() => assertAllowedByRules('push')).toThrow(/release\/2\.0/)
  })

  it('refuses to merge a pull request into a protected base', async () => {
    protect('main')
    usePullRequestStore.setState({ remote: { host: 'github.com', owner: 'acme', repo: 'site' }, user: { login: 'me' } } as never)
    api.github.getPullRequest.mockResolvedValue({ number: 42, merged: false, state: 'open', draft: false, baseRef: 'main', headRef: 'feat', mergeable: true })
    await expect(prepareToolCall({ id: '1', name: 'merge_pull_request', arguments: { pull_request_number: '42' } })).rejects.toBeInstanceOf(
      AiRuleBlockedError
    )
  })

  it('refuses to delete a protected branch, patterns included', async () => {
    protect('main', 'release/*')
    await expect(
      prepareToolCall({ id: '1', name: 'delete_merged_branches', arguments: { branch_names: 'old-feature, release/1.0' } })
    ).rejects.toThrow(/release\/1\.0/)
    expect(api.git.branchIntegration).not.toHaveBeenCalled()
  })
})

describe('retry and approval of tool cards', () => {

  function seedFailedCard(name: string, args: Record<string, string>): void {
    useAiStore.setState({
      messages: [
        {
          id: 'm',
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              call: { id: 'c', name, arguments: args },
              preview: { headline: name, fields: [], severity: 'write' },
              resolvedArgs: args,
              status: 'failed',
              result: 'blocked earlier'
            }
          ]
        }
      ]
    })
  }

  const card = () => useAiStore.getState().messages[0].toolCalls![0]

  it('brings a failed write card back for approval instead of running it', async () => {
    seedFailedCard('create_branch', { branch_name: 'feature/novo' })
    await useAiStore.getState().retryToolCall('m', 'c')
    expect(card().status).toBe('pending')
    expect(card().preview.headline).not.toBe('create_branch')
  })

  it('keeps a still-blocked card failed on retry', async () => {
    protect('main')
    onBranch('main', 'main')
    seedFailedCard('commit', { message: 'x' })
    await useAiStore.getState().retryToolCall('m', 'c')
    expect(card().status).toBe('failed')
    expect(card().result).toMatch(/main/)
  })

  it('does nothing when asked to approve a card that is not pending', async () => {
    seedFailedCard('create_branch', { branch_name: 'feature/x' })
    await useAiStore.getState().approveToolCall('m', 'c')
    expect(card().status).toBe('failed')
    expect(card().result).toBe('blocked earlier')
  })
})
