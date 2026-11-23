import { execFile } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { getRemoteUrl, readGit, runGit, throwOnFailure } from './gitProcess'
import { getSecret } from './credentials'
import { httpFetch } from './httpFetch'
import { apiBaseForHost, credentialKey } from '../shared/githubRemote'
import {
  MIN_RECOMMENDED_GIT,
  isGitVersionAtLeast,
  isSshRemote,
  parseGitVersion,
  sortChecks,
  type DiagnosticCheck,
  type DiagnosticFixId
} from '../shared/diagnostics'
import { tMain } from './i18n'

const GITHUB_HOST = 'github.com'

function check(partial: Omit<DiagnosticCheck, 'fix' | 'value'> & Partial<Pick<DiagnosticCheck, 'fix' | 'value'>>): DiagnosticCheck {
  return { value: null, fix: null, ...partial }
}

/** Runs a program that may be missing (ssh). Never throws: a missing binary is an answer. */
function probe(file: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 10_000, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ ok: !error, output: `${stdout}${stderr}`.trim() })
    })
  })
}

async function configValue(key: string, cwd = homedir()): Promise<string | null> {
  const result = await readGit(['config', '--get', key], cwd)
  return result.exitCode === 0 ? result.stdout.trim() || null : null
}

async function gitCheck(): Promise<{ check: DiagnosticCheck; available: boolean }> {
  try {
    const result = await readGit(['--version'], homedir())
    const version = parseGitVersion(result.stdout)
    if (!version) return { check: check({ id: 'git', status: 'error', reason: 'notFound' }), available: false }
    const value = result.stdout.trim().replace(/^git version /, '')
    const recent = isGitVersionAtLeast(version, MIN_RECOMMENDED_GIT)
    return { check: check({ id: 'git', status: recent ? 'ok' : 'warn', reason: recent ? 'ok' : 'outdated', value }), available: true }
  } catch {
    return { check: check({ id: 'git', status: 'error', reason: 'notFound' }), available: false }
  }
}

async function identityCheck(): Promise<DiagnosticCheck> {
  const [name, email] = await Promise.all([
    readGit(['config', '--global', '--get', 'user.name'], homedir()),
    readGit(['config', '--global', '--get', 'user.email'], homedir())
  ])
  const hasName = name.exitCode === 0 && Boolean(name.stdout.trim())
  const hasEmail = email.exitCode === 0 && Boolean(email.stdout.trim())
  if (hasName && hasEmail) return check({ id: 'identity', status: 'ok', reason: 'ok', value: `${name.stdout.trim()} <${email.stdout.trim()}>` })
  return check({
    id: 'identity',
    status: 'warn',
    reason: !hasName && !hasEmail ? 'missingBoth' : hasName ? 'missingEmail' : 'missingName'
  })
}

/** Windows only: without it, a path over 260 characters fails to check out. */
async function longPathsCheck(): Promise<DiagnosticCheck> {
  const enabled = (await configValue('core.longpaths'))?.toLowerCase() === 'true'
  return check({
    id: 'longPaths',
    status: enabled ? 'ok' : 'warn',
    reason: enabled ? 'ok' : 'disabled',
    fix: enabled ? null : { id: 'enableLongPaths', command: 'git config --global core.longpaths true' }
  })
}

function safeDirectoryCommand(cwd: string): string {
  return `git config --global --add safe.directory "${cwd.replace(/\\/g, '/')}"`
}

/** Git refuses to work in a repository owned by another user until it is trusted. */
async function safeDirectoryCheck(cwd: string): Promise<DiagnosticCheck> {
  const result = await readGit(['rev-parse', '--git-dir'], cwd)
  if (result.exitCode !== 0 && /dubious ownership|safe\.directory/i.test(result.stderr)) {
    return check({
      id: 'safeDirectory',
      status: 'error',
      reason: 'dubiousOwnership',
      value: cwd,
      fix: { id: 'trustRepository', command: safeDirectoryCommand(cwd) }
    })
  }
  return check({ id: 'safeDirectory', status: 'ok', reason: 'ok', value: cwd })
}

async function usesLfs(cwd: string): Promise<boolean> {
  try {
    return /filter=lfs/.test(await readFile(join(cwd, '.gitattributes'), 'utf8'))
  } catch {
    return false
  }
}

