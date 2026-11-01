import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, GripVertical, ListOrdered, Loader2, ShieldCheck } from 'lucide-react'
import type { LocalRebaseInfo, RebaseAction, RebaseStep } from '../../../shared/git'
import { validateRebasePlan } from '../../../shared/gitParsing'
import { useRepoStore } from '../store/repoStore'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'
import { RebasePlanPicture } from './ToolVisualCard'

const ACTIONS: RebaseAction[] = ['pick', 'reword', 'squash', 'fixup', 'drop']

const ACTION_ACCENT: Record<RebaseAction, string> = {
  pick: 'var(--color-default-border)',
  reword: 'var(--color-command-blue)',
  squash: 'var(--graph-3)',
  fixup: 'var(--graph-3)',
  drop: 'var(--color-danger-red)'
}

interface Row {
  hash: string
  shortHash: string
  summary: string
  action: RebaseAction
  message: string
}

/**
 * Reorder, combine or drop the commits that were not pushed yet. Rows show
 * newest on top, like History; the plan sent to git is oldest first. Nothing
 * changes until Apply, and main rolls everything back if any step fails.
 */
function RebasePlannerDialog(): JSX.Element | null {
  const open = useRepoStore((s) => s.rebasePlannerOpen)
  const setOpen = useRepoStore((s) => s.setRebasePlannerOpen)
  const repoPath = useRepoStore((s) => s.currentRepoPath)
  const runLocalRebase = useRepoStore((s) => s.runLocalRebase)
  const t = useT().graph
  const reasons = useT().main.git.rebaseBlockReason
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  const [info, setInfo] = useState<LocalRebaseInfo | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const close = (): void => {
    if (!applying) setOpen(false)
  }
  useFocusTrap(panelRef, open, { onEscape: close, initialFocusRef: panelRef })

  useEffect(() => {
    if (!open || !repoPath) return
    let cancelled = false
    setInfo(null)
    setDone(null)
    window.api.git.localRebaseInfo(repoPath).then((result) => {
      if (cancelled) return
      setInfo(result)
      setRows(
        [...result.commits].reverse().map((c) => ({ hash: c.hash, shortHash: c.shortHash, summary: c.summary, action: 'pick', message: '' }))
      )
    })
    return () => {
      cancelled = true
    }
  }, [open, repoPath])

  const steps: RebaseStep[] = useMemo(
    () =>
      [...rows].reverse().map((r) => ({
        hash: r.hash,
        action: r.action,
        ...((r.action === 'reword' || r.action === 'squash') && r.message.trim() ? { message: r.message.trim() } : {})
      })),
    [rows]
  )

  const validation = useMemo(
    () => (info ? validateRebasePlan(steps, info.commits.map((c) => c.hash)) : null),
    [info, steps]
  )
  const problem = validation && !validation.ok ? validation.problem : null
  const problemText =
    problem?.kind === 'squashFirst'
      ? t.planSquashFirst
      : problem?.kind === 'nothingKept'
        ? t.planNothingKept
        : problem?.kind === 'emptyMessage'
          ? t.planEmptyMessage
          : null

  const unchanged = useMemo(() => {
    if (!info) return true
    const original = info.commits.map((c) => c.hash)
    return steps.every((s, i) => s.action === 'pick' && s.hash === original[i])
  }, [info, steps])

  const keptCount = steps.filter((s) => s.action === 'pick' || s.action === 'reword').length

  if (!open) return null

  function move(from: number, to: number): void {
    if (to < 0 || to >= rows.length || from === to) return
    setRows((current) => {
      const next = [...current]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  function update(index: number, patch: Partial<Row>): void {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  async function apply(): Promise<void> {
    if (!info?.head || !validation?.ok) return
    setApplying(true)
    const count = await runLocalRebase(validation.steps, info.head)
    setApplying(false)
    if (count !== null) {
      setDone(t.applied(count))
      window.setTimeout(() => setOpen(false), 1400)
    } else {
      setOpen(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={close}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="rise-in flex outline-none max-h-[88vh] w-full max-w-3xl min-w-0 flex-col rounded-lg border border-default-border bg-obsidian-panel shadow-floating [animation-duration:260ms]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-default-border p-5 pb-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-attention-orange-soft text-attention-orange">
            <ListOrdered size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-title font-semibold text-primary-text">
              {t.plannerTitle}
              {info?.branch && <span className="ml-2 font-mono text-caption font-normal text-secondary-text">{info.branch}</span>}
            </h2>
            <p className="mt-1 flex items-start gap-1.5 text-caption text-secondary-text">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-success-green" aria-hidden />
              {t.plannerIntro}
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!info ? (
            <p className="flex items-center gap-1.5 text-caption text-tertiary-text">
              <Loader2 size={13} className="animate-spin" aria-hidden /> {t.loading}
            </p>
          ) : info.blocked ? (
            <p className="rounded-md border border-attention-orange/30 bg-attention-orange-soft px-3 py-2 text-body text-attention-orange">
              {t.planBlocked(reasons[info.blocked] ?? info.blocked)}
            </p>
          ) : (
            <>
              <p className="mb-2 text-label uppercase tracking-wide text-tertiary-text">{t.plannerNewestFirst}</p>
              <ol className="flex flex-col gap-1.5">
                {rows.map((row, index) => {
                  const isOver = overIndex === index && dragIndex !== null && dragIndex !== index
                  return (
                    <li
                      key={row.hash}
                      draggable={!applying}
                      onDragStart={(e) => {
                        setDragIndex(index)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', row.hash)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setOverIndex(index)
                      }}
                      onDragLeave={() => setOverIndex((v) => (v === index ? null : v))}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragIndex !== null) move(dragIndex, index)
                        setDragIndex(null)
                        setOverIndex(null)
                      }}
                      onDragEnd={() => {
                        setDragIndex(null)
                        setOverIndex(null)
                      }}
                      className={`group/plan relative rounded-md border bg-coal-raised transition-[border-color,opacity,transform] duration-150 ${
                        dragIndex === index ? 'opacity-50' : ''
                      } ${isOver ? 'border-command-blue' : 'border-default-border'}`}
                      style={{ boxShadow: `inset 3px 0 0 ${ACTION_ACCENT[row.action]}` }}
                    >
                      <div className="flex min-w-0 items-center gap-2 py-1.5 pl-2 pr-2">
                        <span className="cursor-grab text-tertiary-text active:cursor-grabbing" title={t.dragHandle(row.summary)} aria-hidden>
                          <GripVertical size={15} />
                        </span>
                        <span className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            onClick={() => move(index, index - 1)}
                            disabled={index === 0 || applying}
                            aria-label={`${t.moveUp}: ${row.summary}`}
                            className="rounded-sm text-tertiary-text hover:text-primary-text"
                          >
                            <ChevronUp size={13} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(index, index + 1)}
                            disabled={index === rows.length - 1 || applying}
                            aria-label={`${t.moveDown}: ${row.summary}`}
                            className="rounded-sm text-tertiary-text hover:text-primary-text"
                          >
                            <ChevronDown size={13} aria-hidden />
                          </button>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span
                            className={`truncate text-body ${row.action === 'drop' ? 'text-tertiary-text line-through' : 'text-primary-text'}`}
                            title={row.summary}
                          >
                            {row.summary}
                          </span>
                          <span className="truncate text-meta text-tertiary-text">
                            <span className="font-mono">{row.shortHash}</span> · {t.actionHint[row.action]}
                          </span>
                        </span>
                        <select
                          value={row.action}
                          onChange={(e) => update(index, { action: e.target.value as RebaseAction })}
                          disabled={applying}
                          aria-label={`${row.summary}`}
                          className="field h-8 w-[11.5rem] shrink-0 py-0 text-caption"
                        >
                          {ACTIONS.map((action) => (
                            <option key={action} value={action}>
                              {t.actionLabel[action]}
                            </option>
                          ))}
                        </select>
                      </div>
                      {(row.action === 'reword' || row.action === 'squash') && (
                        <div className="px-3 pb-2 pl-[52px]">
                          <input
                            type="text"
                            value={row.message}
                            onChange={(e) => update(index, { message: e.target.value })}
                            placeholder={row.action === 'reword' ? t.newMessage : t.squashMessage}
                            aria-label={row.action === 'reword' ? t.newMessage : t.squashMessage}
                            className="field h-8 w-full py-0 text-caption"
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>

              <div className="mt-4 rounded-md border border-default-border bg-midnight-base p-3">
                <RebasePlanPicture before={info.commits} steps={steps} />
              </div>
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-default-border p-4">
          <p className="min-w-0 flex-1 text-caption" role="status">
            {done ? (
              <span className="text-success-green">{done}</span>
            ) : problemText ? (
              <span className="text-danger-red">{problemText}</span>
            ) : info && !info.blocked ? (
              <span className="text-secondary-text">{unchanged ? t.unchanged : t.resultSummary(info.commits.length, keptCount)}</span>
            ) : null}
          </p>
          <button type="button" onClick={close} disabled={applying} className="btn-secondary">
            {t.close}
          </button>
          {info && !info.blocked && (
            <button
              type="button"
              onClick={() => void apply()}
              disabled={applying || unchanged || Boolean(problem) || Boolean(done)}
              className="btn-primary"
            >
              {applying ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
              {applying ? t.applying : t.apply}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default RebasePlannerDialog
