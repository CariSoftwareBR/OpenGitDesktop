import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseDecorations, parseRebasePlan, validateRebasePlan } from '../src/shared/gitParsing'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))

const {
  createTag,
  getCommitRange,
  getFileBlame,
  getFileTimeline,
  getGraphLog,
  getLatestTag,
  getLocalRebaseInfo,
  getLogWithStats,
  getRefsContaining,
  listTags,
  runLocalRebase
} = await import('../src/main/gitProcess')

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function commitFile(cwd: string, name: string, content: string, message: string): string {
  writeFileSync(join(cwd, name), content)
  git(cwd, 'add', name)
  git(cwd, 'commit', '-q', '-m', message)
  return git(cwd, 'rev-parse', 'HEAD')
}

describe('parseDecorations', () => {
  it('reads current, local, remote and tag refs and drops remote HEAD', () => {
    const refs = parseDecorations('HEAD -> refs/heads/main, refs/remotes/origin/main, refs/remotes/origin/HEAD, tag: refs/tags/v1.0')
    expect(refs).toEqual([
      { name: 'main', kind: 'local', current: true },
      { name: 'origin/main', kind: 'remote' },
      { name: 'v1.0', kind: 'tag' }
    ])
  })

  it('keeps a local branch whose name looks like a remote one local', () => {
    expect(parseDecorations('refs/heads/origin/x')).toEqual([{ name: 'origin/x', kind: 'local' }])
  })

  it('marks a detached HEAD', () => {
    expect(parseDecorations('HEAD, refs/stash')).toEqual([{ name: 'HEAD', kind: 'head' }])
  })
})

describe('rebase plans', () => {
  const local = ['aaaa1111'.padEnd(40, '0'), 'bbbb2222'.padEnd(40, '0'), 'cccc3333'.padEnd(40, '0')]

  it('parses actions, aliases and reword messages', () => {
    expect(parseRebasePlan('# comment\npick aaaa111\ns bbbb222\nreword cccc333 Novo título\n')).toEqual([
      { hash: 'aaaa111', action: 'pick' },
      { hash: 'bbbb222', action: 'squash' },
      { hash: 'cccc333', action: 'reword', message: 'Novo título' }
    ])
    expect(() => parseRebasePlan('explode aaaa111')).toThrow()
  })

  it('expands short hashes and requires every local commit once', () => {
    const ok = validateRebasePlan(parseRebasePlan('pick aaaa\nfixup cccc\ndrop bbbb'), local)
    expect(ok.ok && ok.steps.map((s) => s.hash)).toEqual([local[0], local[2], local[1]])
    expect(validateRebasePlan(parseRebasePlan('pick aaaa\npick bbbb'), local)).toMatchObject({ ok: false, problem: { kind: 'missing' } })
    expect(validateRebasePlan(parseRebasePlan('pick aaaa\npick aaaa\npick bbbb\npick cccc'), local)).toMatchObject({
      ok: false,
      problem: { kind: 'duplicate' }
    })
    expect(validateRebasePlan(parseRebasePlan('squash aaaa\npick bbbb\npick cccc'), local)).toMatchObject({
      ok: false,
      problem: { kind: 'squashFirst' }
    })
    expect(validateRebasePlan(parseRebasePlan('drop aaaa\ndrop bbbb\ndrop cccc'), local)).toMatchObject({
      ok: false,
      problem: { kind: 'nothingKept' }
    })
  })
})

