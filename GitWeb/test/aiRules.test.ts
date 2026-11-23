import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_APP_SETTINGS, isProtectedBranch, sanitizeBranchList } from '../src/shared/settings'
import { MAX_AI_ACTION_LOG, appendToLog, sanitizeLog, sanitizeNewEntry, type AiActionEntry } from '../src/shared/aiActionLog'
import { formatRepoContext } from '../src/shared/aiPrompts'

const userData = mkdtempSync(join(tmpdir(), 'ogd-ailog-'))
mkdirSync(userData, { recursive: true })
vi.mock('electron', () => ({ app: { getPath: () => userData } }))

const { clearAiActions, listAiActions, recordAiAction } = await import('../src/main/aiActionLog')

afterAll(() => rmSync(userData, { recursive: true, force: true }))

describe('protected branches', () => {
  it('defaults to none, so nothing changes for existing users', () => {
    expect(DEFAULT_APP_SETTINGS.aiProtectedBranches).toEqual([])
    expect(DEFAULT_APP_SETTINGS.aiConfirmDanger).toBe(false)
  })

  it('matches exact names and trailing-* prefixes', () => {
    const list = ['main', 'release/*']
    expect(isProtectedBranch('main', list)).toBe(true)
    expect(isProtectedBranch('main-old', list)).toBe(false)
    expect(isProtectedBranch('release/1.2', list)).toBe(true)
    expect(isProtectedBranch('releases', list)).toBe(false)
    expect(isProtectedBranch(null, list)).toBe(false)
    expect(isProtectedBranch('anything', ['*'])).toBe(true)
  })

  it('cleans the saved list', () => {
    expect(sanitizeBranchList([' main ', 'main', '', '-x', 'bad name', 'a*b', 'release/*', 42, 'feat~1'])).toEqual(['main', 'release/*'])
    expect(sanitizeBranchList('main')).toEqual([])
  })

  it('tells the model which branches are off limits', () => {
    const context = formatRepoContext('pt-BR', {
      repoPath: 'C:/r',
      branch: 'main',
      upstream: null,
      statusLines: '',
      lastCommits: '',
      protectedBranches: ['main', 'release/*']
    })
    expect(context).toContain('Branches protegidas pelo usuário: main, release/*')
    expect(formatRepoContext('en', { repoPath: 'C:/r', branch: 'x', upstream: null, statusLines: '', lastCommits: '' })).not.toContain(
      'protected'
    )
  })
})

describe('AI action log', () => {
  const base = { repoPath: 'C:/r', tool: 'push', headline: 'Push main', severity: 'danger', decision: 'approved', outcome: 'completed', detail: 'ok' }

  it('accepts only complete entries and drops the outcome of non-approved ones', () => {
    expect(sanitizeNewEntry(base)).toMatchObject({ tool: 'push', outcome: 'completed' })
    expect(sanitizeNewEntry({ ...base, decision: 'rejected' })).toMatchObject({ decision: 'rejected', outcome: null })
    expect(sanitizeNewEntry({ ...base, severity: 'read' })).toBeNull()
    expect(sanitizeNewEntry({ ...base, decision: 'maybe' })).toBeNull()
    expect(sanitizeNewEntry(null)).toBeNull()
  })

  it('shortens long details', () => {
    const entry = sanitizeNewEntry({ ...base, detail: 'x'.repeat(5000) })
    expect(entry?.detail?.length).toBeLessThan(700)
    expect(entry?.detail?.endsWith('…')).toBe(true)
  })

  it('keeps the newest entries first and caps the size', () => {
    let log: AiActionEntry[] = []
    for (let i = 0; i < MAX_AI_ACTION_LOG + 5; i++) {
      log = appendToLog(log, { ...(sanitizeNewEntry(base) as AiActionEntry), id: String(i), at: new Date(i * 1000).toISOString() })
    }
    expect(log).toHaveLength(MAX_AI_ACTION_LOG)
    expect(log[0].id).toBe(String(MAX_AI_ACTION_LOG + 4))
    expect(sanitizeLog([{ ...base, id: 'x', at: 'not a date' }, 'junk'])).toEqual([])
  })

  it('persists, lists and clears through app data', async () => {
    await clearAiActions()
    const first = await recordAiAction({ ...base, headline: 'first' })
    const second = await recordAiAction({ ...base, headline: 'second', decision: 'blocked' })
    expect(first?.id).toBeTruthy()
    expect(second?.outcome).toBeNull()
    expect(await recordAiAction({ tool: '' })).toBeNull()

    const listed = await listAiActions()
    expect(listed.map((e) => e.headline)).toEqual(['second', 'first'])

    await clearAiActions()
    expect(await listAiActions()).toEqual([])
  })
})
