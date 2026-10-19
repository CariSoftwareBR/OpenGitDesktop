import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CircleFadingArrowUp,
  EyeOff,
  FileDiff,
  FileSearch,
  FolderGit2,
  GitBranch,
  GitBranchPlus,
  GitCommitHorizontal,
  GitCompareArrows,
  GitFork,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  History,
  ListChecks,
  PackageOpen,
  RadarIcon,
  RefreshCw,
  Trash2,
  Undo2,
  UserCog,
  UserSearch,
  type LucideIcon
} from 'lucide-react'

export interface ToolDisplayInfo {
  label: string
  icon: LucideIcon
}

const TOOL_ICONS: Record<string, LucideIcon> = {
  create_branch: GitBranchPlus,
  create_pull_request: GitPullRequestArrow,
  list_pull_requests: ListChecks,
  read_pull_request: GitPullRequest,
  read_commit: FileSearch,
  list_commits: History,
  merge_pull_request: GitPullRequestClosed,
  merge_branch: GitMerge,
  commit: GitCommitHorizontal,
  undo_last_commit: Undo2,
  ignore_files: EyeOff,
  resolve_conflict: FileDiff,
  check_incoming_commits: RadarIcon,
  get_git_identity: UserSearch,
  set_git_identity: UserCog,
  list_all_repos: FolderGit2,
  list_branches: GitBranch,
  list_branches_all_repos: GitBranch,
  list_unmerged_branches: GitCompareArrows,
  delete_merged_branches: Trash2,
  check_all_repos: RadarIcon,
  fetch_all: RefreshCw,
  pull_repo: ArrowDownToLine,
  pull_all: ArrowDownToLine,
  push: ArrowUpFromLine,
  pull: ArrowDownToLine,
  switch_branch: GitFork,
  stash: PackageOpen,
  stash_pop: CircleFadingArrowUp
}

/** Labels come from the current locale, so callers re-render on a language switch. */
export function getToolDisplay(name: string, labels: Record<string, string>): ToolDisplayInfo {
  return { label: labels[name] ?? name, icon: TOOL_ICONS[name] ?? Check }
}
