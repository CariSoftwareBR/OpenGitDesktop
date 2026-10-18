import { parseGitHubRemote } from '../../../shared/githubRemote'
import { MAX_CLONE_BASE_FOLDERS } from '../../../shared/settings'
import { basename, dirname, joinPath, pathsEqual, stripTrailingSep } from './path'

export function repoNameFromCloneUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  const parsed = parseGitHubRemote(trimmed)
  if (parsed?.repo) {
    const name = parsed.repo.split(/[\\/]/).pop() ?? parsed.repo
    return name.replace(/\.git$/i, '')
  }
  const withoutGit = trimmed.replace(/[\\/]+$/, '').replace(/\.git$/i, '')
  const last = withoutGit.split(/[\\/]/).pop() ?? ''
  const afterColon = last.includes(':') ? (last.split(':').pop() ?? last) : last
  return afterColon
}

export function collectCloneBaseFolders(
  saved: string[],
  lastUsed: string | null,
  recentRepoPaths: string[]
): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  function add(raw: string | null | undefined): void {
    if (!raw?.trim()) return
    const path = stripTrailingSep(raw.trim())
    const key = path.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    result.push(path)
  }

  add(lastUsed)
  for (const folder of saved) add(folder)
  for (const repoPath of recentRepoPaths) add(dirname(repoPath))
  return result
}

export function rememberCloneBaseFolder(
  folder: string,
  currentFolders: string[]
): { cloneBaseFolders: string[]; lastCloneBaseFolder: string } {
  const normalized = stripTrailingSep(folder.trim())
  const key = normalized.toLowerCase()
  const without = currentFolders.filter((path) => stripTrailingSep(path).toLowerCase() !== key)
  return {
    cloneBaseFolders: [normalized, ...without].slice(0, MAX_CLONE_BASE_FOLDERS),
    lastCloneBaseFolder: normalized
  }
}

export function destinationForRepo(
  currentDest: string,
  baseFolder: string,
  previousRepoName: string,
  nextRepoName: string
): string {
  if (!nextRepoName) return currentDest
  const dest = currentDest.trim()
  const destIsOnlyBase = !dest || pathsEqual(dest, baseFolder)
  const destName = dest ? basename(dest) : ''
  const userCustomizedName =
    Boolean(dest) && !destIsOnlyBase && destName !== previousRepoName && destName !== nextRepoName
  if (userCustomizedName) return dest
  const base = destIsOnlyBase ? baseFolder || dirname(dest) : dirname(dest) || baseFolder
  if (!base) return currentDest
  return joinPath(base, nextRepoName)
}

export function destinationWithBase(
  currentDest: string,
  previousBase: string,
  newBase: string,
  fallbackRepoName: string
): string {
  const dest = currentDest.trim()
  if (!dest || pathsEqual(dest, previousBase)) {
    return fallbackRepoName ? joinPath(newBase, fallbackRepoName) : newBase
  }
  const name = basename(dest)
  if (!name || pathsEqual(name, basename(previousBase))) {
    return fallbackRepoName ? joinPath(newBase, fallbackRepoName) : newBase
  }
  return joinPath(newBase, name)
}
