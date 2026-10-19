import { spawn, type ChildProcess } from 'child_process'
import { shell } from 'electron'
import { lstat, readFile, rm, writeFile, mkdir, access, realpath } from 'fs/promises'
import { join, dirname, basename, resolve, sep, normalize } from 'path'
import type {
  BranchDeletionResult,
  BranchInfo,
  BranchIntegration,
  BranchIntegrationReport,
  ClonePhase,
  CloneOutcome,
  CloneProgress,
  CommitDetails,
  CommitFile,
  CommitSummary,
  FileHistoryLocation,
  GitIdentity,
  GitResult,
  RepoStatus,
  RepoUpdateResult,
  RepoUpdateStatus,
  StashEntry,
  StatusEntry,
  SwitchBranchResult
} from '../shared/git'
import { parseCheckoutBlockers } from '../shared/git'
import { parseGitHubRemote, credentialKey } from '../shared/githubRemote'
import { getSecret } from './credentials'
import { tMain } from './i18n'

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const NETWORK_TIMEOUT_MS = 30 * 60 * 1000
const NETWORK_COMMANDS = new Set(['clone', 'fetch', 'pull', 'push'])

const RS = '\x1e' // record separator
const FS = '\x1f' // field separator

// Serializes concurrent git calls against the same repo path, mirroring the
// per-repo SemaphoreSlim locking in the WinUI app's GitService.cs.
const repoQueues = new Map<string, Promise<unknown>>()

