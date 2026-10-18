import { useRepoStore } from '../../store/repoStore'
import { validateBranchName } from '../branchName'
import { usePullRequestStore } from '../../store/pullRequestStore'
import { getActiveAiConfig } from '../../store/aiStore'
import { generateCommitMessage } from './commitMessage'
import { generateConflictResolution } from './conflictResolution'
import { isConflicted, type StatusEntry } from '../../../../shared/git'
import { parseConflictBlocks, renderResolvedWithChoices, type ConflictBlock, type ConflictResolutionChoice } from '../conflicts'
import type { ToolCallRequest } from '../../../../shared/aiChat'

/** Visual gate tier for the approval card — drives border/button severity. */
export type ToolSeverity = 'read' | 'write' | 'danger'

export interface ToolPreview {
  headline: string
  fields: { label: string; value: string }[]
  warning?: string
  severity?: ToolSeverity
}

export interface ToolPrepareResult {
  preview: ToolPreview
  resolvedArgs: Record<string, string>
}

// Public, remote-visible, or not automatically undoable.
const DANGER_TOOLS = new Set(['merge_pull_request', 'merge_branch', 'push', 'review_pull_request'])
const WRITE_TOOLS = new Set([
  'commit',
  'undo_last_commit',
  'ignore_files',
  'merge_abort',
  'resolve_conflict',
  'create_branch',
  'switch_branch',
  'stash',
  'stash_pop',
  'pull',
  'pull_all',
  'pull_repo',
  'create_pull_request',
  'comment_pull_request',
  'set_pull_request_state',
  'fetch_all',
  'set_git_identity'
])

export function toolSeverity(name: string): ToolSeverity {
  if (DANGER_TOOLS.has(name)) return 'danger'
  if (WRITE_TOOLS.has(name)) return 'write'
  return 'read'
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '…'
}

function formatFileList(paths: string[], max = 20): string {
  const shown = paths.slice(0, max).map((p) => `• ${p}`)
  if (paths.length > max) shown.push(`… e mais ${paths.length - max} arquivo(s)`)
  return shown.join('\n')
}

// getCommitFiles keeps a rename as "old\tnew" in a single path field — the
// destination is what `git show -- <path>` matches against.
function effectivePath(path: string): string {
  const parts = path.split('\t')
  return parts[parts.length - 1]
}

// Shown in the approval card so the user sees exactly what git will run. Always
// multi-line, which makes the card render it as a Markdown code block.
function formatCommands(commands: string[]): string {
  return ['```sh', ...commands, '```'].join('\n')
}

