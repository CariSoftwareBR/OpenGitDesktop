import { useRepoStore } from '../../store/repoStore'
import { validateBranchName } from '../branchName'
import { usePullRequestStore } from '../../store/pullRequestStore'
import { getActiveAiConfig } from '../../store/aiStore'
import { generateCommitMessage } from './commitMessage'
import { generateConflictResolution } from './conflictResolution'
import { formatPullRequestStatus } from './prStatus'
import { directPushBlock } from '../branchProtection'
import { isConflicted, type BranchIntegration, type BranchIntegrationReport, type StatusEntry } from '../../../../shared/git'
import { parseConflictBlocks, renderResolvedWithChoices, type ConflictBlock, type ConflictResolutionChoice } from '../conflicts'
import type { ToolCallRequest } from '../../../../shared/aiChat'
import { getFmt, getT } from '../i18n'

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
const DANGER_TOOLS = new Set(['merge_pull_request', 'merge_branch', 'push', 'review_pull_request', 'delete_merged_branches'])
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
  if (paths.length > max) shown.push(getT().tools.moreFiles(paths.length - max))
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
  // POSIX single quotes: nothing inside is special, so only ' itself needs
  // the close-escape-reopen dance. Backslashes and $ survive literally.
  return /[\s"'$`\\]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg
}

// Tool args are flat strings, so a list of paths arrives comma/newline separated.
function parsePathList(raw: string): string[] {
  const paths = raw
    .split(/[\n,]/)
    .map((p) => p.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
    .filter(Boolean)
  return [...new Set(paths)]
}

function parseBranchList(raw: string): string[] {
  return [...new Set(raw.split(/[\n,]/).map((b) => b.trim()).filter(Boolean))]
}

function describeBranch(b: BranchIntegration): string {
  const t = getT().tools
  const tags = [
    b.isCurrent && t.tagCurrent,
    b.remoteOnly && t.tagRemoteOnly,
    !b.remoteOnly && !b.upstream && t.tagNotPublished,
    b.upstreamGone && t.tagUpstreamGone
  ].filter(Boolean)
  return `- ${b.name}${tags.length > 0 ? ` [${tags.join(', ')}]` : ''}`
}

// Grouped so the model can answer "what is still missing from main" and
// "what can go" straight from the sections, without re-deriving states.
function formatIntegrationReport(report: BranchIntegrationReport): string {
  const t = getT().tools
  if (report.branches.length === 0) return t.noOtherBranches(report.base)

  const byRecent = (x: BranchIntegration, y: BranchIntegration): number => y.lastCommitDate.localeCompare(x.lastCommitDate)
  const unmerged = report.branches.filter((b) => b.state === 'unmerged').sort(byRecent)
  const equivalent = report.branches.filter((b) => b.state === 'equivalent').sort(byRecent)
  const merged = report.branches.filter((b) => b.state === 'merged').sort(byRecent)

  const lines = [t.integrationBaseLine(report.base)]
  if (unmerged.length > 0) {
    lines.push('', t.unmergedSection(unmerged.length))
    for (const b of unmerged) {
      lines.push(`${describeBranch(b)} — ${t.aheadBehindBase(b.ahead, b.behind)} · ${t.lastCommitLine(b.lastCommitDate, b.lastCommitSummary)}`)
    }
  }
  if (equivalent.length > 0) {
    lines.push('', t.equivalentSection(equivalent.length))
    for (const b of equivalent) lines.push(`${describeBranch(b)} — ${t.equivalentIn(b.equivalentCommit ?? '?')}`)
  }
  if (merged.length > 0) {
    lines.push('', t.mergedSection(merged.length))
    for (const b of merged) lines.push(`${describeBranch(b)} — ${t.lastCommitLine(b.lastCommitDate, b.lastCommitSummary)}`)
  }
  lines.push('', t.protectedLine(report.protectedNames.join(', ')))
  return lines.join('\n')
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
    throw new Error(getT().tools.ambiguousPath(requested, formatFileList(suffix)))
  }

  throw new Error(getT().tools.notInCommit(requested, paths.length, formatFileList(paths, 60)))
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
  if (!repoPath) throw new Error(getT().tools.noRepoOpen)
  return repoPath
}

