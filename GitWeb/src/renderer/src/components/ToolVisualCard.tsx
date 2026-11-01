import { Fragment } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Cloud,
  FileCode2,
  GitBranch,
  GitMerge,
  LocateFixed,
  MessageSquare,
  Tag,
  XCircle
} from 'lucide-react'
import type { CommitSummary, RebaseStep } from '../../../shared/git'
import type { ToolVisual } from '../lib/ai/toolVisuals'
import { releaseGroup, type ReleaseGroup } from '../lib/ai/toolVisuals'
import { relativeTime } from '../lib/relativeTime'
import { useLocale, useT } from '../lib/i18n'
import { useRepoStore } from '../store/repoStore'
import RefChips from './RefChips'

/** Authorship shares by rank: hues far apart on the wheel, so neighbours never blend. */
export const AUTHOR_LANES = [0, 2, 1, 3, 5, 6, 4, 7]

function hashColor(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h) % 8
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function Avatar({ name, size = 22 }: { name: string; size?: number }): JSX.Element {
  const color = `var(--graph-${hashColor(name)})`
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
      style={{
        width: size,
        height: size,
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)`
      }}
    >
      {initials(name)}
    </span>
  )
}

/** "+12 −3" with a two-tone bar scaled against the largest change in the set. */
function PlusMinus({ additions, deletions, max }: { additions: number; deletions: number; max: number }): JSX.Element {
  const total = additions + deletions
  const scale = max > 0 ? Math.max(0.08, Math.min(1, total / max)) : 0
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums">
      <span className="text-success-green">+{additions}</span>
      <span className="text-danger-red">−{deletions}</span>
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-pill bg-default-border @[26rem]:flex" aria-hidden>
        {total > 0 && (
          <span className="flex h-full" style={{ width: `${scale * 100}%` }}>
            <span className="h-full bg-success-green" style={{ width: `${(additions / total) * 100}%` }} />
            <span className="h-full bg-danger-red" style={{ width: `${(deletions / total) * 100}%` }} />
          </span>
        )}
      </span>
    </span>
  )
}

function ShowInHistoryButton({ hash }: { hash: string }): JSX.Element {
  const focus = useRepoStore((s) => s.focusCommitInHistory)
  const t = useT().graph
  return (
    <button
      type="button"
      onClick={() => void focus(hash)}
      title={t.openInHistory}
      aria-label={t.openInHistory}
      className="hit-area shrink-0 rounded-sm p-1 text-tertiary-text opacity-0 transition-opacity duration-100 group-hover/vrow:opacity-100 hover:bg-hover-overlay hover:text-command-blue focus-visible:opacity-100"
    >
      <LocateFixed size={13} aria-hidden />
    </button>
  )
}

function CommitRow({
  commit,
  right,
  local
}: {
  commit: CommitSummary
  right?: JSX.Element
  local?: boolean
}): JSX.Element {
  const locale = useLocale()
  const t = useT().graph
  return (
    <li className="group/vrow flex min-w-0 items-center gap-2 rounded-sm px-1 py-1 hover:bg-hover-overlay">
      <span className="hidden @[20rem]:flex">
        <Avatar name={commit.authorName} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-caption font-medium text-primary-text" title={commit.summary}>
          {commit.summary}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[11px] text-tertiary-text">
          <span className="truncate">{commit.authorName}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{relativeTime(locale, commit.date)}</span>
          <span className="hidden shrink-0 @[24rem]:inline" aria-hidden>
            ·
          </span>
          <span className="hidden shrink-0 font-mono @[24rem]:inline">{commit.shortHash}</span>
          {local && (
            <span className="ml-0.5 shrink-0 rounded-pill bg-attention-orange-soft px-1.5 text-[10px] text-attention-orange" title={t.localOnly}>
              local
            </span>
          )}
        </span>
      </span>
      {right}
      <ShowInHistoryButton hash={commit.hash} />
    </li>
  )
}

function Frame({ children, className = '' }: { children: React.ReactNode; className?: string }): JSX.Element {
  return <div className={`@container min-w-0 rounded-md border border-default-border bg-midnight-base p-2 ${className}`}>{children}</div>
}

function CommitsCard({ visual }: { visual: Extract<ToolVisual, { kind: 'commits' }> }): JSX.Element {
  const max = Math.max(1, ...visual.commits.map((c) => c.additions + c.deletions))
  const local = new Set(visual.localOnly)
  const shown = visual.commits.slice(0, 10)
  const t = useT().graph
  return (
    <Frame>
      <ul className="flex flex-col">
        {shown.map((c) => (
          <CommitRow
            key={c.hash}
            commit={c}
            local={local.has(c.hash)}
            right={<PlusMinus additions={c.additions} deletions={c.deletions} max={max} />}
          />
        ))}
      </ul>
      {visual.commits.length > shown.length && (
        <p className="px-1.5 pt-1 text-[11px] text-tertiary-text">{t.flowMore(visual.commits.length - shown.length)}</p>
      )}
    </Frame>
  )
}

function CommitCard({ visual }: { visual: Extract<ToolVisual, { kind: 'commit' }> }): JSX.Element {
  const t = useT().graph
  const locale = useLocale()
  const focus = useRepoStore((s) => s.focusCommitInHistory)
  const additions = visual.files.reduce((n, f) => n + f.additions, 0)
  const deletions = visual.files.reduce((n, f) => n + f.deletions, 0)
  const max = Math.max(1, ...visual.files.map((f) => f.additions + f.deletions))
  const files = [...visual.files].sort((a, b) => Number(b.path === visual.focusPath) - Number(a.path === visual.focusPath))
  const shown = files.slice(0, 8)
  const { commit } = visual
  return (
    <Frame className="p-3">
      <div className="flex items-start gap-2.5">
        <Avatar name={commit.authorName} size={28} />
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium leading-snug text-primary-text [overflow-wrap:anywhere]">{commit.summary}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] text-tertiary-text">
            <span>{commit.authorName}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(locale, commit.date)}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">{commit.shortHash}</span>
            {commit.parents.length > 1 && (
              <span className="flex items-center gap-0.5 text-secondary-text">
                <GitMerge size={11} aria-hidden /> merge
              </span>
            )}
          </p>
        </div>
        <button type="button" onClick={() => void focus(commit.hash)} className="btn-ghost h-7 shrink-0 gap-1 px-2 text-caption">
          <LocateFixed size={12} aria-hidden /> <span className="hidden @[24rem]:inline">{t.openInHistory}</span>
        </button>
      </div>
      {visual.files.length > 0 && (
        <>
          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-secondary-text">
            <span>{t.files(visual.files.length)}</span>
            <PlusMinus additions={additions} deletions={deletions} max={additions + deletions} />
          </div>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {shown.map((f) => (
              <li
                key={f.path}
                className={`flex min-w-0 items-center gap-2 rounded-sm px-1.5 py-0.5 ${f.path === visual.focusPath ? 'bg-command-blue-soft' : ''}`}
              >
                <span className="w-3 shrink-0 text-center font-mono text-[10px] text-tertiary-text">{f.status[0]}</span>
                <FileCode2 size={12} className="shrink-0 text-tertiary-text" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-caption text-primary-text" title={f.path}>
                  {f.path}
                </span>
                {f.binary ? (
                  <span className="text-[11px] text-tertiary-text">bin</span>
                ) : (
                  <PlusMinus additions={f.additions} deletions={f.deletions} max={max} />
                )}
              </li>
            ))}
          </ul>
          {files.length > shown.length && <p className="px-1.5 pt-1 text-[11px] text-tertiary-text">{t.flowMore(files.length - shown.length)}</p>}
        </>
      )}
    </Frame>
  )
}

function ReposCard({ visual }: { visual: Extract<ToolVisual, { kind: 'repos' }> }): JSX.Element {
  const t = useT().graph
  return (
    <div className="@container">
      <ul className="grid grid-cols-1 gap-1.5 @[26rem]:grid-cols-2">
        {visual.repos.map((r) => {
          const tone = r.error
            ? 'bg-danger-red'
            : r.incoming || r.behind > 0
              ? 'bg-command-blue'
              : r.dirty > 0
                ? 'bg-attention-orange'
                : 'bg-success-green'
          return (
            <li key={r.path} className="min-w-0 rounded-md border border-default-border bg-midnight-base px-2.5 py-2" title={r.path}>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={`size-2 shrink-0 rounded-full ${tone}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-caption font-medium text-primary-text">{r.name}</span>
              </div>
              {r.error ? (
                <p className="mt-1 truncate text-[11px] text-danger-red" title={r.error}>
                  {t.repoError}: {r.error}
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="flex max-w-[9rem] items-center gap-1 rounded-pill border border-default-border px-1.5 text-secondary-text">
                    <GitBranch size={10} className="shrink-0" aria-hidden />
                    <span className="truncate">{r.branch ?? t.noBranch}</span>
                  </span>
                  {r.ahead > 0 && (
                    <span className="flex items-center rounded-pill bg-command-blue-soft px-1.5 text-command-blue" title={t.aheadTitle(r.ahead)}>
                      <ArrowUp size={10} aria-hidden />
                      {r.ahead}
                    </span>
                  )}
                  {r.behind > 0 && (
                    <span className="flex items-center rounded-pill bg-command-blue-soft px-1.5 text-command-blue" title={t.behindTitle(r.behind)}>
                      <ArrowDown size={10} aria-hidden />
                      {r.behind}
                    </span>
                  )}
                  {r.incoming && (
                    <span className="flex items-center gap-0.5 rounded-pill bg-command-blue-soft px-1.5 text-command-blue">
                      <Cloud size={10} aria-hidden /> {t.incoming}
                    </span>
                  )}
                  {r.dirty > 0 ? (
                    <span className="rounded-pill bg-attention-orange-soft px-1.5 text-attention-orange">{t.dirty(r.dirty)}</span>
                  ) : (
                    !r.incoming && r.behind === 0 && <span className="rounded-pill bg-success-green-soft px-1.5 text-success-green">{t.clean}</span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const PASSED = new Set(['success', 'neutral', 'skipped'])

function PrStatusCard({ visual }: { visual: Extract<ToolVisual, { kind: 'prStatus' }> }): JSX.Element {
  const t = useT().graph
  const { pr, checks, reviews, requiredChecks, requiredApprovals } = visual.status
  const state = pr.merged ? 'merged' : pr.draft ? 'draft' : pr.state
  const required = new Set(requiredChecks ?? [])
  const stateTone =
    state === 'merged'
      ? 'bg-[color-mix(in_srgb,var(--graph-3)_18%,transparent)] text-[var(--graph-3)]'
      : state === 'closed'
        ? 'bg-danger-red-soft text-danger-red'
        : state === 'draft'
          ? 'bg-hover-overlay text-secondary-text'
          : 'bg-success-green-soft text-success-green'
  const ordered = [...checks].sort((a, b) => rank(a) - rank(b))
  function rank(c: (typeof checks)[number]): number {
    if (c.status !== 'completed') return 1
    return PASSED.has(c.conclusion ?? '') ? 2 : 0
  }
  const approvals = reviews.filter((r) => r.state === 'APPROVED').length
  return (
    <Frame className="p-3">
      <div className="flex min-w-0 items-start gap-2">
        <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium ${stateTone}`}>{t.prState[state] ?? state}</span>
        <span className="min-w-0 flex-1 text-caption font-medium text-primary-text [overflow-wrap:anywhere]">
          #{pr.number} {pr.title}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-tertiary-text">
        <span className="min-w-0 truncate font-mono" title={pr.headRef}>
          {pr.headRef}
        </span>
        <ArrowRight size={11} className="shrink-0" aria-hidden />
        <span className="max-w-[45%] shrink-0 truncate font-mono" title={pr.baseRef}>
          {pr.baseRef}
        </span>
      </p>
      <div className="mt-2.5">
        <p className="mb-1 text-label uppercase tracking-wide text-tertiary-text">{t.checksTitle}</p>
        {ordered.length === 0 ? (
          <p className="text-[11px] text-tertiary-text">—</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {ordered.slice(0, 10).map((c) => {
              const running = c.status !== 'completed'
              const ok = !running && PASSED.has(c.conclusion ?? '')
              return (
                <li key={c.name} className="flex min-w-0 items-center gap-1.5 text-caption">
                  {running ? (
                    <CircleDashed size={13} className="shrink-0 animate-spin text-warning-amber [animation-duration:2.4s]" aria-hidden />
                  ) : ok ? (
                    <CheckCircle2 size={13} className="shrink-0 text-success-green" aria-hidden />
                  ) : (
                    <XCircle size={13} className="shrink-0 text-danger-red" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate text-primary-text">{c.name}</span>
                  {required.has(c.name) && <span className="shrink-0 text-[10px] text-tertiary-text">{t.required}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-label uppercase tracking-wide text-tertiary-text">{t.reviewsTitle}</span>
        <span className="text-caption text-primary-text">
          {approvals}
          {requiredApprovals !== null ? ` / ${requiredApprovals}` : ''}
        </span>
        {reviews.slice(0, 6).map((r) => (
          <span
            key={r.authorLogin}
            className={`flex items-center gap-1 rounded-pill border px-1.5 text-[11px] ${
              r.state === 'APPROVED'
                ? 'border-success-green/40 text-success-green'
                : r.state === 'CHANGES_REQUESTED'
                  ? 'border-danger-red/40 text-danger-red'
                  : 'border-default-border text-secondary-text'
            }`}
          >
            {r.state === 'APPROVED' ? <CheckCircle2 size={10} aria-hidden /> : r.state === 'CHANGES_REQUESTED' ? <XCircle size={10} aria-hidden /> : <MessageSquare size={10} aria-hidden />}
            {r.authorLogin}
          </span>
        ))}
      </div>
    </Frame>
  )
}

/**
 * "These commits go there": the source branch's commits stacked on a lane
 * that bends into the target branch — the merge/push read as a picture.
 */
function FlowCard({ visual }: { visual: Extract<ToolVisual, { kind: 'flow' }> }): JSX.Element {
  const t = useT().graph
  const locale = useLocale()
  const shown = visual.commits.slice(0, 6)
  if (visual.total === 0) {
    return (
      <Frame className="px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-caption text-secondary-text">
          <CheckCircle2 size={13} className="text-success-green" aria-hidden /> {t.flowNothing(visual.target)}
        </p>
      </Frame>
    )
  }
  return (
    <Frame className="p-3">
      {/* Stacked (source ↓ target) in a narrow chat, side by side when there is room. */}
      <div className="flex min-w-0 flex-col items-start gap-1 text-caption @[26rem]:flex-row @[26rem]:items-center @[26rem]:gap-1.5">
        <span
          className="flex min-w-0 max-w-full items-center gap-1 rounded-pill border border-[var(--graph-1)] px-2 py-0.5 text-[var(--graph-1)] @[26rem]:max-w-[45%]"
          title={visual.source}
        >
          <GitBranch size={11} className="shrink-0" aria-hidden />
          <span className="truncate">{visual.source}</span>
        </span>
        <ArrowRight size={13} className="ml-2.5 shrink-0 rotate-90 text-tertiary-text @[26rem]:ml-0 @[26rem]:rotate-0" aria-hidden />
        <span
          className="flex min-w-0 max-w-full items-center gap-1 rounded-pill bg-command-blue px-2 py-0.5 text-midnight-base @[26rem]:max-w-[45%]"
          title={visual.target}
        >
          {visual.newBranch ? <Cloud size={11} className="shrink-0" aria-hidden /> : <GitBranch size={11} className="shrink-0" aria-hidden />}
          <span className="truncate font-medium">{visual.target}</span>
        </span>
        {visual.newBranch && <span className="text-[11px] text-tertiary-text">{t.flowNewBranch}</span>}
      </div>
      <p className="mt-2 text-caption font-medium text-primary-text">{t.flowTo(visual.total, visual.target)}</p>
      <ol className="relative mt-1.5 flex flex-col">
        {shown.map((c, i) => (
          <li key={c.hash} className="relative flex min-w-0 items-center gap-2 py-[3px] pl-6">
            <span
              aria-hidden
              className="absolute left-[9px] w-0.5 bg-[var(--graph-1)]"
              style={{ top: i === 0 ? '50%' : 0, bottom: 0 }}
            />
            <span aria-hidden className="absolute left-[5px] top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-[var(--graph-1)] bg-obsidian-panel" />
            <span className="min-w-0 flex-1 truncate text-caption text-primary-text" title={c.summary}>
              {c.summary}
            </span>
            <span className="shrink-0 text-[11px] text-tertiary-text">{relativeTime(locale, c.date)}</span>
          </li>
        ))}
        {visual.total > shown.length && (
          <li className="relative py-[3px] pl-6 text-[11px] text-tertiary-text">
            <span aria-hidden className="absolute bottom-0 left-[9px] top-0 w-0.5 bg-[var(--graph-1)] opacity-50" />
            {t.flowMore(visual.total - shown.length)}
          </li>
        )}
        <li className="relative flex items-center gap-2 pl-6 pt-1">
          <svg aria-hidden className="absolute left-0 top-0" width="24" height="22" viewBox="0 0 24 22">
            <path d="M10 0 C 10 10, 10 10, 10 12" stroke="var(--graph-1)" strokeWidth="2" fill="none" />
          </svg>
          <span aria-hidden className="absolute left-[3px] top-[13px] size-3.5 rounded-full bg-command-blue ring-2 ring-command-blue/25" />
          <span className="pt-2 text-caption font-medium text-command-blue">{visual.target}</span>
        </li>
      </ol>
    </Frame>
  )
}

function FocusCard({ visual }: { visual: Extract<ToolVisual, { kind: 'focus' }> }): JSX.Element {
  const t = useT().graph
  return (
    <Frame className="p-2.5">
      <ul>
        <CommitRow commit={visual.commit} />
      </ul>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 px-1.5">
        <span className="text-label uppercase tracking-wide text-tertiary-text">{t.containedIn}</span>
        {visual.containedIn.length === 0 ? (
          <span className="text-[11px] text-tertiary-text">{t.containedInNone}</span>
        ) : (
          <RefChips refs={visual.containedIn} max={6} />
        )}
      </div>
    </Frame>
  )
}

const GROUP_TONE: Record<ReleaseGroup, string> = {
  feat: 'text-success-green',
  fix: 'text-danger-red',
  other: 'text-secondary-text'
}

function ReleaseCard({ visual }: { visual: Extract<ToolVisual, { kind: 'release' }> }): JSX.Element {
  const t = useT().graph
  const groups: Record<ReleaseGroup, CommitSummary[]> = { feat: [], fix: [], other: [] }
  for (const c of visual.commits) groups[releaseGroup(c.summary)].push(c)
  return (
    <Frame className="p-3">
      <p className="flex items-center gap-1.5 text-caption text-secondary-text">
        <Tag size={12} className="text-warning-amber" aria-hidden />
        {visual.from ? t.releaseSince(visual.from, visual.to) : t.releaseFromStart(visual.to)}
        <span className="ml-auto text-tertiary-text">{t.commits(visual.total)}</span>
      </p>
      {(['feat', 'fix', 'other'] as const).map((key) =>
        groups[key].length === 0 ? null : (
          <div key={key} className="mt-2.5">
            <p className={`mb-1 text-label uppercase tracking-wide ${GROUP_TONE[key]}`}>
              {t.releaseGroups[key]} · {groups[key].length}
            </p>
            <ul className="flex flex-col gap-0.5">
              {groups[key].slice(0, 5).map((c) => (
                <li key={c.hash} className="flex min-w-0 items-center gap-1.5 text-caption text-primary-text">
                  <CircleDot size={10} className={`shrink-0 ${GROUP_TONE[key]}`} aria-hidden />
                  <span className="truncate" title={c.summary}>
                    {c.summary}
                  </span>
                </li>
              ))}
              {groups[key].length > 5 && <li className="pl-4 text-[11px] text-tertiary-text">{t.flowMore(groups[key].length - 5)}</li>}
            </ul>
          </div>
        )
      )}
    </Frame>
  )
}

interface ResultCommit {
  head: CommitSummary
  message?: string
  folded: { commit: CommitSummary; action: RebaseStep['action'] }[]
  reworded: boolean
}

/** Replays a plan on paper: what the branch will look like once applied, newest first. */
export function previewRebase(before: CommitSummary[], steps: RebaseStep[]): ResultCommit[] {
  const byHash = new Map(before.map((c) => [c.hash, c]))
  const result: ResultCommit[] = []
  for (const step of steps) {
    const commit = byHash.get(step.hash)
    if (!commit || step.action === 'drop') continue
    if (step.action === 'squash' || step.action === 'fixup') {
      const last = result[result.length - 1]
      if (last) {
        last.folded.push({ commit, action: step.action })
        if (step.action === 'squash' && step.message) last.message = step.message
      }
      continue
    }
    result.push({ head: commit, message: step.action === 'reword' ? step.message : undefined, folded: [], reworded: step.action === 'reword' })
  }
  return result.reverse()
}

const ACTION_TONE: Record<RebaseStep['action'], string> = {
  pick: 'border-default-border text-secondary-text',
  reword: 'border-command-blue/40 text-command-blue',
  squash: 'border-[var(--graph-3)] text-[var(--graph-3)]',
  fixup: 'border-[var(--graph-3)] text-[var(--graph-3)]',
  drop: 'border-danger-red/40 text-danger-red'
}

export function RebasePlanPicture({ before, steps }: { before: CommitSummary[]; steps: RebaseStep[] }): JSX.Element {
  const t = useT().graph
  const actionOf = new Map(steps.map((s) => [s.hash, s.action]))
  const after = previewRebase(before, steps)
  const newestFirst = [...before].reverse()
  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 grid-cols-1 gap-3 @[26rem]:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 text-label uppercase tracking-wide text-tertiary-text">
            {t.rebaseBefore} · {before.length}
          </p>
          <ul className="flex flex-col gap-0.5">
            {newestFirst.map((c) => {
              const action = actionOf.get(c.hash) ?? 'pick'
              return (
                <li key={c.hash} className="flex min-w-0 items-center gap-1.5 text-caption">
                  <span className={`shrink-0 rounded-pill border px-1.5 text-[10px] ${ACTION_TONE[action]}`} title={t.actionLabel[action]}>
                    {t.actionShort[action]}
                  </span>
                  <span className={`min-w-0 truncate ${action === 'drop' ? 'text-tertiary-text line-through' : 'text-primary-text'}`} title={c.summary}>
                    {c.summary}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-label uppercase tracking-wide text-tertiary-text">
            {t.rebaseAfter} · {after.length}
          </p>
          <ul className="flex flex-col gap-1">
            {after.map((r) => (
              <li key={r.head.hash} className="min-w-0 rounded-sm border border-default-border bg-obsidian-panel px-2 py-1">
                <p className="flex min-w-0 items-center gap-1.5 text-caption text-primary-text">
                  <span className="size-2 shrink-0 rounded-full bg-command-blue" aria-hidden />
                  <span className="truncate" title={r.message ?? r.head.summary}>
                    {r.message ?? r.head.summary}
                  </span>
                </p>
                {r.folded.length > 0 && (
                  <ul className="mt-0.5 flex flex-col pl-3.5">
                    {r.folded.map((f) => (
                      <li key={f.commit.hash} className="flex min-w-0 items-center gap-1 text-[11px] text-tertiary-text">
                        <GitMerge size={10} className="shrink-0 text-[var(--graph-3)]" aria-hidden />
                        <span className="truncate">{f.commit.summary}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function RebaseCard({ visual }: { visual: Extract<ToolVisual, { kind: 'rebase' }> }): JSX.Element {
  return (
    <Frame className="p-3">
      <RebasePlanPicture before={visual.before} steps={visual.steps} />
    </Frame>
  )
}

function BlameCard({ visual }: { visual: Extract<ToolVisual, { kind: 'blame' }> }): JSX.Element {
  const t = useT().graph
  const locale = useLocale()
  const open = useRepoStore((s) => s.openFileInsight)
  const total = visual.authors.reduce((n, a) => n + a.lines, 0)
  return (
    <Frame className="p-3">
      <button
        type="button"
        onClick={() => open(visual.path, visual.line)}
        className="flex w-full min-w-0 items-center gap-1.5 text-left text-caption text-command-blue hover:underline"
      >
        <FileCode2 size={12} className="shrink-0" aria-hidden />
        <span className="truncate font-mono">{visual.path}</span>
      </button>
      {visual.line && (
        <div className="mt-2 overflow-hidden rounded-sm border border-default-border">
          <div className="flex min-w-0 items-baseline gap-2 bg-command-blue-soft px-2 py-1 font-mono text-[12px]">
            <span className="shrink-0 text-tertiary-text">{visual.line}</span>
            <span className="min-w-0 truncate text-primary-text">{visual.lineText?.trim() || ' '}</span>
          </div>
          {visual.commit && (
            <div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
              <Avatar name={visual.commit.uncommitted ? '?' : visual.commit.authorName} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-caption text-primary-text">
                  {visual.commit.uncommitted ? t.uncommitted : visual.commit.summary}
                </span>
                {!visual.commit.uncommitted && (
                  <span className="text-[11px] text-tertiary-text">
                    {visual.commit.authorName} · {relativeTime(locale, visual.commit.date)} · <span className="font-mono">{visual.commit.shortHash}</span>
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
      {total > 0 && (
        <div className="mt-2.5">
          <p className="mb-1 text-label uppercase tracking-wide text-tertiary-text">{t.authorsTitle}</p>
          <div className="flex h-2 overflow-hidden rounded-pill" aria-hidden>
            {visual.authors.map((a, i) => (
              <span key={a.name} style={{ width: `${(a.lines / total) * 100}%`, background: `var(--graph-${AUTHOR_LANES[i % AUTHOR_LANES.length]})` }} />
            ))}
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {visual.authors.map((a, i) => (
              <li key={a.name} className="flex items-center gap-1 text-[11px] text-secondary-text">
                <span className="size-2 rounded-full" style={{ background: `var(--graph-${AUTHOR_LANES[i % AUTHOR_LANES.length]})` }} aria-hidden />
                {a.name} <span className="text-tertiary-text">{t.linesBy(a.lines)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {visual.timeline.length > 0 && (
        <ul className="mt-2.5 flex flex-col border-t border-default-border pt-1.5">
          {visual.timeline.map((c) => (
            <CommitRow key={c.hash} commit={c} />
          ))}
        </ul>
      )}
    </Frame>
  )
}

function TagsCard({ visual }: { visual: Extract<ToolVisual, { kind: 'tags' }> }): JSX.Element {
  const locale = useLocale()
  return (
    <Frame>
      <ul className="flex flex-col">
        {visual.tags.map((tag) => (
          <li key={tag.name} className="flex min-w-0 items-center gap-2 px-1.5 py-1">
            <span className="ref-chip ref-chip-tag">
              <Tag size={10} aria-hidden />
              <span>{tag.name}</span>
            </span>
            <span className="min-w-0 flex-1 truncate text-caption text-secondary-text">{tag.message && tag.message !== tag.name ? tag.message : ''}</span>
            <span className="shrink-0 font-mono text-[11px] text-tertiary-text">{tag.shortTarget}</span>
            <span className="shrink-0 text-[11px] text-tertiary-text">{relativeTime(locale, tag.date)}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

function ToolVisualCard({ visual }: { visual: ToolVisual }): JSX.Element {
  switch (visual.kind) {
    case 'commits':
      return <CommitsCard visual={visual} />
    case 'commit':
      return <CommitCard visual={visual} />
    case 'repos':
      return <ReposCard visual={visual} />
    case 'prStatus':
      return <PrStatusCard visual={visual} />
    case 'flow':
      return <FlowCard visual={visual} />
    case 'focus':
      return <FocusCard visual={visual} />
    case 'release':
      return <ReleaseCard visual={visual} />
    case 'rebase':
      return <RebaseCard visual={visual} />
    case 'blame':
      return <BlameCard visual={visual} />
    case 'tags':
      return <TagsCard visual={visual} />
    default:
      return <Fragment />
  }
}

export default ToolVisualCard
