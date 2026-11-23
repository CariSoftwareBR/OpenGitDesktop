import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  gitdirPattern,
  githubNoreplyEmail,
  identityProblem,
  includeIfKey,
  isValidEmail,
  sanitizeProfiles,
  type IdentityProfile,
  type RepoIdentity
} from '../src/shared/identity'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../src/shared/settings'

// A real git, but never the developer's own config: a throwaway global file,
// no system file, and app data in a temp folder.
const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ogd-identity-')))
const userData = join(root, 'appdata')
const globalConfig = join(root, 'global.gitconfig')
mkdirSync(userData, { recursive: true })
process.env.GIT_CONFIG_GLOBAL = globalConfig
process.env.GIT_CONFIG_NOSYSTEM = '1'

let stored: AppSettings = { ...DEFAULT_APP_SETTINGS }
vi.mock('electron', () => ({ app: { getPath: () => userData }, shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))
vi.mock('../src/main/settings', () => ({
  getSettings: vi.fn(async () => stored),
  setAppSettings: vi.fn(async (partial: Partial<AppSettings>) => {
    stored = { ...stored, ...partial }
    return stored
  })
}))

const { applyProfileToRepo, getIdentityOverview, getRepoIdentity, parseOriginLine, saveIdentityProfiles, setGlobalIdentity } = await import(
  '../src/main/gitIdentity'
)

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function newRepo(...segments: string[]): string {
  const dir = join(root, ...segments)
  mkdirSync(dir, { recursive: true })
  git(dir, 'init', '-q')
  return dir
}

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('shared/identity', () => {
  it('builds the GitHub no-reply address', () => {
    expect(githubNoreplyEmail(42, 'octocat')).toBe('42+octocat@users.noreply.github.com')
  })

  it('writes the includeIf condition git expects', () => {
    expect(gitdirPattern('C:\\Github\\Acme\\')).toBe('C:/Github/Acme/')
    expect(includeIfKey('C:\\Github\\Acme', 'win32')).toBe('includeIf.gitdir/i:C:/Github/Acme/.path')
    expect(includeIfKey('/home/me/acme', 'linux')).toBe('includeIf.gitdir:/home/me/acme/.path')
  })

  it('validates e-mails loosely, like git', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('1+x@users.noreply.github.com')).toBe(true)
    expect(isValidEmail('no-at-sign')).toBe(false)
    expect(isValidEmail('a b@c.d')).toBe(false)
  })

  it('drops malformed and duplicated profiles', () => {
    const profiles = sanitizeProfiles([
      { id: 'a', account: 'acme', folder: null, name: 'Ana', email: 'ana@acme.com' },
      { id: 'a', account: 'dup', folder: null, name: 'Dup', email: 'dup@acme.com' },
      { id: 'b', name: 'Sem email', email: 'nope' },
      { id: 'c', name: '<bad>', email: 'c@c.com' },
      'garbage'
    ])
    expect(profiles.map((p) => p.id)).toEqual(['a'])
  })

  describe('identityProblem', () => {
    const profile: IdentityProfile = { id: 'p', account: 'Acme', folder: null, name: 'Ana', email: 'ana@acme.com' }
    const repo = (patch: Partial<RepoIdentity>): RepoIdentity => ({
      name: 'Ana',
      email: 'ana@acme.com',
      source: 'global',
      profileId: null,
      remoteOwner: 'acme',
      ...patch
    })

    it('says nothing when the e-mail matches the account profile (case-insensitive)', () => {
      expect(identityProblem(repo({ email: 'ANA@acme.com' }), [profile])).toBeNull()
    })

    it('flags a repository of the account committing with another e-mail', () => {
      expect(identityProblem(repo({ email: 'ana@personal.dev' }), [profile])).toEqual({ kind: 'mismatch', profile })
    })

    it('does not guess when no profile names the owner', () => {
      expect(identityProblem(repo({ email: 'x@y.z', remoteOwner: 'someone-else' }), [profile])).toBeNull()
    })

    it('flags a missing identity', () => {
      expect(identityProblem(repo({ email: null }), [])).toEqual({ kind: 'missing' })
    })
  })
})