function quoteArg(arg: string): string {
  return /[\s"'$`]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
}

// Tool args are flat strings, so a list of paths arrives comma/newline separated.
function parsePathList(raw: string): string[] {
  const paths = raw
    .split(/[\n,]/)
    .map((p) => p.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
    .filter(Boolean)
  return [...new Set(paths)]
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase()
}

// Turns whatever the model called the file into a path that actually exists in
// the commit, so `git show -- <path>` can't come back silently empty.
async function resolveCommitPath(repoPath: string, hash: string, requested: string): Promise<string> {
  const files = await window.api.git.commitFiles(hash, repoPath)
  const paths = files.map((f) => effectivePath(f.path))
  const wanted = normalizePath(requested)

  const exact = paths.find((p) => normalizePath(p) === wanted)
  if (exact) return exact

  // Suffix match on a path boundary: "Tags/Util_NFe_IDE.cs" and
  // "Util_NFe_IDE.cs" both resolve, but "IDE.cs" doesn't match half a name.
  const suffix = paths.filter((p) => normalizePath(p).endsWith(`/${wanted}`))
  if (suffix.length === 1) return suffix[0]
  if (suffix.length > 1) {
    throw new Error(`"${requested}" corresponde a mais de um arquivo do commit. Informe o caminho completo:\n${formatFileList(suffix)}`)
  }

  throw new Error(`"${requested}" não foi alterado neste commit. Arquivos alterados (${paths.length}):\n${formatFileList(paths, 60)}`)
}

// Which files of the commit are NOT fully present in the slice we sent. The
// last header in the slice counts as missing too: its hunks were cut mid-file.
async function listFilesBeyondTruncation(repoPath: string, hash: string, sentPatch: string): Promise<string[]> {
  const files = await window.api.git.commitFiles(hash, repoPath)
  const complete = new Set<string>()
  const headerRegex = /^diff --git a\/(.+?) b\//gm
  const headers: string[] = []
  let match: RegExpExecArray | null
  while ((match = headerRegex.exec(sentPatch)) !== null) headers.push(match[1])
  for (const h of headers.slice(0, -1)) complete.add(h)

  return files.map((f) => effectivePath(f.path)).filter((p) => !complete.has(p))
}

async function requireCurrentRepo(): Promise<string> {
  const repoPath = useRepoStore.getState().currentRepoPath
  if (!repoPath) throw new Error('Nenhum repositório aberto.')
  return repoPath
}

// Returns the addressing the GitHub IPC calls need. There is no token here on
// purpose: main resolves it from the host on every call.
function requireGitHubRemote(): { host: string; owner: string; repo: string } {
  const pr = usePullRequestStore.getState()
  if (!pr.remote || !pr.user) {
    throw new Error('Nenhum remote do GitHub autenticado. Abra a aba Pull Requests e faça login primeiro.')
  }
  return { host: pr.remote.host, owner: pr.remote.owner, repo: pr.remote.repo }
}

// ---------------------------------------------------------------------------
// Prepare (async, read-only) — mirrors AiToolService's Prepare*Async methods:
// live git/GitHub reads to enrich the approval card are fine here; anything
// that mutates the repo or a remote must wait for executeToolCall.
// ---------------------------------------------------------------------------

export async function prepareToolCall(call: ToolCallRequest): Promise<ToolPrepareResult> {
  const result = await prepareToolCallInner(call)
  return {
    preview: { ...result.preview, severity: result.preview.severity ?? toolSeverity(call.name) },
    resolvedArgs: result.resolvedArgs
  }
}

async function prepareToolCallInner(call: ToolCallRequest): Promise<ToolPrepareResult> {
  const a = call.arguments

  switch (call.name) {
    case 'create_branch': {
      const branchName = a.branch_name
      if (!branchName) throw new Error("O parâmetro 'branch_name' é obrigatório.")
      // Same rules the "Nova branch" dialog applies, so a bad name the model
      // proposes is refused here — not after the user already approved it.
      const invalid = validateBranchName(branchName, useRepoStore.getState().branches.map((b) => b.name))
      if (invalid) throw new Error(`Nome de branch inválido "${branchName}": ${invalid}`)
      const checkout = a.checkout !== 'false'
      return {
        preview: {
          headline: `Criar branch "${branchName}"`,
          fields: [
            { label: 'A partir de', value: a.from_branch || '(HEAD atual)' },
            { label: 'Trocar para ela', value: checkout ? 'Sim' : 'Não' }
          ]
        },
        resolvedArgs: a
      }
    }

    case 'create_pull_request': {
      const { title, body, base_branch: baseBranch } = a
      if (!title) throw new Error("O parâmetro 'title' é obrigatório.")
      if (!baseBranch) throw new Error("O parâmetro 'base_branch' é obrigatório.")
      // Read live from disk rather than the cached repo store — the cache can
      // be stale right after a branch switch, which previously let a PR go
      // out with an empty/wrong head branch.
      const repoPath = await requireCurrentRepo()
      const liveStatus = await window.api.git.status(repoPath)
      const head = liveStatus.branch
      if (!head) throw new Error('Branch atual indisponível.')
      if (head.toLowerCase() === baseBranch.toLowerCase()) {
        throw new Error('A branch atual é a mesma da branch base. Troque para a branch de feature antes.')
      }
      // GitHub can't open a PR from a branch it doesn't have — catch this
      // locally with a clear message instead of surfacing GitHub's opaque
      // "Validation Failed" once the request is already in flight.
      if (liveStatus.entries.length > 0) {
        throw new Error('Há mudanças não commitadas nesta branch. Faça o commit antes de criar o PR.')
      }
      if (!liveStatus.upstream || liveStatus.ahead > 0) {
        throw new Error('Esta branch ainda não está publicada (ou tem commits locais não enviados). Faça o push antes de criar o PR.')
      }
      const { owner, repo: repoName } = requireGitHubRemote()

      return {
        preview: {
          headline: `Criar PR: ${title}`,
          fields: [
            { label: 'De', value: head },
            { label: 'Para', value: baseBranch },
            { label: 'Remote', value: `${owner}/${repoName}` },
            { label: 'Rascunho', value: a.draft === 'true' ? 'Sim' : 'Não' },
            { label: 'Descrição', value: body || '(vazio)' }
          ]
        },
        resolvedArgs: { ...a, head_branch: head }
      }
    }

    case 'list_pull_requests': {
      const state = (a.state as 'open' | 'closed' | 'all' | undefined) ?? 'open'
      const { owner, repo } = requireGitHubRemote()
      return {
        preview: {
          headline: 'Listar Pull Requests',
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'Estado', value: state },
            { label: 'Head branch', value: a.head_branch || '(todas)' }
          ]
        },
        resolvedArgs: a
      }
    }

    case 'read_pull_request': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error("O parâmetro 'pull_request_number' é obrigatório.")
      const { owner, repo } = requireGitHubRemote()
      return {
        preview: {
          headline: `Ler PR #${number}`,
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'Incluir arquivos', value: a.include_files === 'false' ? 'Não' : 'Sim' },
            { label: 'Incluir diffs', value: a.include_diffs === 'true' ? 'Sim' : 'Não' },
            { label: 'Incluir comentários', value: a.include_comments === 'false' ? 'Não' : 'Sim' }
          ]
        },
        resolvedArgs: a
      }
    }

    case 'read_commit': {
      const ref = a.ref || 'HEAD'
      const repoPath = await requireCurrentRepo()
      const details = await window.api.git.commitDetails(repoPath, ref)
      if (!details) throw new Error(`Commit "${ref}" não encontrado neste repositório.`)

      // Resolve the file filter here so the approval card shows the real path
      // and execute never has to guess: models name the file the user typed
      // ("Util_NFe_IDE.cs"), not its full path inside the repo.
      const path = a.path ? await resolveCommitPath(repoPath, details.hash, a.path) : undefined

      return {
        preview: {
          headline: `Ler commit ${details.shortHash}`,
          fields: [
            { label: 'Commit', value: `${details.shortHash} — ${details.summary}` },
            { label: 'Autor', value: `${details.authorName} <${details.authorEmail}>` },
            { label: 'Data', value: details.date },
            ...(path ? [{ label: 'Arquivo', value: path }] : []),
            { label: 'Incluir arquivos', value: a.include_files === 'false' ? 'Não' : 'Sim' },
            { label: 'Incluir diff', value: a.include_diff === 'true' ? 'Sim' : 'Não' }
          ]
        },
        // Fix the resolved hash so execute doesn't re-interpret "HEAD" after
        // further tool calls or user actions may have moved it.
        resolvedArgs: path ? { ...a, ref: details.hash, path } : { ...a, ref: details.hash }
      }
    }

    case 'list_commits':
      return {
        preview: { headline: `Listar últimos ${a.limit || 20} commits`, fields: [] },
        resolvedArgs: a
      }

    case 'merge_pull_request': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error("O parâmetro 'pull_request_number' é obrigatório.")
      const mergeMethod = (a.merge_method as 'merge' | 'squash' | 'rebase' | undefined) ?? 'merge'
      const { host, owner, repo } = requireGitHubRemote()
      const pr = await window.api.github.getPullRequest(host, owner, repo, number)
      const status = pr.draft ? 'draft' : pr.state

      // Refuse what GitHub would refuse, instead of letting the user approve a
      // merge that comes back as an API error.
      if (pr.merged) throw new Error(`O PR #${number} já foi mergeado.`)
      if (pr.state === 'closed') throw new Error(`O PR #${number} está fechado e não pode ser mergeado.`)

      const mergeability =
        pr.mergeable === true
          ? `Sim${pr.mergeableState ? ` (${pr.mergeableState})` : ''}`
          : pr.mergeable === false
            ? `Não${pr.mergeableState ? ` (${pr.mergeableState})` : ''}`
            : 'O GitHub ainda não calculou'

      let warning = 'Esta ação altera o repositório remoto e não pode ser desfeita automaticamente.'
      if (pr.draft) {
        warning = `O PR #${number} é um rascunho (draft) — o GitHub recusa merges de draft. ${warning}`
      } else if (pr.mergeable === false) {
        warning =
          pr.mergeableState === 'dirty'
            ? `O GitHub reporta conflitos entre "${pr.headRef}" e "${pr.baseRef}" — este merge vai falhar até os conflitos serem resolvidos. ${warning}`
            : `O GitHub reporta que este PR não é mergeável agora (${pr.mergeableState ?? 'motivo desconhecido'}). ${warning}`
      } else if (pr.mergeable === null) {
        warning = `O GitHub ainda não terminou de calcular se o PR é mergeável — o merge pode ser recusado. ${warning}`
      }

      return {
        preview: {
          headline: `Fazer merge do PR #${number}`,
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'PR', value: `#${pr.number} [${status}] ${pr.title}` },
            { label: 'Origem/Destino', value: `${pr.headRef} -> ${pr.baseRef}` },
            { label: 'Mergeável', value: mergeability },
            { label: 'Método', value: mergeMethod },
            { label: 'Commit title', value: a.commit_title || '(padrão do GitHub)' }
          ],
          warning
        },
        resolvedArgs: a
      }
    }

    case 'review_pull_request': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error("O parâmetro 'pull_request_number' é obrigatório.")
      const event = a.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' | undefined
      if (!event || !['APPROVE', 'REQUEST_CHANGES', 'COMMENT'].includes(event)) {
        throw new Error("O parâmetro 'event' deve ser APPROVE, REQUEST_CHANGES ou COMMENT.")
      }
      const body = a.body?.trim() ?? ''
      if (event !== 'APPROVE' && !body) {
        throw new Error(`Uma review do tipo ${event} exige um texto em 'body'.`)
      }

      const { host, owner, repo } = requireGitHubRemote()
      const pr = await window.api.github.getPullRequest(host, owner, repo, number)
      if (pr.state === 'closed') throw new Error(`O PR #${number} está fechado e não aceita reviews.`)

      // GitHub rejects self-approval with a 422; say so here rather than after
      // the user approves the action.
      const me = usePullRequestStore.getState().user?.login
      if (event === 'APPROVE' && me && me.toLowerCase() === pr.authorLogin.toLowerCase()) {
        throw new Error(
          `O GitHub não permite aprovar o próprio pull request (#${number} é seu). Use COMMENT ou REQUEST_CHANGES.`
        )
      }

      const eventLabel =
        event === 'APPROVE' ? 'Aprovar' : event === 'REQUEST_CHANGES' ? 'Pedir mudanças' : 'Comentar'
      return {
        preview: {
          headline: `${eventLabel} — PR #${number}`,
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'PR', value: `#${pr.number} ${pr.title}` },
            { label: 'Autor', value: pr.authorLogin },
            { label: 'Tipo de review', value: event },
            { label: 'Texto', value: body || '(sem texto)' }
          ],
          warning:
            event === 'APPROVE'
              ? 'A aprovação fica pública no PR, em nome da sua conta do GitHub, e não pode ser desfeita automaticamente.'
              : 'A review fica pública no PR, em nome da sua conta do GitHub.'
        },
        resolvedArgs: { ...a, body, commit_id: pr.headSha }
      }
    }

    case 'comment_pull_request': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error("O parâmetro 'pull_request_number' é obrigatório.")
      const body = a.body?.trim()
      if (!body) throw new Error("O parâmetro 'body' é obrigatório.")

      const { host, owner, repo } = requireGitHubRemote()
      const pr = await window.api.github.getPullRequest(host, owner, repo, number)
      return {
        preview: {
          headline: `Comentar no PR #${number}`,
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'PR', value: `#${pr.number} ${pr.title}` },
            { label: 'Comentário', value: body }
          ],
          warning: 'O comentário fica público no PR, em nome da sua conta do GitHub.'
        },
        resolvedArgs: { ...a, body }
      }
    }

    case 'set_pull_request_state': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error("O parâmetro 'pull_request_number' é obrigatório.")
      const state = a.state as 'open' | 'closed' | undefined
      if (state !== 'open' && state !== 'closed') {
        throw new Error("O parâmetro 'state' deve ser 'open' ou 'closed'.")
      }

      const { host, owner, repo } = requireGitHubRemote()
      const pr = await window.api.github.getPullRequest(host, owner, repo, number)
      if (pr.merged) throw new Error(`O PR #${number} já foi mergeado e não pode mudar de estado.`)
      if (pr.state === state) throw new Error(`O PR #${number} já está ${state === 'open' ? 'aberto' : 'fechado'}.`)

      return {
        preview: {
          headline: state === 'closed' ? `Fechar o PR #${number} sem mergear` : `Reabrir o PR #${number}`,
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'PR', value: `#${pr.number} ${pr.title}` },
            { label: 'Origem/Destino', value: `${pr.headRef} -> ${pr.baseRef}` }
          ],
          warning:
            state === 'closed'
              ? 'Os commits da branch não são mesclados nem apagados — só o PR é fechado.'
              : undefined
        },
        resolvedArgs: a
      }
    }

    case 'merge_branch': {
      const source = a.source_branch
      if (!source) throw new Error("O parâmetro 'source_branch' é obrigatório.")
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      const current = status.branch ?? '?'

      // Conditions git would reject anyway — better to say so before the user
      // approves than to have the tool come back with a raw git error.
      if (status.entries.some(isConflicted)) {
        throw new Error('Já existe um merge em andamento com conflitos. Resolva-o ou use merge_abort antes.')
      }
      if (source === current) throw new Error(`"${source}" já é a branch atual — não há o que mesclar.`)

      const branches = await window.api.git.branches(repoPath)
      if (!branches.some((b) => b.name === source)) {
        throw new Error(`A branch "${source}" não existe localmente. Branches: ${branches.map((b) => b.name).join(', ')}.`)
      }

      const localChanges = status.entries.length
      return {
        preview: {
          headline: `Merge de "${source}" em "${current}"`,
          fields: [
            { label: 'Branch destino', value: current },
            { label: 'Branch fonte', value: source },
            { label: 'Alterações locais', value: localChanges === 0 ? 'Nenhuma' : `${localChanges} arquivo(s)` }
          ],
          warning:
            localChanges > 0
              ? `Você tem ${localChanges} arquivo(s) modificado(s). O git recusa o merge se ele precisar sobrescrever algum deles — considere stash antes. Conflitos também podem exigir resolução manual.`
              : 'Conflitos de merge podem aparecer e exigir resolução manual.'
        },
        resolvedArgs: a
      }
    }

    case 'merge_abort': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      const conflicted = status.entries.filter(isConflicted).map((e) => e.path)
      if (conflicted.length === 0) {
        throw new Error('Não há merge em andamento com conflitos para abortar.')
      }
      return {
        preview: {
          headline: 'Abortar o merge em andamento',
          fields: [
            { label: 'Branch', value: status.branch ?? '?' },
            { label: `Arquivos em conflito (${conflicted.length})`, value: formatFileList(conflicted) }
          ],
          warning: 'Descarta a mesclagem inteira e volta o repositório ao estado anterior ao merge.'
        },
        resolvedArgs: a
      }
    }

    case 'commit': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      if (status.entries.some(isConflicted)) {
        throw new Error('Há conflitos de merge não resolvidos. Resolva antes de commitar.')
      }

      const staged: StatusEntry[] = []
      const unstaged: StatusEntry[] = []
      for (const entry of status.entries) {
        if (entry.index !== ' ' && entry.index !== '?') staged.push(entry)
        else unstaged.push(entry)
      }

      const autoStage = staged.length === 0
      const filesToShow = autoStage ? unstaged : staged
      if (filesToShow.length === 0) throw new Error('Nenhuma mudança para commitar.')

      const { settings, apiKey } = await getActiveAiConfig()

      const diff = autoStage ? await window.api.git.diffUnstagedAll(repoPath) : await window.api.git.diffStagedAll(repoPath)
      const statusText = filesToShow.map((e) => `${e.index}${e.worktree} ${e.path}`).join('\n')
      const suggestion = await generateCommitMessage(settings, apiKey, status.branch ?? '?', statusText, diff)
      if (!suggestion.summary) throw new Error('A IA não retornou uma mensagem de commit válida.')

      const filesLabel = autoStage ? `Arquivos que serão staged e commitados (${filesToShow.length})` : `Arquivos staged (${filesToShow.length})`

      return {
        preview: {
          headline: autoStage ? 'Stage + commit das mudanças' : 'Commit das mudanças staged',
          fields: [
            { label: 'Branch', value: status.branch ?? '?' },
            { label: filesLabel, value: formatFileList(filesToShow.map((f) => f.path)) },
            { label: 'Mensagem (summary)', value: suggestion.summary },
            { label: 'Descrição', value: suggestion.description || '(vazia)' }
          ],
          warning: autoStage
            ? 'Todas as mudanças não-staged serão adicionadas ao stage automaticamente antes do commit.'
            : undefined
        },
        resolvedArgs: { summary: suggestion.summary, description: suggestion.description, auto_stage: autoStage ? 'true' : 'false' }
      }
    }

    case 'undo_last_commit': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      if (status.mergeInProgress || status.entries.some(isConflicted)) {
        throw new Error('Há um merge em andamento. Conclua ou aborte o merge antes de desfazer um commit.')
      }
      const [last] = await window.api.git.log(repoPath, 1)
      if (!last) throw new Error('Este repositório ainda não tem commits.')
      // Already on a remote (tracked or not): undoing it would need a force push,
      // and there is deliberately no force-push tool — refuse instead of
      // stranding the user. Execute re-checks this in the main process.
      if (await window.api.git.isCommitPublished(repoPath, last.hash)) {
        throw new Error(
          `O último commit já foi enviado para ${status.upstream ?? 'o remoto'}. Desfazê-lo exigiria force push, que é um passo manual — não faço isso pelo chat.`
        )
      }
      const files = await window.api.git.commitFiles(last.hash, repoPath)

      return {
        preview: {
          headline: `Desfazer o commit ${last.shortHash}`,
          fields: [
            { label: 'Branch', value: status.branch ?? '?' },
            { label: 'Commit', value: `${last.shortHash} — ${last.summary}` },
            { label: `Arquivos do commit (${files.length})`, value: formatFileList(files.map((f) => effectivePath(f.path))) },
            { label: 'Comando', value: formatCommands(['git reset --soft HEAD~1']) }
          ],
          warning: 'O commit sai do histórico local. As mudanças dele voltam para o stage — nenhum arquivo é apagado.'
        },
        resolvedArgs: { hash: last.hash }
      }
    }

    case 'ignore_files': {
      const repoPath = await requireCurrentRepo()
      const requested = parsePathList(a.paths ?? '')
      if (requested.length === 0) throw new Error("O parâmetro 'paths' é obrigatório.")

      const status = await window.api.git.status(repoPath)
      const untracked = new Set(status.entries.filter((e) => e.index === '?').map((e) => e.path))

      // ls-files expands folders to their files, which is what `git rm --cached`
      // needs (it refuses a directory without -r).
      const toUntrack: string[] = []
      for (const path of requested) {
        const matches = await window.api.git.listFiles(repoPath, path)
        // No match and not ignored = the file is gone (deleted, or its commit was
        // just undone): the .gitignore entry alone still keeps it from coming back.
        if (matches.length === 0 && (await window.api.git.isPathIgnored(repoPath, path))) {
          throw new Error(`"${path}" já está no .gitignore.`)
        }
        toUntrack.push(...matches.filter((m) => !untracked.has(m)))
      }
      const distinctUntrack = [...new Set(toUntrack)]

      return {
        preview: {
          headline: 'Ignorar arquivos no Git',
          fields: [
            { label: 'Adicionar ao .gitignore', value: formatFileList(requested) },
            {
              label: `Tirar do Git (${distinctUntrack.length})`,
              value: distinctUntrack.length > 0 ? formatFileList(distinctUntrack) : 'Nenhum — não estão rastreados nem no stage'
            },
            {
              label: 'Comandos',
              value: formatCommands([
                ...requested.map((p) => `echo ${p} >> .gitignore`),
                ...(distinctUntrack.length > 0 ? [`git rm --cached -f -- ${distinctUntrack.map(quoteArg).join(' ')}`] : []),
                'git add .gitignore'
              ])
            }
          ],
          warning: 'Os arquivos continuam no disco; só deixam de ser versionados.'
        },
        resolvedArgs: { patterns: requested.join('\n'), untrack: distinctUntrack.join('\n') }
      }
    }

    case 'resolve_conflict': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      const conflicted = status.entries.filter(isConflicted)
      if (conflicted.length === 0) throw new Error('Não há arquivos em conflito neste repositório.')

      let path = a.path
      if (!path) {
        if (conflicted.length > 1) {
          throw new Error(`Há ${conflicted.length} arquivos em conflito. Especifique qual resolver: ${conflicted.map((e) => e.path).join(', ')}`)
        }
        path = conflicted[0].path
      } else if (!conflicted.some((e) => e.path === path)) {
        throw new Error(`"${path}" não está em conflito no momento.`)
      }

      const content = await window.api.fs.readRepoFile(repoPath, path)
      // Binary guard: readRepoFile always decodes as utf-8, so a real binary
      // file yields garbled text rather than throwing — NUL bytes are the
      // same heuristic git itself uses to call a file "binary".
      if (content.includes('\u0000')) {
        throw new Error(`"${path}" parece ser um arquivo binário. Resolva manualmente pela interface.`)
      }

      const blocks = parseConflictBlocks(content)
      const conflictBlocks = blocks.filter((b): b is ConflictBlock => b.type === 'conflict')
      if (conflictBlocks.length === 0) {
        throw new Error(
          `"${path}" está marcado como conflito pelo Git, mas não contém marcadores de conflito de texto (provavelmente um conflito de rename/delete). Resolva manualmente pela interface.`
        )
      }

      const { settings, apiKey } = await getActiveAiConfig()
      const suggestion = await generateConflictResolution(settings, apiKey, path, blocks)

      const choices = new Map<number, ConflictResolutionChoice>(
        suggestion.decisions
          .filter((d) => conflictBlocks.some((b) => b.id === d.id))
          .map((d) => [d.id, d.choice === 'custom' ? { text: d.text! } : d.choice])
      )
      const resolvedContent = renderResolvedWithChoices(blocks, choices)

      const decisionLines = conflictBlocks.map((b) => {
        const d = suggestion.decisions.find((x) => x.id === b.id)
        const label =
          d?.choice === 'ours' ? b.oursLabel : d?.choice === 'theirs' ? b.theirsLabel : d?.choice === 'both' ? `${b.oursLabel} + ${b.theirsLabel}` : 'customizado'
        return `#${b.id}: ${label}`
      })

      const truncated = resolvedContent.length > settings.maxDiffChars
      const warning =
        'O arquivo será sobrescrito com o conteúdo abaixo e marcado como resolvido (staged). Revise antes de aprovar.' +
        (truncated ? ' A prévia abaixo foi truncada — revise o arquivo completo após aplicar.' : '')

      return {
        preview: {
          headline: `Resolver conflito em "${path}"`,
          fields: [
            { label: 'Arquivo', value: path },
            { label: `Blocos de conflito (${conflictBlocks.length})`, value: decisionLines.join('\n') },
            { label: 'Resumo da IA', value: suggestion.summary },
            { label: 'Conteúdo resolvido proposto', value: '```\n' + truncate(resolvedContent, settings.maxDiffChars) + '\n```' }
          ],
          warning
        },
        resolvedArgs: { path, resolved_content: resolvedContent, summary: suggestion.summary }
      }
    }

    case 'check_incoming_commits': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      return {
        preview: {
          headline: 'Verificar commits novos no remoto',
          fields: [
            { label: 'Branch', value: status.branch ?? '?' },
            { label: 'Operação', value: 'git fetch --dry-run (não modifica nada localmente)' }
          ]
        },
        resolvedArgs: a
      }
    }

    case 'get_git_identity': {
      const repoPath = await requireCurrentRepo()
      const identity = await window.api.git.getIdentity(repoPath)
      return {
        preview: {
          headline: 'Ler identidade Git configurada',
          fields: [
            { label: 'Nome (local)', value: identity.local.name ?? 'não configurado' },
            { label: 'Email (local)', value: identity.local.email ?? 'não configurado' },
            { label: 'Nome (global)', value: identity.global.name ?? 'não configurado' },
            { label: 'Email (global)', value: identity.global.email ?? 'não configurado' }
          ]
        },
        resolvedArgs: a
      }
    }

    case 'set_git_identity': {
      const scope = a.scope
      if (scope !== 'local' && scope !== 'global') throw new Error("O parâmetro 'scope' deve ser 'local' ou 'global'.")
      if (!a.name && !a.email) throw new Error("Informe ao menos 'name' ou 'email' para configurar.")
      const repoPath = await requireCurrentRepo()
      const identity = await window.api.git.getIdentity(repoPath)
      const current = identity[scope]
      const fields: ToolPreview['fields'] = []
      if (a.name) fields.push({ label: 'Nome', value: `${current.name ?? 'não configurado'} → ${a.name}` })
      if (a.email) fields.push({ label: 'Email', value: `${current.email ?? 'não configurado'} → ${a.email}` })
      fields.push({ label: 'Escopo', value: scope === 'local' ? 'local (só este repositório)' : 'global (toda a máquina)' })
      return {
        preview: {
          headline: 'Configurar identidade Git',
          fields,
          warning:
            scope === 'global'
              ? 'Isso afeta todos os repositórios deste usuário nesta máquina.'
              : 'Isso afeta somente este repositório.'
        },
        resolvedArgs: a
      }
    }

    case 'list_files':
      return {
        preview: {
          headline: a.pattern ? `Listar arquivos: ${a.pattern}` : 'Listar arquivos do repositório',
          fields: []
        },
        resolvedArgs: a
      }

    case 'read_file': {
      if (!a.path) throw new Error("O parâmetro 'path' é obrigatório.")
      const range =
        a.start_line || a.end_line ? `linhas ${a.start_line || '1'}–${a.end_line || 'fim'}` : 'arquivo inteiro'
      return {
        preview: { headline: `Ler ${a.path}`, fields: [{ label: 'Trecho', value: range }] },
        resolvedArgs: a
      }
    }

    case 'read_changes': {
      const scope = a.scope ?? 'all'
      if (!['unstaged', 'staged', 'all'].includes(scope)) {
        throw new Error("O parâmetro 'scope' deve ser 'unstaged', 'staged' ou 'all'.")
      }
      return {
        preview: {
          headline: a.path ? `Ver alterações em ${a.path}` : 'Ver alterações não commitadas',
          fields: [{ label: 'Escopo', value: scope }]
        },
        resolvedArgs: { ...a, scope }
      }
    }

    case 'list_all_repos':
      return { preview: { headline: 'Listar repositórios recentes', fields: [] }, resolvedArgs: a }

    case 'list_branches':
      return {
        preview: {
          headline: 'Listar branches do repositório',
          fields: a.include_remote === 'true' ? [{ label: 'Incluir remotas', value: 'Sim' }] : []
        },
        resolvedArgs: a
      }

    case 'list_branches_all_repos':
      return { preview: { headline: 'Listar branches de todos os repositórios recentes', fields: [] }, resolvedArgs: a }

    case 'check_all_repos':
      return { preview: { headline: 'Verificar atualizações em todos os repositórios recentes', fields: [] }, resolvedArgs: a }

    case 'fetch_all':
      return { preview: { headline: 'Fetch em todos os repositórios recentes', fields: [] }, resolvedArgs: a }

    case 'pull_repo': {
      if (!a.repo_path) throw new Error("O parâmetro 'repo_path' é obrigatório.")
      return { preview: { headline: `Pull em ${a.repo_path}`, fields: [] }, resolvedArgs: a }
    }

    case 'pull_all':
      return {
        preview: {
          headline: 'Pull em todos os repositórios com atualização pendente',
          fields: [],
          warning: 'Pode gerar conflitos em qualquer um dos repositórios.'
        },
        resolvedArgs: a
      }

    case 'push': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      const branch = status.branch ?? '?'
      const setUpstream = !status.upstream

      let info: string
      let warning: string | undefined
      if (setUpstream) info = 'A branch ainda não tem upstream — será criado com -u.'
      else if (status.ahead === 0) {
        info = 'Nada para enviar (0 commits à frente).'
        warning = 'Não há commits novos para enviar. A operação não terá efeito.'
      } else {
        info = `${status.ahead} commit(s) à frente`
        if (status.behind > 0) {
          warning = `O remote tem ${status.behind} commit(s) que você não tem localmente. O push pode ser rejeitado — considere dar pull antes.`
        }
      }

      return {
        preview: {
          headline: setUpstream ? `Publicar branch "${branch}"` : `Push de "${branch}"`,
          fields: [
            { label: 'Branch', value: branch },
            { label: 'Status', value: info }
          ],
          warning
        },
        resolvedArgs: { set_upstream: setUpstream ? 'true' : 'false', branch }
      }
    }

    case 'pull': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      const branch = status.branch ?? '?'
      const localChanges = status.entries.length

      let info: string
      let warning: string | undefined
      if (!status.upstream) {
        info = 'Branch sem upstream configurado.'
        warning = 'A branch atual não tem upstream — o pull provavelmente vai falhar.'
      } else if (status.behind === 0) {
        info = 'Já está atualizado (0 commits atrás).'
        warning = 'Nada para puxar. A operação não terá efeito.'
      } else {
        info = `${status.behind} commit(s) novos no remote`
        if (localChanges > 0) {
          warning = `Você tem ${localChanges} arquivo(s) modificado(s) localmente. O pull pode falhar ou gerar conflitos — considere stash antes.`
        }
      }

      return {
        preview: { headline: `Pull de "${branch}"`, fields: [{ label: 'Status', value: info }], warning },
        resolvedArgs: a
      }
    }

    case 'switch_branch': {
      const target = a.branch_name
      if (!target) throw new Error("O parâmetro 'branch_name' é obrigatório.")
      const repoPath = await requireCurrentRepo()
      const [status, branches] = await Promise.all([window.api.git.status(repoPath), window.api.git.branches(repoPath)])
      const current = status.branch ?? '?'
      if (current.toLowerCase() === target.toLowerCase()) throw new Error(`Você já está na branch "${target}".`)
      if (!branches.some((b) => b.name.toLowerCase() === target.toLowerCase())) {
        throw new Error(`Branch "${target}" não existe localmente. Use create_branch para criar.`)
      }

      return {
        preview: {
          headline: `Trocar para a branch "${target}"`,
          fields: [{ label: 'Branch atual', value: current }],
          warning:
            status.entries.length > 0
              ? `Você tem ${status.entries.length} arquivo(s) modificado(s). O checkout pode ser bloqueado — considere stash ou commit antes.`
              : undefined
        },
        resolvedArgs: a
      }
    }

    case 'stash':
      return {
        preview: { headline: 'Colocar alterações atuais em stash', fields: a.message ? [{ label: 'Mensagem', value: a.message }] : [] },
        resolvedArgs: a
      }

    case 'stash_pop':
      return {
        preview: { headline: 'Aplicar e remover o stash', fields: a.stash_ref ? [{ label: 'Ref', value: a.stash_ref }] : [] },
        resolvedArgs: a
      }

    default:
      return {
        preview: { headline: call.name, fields: Object.entries(a).map(([label, value]) => ({ label, value })) },
        resolvedArgs: a
      }
  }
}

