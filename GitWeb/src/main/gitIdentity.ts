import { app } from 'electron'
import { homedir } from 'os'
import { basename, join } from 'path'
import { mkdir, readdir, rm } from 'fs/promises'
import { getRemoteUrl, readGit, runGit, setGitIdentity, throwOnFailure } from './gitProcess'
import { getSettings, setAppSettings } from './settings'
import { parseRemoteUrl } from '../shared/remoteOwner'
import {
  includeIfKey,
  isValidEmail,
  isValidName,
  sanitizeProfiles,
  type GitIdentityValues,
  type IdentityOverview,
  type IdentityProfile,
  type IdentitySource,
  type RepoIdentity
} from '../shared/identity'
import { tMain } from './i18n'

// Each profile lives in its own small Git config file in the app-data folder,
// pulled in by an includeIf entry in the user's global config. Keeping the
// values out of ~/.gitconfig means the app only ever adds or removes its own
// include lines there, and recognizes them by where they point.
const PROFILE_DIR = 'git-identities'
const PROFILE_EXT = '.gitconfig'

function profilesDir(): string {
  return join(app.getPath('userData'), PROFILE_DIR)
}

function profileFile(id: string): string {
  return join(profilesDir(), `${id}${PROFILE_EXT}`)
}

/** Git prints paths with forward slashes; compare the same way, case-insensitively. */
function comparablePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function isManagedPath(path: string): boolean {
  return comparablePath(path).startsWith(`${comparablePath(profilesDir())}/`)
}

function profileIdFromPath(path: string): string | null {
  if (!isManagedPath(path)) return null
  const name = basename(path.replace(/\\/g, '/'))
  return name.endsWith(PROFILE_EXT) ? name.slice(0, -PROFILE_EXT.length) : null
}

async function readGlobalValue(key: string): Promise<string | null> {
  const result = await readGit(['config', '--global', '--get', key], homedir())
  return result.exitCode === 0 ? result.stdout.trim() || null : null
}

export async function getGlobalIdentity(): Promise<GitIdentityValues> {
  const [name, email] = await Promise.all([readGlobalValue('user.name'), readGlobalValue('user.email')])
  return { name, email }
}

/**
 * Parses `git config [--show-scope] --show-origin -z --get <key>`:
 * `global\0file:C:/Users/x/.gitconfig\0value\0` (no scope field without
 * --show-scope). -z keeps paths verbatim: without it git C-quotes any path
 * with non-ASCII bytes (C:\Users\João), and the origin no longer matches.
 */
export function parseOriginRecord(stdout: string, withScope: boolean): { scope: string; origin: string; value: string } | null {
  const fields = stdout.split('\0')
  const [scope, origin, value] = withScope ? fields : ['', ...fields]
  if (origin === undefined || value === undefined) return null
  return { scope, origin: origin.replace(/^file:/, ''), value: value.trim() }
}

function sourceOf(scope: string, origin: string): { source: IdentitySource; profileId: string | null } {
  const profileId = profileIdFromPath(origin)
  if (profileId) return { source: 'profile', profileId }
  if (scope === 'local' || scope === 'worktree') return { source: 'local', profileId: null }
  if (scope === 'global') return { source: 'global', profileId: null }
  // Git before 2.26 has no --show-scope: tell the repository's own file by its path.
  if (!scope && /(^|\/)\.git\/config(\.worktree)?$/.test(origin.replace(/\\/g, '/'))) return { source: 'local', profileId: null }
  return { source: 'other', profileId: null }
}

/** user.email with where it came from; falls back step by step on older Git. */
async function readEmailWithOrigin(cwd: string): Promise<{ scope: string; origin: string; value: string } | null> {
  const scoped = await readGit(['config', '--show-scope', '--show-origin', '-z', '--get', 'user.email'], cwd)
  if (scoped.exitCode === 0) return parseOriginRecord(scoped.stdout, true)
  // 1 = not set anywhere. Anything else is an option this Git does not know.
  if (scoped.exitCode === 1) return null
  const origin = await readGit(['config', '--show-origin', '-z', '--get', 'user.email'], cwd)
  if (origin.exitCode === 0) return parseOriginRecord(origin.stdout, false)
  if (origin.exitCode === 1) return null
  const plain = await readGit(['config', '--get', 'user.email'], cwd)
  return plain.exitCode === 0 ? { scope: '', origin: '', value: plain.stdout.trim() } : null
}

/** The identity a commit in this repository would carry, and where it comes from. */
export async function getRepoIdentity(cwd: string): Promise<RepoIdentity> {
  const [parsed, nameResult, remoteUrl] = await Promise.all([
    readEmailWithOrigin(cwd),
    readGit(['config', '--get', 'user.name'], cwd),
    getRemoteUrl(cwd).catch(() => null)
  ])
  const { source, profileId } = parsed?.value ? sourceOf(parsed.scope, parsed.origin) : { source: 'none' as const, profileId: null }
  return {
    name: nameResult.exitCode === 0 ? nameResult.stdout.trim() || null : null,
    email: parsed?.value || null,
    source,
    profileId,
    remoteOwner: remoteUrl ? (parseRemoteUrl(remoteUrl)?.owner ?? null) : null
  }
}

export async function getIdentityOverview(cwd: string | null): Promise<IdentityOverview> {
  const [global, settings, repo] = await Promise.all([
    getGlobalIdentity(),
    getSettings(),
    cwd ? getRepoIdentity(cwd).catch(() => null) : Promise.resolve(null)
  ])
  return { global, profiles: settings.identityProfiles, repo }
}