describe('main/gitIdentity with real git', () => {
  beforeEach(() => {
    rmSync(globalConfig, { force: true })
    stored = { ...DEFAULT_APP_SETTINGS }
    git(root, 'config', '--global', 'user.name', 'Global Person')
    git(root, 'config', '--global', 'user.email', 'global@example.com')
  })

  it('parses show-origin output, including paths with spaces', () => {
    expect(parseOriginLine('global\tfile:C:/Users/a b/.gitconfig\tme@x.com\n')).toEqual({
      scope: 'global',
      origin: 'C:/Users/a b/.gitconfig',
      value: 'me@x.com'
    })
    expect(parseOriginLine('nonsense')).toBeNull()
  })

  it('reports the global identity for a plain repository', async () => {
    const repo = newRepo('plain')
    git(repo, 'remote', 'add', 'origin', 'https://github.com/someone/plain.git')
    const identity = await getRepoIdentity(repo)
    expect(identity).toMatchObject({ name: 'Global Person', email: 'global@example.com', source: 'global', remoteOwner: 'someone' })
  })

  it('applies a folder profile to every repository under the folder (with spaces in the path)', async () => {
    const folder = join(root, 'Acme Corp')
    const inside = newRepo('Acme Corp', 'site')
    const outside = newRepo('elsewhere')
    const profile: IdentityProfile = { id: 'acme', account: 'acme', folder, name: 'Ana Acme', email: 'ana@acme.com' }

    const overview = await saveIdentityProfiles([profile])
    expect(overview.profiles).toEqual([profile])
    expect(stored.identityProfiles).toEqual([profile])

    expect(git(inside, 'config', 'user.email')).toBe('ana@acme.com')
    expect(await getRepoIdentity(inside)).toMatchObject({ email: 'ana@acme.com', name: 'Ana Acme', source: 'profile', profileId: 'acme' })
    expect(await getRepoIdentity(outside)).toMatchObject({ email: 'global@example.com', source: 'global' })

    // The commit really carries it.
    git(inside, 'commit', '--allow-empty', '-q', '-m', 'x')
    expect(git(inside, 'log', '-1', '--format=%ae')).toBe('ana@acme.com')
  })

  it('replaces its own includeIf lines on every save and leaves the user’s alone', async () => {
    git(root, 'config', '--global', 'includeIf.gitdir:/somewhere/else/.path', '/user/own.gitconfig')
    const first = join(root, 'first')
    const second = join(root, 'second')
    await saveIdentityProfiles([{ id: 'one', account: null, folder: first, name: 'One', email: 'one@x.com' }])
    await saveIdentityProfiles([{ id: 'two', account: null, folder: second, name: 'Two', email: 'two@x.com' }])

    const config = readFileSync(globalConfig, 'utf8')
    expect(config).toContain('/somewhere/else/')
    expect(config).toContain('/second/')
    expect(config).not.toContain('/first/')
    // The removed profile's file is gone too.
    expect(existsSync(join(userData, 'git-identities', 'one.gitconfig'))).toBe(false)
    expect(existsSync(join(userData, 'git-identities', 'two.gitconfig'))).toBe(true)

    await saveIdentityProfiles([])
    expect(readFileSync(globalConfig, 'utf8')).not.toContain('git-identities')
    expect(readFileSync(globalConfig, 'utf8')).toContain('/somewhere/else/')
  })

  it('refuses an invalid profile instead of saving part of the list', async () => {
    await expect(
      saveIdentityProfiles([{ id: 'bad', account: 'x', folder: null, name: 'X', email: 'not-an-email' }])
    ).rejects.toThrow()
    expect(stored.identityProfiles).toEqual([])
  })

  it('writes a profile into one repository on request', async () => {
    const repo = newRepo('apply')
    await saveIdentityProfiles([{ id: 'p', account: 'acme', folder: null, name: 'Ana', email: 'ana@acme.com' }])
    const identity = await applyProfileToRepo(repo, 'p')
    expect(identity).toMatchObject({ email: 'ana@acme.com', source: 'local' })
    expect(git(repo, 'config', '--local', 'user.email')).toBe('ana@acme.com')
    await expect(applyProfileToRepo(repo, 'missing')).rejects.toThrow()
  })

  it('sets and validates the global identity', async () => {
    const overview = await setGlobalIdentity({ name: '  New Name ', email: 'new@example.com' })
    expect(overview.global).toEqual({ name: 'New Name', email: 'new@example.com' })
    await expect(setGlobalIdentity({ name: 'X', email: 'broken' })).rejects.toThrow()
    expect((await getIdentityOverview(null)).global.email).toBe('new@example.com')
  })
})