// ---------------------------------------------------------------------------
// Execute (runs only after explicit user approval) — `call.arguments` here
// is always the resolvedArgs computed by prepareToolCall, not the model's
// raw arguments, so any value it filled in (generated commit message,
// detected head branch, etc.) is what actually gets applied.
// ---------------------------------------------------------------------------

export async function executeToolCall(call: ToolCallRequest): Promise<string> {
  const repo = useRepoStore.getState()
  const pr = usePullRequestStore.getState()
  const a = call.arguments

  switch (call.name) {
    case 'create_branch': {
      await repo.createBranch(a.branch_name, a.checkout !== 'false', a.from_branch || undefined)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao criar branch.')
      return `Branch "${a.branch_name}" criada.`
    }

    case 'create_pull_request': {
      const ok = await pr.createPullRequest({
        title: a.title,
        body: a.body ?? '',
        head: a.head_branch,
        base: a.base_branch,
        draft: a.draft === 'true'
      })
      if (!ok) throw new Error(usePullRequestStore.getState().error ?? 'Falha ao criar PR.')
      return `Pull Request "${a.title}" criada.`
    }

    case 'list_pull_requests': {
      if (a.state) pr.setStateFilter(a.state as 'open' | 'closed' | 'all')
      await pr.refreshPullRequests()
      let list = usePullRequestStore.getState().pullRequests
      if (a.head_branch) list = list.filter((p) => p.headRef === a.head_branch)
      if (list.length === 0) return 'Nenhuma pull request encontrada.'
      return list.map((p) => `#${p.number} [${p.draft ? 'draft' : p.state}] ${p.title} (${p.headRef} -> ${p.baseRef})`).join('\n')
    }

    case 'read_pull_request': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      const prData = await window.api.github.getPullRequest(host, owner, repoName, number)
      const lines = [
        `PR #${prData.number} [${prData.draft ? 'draft' : prData.state}]`,
        `Título: ${prData.title}`,
        `Autor: ${prData.authorLogin}`,
        `Head -> Base: ${prData.headRef} -> ${prData.baseRef}`,
        `URL: ${prData.htmlUrl}`,
        '',
        'Descrição:',
        prData.body ? truncate(prData.body.trim(), 2000) : '(sem descrição)'
      ]

      if (a.include_files !== 'false') {
        const files = await window.api.github.listPullRequestFiles(host, owner, repoName, number)
        const includeDiffs = a.include_diffs === 'true'
        lines.push('', `Arquivos alterados (${files.length}):`)
        const shown = files.slice(0, includeDiffs ? 15 : 40)
        for (const f of shown) {
          lines.push(`- ${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`)
          if (includeDiffs && f.patch) lines.push('```diff\n' + truncate(f.patch, 3000) + '\n```')
        }
        if (files.length > shown.length) lines.push(`… e mais ${files.length - shown.length} arquivo(s).`)
      }

      if (a.include_comments !== 'false') {
        const comments = await window.api.github.listPullRequestComments(host, owner, repoName, number)
        lines.push('', `Comentários (${comments.length}):`)
        for (const c of comments.slice(0, 20)) lines.push(`- ${c.authorLogin}: ${truncate(c.body.replace(/\s+/g, ' ').trim(), 220)}`)
        if (comments.length > 20) lines.push(`… e mais ${comments.length - 20} comentário(s).`)
      }

      return lines.join('\n')
    }

    case 'read_commit': {
      const repoPath = await requireCurrentRepo()
      const ref = a.ref || 'HEAD'
      const details = await window.api.git.commitDetails(repoPath, ref)
      if (!details) throw new Error(`Commit "${ref}" não encontrado neste repositório.`)

      const lines = [
        `Commit: ${details.hash}`,
        `Autor: ${details.authorName} <${details.authorEmail}>`,
        `Data: ${details.date}`,
        details.parents.length > 1 ? `Merge commit (pais: ${details.parents.join(', ')})` : '',
        '',
        'Mensagem:',
        details.summary,
        details.body
      ].filter((l) => l !== '')

      const path = a.path || undefined

      if (a.include_files !== 'false') {
        const files = await window.api.git.commitFiles(details.hash, repoPath)
        if (path) {
          const entry = files.find((f) => effectivePath(f.path) === path)
          lines.push('', `Arquivo lido (de ${files.length} alterados no commit):`, `- ${entry?.status ?? '?'} ${path}`)
        } else {
          lines.push('', `Arquivos alterados (${files.length}):`)
          const shown = files.slice(0, 60)
          for (const f of shown) lines.push(`- ${f.status} ${f.path}`)
          if (files.length > shown.length) lines.push(`… e mais ${files.length - shown.length} arquivo(s).`)
        }
      }

      if (a.include_diff === 'true') {
        const { settings } = await getActiveAiConfig()
        const patch = path ? await window.api.git.commitDiff(details.hash, path, repoPath) : await window.api.git.commitPatch(repoPath, details.hash)
        if (!patch.trim()) {
          // With a resolved path the file is definitely in the commit, so an
          // empty patch means binary content or a mode-only change.
          const empty = path
            ? `(sem diff textual para "${path}" — provavelmente arquivo binário ou mudança apenas de modo/permissão)`
            : '(sem diff)'
          lines.push('', details.parents.length > 1 ? '(sem diff — commit de merge sem mudanças em relação ao primeiro pai)' : empty)
        } else {
          lines.push('', '```diff', truncate(patch, settings.maxDiffChars), '```')
          // A bare "…" inside the fence is invisible to the model — it then
          // burns a turn re-reading the commit with everything switched off.
          // Say what was cut and how to get the rest.
          if (patch.length > settings.maxDiffChars) {
            const cut = `(diff truncado: ${settings.maxDiffChars.toLocaleString('pt-BR')} de ${patch.length.toLocaleString('pt-BR')} caracteres.`
            lines.push(
              '',
              path
                ? `${cut} O arquivo é grande demais para o limite atual — aumente "Limite do diff" nas configurações da IA.)`
                : `${cut} Chame read_commit de novo com path="<arquivo>" para ler um arquivo inteiro.)`
            )
            if (!path) {
              const missing = await listFilesBeyondTruncation(repoPath, details.hash, patch.slice(0, settings.maxDiffChars))
              if (missing.length > 0) lines.push(`Arquivos que ficaram fora do trecho acima (${missing.length}):`, formatFileList(missing, 60))
            }
          }
        }
      }

      return lines.join('\n')
    }

    case 'list_commits': {
      const repoPath = await requireCurrentRepo()
      const limit = Math.min(Number(a.limit) || 20, 100)
      const commits = await window.api.git.log(repoPath, limit)
      if (commits.length === 0) return 'Nenhum commit neste repositório.'
      return commits.map((c) => `${c.shortHash}  ${c.date}  ${c.authorName}  ${c.summary}`).join('\n')
    }

    case 'merge_pull_request': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      const method = (a.merge_method as 'merge' | 'squash' | 'rebase' | undefined) ?? 'merge'
      await window.api.github.mergePullRequest(host, owner, repoName, number, method, a.commit_title || undefined, a.commit_message || undefined)
      return `PR #${number} mergeado com sucesso.`
    }

    case 'review_pull_request': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      const event = a.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
      // commit_id was resolved to the PR head SHA during prepare.
      await window.api.github.submitPullRequestReview(host, owner, repoName, number, event, a.body ?? '', a.commit_id)
      const label = event === 'APPROVE' ? 'aprovado' : event === 'REQUEST_CHANGES' ? 'marcado com mudanças solicitadas' : 'comentado'
      return `PR #${number} ${label}.`
    }

    case 'comment_pull_request': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      await window.api.github.addPullRequestComment(host, owner, repoName, number, a.body)
      return `Comentário adicionado no PR #${number}.`
    }

    case 'set_pull_request_state': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      const state = a.state as 'open' | 'closed'
      await window.api.github.setPullRequestState(host, owner, repoName, number, state)
      return `PR #${number} ${state === 'closed' ? 'fechado' : 'reaberto'}.`
    }

    case 'merge_branch': {
      await repo.mergeBranch(a.source_branch)
      return useRepoStore.getState().error ? `Merge com problemas: ${useRepoStore.getState().error}` : `Branch "${a.source_branch}" mesclada.`
    }

    case 'merge_abort': {
      await repo.abortMerge()
      const error = useRepoStore.getState().error
      if (error) throw new Error(error)
      return 'Merge abortado; o repositório voltou ao estado anterior.'
    }

    case 'commit': {
      if (a.auto_stage === 'true') {
        const repoPath = await requireCurrentRepo()
        const status = await window.api.git.status(repoPath)
        const unstagedPaths = status.entries.filter((e) => e.index === ' ' || e.index === '?').map((e) => e.path)
        await repo.stagePaths(unstagedPaths)
        if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao fazer stage.')
      }
      await repo.commitChanges(a.summary, a.description ?? '')
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao commitar.')
      return `Commit criado: "${a.summary}".`
    }

    case 'undo_last_commit': {
      // The approval showed a specific unpublished commit. The main process
      // re-checks both right before the reset, so a HEAD move or a push while
      // the card was open makes it refuse instead of rewriting published history.
      const repoPath = await requireCurrentRepo()
      const [last] = await window.api.git.log(repoPath, 1)
      await repo.undoLastCommit(a.hash)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao desfazer o commit.')
      if (!last) return 'Commit desfeito. As mudanças dele estão no stage.'
      return `Commit ${last.shortHash} ("${last.summary}") desfeito. As mudanças dele estão no stage.`
    }

    case 'ignore_files': {
      const patterns = parsePathList(a.patterns ?? '')
      const untrack = parsePathList(a.untrack ?? '')
      await repo.ignorePatterns(patterns, untrack, untrack.length > 0)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao ignorar os arquivos.')
      // After an undo the stage is rarely empty, and `commit` then takes only
      // what is staged — without this the rule would miss the fix commit.
      await repo.stagePaths(['.gitignore'])
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao fazer stage do .gitignore.')
      const untrackedNote = untrack.length > 0 ? ` ${untrack.length} arquivo(s) tirado(s) do Git; continuam no disco.` : ''
      return `Adicionado ao .gitignore: ${patterns.join(', ')}. O .gitignore está no stage.${untrackedNote}`
    }

    case 'resolve_conflict': {
      await repo.resolveConflict(a.path, a.resolved_content)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao aplicar a resolução de conflito.')
      return `Conflito em "${a.path}" resolvido e marcado como staged.`
    }

    case 'check_incoming_commits': {
      const repoPath = await requireCurrentRepo()
      const result = await window.api.git.fetchDryRun(repoPath)
      const output = (result.stderr + result.stdout).trim()
      return output ? output : 'Nenhum commit novo no remoto.'
    }

    case 'get_git_identity': {
      const repoPath = await requireCurrentRepo()
      const identity = await window.api.git.getIdentity(repoPath)
      return [
        `Local: nome="${identity.local.name ?? 'não configurado'}", email="${identity.local.email ?? 'não configurado'}"`,
        `Global: nome="${identity.global.name ?? 'não configurado'}", email="${identity.global.email ?? 'não configurado'}"`
      ].join('\n')
    }

    case 'set_git_identity': {
      const scope = a.scope as 'local' | 'global'
      const repoPath = await requireCurrentRepo()
      await window.api.git.setIdentity(repoPath, scope, { name: a.name, email: a.email })
      const parts = [a.name ? `nome="${a.name}"` : null, a.email ? `email="${a.email}"` : null].filter(Boolean)
      return `Identidade Git (${scope}) atualizada: ${parts.join(', ')}.`
    }

    case 'list_files': {
      const repoPath = await requireCurrentRepo()
      const files = await window.api.git.listFiles(repoPath, a.pattern)
      if (files.length === 0) {
        return a.pattern
          ? `Nenhum arquivo corresponde a "${a.pattern}".`
          : 'Nenhum arquivo legível no repositório.'
      }
      const header = `${files.length} arquivo(s)${a.pattern ? ` para "${a.pattern}"` : ''}:`
      return [header, formatFileList(files, 300)].join('\n')
    }

    case 'read_file': {
      const repoPath = await requireCurrentRepo()
      const { settings } = await getActiveAiConfig()

      let content: string
      try {
        content = await window.api.git.readFileForAgent(repoPath, a.path)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        // A wrong path is the common failure; point at real ones instead of
        // letting the model guess again, same idea as resolveCommitPath.
        if (/ENOENT|não encontrado|no such file/i.test(message)) {
          const base = a.path.split(/[/\\]/).pop() ?? a.path
          const similar = await window.api.git.listFiles(repoPath, `*${base}*`).catch(() => [])
          throw new Error(
            similar.length > 0
              ? `"${a.path}" não existe. Caminhos parecidos:\n${formatFileList(similar, 20)}`
              : `"${a.path}" não existe no repositório. Use list_files para descobrir o caminho.`
          )
        }
        throw err
      }

      const allLines = content.split('\n')
      const total = allLines.length
      const start = Math.max(1, Number(a.start_line) || 1)
      const end = Math.min(total, Number(a.end_line) || total)
      if (start > total) throw new Error(`"${a.path}" tem apenas ${total} linhas.`)
      // Otherwise slice() returns nothing and the model gets an empty code
      // block labelled with an impossible range instead of a usable error.
      if (end < start) {
        throw new Error(`Intervalo inválido: end_line (${end}) é menor que start_line (${start}).`)
      }

      const slice = allLines.slice(start - 1, end)
      const width = String(end).length
      const numbered = slice.map((line, i) => `${String(start + i).padStart(width)} | ${line}`).join('\n')

      const body = truncate(numbered, settings.maxDiffChars)
      const lines = [`${a.path} (linhas ${start}–${end} de ${total}):`, '```', body, '```']
      if (numbered.length > settings.maxDiffChars) {
        lines.push(
          `(conteúdo truncado em ${settings.maxDiffChars.toLocaleString('pt-BR')} caracteres — peça um intervalo menor com start_line/end_line.)`
        )
      } else if (end < total) {
        lines.push(`(o arquivo continua até a linha ${total}.)`)
      }
      return lines.join('\n')
    }

    case 'read_changes': {
      const repoPath = await requireCurrentRepo()
      const { settings } = await getActiveAiConfig()
      const scope = a.scope ?? 'all'

      async function diffFor(staged: boolean): Promise<string> {
        return a.path
          ? window.api.git.diff(a.path, repoPath, staged)
          : staged
            ? window.api.git.diffStagedAll(repoPath)
            : window.api.git.diffUnstagedAll(repoPath)
      }

      const sections: { label: string; diff: string }[] = []
      if (scope === 'staged' || scope === 'all') sections.push({ label: 'Staged', diff: await diffFor(true) })
      if (scope === 'unstaged' || scope === 'all') sections.push({ label: 'Não staged', diff: await diffFor(false) })

      const nonEmpty = sections.filter((s) => s.diff.trim())
      if (nonEmpty.length === 0) {
        return a.path
          ? `Nenhuma alteração não commitada em "${a.path}".`
          : 'Nenhuma alteração não commitada no working tree.'
      }

      // The budget is shared, so one huge section cannot starve the other.
      const budget = Math.floor(settings.maxDiffChars / nonEmpty.length)
      const out: string[] = []
      for (const section of nonEmpty) {
        out.push(`--- ${section.label} ---`, '```diff', truncate(section.diff, budget), '```')
        if (section.diff.length > budget) {
          out.push(
            `(diff truncado: ${budget.toLocaleString('pt-BR')} de ${section.diff.length.toLocaleString('pt-BR')} caracteres. Use o parâmetro path para ver um arquivo por vez.)`
          )
        }
      }
      return out.join('\n')
    }

    case 'list_all_repos': {
      const repos = useRepoStore.getState().recentRepos
      if (repos.length === 0) return 'Nenhum repositório recente.'
      return repos.map((r) => `${r.name} — ${r.path}`).join('\n')
    }

    case 'list_branches': {
      await repo.refreshBranches()
      const lines = useRepoStore.getState().branches.map((b) => `${b.isCurrent ? '* ' : '  '}${b.name}`)
      if (a.include_remote === 'true') {
        const remote = await window.api.git.remoteBranches(await requireCurrentRepo())
        lines.push('', `Remotas sem branch local (${remote.length}):`, ...remote.map((r) => `  ${r}`))
      }
      return lines.join('\n')
    }

    case 'list_branches_all_repos': {
      const repos = useRepoStore.getState().recentRepos
      const lines: string[] = []
      for (const r of repos) {
        try {
          const branches = await window.api.git.branches(r.path)
          lines.push(`${r.name}:`)
          for (const b of branches) lines.push(`  ${b.isCurrent ? '* ' : '  '}${b.name}`)
        } catch (err) {
          lines.push(`${r.name}: erro (${err instanceof Error ? err.message : String(err)})`)
        }
      }
      return lines.join('\n')
    }

    case 'check_all_repos': {
      const repos = useRepoStore.getState().recentRepos
      const lines: string[] = []
      for (const r of repos) {
        try {
          const dry = await window.api.git.fetchDryRun(r.path)
          const output = (dry.stderr + dry.stdout).trim()
          if (output) {
            lines.push(`${r.name}: atualizações remotas detectadas\n${output}`)
            continue
          }
          const status = await window.api.git.status(r.path)
          lines.push(
            status.behind > 0 ? `${r.name}: ${status.behind} commit(s) atrás` : `${r.name}: atualizado`
          )
        } catch (err) {
          lines.push(`${r.name}: erro (${err instanceof Error ? err.message : String(err)})`)
        }
      }
      return lines.join('\n')
    }

    case 'fetch_all': {
      const repos = useRepoStore.getState().recentRepos
      const lines: string[] = []
      for (const r of repos) {
        try {
          await window.api.git.fetch(r.path)
          lines.push(`${r.name}: fetch ok`)
        } catch (err) {
          lines.push(`${r.name}: erro (${err instanceof Error ? err.message : String(err)})`)
        }
      }
      return lines.join('\n')
    }

    case 'pull_repo': {
      const result = await window.api.git.pull(a.repo_path)
      if (result.exitCode !== 0) throw new Error(result.stderr.trim() || 'Falha no pull.')
      return `Pull concluído em ${a.repo_path}.`
    }

    case 'pull_all': {
      const repos = useRepoStore.getState().recentRepos
      const lines: string[] = []
      for (const r of repos) {
        try {
          await window.api.git.fetch(r.path)
          const status = await window.api.git.status(r.path)
          if (status.behind === 0) {
            lines.push(`${r.name}: já atualizado`)
            continue
          }
          const result = await window.api.git.pull(r.path)
          lines.push(result.exitCode === 0 ? `${r.name}: pull ok` : `${r.name}: falha (${result.stderr.trim()})`)
        } catch (err) {
          lines.push(`${r.name}: erro (${err instanceof Error ? err.message : String(err)})`)
        }
      }
      return lines.length > 0 ? lines.join('\n') : 'Nenhum repositório recente.'
    }

    case 'push': {
      const repoPath = await requireCurrentRepo()
      await window.api.git.push(repoPath, a.branch, a.set_upstream === 'true')
      await repo.refreshStatus()
      return a.set_upstream === 'true' ? `Branch "${a.branch}" publicada.` : `Push de "${a.branch}" concluído.`
    }

    case 'pull': {
      const repoPath = await requireCurrentRepo()
      const result = await window.api.git.pull(repoPath)
      await Promise.all([repo.refreshStatus(), repo.refreshLog()])
      if (result.exitCode !== 0) {
        const hasConflicts = useRepoStore.getState().status?.entries.some(isConflicted)
        if (hasConflicts) return 'Pull com conflitos. Resolva os arquivos marcados em Alterações.'
        throw new Error(result.stderr.trim() || 'Falha no pull.')
      }
      return 'Pull concluído.'
    }

    case 'switch_branch':
      await repo.switchBranch(a.branch_name)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao trocar de branch.')
      return `Trocado para a branch "${a.branch_name}".`

    case 'stash':
      await repo.pushStash(a.message ?? '')
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao criar stash.')
      return 'Alterações colocadas em stash.'

    case 'stash_pop': {
      const ref = a.stash_ref || useRepoStore.getState().stashes[0]?.ref
      if (!ref) return 'Nenhum stash para aplicar.'
      await repo.popStash(ref)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? 'Falha ao aplicar stash.')
      return `Stash "${ref}" aplicado e removido.`
    }

    default:
      return `Tool desconhecida: ${call.name}`
  }
}
