import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))
vi.stubGlobal('navigator', { languages: ['pt-BR'] })

const { getConflictDiff3 } = await import('../src/main/gitProcess')
const { attachBaseLines, parseConflictBlocks } = await import('../src/renderer/src/lib/conflicts')

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function commit(cwd: string, content: string, message: string): void {
  writeFileSync(join(cwd, 'config.js'), content)
  git(cwd, 'add', 'config.js')
  git(cwd, 'commit', '-q', '-m', message)
}

const BASE = "const config = {\n  porta: 3000,\n  timeout: 5000,\n  log: 'info'\n}\n"

let repo: string

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'ogd-diff3-'))
  git(repo, 'init', '-q', '-b', 'main')
  commit(repo, BASE, 'base')
  git(repo, 'checkout', '-q', '-b', 'feature')
  commit(repo, BASE.replace('timeout: 5000', 'timeout: 10000'), 'feature')
  git(repo, 'checkout', '-q', 'main')
  commit(repo, BASE.replace('porta: 3000', 'porta: 8080').replace("'info'", "'warn'"), 'main')
  try {
    git(repo, 'merge', 'feature')
  } catch {
    // expected: the merge stops on the conflict
  }
})

afterEach(() => rmSync(repo, { recursive: true, force: true }))

describe('getConflictDiff3', () => {
  it('rebuilds the conflict with the merge-base lines, leaving the working file alone', async () => {
    const before = readFileSync(join(repo, 'config.js'), 'utf8')
    const diff3 = await getConflictDiff3(repo, 'config.js')

    expect(diff3).toContain('||||||| base')
    expect(readFileSync(join(repo, 'config.js'), 'utf8')).toBe(before)

    const blocks = attachBaseLines(parseConflictBlocks(before), diff3!)
    const block = blocks.find((b) => b.type === 'conflict')
    expect(block?.type === 'conflict' && block.base).toEqual(['  porta: 3000,', '  timeout: 5000,', "  log: 'info'"])
  })

  it('matches the working file when both sides add the same lines (zdiff3)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ogd-zdiff3-'))
    try {
      git(dir, 'init', '-q', '-b', 'main')
      const write = (body: string, msg: string): void => {
        writeFileSync(join(dir, 'f.txt'), body)
        git(dir, 'add', 'f.txt')
        git(dir, 'commit', '-q', '-m', msg)
      }
      write('k1\na\nk2\n', 'base')
      git(dir, 'checkout', '-q', '-b', 'other')
      write('k1\nx\nz\nk2\n', 'other')
      git(dir, 'checkout', '-q', 'main')
      write('k1\nx\ny\nk2\n', 'main')
      try {
        git(dir, 'merge', 'other')
      } catch {
        // expected conflict
      }
      const working = readFileSync(join(dir, 'f.txt'), 'utf8')
      const diff3 = await getConflictDiff3(dir, 'f.txt')
      const block = attachBaseLines(parseConflictBlocks(working), diff3!).find((b) => b.type === 'conflict')
      expect(block?.type === 'conflict' && block.base).toEqual(['a'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns null for a file that is not in conflict', async () => {
    writeFileSync(join(repo, 'other.txt'), 'x\n')
    expect(await getConflictDiff3(repo, 'other.txt')).toBeNull()
  })
})