function assertIdentity(values: { name: string; email: string }): void {
  const t = tMain().identity
  if (!isValidName(values.name)) throw new Error(t.invalidName)
  if (!isValidEmail(values.email)) throw new Error(t.invalidEmail(values.email))
}

/**
 * Any write of the global identity goes through here (Settings, the AI's
 * set_git_identity, git:setIdentity). When ~/.gitconfig had no [user]
 * section, git appends one at the end — after the app's includeIf lines — and
 * the last value read wins, so the global e-mail would silently override every
 * folder profile. Rewriting the app's include lines afterwards puts them back
 * after [user].
 */
export async function setIdentityKeepingProfiles(
  cwd: string,
  scope: 'local' | 'global',
  values: { name?: string; email?: string }
): Promise<void> {
  await setGitIdentity(cwd, scope, values)
  if (scope !== 'global') return
  const profiles = (await getSettings()).identityProfiles
  if (profiles.some((p) => p.folder)) await saveIdentityProfiles(profiles)
}

export async function setGlobalIdentity(values: { name: string; email: string }): Promise<IdentityOverview> {
  const clean = { name: values.name.trim(), email: values.email.trim() }
  assertIdentity(clean)
  await setIdentityKeepingProfiles(homedir(), 'global', clean)
  return getIdentityOverview(null)
}

/** Writes the profile's values into this one repository (`git config --local`). */
export async function applyProfileToRepo(cwd: string, profileId: string): Promise<RepoIdentity> {
  const profile = (await getSettings()).identityProfiles.find((p) => p.id === profileId)
  if (!profile) throw new Error(tMain().identity.profileNotFound)
  await setGitIdentity(cwd, 'local', { name: profile.name, email: profile.email })
  return getRepoIdentity(cwd)
}

/** includeIf values in the global config that point at one of the app's profile files. */
async function managedIncludes(): Promise<{ key: string; value: string }[]> {
  const result = await readGit(['config', '--global', '-z', '--get-regexp', '^includeif\\.'], homedir())
  // Exit 1 just means there is no includeIf entry at all.
  if (result.exitCode !== 0) return []
  const found: { key: string; value: string }[] = []
  for (const record of result.stdout.split('\0')) {
    const newline = record.indexOf('\n')
    if (newline < 0) continue
    const key = record.slice(0, newline)
    const value = record.slice(newline + 1)
    if (key.toLowerCase().endsWith('.path') && isManagedPath(value)) found.push({ key, value })
  }
  return found
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Removes only the app's own value under a key. The user may have their own
 * include for the same folder under that very key, and `--unset-all <key>`
 * alone would take it too.
 */
async function unsetManagedInclude(key: string, value: string): Promise<void> {
  let result = await runGit(['config', '--global', '--fixed-value', '--unset-all', key, value], homedir())
  // --fixed-value is Git 2.30+; before that the value is a regex.
  if (result.exitCode === 129) {
    result = await runGit(['config', '--global', '--unset-all', key, `^${escapeRegex(value)}$`], homedir())
  }
  // 5 = nothing matched (already gone); anything else is a real failure.
  if (result.exitCode !== 0 && result.exitCode !== 5) throwOnFailure(result, ['config'])
}

async function writeProfileFile(profile: IdentityProfile): Promise<void> {
  const file = profileFile(profile.id)
  await rm(file, { force: true })
  throwOnFailure(await runGit(['config', '--file', file, 'user.name', profile.name], homedir()), ['config'])
  throwOnFailure(await runGit(['config', '--file', file, 'user.email', profile.email], homedir()), ['config'])
}

let saving: Promise<unknown> = Promise.resolve()

/**
 * Saves the profiles and brings the global config in line with them: one
 * includeIf per profile with a folder, none left behind for removed ones.
 * Serialized, so two quick saves cannot interleave their git config writes.
 */
export function saveIdentityProfiles(input: IdentityProfile[]): Promise<IdentityOverview> {
  const run = async (): Promise<IdentityOverview> => {
    const profiles = sanitizeProfiles(input)
    if (profiles.length !== input.length) throw new Error(tMain().identity.invalidProfile)
    await mkdir(profilesDir(), { recursive: true })
    for (const profile of profiles) await writeProfileFile(profile)

    // Removed and added again (rather than left alone when unchanged) so they
    // always sit at the end of the file, after [user]. Git drops a section
    // left empty, so the new ones open fresh sections at the end.
    for (const { key, value } of await managedIncludes()) await unsetManagedInclude(key, value)
    for (const profile of profiles) {
      if (!profile.folder) continue
      const key = includeIfKey(profile.folder, process.platform)
      throwOnFailure(
        await runGit(['config', '--global', '--add', key, profileFile(profile.id).replace(/\\/g, '/')], homedir()),
        ['config']
      )
    }

    const keep = new Set(profiles.map((p) => `${p.id}${PROFILE_EXT}`))
    const existing = await readdir(profilesDir()).catch(() => [] as string[])
    await Promise.all(existing.filter((name) => name.endsWith(PROFILE_EXT) && !keep.has(name)).map((name) => rm(join(profilesDir(), name), { force: true })))

    await setAppSettings({ identityProfiles: profiles })
    return getIdentityOverview(null)
  }
  const next = saving.then(run, run)
  saving = next.catch(() => undefined)
  return next
}
