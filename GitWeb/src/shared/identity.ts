// Git identity profiles: the name and e-mail commits carry, per account.
//
// A profile can be tied to a folder, which the app turns into a Git
// `includeIf "gitdir:<folder>/"` entry in the global config, so every
// repository under that folder (the `pasta › conta` layout that "Organizar por
// conta" creates) commits as that account with no per-repository setup. It can
// also name the account (the owner in the origin remote), which is what the
// Changes view uses to warn when a repository is about to commit as someone else.

export interface IdentityProfile {
  id: string
  /** Owner of the origin remote this identity belongs to (GitHub login, organization, group). */
  account: string | null
  /** Repositories under this folder use the profile, through includeIf. */
  folder: string | null
  name: string
  email: string
}

export interface GitIdentityValues {
  name: string | null
  email: string | null
}

/** Where the identity a repository commits with comes from. */
export type IdentitySource = 'local' | 'profile' | 'global' | 'other' | 'none'

export interface RepoIdentity {
  name: string | null
  email: string | null
  source: IdentitySource
  /** The profile whose include file supplied the e-mail, when source is 'profile'. */
  profileId: string | null
  /** Owner in the origin remote, if it has one the app can read. */
  remoteOwner: string | null
}

export interface IdentityOverview {
  global: GitIdentityValues
  profiles: IdentityProfile[]
  /** Only when a repository path was given. */
  repo: RepoIdentity | null
}

export const MAX_IDENTITY_PROFILES = 20

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

/** Git rejects a name made only of characters it strips (`<`, `>`, newlines). */
export function isValidName(name: string): boolean {
  return /[^\s<>]/.test(name) && !/[<>\n]/.test(name)
}

/** The address GitHub links to an account without exposing a real e-mail. */
export function githubNoreplyEmail(id: number, login: string): string {
  return `${id}+${login}@users.noreply.github.com`
}

/**
 * The folder as includeIf wants it: forward slashes and a trailing slash, which
 * makes the match cover every repository below it, not only the folder itself.
 */
export function gitdirPattern(folder: string): string {
  const forward = folder.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  return `${forward}/`
}

/**
 * The global-config key for a profile's folder. Case-insensitive on Windows
 * and macOS, whose file systems are, so `c:\github\acme` still matches a
 * profile saved as `C:\Github\Acme`.
 */
export function includeIfKey(folder: string, platform: string): string {
  const condition = platform === 'win32' || platform === 'darwin' ? 'gitdir/i' : 'gitdir'
  return `includeIf.${condition}:${gitdirPattern(folder)}.path`
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Drops malformed entries (hand-edited settings, an older shape) instead of breaking the tab. */
export function sanitizeProfiles(value: unknown): IdentityProfile[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: IdentityProfile[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const id = cleanText(raw.id, 64)
    const name = cleanText(raw.name, 200)
    const email = cleanText(raw.email, 320)
    if (!id || seen.has(id) || !isValidName(name) || !isValidEmail(email)) continue
    const account = cleanText(raw.account, 200) || null
    const folder = cleanText(raw.folder, 1000) || null
    seen.add(id)
    result.push({ id, account, folder, name, email })
  }
  return result.slice(0, MAX_IDENTITY_PROFILES)
}

function sameAccount(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/** The profile that belongs to a remote owner (GitHub logins are case-insensitive). */
export function profileForAccount(profiles: IdentityProfile[], owner: string | null): IdentityProfile | null {
  if (!owner) return null
  return profiles.find((p) => p.account && sameAccount(p.account, owner)) ?? null
}

export type IdentityProblem =
  /** Git would refuse the commit. */
  | { kind: 'missing' }
  /** The repository belongs to an account that has a profile, but commits would carry another e-mail. */
  | { kind: 'mismatch'; profile: IdentityProfile }

/**
 * What the commit box should warn about before committing. A mismatch is only
 * claimed when the user said which e-mail an account uses (a profile with that
 * account): without one, any e-mail could be right.
 */
export function identityProblem(repo: RepoIdentity | null, profiles: IdentityProfile[]): IdentityProblem | null {
  if (!repo) return null
  if (!repo.email || !repo.name) return { kind: 'missing' }
  const profile = profileForAccount(profiles, repo.remoteOwner)
  if (profile && profile.email.toLowerCase() !== repo.email.toLowerCase()) return { kind: 'mismatch', profile }
  return null
}

/** What the signed-in GitHub account offers for a profile. */
export interface GithubIdentitySuggestion {
  login: string
  name: string | null
  /** The no-reply address: always available, keeps the real e-mail private. */
  noreply: string
  /** Verified addresses, when the token may read them (scope user:email); otherwise only the public one. */
  emails: string[]
}
