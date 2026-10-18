import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Folder, Pencil, Trash2 } from 'lucide-react'
import { useT } from '../lib/i18n'

interface RepoGroupSectionProps {
  /** null renders the "Sem pasta" section, which cannot be renamed or deleted. */
  id: string | null
  name: string
  count: number
  collapsed: boolean
  /** Start in edit mode — used right after "Nova pasta" creates one. */
  startEditing?: boolean
  onToggleCollapsed: () => void
  onRename?: (name: string) => void
  onDelete?: () => void
  /** Called when a repo card is dropped anywhere on this section. */
  onDropRepo: (path: string) => void
  children: ReactNode
}

/** Payload key for the repo-card drag; must match InitialView's onDragStart. */
export const REPO_DRAG_TYPE = 'text/plain'

function RepoGroupSection({
  id,
  name,
  count,
  collapsed,
  startEditing,
  onToggleCollapsed,
  onRename,
  onDelete,
  onDropRepo,
  children
}: RepoGroupSectionProps): JSX.Element {
  const t = useT().ui
  const [editing, setEditing] = useState(Boolean(startEditing))
  const [draft, setDraft] = useState(name)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // The section mounts the moment the store has the new group, before the
  // parent learns its id — so the initial state alone never saw
  // startEditing=true and "Nova pasta" landed silently at the bottom.
  useEffect(() => {
    if (startEditing) setEditing(true)
  }, [startEditing])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.select()
    inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [editing])

  function commit(): void {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) onRename?.(trimmed)
    else setDraft(name)
  }

  function handleDrop(e: DragEvent): void {
    e.preventDefault()
    setDragOver(false)
    const path = e.dataTransfer.getData(REPO_DRAG_TYPE)
    if (path) onDropRepo(path)
  }

  // Without preventDefault on dragOver the browser never fires drop at all.
  function handleDragOver(e: DragEvent): void {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  // dragleave bubbles from every child, so moving the pointer between two cards
  // inside this section fires it — clearing the highlight only to have the next
  // dragover restore it, which reads as a flicker. relatedTarget is where the
  // pointer went; only a target outside the section is a real leave. It is null
  // when the pointer leaves the window entirely, which counts as leaving.
  function handleDragLeave(e: DragEvent): void {
    const next = e.relatedTarget
    if (next instanceof Node && e.currentTarget.contains(next)) return
    setDragOver(false)
  }

  return (
    <section
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={
        dragOver
          ? 'rounded-lg border border-dashed border-command-blue bg-command-blue-soft/20 p-2 transition-colors duration-100'
          : 'rounded-lg border border-dashed border-transparent p-2 transition-colors duration-100'
      }
    >
      <div className="group/header mb-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex min-w-0 items-center gap-1.5 rounded-sm py-0.5 pr-1 text-left hover:bg-hover-overlay"
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight size={14} className="shrink-0 text-tertiary-text" aria-hidden />
          ) : (
            <ChevronDown size={14} className="shrink-0 text-tertiary-text" aria-hidden />
          )}
          <Folder size={13} className="shrink-0 text-tertiary-text" aria-hidden />
          {!editing && (
            <>
              <span className="truncate text-label uppercase tracking-wide text-tertiary-text">{name}</span>
              <span className="shrink-0 text-caption tabular-nums text-tertiary-text">({count})</span>
            </>
          )}
        </button>

        {/* Sibling of the toggle, never nested inside it — a form control inside
            a button is invalid markup and the button swallows its events. */}
        {editing && (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setDraft(name)
                setEditing(false)
              }
            }}
            aria-label={t.folderName}
            className="w-44 rounded-sm border border-default-border bg-coal-raised px-1.5 py-0.5 text-label text-primary-text outline-none focus:border-command-blue focus:ring-[3px] focus:ring-command-blue-soft"
          />
        )}

        {id !== null && !editing && (
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover/header:opacity-100">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="hit-area rounded-sm p-1 text-tertiary-text hover:bg-hover-overlay hover:text-secondary-text"
              title={t.renameFolder}
              aria-label={t.renameFolderAria(name)}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="hit-area rounded-sm p-1 text-tertiary-text hover:bg-danger-red-soft hover:text-danger-red"
              title={t.deleteFolder}
              aria-label={t.deleteFolderAria(name)}
            >
              <Trash2 size={13} />
            </button>
          </span>
        )}
      </div>

      {!collapsed &&
        (count === 0 ? (
          <p className="rounded-md border border-dashed border-default-border px-3 py-4 text-center text-caption text-tertiary-text">
            {t.dropReposHere}
          </p>
        ) : (
          children
        ))}
    </section>
  )
}

export default RepoGroupSection