/** Normalize cwd so Windows path variants share one git queue. */
function queueKey(cwd: string): string {
  const normalized = normalize(resolve(cwd)).replace(/[/\\]+$/, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function enqueue<T>(repoKey: string, task: () => Promise<T>): Promise<T> {
  const previous = repoQueues.get(repoKey) ?? Promise.resolve()
  const next = previous.then(task, task)
  repoQueues.set(
    repoKey,
    next.catch(() => undefined)
  )
  return next
}

/**
 * Read-only git calls (status, diff, log, show…) skip the per-repo queue: they
 * only have to wait for nothing, and before this a status refresh or a diff
 * click sat behind a fetch/push for as long as the network took. They never
 * write, and GIT_OPTIONAL_LOCKS=0 stops the opportunistic index refresh that
 * would otherwise take .git/index.lock and race the queued writers.
 */
export function readGit(args: string[], cwd: string): Promise<GitResult> {
  return runGit(args, cwd, { serialize: false, extraEnv: { GIT_OPTIONAL_LOCKS: '0' } })
}

export function runGit(
  args: string[],
  cwd: string,
  options?: {
    serialize?: boolean
    extraEnv?: Record<string, string>
    stdin?: string
    /** Called with each stderr chunk as it arrives — git writes progress there. */
    onStderr?: (chunk: string) => void
    /** Handed the child right after spawn, so callers can cancel it. */
    onSpawn?: (child: ChildProcess) => void
  }
): Promise<GitResult> {
  const timeoutMs = NETWORK_COMMANDS.has(args[0]) ? NETWORK_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
  const execute = (): Promise<GitResult> =>
    new Promise<GitResult>((resolve, reject) => {
      const child = spawn('git', args, {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...options?.extraEnv },
        // The packaged app has no console of its own, so without this every
        // git.exe spawn on Windows flashes a console window.
        windowsHide: true
      })
      options?.onSpawn?.(child)
      if (child.stdin) {
        // git can exit before reading all of stdin (e.g. `apply` rejecting a
        // patch early); that EPIPE must not become an uncaught exception in
        // the main process — the exit code already reports the failure.
        child.stdin.on('error', () => undefined)
        if (options?.stdin != null) child.stdin.write(options.stdin)
        child.stdin.end()
      }

      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error(`git ${args.join(' ')} timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      child.stdout.setEncoding('utf-8')
      child.stderr.setEncoding('utf-8')
      child.stdout.on('data', (chunk) => (stdout += chunk))
      child.stderr.on('data', (chunk) => {
        stderr += chunk
        options?.onStderr?.(String(chunk))
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })

      child.on('close', (exitCode) => {
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode })
      })
    })

  if (options?.serialize === false) return execute()
  return enqueue(queueKey(cwd), execute)
}

function throwOnFailure(result: GitResult, args: string[]): void {
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} exited with code ${result.exitCode}`)
  }
}

// Resolves a saved GitHub token (PAT or OAuth, both stored under the same
// credentialKey) for the remote's host and, if found, authenticates this one
// invocation via an env-only http.extraHeader — never written to .git/config
// or the argv the OS process list can show. Non-GitHub/non-HTTPS remotes
// (SSH, plain git://) are left untouched.
async function buildAuthEnv(remoteUrl: string | null): Promise<Record<string, string>> {
  if (!remoteUrl || !remoteUrl.startsWith('https://')) return {}
  const remote = parseGitHubRemote(remoteUrl)
  if (!remote) return {}

  const token = await getSecret(credentialKey(remote.host))
  if (!token) return {}

  const headerValue = `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`
  // Disable the system credential helper for this invocation so Git Credential
  // Manager (or another OAuth app without `workflow`) cannot override our token.
  return {
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: `http.https://${remote.host}/.extraHeader`,
    GIT_CONFIG_VALUE_1: headerValue
  }
}

export async function isGitRepository(cwd: string): Promise<boolean> {
  const result = await readGit(['rev-parse', '--is-inside-work-tree'], cwd)
  return result.exitCode === 0 && result.stdout.trim() === 'true'
}

export async function initRepository(cwd: string): Promise<void> {
  throwOnFailure(await runGit(['init'], cwd), ['init'])
}

// The clone URL is the one fully free-form string a user pastes that lands in
// git's argv, so it gets an allowlist rather than a denylist. Two concrete
// risks: a value starting with "-" is parsed as an option, and
// `--upload-pack=<cmd>` makes git execute <cmd> (verified: it runs whenever the
// positional that follows resolves to a repository); and git's transport
// helpers (`ext::`, `fd::`) hand a shell string to the OS — modern git refuses
// `ext` by default, but that default is one `protocol.ext.allow` away from
// changing on a user's machine. Local paths stay allowed: cloning a folder is
// a legitimate git workflow the app already supports.
const CLONE_URL_SCHEMES = ['https://', 'http://', 'ssh://', 'git+ssh://']
const SCP_LIKE_REMOTE = /^[\w.-]+@[\w.-]+:(?!\/)/ // git@github.com:owner/repo.git
const ABSOLUTE_LOCAL_PATH = /^([a-zA-Z]:[\\/]|[\\/])/

function assertSafeCloneUrl(url: string): void {
  if (url.startsWith('-')) {
    throw new Error(tMain().git.cloneUrlStartsWithDash)
  }
  const lower = url.toLowerCase()
  const allowed =
    CLONE_URL_SCHEMES.some((scheme) => lower.startsWith(scheme)) ||
    SCP_LIKE_REMOTE.test(url) ||
    ABSOLUTE_LOCAL_PATH.test(url)
  if (!allowed) {
    throw new Error(tMain().git.cloneUrlNotAllowed)
  }
}

// Rejects values that git would parse as an option instead of a ref name.
function assertNotOption(value: string, label: string): void {
  if (value.startsWith('-')) throw new Error(tMain().git.optionLikeValue(label))
}

// `git clone --progress` writes lines like
//   remote: Counting objects:  45% (556/1234)
//   Receiving objects:  62% (7412/11903), 5.43 MiB | 1.20 MiB/s
// to stderr, separated by \r rather than \n.
const CLONE_PROGRESS_RE =
  /^(?:remote:\s*)?(Counting objects|Compressing objects|Receiving objects|Resolving deltas|Updating files):\s+(\d+)%\s+\((\d+)\/(\d+)\)(?:,\s+([\d.]+\s+[KMGT]?i?B))?(?:\s+\|\s+([\d.]+\s+[KMGT]?i?B\/s))?/

const CLONE_PHASES: Record<string, ClonePhase> = {
  'Counting objects': 'counting',
  'Compressing objects': 'compressing',
  'Receiving objects': 'receiving',
  'Resolving deltas': 'resolving',
  'Updating files': 'checkingOut'
}

/**
 * Splits git's stderr into complete progress records. Chunks arrive on arbitrary
 * boundaries, so the unterminated tail is carried over to the next call.
 */
function createCloneProgressParser(
  destination: string,
  onProgress: (progress: CloneProgress) => void
): (chunk: string) => void {
  let pending = ''
  return (chunk: string) => {
    pending += chunk
    const records = pending.split(/[\r\n]/)
    pending = records.pop() ?? ''

    // Only the newest record matters — the earlier ones in this chunk are
    // already stale by the time the renderer would paint them.
    for (let i = records.length - 1; i >= 0; i--) {
      const match = CLONE_PROGRESS_RE.exec(records[i].trim())
      if (!match) continue
      const phase = CLONE_PHASES[match[1]]
      if (!phase) continue
      onProgress({
        destination,
        phase,
        percent: Number(match[2]),
        objects: Number(match[3]),
        totalObjects: Number(match[4]),
        transferred: match[5] ?? null,
        rate: match[6] ?? null
      })
      return
    }
  }
}

// Clones in flight, so cancelClone() can reach the child process. Keyed by the
// normalized destination; `cancelled` is separate because a cancel can land
// before the process is even spawned (runGit queues per parent folder).
const activeClones = new Map<string, ChildProcess>()
const cancelledClones = new Set<string>()

async function pathExistsOnDisk(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function cloneRepository(
  url: string,
  destination: string,
  onProgress?: (progress: CloneProgress) => void
): Promise<CloneOutcome> {
  const trimmedUrl = url.trim()
  assertSafeCloneUrl(trimmedUrl)

  const key = queueKey(destination)
  cancelledClones.delete(key)
  // Anything already on disk is the user's, not ours to delete on cancel.
  const preexisting = await pathExistsOnDisk(destination)

  // Runs from destination's parent since the target dir may not exist yet.
  const parent = dirname(destination)
  const folderName = basename(destination)
  const extraEnv = await buildAuthEnv(trimmedUrl)
  const handleStderr = onProgress ? createCloneProgressParser(destination, onProgress) : undefined

  let result: GitResult
  try {
    // `--progress` is required: git stays silent when stderr is a pipe rather
    // than a TTY. `--` keeps the URL and folder name from being read as options.
    result = await runGit(['clone', '--progress', '--', trimmedUrl, folderName], parent, {
      extraEnv,
      onStderr: handleStderr,
      onSpawn: (child) => {
        // A cancel that arrived while this clone waited in the per-folder queue
        // has no process to kill yet — honour it as soon as one exists.
        if (cancelledClones.has(key)) killProcessTree(child)
        else activeClones.set(key, child)
      }
    })
  } finally {
    activeClones.delete(key)
  }

  if (cancelledClones.has(key)) {
    cancelledClones.delete(key)
    if (!preexisting) await removePartialClone(destination)
    return { status: 'cancelled' }
  }

  throwOnFailure(result, ['clone', trimmedUrl])
  return { status: 'ok' }
}

// On Windows child.kill() terminates only git.exe, orphaning the transport
// helper it spawned (git-remote-https), which keeps holding the partial clone's
// files open — taskkill /T takes the whole tree down.
function killProcessTree(child: ChildProcess): void {
  if (child.pid == null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).on('error', () => undefined)
  } else {
    child.kill('SIGTERM')
  }
}

async function removePartialClone(destination: string): Promise<void> {
  // The retries cover file handles Windows may not have released yet.
  await rm(destination, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(
    () => undefined
  )
}

export async function cancelClone(destination: string): Promise<void> {
  const key = queueKey(destination)
  cancelledClones.add(key)
  const child = activeClones.get(key)
  if (child) killProcessTree(child)
}

// Parses `git status --porcelain=v1 -z` (NUL-delimited, no quoting/escaping
// surprises), matching the approach in GitService.cs.
export function parseStatusEntries(raw: string): StatusEntry[] {
  const entries: StatusEntry[] = []
  const parts = raw.split('\0').filter(Boolean)

  for (let i = 0; i < parts.length; i++) {
    const record = parts[i]
    const index = record[0]
    const worktree = record[1]
    const path = record.slice(3)

    if (index === 'R' || index === 'C') {
      const renamedFrom = parts[++i]
      entries.push({ path, index, worktree, renamedFrom })
    } else {
      entries.push({ path, index, worktree })
    }
  }

  return entries
}

export async function getStatus(cwd: string): Promise<RepoStatus> {
  // readGit sets GIT_OPTIONAL_LOCKS=0: status is polled in the background, and
  // the index refresh it would otherwise write takes .git/index.lock — racing
  // whatever git command runs in a terminal, an IDE, or our own queue.
  // --untracked-files=all lists every new file instead of collapsing a new
  // folder into one "src/" entry — otherwise its files can be neither viewed
  // nor staged one by one (same choice as GitHub Desktop).
  const statusResult = await readGit(['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all'], cwd)
  throwOnFailure(statusResult, ['status'])

  // -b prefixes a branch header record before the NUL-delimited entries when
  // combined with -z; it comes through as the first '\0'-terminated chunk
  // starting with "## ".
  const raw = statusResult.stdout
  const headerEnd = raw.indexOf('\0')
  const header = headerEnd >= 0 ? raw.slice(0, headerEnd) : raw
  const rest = headerEnd >= 0 ? raw.slice(headerEnd + 1) : ''

  let branch: string | null = null
  let upstream: string | null = null
  let ahead = 0
  let behind = 0

  // Branch names may contain dots (e.g. fix/1.0.0). The upstream separator is
  // the literal "..." sequence, not the first "." in the branch name.
  const headerMatch = header.match(/^## (?:No commits yet on )?(.+?)(?:\.\.\.(\S+))?(?:\s|$)/)
  if (headerMatch) {
    branch = (headerMatch[1] ?? null)?.trim() || null
    upstream = headerMatch[2] ?? null
  }
  const aheadMatch = header.match(/ahead (\d+)/)
  const behindMatch = header.match(/behind (\d+)/)
  if (aheadMatch) ahead = Number(aheadMatch[1])
  if (behindMatch) behind = Number(behindMatch[1])

  const mergeHead = await readGit(['rev-parse', '-q', '--verify', 'MERGE_HEAD'], cwd)
  return { entries: parseStatusEntries(rest), branch, ahead, behind, upstream, mergeInProgress: mergeHead.exitCode === 0 }
}

export async function stageFiles(paths: string[], cwd: string): Promise<void> {
  if (paths.length === 0) return
  throwOnFailure(await runGit(['add', '--', ...paths], cwd), ['add'])
}

export async function unstageFiles(paths: string[], cwd: string): Promise<void> {
  if (paths.length === 0) return
  throwOnFailure(await runGit(['restore', '--staged', '--', ...paths], cwd), ['restore', '--staged'])
}

export async function discardFiles(paths: string[], cwd: string, statusByPath: Map<string, StatusEntry>): Promise<void> {
  const tracked: string[] = []
  const untracked: string[] = []

  for (const path of paths) {
    const entry = statusByPath.get(path)
    if (entry?.worktree === '?' && entry.index === '?') {
      untracked.push(path)
    } else {
      tracked.push(path)
    }
  }

  if (tracked.length > 0) {
    throwOnFailure(await runGit(['restore', '--worktree', '--', ...tracked], cwd), ['restore'])
  }
  for (const relativePath of untracked) {
    const target = resolveWithinRepo(cwd, relativePath)
    const stats = await lstat(target).catch(() => null)
    if (!stats) continue
    // A never-committed file has no copy anywhere in git, so a mistaken
    // discard would be unrecoverable — it goes to the OS trash instead
    // (as GitHub Desktop does). Deleted outright only where there is no trash.
    try {
      await shell.trashItem(target)
    } catch {
      await rm(target, { recursive: stats.isDirectory(), force: true })
    }
  }
}

export async function getDiff(path: string, cwd: string, staged: boolean): Promise<string> {
  const args = staged ? ['diff', '--cached', '-U3', '--', path] : ['diff', '-U3', '--', path]
  const result = await readGit(args, cwd)
  throwOnFailure(result, args)
  return result.stdout
}

export async function getStagedDiffAll(cwd: string): Promise<string> {
  const result = await readGit(['diff', '--cached', '-U3'], cwd)
  throwOnFailure(result, ['diff', '--cached'])
  return result.stdout
}

export async function getUnstagedDiffAll(cwd: string): Promise<string> {
  const result = await readGit(['diff', '-U3'], cwd)
  throwOnFailure(result, ['diff'])
  return result.stdout
}

export async function getBranchDiff(cwd: string, base: string, head: string): Promise<string> {
  assertNotOption(base, tMain().git.optionLabel.baseBranch)
  assertNotOption(head, tMain().git.optionLabel.sourceBranch)
  const range = `${base}...${head}`
  const result = await readGit(['diff', range, '-U3'], cwd)
  throwOnFailure(result, ['diff', range])
  return result.stdout
}

export async function commit(summary: string, description: string, cwd: string): Promise<void> {
  // An empty summary is only accepted by the UI to conclude a merge, where git
  // already prepared the message ("Merge remote-tracking branch …").
  if (!summary.trim()) {
    // --cleanup=strip: without an editor git keeps the prepared message's
    // "# Conflicts:" comment lines verbatim in the commit.
    throwOnFailure(await runGit(['commit', '--no-edit', '--cleanup=strip'], cwd), ['commit', '--no-edit'])
    return
  }
  const args = ['commit', '-m', summary]
  if (description.trim().length > 0) args.push('-m', description)
  throwOnFailure(await runGit(args, cwd), ['commit'])
}

export async function applyPatch(
  cwd: string,
  patch: string,
  options: { cached?: boolean; reverse?: boolean } = {}
): Promise<void> {
  // No --ignore-whitespace: it matches context loosely but writes the patch's own
  // whitespace into the result, which would leave a phantom whitespace change right
  // after staging/discarding a hunk. Every caller mutates the index or the worktree,
  // so the apply must be byte-exact.
  const args = ['apply', '--whitespace=nowarn']
  if (options.cached) args.push('--cached')
  if (options.reverse) args.push('--reverse')
  args.push('-')
  const result = await runGit(args, cwd, { stdin: patch.endsWith('\n') ? patch : `${patch}\n` })
  throwOnFailure(result, args)
}

export async function resetSoftHead(cwd: string): Promise<void> {
  await enqueue(queueKey(cwd), () => resetSoftHeadInQueue(cwd))
}

/** Caller owns the repo queue; nested commands must not enqueue behind it. */
async function resetSoftHeadInQueue(cwd: string): Promise<void> {
  const parent = await readGit(['rev-parse', '--verify', 'HEAD~1'], cwd)
  if (parent.exitCode !== 0) {
    // HEAD~1 also fails on a shallow/grafted clone, where deleting the ref would
    // throw away the whole branch instead of one commit. Only the genuine root
    // commit — HEAD itself having no parents — may take the update-ref path.
    if (!(await isRootCommit(cwd))) {
      throw new Error(tMain().git.undoParentUnavailable)
    }
    throwOnFailure(await runGit(['update-ref', '-d', 'HEAD'], cwd, { serialize: false }), ['update-ref', '-d', 'HEAD'])
    return
  }
  throwOnFailure(await runGit(['reset', '--soft', 'HEAD~1'], cwd, { serialize: false }), ['reset', '--soft'])
}

async function isRootCommit(cwd: string): Promise<boolean> {
  // In a shallow clone the grafted boundary commit looks parentless to rev-list,
  // so rule that out before trusting the parent count.
  const shallow = await readGit(['rev-parse', '--is-shallow-repository'], cwd)
  if (shallow.exitCode !== 0 || shallow.stdout.trim() !== 'false') return false
  const head = await readGit(['rev-parse', '--verify', 'HEAD^{commit}'], cwd)
  if (head.exitCode !== 0) return false
  const roots = await readGit(['rev-list', '--max-parents=0', 'HEAD'], cwd)
  if (roots.exitCode !== 0) return false
  return roots.stdout.trim().split('\n').includes(head.stdout.trim())
}

export async function commitAmend(cwd: string, summary?: string, description?: string): Promise<void> {
  if (!summary?.trim()) {
    // Keeping the existing subject must not silently drop a body the user typed:
    // reuse the current subject and rewrite the message with the new description.
    if (description?.trim()) {
      const subject = await runGit(['log', '-1', '--pretty=%s'], cwd)
      throwOnFailure(subject, ['log', '-1'])
      throwOnFailure(
        await runGit(['commit', '--amend', '-m', subject.stdout.trim(), '-m', description.trim()], cwd),
        ['commit', '--amend']
      )
      return
    }
    throwOnFailure(await runGit(['commit', '--amend', '--no-edit'], cwd), ['commit', '--amend'])
    return
  }
  const args = ['commit', '--amend', '-m', summary.trim()]
  if (description?.trim()) args.push('-m', description.trim())
  throwOnFailure(await runGit(args, cwd), ['commit', '--amend'])
}

export async function getBranches(cwd: string): Promise<BranchInfo[]> {
  const result = await readGit(
    ['branch', '--format=%(HEAD)' + FS + '%(refname:short)'],
    cwd
  )
  throwOnFailure(result, ['branch'])

  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [head, name] = line.split(FS)
      return { name, isCurrent: head === '*' }
    })
}

export async function createBranch(name: string, cwd: string, checkout: boolean, from?: string): Promise<void> {
  assertNotOption(name, tMain().git.optionLabel.branchName)
  if (from) assertNotOption(from, tMain().git.optionLabel.sourceBranch)
  const args = checkout ? ['checkout', '-b', name] : ['branch', name]
  if (from) args.push(from)
  throwOnFailure(await runGit(args, cwd), args)
}

/**
 * Remote-tracking branches (origin/foo), minus the symbolic origin/HEAD. Used
 * to offer branches that exist on the remote but were never checked out here.
 */
export async function getRemoteBranches(cwd: string): Promise<string[]> {
  const result = await readGit(['branch', '-r', '--format=%(refname:short)%09%(symref)'], cwd)
  throwOnFailure(result, ['branch', '-r'])
  return result.stdout
    .split('\n')
    .map((line) => line.split('\t'))
    .filter(([name, symref]) => name && !symref && name.includes('/'))
    .map(([name]) => name)
}

/** Creates the local branch tracking `origin/<name>` and switches to it. */
export async function checkoutRemoteBranch(remoteBranch: string, cwd: string): Promise<SwitchBranchResult> {
  assertNotOption(remoteBranch, tMain().git.optionLabel.remoteBranch)
  return runCheckout(['checkout', '--track', remoteBranch], cwd)
}

/**
 * A checkout blocked by local changes comes back as data, not an error, so the
 * UI can offer to stash them. LC_ALL=C keeps git's message in English, which
 * is what parseCheckoutBlockers reads; any other failure still throws.
 */
async function runCheckout(args: string[], cwd: string): Promise<SwitchBranchResult> {
  const result = await runGit(args, cwd, { extraEnv: { LC_ALL: 'C', LANGUAGE: 'C' } })
  if (result.exitCode === 0) return { switched: true }
  const blockingFiles = parseCheckoutBlockers(result.stderr)
  if (blockingFiles) return { switched: false, blockingFiles }
  throwOnFailure(result, args)
  return { switched: true }
}

/**
 * `-d` refuses a branch that is not merged into its upstream/HEAD, which is the
 * safety net the UI relies on; `force` (-D) is only sent after the user
 * explicitly confirms losing those commits.
 */
export async function deleteBranch(name: string, cwd: string, force: boolean): Promise<void> {
  assertNotOption(name, tMain().git.optionLabel.branchName)
  const args = ['branch', force ? '-D' : '-d', name]
  throwOnFailure(await runGit(args, cwd), args)
}

export async function renameBranch(oldName: string, newName: string, cwd: string): Promise<void> {
  assertNotOption(oldName, tMain().git.optionLabel.branchName)
  assertNotOption(newName, tMain().git.optionLabel.newBranchName)
  const args = ['branch', '-m', oldName, newName]
  throwOnFailure(await runGit(args, cwd), args)
}

/** Removes the branch from origin (e.g. after its pull request was merged). */
export async function deleteRemoteBranch(name: string, cwd: string): Promise<void> {
  assertNotOption(name, tMain().git.optionLabel.branchName)
  const extraEnv = await buildAuthEnv(await getRemoteUrl(cwd))
  const args = ['push', 'origin', '--delete', name]
  throwOnFailure(await runGit(args, cwd, { extraEnv }), args)
}

export async function switchBranch(name: string, cwd: string): Promise<SwitchBranchResult> {
  assertNotOption(name, tMain().git.optionLabel.branchName)
  return runCheckout(['checkout', name], cwd)
}

// %b (body) is everything after the subject's blank line — the bullet-list
// description AI-generated commits carry, which the History view needs to
// show alongside the one-line summary.
const LOG_FORMAT_FIELDS = ['%H', '%h', '%an', '%ae', '%aI', '%s', '%b']

function parseCommitRecords(stdout: string): CommitSummary[] {
  return stdout
    .split(RS)
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.trim().length > 0)
    .map((record) => {
      const [hash, shortHash, authorName, authorEmail, date, summary, body] = record.split(FS)
      return { hash, shortHash, authorName, authorEmail, date, summary, body: (body ?? '').trim() }
    })
}

export async function getLog(cwd: string, limit = 100, path?: string): Promise<CommitSummary[]> {
  const format = LOG_FORMAT_FIELDS.join(FS)
  const args = ['log', `--pretty=format:${format}${RS}`, `-n`, String(limit)]
  if (path?.trim()) args.push('--', path.trim())
  const result = await readGit(args, cwd)
  if (result.exitCode !== 0) {
    // Empty repo with no commits yet is not an error condition for the UI.
    if (/does not have any commits yet|unknown revision/i.test(result.stderr)) return []
    throwOnFailure(result, ['log'])
  }

  return parseCommitRecords(result.stdout)
}

export async function getCommitDetails(cwd: string, ref: string): Promise<CommitDetails | null> {
  // The AI agent's read_commit tool passes a model-chosen ref here with no
  // approval step, and `git show --output=<file>` writes an arbitrary file.
  assertNotOption(ref, tMain().git.labels.commitRef)
  const format = [...LOG_FORMAT_FIELDS, '%P'].join(FS)
  const result = await readGit(['show', '-s', `--pretty=format:${format}${RS}`, ref], cwd)
  if (result.exitCode !== 0) {
    if (/unknown revision|bad revision|ambiguous argument/i.test(result.stderr)) return null
    throwOnFailure(result, ['show'])
  }

  const record = result.stdout.split(RS)[0]?.replace(/^\n/, '') ?? ''
  if (!record.trim()) return null

  const [hash, shortHash, authorName, authorEmail, date, summary, body, parents] = record.split(FS)
  return {
    hash,
    shortHash,
    authorName,
    authorEmail,
    date,
    summary,
    body: (body ?? '').trim(),
    parents: (parents ?? '').trim().split(/\s+/).filter(Boolean)
  }
}

// `git show` on a merge commit produces no diff/name-status by default —
// --diff-merges=first-parent (git >= 2.31) makes it behave like a normal
// commit's diff against its first parent. Older git rejects the flag, so
// fall back to the plain invocation (empty diff for merges, same as before).
async function runShowWithMergeDiff(args: string[], cwd: string): Promise<GitResult> {
  const withFlag = await readGit(['show', '--diff-merges=first-parent', ...args], cwd)
  if (withFlag.exitCode === 0 || !/unknown option|diff-merges/i.test(withFlag.stderr)) return withFlag
  return readGit(['show', ...args], cwd)
}

export async function getCommitFiles(hash: string, cwd: string): Promise<CommitFile[]> {
  assertNotOption(hash, tMain().git.labels.commitRef)
  const result = await runShowWithMergeDiff(['--name-status', '--pretty=format:', hash], cwd)
  throwOnFailure(result, ['show'])

  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t')
      return { status, path: rest.join('\t') }
    })
}

