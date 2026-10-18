import { allTranslations } from './i18n'

export interface GitResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

export interface StatusEntry {
  path: string
  index: string
  worktree: string
  renamedFrom?: string
}

export interface RepoStatus {
  entries: StatusEntry[]
  branch: string | null
  ahead: number
  behind: number
  upstream: string | null
  /**
   * A merge was started and not yet committed or aborted (MERGE_HEAD exists).
   * Once every conflict is resolved this can be the only thing left — even with
   * nothing to stage, when the resolution kept the current branch's version.
   */
  mergeInProgress?: boolean
}

export interface BranchInfo {
  name: string
  isCurrent: boolean
}

export interface GitIdentity {
  name: string | null
  email: string | null
}

// Phases `git clone --progress` reports on stderr, in the order they occur.
export type ClonePhase = 'counting' | 'compressing' | 'receiving' | 'resolving' | 'checkingOut'

export interface CloneProgress {
  destination: string
  phase: ClonePhase
  percent: number
  objects: number
  totalObjects: number
  /** Already formatted by git ("5.43 MiB"); null outside the download phase. */
  transferred: string | null
  /** Already formatted by git ("1.20 MiB/s"); null outside the download phase. */
  rate: string | null
}

/** Cancelling is a normal outcome, not an error — real failures still throw. */
export type CloneOutcome = { status: 'ok' } | { status: 'cancelled' }

export type RepoUpdateState =
  | 'checking'
  | 'upToDate'
  | 'behind'
  | 'diverged'
  | 'noRemote'
  | 'noDefaultBranch'
  | 'failed'

// Snapshot of "how far is this repo from the remote's default branch", used by
// the recent-repos list on the initial screen. Every count is measured after a
// real `git fetch`, so unlike the porcelain ahead/behind it is not stale.
export interface RepoUpdateStatus {
  state: RepoUpdateState
  message: string
  /** Branch currently checked out, or null when detached / no commits yet. */
  branch: string | null
  /** Remote default branch name without the `origin/` prefix ('main', 'master', …). */
  defaultBranch: string | null
  /** HEAD..origin/<default> — the headline "N commits behind main" number. */
  behindDefault: number
  /** origin/<default>..HEAD */
  aheadOfDefault: number
  hasLocalDefault: boolean
  /** <default>..origin/<default> — what a fast-forward would actually bring in. */
  localDefaultBehind: number
  /** origin/<default>..<default> — non-zero means the local default diverged. */
  localDefaultAhead: number
  /** Current branch vs its own upstream (kept from the previous behaviour). */
  ahead: number
  behind: number
  localChanges: number
  /** True when the local default branch can be advanced by a pure fast-forward. */
  canFastForward: boolean
  /**
   * Counts come from the remote-tracking refs as of the last fetch while a
   * fresh fetch is still running — shown right away, but not acted upon.
   */
  refreshing?: boolean
}

export type RepoUpdateOutcome =
  | 'updated'
  | 'alreadyUpToDate'
  | 'skippedDirty'
  | 'skippedDiverged'
  | 'skippedNoDefault'
  | 'failed'

export interface RepoUpdateResult {
  outcome: RepoUpdateOutcome
  message: string
  commitsPulled: number
}

export interface CommitSummary {
  hash: string
  shortHash: string
  authorName: string
  authorEmail: string
  date: string
  summary: string
  body: string
}

/**
 * Where a file sits relative to the upstream, so the AI chat can be handed the
 * facts instead of guessing them (e.g. "the rejected big file is only local").
 */
export interface FileHistoryLocation {
  path: string
  upstream: string | null
  /**
   * Unpublished commits that add or change the file (deletions excluded),
   * including ones on merged branches, newest first.
   */
  localCommits: { hash: string; shortHash: string; summary: string }[]
  /** How many `reset --soft HEAD~1` it takes to get past the oldest of them. */
  undoCount: number
  /** Some commit already on the upstream touches the path (maybe an older version). */
  onRemote: boolean
  existsOnDisk: boolean
  inIndex: boolean
}

export interface CommitFile {
  path: string
  status: string
}

export interface CommitDetails extends CommitSummary {
  parents: string[]
}

/** A user-created folder on the initial screen. Purely an organisation device. */
export interface RepoGroup {
  id: string
  name: string
  collapsed: boolean
}

export interface RecentRepository {
  name: string
  path: string
  /** null = loose, in the "Sem pasta" section. */
  groupId: string | null
  /** Recomputed on every list(); never persisted. */
  missing: boolean
}

export interface RecentReposData {
  groups: RepoGroup[]
  repos: RecentRepository[]
}

/** A checkout git refused because it would overwrite local changes. */
export type SwitchBranchResult = { switched: true } | { switched: false; blockingFiles: string[] }

/**
 * Files listed under git's "would be overwritten by checkout:" headers (tracked
 * changes and untracked files alike), or null when the failure is something
 * else. Expects git's untranslated output — the caller runs it with LC_ALL=C.
 */
export function parseCheckoutBlockers(stderr: string): string[] | null {
  const files: string[] = []
  let inList = false
  let matched = false
  for (const line of stderr.split(/\r?\n/)) {
    if (/would be overwritten by checkout:\s*$/.test(line)) {
      inList = true
      matched = true
    } else if (inList && /^\t/.test(line)) {
      files.push(line.trim())
    } else {
      inList = false
    }
  }
  return matched ? files : null
}

/**
 * Branch a stash was made on, from git's own subject: "On <branch>: <message>"
 * or "WIP on <branch>: <hash> <subject>". Null for anything else.
 */
export function stashBranchName(subject: string): string | null {
  const match = /^(?:WIP on|On) ([^:]+):/.exec(subject)
  return match ? match[1] : null
}

export interface StashEntry {
  ref: string
  message: string
}

// Two-char codes git status uses for unmerged paths (not the usual
// independent X/Y semantics — these are special-cased by git itself).
const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

export function isConflicted(entry: StatusEntry): boolean {
  return CONFLICT_CODES.has(entry.index + entry.worktree)
}

/**
 * Field-by-field equality for two status snapshots. The background poll fetches
 * a fresh object every few seconds; storing it only when something changed keeps
 * every `status` subscriber from re-rendering on an idle repository.
 */
export function sameRepoStatus(a: RepoStatus | null, b: RepoStatus | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (
    a.branch !== b.branch ||
    a.ahead !== b.ahead ||
    a.behind !== b.behind ||
    a.upstream !== b.upstream ||
    Boolean(a.mergeInProgress) !== Boolean(b.mergeInProgress) ||
    a.entries.length !== b.entries.length
  ) {
    return false
  }
  return a.entries.every((entry, i) => {
    const other = b.entries[i]
    return (
      entry.path === other.path &&
      entry.index === other.index &&
      entry.worktree === other.worktree &&
      entry.renamedFrom === other.renamedFrom
    )
  })
}

// Thrown by main's push when the remote is "ahead" only because the user
// rewrote already-pushed commits locally (undo last commit / amend). The
// renderer recognises it by its text (in any app language, since the main
// process may have thrown it before a language switch) and offers a force push.
export function isHistoryRewrittenMessage(message: string): boolean {
  return allTranslations((m) => m.main.git.historyRewritten).some((text) => message.includes(text))
}
