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
  Undo2,
  UserCog,
  UserSearch,
  type LucideIcon
} from 'lucide-react'

export interface ToolDisplayInfo {
  label: string
  icon: LucideIcon
}

const TOOL_DISPLAY: Record<string, ToolDisplayInfo> = {
  create_branch: { label: 'Criar branch', icon: GitBranchPlus },
  create_pull_request: { label: 'Criar pull request', icon: GitPullRequestArrow },
  list_pull_requests: { label: 'Listar pull requests', icon: ListChecks },
  read_pull_request: { label: 'Ler pull request', icon: GitPullRequest },
  read_commit: { label: 'Ler commit', icon: FileSearch },
  list_commits: { label: 'Listar commits', icon: History },
  merge_pull_request: { label: 'Mergear pull request', icon: GitPullRequestClosed },
  merge_branch: { label: 'Mergear branch', icon: GitMerge },
  commit: { label: 'Criar commit', icon: GitCommitHorizontal },
  undo_last_commit: { label: 'Desfazer último commit', icon: Undo2 },
  ignore_files: { label: 'Ignorar arquivos', icon: EyeOff },
  resolve_conflict: { label: 'Resolver conflito', icon: FileDiff },
  check_incoming_commits: { label: 'Verificar commits novos', icon: RadarIcon },
  get_git_identity: { label: 'Ler identidade Git', icon: UserSearch },
  set_git_identity: { label: 'Configurar identidade Git', icon: UserCog },
  list_all_repos: { label: 'Listar repositórios', icon: FolderGit2 },
  list_branches: { label: 'Listar branches', icon: GitBranch },
  list_branches_all_repos: { label: 'Listar branches (todos os repos)', icon: GitBranch },
  check_all_repos: { label: 'Verificar todos os repositórios', icon: RadarIcon },
  fetch_all: { label: 'Fetch em todos os repositórios', icon: RefreshCw },
  pull_repo: { label: 'Pull no repositório', icon: ArrowDownToLine },
  pull_all: { label: 'Pull em todos os repositórios', icon: ArrowDownToLine },
  push: { label: 'Enviar alterações (push)', icon: ArrowUpFromLine },
  pull: { label: 'Buscar alterações (pull)', icon: ArrowDownToLine },
  switch_branch: { label: 'Trocar de branch', icon: GitFork },
  stash: { label: 'Guardar alterações (stash)', icon: PackageOpen },
  stash_pop: { label: 'Restaurar stash', icon: CircleFadingArrowUp }
}

export function getToolDisplay(name: string): ToolDisplayInfo {
  return TOOL_DISPLAY[name] ?? { label: name, icon: Check }
}