export async function getCommitPatch(cwd: string, ref: string): Promise<string> {
  assertNotOption(ref, tMain().git.labels.commitRef)
  const result = await runShowWithMergeDiff(['-U3', '--pretty=format:', ref], cwd)
  throwOnFailure(result, ['show'])
  return result.stdout
}

export async function getCommitDiff(hash: string, path: string, cwd: string): Promise<string> {
  assertNotOption(hash, tMain().git.labels.commitRef)
  // Same first-parent handling as getCommitPatch/getCommitFiles — a plain
  // `git show` on a merge commit prints no diff at all.
  const result = await runShowWithMergeDiff(['-U3', '--pretty=format:', hash, '--', path], cwd)
  throwOnFailure(result, ['show'])
  return result.stdout
}

export async function getRemoteUrl(cwd: string, remoteName = 'origin'): Promise<string | null> {
  assertNotOption(remoteName, tMain().git.optionLabel.remoteName)
  const result = await readGit(['remote', 'get-url', remoteName], cwd)
  if (result.exitCode !== 0) return null
  return result.stdout.trim() || null
}

async function readConfigValue(cwd: string, key: string, scope: 'local' | 'global'): Promise<string | null> {
  const result = await readGit(['config', `--${scope}`, '--get', key], cwd)
  // git config sai com código 1 quando a chave não existe naquele escopo — não é falha.
  if (result.exitCode !== 0) return null
  return result.stdout.trim() || null
}

