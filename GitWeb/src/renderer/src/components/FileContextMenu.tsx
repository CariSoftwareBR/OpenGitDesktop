import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight, ExternalLink, FileClock, FolderOpen, Trash2 } from 'lucide-react'
import { useT } from '../lib/i18n'

export interface FileContextMenuTarget {
  path: string
  /** Conflicted files skip ignore actions. */
  conflicted?: boolean
  /** Untracked files skip git rm --cached after ignore. */
  untracked?: boolean
}

interface FileContextMenuProps {
  open: boolean
  x: number
  y: number
  target: FileContextMenuTarget | null
  onClose: () => void
  onDiscard: (path: string) => void
  onIgnore: (patterns: string[], paths: string[], stopTracking: boolean) => void
  onCopy: (text: string) => void
  onShowInExplorer: (path: string) => void
  onOpenDefault: (path: string) => void
  fullPath: string | null
  fileExists: boolean
  /** Opens the file's timeline and line-by-line authorship. Not offered for new files. */
  onShowTimeline?: (path: string) => void
}

function toIgnorePattern(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '')
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function ancestorFolders(filePath: string): string[] {
  // git status reports an untracked directory as a single entry ending in
  // "/" — that's the folder itself, not a file inside one, so it has no
  // ancestors to offer here (the caller handles it directly).
  if (filePath.replace(/\\/g, '/').endsWith('/')) return []
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length < 2) return []
  const folders: string[] = []
  for (let i = parts.length - 1; i >= 1; i--) {
    folders.push(parts.slice(0, i).join('/'))
  }
  return folders
}

function fileExtension(filePath: string): string {
  const name = filePath.replace(/\\/g, '/').split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return ''
  return name.slice(dot)
}

const ITEM =
  'flex w-full items-center gap-2 rounded-sm px-2.5 py-[7px] text-left text-body text-primary-text transition-colors duration-75 hover:bg-hover-overlay focus-visible:bg-hover-overlay focus-visible:outline-none'
const ITEM_DANGER =
  'flex w-full items-center gap-2 rounded-sm px-2.5 py-[7px] text-left text-body text-danger-red transition-colors duration-75 hover:bg-danger-red-soft focus-visible:bg-danger-red-soft focus-visible:outline-none'
const PANEL =
  'rounded-md border border-default-border bg-obsidian-panel p-1 shadow-floating'

function Separator(): JSX.Element {
  return <div className="my-1 h-px bg-default-border" role="separator" />
}

