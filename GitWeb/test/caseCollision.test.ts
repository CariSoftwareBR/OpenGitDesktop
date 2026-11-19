import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { trashItem } = vi.hoisted(() => ({ trashItem: vi.fn() }))
vi.mock('electron', () => ({ shell: { trashItem } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))
vi.stubGlobal('navigator', { languages: ['pt-BR'] })

const { getStatus, resolveCaseCollision } = await import('../src/main/gitProcess')
const { groupCaseCollisions, parseLsFilesStage } = await import('../src/shared/gitParsing')
const { CASE_COLLISION_DISK_SOURCE } = await import('../src/shared/git')

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim()
}

// The collision only exists on a disk that folds case (Windows, macOS).
const probe = mkdtempSync(join(tmpdir(), 'ogd-case-probe-'))
writeFileSync(join(probe, 'a'), '')
const caseInsensitiveDisk = existsSync(join(probe, 'A'))
rmSync(probe, { recursive: true, force: true })

const FULL = '# AGENTS\n\nregras do projeto\n\n<!-- BEGIN:nextjs-agent-rules -->\nnext\n'
const NEXT_ONLY = '<!-- BEGIN:nextjs-agent-rules -->\nnext\n'

let repo: string

function indexPaths(): string[] {
  return git(repo, 'ls-files', 'front').split('\n').filter(Boolean)
}

function diskNames(): string[] {
  return readdirSync(join(repo, 'front'))
}

beforeEach(() => {
  trashItem.mockReset()
  trashItem.mockImplementation(async (target: string) => rmSync(target, { force: true }))
  repo = mkdtempSync(join(tmpdir(), 'ogd-case-'))
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'config', 'core.autocrlf', 'false')
  mkdirSync(join(repo, 'front'))
  writeFileSync(join(repo, 'front', 'agents.md'), FULL)
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', 'lower')
  // The second name only enters through the index, as it would from a Linux commit.
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, input: NEXT_ONLY, encoding: 'utf8' }).trim()
  git(repo, 'update-index', '--add', '--cacheinfo', `100644,${blob},front/AGENTS.md`)
  git(repo, 'commit', '-q', '-m', 'upper')
  // What the Dublagem checkout had: one file, named AGENTS.md, with the short version.
  rmSync(join(repo, 'front', 'agents.md'))
  writeFileSync(join(repo, 'front', 'AGENTS.md'), NEXT_ONLY)
})

afterEach(() => rmSync(repo, { recursive: true, force: true }))

describe('groupCaseCollisions', () => {
  it('groups paths that differ only in case and leaves conflicted entries out', () => {
    const raw = [
      '100644 aaa 0\tfront/AGENTS.md',
      '100644 bbb 0\tfront/agents.md',
      '100644 ccc 0\tsrc/index.ts',
      '100644 ddd 1\tREADME.md',
      '100644 eee 2\treadme.md'
    ].join('\0')
    const groups = groupCaseCollisions(parseLsFilesStage(raw + '\0'))
    expect(groups.map((g) => g.map((e) => e.path))).toEqual([['front/AGENTS.md', 'front/agents.md']])
  })
})

describe.skipIf(!caseInsensitiveDisk)('case collisions on a case-insensitive disk', () => {
  it('shows up in the status with each version and what is on disk', async () => {
    const status = await getStatus(repo)
    expect(status.caseCollisions).toHaveLength(1)
    const [collision] = status.caseCollisions!
    expect(collision.diskPath).toBe('front/AGENTS.md')
    expect(collision.diskEdited).toBe(false)
    const byPath = Object.fromEntries(collision.versions.map((v) => [v.path, v]))
    expect(byPath['front/agents.md']).toMatchObject({ lines: 6, onDisk: false })
    expect(byPath['front/AGENTS.md']).toMatchObject({ lines: 2, onDisk: true })
  })

  it('keeps one name with the content of the other version, staged', async () => {
    await resolveCaseCollision(repo, 'front/AGENTS.md', 'front/agents.md')

    expect(indexPaths()).toEqual(['front/AGENTS.md'])
    expect(diskNames()).toEqual(['AGENTS.md'])
    expect(readFileSync(join(repo, 'front', 'AGENTS.md'), 'utf8')).toBe(FULL)
    expect(git(repo, 'status', '--porcelain')).toBe('M  front/AGENTS.md\nD  front/agents.md')
    expect(trashItem).not.toHaveBeenCalled()
    expect((await getStatus(repo)).caseCollisions).toBeUndefined()
  })

  it('renames the disk file when the kept name has another case', async () => {
    await resolveCaseCollision(repo, 'front/agents.md', 'front/agents.md')

    expect(indexPaths()).toEqual(['front/agents.md'])
    expect(diskNames()).toEqual(['agents.md'])
    expect(readFileSync(join(repo, 'front', 'agents.md'), 'utf8')).toBe(FULL)
  })

  it('keeps edits made on disk when asked to, under the chosen name', async () => {
    writeFileSync(join(repo, 'front', 'AGENTS.md'), 'editado\n')
    const [collision] = (await getStatus(repo)).caseCollisions!
    expect(collision.diskEdited).toBe(true)
    expect(collision.diskLines).toBe(1)

    await resolveCaseCollision(repo, 'front/agents.md', CASE_COLLISION_DISK_SOURCE)

    expect(indexPaths()).toEqual(['front/agents.md'])
    expect(diskNames()).toEqual(['agents.md'])
    expect(git(repo, 'show', ':front/agents.md')).toBe('editado')
  })

  it('sends disk edits found in no version to the trash before writing another version', async () => {
    writeFileSync(join(repo, 'front', 'AGENTS.md'), 'editado\n')

    await resolveCaseCollision(repo, 'front/AGENTS.md', 'front/agents.md')

    expect(trashItem).toHaveBeenCalledOnce()
    expect(readFileSync(join(repo, 'front', 'AGENTS.md'), 'utf8')).toBe(FULL)
  })

  it('refuses a path that is not part of a collision', async () => {
    await resolveCaseCollision(repo, 'front/AGENTS.md', 'front/agents.md')
    await expect(resolveCaseCollision(repo, 'front/AGENTS.md', 'front/agents.md')).rejects.toThrow(/maiúsculas/)
  })
})

describe('repository context for the AI', () => {
  it('lists case collisions and points to fix_case_collision instead of restore', async () => {
    const { formatRepoContext } = await import('../src/shared/aiPrompts')
    const text = formatRepoContext('pt-BR', {
      repoPath: 'C:/repo',
      branch: 'main',
      upstream: null,
      statusLines: ' M front/agents.md',
      lastCommits: '',
      caseCollisions: [
        {
          versions: [
            { path: 'front/AGENTS.md', blob: 'a', mode: '100644', lines: 9, onDisk: true },
            { path: 'front/agents.md', blob: 'b', mode: '100644', lines: 67, onDisk: false }
          ],
          diskPath: 'front/AGENTS.md',
          diskEdited: false,
          diskLines: null
        }
      ]
    })
    expect(text).toContain('fix_case_collision')
    expect(text).toContain('- front/AGENTS.md (9 linhas, mesmo conteúdo do arquivo no disco) | front/agents.md (67 linhas); nome do arquivo no disco: front/AGENTS.md')
  })
})
