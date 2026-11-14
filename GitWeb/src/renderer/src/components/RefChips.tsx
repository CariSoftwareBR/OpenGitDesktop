import { ArrowDown, ArrowUp, Cloud, GitBranch, Tag } from 'lucide-react'
import type { CommitRef } from '../../../shared/git'
import { useT } from '../lib/i18n'

/**
 * Branch, remote and tag labels. A local branch and its own remote copy on the
 * same commit collapse into one chip with a cloud mark — "main ☁" instead of
 * "main" + "origin/main" — which is the common, in-sync case.
 */
function RefChips({
  refs,
  ahead = 0,
  behind = 0,
  max = 3
}: {
  refs: CommitRef[]
  /** Shown on the current branch's chip. */
  ahead?: number
  behind?: number
  max?: number
}): JSX.Element | null {
  const t = useT().graph
  if (refs.length === 0) return null

  const localNames = new Set(refs.filter((r) => r.kind === 'local').map((r) => r.name))
  const synced = new Set(refs.filter((r) => r.kind === 'remote' && localNames.has(r.name.replace(/^[^/]+\//, ''))).map((r) => r.name))
  const shown = refs.filter((r) => !synced.has(r.name))
  const hasRemoteTwin = (name: string): boolean => [...synced].some((remote) => remote.replace(/^[^/]+\//, '') === name)

  const visible = shown.slice(0, max)
  const hidden = shown.slice(max)

  return (
    // Inline in a commit row the chips share one line and shrink; in a longer
    // list ("present in") they wrap so none gets cut at the edge.
    <span className={`flex min-w-0 shrink items-center gap-1 ${max > 3 ? 'flex-wrap' : ''}`}>
      {visible.map((chip) => {
        const kindClass =
          chip.kind === 'tag'
            ? 'ref-chip-tag'
            : chip.kind === 'remote'
              ? 'ref-chip-remote'
              : chip.kind === 'head'
                ? 'ref-chip-head'
                : chip.current
                  ? 'ref-chip-current'
                  : 'ref-chip-local'
        const Icon = chip.kind === 'tag' ? Tag : chip.kind === 'remote' ? Cloud : GitBranch
        return (
          <span key={`${chip.kind}:${chip.name}`} className={`ref-chip ${kindClass}`} title={chip.name}>
            <Icon size={10} className="shrink-0" aria-hidden />
            <span>{chip.name}</span>
            {chip.kind === 'local' && hasRemoteTwin(chip.name) && <Cloud size={10} className="shrink-0 opacity-70" aria-hidden />}
            {chip.current && ahead > 0 && (
              <span className="flex shrink-0 items-center" title={t.aheadTitle(ahead)}>
                <ArrowUp size={10} aria-hidden />
                {ahead}
              </span>
            )}
            {chip.current && behind > 0 && (
              <span className="flex shrink-0 items-center" title={t.behindTitle(behind)}>
                <ArrowDown size={10} aria-hidden />
                {behind}
              </span>
            )}
          </span>
        )
      })}
      {hidden.length > 0 && (
        <span className="ref-chip ref-chip-remote" title={hidden.map((r) => r.name).join(', ')}>
          <span>+{hidden.length}</span>
        </span>
      )}
    </span>
  )
}

export default RefChips
