import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { isGitVersionAtLeast, isSshRemote, parseGitVersion, sortChecks, type DiagnosticCheck } from '../src/shared/diagnostics'

const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ogd-diag-')))
const globalConfig = join(root, 'global.gitconfig')
process.env.GIT_CONFIG_GLOBAL = globalConfig
process.env.GIT_CONFIG_NOSYSTEM = '1'

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))
vi.mock('../src/main/httpFetch', () => ({ httpFetch: vi.fn() }))

const { applyDiagnosticFix, runDiagnostics } = await import('../src/main/diagnostics')

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('shared/diagnostics', () => {
  it('reads git versions, Windows builds included', () => {
    expect(parseGitVersion('git version 2.56.1.windows.1')).toEqual([2, 56, 1])
    expect(parseGitVersion('git version 2.39.5 (Apple Git-154)')).toEqual([2, 39, 5])
    expect(parseGitVersion('git version 2.40')).toEqual([2, 40, 0])
    expect(parseGitVersion('nope')).toBeNull()
    expect(isGitVersionAtLeast([2, 36, 0], [2, 36])).toBe(true)
    expect(isGitVersionAtLeast([2, 35, 9], [2, 36])).toBe(false)
    expect(isGitVersionAtLeast([3, 0, 0], [2, 36])).toBe(true)
  })

  it('tells SSH remotes from the others', () => {
    expect(isSshRemote('git@github.com:acme/site.git')).toBe(true)
    expect(isSshRemote('ssh://git@host:2222/acme/site.git')).toBe(true)
    expect(isSshRemote('https://github.com/acme/site.git')).toBe(false)
    expect(isSshRemote('https://user@github.com/acme/site.git')).toBe(false)
    expect(isSshRemote('C:\\repos\\site')).toBe(false)
    expect(isSshRemote(null)).toBe(false)
  })

  it('puts problems first', () => {
    const make = (id: DiagnosticCheck['id'], status: DiagnosticCheck['status']): DiagnosticCheck => ({ id, status, reason: 'ok', value: null, fix: null })
    const sorted = sortChecks([make('git', 'ok'), make('github', 'error'), make('lfs', 'info'), make('identity', 'warn')])
    expect(sorted.map((c) => c.id)).toEqual(['github', 'identity', 'lfs', 'git'])
  })
})

describe('main/diagnostics with real git', () => {
  beforeEach(() => {
    rmSync(globalConfig, { force: true })
  })

  it('runs every check and finds git, a missing identity and the GitHub sign-in state', async () => {
    const checks = await runDiagnostics(null)
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]))
    expect(byId.git.status).toBe('ok')
    expect(byId.git.value).toMatch(/^\d+\.\d+/)
    expect(byId.identity).toMatchObject({ status: 'warn', reason: 'missingBoth' })
    expect(byId.github).toMatchObject({ status: 'info', reason: 'notSignedIn' })
    // No repository: nothing repository-specific is checked.
    expect(byId.safeDirectory).toBeUndefined()
    expect(byId.ssh).toBeUndefined()
    // Problems come first.
    expect(checks[0].status === 'warn' || checks[0].status === 'error').toBe(true)
  })

  it('sees a complete identity', async () => {
    git(root, 'config', '--global', 'user.name', 'Ana')
    git(root, 'config', '--global', 'user.email', 'ana@x.com')
    const identity = (await runDiagnostics(null)).find((c) => c.id === 'identity')
    expect(identity).toMatchObject({ status: 'ok', value: 'Ana <ana@x.com>' })
  })

  it('checks ssh only when the repository remote uses it, and flags LFS used but missing', async () => {
    const repo = join(root, 'repo')
    mkdirSync(repo, { recursive: true })
    git(repo, 'init', '-q')
    git(repo, 'remote', 'add', 'origin', 'git@github.com:acme/site.git')
    writeFileSync(join(repo, '.gitattributes'), '*.psd filter=lfs diff=lfs merge=lfs -text\n')
    const checks = await runDiagnostics(repo)
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]))
    expect(byId.safeDirectory).toMatchObject({ status: 'ok' })
    expect(byId.ssh).toBeDefined()
    // Either git-lfs is installed here (ok) or the repository needs it (error) — never the quiet "info".
    expect(['ok', 'error']).toContain(byId.lfs.status)
  })

  it.runIf(process.platform === 'win32')('offers and applies the long-paths fix on Windows', async () => {
    const before = (await runDiagnostics(null)).find((c) => c.id === 'longPaths')
    expect(before).toMatchObject({ status: 'warn', fix: { id: 'enableLongPaths', command: 'git config --global core.longpaths true' } })
    const after = (await applyDiagnosticFix('enableLongPaths', null)).find((c) => c.id === 'longPaths')
    expect(after).toMatchObject({ status: 'ok', fix: null })
    expect(git(root, 'config', '--global', 'core.longpaths')).toBe('true')
  })

  it('refuses unknown fixes', async () => {
    // @ts-expect-error — the renderer can only name known fixes, but main must not trust that.
    await expect(applyDiagnosticFix('rm -rf', null)).rejects.toThrow()
  })
})