// Returns the addressing the GitHub IPC calls need. There is no token here on
// purpose: main resolves it from the host on every call.
function requireGitHubRemote(): { host: string; owner: string; repo: string } {
  const pr = usePullRequestStore.getState()
  if (!pr.remote || !pr.user) {
    throw new Error(getT().tools.noGithubRemote)
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
  const t = getT().tools
  const yesNo = (value: boolean): string => (value ? t.yes : t.no)

  switch (call.name) {
    case 'create_branch': {
      const branchName = a.branch_name
      if (!branchName) throw new Error(t.paramRequired('branch_name'))
      // Same rules the "Nova branch" dialog applies, so a bad name the model
      // proposes is refused here — not after the user already approved it.
      const invalid = validateBranchName(branchName, useRepoStore.getState().branches.map((b) => b.name))
      if (invalid) throw new Error(t.invalidBranchName(branchName, invalid))
      const checkout = a.checkout !== 'false'
      return {
        preview: {
          headline: t.createBranchHeadline(branchName),
          fields: [
            { label: t.fromLabel, value: a.from_branch || t.currentHead },
            { label: t.switchToIt, value: yesNo(checkout) }
          ]
        },
        resolvedArgs: a
      }
    }

    case 'create_pull_request': {
      const { title, body, base_branch: baseBranch } = a
      if (!title) throw new Error(t.paramRequired('title'))
      if (!baseBranch) throw new Error(t.paramRequired('base_branch'))
      // Read live from disk rather than the cached repo store — the cache can
      // be stale right after a branch switch, which previously let a PR go
      // out with an empty/wrong head branch.
      const repoPath = await requireCurrentRepo()
      const liveStatus = await window.api.git.status(repoPath)
      const head = liveStatus.branch
      if (!head) throw new Error(t.noCurrentBranch)
      if (head.toLowerCase() === baseBranch.toLowerCase()) {
        throw new Error(t.sameAsBase)
      }
      // GitHub can't open a PR from a branch it doesn't have — catch this
      // locally with a clear message instead of surfacing GitHub's opaque
      // "Validation Failed" once the request is already in flight.
      if (liveStatus.entries.length > 0) {
        throw new Error(t.uncommittedBeforePr)
      }
      if (!liveStatus.upstream || liveStatus.ahead > 0) {
        throw new Error(t.unpublishedBeforePr)
      }
      const { owner, repo: repoName } = requireGitHubRemote()

      return {
        preview: {
          headline: t.createPrHeadline(title),
          fields: [
            { label: t.from, value: head },
            { label: t.to, value: baseBranch },
            { label: 'Remote', value: `${owner}/${repoName}` },
            { label: t.draft, value: yesNo(a.draft === 'true') },
            { label: t.description, value: body || t.emptyValue }
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
          headline: t.listPrsHeadline,
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: t.state, value: state },
            { label: 'Head branch', value: a.head_branch || t.allBranches }
          ]
        },
        resolvedArgs: a
      }
    }

    case 'read_pull_request': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error(t.paramRequired('pull_request_number'))
      const { owner, repo } = requireGitHubRemote()
      return {
        preview: {
          headline: t.readPrHeadline(number),
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: t.includeFiles, value: yesNo(a.include_files !== 'false') },
            { label: t.includeDiffs, value: yesNo(a.include_diffs === 'true') },
            { label: t.includeComments, value: yesNo(a.include_comments !== 'false') }
          ]
        },
        resolvedArgs: a
      }
    }

    case 'check_pull_request_status': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error(t.paramRequired('pull_request_number'))
      const { owner, repo } = requireGitHubRemote()
      return {
        preview: { headline: t.prStatusHeadline(number), fields: [{ label: 'Remote', value: `${owner}/${repo}` }] },
        resolvedArgs: a
      }
    }

    case 'read_commit': {
      const ref = a.ref || 'HEAD'
      const repoPath = await requireCurrentRepo()
      const details = await window.api.git.commitDetails(repoPath, ref)
      if (!details) throw new Error(t.commitNotFound(ref))

      // Resolve the file filter here so the approval card shows the real path
      // and execute never has to guess: models name the file the user typed
      // ("Util_NFe_IDE.cs"), not its full path inside the repo.
      const path = a.path ? await resolveCommitPath(repoPath, details.hash, a.path) : undefined

      return {
        preview: {
          headline: t.readCommitHeadline(details.shortHash),
          fields: [
            { label: 'Commit', value: `${details.shortHash} — ${details.summary}` },
            { label: t.author, value: `${details.authorName} <${details.authorEmail}>` },
            { label: t.date, value: details.date },
            ...(path ? [{ label: t.file, value: path }] : []),
            { label: t.includeFiles, value: yesNo(a.include_files !== 'false') },
            { label: t.includeDiff, value: yesNo(a.include_diff === 'true') }
          ]
        },
        // Fix the resolved hash so execute doesn't re-interpret "HEAD" after
        // further tool calls or user actions may have moved it.
        resolvedArgs: path ? { ...a, ref: details.hash, path } : { ...a, ref: details.hash }
      }
    }

    case 'list_commits':
      return {
        preview: { headline: t.listCommitsHeadline(a.limit || '20'), fields: [] },
        resolvedArgs: a
      }

    case 'merge_pull_request': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error(t.paramRequired('pull_request_number'))
      const mergeMethod = (a.merge_method as 'merge' | 'squash' | 'rebase' | undefined) ?? 'merge'
      const { host, owner, repo } = requireGitHubRemote()
      const pr = await window.api.github.getPullRequest(host, owner, repo, number)
      const status = pr.draft ? 'draft' : pr.state

      // Refuse what GitHub would refuse, instead of letting the user approve a
      // merge that comes back as an API error.
      if (pr.merged) throw new Error(t.prAlreadyMerged(number))
      if (pr.state === 'closed') throw new Error(t.prClosedCannotMerge(number))

      const mergeability =
        pr.mergeable === true
          ? `${t.yes}${pr.mergeableState ? ` (${pr.mergeableState})` : ''}`
          : pr.mergeable === false
            ? `${t.no}${pr.mergeableState ? ` (${pr.mergeableState})` : ''}`
            : t.notComputed

      let warning = t.remoteWarning
      if (pr.draft) {
        warning = t.draftWarning(number, warning)
      } else if (pr.mergeable === false) {
        warning =
          pr.mergeableState === 'dirty'
            ? t.conflictWarning(pr.headRef, pr.baseRef, warning)
            : t.notMergeableWarning(pr.mergeableState ?? t.unknownReason, warning)
      } else if (pr.mergeable === null) {
        warning = t.pendingMergeableWarning(warning)
      }

      return {
        preview: {
          headline: t.mergePrHeadline(number),
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'PR', value: `#${pr.number} [${status}] ${pr.title}` },
            { label: t.sourceTarget, value: `${pr.headRef} -> ${pr.baseRef}` },
            { label: t.mergeable, value: mergeability },
            { label: t.method, value: mergeMethod },
            { label: 'Commit title', value: a.commit_title || t.githubDefault }
          ],
          warning
        },
        resolvedArgs: a
      }
    }

    case 'review_pull_request': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error(t.paramRequired('pull_request_number'))
      const event = a.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' | undefined
      if (!event || !['APPROVE', 'REQUEST_CHANGES', 'COMMENT'].includes(event)) {
        throw new Error(t.eventInvalid)
      }
      const body = a.body?.trim() ?? ''
      if (event !== 'APPROVE' && !body) {
        throw new Error(t.reviewNeedsBody(event))
      }

      const { host, owner, repo } = requireGitHubRemote()
      const pr = await window.api.github.getPullRequest(host, owner, repo, number)
      if (pr.state === 'closed') throw new Error(t.prClosedNoReviews(number))

      // GitHub rejects self-approval with a 422; say so here rather than after
      // the user approves the action.
      const me = usePullRequestStore.getState().user?.login
      if (event === 'APPROVE' && me && me.toLowerCase() === pr.authorLogin.toLowerCase()) {
        throw new Error(t.cannotSelfApprove(number))
      }

      const eventLabel = event === 'APPROVE' ? t.approve : event === 'REQUEST_CHANGES' ? t.requestChanges : t.comment
      return {
        preview: {
          headline: `${eventLabel} — PR #${number}`,
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'PR', value: `#${pr.number} ${pr.title}` },
            { label: t.author, value: pr.authorLogin },
            { label: t.reviewType, value: event },
            { label: t.text, value: body || t.noText }
          ],
          warning: event === 'APPROVE' ? t.approvalPublic : t.reviewPublic
        },
        resolvedArgs: { ...a, body, commit_id: pr.headSha }
      }
    }

    case 'comment_pull_request': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error(t.paramRequired('pull_request_number'))
      const body = a.body?.trim()
      if (!body) throw new Error(t.paramRequired('body'))

      const { host, owner, repo } = requireGitHubRemote()
      const pr = await window.api.github.getPullRequest(host, owner, repo, number)
      return {
        preview: {
          headline: t.commentPrHeadline(number),
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'PR', value: `#${pr.number} ${pr.title}` },
            { label: t.commentLabel, value: body }
          ],
          warning: t.commentPublic
        },
        resolvedArgs: { ...a, body }
      }
    }

    case 'set_pull_request_state': {
      const number = Number(a.pull_request_number)
      if (!number) throw new Error(t.paramRequired('pull_request_number'))
      const state = a.state as 'open' | 'closed' | undefined
      if (state !== 'open' && state !== 'closed') {
        throw new Error(t.stateInvalid)
      }

      const { host, owner, repo } = requireGitHubRemote()
      const pr = await window.api.github.getPullRequest(host, owner, repo, number)
      if (pr.merged) throw new Error(t.prMergedCannotChange(number))
      if (pr.state === state) throw new Error(t.prAlreadyInState(number, state === 'open'))

      return {
        preview: {
          headline: state === 'closed' ? t.closePrHeadline(number) : t.reopenPrHeadline(number),
          fields: [
            { label: 'Remote', value: `${owner}/${repo}` },
            { label: 'PR', value: `#${pr.number} ${pr.title}` },
            { label: t.sourceTarget, value: `${pr.headRef} -> ${pr.baseRef}` }
          ],
          warning: state === 'closed' ? t.closeWarning : undefined
        },
        resolvedArgs: a
      }
    }

    case 'merge_branch': {
      const source = a.source_branch
      if (!source) throw new Error(t.paramRequired('source_branch'))
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      const current = status.branch ?? '?'

      // Conditions git would reject anyway — better to say so before the user
      // approves than to have the tool come back with a raw git error.
      if (status.entries.some(isConflicted)) {
        throw new Error(t.mergeInProgressConflicts)
      }
      if (source === current) throw new Error(t.alreadyCurrent(source))

      const branches = await window.api.git.branches(repoPath)
      if (!branches.some((b) => b.name === source)) {
        throw new Error(t.branchMissing(source, branches.map((b) => b.name).join(', ')))
      }

      const localChanges = status.entries.length
      return {
        preview: {
          headline: t.mergeBranchHeadline(source, current),
          fields: [
            { label: t.targetBranch, value: current },
            { label: t.sourceBranch, value: source },
            { label: t.localChanges, value: localChanges === 0 ? t.none : t.fileCount(localChanges) }
          ],
          warning: localChanges > 0 ? t.mergeDirtyWarning(localChanges) : t.mergeConflictWarning
        },
        resolvedArgs: a
      }
    }

    case 'merge_abort': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      const conflicted = status.entries.filter(isConflicted).map((e) => e.path)
      if (conflicted.length === 0) {
        throw new Error(t.noMergeToAbort)
      }
      return {
        preview: {
          headline: t.abortHeadline,
          fields: [
            { label: 'Branch', value: status.branch ?? '?' },
            { label: t.conflictedFiles(conflicted.length), value: formatFileList(conflicted) }
          ],
          warning: t.abortWarning
        },
        resolvedArgs: a
      }
    }

    case 'commit': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      if (status.entries.some(isConflicted)) {
        throw new Error(t.unresolvedConflicts)
      }
      // Before the approval card, so the model hears it and can offer
      // create_branch instead of the user approving a commit that cannot land.
      const block = await directPushBlock(status)
      if (block) {
        const { branch, rules } = block
        throw new Error(getT().stores.protectedBranchBlocked(branch, rules.requiresPullRequest, (rules.requiredChecks ?? []).join(', ')))
      }

      const staged: StatusEntry[] = []
      const unstaged: StatusEntry[] = []
      for (const entry of status.entries) {
        if (entry.index !== ' ' && entry.index !== '?') staged.push(entry)
        else unstaged.push(entry)
      }

      const autoStage = staged.length === 0
      const filesToShow = autoStage ? unstaged : staged
      if (filesToShow.length === 0) throw new Error(t.nothingToCommit)

      const { settings, apiKey } = await getActiveAiConfig()

      const diff = autoStage ? await window.api.git.diffUnstagedAll(repoPath) : await window.api.git.diffStagedAll(repoPath)
      const statusText = filesToShow.map((e) => `${e.index}${e.worktree} ${e.path}`).join('\n')
      const suggestion = await generateCommitMessage(settings, apiKey, status.branch ?? '?', statusText, diff)
      if (!suggestion.summary) throw new Error(t.aiNoCommitMessage)

      const filesLabel = autoStage ? t.filesToStage(filesToShow.length) : t.stagedFiles(filesToShow.length)

      return {
        preview: {
          headline: autoStage ? t.stageCommitHeadline : t.commitStagedHeadline,
          fields: [
            { label: 'Branch', value: status.branch ?? '?' },
            { label: filesLabel, value: formatFileList(filesToShow.map((f) => f.path)) },
            { label: t.messageSummary, value: suggestion.summary },
            { label: t.description, value: suggestion.description || t.emptyFeminine }
          ],
          warning: autoStage ? t.autoStageWarning : undefined
        },
        resolvedArgs: { summary: suggestion.summary, description: suggestion.description, auto_stage: autoStage ? 'true' : 'false' }
      }
    }

    case 'undo_last_commit': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      if (status.mergeInProgress || status.entries.some(isConflicted)) {
        throw new Error(t.mergeInProgressUndo)
      }
      const [last] = await window.api.git.log(repoPath, 1)
      if (!last) throw new Error(t.noCommitsYet)
      // Already on a remote (tracked or not): undoing it would need a force push,
      // and there is deliberately no force-push tool — refuse instead of
      // stranding the user. Execute re-checks this in the main process.
      if (await window.api.git.isCommitPublished(repoPath, last.hash)) {
        throw new Error(t.commitPublished(status.upstream ?? null))
      }
      const files = await window.api.git.commitFiles(last.hash, repoPath)

      return {
        preview: {
          headline: t.undoHeadline(last.shortHash),
          fields: [
            { label: 'Branch', value: status.branch ?? '?' },
            { label: 'Commit', value: `${last.shortHash} — ${last.summary}` },
            { label: t.commitFiles(files.length), value: formatFileList(files.map((f) => effectivePath(f.path))) },
            { label: t.command, value: formatCommands(['git reset --soft HEAD~1']) }
          ],
          warning: t.undoWarning
        },
        resolvedArgs: { hash: last.hash }
      }
    }

    case 'ignore_files': {
      const repoPath = await requireCurrentRepo()
      const requested = parsePathList(a.paths ?? '')
      if (requested.length === 0) throw new Error(t.paramRequired('paths'))

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
          throw new Error(t.alreadyIgnored(path))
        }
        toUntrack.push(...matches.filter((m) => !untracked.has(m)))
      }
      const distinctUntrack = [...new Set(toUntrack)]

      return {
        preview: {
          headline: t.ignoreHeadline,
          fields: [
            { label: t.addToGitignore, value: formatFileList(requested) },
            {
              label: t.untrackCount(distinctUntrack.length),
              value: distinctUntrack.length > 0 ? formatFileList(distinctUntrack) : t.untrackNone
            },
            {
              label: t.commands,
              value: formatCommands([
                ...requested.map((p) => `echo ${p} >> .gitignore`),
                ...(distinctUntrack.length > 0 ? [`git rm --cached -f -- ${distinctUntrack.map(quoteArg).join(' ')}`] : []),
                'git add .gitignore'
              ])
            }
          ],
          warning: t.ignoreWarning
        },
        resolvedArgs: { patterns: requested.join('\n'), untrack: distinctUntrack.join('\n') }
      }
    }

    case 'resolve_conflict': {
      const repoPath = await requireCurrentRepo()
      const status = await window.api.git.status(repoPath)
      const conflicted = status.entries.filter(isConflicted)
      if (conflicted.length === 0) throw new Error(t.noConflicts)

      let path = a.path
      if (!path) {
        if (conflicted.length > 1) {
          throw new Error(t.specifyConflict(conflicted.length, conflicted.map((e) => e.path).join(', ')))
        }
        path = conflicted[0].path
      } else if (!conflicted.some((e) => e.path === path)) {
        throw new Error(t.notConflicted(path))
      }

      const content = await window.api.fs.readRepoFile(repoPath, path)
      // Binary guard: readRepoFile always decodes as utf-8, so a real binary
      // file yields garbled text rather than throwing — NUL bytes are the
      // same heuristic git itself uses to call a file "binary".
      if (content.includes('\u0000')) {
        throw new Error(t.binaryConflict(path))
      }

      const blocks = parseConflictBlocks(content)
      const conflictBlocks = blocks.filter((b): b is ConflictBlock => b.type === 'conflict')
      if (conflictBlocks.length === 0) {
        throw new Error(t.noTextMarkers(path))
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
          d?.choice === 'ours' ? b.oursLabel : d?.choice === 'theirs' ? b.theirsLabel : d?.choice === 'both' ? `${b.oursLabel} + ${b.theirsLabel}` : t.custom
        return `#${b.id}: ${label}`
      })

      const truncated = resolvedContent.length > settings.maxDiffChars
      const warning = t.resolveWarning + (truncated ? t.truncatedPreview : '')

      return {
        preview: {
          headline: t.resolveHeadline(path),
          fields: [
            { label: t.file, value: path },
            { label: t.conflictBlocks(conflictBlocks.length), value: decisionLines.join('\n') },
            { label: t.aiSummary, value: suggestion.summary },
            { label: t.proposedContent, value: '```\n' + truncate(resolvedContent, settings.maxDiffChars) + '\n```' }
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
          headline: t.checkIncomingHeadline,
          fields: [
            { label: 'Branch', value: status.branch ?? '?' },
            { label: t.operation, value: t.dryRunNote }
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
          headline: t.identityHeadline,
          fields: [
            { label: t.nameLocal, value: identity.local.name ?? t.notConfigured },
            { label: t.emailLocal, value: identity.local.email ?? t.notConfigured },
            { label: t.nameGlobal, value: identity.global.name ?? t.notConfigured },
            { label: t.emailGlobal, value: identity.global.email ?? t.notConfigured }
          ]
        },
        resolvedArgs: a
      }
    }

    case 'set_git_identity': {
      const scope = a.scope
      if (scope !== 'local' && scope !== 'global') throw new Error(t.scopeInvalid)
      if (!a.name && !a.email) throw new Error(t.nameOrEmailRequired)
      const repoPath = await requireCurrentRepo()
      const identity = await window.api.git.getIdentity(repoPath)
      const current = identity[scope]
      const fields: ToolPreview['fields'] = []
      if (a.name) fields.push({ label: t.name, value: `${current.name ?? t.notConfigured} → ${a.name}` })
      if (a.email) fields.push({ label: 'Email', value: `${current.email ?? t.notConfigured} → ${a.email}` })
      fields.push({ label: t.scope, value: scope === 'local' ? t.scopeLocal : t.scopeGlobal })
      return {
        preview: {
          headline: t.setIdentityHeadline,
          fields,
          warning: scope === 'global' ? t.globalWarning : t.localWarning
        },
        resolvedArgs: a
      }
    }

    case 'list_files':
      return {
        preview: {
          headline: a.pattern ? t.listFilesPattern(a.pattern) : t.listFilesAll,
          fields: []
        },
        resolvedArgs: a
      }

    case 'read_file': {
      if (!a.path) throw new Error(t.paramRequired('path'))
      const range = a.start_line || a.end_line ? t.lineRange(a.start_line || '1', a.end_line || t.endOfFile) : t.wholeFile
      return {
        preview: { headline: t.readHeadline(a.path), fields: [{ label: t.excerpt, value: range }] },
        resolvedArgs: a
      }
    }

    case 'read_changes': {
      const scope = a.scope ?? 'all'
      if (!['unstaged', 'staged', 'all'].includes(scope)) {
        throw new Error(t.readChangesScopeInvalid)
      }
      return {
        preview: {
          headline: a.path ? t.changesIn(a.path) : t.uncommittedChanges,
          fields: [{ label: t.scope, value: scope }]
        },
        resolvedArgs: { ...a, scope }
      }
    }

    case 'list_all_repos':
      return { preview: { headline: t.listReposHeadline, fields: [] }, resolvedArgs: a }

    case 'list_branches':
      return {
        preview: {
          headline: t.listBranchesHeadline,
          fields: a.include_remote === 'true' ? [{ label: t.includeRemote, value: t.yes }] : []
        },
        resolvedArgs: a
      }

    case 'list_branches_all_repos':
      return { preview: { headline: t.listBranchesAllHeadline, fields: [] }, resolvedArgs: a }

    case 'list_unmerged_branches':
      return {
        preview: {
          headline: t.unmergedHeadline,
          fields: [{ label: t.integrationBase, value: a.base_branch || t.remoteDefaultBranch }]
        },
        resolvedArgs: a
      }

    case 'delete_merged_branches': {
      const requested = parseBranchList(a.branch_names ?? '')
      if (requested.length === 0) throw new Error(t.paramRequired('branch_names'))
      const repoPath = await requireCurrentRepo()
      const report = await window.api.git.branchIntegration(repoPath, a.base_branch || undefined)
      const local = new Map(report.branches.filter((b) => !b.remoteOnly).map((b) => [b.name, b]))
      const protectedNames = new Set(report.protectedNames)

      // All or nothing: the card must list exactly what was asked, so one bad
      // name refuses the call instead of silently shrinking the list. The
      // main process repeats these checks right before deleting.
      const refused: string[] = []
      for (const name of requested) {
        const info = local.get(name)
        if (protectedNames.has(name.toLowerCase())) refused.push(t.refuseProtected(name))
        else if (!info) refused.push(t.refuseNotLocal(name))
        else if (info.isCurrent) refused.push(t.refuseCurrent(name))
        else if (info.state === 'unmerged') refused.push(t.refuseUnmerged(name, info.ahead, report.base))
      }
      if (refused.length > 0) throw new Error(t.deleteRefused(refused.join('\n')))

      const describe = (name: string): string => {
        const b = local.get(name)!
        return b.state === 'equivalent' ? `• ${name} — ${t.equivalentIn(b.equivalentCommit ?? '?')}` : `• ${name} — ${t.stateMerged}`
      }
      return {
        preview: {
          headline: t.deleteBranchesHeadline(requested.length),
          fields: [
            { label: t.integrationBase, value: report.base },
            { label: t.branchesToDelete(requested.length), value: requested.map(describe).join('\n') },
            { label: t.commands, value: formatCommands(requested.map((n) => `git branch -D ${quoteArg(n)}`)) }
          ],
          warning: t.deleteBranchesWarning
        },
        // Pin the base the card showed, so execute verifies against the same one.
        resolvedArgs: { branch_names: requested.join('\n'), base_branch: report.base }
      }
    }

    case 'check_all_repos':
      return { preview: { headline: t.checkAllHeadline, fields: [] }, resolvedArgs: a }

    case 'fetch_all':
      return { preview: { headline: t.fetchAllHeadline, fields: [] }, resolvedArgs: a }

    case 'pull_repo': {
      if (!a.repo_path) throw new Error(t.paramRequired('repo_path'))
      return { preview: { headline: t.pullRepoHeadline(a.repo_path), fields: [] }, resolvedArgs: a }
    }

    case 'pull_all':
      return {
        preview: {
          headline: t.pullAllHeadline,
          fields: [],
          warning: t.pullAllWarning
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
      if (setUpstream) info = t.noUpstreamPush
      else if (status.ahead === 0) {
        info = t.nothingToPush
        warning = t.nothingToPushWarning
      } else {
        info = t.commitsAhead(status.ahead)
        if (status.behind > 0) {
          warning = t.behindWarning(status.behind)
        }
      }

      return {
        preview: {
          headline: setUpstream ? t.publishHeadline(branch) : t.pushHeadline(branch),
          fields: [
            { label: 'Branch', value: branch },
            { label: t.status, value: info }
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
        info = t.pullNoUpstream
        warning = t.pullNoUpstreamWarning
      } else if (status.behind === 0) {
        info = t.upToDate
        warning = t.nothingToPull
      } else {
        info = t.newCommits(status.behind)
        if (localChanges > 0) {
          warning = t.pullDirtyWarning(localChanges)
        }
      }

      return {
        preview: { headline: t.pullHeadline(branch), fields: [{ label: t.status, value: info }], warning },
        resolvedArgs: a
      }
    }

    case 'switch_branch': {
      const target = a.branch_name
      if (!target) throw new Error(t.paramRequired('branch_name'))
      const repoPath = await requireCurrentRepo()
      const [status, branches] = await Promise.all([window.api.git.status(repoPath), window.api.git.branches(repoPath)])
      const current = status.branch ?? '?'
      if (current.toLowerCase() === target.toLowerCase()) throw new Error(t.alreadyOnBranch(target))
      if (!branches.some((b) => b.name.toLowerCase() === target.toLowerCase())) {
        throw new Error(t.branchNotLocal(target))
      }

      return {
        preview: {
          headline: t.switchHeadline(target),
          fields: [{ label: t.currentBranch, value: current }],
          warning: status.entries.length > 0 ? t.switchDirtyWarning(status.entries.length) : undefined
        },
        resolvedArgs: a
      }
    }

    case 'stash':
      return {
        preview: { headline: t.stashHeadline, fields: a.message ? [{ label: t.message, value: a.message }] : [] },
        resolvedArgs: a
      }

    case 'stash_pop':
      return {
        preview: { headline: t.stashPopHeadline, fields: a.stash_ref ? [{ label: 'Ref', value: a.stash_ref }] : [] },
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
  const t = getT().tools
  const fmt = getFmt()

  switch (call.name) {
    case 'create_branch': {
      await repo.createBranch(a.branch_name, a.checkout !== 'false', a.from_branch || undefined)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? t.createBranchFailed)
      return t.branchCreated(a.branch_name)
    }

    case 'create_pull_request': {
      const ok = await pr.createPullRequest({
        title: a.title,
        body: a.body ?? '',
        head: a.head_branch,
        base: a.base_branch,
        draft: a.draft === 'true'
      })
      if (!ok) throw new Error(usePullRequestStore.getState().error ?? t.createPrFailed)
      return t.prCreated(a.title)
    }

    case 'list_pull_requests': {
      if (a.state) pr.setStateFilter(a.state as 'open' | 'closed' | 'all')
      await pr.refreshPullRequests()
      let list = usePullRequestStore.getState().pullRequests
      if (a.head_branch) list = list.filter((p) => p.headRef === a.head_branch)
      if (list.length === 0) return t.noPrsFound
      return list.map((p) => `#${p.number} [${p.draft ? 'draft' : p.state}] ${p.title} (${p.headRef} -> ${p.baseRef})`).join('\n')
    }

    case 'read_pull_request': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      const prData = await window.api.github.getPullRequest(host, owner, repoName, number)
      const lines = [
        `PR #${prData.number} [${prData.draft ? 'draft' : prData.state}]`,
        t.titleLine(prData.title),
        t.authorLine(prData.authorLogin),
        `Head -> Base: ${prData.headRef} -> ${prData.baseRef}`,
        `URL: ${prData.htmlUrl}`,
        '',
        t.descriptionHeader,
        prData.body ? truncate(prData.body.trim(), 2000) : t.noDescription
      ]

      if (a.include_files !== 'false') {
        const files = await window.api.github.listPullRequestFiles(host, owner, repoName, number)
        const includeDiffs = a.include_diffs === 'true'
        lines.push('', t.changedFilesHeader(files.length))
        const shown = files.slice(0, includeDiffs ? 15 : 40)
        for (const f of shown) {
          lines.push(`- ${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`)
          if (includeDiffs && f.patch) lines.push('```diff\n' + truncate(f.patch, 3000) + '\n```')
        }
        if (files.length > shown.length) lines.push(t.moreFilesSentence(files.length - shown.length))
      }

      if (a.include_comments !== 'false') {
        const comments = await window.api.github.listPullRequestComments(host, owner, repoName, number)
        lines.push('', t.commentsHeader(comments.length))
        for (const c of comments.slice(0, 20)) lines.push(`- ${c.authorLogin}: ${truncate(c.body.replace(/\s+/g, ' ').trim(), 220)}`)
        if (comments.length > 20) lines.push(t.moreComments(comments.length - 20))
      }

      return lines.join('\n')
    }

    case 'check_pull_request_status': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const status = await window.api.github.getPullRequestStatus(host, owner, repoName, Number(a.pull_request_number))
      return formatPullRequestStatus(status, t)
    }

    case 'read_commit': {
      const repoPath = await requireCurrentRepo()
      const ref = a.ref || 'HEAD'
      const details = await window.api.git.commitDetails(repoPath, ref)
      if (!details) throw new Error(t.commitNotFound(ref))

      const lines = [
        `Commit: ${details.hash}`,
        t.authorLine(`${details.authorName} <${details.authorEmail}>`),
        t.dateLine(details.date),
        details.parents.length > 1 ? t.mergeCommitLine(details.parents.join(', ')) : '',
        '',
        t.messageHeader,
        details.summary,
        details.body
      ].filter((l) => l !== '')

      const path = a.path || undefined

      if (a.include_files !== 'false') {
        const files = await window.api.git.commitFiles(details.hash, repoPath)
        if (path) {
          const entry = files.find((f) => effectivePath(f.path) === path)
          lines.push('', t.fileReadHeader(files.length), `- ${entry?.status ?? '?'} ${path}`)
        } else {
          lines.push('', t.changedFilesHeader(files.length))
          const shown = files.slice(0, 60)
          for (const f of shown) lines.push(`- ${f.status} ${f.path}`)
          if (files.length > shown.length) lines.push(t.moreFilesSentence(files.length - shown.length))
        }
      }

      if (a.include_diff === 'true') {
        const { settings } = await getActiveAiConfig()
        const patch = path ? await window.api.git.commitDiff(details.hash, path, repoPath) : await window.api.git.commitPatch(repoPath, details.hash)
        if (!patch.trim()) {
          // With a resolved path the file is definitely in the commit, so an
          // empty patch means binary content or a mode-only change.
          const empty = path ? t.noTextDiff(path) : t.noDiff
          lines.push('', details.parents.length > 1 ? t.mergeNoDiff : empty)
        } else {
          lines.push('', '```diff', truncate(patch, settings.maxDiffChars), '```')
          // A bare "…" inside the fence is invisible to the model — it then
          // burns a turn re-reading the commit with everything switched off.
          // Say what was cut and how to get the rest.
          if (patch.length > settings.maxDiffChars) {
            const cut = t.diffTruncated(fmt.number(settings.maxDiffChars), fmt.number(patch.length))
            lines.push('', path ? `${cut} ${t.truncatedFileHint}` : `${cut} ${t.truncatedCommitHint}`)
            if (!path) {
              const missing = await listFilesBeyondTruncation(repoPath, details.hash, patch.slice(0, settings.maxDiffChars))
              if (missing.length > 0) lines.push(t.filesOutside(missing.length), formatFileList(missing, 60))
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
      if (commits.length === 0) return t.noCommitsInRepo
      return commits.map((c) => `${c.shortHash}  ${c.date}  ${c.authorName}  ${c.summary}`).join('\n')
    }

    case 'merge_pull_request': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      const method = (a.merge_method as 'merge' | 'squash' | 'rebase' | undefined) ?? 'merge'
      await window.api.github.mergePullRequest(host, owner, repoName, number, method, a.commit_title || undefined, a.commit_message || undefined)
      return t.prMergedOk(number)
    }

    case 'review_pull_request': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      const event = a.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
      // commit_id was resolved to the PR head SHA during prepare.
      await window.api.github.submitPullRequestReview(host, owner, repoName, number, event, a.body ?? '', a.commit_id)
      return t.prReviewed(number, event)
    }

    case 'comment_pull_request': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      await window.api.github.addPullRequestComment(host, owner, repoName, number, a.body)
      return t.prCommented(number)
    }

    case 'set_pull_request_state': {
      const { host, owner, repo: repoName } = requireGitHubRemote()
      const number = Number(a.pull_request_number)
      const state = a.state as 'open' | 'closed'
      await window.api.github.setPullRequestState(host, owner, repoName, number, state)
      return t.prStateChanged(number, state === 'closed')
    }

    case 'merge_branch': {
      await repo.mergeBranch(a.source_branch)
      const mergeError = useRepoStore.getState().error
      return mergeError ? t.mergeProblems(mergeError) : t.branchMerged(a.source_branch)
    }

    case 'merge_abort': {
      await repo.abortMerge()
      const error = useRepoStore.getState().error
      if (error) throw new Error(error)
      return t.mergeAborted
    }

    case 'commit': {
      if (a.auto_stage === 'true') {
        const repoPath = await requireCurrentRepo()
        const status = await window.api.git.status(repoPath)
        const unstagedPaths = status.entries.filter((e) => e.index === ' ' || e.index === '?').map((e) => e.path)
        await repo.stagePaths(unstagedPaths)
        if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? t.stageFailed)
      }
      await repo.commitChanges(a.summary, a.description ?? '')
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? t.commitFailed)
      return t.commitCreated(a.summary)
    }

    case 'undo_last_commit': {
      // The approval showed a specific unpublished commit. The main process
      // re-checks both right before the reset, so a HEAD move or a push while
      // the card was open makes it refuse instead of rewriting published history.
      const repoPath = await requireCurrentRepo()
      const [last] = await window.api.git.log(repoPath, 1)
      await repo.undoLastCommit(a.hash)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? t.undoFailed)
      if (!last) return t.commitUndone
      return t.commitUndoneWith(last.shortHash, last.summary)
    }

    case 'ignore_files': {
      const patterns = parsePathList(a.patterns ?? '')
      const untrack = parsePathList(a.untrack ?? '')
      await repo.ignorePatterns(patterns, untrack, untrack.length > 0)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? t.ignoreFailed)
      // After an undo the stage is rarely empty, and `commit` then takes only
      // what is staged — without this the rule would miss the fix commit.
      await repo.stagePaths(['.gitignore'])
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? t.stageGitignoreFailed)
      const untrackedNote = untrack.length > 0 ? t.untrackedNote(untrack.length) : ''
      return t.addedToGitignore(patterns.join(', '), untrackedNote)
    }

    case 'resolve_conflict': {
      await repo.resolveConflict(a.path, a.resolved_content)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? t.resolveFailed)
      return t.conflictResolved(a.path)
    }

    case 'check_incoming_commits': {
      const repoPath = await requireCurrentRepo()
      const result = await window.api.git.fetchDryRun(repoPath)
      const output = (result.stderr + result.stdout).trim()
      return output ? output : t.noIncoming
    }

    case 'get_git_identity': {
      const repoPath = await requireCurrentRepo()
      const identity = await window.api.git.getIdentity(repoPath)
      return [
        t.identityLine('Local', identity.local.name ?? t.notConfigured, identity.local.email ?? t.notConfigured),
        t.identityLine('Global', identity.global.name ?? t.notConfigured, identity.global.email ?? t.notConfigured)
      ].join('\n')
    }

    case 'set_git_identity': {
      const scope = a.scope as 'local' | 'global'
      const repoPath = await requireCurrentRepo()
      await window.api.git.setIdentity(repoPath, scope, { name: a.name, email: a.email })
      const parts = [a.name ? t.nameField(a.name) : null, a.email ? `email="${a.email}"` : null].filter(Boolean)
      return t.identityUpdated(scope, parts.join(', '))
    }

    case 'list_files': {
      const repoPath = await requireCurrentRepo()
      const files = await window.api.git.listFiles(repoPath, a.pattern)
      if (files.length === 0) {
        return a.pattern ? t.noFilesMatch(a.pattern) : t.noReadableFiles
      }
      const header = t.filesHeader(files.length, a.pattern)
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
        if (/ENOENT|não encontrado|no encontrado|not found|no such file/i.test(message)) {
          const base = a.path.split(/[/\\]/).pop() ?? a.path
          const similar = await window.api.git.listFiles(repoPath, `*${base}*`).catch(() => [])
          throw new Error(
            similar.length > 0
              ? t.pathMissingSimilar(a.path, formatFileList(similar, 20))
              : t.pathMissing(a.path)
          )
        }
        throw err
      }

      const allLines = content.split('\n')
      const total = allLines.length
      const start = Math.max(1, Number(a.start_line) || 1)
      const end = Math.min(total, Number(a.end_line) || total)
      if (start > total) throw new Error(t.fileTooShort(a.path, total))
      // Otherwise slice() returns nothing and the model gets an empty code
      // block labelled with an impossible range instead of a usable error.
      if (end < start) {
        throw new Error(t.invalidRange(end, start))
      }

      const slice = allLines.slice(start - 1, end)
      const width = String(end).length
      const numbered = slice.map((line, i) => `${String(start + i).padStart(width)} | ${line}`).join('\n')

      const body = truncate(numbered, settings.maxDiffChars)
      const lines = [t.fileLines(a.path, start, end, total), '```', body, '```']
      if (numbered.length > settings.maxDiffChars) {
        lines.push(t.contentTruncated(fmt.number(settings.maxDiffChars)))
      } else if (end < total) {
        lines.push(t.fileContinues(total))
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
      if (scope === 'staged' || scope === 'all') sections.push({ label: t.staged, diff: await diffFor(true) })
      if (scope === 'unstaged' || scope === 'all') sections.push({ label: t.notStaged, diff: await diffFor(false) })

      const nonEmpty = sections.filter((s) => s.diff.trim())
      if (nonEmpty.length === 0) {
        return a.path ? t.noChangesIn(a.path) : t.noChanges
      }

      // The budget is shared, so one huge section cannot starve the other.
      const budget = Math.floor(settings.maxDiffChars / nonEmpty.length)
      const out: string[] = []
      for (const section of nonEmpty) {
        out.push(`--- ${section.label} ---`, '```diff', truncate(section.diff, budget), '```')
        if (section.diff.length > budget) {
          out.push(t.diffTruncatedPath(fmt.number(budget), fmt.number(section.diff.length)))
        }
      }
      return out.join('\n')
    }

    case 'list_all_repos': {
      const repos = useRepoStore.getState().recentRepos
      if (repos.length === 0) return t.noRecentRepos
      return repos.map((r) => `${r.name} — ${r.path}`).join('\n')
    }

    case 'list_branches': {
      await repo.refreshBranches()
      const lines = useRepoStore.getState().branches.map((b) => `${b.isCurrent ? '* ' : '  '}${b.name}`)
      if (a.include_remote === 'true') {
        const remote = await window.api.git.remoteBranches(await requireCurrentRepo())
        lines.push('', t.remoteOnly(remote.length), ...remote.map((r) => `  ${r}`))
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
          lines.push(t.repoError(r.name, err instanceof Error ? err.message : String(err)))
        }
      }
      return lines.join('\n')
    }

    case 'list_unmerged_branches': {
      const report = await window.api.git.branchIntegration(await requireCurrentRepo(), a.base_branch || undefined)
      return formatIntegrationReport(report)
    }

    case 'delete_merged_branches': {
      const repoPath = await requireCurrentRepo()
      const results = await window.api.git.deleteIntegratedBranches(repoPath, parseBranchList(a.branch_names ?? ''), a.base_branch || undefined)
      await repo.refreshBranches()
      const lines = results.map((r) =>
        r.deleted ? t.branchDeletedLine(r.name, r.tip ?? '?') : t.branchNotDeletedLine(r.name, r.reason ?? t.unknownReason)
      )
      if (!results.some((r) => r.deleted)) throw new Error(lines.join('\n'))
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
            lines.push(t.remoteUpdates(r.name, output))
            continue
          }
          const status = await window.api.git.status(r.path)
          lines.push(
            status.behind > 0 ? t.repoBehind(r.name, status.behind) : t.repoUpToDate(r.name)
          )
        } catch (err) {
          lines.push(t.repoError(r.name, err instanceof Error ? err.message : String(err)))
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
          lines.push(t.repoError(r.name, err instanceof Error ? err.message : String(err)))
        }
      }
      return lines.join('\n')
    }

    case 'pull_repo': {
      const result = await window.api.git.pull(a.repo_path)
      if (result.exitCode !== 0) throw new Error(result.stderr.trim() || t.pullFailed)
      return t.pullDoneIn(a.repo_path)
    }

    case 'pull_all': {
      const repos = useRepoStore.getState().recentRepos
      const lines: string[] = []
      for (const r of repos) {
        try {
          await window.api.git.fetch(r.path)
          const status = await window.api.git.status(r.path)
          if (status.behind === 0) {
            lines.push(t.repoAlreadyUpToDate(r.name))
            continue
          }
          const result = await window.api.git.pull(r.path)
          lines.push(result.exitCode === 0 ? `${r.name}: pull ok` : t.repoPullFailed(r.name, result.stderr.trim()))
        } catch (err) {
          lines.push(t.repoError(r.name, err instanceof Error ? err.message : String(err)))
        }
      }
      return lines.length > 0 ? lines.join('\n') : t.noRecentRepos
    }

    case 'push': {
      const repoPath = await requireCurrentRepo()
      await window.api.git.push(repoPath, a.branch, a.set_upstream === 'true')
      await repo.refreshStatus()
      return a.set_upstream === 'true' ? t.branchPublished(a.branch) : t.pushDone(a.branch)
    }

    case 'pull': {
      const repoPath = await requireCurrentRepo()
      const result = await window.api.git.pull(repoPath)
      await Promise.all([repo.refreshStatus(), repo.refreshLog()])
      if (result.exitCode !== 0) {
        const hasConflicts = useRepoStore.getState().status?.entries.some(isConflicted)
        if (hasConflicts) return t.pullConflicts
        throw new Error(result.stderr.trim() || t.pullFailed)
      }
      return t.pullDone
    }

    case 'switch_branch':
      // Not interactive: the AI gets the refusal as an error instead of a dialog popping up.
      if (!(await repo.switchBranch(a.branch_name, { interactive: false }))) {
        throw new Error(useRepoStore.getState().error ?? t.switchFailed)
      }
      return t.switchedTo(a.branch_name)

    case 'stash':
      await repo.pushStash(a.message ?? '')
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? t.stashFailed)
      return t.stashed

    case 'stash_pop': {
      const ref = a.stash_ref || useRepoStore.getState().stashes[0]?.ref
      if (!ref) return t.noStash
      await repo.popStash(ref)
      if (useRepoStore.getState().error) throw new Error(useRepoStore.getState().error ?? t.stashPopFailed)
      return t.stashPopped(ref)
    }

    default:
      return t.unknownTool(call.name)
  }
}