async function lfsCheck(cwd: string | null): Promise<DiagnosticCheck> {
  const [installed, used] = await Promise.all([
    readGit(['lfs', 'version'], homedir()).catch(() => null),
    cwd ? usesLfs(cwd) : Promise.resolve(false)
  ])
  if (installed && installed.exitCode === 0) {
    const value = installed.stdout.trim().split(/\s+/)[0]?.replace(/^git-lfs\//, '') ?? null
    return check({ id: 'lfs', status: 'ok', reason: 'ok', value })
  }
  return check({ id: 'lfs', status: used ? 'error' : 'info', reason: used ? 'usedButMissing' : 'notInstalled' })
}

/** Only when the open repository's origin goes over SSH: otherwise ssh is irrelevant. */
async function sshCheck(cwd: string | null): Promise<DiagnosticCheck | null> {
  if (!cwd) return null
  const url = await getRemoteUrl(cwd).catch(() => null)
  if (!isSshRemote(url)) return null
  const result = await probe('ssh', ['-V'])
  if (!result.ok) return check({ id: 'ssh', status: 'error', reason: 'notFound' })
  return check({ id: 'ssh', status: 'ok', reason: 'ok', value: result.output.split(/\r?\n/)[0] ?? null })
}

async function credentialHelperCheck(): Promise<DiagnosticCheck> {
  const helper = await configValue('credential.helper')
  // Not a problem: the app signs GitHub remotes in with its own token. Other
  // hosts are the ones that need a helper.
  return helper
    ? check({ id: 'credentialHelper', status: 'ok', reason: 'ok', value: helper })
    : check({ id: 'credentialHelper', status: 'info', reason: 'notConfigured' })
}

/** Signed in, token still accepted, and allowed to work with private repositories. */
async function githubCheck(): Promise<DiagnosticCheck> {
  const token = await getSecret(credentialKey(GITHUB_HOST))
  if (!token) return check({ id: 'github', status: 'info', reason: 'notSignedIn' })
  try {
    const response = await httpFetch(
      `${apiBaseForHost(GITHUB_HOST)}/user`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, cache: 'no-cache' },
      { timeoutMs: 15_000 }
    )
    if (response.status === 401) return check({ id: 'github', status: 'error', reason: 'tokenInvalid' })
    if (!response.ok) return check({ id: 'github', status: 'warn', reason: 'unreachable' })
    const user = (await response.json()) as { login?: string }
    // Classic and OAuth tokens list their scopes; fine-grained tokens send no
    // header at all, and their permissions cannot be read this way.
    const scopes = response.headers.get('x-oauth-scopes')
    const granted = scopes === null ? null : scopes.split(',').map((s) => s.trim()).filter(Boolean)
    if (granted && !granted.includes('repo')) {
      return check({ id: 'github', status: 'warn', reason: 'missingRepoScope', value: user.login ?? null })
    }
    return check({ id: 'github', status: 'ok', reason: 'ok', value: user.login ?? null })
  } catch {
    return check({ id: 'github', status: 'warn', reason: 'unreachable' })
  }
}

export async function runDiagnostics(cwd: string | null): Promise<DiagnosticCheck[]> {
  const git = await gitCheck()
  if (!git.available) return [git.check]
  const checks = await Promise.all([
    identityCheck(),
    cwd ? safeDirectoryCheck(cwd) : Promise.resolve(null),
    process.platform === 'win32' ? longPathsCheck() : Promise.resolve(null),
    lfsCheck(cwd),
    sshCheck(cwd),
    credentialHelperCheck(),
    githubCheck()
  ])
  return sortChecks([git.check, ...checks.filter((c): c is DiagnosticCheck => c !== null)])
}

/** Runs one of the known fixes, then the checks again so the screen shows the result. */
export async function applyDiagnosticFix(id: DiagnosticFixId, cwd: string | null): Promise<DiagnosticCheck[]> {
  if (id === 'enableLongPaths') {
    throwOnFailure(await runGit(['config', '--global', 'core.longpaths', 'true'], homedir()), ['config'])
  } else if (id === 'trustRepository' && cwd) {
    throwOnFailure(await runGit(['config', '--global', '--add', 'safe.directory', cwd.replace(/\\/g, '/')], homedir()), ['config'])
  } else {
    throw new Error(tMain().diagnostics.unknownFix)
  }
  return runDiagnostics(cwd)
}