export async function getGitIdentity(cwd: string): Promise<{ local: GitIdentity; global: GitIdentity }> {
  const [localName, localEmail, globalName, globalEmail] = await Promise.all([
    readConfigValue(cwd, 'user.name', 'local'),
    readConfigValue(cwd, 'user.email', 'local'),
    readConfigValue(cwd, 'user.name', 'global'),
    readConfigValue(cwd, 'user.email', 'global')
  ])
  return { local: { name: localName, email: localEmail }, global: { name: globalName, email: globalEmail } }
}

export async function setGitIdentity(
  cwd: string,
  scope: 'local' | 'global',
  values: { name?: string; email?: string }
): Promise<void> {
  if (values.name) throwOnFailure(await runGit(['config', `--${scope}`, 'user.name', values.name], cwd), ['config'])
  if (values.email) throwOnFailure(await runGit(['config', `--${scope}`, 'user.email', values.email], cwd), ['config'])
}

export async function fetchRemote(cwd: string): Promise<void> {
  const extraEnv = await buildAuthEnv(await getRemoteUrl(cwd))
  // --prune drops origin/* refs of branches deleted on the remote (by a merged
  // PR, a teammate), which otherwise linger in the branch menu forever.
  throwOnFailure(await runGit(['fetch', '--prune'], cwd, { extraEnv }), ['fetch'])
}

// Non-destructive check for incoming commits — updates no local state,
// unlike fetchRemote(). Ported from AiToolService's "check_incoming_commits" tool.
export async function fetchDryRun(cwd: string): Promise<GitResult> {
  const extraEnv = await buildAuthEnv(await getRemoteUrl(cwd))
  return runGit(['fetch', '--dry-run'], cwd, { extraEnv })
}

// Pull/merge can legitimately "fail" with exit code 1 when there are
// conflicts — that is not a process error, it is a valid state the UI
// surfaces via getStatus() afterwards, so callers must not throw here.
export async function pull(cwd: string): Promise<GitResult> {
  const extraEnv = await buildAuthEnv(await getRemoteUrl(cwd))
  return runGit(['pull'], cwd, { extraEnv })
}

// The remote's default branch practically never changes for a given clone, and
// resolving it can cost a network round-trip, so successful answers are
// memoized for the lifetime of the process (failures are not, so a repo checked
// while offline can still resolve later).
const defaultBranchCache = new Map<string, string>()

async function readOriginHead(cwd: string): Promise<string | null> {
  const result = await readGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], cwd)
  if (result.exitCode !== 0) return null
  const value = result.stdout.trim() // "origin/main"
  return (value.startsWith('origin/') ? value.slice('origin/'.length) : value) || null
}

async function refExists(cwd: string, ref: string): Promise<boolean> {
  const result = await readGit(['rev-parse', '--verify', '--quiet', ref], cwd)
  return result.exitCode === 0
}

/**
 * Remote default branch name ('main', 'master', …) without the `origin/` prefix.
 * Nothing guarantees refs/remotes/origin/HEAD exists — `--single-branch` clones
 * and clones made by older git often lack it — so this falls back to asking the
 * remote, then to probing the conventional names.
 */
export async function resolveDefaultBranch(cwd: string): Promise<string | null> {
  const key = queueKey(cwd)
  const cached = defaultBranchCache.get(key)
  if (cached) return cached

  let name = await readOriginHead(cwd)

  if (!name) {
    // Asks the remote and writes refs/remotes/origin/HEAD, so at most one
    // network round-trip per repo per process.
    const extraEnv = await buildAuthEnv(await getRemoteUrl(cwd))
    await runGit(['remote', 'set-head', 'origin', '--auto'], cwd, { extraEnv })
    name = await readOriginHead(cwd)
  }

  if (!name) {
    for (const candidate of ['main', 'master']) {
      if (await refExists(cwd, `refs/remotes/origin/${candidate}`)) {
        name = candidate
        break
      }
    }
  }

  if (name) defaultBranchCache.set(key, name)
  return name
}

// `rev-list --left-right --count A...B` prints "<ahead>\t<behind>" — both
// counts from a single invocation.
async function countAheadBehind(
  cwd: string,
  left: string,
  right: string
): Promise<{ ahead: number; behind: number } | null> {
  const result = await readGit(['rev-list', '--left-right', '--count', `${left}...${right}`], cwd)
  if (result.exitCode !== 0) return null
  const [ahead, behind] = result.stdout.trim().split(/\s+/).map(Number)
  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return null
  return { ahead, behind }
}

function firstErrorLine(value: string, fallback: string): string {
  const line = value
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return line || fallback
}

/**
 * How far this repo sits from `origin/<default branch>`. With `fetch: true` it
 * refreshes the remote-tracking refs first (working tree untouched), which is
 * what makes the counts trustworthy — `fetch --dry-run` never updates them.
 */
