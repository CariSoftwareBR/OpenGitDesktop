// Background "how far is this repo from origin/<default branch>?" check for the
// recent-repos list. All the git work happens in the main process
// (getRepoUpdateStatus), so one IPC round-trip per repo is enough.

import type { RepoUpdateStatus } from '../../../shared/git'
import { getT } from './i18n'

export type { RepoUpdateStatus, RepoUpdateResult, RepoUpdateState, RepoUpdateOutcome } from '../../../shared/git'

/**
 * `fetch: true` refreshes the remote-tracking refs first — required for the
 * commit counts to be current, since nothing else updates them. It costs a
 * network round-trip, so pass false right after an operation that already
 * fetched.
 */
export async function checkRepoUpdate(repoPath: string, fetch: boolean): Promise<RepoUpdateStatus> {
  return window.api.git.repoUpdateStatus(repoPath, { fetch })
}

// Mirrors the old app's SemaphoreSlim(2) throttle: hitting every repo's remote
// in parallel with no cap can hammer a slow network/VPN.
export async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency = 2
): Promise<void> {
  let index = 0
  async function pump(): Promise<void> {
    while (index < items.length) {
      await worker(items[index++])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, pump))
}

export async function scanReposForUpdates(
  repoPaths: string[],
  onResult: (path: string, check: RepoUpdateStatus) => void,
  concurrency = 2
): Promise<void> {
  await runWithConcurrency(
    repoPaths,
    async (path) => {
      try {
        onResult(path, await checkRepoUpdate(path, true))
      } catch (err) {
        onResult(path, failedCheck(err))
      }
    },
    concurrency
  )
}

const EMPTY_CHECK: Omit<RepoUpdateStatus, 'state' | 'message'> = {
  branch: null,
  defaultBranch: null,
  behindDefault: 0,
  aheadOfDefault: 0,
  hasLocalDefault: false,
  localDefaultBehind: 0,
  localDefaultAhead: 0,
  ahead: 0,
  behind: 0,
  localChanges: 0,
  canFastForward: false
}

/** A repo whose check threw — kept as a real status so one failure never blanks the row. */
export function failedCheck(err: unknown): RepoUpdateStatus {
  return { ...EMPTY_CHECK, state: 'failed', message: err instanceof Error ? err.message : String(err) }
}

export function checkingPlaceholder(): RepoUpdateStatus {
  return { ...EMPTY_CHECK, state: 'checking', message: getT().stores.checking }
}
