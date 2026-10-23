import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { PROJECT_CO_AUTHOR, PROJECT_CO_AUTHOR_TRAILER, withProjectCoAuthor } from '../src/shared/settings'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))

const { commit } = await import('../src/main/gitProcess')

describe('project co-author trailer in a real commit', () => {
  it('is read by git as a Co-authored-by trailer', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ogd-coauthor-'))
    try {
      const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
      git('init', '-q')
      git('config', 'user.name', 'Test')
      git('config', 'user.email', 'test@example.com')
      writeFileSync(join(repo, 'a.txt'), 'a\n')
      git('add', 'a.txt')

      await commit('Add a', withProjectCoAuthor('Why a exists.'), repo)

      expect(git('log', '-1', '--format=%(trailers:key=Co-authored-by,valueonly)')).toBe(PROJECT_CO_AUTHOR)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})

describe('withProjectCoAuthor', () => {
  it('becomes the whole description when there is none', () => {
    expect(withProjectCoAuthor('')).toBe(PROJECT_CO_AUTHOR_TRAILER)
    expect(withProjectCoAuthor('  \n')).toBe(PROJECT_CO_AUTHOR_TRAILER)
  })

  it('goes after a blank line, so git reads it as a trailer', () => {
    expect(withProjectCoAuthor('Explains the change.\n')).toBe(`Explains the change.\n\n${PROJECT_CO_AUTHOR_TRAILER}`)
  })

  it('joins an existing trailer block instead of starting a new paragraph', () => {
    const description = 'Body.\n\nCo-authored-by: Someone <someone@example.com>'
    expect(withProjectCoAuthor(description)).toBe(`${description}\n${PROJECT_CO_AUTHOR_TRAILER}`)
  })

  it('is never added twice', () => {
    const once = withProjectCoAuthor('Body.')
    expect(withProjectCoAuthor(once)).toBe(once)
    expect(withProjectCoAuthor(once.toUpperCase())).toBe(once.toUpperCase())
  })

  it('credits only the project, never a personal account', () => {
    expect(PROJECT_CO_AUTHOR_TRAILER).toMatch(/^Co-authored-by: OpenGitDesktop </)
    expect(PROJECT_CO_AUTHOR_TRAILER).not.toMatch(/paulocarinhena/i)
  })
})
