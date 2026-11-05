import type { RecentReposData } from './git'

/** Moving a repository to <root>/<account>/<folder>. Confirmation must preserve both previewed paths. */
export interface RepoMove {
  from: string
  to: string
}

export type RepoSkipReason = 'noRemote' | 'unknownOwner' | 'targetExists' | 'ownerFolderIsRepo' | 'hasWorktrees'

export interface ReorganizePlan {
  root: string
  /** Scanning inside a repository would move its nested folders around. */
  rootIsRepository: boolean
  /** In the order they have to run. */
  moves: RepoMove[]
  alreadyOrganized: number
  skipped: { path: string; reason: RepoSkipReason; target?: string }[]
}

/** `stranded`: couldn't finish or undo the move; `detail` says where the repository is now. */
export type RepoMoveFailure = 'inUse' | 'targetExists' | 'ownerFolderIsRepo' | 'planChanged' | 'stranded' | 'other'

export interface ReorganizeResult {
  moved: RepoMove[]
  failed: { from: string; to: string; reason: RepoMoveFailure; detail?: string }[]
  recent: RecentReposData
  /** The folders moved, but the list of recents couldn't be updated. */
  recentError?: string
}
