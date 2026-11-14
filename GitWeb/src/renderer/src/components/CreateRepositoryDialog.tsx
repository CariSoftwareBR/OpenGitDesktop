import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FolderOpen, FolderPlus } from 'lucide-react'
import Github from './icons/Github'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'

/**
 * "Create" on the start screen: a folder, the first commit (on by default —
 * there is nothing to publish without one) and, optionally, publishing to
 * GitHub right after, which opens the publish dialog once the repo is open.
 */
export default function CreateRepositoryDialog({
  open,
  onClose,
  onCreate
}: {
  open: boolean
  onClose: () => void
  onCreate: (path: string, options: { initialCommit: boolean; publish: boolean }) => void
}): JSX.Element | null {
  const t = useT().publish
  const common = useT().common
  const titleId = useId()
  const commitId = useId()
  const publishId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const chooseRef = useRef<HTMLButtonElement>(null)
  const [path, setPath] = useState<string | null>(null)
  const [initialCommit, setInitialCommit] = useState(true)
  const [publish, setPublish] = useState(false)

  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect -- fresh form each time the dialog opens
    setPath(null)
    setInitialCommit(true)
    setPublish(false)
  }, [open])

  useFocusTrap(panelRef, open, { onEscape: onClose, initialFocusRef: chooseRef })

  if (!open) return null

  async function choose(): Promise<void> {
    const picked = await window.api.dialogs.openDirectory()
    if (picked) setPath(picked)
  }

  const options = [
    {
      id: commitId,
      icon: FolderPlus,
      label: t.initialCommit,
      hint: t.initialCommitHint,
      // Publishing needs a commit, so it holds this one on.
      checked: initialCommit || publish,
      disabled: publish,
      onChange: setInitialCommit
    },
    { id: publishId, icon: Github, label: t.alsoPublish, hint: t.alsoPublishHint, checked: publish, disabled: false, onChange: setPublish }
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full min-w-0 max-w-md rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-command-blue/30 bg-command-blue-soft text-command-blue">
            <FolderPlus size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-title font-semibold text-primary-text">
              {t.createTitle}
            </h2>
            <p className="mt-1 text-body text-secondary-text">{t.createLead}</p>
          </div>
        </div>

        <p className="mt-4 text-caption text-secondary-text">{t.folder}</p>
        <div className="mt-1.5 flex min-w-0 items-center gap-2">
          <span
            className={`min-w-0 flex-1 truncate rounded-md border border-default-border bg-midnight-base px-2.5 py-1.5 font-mono text-caption ${
              path ? 'text-primary-text' : 'text-tertiary-text'
            }`}
            title={path ?? undefined}
          >
            {path ?? t.noFolder}
          </span>
          <button ref={chooseRef} type="button" onClick={() => void choose()} className="btn-secondary shrink-0">
            <FolderOpen size={14} aria-hidden /> {t.chooseFolder}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {options.map((option) => {
            const Icon = option.icon
            return (
              <label
                key={option.id}
                htmlFor={option.id}
                className={`flex items-start gap-3 rounded-md border border-default-border bg-coal-raised px-3 py-2.5 ${
                  option.disabled ? 'opacity-70' : 'cursor-pointer hover:border-primary-text/20'
                }`}
              >
                <input
                  id={option.id}
                  type="checkbox"
                  checked={option.checked}
                  disabled={option.disabled}
                  onChange={(e) => option.onChange(e.target.checked)}
                  className="file-check mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-body font-semibold text-primary-text">
                    <Icon size={14} className="text-secondary-text" aria-hidden /> {option.label}
                  </span>
                  <span className="mt-0.5 block text-caption text-secondary-text">{option.hint}</span>
                </span>
              </label>
            )
          })}
        </div>

        {/* Cancel always last, on the far right. */}
        <div className="mt-5 flex justify-end gap-2 border-t border-default-border pt-4">
          <button
            type="button"
            disabled={!path}
            onClick={() => path && onCreate(path, { initialCommit: initialCommit || publish, publish })}
            className="btn-primary"
          >
            {t.createAction}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            {common.cancel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
