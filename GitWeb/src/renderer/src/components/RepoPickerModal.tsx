import { useEffect, useId, useRef, useState } from 'react'
import { FolderGit2 } from 'lucide-react'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'

interface RepoPickerModalProps {
  open: boolean
  repoPaths: string[]
  onConfirm: (selectedPaths: string[]) => void
  onCancel: () => void
}

function RepoPickerModal({ open, repoPaths, onConfirm, onCancel }: RepoPickerModalProps): JSX.Element | null {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const messages = useT()
  const t = messages.ui

  useFocusTrap(panelRef, open, { onEscape: onCancel })

  useEffect(() => {
    if (open) setSelected(new Set(repoPaths))
  }, [open, repoPaths])

  if (!open) return null

  function toggle(path: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const allSelected = selected.size === repoPaths.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={onCancel}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-title font-semibold text-primary-text">
          {t.reposFound(repoPaths.length)}
        </h2>
        <p className="text-body text-secondary-text">{t.pickRepos}</p>

        <button
          type="button"
          onClick={() => setSelected(allSelected ? new Set() : new Set(repoPaths))}
          className="self-start text-caption text-command-blue hover:underline"
        >
          {allSelected ? t.deselectAll : t.selectAll}
        </button>

        <ul className="max-h-72 overflow-y-auto rounded-md border border-default-border">
          {repoPaths.map((path) => {
            const name = path.split(/[/\\]/).pop() ?? path
            return (
              <li key={path}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-hover-overlay">
                  <input
                    type="checkbox"
                    checked={selected.has(path)}
                    onChange={() => toggle(path)}
                    className="size-4 shrink-0 accent-command-blue"
                  />
                  <FolderGit2 size={16} className="shrink-0 text-secondary-text" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body text-primary-text">{name}</span>
                    <span className="truncate text-caption text-tertiary-text">{path}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary">
            {messages.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm([...selected])}
            disabled={selected.size === 0}
            className="btn-primary"
          >
            {t.add(selected.size)}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RepoPickerModal
