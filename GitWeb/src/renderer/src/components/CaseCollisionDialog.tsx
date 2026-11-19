import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CaseSensitive, Check, Trash2 } from 'lucide-react'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'
import { CASE_COLLISION_DISK_SOURCE, type CaseCollision } from '../../../shared/git'

interface CaseCollisionDialogProps {
  /** Null keeps the dialog closed. */
  collision: CaseCollision | null
  onCancel: () => void
  /** `source` is a version's path, or CASE_COLLISION_DISK_SOURCE for the file as it is on disk. */
  onConfirm: (keepPath: string, source: string) => void
}

/**
 * Starting point: the name already on disk (no rename), and the content most
 * likely wanted — disk edits when there are any, otherwise the longest
 * version, since tools that add a second name usually write a shorter file.
 */
export function defaultCaseChoice(collision: CaseCollision): { keepPath: string; source: string } {
  const keepPath = collision.versions.find((v) => v.path === collision.diskPath)?.path ?? collision.versions[0].path
  if (collision.diskEdited) return { keepPath, source: CASE_COLLISION_DISK_SOURCE }
  const longest = [...collision.versions].sort((a, b) => (b.lines ?? -1) - (a.lines ?? -1))[0]
  return { keepPath, source: longest.path }
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export default function CaseCollisionDialog({ collision, onCancel, onConfirm }: CaseCollisionDialogProps): JSX.Element | null {
  const t = useT().changes
  const common = useT().common
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const open = collision !== null
  const [keepPath, setKeepPath] = useState('')
  const [source, setSource] = useState('')

  useEffect(() => {
    if (!collision) return
    const choice = defaultCaseChoice(collision)
    // oxlint-disable-next-line react/set-state-in-effect -- starts from the suggested choice each time the dialog opens
    setKeepPath(choice.keepPath)
    setSource(choice.source)
  }, [collision])

  useFocusTrap(panelRef, open, { onEscape: onCancel, initialFocusRef: confirmRef })

  if (!collision) return null

  const contentOptions = [
    ...(collision.diskEdited
      ? [{ value: CASE_COLLISION_DISK_SOURCE, label: t.caseDiskEdited, detail: t.caseLines(collision.diskLines), onDisk: true }]
      : []),
    ...collision.versions.map((v) => ({ value: v.path, label: t.caseVersionOf(v.path), detail: t.caseLines(v.lines), onDisk: v.onDisk }))
  ]
  const trashesEdits = collision.diskEdited && source !== CASE_COLLISION_DISK_SOURCE

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex max-h-full w-full min-w-0 max-w-lg flex-col overflow-y-auto rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-warning-amber/25 bg-warning-amber-soft text-warning-amber">
            <CaseSensitive size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-title font-semibold text-primary-text">
              {t.caseDialogTitle}
            </h2>
            <p id={descId} className="mt-1 text-body text-secondary-text">
              {t.caseDialogLead}
            </p>
          </div>
        </div>

        <p className="mt-4 text-caption text-secondary-text">{t.caseNameLabel}</p>
        <div role="radiogroup" aria-label={t.caseNameLabel} className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {collision.versions.map((v) => (
            <button
              key={v.path}
              type="button"
              role="radio"
              aria-checked={keepPath === v.path}
              onClick={() => setKeepPath(v.path)}
              className="choice-tile is-compact text-left"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-body font-semibold text-primary-text" title={v.path}>
                  {fileName(v.path)}
                </span>
                <span className="choice-check" aria-hidden>
                  <Check size={11} strokeWidth={3} />
                </span>
              </span>
              <span className="mt-1 block text-caption text-secondary-text">
                {v.path === collision.diskPath ? t.caseDiskName : ' '}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-caption text-secondary-text">{t.caseContentLabel}</p>
        <div role="radiogroup" aria-label={t.caseContentLabel} className="mt-1.5 flex flex-col gap-2">
          {contentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={source === option.value}
              onClick={() => setSource(option.value)}
              className="choice-tile is-compact text-left"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words text-body font-semibold text-primary-text [overflow-wrap:anywhere]">
                  {option.label}
                </span>
                <span className="choice-check" aria-hidden>
                  <Check size={11} strokeWidth={3} />
                </span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-caption text-secondary-text">
                {option.detail}
                {option.onDisk && (
                  <span className="count-badge bg-command-blue/15 text-command-blue">{t.caseOnDiskNow}</span>
                )}
              </span>
            </button>
          ))}
        </div>

        {trashesEdits && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-warning-amber/25 bg-warning-amber-soft p-2.5 text-caption text-warning-amber">
            <Trash2 size={14} className="mt-0.5 shrink-0" aria-hidden />
            {t.caseTrashWarning}
          </p>
        )}
        <p className="mt-3 text-caption text-tertiary-text">{t.caseNote}</p>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-default-border pt-4">
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onConfirm(keepPath, source)}
            disabled={!keepPath || !source}
            className="btn-primary"
          >
            {t.caseConfirm(fileName(keepPath))}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            {common.cancel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