function FileContextMenu({
  open,
  x,
  y,
  target,
  onClose,
  onDiscard,
  onIgnore,
  onCopy,
  onShowInExplorer,
  onOpenDefault,
  fullPath,
  fileExists,
  onShowTimeline
}: FileContextMenuProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  const folderRowRef = useRef<HTMLDivElement>(null)
  const t = useT().ui
  const g = useT().graph
  const [folderOpen, setFolderOpen] = useState(false)
  const [submenuLeft, setSubmenuLeft] = useState(true)
  const [pos, setPos] = useState({ left: x, top: y })
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setFolderOpen(false)
      return
    }
    const el = ref.current
    if (!el) {
      setPos({ left: x, top: y })
      return
    }
    const rect = el.getBoundingClientRect()
    const left = Math.min(x, window.innerWidth - rect.width - 8)
    const top = Math.min(y, window.innerHeight - rect.height - 8)
    setPos({ left: Math.max(8, left), top: Math.max(8, top) })
  }, [open, x, y])

  useEffect(() => {
    if (!open || !folderOpen || !folderRowRef.current) return
    const row = folderRowRef.current.getBoundingClientRect()
    const submenuWidth = 200
    setSubmenuLeft(row.right + submenuWidth + 8 < window.innerWidth)
  }, [open, folderOpen])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      const root = ref.current
      if (!root) return
      const items = Array.from(root.querySelectorAll<HTMLElement>(':scope > [role="menuitem"], :scope > .relative > [role="menuitem"]'))
      if (items.length === 0) return
      const index = items.indexOf(document.activeElement as HTMLElement)

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = index < 0 ? 0 : (index + 1) % items.length
        items[next].focus()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length
        items[next].focus()
        return
      }
      if (e.key === 'Home') {
        e.preventDefault()
        items[0].focus()
        return
      }
      if (e.key === 'End') {
        e.preventDefault()
        items[items.length - 1].focus()
        return
      }
      if (e.key === 'ArrowRight' && document.activeElement === items.find((el) => el.getAttribute('aria-haspopup') === 'menu')) {
        e.preventDefault()
        setFolderOpen(true)
      }
      if (e.key === 'ArrowLeft' && folderOpen) {
        e.preventDefault()
        setFolderOpen(false)
      }
    }
    function onPointer(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)

    // Focus first actionable item when the menu opens.
    requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]')
      first?.focus()
    })

    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open, onClose, folderOpen])

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  if (!open || !target) return null

  const isDirectory = target.path.replace(/\\/g, '/').endsWith('/')
  const folders = ancestorFolders(target.path)
  const ext = isDirectory ? '' : fileExtension(target.path)
  const relativeNative = target.path.replace(/\//g, '\\')
  const canIgnore = !target.conflicted

  function run(action: () => void): void {
    action()
    onClose()
  }

  function openFolderSubmenu(): void {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setFolderOpen(true)
  }

  function scheduleCloseFolderSubmenu(): void {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setFolderOpen(false), 160)
  }

  return (
    <div
      ref={ref}
      role="menu"
      className={`fixed z-50 min-w-[268px] ${PANEL}`}
      style={{ left: pos.left, top: pos.top }}
    >
      <button
        type="button"
        role="menuitem"
        className={ITEM_DANGER}
        onClick={() => run(() => onDiscard(target.path))}
      >
        <Trash2 size={14} className="shrink-0 opacity-90" aria-hidden />
        <span>{t.discardChanges}</span>
      </button>

      {onShowTimeline && !target.untracked && !isDirectory && (
        <>
          <Separator />
          <button type="button" role="menuitem" className={ITEM} onClick={() => run(() => onShowTimeline(target.path))}>
            <FileClock size={14} className="shrink-0 text-secondary-text" aria-hidden />
            <span>{g.fileInsight}</span>
          </button>
        </>
      )}

      {canIgnore && (
        <>
          <Separator />
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() =>
              run(() => onIgnore([toIgnorePattern(target.path)], [target.path], !target.untracked))
            }
          >
            {isDirectory ? t.ignoreFolder : t.ignoreFile}
          </button>

          {folders.length > 0 && (
            <div
              ref={folderRowRef}
              className="relative"
              onMouseEnter={openFolderSubmenu}
              onMouseLeave={scheduleCloseFolderSubmenu}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={folderOpen}
                className={`${ITEM} ${folderOpen ? 'bg-hover-overlay' : ''}`}
                onClick={() => setFolderOpen((v) => !v)}
              >
                <span className="min-w-0 flex-1 truncate">{t.ignoreFolder}</span>
                <ChevronRight size={14} className="shrink-0 text-tertiary-text" aria-hidden />
              </button>

              {folderOpen && (
                <div
                  role="menu"
                  className={`absolute top-0 z-50 min-w-[180px] ${PANEL} ${
                    submenuLeft ? 'left-full ml-1' : 'right-full mr-1'
                  }`}
                  onMouseEnter={openFolderSubmenu}
                  onMouseLeave={scheduleCloseFolderSubmenu}
                >
                  {folders.map((folder) => (
                    <button
                      key={folder}
                      type="button"
                      role="menuitem"
                      className={ITEM}
                      onClick={() =>
                        run(() => onIgnore([toIgnorePattern(`${folder}/`)], [target.path], !target.untracked))
                      }
                    >
                      /{folder}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {ext && (
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => run(() => onIgnore([`*${ext}`], [target.path], !target.untracked))}
            >
              {t.ignoreExtension(ext)}
            </button>
          )}
        </>
      )}

      <Separator />
      <button type="button" role="menuitem" className={ITEM} onClick={() => run(() => onCopy(fullPath ?? target.path))}>
        {t.copyFullPath}
      </button>
      <button type="button" role="menuitem" className={ITEM} onClick={() => run(() => onCopy(relativeNative))}>
        {t.copyRelativePath}
      </button>

      {fileExists && (
        <>
          <Separator />
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() => run(() => onShowInExplorer(target.path))}
          >
            <FolderOpen size={14} className="shrink-0 text-secondary-text" aria-hidden />
            <span>{t.showInExplorer}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() => run(() => onOpenDefault(target.path))}
          >
            <ExternalLink size={14} className="shrink-0 text-secondary-text" aria-hidden />
            <span>{t.openDefault}</span>
          </button>
        </>
      )}
    </div>
  )
}

export default FileContextMenu
export { toIgnorePattern, ancestorFolders, fileExtension }
