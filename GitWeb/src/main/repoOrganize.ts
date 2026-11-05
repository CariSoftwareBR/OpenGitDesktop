import { randomUUID } from 'crypto'
import { existsSync, statSync } from 'fs'
import { mkdir, readFile, readdir, rename, rmdir } from 'fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import { getRemoteUrl } from './gitProcess'
import { listRecentRepositories, moveRecentRepositories } from './recentRepositories'
import { scanForRepositories } from './repoScan'
import { ownerFolders, parseRemoteUrl } from '../shared/remoteOwner'
import type { ReorganizePlan, ReorganizeResult, RepoMove, RepoMoveFailure } from '../shared/repoOrganize'

const RENAME_ATTEMPTS = 5
const RENAME_RETRY_MS = 300
// Deeper than the "open a folder" scan: a GitLab repository in a subgroup lands
// at root/group/subgroup/repo, and has to be recognized as organized afterwards.
const SCAN_DEPTH = 4

/** The repository is safe but neither here nor there: the user has to be told where it is. */
class StrandedRepositoryError extends Error {
  constructor(readonly location: string) {
    super(location)
  }
}

function pathKey(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

function samePath(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b)
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel)
}

function hasGitDir(path: string): boolean {
  try {
    return statSync(join(path, '.git')).isDirectory()
  } catch {
    return false
  }
}

async function hasWorktreeRegistrations(gitDir: string): Promise<boolean> {
  try {
    return (await readdir(join(gitDir, 'worktrees'))).length > 0
  } catch (err) {
    // An unreadable registration directory must not be treated as safe to move.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    return false
  }
}

/** Deinitialized submodules keep their Git directories (and worktrees) under .git/modules. */
async function hasModuleWorktrees(gitDir: string): Promise<boolean> {
  const pending = [join(gitDir, 'modules')]
  while (pending.length > 0) {
    const dir = pending.pop()!
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      continue
    }
    if (entries.some((entry) => entry.name === 'HEAD' && entry.isFile())) {
      if (await hasWorktreeRegistrations(dir)) return true
      // Only nested modules matter here, not the object database or refs.
      pending.push(join(dir, 'modules'))
    } else {
      // Submodule names can contain multiple path segments.
      for (const entry of entries) if (entry.isDirectory()) pending.push(join(dir, entry.name))
    }
  }
  return false
}

/** Worktrees also belong to nested repositories and submodules, not just the root. */
async function hasLinkedWorktrees(path: string): Promise<boolean> {
  const pending = [path]
  while (pending.length > 0) {
    const dir = pending.pop()!
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const child = join(dir, entry.name)
      if (entry.name === '.git') {
        let gitDir = child
        if (!entry.isDirectory()) {
          const match = /^gitdir:\s*(.+)$/m.exec(await readFile(child, 'utf8'))
          if (!match) continue
          gitDir = resolve(dir, match[1].trim())
        }
        // A linked checkout inside the folder has an absolute backlink too.
        if (
          existsSync(join(gitDir, 'commondir')) ||
          await hasWorktreeRegistrations(gitDir) ||
          await hasModuleWorktrees(gitDir)
        ) return true
      } else if (entry.isDirectory()) {
        // Don't follow symlinks/junctions: moving the link doesn't move its target.
        // Hidden/vendor folders still matter when checking what a rename carries.
        pending.push(child)
      }
    }
  }
  return false
}

/** Folders above the target that are themselves repositories (the repository's own folder aside). */
function repositoriesAboveTarget(root: string, move: RepoMove): string[] {
  const found: string[] = []
  for (let dir = dirname(move.to); isInside(root, dir); dir = dirname(dir)) {
    if (hasGitDir(dir) && !samePath(dir, move.from)) found.push(dir)
  }
  return found
}

/** The base folder may already be that account's folder — no root/acme/acme/site then. */
function targetFor(root: string, repoPath: string, folders: string[]): string {
  const parent = samePath(basename(root), folders[folders.length - 1]) ? root : join(root, ...folders)
  return join(parent, basename(repoPath))
}

/**
 * Orders the moves so each one runs after the repositories in its way have left
 * (say root/acme, whose account is also acme). Returns what could be scheduled:
 * a repository in the way that stays put — or two waiting on each other — leaves
 * the remaining moves out, so the preview never promises what can't happen.
 */
function scheduleMoves(root: string, moves: RepoMove[]): { scheduled: RepoMove[]; blocked: RepoMove[] } {
  const scheduled: RepoMove[] = []
  const gone = new Set<string>()
  let pending = moves
  for (;;) {
    const ready = pending.filter((move) => repositoriesAboveTarget(root, move).every((dir) => gone.has(pathKey(dir))))
    if (ready.length === 0) return { scheduled, blocked: pending }
    scheduled.push(...ready)
    for (const move of ready) gone.add(pathKey(move.from))
    pending = pending.filter((move) => !ready.includes(move))
  }
}

