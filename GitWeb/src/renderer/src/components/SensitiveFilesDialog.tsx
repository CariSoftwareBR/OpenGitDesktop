import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Settings2, ShieldAlert, ShieldBan } from 'lucide-react'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'
import { splitForIgnore, type SensitiveSplit } from '../lib/sensitive'
import { SensitiveFindingList, SensitiveNotes } from './SensitiveFindings'
import type { SensitiveCheckMode, SensitiveFinding } from '../../../shared/sensitiveFiles'

interface SensitiveFilesDialogProps {
  /** Null keeps the dialog closed. */
  findings: SensitiveFinding[] | null
  mode: SensitiveCheckMode
  onCancel: () => void
  /** Unstages the flagged files; the commit form stays as typed. */
  onUnstage: (split: SensitiveSplit) => void
  /**
   * Adds the files flagged by name (.env, id_rsa…) to .gitignore and takes
   * them out of the index; files flagged only by content are just unstaged.
   */
  onIgnore: (split: SensitiveSplit) => void
  /** Warn mode only: go ahead with the commit as staged. */
  onCommitAnyway: () => void
  onOpenSettings: () => void
}

// Asked right before a commit that carries likely secrets. The safe way out
// (take them out of the commit) is the primary action; committing anyway is
// only offered in warn mode, and styled as the risky choice it is.
export default function SensitiveFilesDialog({
  findings,
  mode,
  onCancel,
  onUnstage,
  onIgnore,
  onCommitAnyway,
  onOpenSettings
}: SensitiveFilesDialogProps): JSX.Element | null {
  const t = useT().security
  const common = useT().common
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const open = findings !== null && findings.length > 0

  useFocusTrap(panelRef, open, { onEscape: onCancel, initialFocusRef: primaryRef })

  if (!open) return null

  const blocked = mode === 'block'
  const split = splitForIgnore(findings)
  const canIgnore = split.ignorePaths.length > 0
  const Icon = blocked ? ShieldBan : ShieldAlert

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={onCancel}>
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex max-h-full w-full min-w-0 max-w-lg flex-col rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-md border ${
              blocked
                ? 'border-danger-red/30 bg-danger-red-soft text-danger-red'
                : 'border-warning-amber/25 bg-warning-amber-soft text-warning-amber'
            }`}
          >
            <Icon size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-title font-semibold text-primary-text">
              {blocked ? t.blockTitle : t.warnTitle}
            </h2>
            <p id={descId} className="mt-1 text-body text-secondary-text">
              {blocked ? t.blockLead : t.warnLead}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn-ghost -mr-1.5 -mt-1 size-8 shrink-0 justify-center p-0"
            title={t.settingsLink}
            aria-label={t.settingsLink}
          >
            <Settings2 size={16} aria-hidden />
          </button>
        </div>

        <SensitiveFindingList findings={findings} tone={blocked ? 'danger' : 'warning'} className="mt-4" />
        <SensitiveNotes findings={findings} split={split} />

        {/* Warn mode only. Kept out of the button row on purpose: it is the
            risky choice, so it reads as a way out, not as an equal action. */}
        {!blocked && (
          <button
            type="button"
            onClick={onCommitAnyway}
            className="mt-3 self-start text-caption text-danger-red underline-offset-2 hover:underline focus-visible:underline"
          >
            {t.commitAnyway}
          </button>
        )}

        {/* Cancel always last, on the far right. */}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-default-border pt-4">
          <button
            ref={canIgnore ? undefined : primaryRef}
            type="button"
            onClick={() => onUnstage(split)}
            className={canIgnore ? 'btn-secondary' : 'btn-primary'}
          >
            {t.unstage}
          </button>
          {canIgnore && (
            <button ref={primaryRef} type="button" onClick={() => onIgnore(split)} className="btn-primary">
              {t.ignore}
            </button>
          )}
          <button type="button" onClick={onCancel} className="btn-secondary">
            {common.cancel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