export async function getRepoUpdateStatus(
  cwd: string,
  options?: { fetch?: boolean }
): Promise<RepoUpdateStatus> {
  // Both are read-only and skip the repo queue, so they can overlap.
  const [status, remoteUrl] = await Promise.all([getStatus(cwd), getRemoteUrl(cwd)])
  const common = {
    branch: status.branch,
    defaultBranch: null as string | null,
    behindDefault: 0,
    aheadOfDefault: 0,
    hasLocalDefault: false,
    localDefaultBehind: 0,
    localDefaultAhead: 0,
    ahead: status.ahead,
    behind: status.behind,
    localChanges: status.entries.length,
    canFastForward: false
  }

  if (!remoteUrl) {
    return { ...common, state: 'noRemote', message: tMain().git.noRemote }
  }

  if (options?.fetch) {
    try {
      await fetchRemote(cwd)
    } catch (err) {
      return {
        ...common,
        state: 'failed',
        message: firstErrorLine(err instanceof Error ? err.message : String(err), tMain().git.fetchFailed)
      }
    }
  }

  const defaultBranch = await resolveDefaultBranch(cwd)
  if (!defaultBranch) {
    return {
      ...common,
      state: 'noDefaultBranch',
      message: tMain().git.noDefaultBranchDetected
    }
  }

  const remoteRef = `refs/remotes/origin/${defaultBranch}`
  const localRef = `refs/heads/${defaultBranch}`
  // A missing local default just makes its rev-list fail (null), so all three
  // can run at once instead of waiting on refExists first.
  const [vsHead, hasLocalDefault, vsLocalDefaultRaw] = await Promise.all([
    countAheadBehind(cwd, 'HEAD', remoteRef),
    refExists(cwd, localRef),
    countAheadBehind(cwd, localRef, remoteRef)
  ])
  const vsLocalDefault = hasLocalDefault ? vsLocalDefaultRaw : null

  const behindDefault = vsHead?.behind ?? 0
  const localDefaultBehind = vsLocalDefault?.behind ?? 0
  const localDefaultAhead = vsLocalDefault?.ahead ?? 0
  const canFastForward = localDefaultBehind > 0 && localDefaultAhead === 0

  const diverged = localDefaultBehind > 0 && localDefaultAhead > 0
  const state: RepoUpdateStatus['state'] = diverged ? 'diverged' : behindDefault > 0 ? 'behind' : 'upToDate'
  // Without a local default branch there is nothing to fast-forward, so the
  // card offers no checkbox and no action — saying only "N commits atrás"
  // would leave the user staring at a warning with no way to act on it.
  const t = tMain().git
  const behindMessage =
    t.behindDefault(behindDefault, defaultBranch) + (hasLocalDefault ? '' : t.noLocalDefaultToAdvance(defaultBranch))

  const message = diverged
    ? t.localDefaultDivergedDetail(defaultBranch, localDefaultAhead, localDefaultBehind)
    : behindDefault > 0
      ? behindMessage
      : t.upToDateWith(defaultBranch)

  return {
    ...common,
    state,
    message,
    defaultBranch,
    behindDefault,
    aheadOfDefault: vsHead?.ahead ?? 0,
    hasLocalDefault,
    localDefaultBehind,
    localDefaultAhead,
    canFastForward
  }
}

// Explicit base first as typed, then the remote's view of it (what PRs merge
// into), then the local branch. Without a remote, falls back to main/master.
async function resolveIntegrationBase(cwd: string, requested?: string): Promise<{ ref: string; label: string }> {
  const wanted = requested?.trim()
  if (wanted) assertNotOption(wanted, tMain().git.optionLabel.baseBranch)
  const names = wanted ? [wanted] : [(await resolveDefaultBranch(cwd)) ?? 'main', 'master']

  for (const name of names) {
    for (const ref of [`refs/remotes/origin/${name}`, `refs/heads/${name}`, `refs/remotes/${name}`]) {
      if (await refExists(cwd, ref)) return { ref, label: ref.replace(/^refs\/(heads|remotes)\//, '') }
    }
  }
  throw new Error(tMain().git.baseBranchNotFound(names[0]))
}

// `git patch-id` hashes a diff independently of the commit carrying it, so the
// same changes hash the same after a squash or rebase merge. --verbatim, not
// --stable: --stable ignores whitespace, which would call a branch whose
// remaining changes are whitespace-only "integrated" — and let it be deleted.
// Returns patch-id → commit hash (all zeros when fed a plain diff).
async function patchIds(cwd: string, patch: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  if (!patch.trim()) return ids
  const result = await runGit(['patch-id', '--verbatim'], cwd, { serialize: false, stdin: patch })
  if (result.exitCode !== 0) return ids
  for (const line of result.stdout.split('\n')) {
    const [id, commit] = line.trim().split(/\s+/)
    if (id && commit) ids.set(id, commit)
  }
  return ids
}

// How far back on the base to look for a squash/rebase of a branch. A branch
// forked thousands of commits ago would otherwise pull a huge `log -p`.
const EQUIVALENCE_SCAN_LIMIT = 500

/**
 * Which branches (local, plus remote ones never checked out here) still carry
 * work the base branch lacks. Pure reads against the refs as of the last
 * fetch. A branch whose commits git does not find on the base is still
 * reported as 'equivalent' when its changes landed there by squash or rebase.
 */
export async function getBranchIntegration(cwd: string, base?: string): Promise<BranchIntegrationReport> {
  const baseRef = await resolveIntegrationBase(cwd, base)
  const baseShort = baseRef.label.replace(/^origin\//, '')

  const result = await readGit(
    [
      'for-each-ref',
      `--format=%(refname)${FS}%(refname:short)${FS}%(HEAD)${FS}%(symref)${FS}%(upstream:short)${FS}%(upstream:track)${FS}%(objectname:short)${FS}%(committerdate:short)${FS}%(subject)`,
      'refs/heads',
      'refs/remotes'
    ],
    cwd
  )
  throwOnFailure(result, ['for-each-ref'])

  const refs = result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [ref, name, head, symref, upstream, track, tip, date, subject] = line.split(FS)
      return { ref, name, head, symref, upstream, track, tip, date, subject }
    })
  const localNames = new Set(refs.filter((r) => r.ref.startsWith('refs/heads/')).map((r) => r.name))

  const candidates = refs.filter((r) => {
    if (r.symref || r.ref === baseRef.ref) return false
    if (r.ref.startsWith('refs/heads/')) return r.name !== baseShort
    // Remote: skip the remote's copy of the base and anything already covered
    // by a local branch of the same name.
    const branchName = r.name.slice(r.name.indexOf('/') + 1)
    return branchName !== baseShort && !localNames.has(branchName)
  })

  // Several branches usually fork from the same base commit — scan it once.
  const baseScans = new Map<string, Promise<Map<string, string>>>()
  const basePatchIds = (mergeBase: string): Promise<Map<string, string>> => {
    let scan = baseScans.get(mergeBase)
    if (!scan) {
      scan = readGit(
        ['log', '-p', '--no-merges', '--no-color', '--no-ext-diff', `--max-count=${EQUIVALENCE_SCAN_LIMIT}`, `${mergeBase}..${baseRef.ref}`],
        cwd
      ).then((r) => (r.exitCode === 0 ? patchIds(cwd, r.stdout) : new Map()))
      baseScans.set(mergeBase, scan)
    }
    return scan
  }

  const findEquivalent = async (ref: string, ahead: number): Promise<string | undefined> => {
    const mergeBase = await readGit(['merge-base', baseRef.ref, ref], cwd)
    if (mergeBase.exitCode !== 0) return undefined // unrelated histories
    const onBase = await basePatchIds(mergeBase.stdout.trim())
    if (onBase.size === 0) return undefined

    // Squash merge: the branch's whole diff matches one base commit.
    const whole = await readGit(['diff', '--no-color', '--no-ext-diff', mergeBase.stdout.trim(), ref], cwd)
    for (const id of (await patchIds(cwd, whole.stdout)).keys()) {
      if (onBase.has(id)) return onBase.get(id)
    }

    // Rebase merge / cherry-pick: each commit has its own twin on the base.
    // Needs every commit of the branch — a capped log could miss the one
    // without a twin — so very long branches just stay 'unmerged'.
    if (ahead > EQUIVALENCE_SCAN_LIMIT) return undefined
    const own = await readGit(['log', '-p', '--no-merges', '--no-color', '--no-ext-diff', `${baseRef.ref}..${ref}`], cwd)
    const ownIds = [...(await patchIds(cwd, own.stdout)).keys()]
    if (ownIds.length > 0 && ownIds.every((id) => onBase.has(id))) return onBase.get(ownIds[ownIds.length - 1])
    return undefined
  }

  const inspect = async (r: (typeof candidates)[number]): Promise<BranchIntegration> => {
    const counts = await countAheadBehind(cwd, r.ref, baseRef.ref)
    const ahead = counts?.ahead ?? 0
    const equivalentCommit = ahead > 0 ? await findEquivalent(r.ref, ahead) : undefined
    return {
      name: r.name,
      remoteOnly: r.ref.startsWith('refs/remotes/'),
      isCurrent: r.head === '*',
      upstream: r.upstream || null,
      upstreamGone: r.track === '[gone]',
      ahead,
      behind: counts?.behind ?? 0,
      tip: r.tip,
      lastCommitDate: r.date,
      lastCommitSummary: r.subject,
      state: ahead === 0 ? 'merged' : equivalentCommit ? 'equivalent' : 'unmerged',
      equivalentCommit: equivalentCommit?.slice(0, 7)
    }
  }

  // A few at a time: a repo with dozens of branches would otherwise spawn
  // several git processes per branch all at once.
  const branches: BranchIntegration[] = new Array(candidates.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < candidates.length) {
      const index = next++
      branches[index] = await inspect(candidates[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, candidates.length) }, worker))

  const defaultBranch = await resolveDefaultBranch(cwd)
  const protectedNames = [...new Set([...ALWAYS_PROTECTED_BRANCHES, baseShort, defaultBranch].filter(Boolean).map((n) => n!.toLowerCase()))]
  return { base: baseRef.label, protectedNames, branches }
}