describe('git history features', () => {
  let repo: string
  let remote: string

  beforeEach(() => {
    remote = mkdtempSync(join(tmpdir(), 'ogd-graph-remote-'))
    git(remote, 'init', '-q', '--bare', '-b', 'main')
    repo = mkdtempSync(join(tmpdir(), 'ogd-graph-'))
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'config', 'user.name', 'Test')
    git(repo, 'config', 'user.email', 'test@example.com')
    git(repo, 'config', 'commit.gpgsign', 'false')
    git(repo, 'config', 'tag.gpgsign', 'false')
    git(repo, 'remote', 'add', 'origin', remote)
    commitFile(repo, 'a.txt', 'one\n', 'initial')
    commitFile(repo, 'a.txt', 'one\ntwo\n', 'second')
    git(repo, 'push', '-q', '-u', 'origin', 'main')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
    rmSync(remote, { recursive: true, force: true })
  })

  it('returns every branch with parents and refs for the graph', async () => {
    git(repo, 'checkout', '-q', '-b', 'feature')
    commitFile(repo, 'f.txt', 'f\n', 'feature work')
    git(repo, 'checkout', '-q', 'main')
    commitFile(repo, 'm.txt', 'm\n', 'main work')
    git(repo, 'merge', '-q', '--no-ff', '-m', 'merge feature', 'feature')
    git(repo, 'tag', 'v1')

    const graph = await getGraphLog(repo)
    expect(graph.map((c) => c.summary)).toEqual(['merge feature', 'main work', 'feature work', 'second', 'initial'])
    expect(graph[0].parents).toHaveLength(2)
    expect(graph[0].refs).toEqual([
      { name: 'main', kind: 'local', current: true },
      { name: 'v1', kind: 'tag' }
    ])
    expect(graph[2].refs).toEqual([{ name: 'feature', kind: 'local' }])
    expect(graph[3].refs).toEqual([{ name: 'origin/main', kind: 'remote' }])
  })

  it('reports stats, ranges, containing refs, blame and the file timeline', async () => {
    const third = commitFile(repo, 'a.txt', 'one\nTWO\nthree\n', 'third')
    const stats = await getLogWithStats(repo, 5)
    expect(stats[0]).toMatchObject({ summary: 'third', additions: 2, deletions: 1, files: 1 })

    const local = await getCommitRange(repo, 'HEAD', null)
    expect(local.total).toBe(1)
    expect(local.commits[0].hash).toBe(third)
    expect((await getCommitRange(repo, 'HEAD', 'origin/main')).total).toBe(1)

    const containing = await getRefsContaining(repo, 'HEAD~1')
    expect(containing.map((r) => r.name).sort()).toEqual(['main', 'origin/main'])

    const blame = await getFileBlame(repo, 'a.txt')
    expect(blame.lines.map((l) => l.content)).toEqual(['one', 'TWO', 'three'])
    expect(blame.commits[blame.lines[0].hash].summary).toBe('initial')
    expect(blame.commits[blame.lines[1].hash].summary).toBe('third')

    const timeline = await getFileTimeline(repo, 'a.txt')
    expect(timeline.map((e) => e.summary)).toEqual(['third', 'second', 'initial'])
    expect(timeline[0]).toMatchObject({ additions: 2, deletions: 1 })
  })

  it('creates annotated tags and finds the latest one', async () => {
    const created = await createTag(repo, 'v0.1.0', 'HEAD~1', 'Primeira versão')
    expect(created).toMatchObject({ name: 'v0.1.0', annotated: true, message: 'Primeira versão' })
    expect(created.target).toBe(git(repo, 'rev-parse', 'HEAD~1'))
    await expect(createTag(repo, 'v0.1.0')).rejects.toThrow()
    await expect(createTag(repo, 'bad..name')).rejects.toThrow()
    expect((await listTags(repo)).map((t) => t.name)).toEqual(['v0.1.0'])
    expect(await getLatestTag(repo)).toBe('v0.1.0')
  })

  it('only offers unpublished commits and reorganizes them', async () => {
    const c3 = commitFile(repo, 'b.txt', 'b\n', 'WIP 1')
    const c4 = commitFile(repo, 'b.txt', 'b\nb2\n', 'WIP 2')
    const c5 = commitFile(repo, 'c.txt', 'c\n', 'add c')
    const published = git(repo, 'rev-parse', 'origin/main')

    const info = await getLocalRebaseInfo(repo)
    expect(info.blocked).toBeNull()
    expect(info.base).toBe(published)
    expect(info.commits.map((c) => c.hash)).toEqual([c3, c4, c5])

    const result = await runLocalRebase(
      repo,
      [
        { hash: c5, action: 'pick' },
        { hash: c3, action: 'reword', message: 'Arquivo b' },
        { hash: c4, action: 'fixup' }
      ],
      c5
    )
    expect(result.commitCount).toBe(2)
    expect(git(repo, 'log', '--format=%s', '-n', '3')).toBe('Arquivo b\nadd c\nsecond')
    expect(git(repo, 'rev-parse', 'HEAD~2')).toBe(published)
    expect(git(repo, 'symbolic-ref', '--short', 'HEAD')).toBe('main')
    expect(git(repo, 'show', 'HEAD:b.txt')).toBe('b\nb2')
    expect(git(repo, 'status', '--porcelain')).toBe('')
  })

  it('rolls back completely when a step conflicts', async () => {
    const c3 = commitFile(repo, 'a.txt', 'one\ntwo\nX\n', 'change line 3')
    const c4 = commitFile(repo, 'a.txt', 'one\ntwo\nY\n', 'change it again')
    await expect(
      runLocalRebase(
        repo,
        [
          { hash: c4, action: 'pick' },
          { hash: c3, action: 'pick' }
        ],
        c4
      )
    ).rejects.toThrow()
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(c4)
    expect(git(repo, 'symbolic-ref', '--short', 'HEAD')).toBe('main')
    expect(git(repo, 'status', '--porcelain')).toBe('')
  })

  it('refuses a plan built for another head and a dirty tree', async () => {
    const c3 = commitFile(repo, 'b.txt', 'b\n', 'one')
    const c4 = commitFile(repo, 'b.txt', 'b\nc\n', 'two')
    await expect(runLocalRebase(repo, [{ hash: c3, action: 'pick' }, { hash: c4, action: 'pick' }], c3)).rejects.toThrow()
    writeFileSync(join(repo, 'b.txt'), 'dirty\n')
    expect((await getLocalRebaseInfo(repo)).blocked).toBe('dirty')
  })
})
