import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  confirmClassName?: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  confirmClassName,
  onConfirm,
  onCancel
}: ConfirmDialogProps): JSX.Element | null {
  const titleId = useId()
  const descId = useId()
  const common = useT().common
  const panelRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(panelRef, open, { onEscape: onCancel, initialFocusRef: danger ? cancelRef : confirmRef })

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={onCancel}>
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full min-w-0 max-w-md rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-title font-semibold text-primary-text">
          {title}
        </h2>
        <p id={descId} className="mt-2 break-words text-body text-secondary-text [overflow-wrap:anywhere]">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-secondary">
            {cancelLabel ?? common.cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`${danger ? 'btn-danger' : 'btn-primary'}${confirmClassName ? ` ${confirmClassName}` : ''}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface PromptDialogProps {
  open: boolean
  title: string
  message?: string
  label: string
  placeholder?: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
  /** Rewrites the value as it is typed (e.g. spaces → "-" in a branch name). */
  transform?: (value: string) => string
  /** Message explaining why the trimmed value cannot be confirmed, or null. */
  validate?: (value: string) => string | null
  /** Pre-filled text (selected on open), e.g. the current name when renaming. */
  initialValue?: string
}

export function PromptDialog({
  open,
  title,
  message,
  label,
  placeholder,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  transform,
  validate,
  initialValue = ''
}: PromptDialogProps): JSX.Element | null {
  const titleId = useId()
  const descId = useId()
  const common = useT().common
  const inputId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const errorId = useId()

  useEffect(() => {
    setValue(open ? initialValue : '')
    if (open && initialValue) requestAnimationFrame(() => inputRef.current?.select())
  }, [open, initialValue])

  useFocusTrap(panelRef, open, { onEscape: onCancel, initialFocusRef: inputRef })

  if (!open) return null

  const invalid = value.trim() && validate ? validate(value.trim()) : null

  function submit(): void {
    const next = value.trim()
    if (!next || invalid) return
    setValue('')
    onConfirm(next)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={onCancel}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        className="w-full min-w-0 max-w-md rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-title font-semibold text-primary-text">
          {title}
        </h2>
        {message && (
          <p id={descId} className="mt-2 break-words text-body text-secondary-text [overflow-wrap:anywhere]">
            {message}
          </p>
        )}
        <label htmlFor={inputId} className="mt-3 block text-caption text-secondary-text">
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(transform ? transform(e.target.value) : e.target.value)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          className="field mt-1.5 w-full"
        />
        {invalid && (
          <p id={errorId} role="alert" className="mt-1.5 text-caption text-danger-red">
            {invalid}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setValue('')
              onCancel()
            }}
            className="btn-secondary"
          >
            {cancelLabel ?? common.cancel}
          </button>
          <button type="button" onClick={submit} disabled={!value.trim() || Boolean(invalid)} className="btn-primary">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ConfirmDialog
