import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RepoStatus } from '../src/shared/git'

const diff = vi.fn()
const commitDiff = vi.fn()
const readRepoFile = vi.fn()
vi.stubGlobal('window', { api: { git: { diff, commitDiff }, fs: { readRepoFile } } })
vi.stubGlobal('navigator', { languages: ['pt-BR'] })

const { useRepoStore } = await import('../src/renderer/src/store/repoStore')

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const status: RepoStatus = {
  entries: [
    { path: 'a.ts', index: ' ', worktree: 'M' },
    { path: 'b.ts', index: ' ', worktree: 'M' }
  ],
  branch: 'main',
  ahead: 0,
  behind: 0,
  upstream: 'origin/main'
}

beforeEach(() => {
  diff.mockReset()
  commitDiff.mockReset()
  useRepoStore.setState({
    currentRepoPath: '/repo',
    status,
    selectedFile: null,
    diffText: '',
    conflictContent: null,
    error: null,
    selectedCommit: { hash: 'abc', files: [{ path: 'a.ts', status: 'M' }, { path: 'b.ts', status: 'M' }], selectedPath: null },
    commitDiffText: ''
  })
})

describe('selection races', () => {
  it('keeps the diff of the file clicked last', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    diff.mockImplementation((path: string) => (path === 'a.ts' ? first.promise : second.promise))

    const selectA = useRepoStore.getState().selectFile('a.ts', false)
    const selectB = useRepoStore.getState().selectFile('b.ts', false)
    second.resolve('diff-b')
    await selectB
    first.resolve('diff-a')
    await selectA

    expect(useRepoStore.getState().selectedFile).toMatchObject({ path: 'b.ts', staged: false })
    expect(useRepoStore.getState().diffText).toBe('diff-b')
  })

  it('keeps the commit diff of the file clicked last', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    commitDiff.mockImplementation((_hash: string, path: string) => (path === 'a.ts' ? first.promise : second.promise))

    const selectA = useRepoStore.getState().selectCommitFile('a.ts')
    const selectB = useRepoStore.getState().selectCommitFile('b.ts')
    second.resolve('diff-b')
    await selectB
    first.resolve('diff-a')
    await selectA

    expect(useRepoStore.getState().selectedCommit?.selectedPath).toBe('b.ts')
    expect(useRepoStore.getState().commitDiffText).toBe('diff-b')
  })
})