// Never deletable through the agent, whatever it was asked — on top of the
// base and the remote's default branch, which are added per repo.
const ALWAYS_PROTECTED_BRANCHES = ['main', 'master']

/**
 * The agent's only way to delete branches. Re-checks everything here, right
 * before deleting, instead of trusting what the approval card showed: only
 * local branches, never a protected one or the current one, and only when
 * their work is already on the base (merged, or squash/rebase-equivalent).
 * Anything else is refused per branch, never deleted.
 */
export async function deleteIntegratedBranches(
  cwd: string,
  names: string[],
  base?: string
): Promise<BranchDeletionResult[]> {
  const t = tMain().git
  const report = await getBranchIntegration(cwd, base)
  const local = new Map(report.branches.filter((b) => !b.remoteOnly).map((b) => [b.name, b]))
  const protectedNames = new Set(report.protectedNames)

  const results: BranchDeletionResult[] = []
  for (const name of [...new Set(names.map((n) => n.trim()).filter(Boolean))]) {
    const info = local.get(name)
    let reason: string | undefined
    if (protectedNames.has(name.toLowerCase())) reason = t.protectedBranch(name)
    else if (!info) reason = t.notALocalBranch(name)
    else if (info.isCurrent) reason = t.cannotDeleteCurrent(name)
    else if (info.state === 'unmerged') reason = t.branchNotIntegrated(name, info.ahead, report.base)
    if (reason || !info) {
      results.push({ name, deleted: false, reason })
      continue
    }

    // -D, not -d: -d checks against HEAD/upstream rather than the base, and
    // rejects squash-merged branches outright. Integration was verified above.
    const result = await runGit(['branch', '-D', name], cwd)
    results.push(
      result.exitCode === 0
        ? { name, deleted: true, tip: info.tip }
        : { name, deleted: false, reason: firstErrorLine(result.stderr, t.deleteBranchFailed(name)) }
    )
  }
  return results
}

/**
 * Brings the local default branch up to `origin/<default>` by fast-forward only,
 * never creating a merge and never leaving the repo in a conflicted state.
 * Returns the outcome instead of throwing so a batch run can report per repo.
 */
export async function updateToDefaultBranch(cwd: string): Promise<RepoUpdateResult> {
  const defaultBranch = await resolveDefaultBranch(cwd)
  if (!defaultBranch) {
    return { outcome: 'skippedNoDefault', message: tMain().git.noDefaultBranch, commitsPulled: 0 }
  }
  assertNotOption(defaultBranch, tMain().git.labels.defaultBranch)

  const localRef = `refs/heads/${defaultBranch}`
  if (!(await refExists(cwd, localRef))) {
    return {
      outcome: 'skippedNoDefault',
      message: tMain().git.noLocalBranch(defaultBranch),
      commitsPulled: 0
    }
  }

  const counts = await countAheadBehind(cwd, localRef, `refs/remotes/origin/${defaultBranch}`)
  if (!counts) {
    return { outcome: 'failed', message: tMain().git.compareFailed(defaultBranch), commitsPulled: 0 }
  }
  if (counts.behind === 0) {
    return { outcome: 'alreadyUpToDate', message: tMain().git.alreadyUpToDate(defaultBranch), commitsPulled: 0 }
  }
  if (counts.ahead > 0) {
    return {
      outcome: 'skippedDiverged',
      message: tMain().git.localDefaultDiverged(defaultBranch, counts.ahead),
      commitsPulled: 0
    }
  }

  const status = await getStatus(cwd)
  const extraEnv = await buildAuthEnv(await getRemoteUrl(cwd))

  if (status.branch === defaultBranch) {
    if (status.entries.length > 0) {
      return {
        outcome: 'skippedDirty',
        message: tMain().git.uncommittedChanges(status.entries.length),
        commitsPulled: 0
      }
    }
    const result = await runGit(['pull', '--ff-only'], cwd, { extraEnv })
    if (result.exitCode !== 0) {
      return {
        outcome: 'failed',
        message: firstErrorLine(result.stderr, tMain().git.pullFfOnlyFailed),
        commitsPulled: 0
      }
    }
    return {
      outcome: 'updated',
      message: tMain().git.commitsPulled(counts.behind, defaultBranch),
      commitsPulled: counts.behind
    }
  }

  // Not on the default branch: advance the local ref without a checkout, so the
  // working tree and the current branch stay exactly as they are. Without a
  // leading '+' the refspec refuses non-fast-forward updates, and git itself
  // refuses to write a branch that is checked out (here or in a worktree).
  const result = await runGit(['fetch', 'origin', `${defaultBranch}:${defaultBranch}`], cwd, { extraEnv })
  if (result.exitCode !== 0) {
    return {
      outcome: 'failed',
      message: firstErrorLine(result.stderr, tMain().git.advanceFailed(defaultBranch)),
      commitsPulled: 0
    }
  }
  return {
    outcome: 'updated',
    message: tMain().git.advancedWhileOnOther(defaultBranch, counts.behind, status.branch ?? tMain().git.detachedHead),
    commitsPulled: counts.behind
  }
}

/**
 * True when the upstream's tip was, at some point, this branch's own tip — so
 * the only reason the remote is "ahead" is that the user rewrote those commits
 * locally (undo last commit / amend after a push), not that someone else pushed.
 * Rebasing onto the upstream there resurrects exactly what the user removed:
 * an amended commit whose content matches is silently dropped as "already
 * applied" and the old one survives. The branch reflog is what remembers it.
 */
async function upstreamWasLocalTip(cwd: string): Promise<boolean> {
  const upstream = await runGit(['rev-parse', '--verify', '--quiet', '@{upstream}'], cwd)
  const head = await runGit(['symbolic-ref', '--quiet', 'HEAD'], cwd)
  if (upstream.exitCode !== 0 || head.exitCode !== 0) return false
  const reflog = await runGit(['reflog', 'show', '--format=%H', '-n', '200', head.stdout.trim(), '--'], cwd)
  if (reflog.exitCode !== 0) return false
  return reflog.stdout.split('\n').includes(upstream.stdout.trim())
}

async function integrateUpstreamIfBehind(cwd: string, extraEnv?: Record<string, string>): Promise<void> {
  const behind = await runGit(['rev-list', '--count', 'HEAD..@{upstream}'], cwd)
  if (behind.exitCode !== 0) return
  const count = Number(behind.stdout.trim())
  if (!Number.isFinite(count) || count <= 0) return

  if (await upstreamWasLocalTip(cwd)) throw new Error(tMain().git.historyRewritten)

  // A plain rebase linearizes: a merge the user made locally (e.g. main into
  // their feature branch, conflicts already resolved) would be flattened into
  // its individual commits and the resolution replayed — or lost. When the
  // unpublished commits contain a merge, integrate with a merge instead.
  const localMerges = await runGit(['rev-list', '--merges', '--count', '@{upstream}..HEAD'], cwd)
  if (localMerges.exitCode === 0 && Number(localMerges.stdout.trim()) > 0) {
    // --ff overrides a user's pull.ff=only, which older git (< 2.34) applies
    // even with an explicit --no-rebase and would refuse the divergent merge.
    const merge = await runGit(['pull', '--no-rebase', '--ff', '--no-edit', '--autostash'], cwd, { extraEnv })
    if (merge.exitCode === 0) return
    await runGit(['merge', '--abort'], cwd).catch(() => undefined)
    throw new Error(merge.stderr.trim() || tMain().git.divergedMergeFailed)
  }

  const rebase = await runGit(['pull', '--rebase', '--autostash'], cwd, { extraEnv })
  if (rebase.exitCode === 0) return

  await runGit(['rebase', '--abort'], cwd).catch(() => undefined)
  throw new Error(rebase.stderr.trim() || tMain().git.divergedRebaseFailed)
}

