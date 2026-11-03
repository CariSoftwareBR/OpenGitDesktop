import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanitizeRepositoryName } from '../src/shared/github'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() }, app: { getPath: () => tmpdir() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))
const settings = { sensitiveCheck: true, sensitiveCheckMode: 'block' as 'block' | 'warn' }
vi.mock('../src/main/settings', () => ({ getSettings: vi.fn(async () => settings) }))

// The GitHub side: "creates" the repository as a local bare repo, so the
// push at the end is real.
let bareRemote = ''
const createRepository = vi.fn(async (_host: string, input: { owner: string; name: string }) => ({
  fullName: `${input.owner}/${input.name}`,
  htmlUrl: `https://github.com/${input.owner}/${input.name}`,
  cloneUrl: bareRemote
}))
vi.mock('../src/main/githubApi', () => ({ createRepository }))

const { publishRepository } = await import('../src/main/publishRepository')
const { scanHistory } = await import('../src/main/sensitiveScan')

function makeRepo(): { dir: string; git: (...args: string[]) => string } {
  const dir = mkdtempSync(join(tmpdir(), 'ogd-publish-'))
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'Test')
  git('config', 'user.email', 'test@example.com')
  return { dir, git }
}

const input = { owner: 'paulo', name: 'Meu Projeto', description: '', private: true }

describe('sanitizeRepositoryName', () => {
  it('keeps what GitHub accepts and turns spaces into dashes', () => {
    expect(sanitizeRepositoryName('  Meu Projeto  ')).toBe('Meu-Projeto')
    expect(sanitizeRepositoryName('loja.v2_final')).toBe('loja.v2_final')
    expect(sanitizeRepositoryName('ação/teste!')).toBe('aoteste')
  })
})

describe('publishRepository', () => {
  beforeEach(() => {
    createRepository.mockClear()
    settings.sensitiveCheckMode = 'block'
  })

  it('refuses before creating anything when there are no commits or there is already an origin', async () => {
    const { dir, git } = makeRepo()
    try {
      await expect(publishRepository(dir, input)).rejects.toThrow(/commit/i)
      git('commit', '-q', '--allow-empty', '-m', 'init')
      git('remote', 'add', 'origin', 'https://example.com/x.git')
      await expect(publishRepository(dir, input)).rejects.toThrow(/origin/)
      expect(createRepository).not.toHaveBeenCalled()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('blocks on a secret anywhere in the history, even one deleted later', async () => {
    const { dir, git } = makeRepo()
    try {
      writeFileSync(join(dir, '.env'), 'DB=postgres://u:p@localhost/db\n')
      git('add', '.env')
      git('commit', '-q', '-m', 'add env')
      unlinkSync(join(dir, '.env'))
      git('commit', '-q', '-am', 'remove env')

      expect(await scanHistory(dir)).toEqual([{ path: '.env', kind: 'envFile' }])
      await expect(publishRepository(dir, input)).rejects.toThrow('.env')
      expect(createRepository).not.toHaveBeenCalled()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('creates the repository, sets origin and pushes the branch with upstream', async () => {
    const { dir, git } = makeRepo()
    const bare = mkdtempSync(join(tmpdir(), 'ogd-publish-remote-'))
    try {
      execFileSync('git', ['init', '-q', '--bare', bare])
      bareRemote = bare
      writeFileSync(join(dir, 'README.md'), '# Demo\n')
      git('add', '.')
      git('commit', '-q', '-m', 'init')

      const result = await publishRepository(dir, input)
      expect(result).toEqual({ fullName: 'paulo/Meu-Projeto', htmlUrl: 'https://github.com/paulo/Meu-Projeto', branch: 'main' })
      expect(createRepository).toHaveBeenCalledWith('github.com', { owner: 'paulo', name: 'Meu-Projeto', description: '', private: true })
      expect(git('remote', 'get-url', 'origin')).toBe(bare)
      expect(git('rev-parse', '--abbrev-ref', 'main@{upstream}')).toBe('origin/main')
      expect(execFileSync('git', ['--git-dir', bare, 'log', '--format=%s', 'main'], { encoding: 'utf8' }).trim()).toBe('init')
    } finally {
      rmSync(dir, { recursive: true, force: true })
      rmSync(bare, { recursive: true, force: true })
    }
  })
})
