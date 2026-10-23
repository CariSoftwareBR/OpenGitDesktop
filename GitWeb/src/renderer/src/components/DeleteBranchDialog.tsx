import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, CloudCheck, Loader2, Trash2 } from 'lucide-react'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'
import type { BranchDeleteCheck } from '../../../shared/git'

interface DeleteBranchDialogProps {
  /** The local branch to delete; null keeps the dialog closed. */
  name: string | null
  repoPath: string | null
  onCancel: () => void
  /** The user confirmed after seeing the check; delete exactly this tip. */
  onDelete: (name: string, tip: string) => void
  /** The check itself failed: fall back to git's own safe delete. */
  onFallback: (name: string) => void
}

type CheckState = { status: 'loading' } | { status: 'ready'; check: BranchDeleteCheck } | { status: 'failed'; reason: string }

// Before a branch goes, says what goes with it — measured against main, not
// against whatever happens to be checked out (git's own -d check): all its
// work is on main, or here are the commits that are not and whether anything
// but this machine still has them.
export default function DeleteBranchDialog({ name, repoPath, onCancel, onDelete, onFallback }: DeleteBranchDialogProps): JSX.Element | null {
  const t = useT().topBar
  const common = useT().common
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<CheckState>({ status: 'loading' })
  const open = name !== null

  useEffect(() => {
    if (!name || !repoPath) return
    let current = true
    setState({ status: 'loading' })
    window.api.git
      .branchDeleteCheck(repoPath, name)
      .then((check) => current && setState({ status: 'ready', check }))
      .catch((err: unknown) => current && setState({ status: 'failed', reason: err instanceof Error ? err.message : String(err) }))
    return () => {
      current = false
    }
  }, [name, repoPath])

  useFocusTrap(panelRef, open, { onEscape: onCancel, initialFocusRef: cancelRef })

  if (!name) return null

  const check = state.status === 'ready' ? state.check : null
  const safe = check !== null && check.branch.state !== 'unmerged'
  const unmerged = check !== null && check.branch.state === 'unmerged'

  let tone: 'neutral' | 'success' | 'danger' = 'neutral'
  let Icon = Trash2
  if (safe) {
    tone = 'success'
    Icon = CheckCircle2
  } else if (unmerged) {
    tone = 'danger'
    Icon = AlertTriangle
  }
  const tile = {
    neutral: 'border-default-border bg-coal-raised text-secondary-text',
    success: 'border-success-green/25 bg-success-green-soft text-success-green',
    danger: 'border-danger-red/30 bg-danger-red-soft text-danger-red'
  }[tone]

  let body: ReactNode = null
  if (state.status === 'loading') {
    body = (
      <p className="mt-4 flex items-center gap-2 text-body text-secondary-text">
        <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden />
        {t.deleteChecking}
      </p>
    )
  } else if (state.status === 'failed') {
    body = (
      <div className="mt-4 space-y-2 text-body text-secondary-text">
        <p>{t.deleteCheckFailed(state.reason)}</p>
        <p>{t.deleteMessage(name)}</p>
      </div>
    )
  } else if (safe && check) {
    body = (
      <div className="mt-4 rounded-[10px] border border-default-border bg-coal-raised px-3.5 py-3">
        <p className="text-body font-semibold text-primary-text">{t.deleteSafeHeadline(check.base)}</p>
        <p className="mt-0.5 text-body text-secondary-text">
          {check.branch.state === 'equivalent' && check.branch.equivalentCommit
            ? t.deleteSafeEquivalent(check.branch.equivalentCommit)
            : t.deleteSafeMerged}
        </p>
      </div>
    )
  } else if (unmerged && check) {
    const { branch, missingCommits, localOnly } = check
    const hidden = branch.ahead - missingCommits.length
    const lost = localOnly === null || localOnly > 0
    body = (
      <>
        <p className="mt-4 text-body text-secondary-text">{t.deleteUnmergedLead(branch.ahead, check.base)}</p>
        <ul className="mt-2 max-h-48 divide-y divide-default-border overflow-y-auto rounded-[10px] border border-default-border bg-coal-raised">
          {missingCommits.map((c) => (
            <li key={c.hash} className="flex items-baseline gap-3 px-3 py-2">
              <span className="shrink-0 font-mono text-caption text-command-blue">{c.hash}</span>
              <span className="min-w-0 flex-1 truncate text-body text-primary-text" title={c.summary}>
                {c.summary}
              </span>
              <span className="shrink-0 text-caption tabular-nums text-tertiary-text">{c.date}</span>
            </li>
          ))}
          {hidden > 0 && <li className="px-3 py-2 text-caption text-tertiary-text">{t.deleteMoreCommits(hidden)}</li>}
        </ul>

        <div
          className={`mt-3 flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-body ${
            lost ? 'border-danger-red/30 bg-danger-red-soft text-danger-red' : 'border-command-blue/20 bg-command-blue-soft text-command-blue'
          }`}
        >
          {lost ? <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden /> : <CloudCheck size={15} className="mt-0.5 shrink-0" aria-hidden />}
          <span>
            {localOnly === null
              ? t.deleteNeverPublished
              : localOnly > 0
                ? t.deleteLocalOnly(localOnly)
                : t.deleteOnRemote(branch.upstream ?? '')}
          </span>
        </div>

        {lost && (
          <div className="mt-3">
            <p className="text-caption text-secondary-text">{t.deleteRecoveryHint}</p>
            <code className="mt-1 block select-all rounded-md border border-default-border bg-midnight-base px-2.5 py-1.5 font-mono text-caption text-primary-text">
              git branch {name} {branch.tip}
            </code>
          </div>
        )}
      </>
    )
  }

  const confirmLabel = unmerged ? t.deleteForceConfirm : t.deleteConfirm

  function confirm(): void {
    if (!name) return
    if (state.status === 'failed') onFallback(name)
    else if (check) onDelete(name, check.branch.tip)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={onCancel}>
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={state.status === 'loading'}
        className="max-h-full w-full min-w-0 max-w-lg overflow-y-auto rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-md border ${tile}`}>
            <Icon size={18} aria-hidden />
          </span>
          <h2 id={titleId} className="min-w-0 pt-1.5 text-title font-semibold text-primary-text [overflow-wrap:anywhere]">
            {unmerged && check ? t.deleteUnmergedTitle(name, check.base) : t.deleteCheckTitle(name)}
          </h2>
        </div>

        <div aria-live="polite">{body}</div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-default-border pt-4">
          <p className="min-w-0 flex-1 text-caption text-tertiary-text">{t.deleteLocalNote}</p>
          <div className="flex shrink-0 gap-2">
            <button ref={cancelRef} type="button" onClick={onCancel} className="btn-secondary">
              {common.cancel}
            </button>
            <button type="button" onClick={confirm} disabled={state.status === 'loading'} className="btn-danger">
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
