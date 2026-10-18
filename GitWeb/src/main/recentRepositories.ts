import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { basename, resolve } from 'path'
import { readJson, updateJson } from './appDataStore'
import type { RecentReposData, RecentRepository, RepoGroup } from '../shared/git'

const FILE_NAME = 'recent-repos.json'

// Applies only to repositories with no group — those are history, and history
// rotates. Anything the user filed into a folder is organisation, and is kept
// however old it gets (see pruneAndCap).
const MAX_UNGROUPED = 20

/** On-disk shape. v1 was a bare RecentRepository[]. */
interface StoredFile {
  version: 2
  groups: RepoGroup[]
  repos: { name: string; path: string; groupId: string | null }[]
}

const EMPTY: StoredFile = { version: 2, groups: [], repos: [] }

/**
 * One spelling per folder: forward or back slashes, a trailing separator and
 * (on Windows) letter case all name the same repository, which must not show
 * up as separate cards.
 */
function canonicalPath(path: string): string {
  return resolve(path)
}

function samePath(a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

/** Keeps the first entry of each folder (the list is most-recent first). */
function dedupe(repos: StoredFile['repos']): StoredFile['repos'] {
  const kept: StoredFile['repos'] = []
  for (const repo of repos) {
    if (!kept.some((k) => samePath(k.path, repo.path))) kept.push(repo)
  }
  return kept
}

/** Accepts both the v1 bare array and the v2 object, so old installs migrate silently. */
function normalize(raw: unknown): StoredFile {
  if (Array.isArray(raw)) {
    return {
      version: 2,
      groups: [],
      repos: dedupe(
        raw
          .filter((r): r is { name: string; path: string } => Boolean(r) && typeof (r as { path?: unknown }).path === 'string')
          .map((r) => ({ name: r.name ?? basename(r.path), path: canonicalPath(r.path), groupId: null }))
      )
    }
  }

  const file = (raw ?? {}) as Partial<StoredFile>
  const groups = Array.isArray(file.groups) ? file.groups : []
  const knownGroupIds = new Set(groups.map((g) => g.id))
  const repos = Array.isArray(file.repos) ? file.repos : []

  return {
    version: 2,
    groups: groups.map((g) => ({ id: g.id, name: g.name, collapsed: Boolean(g.collapsed) })),
    repos: dedupe(repos
      .filter((r) => r && typeof r.path === 'string')
      .map((r) => ({
        name: r.name ?? basename(r.path),
        path: canonicalPath(r.path),
        // A group that no longer exists would strand the repo invisibly.
        groupId: r.groupId && knownGroupIds.has(r.groupId) ? r.groupId : null
      })))
  }
}

/**
 * Drops loose repositories that vanished from disk or fell past the cap.
 * Grouped ones survive both: a disconnected external drive must not silently
 * erase how the user organised things — the renderer shows them as missing.
 */
function pruneAndCap(file: StoredFile): StoredFile {
  const grouped = file.repos.filter((r) => r.groupId !== null)
  const loose = file.repos.filter((r) => r.groupId === null && existsSync(r.path)).slice(0, MAX_UNGROUPED)
  const kept = new Set([...grouped, ...loose])
  // Preserves the original ordering rather than grouping the two buckets.
  return { ...file, repos: file.repos.filter((r) => kept.has(r)) }
}

function toData(file: StoredFile): RecentReposData {
  return {
    groups: file.groups,
    repos: file.repos.map((r) => ({ ...r, missing: !existsSync(r.path) }))
  }
}

/** Every mutation goes through updateJson so concurrent writes cannot clobber. */
function mutate(updater: (file: StoredFile) => StoredFile): Promise<RecentReposData> {
  return updateJson<StoredFile>(FILE_NAME, EMPTY, (raw) => pruneAndCap(updater(normalize(raw)))).then(toData)
}

/**
 * Read-only: prunes for the caller's view but never writes. Going through
 * mutate() would rewrite recent-repos.json on every render of the initial
 * screen, and a listing has no business touching the disk. Whatever the prune
 * removed is dropped for good on the next real mutation.
 */
export async function listRecentRepositories(): Promise<RecentReposData> {
  return toData(pruneAndCap(normalize(await readJson<unknown>(FILE_NAME, EMPTY))))
}

export function addRecentRepository(path: string): Promise<RecentReposData> {
  return addRecentRepositories([path])
}

export function addRecentRepositories(paths: string[]): Promise<RecentReposData> {
  return mutate((file) => {
    const incoming = paths.map(canonicalPath)
    // Re-adding a repository must not tear it out of its folder.
    const groupOf = (path: string): string | null => file.repos.find((r) => samePath(r.path, path))?.groupId ?? null
    const untouched = file.repos.filter((r) => !incoming.some((p) => samePath(p, r.path)))
    const added = incoming.map((path) => ({
      name: basename(path),
      path,
      groupId: groupOf(path)
    }))
    return { ...file, repos: [...added, ...untouched] }
  })
}

export function removeRecentRepository(path: string): Promise<RecentReposData> {
  return mutate((file) => ({ ...file, repos: file.repos.filter((r) => !samePath(r.path, canonicalPath(path))) }))
}

export function createRepoGroup(name: string): Promise<RecentReposData> {
  return mutate((file) => ({
    ...file,
    groups: [...file.groups, { id: randomUUID(), name: name.trim() || 'Nova pasta', collapsed: false }]
  }))
}

export function renameRepoGroup(id: string, name: string): Promise<RecentReposData> {
  return mutate((file) => ({
    ...file,
    groups: file.groups.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g))
  }))
}

/** Deleting a folder never deletes repositories — they fall back to loose. */
export function deleteRepoGroup(id: string): Promise<RecentReposData> {
  return mutate((file) => ({
    ...file,
    groups: file.groups.filter((g) => g.id !== id),
    repos: file.repos.map((r) => (r.groupId === id ? { ...r, groupId: null } : r))
  }))
}

export function setRepoGroup(path: string, groupId: string | null): Promise<RecentReposData> {
  return mutate((file) => ({
    ...file,
    repos: file.repos.map((r) => (samePath(r.path, canonicalPath(path)) ? { ...r, groupId } : r))
  }))
}

export function setRepoGroupCollapsed(id: string, collapsed: boolean): Promise<RecentReposData> {
  return mutate((file) => ({
    ...file,
    groups: file.groups.map((g) => (g.id === id ? { ...g, collapsed } : g))
  }))
}
