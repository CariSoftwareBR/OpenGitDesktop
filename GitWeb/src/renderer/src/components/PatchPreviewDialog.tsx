import { createPortal } from 'react-dom'
import { useId, useRef } from 'react'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'
import DiffViewer from './DiffViewer'

interface PatchPreviewDialogProps {
  open: boolean
  title: string
  message: string
  diffText: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function PatchPreviewDialog({
  open,
  title,
  message,
  diffText,
  confirmLabel,
  busy,
  onConfirm,
  onCancel
}: PatchPreviewDialogProps): JSX.Element | null {
  const titleId = useId()
  const messages = useT()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open, { onEscape: onCancel })

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={onCancel}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex h-[min(36rem,calc(100vh-2rem))] w-full min-w-0 max-w-3xl flex-col rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="shrink-0 text-title font-semibold text-primary-text">
          {title}
        </h2>
        <p id={descId} className="mt-2 shrink-0 text-body text-secondary-text">
          {message}
        </p>
        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-md border border-default-border bg-midnight-base">
          <DiffViewer diffText={diffText} />
        </div>
        <div className="mt-4 flex shrink-0 justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
            {messages.common.cancel}
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary" disabled={busy || !diffText}>
            {busy ? messages.ui.applying : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PatchPreviewDialog