export async function pushBranch(cwd: string, branch: string, setUpstream: boolean): Promise<void> {
  if (setUpstream) assertNotOption(branch, tMain().git.labels.branchName)
  const extraEnv = await buildAuthEnv(await getRemoteUrl(cwd))

  // First publish has no upstream yet — nothing to integrate.
  if (!setUpstream) {
    throwOnFailure(await runGit(['fetch', 'origin'], cwd, { extraEnv }), ['fetch', 'origin'])
    await integrateUpstreamIfBehind(cwd, extraEnv)
  }

  const args = setUpstream ? ['push', '-u', 'origin', branch] : ['push']
  const result = await runGit(args, cwd, { extraEnv })
  if (result.exitCode === 0) return

  // Race: remote moved between fetch and push — one more integrate attempt.
  if (/non-fast-forward|fetch first|behind/i.test(`${result.stderr}\n${result.stdout}`)) {
    throwOnFailure(await runGit(['fetch', 'origin'], cwd, { extraEnv }), ['fetch', 'origin'])
    await integrateUpstreamIfBehind(cwd, extraEnv)
    throwOnFailure(await runGit(args, cwd, { extraEnv }), args)
    return
  }

  throwOnFailure(result, args)
}

/**
 * Publishes a locally rewritten branch over its upstream. --force-with-lease
 * refuses if the remote moved since our last fetch, so it can only overwrite
 * the commits the user themselves replaced — never someone else's new work.
 */
export async function forcePushBranch(cwd: string): Promise<void> {
  const extraEnv = await buildAuthEnv(await getRemoteUrl(cwd))
  // Deliberately no fetch here: the lease compares the remote against our
  // origin/<branch> as of the push that detected the rewrite. Fetching first
  // would move that ref to whatever the remote has now, and the "lease" would
  // then happily overwrite a teammate's commit pushed in the meantime.
  const args = ['push', '--force-with-lease']
  throwOnFailure(await runGit(args, cwd, { extraEnv }), args)
}

/**
 * New commit that undoes `hash` — the safe way to back out something already
 * pushed. A merge commit needs to know which parent is the mainline (-m 1).
 * Like merge/pull, a conflict is a normal outcome: the result is returned, not
 * thrown, and the UI reads the conflicted files from status.
 */
export async function revertCommit(hash: string, cwd: string): Promise<GitResult> {
  assertNotOption(hash, tMain().git.labels.commitRef)
  const details = await getCommitDetails(cwd, hash)
  const args = ['revert', '--no-edit']
  if (details && details.parents.length > 1) args.push('-m', '1')
  args.push(hash)
  return runGit(args, cwd)
}

export async function mergeBranch(branchName: string, cwd: string): Promise<GitResult> {
  assertNotOption(branchName, tMain().git.optionLabel.branchName)
  return runGit(['merge', '--no-edit', branchName], cwd)
}

export async function abortMerge(cwd: string): Promise<void> {
  throwOnFailure(await runGit(['merge', '--abort'], cwd), ['merge', '--abort'])
}

export async function listStashes(cwd: string): Promise<StashEntry[]> {
  const result = await readGit(['stash', 'list', `--pretty=format:%gd${FS}%s`], cwd)
  throwOnFailure(result, ['stash', 'list'])

  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [ref, message] = line.split(FS)
      return { ref, message }
    })
}

export async function pushStash(cwd: string, message: string): Promise<void> {
  const args = message.trim() ? ['stash', 'push', '-u', '-m', message.trim()] : ['stash', 'push', '-u']
  throwOnFailure(await runGit(args, cwd), args)
}

/**
 * Full patch of a stash, so its content can be reviewed before applying.
 * --include-untracked (git >= 2.32) adds the new files `stash push -u` saved;
 * older git rejects the flag and gets the tracked part only.
 */
export async function getStashPatch(cwd: string, ref: string): Promise<string> {
  assertNotOption(ref, tMain().git.labels.stashRef)
  const withUntracked = await readGit(['stash', 'show', '-p', '--include-untracked', ref], cwd)
  if (withUntracked.exitCode === 0) return withUntracked.stdout
  if (!/unknown option|include-untracked/i.test(withUntracked.stderr)) throwOnFailure(withUntracked, ['stash', 'show'])
  const plain = await readGit(['stash', 'show', '-p', ref], cwd)
  throwOnFailure(plain, ['stash', 'show'])
  return plain.stdout
}

export async function applyStash(cwd: string, ref: string): Promise<void> {
  assertNotOption(ref, tMain().git.labels.stashRef)
  throwOnFailure(await runGit(['stash', 'apply', ref], cwd), ['stash', 'apply'])
}

export async function popStash(cwd: string, ref: string): Promise<void> {
  assertNotOption(ref, tMain().git.labels.stashRef)
  throwOnFailure(await runGit(['stash', 'pop', ref], cwd), ['stash', 'pop'])
}

export async function dropStash(cwd: string, ref: string): Promise<void> {
  assertNotOption(ref, tMain().git.labels.stashRef)
  throwOnFailure(await runGit(['stash', 'drop', ref], cwd), ['stash', 'drop'])
}