export async function planReorganization(rootPath: string): Promise<ReorganizePlan> {
  const root = resolve(rootPath)
  const plan: ReorganizePlan = { root, rootIsRepository: false, moves: [], alreadyOrganized: 0, skipped: [] }
  if (hasGitDir(root)) return { ...plan, rootIsRepository: true }

  const found = await scanForRepositories(root, SCAN_DEPTH)
  const remotes = await Promise.all(found.map((path) => getRemoteUrl(path).catch(() => null)))

  const candidates: RepoMove[] = []
  found.forEach((path, index) => {
    const remote = remotes[index]
    if (!remote) {
      plan.skipped.push({ path, reason: 'noRemote' })
      return
    }
    const folders = ownerFolders(parseRemoteUrl(remote)?.owner ?? '')
    if (!folders) {
      plan.skipped.push({ path, reason: 'unknownOwner' })
      return
    }
    const to = targetFor(root, path, folders)
    if (samePath(path, to)) plan.alreadyOrganized++
    else candidates.push({ from: path, to })
  })

  const claimed = new Set<string>()
  const possible: RepoMove[] = []
  for (const move of candidates.sort((a, b) => a.to.localeCompare(b.to))) {
    if (await hasLinkedWorktrees(move.from)) {
      plan.skipped.push({ path: move.from, reason: 'hasWorktrees', target: move.to })
    } else if (claimed.has(pathKey(move.to)) || existsSync(move.to)) {
      plan.skipped.push({ path: move.from, reason: 'targetExists', target: move.to })
    } else {
      claimed.add(pathKey(move.to))
      possible.push(move)
    }
  }

  const { scheduled, blocked } = scheduleMoves(root, possible)
  plan.moves = scheduled
  for (const move of blocked) plan.skipped.push({ path: move.from, reason: 'ownerFolderIsRepo', target: move.to })
  return plan
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms))
}

function isLockError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code
  return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES'
}

// Antivirus, the indexer or a background `git` can hold a folder for a moment.
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (err) {
      if (attempt >= RENAME_ATTEMPTS || !isLockError(err)) throw err
      await sleep(RENAME_RETRY_MS)
    }
  }
}

/** Walks up from `from`, stopping below `stop`. rmdir only takes empty folders, so anything with content stays. */
async function removeEmptyFolders(from: string, stop: string): Promise<void> {
  try {
    for (let dir = from; isInside(stop, dir); dir = dirname(dir)) await rmdir(dir)
  } catch {
    // Not empty, or held open: nothing to tidy up.
  }
}

async function moveRepository(move: RepoMove, root: string): Promise<void> {
  // root/acme → root/acme/acme: a folder can't be renamed into itself, so it
  // steps aside first and the account's folder is created where it was.
  if (isInside(move.from, move.to)) {
    const aside = join(root, `.ogd-move-${randomUUID()}`)
    await renameWithRetry(move.from, aside)
    try {
      await mkdir(dirname(move.to), { recursive: true })
      await renameWithRetry(aside, move.to)
    } catch (err) {
      // Only what this move created goes: the folder above the original stays,
      // or the repository would have nowhere to come back to.
      await removeEmptyFolders(dirname(move.to), dirname(move.from))
      try {
        await renameWithRetry(aside, move.from)
      } catch {
        throw new StrandedRepositoryError(aside)
      }
      throw err
    }
    return
  }

  await mkdir(dirname(move.to), { recursive: true })
  try {
    await renameWithRetry(move.from, move.to)
  } catch (err) {
    await removeEmptyFolders(dirname(move.to), root)
    throw err
  }
  await removeEmptyFolders(dirname(move.from), root)
}

/**
 * Moves what the user confirmed. The plan is worked out again here rather than
 * trusted from the renderer, and a repository that no longer fits it stays put.
 * One failure never stops the rest; renames are atomic, so each repository is
 * either fully in the old place or fully in the new one.
 */
export async function applyReorganization(
  rootPath: string,
  confirmedMoves: RepoMove[]
): Promise<Pick<ReorganizeResult, 'moved' | 'failed'>> {
  const plan = await planReorganization(rootPath)
  const planned = new Map(plan.moves.map((move) => [pathKey(move.from), move]))
  const result: Pick<ReorganizeResult, 'moved' | 'failed'> = { moved: [], failed: [] }

  const fail = (move: RepoMove, reason: RepoMoveFailure, detail?: string): void => {
    result.failed.push({ ...move, reason, detail })
  }

  const confirmed = new Set<string>()
  for (const move of confirmedMoves) {
    const key = pathKey(resolve(move.from))
    const current = planned.get(key)
    if (!current || !samePath(current.to, resolve(move.to))) fail(move, 'planChanged')
    else confirmed.add(key)
  }

  for (const move of plan.moves) {
    if (!confirmed.has(pathKey(move.from))) continue
    // Earlier moves may have failed: what looked clear in the plan may not be.
    if (existsSync(move.to)) fail(move, 'targetExists')
    else if (repositoriesAboveTarget(plan.root, move).length > 0) fail(move, 'ownerFolderIsRepo')
    else {
      try {
        await moveRepository(move, plan.root)
        result.moved.push(move)
      } catch (err) {
        if (err instanceof StrandedRepositoryError) fail(move, 'stranded', err.location)
        else if (isLockError(err)) fail(move, 'inUse')
        else fail(move, 'other', err instanceof Error ? err.message : String(err))
      }
    }
  }
  return result
}

/** The folders have already changed when the recents are written, so that failing can't hide what moved. */
export async function reorganizeRepositories(rootPath: string, confirmedMoves: RepoMove[]): Promise<ReorganizeResult> {
  const result = await applyReorganization(rootPath, confirmedMoves)
  try {
    return { ...result, recent: await moveRecentRepositories(result.moved) }
  } catch (err) {
    return {
      ...result,
      recent: await listRecentRepositories(),
      recentError: err instanceof Error ? err.message : String(err)
    }
  }
}
