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

/**
 * - merged: every commit of the branch is reachable from the base.
 * - equivalent: it has commits of its own, but their changes already landed on
 *   the base under other hashes (squash or rebase merge) — git alone still
 *   reports these as "not merged".
 * - unmerged: it carries work the base does not have.
 */
export type BranchIntegrationState = 'merged' | 'equivalent' | 'unmerged'

export interface BranchIntegration {
  /** Short name: "feature/x" for a local branch, "origin/feature/x" for a remote one. */
  name: string
  /** A remote-tracking branch with no local branch of the same name. */
  remoteOnly: boolean
  isCurrent: boolean
  /** Upstream of a local branch ("origin/feature/x"), or null when it was never published. */
  upstream: string | null
  /** The upstream is configured but no longer exists on the remote (deleted after a merge, usually). */
  upstreamGone: boolean
  /** Commits on the branch that are not reachable from the base. */
  ahead: number
  /** Commits on the base that the branch does not have. */
  behind: number
  /** Short hash of the branch tip — enough to recreate it after a delete. */
  tip: string
  lastCommitDate: string
  lastCommitSummary: string
  state: BranchIntegrationState
  /** For 'equivalent': the base commit that carries the same changes. */
  equivalentCommit?: string
}

export interface BranchIntegrationReport {
  /** The ref everything was compared against, e.g. "origin/main" or "main". */
  base: string
  /** Branch names that can never be deleted through the agent (lowercase). */
  protectedNames: string[]
  branches: BranchIntegration[]
}

/** What deleting one local branch would lose, checked against the base before asking. */
export interface BranchDeleteCheck {
  /** The ref the branch was compared against, e.g. "origin/main". */
  base: string
  branch: BranchIntegration
  /** For 'unmerged': the commits missing from the base, newest first (capped). */
  missingCommits: { hash: string; date: string; summary: string }[]
  /**
   * Commits on neither the base nor the branch's upstream: what a delete
   * would actually lose. Null when there is no upstream (never published, or
   * deleted on the remote) — then every missing commit lives only here.
   */
  localOnly: number | null
}

export interface BranchDeletionResult {
  name: string
  deleted: boolean
  /** Tip before the delete, for `git branch <name> <tip>` if it was a mistake. */
  tip?: string
  /** Why it was refused or failed. */
  reason?: string
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

/**
 * The branch on origin a push from here lands on, or null when the push goes
 * somewhere else. `git push` follows the upstream, which need not share the
 * local name (main tracking origin/master) or even live on origin (a fork's
 * remote); with none yet, the app publishes the branch to origin as is.
 */
export function pushTargetBranch(status: Pick<RepoStatus, 'branch' | 'upstream'>): string | null {
  if (!status.branch) return null
  if (!status.upstream) return status.branch
  return status.upstream.startsWith('origin/') ? status.upstream.slice('origin/'.length) : null
}