// Resolves a repo-relative path and guards against escaping the repo root,
// since these are used to read/write arbitrary tracked files by path.
function resolveWithinRepo(cwd: string, relativePath: string): string {
  const root = resolve(cwd)
  const target = resolve(cwd, relativePath)
  if (process.platform === 'win32') {
    const rootLower = root.toLowerCase()
    const targetLower = target.toLowerCase()
    if (targetLower !== rootLower && !targetLower.startsWith(rootLower + sep.toLowerCase())) {
      throw new Error(`Path "${relativePath}" escapes the repository root.`)
    }
  } else if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Path "${relativePath}" escapes the repository root.`)
  }
  return target
}

function isSameOrInside(root: string, target: string): boolean {
  const a = process.platform === 'win32' ? root.toLowerCase() : root
  const b = process.platform === 'win32' ? target.toLowerCase() : target
  return b === a || b.startsWith(a.endsWith(sep) ? a : a + sep)
}

/**
 * resolveWithinRepo() is purely lexical, so a symlink committed to a cloned
 * repo ("notes.txt -> ~/.ssh/id_rsa") or a Windows alias of .git (the 8.3
 * short name "GIT~1", or ".git." — Win32 drops trailing dots) walks right past
 * it. realpath resolves all of those to the real on-disk location, which is
 * what gets checked here. For a path that does not exist yet, the nearest
 * existing ancestor is what gets resolved.
 */
async function resolveRealWithinRepo(cwd: string, relativePath: string): Promise<string> {
  const lexical = resolveWithinRepo(cwd, relativePath)
  const realRoot = await realpath(resolve(cwd))

  let existing = lexical
  let suffix = ''
  for (;;) {
    try {
      const real = await realpath(existing)
      const target = suffix ? join(real, suffix) : real
      if (!isSameOrInside(realRoot, target)) {
        throw new Error(`Path "${relativePath}" escapes the repository root.`)
      }
      return target
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      const parent = dirname(existing)
      if (parent === existing) throw err
      suffix = suffix ? join(basename(existing), suffix) : basename(existing)
      existing = parent
    }
  }
}

export async function readRepoFile(cwd: string, relativePath: string): Promise<string> {
  return readFile(resolveWithinRepo(cwd, relativePath), 'utf-8')
}

// --- Files the AI agent is allowed to see -----------------------------------
//
// One rule, enforced in main so no renderer caller can forget it: tracked files
// plus new files that are not gitignored. Whatever the user deliberately kept
// out of git — .env, keys, credentials — is exactly what must not be shipped to
// a cloud model, and node_modules would only burn tokens.

/**
 * `--cached` are the tracked files; `--others --exclude-standard` adds new ones
 * that .gitignore does not cover. Together they *are* the policy, so the listing
 * can never show a file that readFileForAgent would refuse.
 */
export async function listRepoFiles(cwd: string, pattern?: string): Promise<string[]> {
  const args = ['ls-files', '--cached', '--others', '--exclude-standard']
  // After `--` so a pattern starting with "-" cannot be read as an option.
  if (pattern?.trim()) args.push('--', pattern.trim())
  const result = await readGit(args, cwd)
  throwOnFailure(result, args)
  return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean)
}

/**
 * check-ignore consults the index by default, so a tracked file that happens to
 * match a .gitignore pattern is correctly reported as NOT ignored.
 */
export async function isPathIgnored(cwd: string, relativePath: string): Promise<boolean> {
  const result = await readGit(['check-ignore', '-q', '--', relativePath], cwd)
  return result.exitCode === 0
}

// "Published" means some remote-tracking ref already has the commit — not "is
// behind the upstream": a branch pushed without -u has no upstream, yet its
// commits are on the remote (push updates refs/remotes/<remote>/<branch>).
const UNPUBLISHED_RANGE = ['HEAD', '--not', '--remotes']

export async function isCommitPublished(cwd: string, ref = 'HEAD'): Promise<boolean> {
  assertNotOption(ref, tMain().git.labels.ref)
  const result = await readGit(['rev-list', '-n', '1', ref, '--not', '--remotes'], cwd)
  throwOnFailure(result, ['rev-list', ref, '--not', '--remotes'])
  return result.stdout.trim() === ''
}

/**
 * The chat's undo holds the repo queue across every check and the reset. A
 * queued push or HEAD move must finish before validation, or wait until undo
 * finishes; it cannot invalidate the checks while the reset waits its turn.
 */
export async function undoUnpublishedCommit(cwd: string, expectedHash: string): Promise<void> {
  await enqueue(queueKey(cwd), async () => {
    const head = await readGit(['rev-parse', '--verify', 'HEAD'], cwd)
    if (head.exitCode !== 0) throw new Error(tMain().git.noCommitsYet)
    const hash = head.stdout.trim()
    if (hash !== expectedHash) {
      throw new Error(tMain().git.lastCommitChanged)
    }
    if ((await readGit(['rev-parse', '-q', '--verify', 'MERGE_HEAD'], cwd)).exitCode === 0) {
      throw new Error(tMain().git.mergeInProgress)
    }
    if (await isCommitPublished(cwd, hash)) {
      throw new Error(tMain().git.lastCommitPublished)
    }
    await resetSoftHeadInQueue(cwd)
  })
}

export async function locateFileInHistory(cwd: string, relativePath: string): Promise<FileHistoryLocation> {
  const path = normalizeGitIgnorePattern(relativePath)
  const absolute = resolveWithinRepo(cwd, path)

  const upstreamResult = await readGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], cwd)
  const upstream = upstreamResult.exitCode === 0 ? upstreamResult.stdout.trim() || null : null

  // --full-history without --first-parent: push sends every unpublished commit,
  // including a merged branch's commit that added the file and a later one that
  // removed it before the merge. --diff-filter=d skips deletions, so the fix
  // commit that only drops the file is never mistaken for the offending one.
  // Diff merges against their first parent too: conflict resolutions can add
  // content absent from both parents. This does not limit history traversal.
  // Suppress the patch output enabled by --diff-merges; only metadata is needed.
  const touching = await readGit(
    [
      'log', '--full-history', '--diff-merges=first-parent', '--no-patch',
      '--diff-filter=d', '--format=%H%x09%h%x09%s', ...UNPUBLISHED_RANGE, '--', path
    ],
    cwd
  )
  const localCommits =
    touching.exitCode === 0
      ? touching.stdout
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [hash, shortHash, ...summary] = line.split('\t')
            return { hash, shortHash, summary: summary.join('\t') }
          })
      : []

  // `reset --soft HEAD~1` walks first parents only: a commit on a merged branch
  // is gone once the oldest first-parent commit containing it (the merge) is.
  let undoCount = 0
  if (localCommits.length > 0) {
    const fpResult = await readGit(['rev-list', '--first-parent', ...UNPUBLISHED_RANGE], cwd)
    const firstParents = fpResult.exitCode === 0 ? fpResult.stdout.split('\n').map((l) => l.trim()).filter(Boolean) : []
    for (const commit of localCommits) {
      let index = firstParents.indexOf(commit.hash)
      if (index === -1) {
        for (let i = firstParents.length - 1; i >= 0; i--) {
          if ((await readGit(['merge-base', '--is-ancestor', commit.hash, firstParents[i]], cwd)).exitCode === 0) {
            index = i
            break
          }
        }
      }
      undoCount = Math.max(undoCount, index + 1)
    }
  }

  const remoteResult = await readGit(['log', '-1', '--format=%h', '--remotes', '--', path], cwd)
  const onRemote = remoteResult.exitCode === 0 && remoteResult.stdout.trim() !== ''

  let existsOnDisk = true
  try {
    await access(absolute)
  } catch {
    existsOnDisk = false
  }
  const inIndex = (await readGit(['ls-files', '--error-unmatch', '--', path], cwd)).exitCode === 0

  return { path, upstream, localCommits, undoCount, onRemote, existsOnDisk, inIndex }
}

/** A NUL byte in the head of the file is the usual "this is not text" signal. */
function looksBinary(content: string): boolean {
  return content.slice(0, 8000).includes('\0')
}

/**
 * The .gitignore rule alone leaves a hole: git never ignores its own directory,
 * so check-ignore reports .git/config as readable — and that file routinely
 * holds an embedded token ("https://user:ghp_xxx@github.com/..."), which is the
 * exact thing the ignore rule exists to keep away from the model. The repo's
 * internals are not source code the agent has any reason to read anyway.
 *
 * Takes the already-resolved absolute path, so "src/../.git/config" cannot slip
 * past a string match. Every segment is checked rather than just the first: a
 * nested clone or a vendored dependency carries its own .git with its own
 * credentials.
 */
function isInsideGitDir(root: string, absoluteTarget: string): boolean {
  return absoluteTarget
    .slice(root.length)
    .split(/[\\/]/)
    .some((segment) => segment.toLowerCase() === '.git')
}

export async function readFileForAgent(cwd: string, relativePath: string): Promise<string> {
  // Throws on anything outside the repo, and hands back the real (symlinks and
  // Windows aliases resolved) absolute path — which is what makes the .git
  // check below safe to do by segment.
  const target = await resolveRealWithinRepo(cwd, relativePath)
  if (isInsideGitDir(await realpath(resolve(cwd)), target)) {
    throw new Error(tMain().git.agentReadGitDir(relativePath))
  }
  if (await isPathIgnored(cwd, relativePath)) {
    throw new Error(tMain().git.agentReadIgnored(relativePath))
  }
  const content = await readFile(target, 'utf-8')
  if (looksBinary(content)) {
    throw new Error(tMain().git.agentReadBinary(relativePath))
  }
  return content
}

export async function writeRepoFile(cwd: string, relativePath: string, content: string): Promise<void> {
  // Real path, so a symlinked file or folder in the repo cannot redirect the
  // write (a conflict resolution or an AI-proposed fix) outside of it.
  const target = await resolveRealWithinRepo(cwd, relativePath)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content, 'utf-8')
}

function normalizeGitIgnorePattern(pattern: string): string {
  let normalized = pattern.replace(/\\/g, '/').trim()
  while (normalized.startsWith('./')) normalized = normalized.slice(2)
  return normalized
}

export async function addToGitIgnore(
  cwd: string,
  patterns: string[]
): Promise<{ success: boolean; message: string }> {
  const normalized = [...new Set(patterns.map(normalizeGitIgnorePattern).filter(Boolean))]
  if (normalized.length === 0) return { success: true, message: '' }

  try {
    const gitignorePath = join(cwd, '.gitignore')
    let existingText = ''
    const existing = new Set<string>()
    try {
      existingText = await readFile(gitignorePath, 'utf-8')
      for (const line of existingText.split('\n')) existing.add(line.trim())
    } catch {
      // .gitignore may not exist yet
    }

    const toAdd = normalized.filter((p) => !existing.has(p))
    if (toAdd.length === 0) {
      return { success: true, message: tMain().git.gitignorePatternExists }
    }

    let next = existingText
    if (next.length > 0 && !next.endsWith('\n')) next += '\n'
    next += toAdd.map((p) => `${p}\n`).join('')
    await writeFile(gitignorePath, next, 'utf-8')
    return { success: true, message: tMain().git.gitignoreAdded(toAdd.join(', ')) }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  }
}

export async function stopTracking(
  cwd: string,
  paths: string[]
): Promise<{ success: boolean; message: string }> {
  const distinct = [...new Set(paths.filter(Boolean))]
  if (distinct.length === 0) return { success: true, message: '' }

  const result = await runGit(['rm', '--cached', '-f', '--', ...distinct], cwd)
  if (result.exitCode === 0) return { success: true, message: '' }
  const message = (result.stderr || result.stdout).trim()
  return { success: false, message: message || tMain().git.stopTrackingFailed }
}

export function resolveRepoPath(cwd: string, relativePath: string): string {
  return resolveWithinRepo(cwd, relativePath)
}
