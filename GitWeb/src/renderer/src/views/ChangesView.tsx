import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleHelp,
  FileDiff,
  FileEdit,
  FileMinus,
  FilePlus,
  FileQuestion,
  GitCommitHorizontal,
  GitMerge,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Sparkles,
  Undo2,
  WandSparkles
} from 'lucide-react'
import { splitStatus, useRepoStore } from '../store/repoStore'
import { useAppSettingsStore } from '../store/appSettingsStore'
import { aiNotConfiguredMessage } from '../../../shared/aiPrompts'
import { getActiveAiConfig, isAiConfigured, useAiStore } from '../store/aiStore'
import { useAiUi } from '../lib/useAiUi'
import { generateCommitMessage } from '../lib/ai/commitMessage'
import { captureDust, prefersReducedMotion, type Dust } from '../lib/disintegrate'
import { NARROW_LAYOUT_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import { useClickOutside } from '../lib/useClickOutside'
import { useMenuKeyboard } from '../lib/useMenuKeyboard'
import DiffViewer from '../components/DiffViewer'
import ConflictResolver from '../components/ConflictResolver'
import ConfirmDialog from '../components/ConfirmDialog'
import ProtectedBranchDialog from '../components/ProtectedBranchDialog'
import { directPushBlock } from '../lib/branchProtection'
import type { BranchRules } from '../../../shared/github'
import FileContextMenu, { type FileContextMenuTarget } from '../components/FileContextMenu'
import { basename } from '../lib/path'
import { isConflicted, type StatusEntry } from '../../../shared/git'
import { useLocale, useT } from '../lib/i18n'

type FlatEntry =
  | { kind: 'conflict'; entry: StatusEntry }
  | { kind: 'staged'; entry: StatusEntry }
  | { kind: 'unstaged'; entry: StatusEntry }

type VirtualRow =
  | { key: string; type: 'staged-header'; count: number }
  | { key: string; type: 'unstaged-header'; count: number }
  | { key: string; type: 'file'; kind: 'staged' | 'unstaged'; entry: StatusEntry; flatIdx: number }
  | { key: string; type: 'empty-unstaged' }

const FILE_ROW_ESTIMATE = 36
const SECTION_HEADER_ESTIMATE = 40
const EMPTY_ROW_ESTIMATE = 32

/** Above this many filtered files, eager DOM rows start to jank on scroll. */
const VIRTUALIZE_FILE_THRESHOLD = 60

const MIN_SIDEBAR_WIDTH = 240
const MAX_SIDEBAR_WIDTH = 640
const DEFAULT_SIDEBAR_WIDTH = 340
const MIN_COMMIT_PANEL_HEIGHT = 160
const MAX_COMMIT_PANEL_HEIGHT = 520
const DEFAULT_COMMIT_PANEL_HEIGHT = 280

/** Compact section help — hidden until hover or click (pinned). */
function SectionHint({ text, children, align = 'left' }: { text?: string; children?: ReactNode; align?: 'left' | 'right' }): JSX.Element {
  const [pinned, setPinned] = useState(false)
  const hintId = useId()
  const t = useT().changes

  return (
    <span className="group relative inline-flex shrink-0 items-center">
      <button
        type="button"
        className="hit-area rounded-sm p-0.5 text-tertiary-text transition-colors hover:text-secondary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue"
        aria-label={t.sectionHelp}
        aria-expanded={pinned}
        aria-controls={hintId}
        onClick={(e) => {
          e.stopPropagation()
          setPinned((v) => !v)
        }}
        onBlur={() => setPinned(false)}
      >
        <CircleHelp size={12} aria-hidden />
      </button>
      <span
        id={hintId}
        role="tooltip"
        className={`pointer-events-none absolute top-full z-20 mt-1 w-64 rounded-md border border-default-border bg-coal-raised p-3 text-caption leading-snug text-secondary-text shadow-floating transition-opacity duration-100 ${
          align === 'right' ? 'right-0' : 'left-0'
        } ${pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
      >
        {children ?? text}
      </span>
    </span>
  )
}

function rowId(kind: FlatEntry['kind'], path: string): string {
  return `file-row-${kind}-${encodeURIComponent(path)}`
}

const LAST_COMMIT_MENU =
  'fixed z-30 w-[15.5rem] rounded-md border border-default-border bg-coal-raised p-1 shadow-floating'
const LAST_COMMIT_ITEM =
  'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-caption text-primary-text transition-[background-color,transform] duration-100 hover:bg-hover-overlay focus-visible:bg-hover-overlay focus-visible:outline-none active:scale-[0.98] active:bg-primary-text/15'

function LastCommitMenu({
  disabled,
  muted,
  onUndo,
  onAmend
}: {
  disabled: boolean
  /** The attached commit button is disabled: match its dimmed look at rest so the pair reads as one object. */
  muted: boolean
  onUndo: () => void
  onAmend: () => void
}): JSX.Element {
  const t = useT().changes
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef(false)
  openRef.current = open
  const close = useCallback(() => {
    if (!openRef.current) return
    setOpen(false)
    triggerRef.current?.focus()
  }, [])
  useClickOutside([wrapRef, menuRef], close)
  useMenuKeyboard(menuRef, open, close)

  function toggle(): void {
    if (disabled) return
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const width = 248
      setPos({
        top: rect.top - 6,
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
      })
    }
    setOpen((v) => !v)
  }

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.lastCommitActions}
        title={t.lastCommitActions}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            toggle()
          }
        }}
        // Right half of the split commit button: square where it meets the
        // commit button, rounded on the outside. No press scale, so the two
        // halves never pull apart. While the commit half is disabled this one
        // stays usable but dims to match it, lighting up on hover/focus.
        className={`btn-primary rounded-l-none px-2.5 transition-opacity active:scale-100 ${
          muted && !open ? 'opacity-40 hover:opacity-100 focus-visible:opacity-100' : ''
        }`}
      >
        <MoreHorizontal size={16} aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={t.lastCommitActions}
            style={{ top: pos.top, left: pos.left, transform: 'translateY(-100%)' }}
            className={LAST_COMMIT_MENU}
          >
            <button
              type="button"
              role="menuitem"
              className={LAST_COMMIT_ITEM}
              onClick={() => {
                setOpen(false)
                onUndo()
              }}
            >
              <Undo2 size={14} className="shrink-0 text-tertiary-text" aria-hidden />
              {t.undoLastCommit}
            </button>
            <button
              type="button"
              role="menuitem"
              className={LAST_COMMIT_ITEM}
              onClick={() => {
                setOpen(false)
                onAmend()
              }}
            >
              <Pencil size={14} className="shrink-0 text-tertiary-text" aria-hidden />
              {t.amendLast}
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}

function labelIdFor(kind: 'staged' | 'unstaged', path: string): string {
  return `${kind}-label-${encodeURIComponent(path)}`
}

function UnstagedSectionHeader({
  count,
  bulkAction,
  onStageAll,
  onDiscardAll
}: {
  count: number
  bulkAction: 'stage' | 'unstage' | 'discard' | null
  onStageAll: () => void
  onDiscardAll: () => void
}): JSX.Element {
  const busy = bulkAction !== null
  const t = useT().changes
  return (
    <div role="row" aria-label={t.unstagedRow(count)} className="mt-2 px-3 py-2">
      <div role="gridcell" className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex min-w-0 items-center gap-1.5 text-label uppercase tracking-wide text-tertiary-text">
          {t.unstaged} <span className="count-badge">{count}</span>
          <SectionHint text={t.unstagedHint} />
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDiscardAll}
            disabled={count === 0 || busy}
            title={t.discardGroupTitle}
            aria-label={t.discardAllAria}
            className="flex items-center gap-1.5 text-caption text-danger-red transition-opacity hover:opacity-80 active:opacity-60 disabled:opacity-30"
          >
            {bulkAction === 'discard' && <Loader2 size={12} className="animate-spin" aria-hidden />}
            {bulkAction === 'discard' ? t.discarding : t.discardAll}
          </button>
          <button
            type="button"
            onClick={onStageAll}
            disabled={count === 0 || busy}
            className="flex items-center gap-1.5 text-caption text-command-blue transition-opacity hover:opacity-80 active:opacity-60 disabled:opacity-30"
          >
            {bulkAction === 'stage' && <Loader2 size={12} className="animate-spin" aria-hidden />}
            {bulkAction === 'stage' ? t.staging : t.stageAll}
          </button>
        </span>
      </div>
    </div>
  )
}

function StatusIcon({ entry }: { entry: StatusEntry }): JSX.Element {
  const code = entry.index !== ' ' && entry.index !== '?' ? entry.index : entry.worktree
  switch (code) {
    case 'A':
      return <FilePlus size={14} className="shrink-0 text-success-green" aria-hidden />
    case 'D':
      return <FileMinus size={14} className="shrink-0 text-danger-red" aria-hidden />
    case '?':
      return <FileQuestion size={14} className="shrink-0 text-tertiary-text" aria-hidden />
    default:
      return <FileEdit size={14} className="shrink-0 text-attention-orange" aria-hidden />
  }
}

function ChangesView(): JSX.Element {
  const status = useRepoStore((s) => s.status)
  const selectedFile = useRepoStore((s) => s.selectedFile)
  const diffText = useRepoStore((s) => s.diffText)
  const conflictContent = useRepoStore((s) => s.conflictContent)
  const isBusy = useRepoStore((s) => s.isBusy)
  const branches = useRepoStore((s) => s.branches)
  const selectFile = useRepoStore((s) => s.selectFile)
  const clearSelectedFile = useRepoStore((s) => s.clearSelectedFile)
  const stagePaths = useRepoStore((s) => s.stagePaths)
  const unstagePaths = useRepoStore((s) => s.unstagePaths)
  const discardPaths = useRepoStore((s) => s.discardPaths)
  const ignorePatterns = useRepoStore((s) => s.ignorePatterns)
  const commitChanges = useRepoStore((s) => s.commitChanges)
  const createBranch = useRepoStore((s) => s.createBranch)
  const [protectedBlock, setProtectedBlock] = useState<{ branch: string; rules: BranchRules } | null>(null)
  const undoLastCommit = useRepoStore((s) => s.undoLastCommit)
  const amendCommit = useRepoStore((s) => s.amendCommit)
  const applyHunk = useRepoStore((s) => s.applyHunk)
  const isHunkBusy = useRepoStore((s) => s.isHunkBusy)
  const log = useRepoStore((s) => s.log)
  const abortMerge = useRepoStore((s) => s.abortMerge)
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const clearError = useRepoStore((s) => s.clearError)
  const commitAndPush = useAppSettingsStore((s) => s.settings?.commitAndPush ?? false)
  const aiSettings = useAiStore((s) => s.settings)
  const aiApiKey = useAiStore((s) => s.apiKey)
  const aiLanguage = useLocale()
  const aiNotConfigured = aiNotConfiguredMessage(aiLanguage)
  const t = useT().changes
  const ui = useAiUi()
  const aiBusy = useAiStore((s) => s.isBusy)
  const explainDiff = useAiStore((s) => s.explainDiff)
  const aiConfigured = isAiConfigured(aiSettings, aiApiKey)

  // For an untracked file `diffText` holds the file's raw content, so a checked-in
  // .patch/.diff would look like a real diff and offer hunk actions that would then
  // apply unrelated content. Decide from the status entry, not from the text.
  const hunkMode = useMemo<'stage' | 'unstage' | 'none'>(() => {
    if (!selectedFile || selectedFile.conflicted) return 'none'
    const entry = status?.entries.find((item) => item.path === selectedFile.path)
    if (!entry || (entry.index === '?' && entry.worktree === '?')) return 'none'
    if (!diffText.startsWith('diff ')) return 'none'
    return selectedFile.staged ? 'unstage' : 'stage'
  }, [selectedFile, status, diffText])

  const summary = useRepoStore((s) => s.commitSummary)
  const description = useRepoStore((s) => s.commitDescription)
  const setCommitDraft = useRepoStore((s) => s.setCommitDraft)
  const setSummary = (value: string): void => setCommitDraft({ summary: value })
  const setDescription = (value: string): void => setCommitDraft({ description: value })
  const [filter, setFilter] = useState('')
  const [generating, setGenerating] = useState(false)
  const [committing, setCommitting] = useState(false)
  const commitDustRef = useRef<{ dust: Dust; paths: Set<string>; left: boolean } | null>(null)
  // Synchronous twin of `committing`: two quick Ctrl+Enter presses both land
  // before the re-render that would disable the shortcut.
  const committingRef = useRef(false)
  const commitPanelRef = useRef<HTMLDivElement>(null)
  const [justCommitted, setJustCommitted] = useState(false)
  const [bulkAction, setBulkAction] = useState<'stage' | 'unstage' | 'discard' | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [confirm, setConfirm] = useState<
    | { type: 'abort' }
    | { type: 'discard'; paths: string[] }
    | { type: 'undo' }
    | { type: 'amend' }
    | null
  >(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [commitPanelHeight, setCommitPanelHeight] = useState(DEFAULT_COMMIT_PANEL_HEIGHT)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    target: FileContextMenuTarget
    fullPath: string | null
    fileExists: boolean
  } | null>(null)
  const draggingRef = useRef(false)
  const commitPanelDraggingRef = useRef(false)

  const listRef = useRef<HTMLDivElement>(null)
  const summaryId = useId()
  const statusRegionId = useId()
  const narrow = useMediaQuery(NARROW_LAYOUT_QUERY)
  const showFileDetail = narrow && selectedFile !== null

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      draggingRef.current = true
      const startX = e.clientX
      const startWidth = sidebarWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(moveEvent: MouseEvent): void {
        if (!draggingRef.current) return
        const next = startWidth + (moveEvent.clientX - startX)
        setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, next)))
      }
      function onMouseUp(): void {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [sidebarWidth]
  )

  const handleCommitPanelResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      commitPanelDraggingRef.current = true
      const startY = e.clientY
      const startHeight = commitPanelHeight
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(moveEvent: MouseEvent): void {
        if (!commitPanelDraggingRef.current) return
        // Dragging the top edge: moving up grows the panel.
        const next = startHeight - (moveEvent.clientY - startY)
        setCommitPanelHeight(Math.min(MAX_COMMIT_PANEL_HEIGHT, Math.max(MIN_COMMIT_PANEL_HEIGHT, next)))
      }
      function onMouseUp(): void {
        commitPanelDraggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [commitPanelHeight]
  )

  const { staged, unstaged, conflicted } = splitStatus(status)
  const currentBranch = branches.find((b) => b.isCurrent)?.name ?? status?.branch ?? 'main'

  const filteredStaged = useMemo(
    () => staged.filter((e) => e.path.toLowerCase().includes(filter.toLowerCase())),
    [staged, filter]
  )
  const filteredUnstaged = useMemo(
    () => unstaged.filter((e) => e.path.toLowerCase().includes(filter.toLowerCase())),
    [unstaged, filter]
  )
  const stagedPaths = useMemo(() => new Set(staged.map((e) => e.path)), [staged])
  const totalCount = staged.length + unstaged.length + conflicted.length
  const canConcludeMerge = Boolean(status?.mergeInProgress) && conflicted.length === 0

  const flatEntries = useMemo<FlatEntry[]>(() => {
    return [
      ...conflicted.map((entry) => ({ kind: 'conflict' as const, entry })),
      ...filteredStaged.map((entry) => ({ kind: 'staged' as const, entry })),
      ...filteredUnstaged.map((entry) => ({ kind: 'unstaged' as const, entry }))
    ]
  }, [conflicted, filteredStaged, filteredUnstaged])

  const virtualRows = useMemo<VirtualRow[]>(() => {
    const indexByKey = new Map<string, number>()
    flatEntries.forEach((f, i) => indexByKey.set(`${f.kind}:${f.entry.path}`, i))

    const rows: VirtualRow[] = [{ key: 'staged-header', type: 'staged-header', count: filteredStaged.length }]
    for (const entry of filteredStaged) {
      rows.push({
        key: `staged:${entry.path}`,
        type: 'file',
        kind: 'staged',
        entry,
        flatIdx: indexByKey.get(`staged:${entry.path}`) ?? -1
      })
    }
    rows.push({ key: 'unstaged-header', type: 'unstaged-header', count: filteredUnstaged.length })
    if (filteredUnstaged.length === 0) {
      rows.push({ key: 'empty-unstaged', type: 'empty-unstaged' })
    } else {
      for (const entry of filteredUnstaged) {
        rows.push({
          key: `unstaged:${entry.path}`,
          type: 'file',
          kind: 'unstaged',
          entry,
          flatIdx: indexByKey.get(`unstaged:${entry.path}`) ?? -1
        })
      }
    }
    return rows
  }, [filteredStaged, filteredUnstaged, flatEntries])

  const shouldVirtualize = filteredStaged.length + filteredUnstaged.length >= VIRTUALIZE_FILE_THRESHOLD

  const fileVirtualizer = useVirtualizer({
    count: shouldVirtualize ? virtualRows.length : 0,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index]
      if (!row) return FILE_ROW_ESTIMATE
      if (row.type === 'staged-header' || row.type === 'unstaged-header') return SECTION_HEADER_ESTIMATE
      if (row.type === 'empty-unstaged') return EMPTY_ROW_ESTIMATE
      return FILE_ROW_ESTIMATE
    },
    // Keyed like the rows themselves: staging moves a file between sections,
    // and index-keyed measurements would then belong to a different row.
    getItemKey: (index) => virtualRows[index]?.key ?? index,
    overscan: 16
  })

  useEffect(() => {
    if (focusIndex >= flatEntries.length) setFocusIndex(Math.max(0, flatEntries.length - 1))
  }, [flatEntries.length, focusIndex])

  useEffect(() => {
    if (narrow) return
    if (totalCount === 0) {
      // Nothing left to show: drop a selection that points at a file which is
      // no longer changed (e.g. a conflict resolved to the current version).
      if (selectedFile) clearSelectedFile()
      return
    }
    const current = selectedFile
    const stillPresent =
      current !== null &&
      (current.conflicted
        ? conflicted.some((e) => e.path === current.path)
        : current.staged
          ? staged.some((e) => e.path === current.path)
          : unstaged.some((e) => e.path === current.path))
    if (stillPresent) return
    const first = conflicted[0] ?? staged[0] ?? unstaged[0]
    if (!first) return
    const isStaged = staged.some((e) => e.path === first.path) && !conflicted.some((e) => e.path === first.path)
    void selectFile(first.path, isStaged)
  }, [narrow, totalCount, selectedFile, conflicted, staged, unstaged, selectFile])

  useEffect(() => {
    if (!shouldVirtualize) return
    const item = flatEntries[focusIndex]
    if (!item || item.kind === 'conflict') return
    const rowIndex = virtualRows.findIndex(
      (r) => r.type === 'file' && r.kind === item.kind && r.entry.path === item.entry.path
    )
    if (rowIndex >= 0) fileVirtualizer.scrollToIndex(rowIndex, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to focus changes
  }, [focusIndex, shouldVirtualize])

  /** The on-screen band of the staged rows, clipped to the list's viewport. */
  function stagedRowsRect(): DOMRect | null {
    const list = listRef.current
    if (!list) return null
    const rows = list.querySelectorAll<HTMLElement>('[id^="file-row-staged-"]')
    if (rows.length === 0) return null
    const bounds = list.getBoundingClientRect()
    let top = Infinity
    let bottom = -Infinity
    rows.forEach((row) => {
      const r = row.getBoundingClientRect()
      top = Math.min(top, r.top)
      bottom = Math.max(bottom, r.bottom)
    })
    top = Math.max(top, bounds.top)
    bottom = Math.min(bottom, bounds.bottom)
    return bottom > top ? new DOMRect(bounds.left, top, bounds.width, bottom - top) : null
  }

  async function handleCommit(): Promise<void> {
    // Ctrl+Enter reaches here too, so the in-flight generation guard lives
    // here and not only on the button.
    if (committingRef.current || generating) return
    if (!canConcludeMerge && (!summary.trim() || staged.length === 0)) return
    committingRef.current = true
    setCommitting(true)
    setAiError(null)
    try {
      // Asked here as well as in the store so the answer is a dialog that
      // offers the way out, not just an error banner.
      const block = await directPushBlock(status)
      if (block) {
        setProtectedBlock(block)
        return
      }

      // Snapshot the staged rows before committing. When they leave the list
      // the snapshot freezes in their place (layout effect below), and they
      // only turn to dust once the whole operation — push included — is done.
      const rect = prefersReducedMotion() ? null : stagedRowsRect()
      if (rect) {
        const dust = await captureDust(rect, { mount: false }).catch(() => null)
        commitDustRef.current = dust && { dust, paths: new Set(staged.map((e) => e.path)), left: false }
      }
      await commitChanges(summary.trim(), description.trim())
      if (useRepoStore.getState().error) return
      setSummary('')
      setDescription('')
      setJustCommitted(true)
      const success = commitAndPush ? t.committedAndPushed(currentBranch) : t.committed(currentBranch)
      setLiveMessage(success)
      setTimeout(() => setJustCommitted(false), 1800)
    } finally {
      committingRef.current = false
      setCommitting(false)
      // Dust in step with the button coming back. If the rows left, the commit
      // landed (even if a push after it failed); if not, it failed: no dust.
      const pending = commitDustRef.current
      commitDustRef.current = null
      if (pending?.left) void pending.dust.play()
      else pending?.dust.discard()
    }
  }

  // Before paint, so the rows never blink out ahead of their frozen snapshot.
  // Only once none of the snapshotted files is staged any more — a status
  // refresh from elsewhere mid-commit mustn't set it off early.
  useLayoutEffect(() => {
    const pending = commitDustRef.current
    if (!pending || pending.left || staged.some((e) => pending.paths.has(e.path))) return
    pending.left = true
    pending.dust.mount()
  }, [staged])

  async function handleGenerateWithAi(): Promise<void> {
    if (!currentRepoPath || staged.length === 0) return
    setGenerating(true)
    setAiError(null)
    try {
      const { settings, apiKey } = await getActiveAiConfig()
      const diff = await window.api.git.diffStagedAll(currentRepoPath)
      const statusText = staged.map((e) => `${e.index}${e.worktree} ${e.path}`).join('\n')
      const generated = await generateCommitMessage(settings, apiKey, currentBranch, statusText, diff)
      setSummary(generated.summary)
      setDescription(generated.description)
      setLiveMessage(t.aiSummaryGenerated)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  function requestDiscard(paths: string | string[]): void {
    const list = Array.isArray(paths) ? paths : [paths]
    if (list.length === 0) return
    setConfirm({ type: 'discard', paths: list })
  }

  function requestDiscardAll(): void {
    requestDiscard(filteredUnstaged.map((e) => e.path))
  }

  async function openFileContextMenu(e: React.MouseEvent, entry: StatusEntry): Promise<void> {
    e.preventDefault()
    e.stopPropagation()
    const untracked = entry.index === '?' && entry.worktree === '?'
    const conflicted = isConflicted(entry)
    let fullPath: string | null = null
    let fileExists = false
    if (currentRepoPath) {
      try {
        fullPath = await window.api.fs.resolveRepoPath(currentRepoPath, entry.path)
        fileExists = await window.api.fs.pathExists(fullPath)
      } catch {
        fullPath = null
        fileExists = false
      }
    }
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target: { path: entry.path, conflicted, untracked },
      fullPath,
      fileExists
    })
  }

  async function handleCopyPath(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      setLiveMessage(t.pathCopied)
    } catch {
      setLiveMessage(t.pathCopyFailed)
    }
  }

  async function handleShowInExplorer(path: string): Promise<void> {
    if (!currentRepoPath) return
    try {
      await window.api.shell.showItemInFolder(currentRepoPath, path)
    } catch (err) {
      setLiveMessage(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleOpenDefault(path: string): Promise<void> {
    if (!currentRepoPath) return
    try {
      await window.api.shell.openPath(currentRepoPath, path)
    } catch (err) {
      setLiveMessage(err instanceof Error ? err.message : String(err))
    }
  }

  function toggleStage(entry: StatusEntry): void {
    if (stagedPaths.has(entry.path)) unstagePaths([entry.path])
    else stagePaths([entry.path])
  }

  async function handleStageAll(): Promise<void> {
    setBulkAction('stage')
    try {
      await stagePaths(filteredUnstaged.map((e) => e.path))
      setLiveMessage(t.stagedCount(filteredUnstaged.length))
    } finally {
      setBulkAction(null)
    }
  }

  async function handleUnstageAll(): Promise<void> {
    setBulkAction('unstage')
    try {
      await unstagePaths(filteredStaged.map((e) => e.path))
      setLiveMessage(t.unstagedCount(filteredStaged.length))
    } finally {
      setBulkAction(null)
    }
  }

  function selectFlat(index: number): void {
    const item = flatEntries[index]
    if (!item) return
    setFocusIndex(index)
    if (item.kind === 'conflict') selectFile(item.entry.path, false)
    else if (item.kind === 'staged') selectFile(item.entry.path, true)
    else selectFile(item.entry.path, false)
  }

  function handleListKeyDown(e: React.KeyboardEvent): void {
    if (flatEntries.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectFlat(Math.min(focusIndex + 1, flatEntries.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectFlat(Math.max(focusIndex - 1, 0))
      return
    }
    if (e.key === ' ' || e.key === 'Enter') {
      const item = flatEntries[focusIndex]
      if (!item || item.kind === 'conflict') return
      e.preventDefault()
      toggleStage(item.entry)
    }
  }

  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent): void {
      if (confirm) return
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        // Typing elsewhere (the docked AI chat, a dialog) must not commit:
        // Ctrl+Enter there means "send", and the summary may already be filled.
        if (typing && !(target && commitPanelRef.current?.contains(target))) return
        e.preventDefault()
        void handleCommit()
        return
      }
      if (typing) return
      if (e.key === 's' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault()
        void handleStageAll()
        return
      }
      if (e.key === 'u' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault()
        void handleUnstageAll()
      }
    }
    window.addEventListener('keydown', onGlobalKey)
    return () => window.removeEventListener('keydown', onGlobalKey)
    // Intentional: handlers close over latest state via this effect's deps of the values they read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, summary, generating, staged.length, filteredUnstaged, filteredStaged, commitAndPush, currentBranch])

  async function runConfirmed(): Promise<void> {
    if (!confirm) return
    const action = confirm
    setConfirm(null)
    if (action.type === 'abort') {
      clearError()
      await abortMerge()
      setLiveMessage(t.mergeAborted)
      return
    }
    if (action.type === 'undo') {
      await undoLastCommit()
      setLiveMessage(t.lastCommitUndone)
      return
    }
    if (action.type === 'amend') {
      await amendCommit(summary.trim() || undefined, description.trim() || undefined)
      setLiveMessage(t.lastCommitAmended)
      return
    }
    if (action.paths.length > 1) setBulkAction('discard')
    try {
      await discardPaths(action.paths)
      setLiveMessage(
        action.paths.length === 1 ? t.discardedOne(action.paths[0]) : t.discardedMany(action.paths.length)
      )
    } finally {
      setBulkAction(null)
    }
  }

  function isRowFocused(kind: FlatEntry['kind'], path: string): boolean {
    const item = flatEntries[focusIndex]
    return item?.kind === kind && item.entry.path === path
  }

  // New (untracked) files go to the OS trash on discard; changes to tracked
  // files are restored from git and really are gone — say which applies.
  function discardMessage(paths: string[]): string {
    const untrackedPaths = new Set(
      (status?.entries ?? []).filter((e) => e.index === '?' && e.worktree === '?').map((e) => e.path)
    )
    const newCount = paths.filter((p) => untrackedPaths.has(p)).length
    const subject =
      paths.length === 1 ? t.discardSubjectOne(basename(paths[0])) : t.discardSubjectMany(paths.length)
    if (newCount === paths.length) {
      return paths.length === 1 ? t.discardNewOne(basename(paths[0])) : t.discardNewMany(paths.length)
    }
    const trashNote = newCount > 0 ? t.discardTrashNote(newCount) : ''
    return t.discardLost(subject, trashNote)
  }

  const commitLabel = committing
    ? t.committing
    : justCommitted
      ? t.commitCreated
      : canConcludeMerge
        ? commitAndPush
          ? t.concludeMergeAndPush
          : t.concludeMerge
        : commitAndPush
          ? t.commitAndPushTo(currentBranch)
          : t.commitTo(currentBranch)

  const commitButtonDisabled =
    isBusy || committing || generating || (!canConcludeMerge && (!summary.trim() || staged.length === 0))

  const commitDisabledReason = canConcludeMerge
    ? null
    : totalCount === 0
      ? null
      : generating
        ? t.waitForAgent
        : staged.length === 0
        ? t.stageAtLeastOne
        : !summary.trim()
          ? t.writeSummary
          : null

  return (
    <div className="flex h-full">
      <h1 className="sr-only">{t.title}</h1>
      <div
        className={`flex flex-col overflow-hidden bg-obsidian-panel ${narrow ? (showFileDetail ? 'hidden' : 'min-w-0 w-full') : 'shrink-0'}`}
        style={narrow ? undefined : { width: sidebarWidth }}
      >
        <div id={statusRegionId} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </div>

        {canConcludeMerge && (
          <section className="border-b border-warning-amber/20 bg-warning-amber-soft p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-label uppercase tracking-wide text-warning-amber">
              <GitMerge size={13} aria-hidden /> {t.mergeInProgress}
            </h2>
            <p className="mb-2 text-caption text-secondary-text">{t.mergeResolvedHint}</p>
            <button
              type="button"
              onClick={() => setConfirm({ type: 'abort' })}
              disabled={isBusy}
              className="btn-secondary w-full justify-center border-warning-amber/40 text-warning-amber"
            >
              {t.abortMerge}
            </button>
          </section>
        )}

        {conflicted.length > 0 && (
          <section className="border-b border-warning-amber/20 bg-warning-amber-soft p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-label uppercase tracking-wide text-warning-amber">
              <AlertTriangle size={13} aria-hidden /> {t.conflicts}
              <span className="count-badge bg-warning-amber/20 text-warning-amber">{conflicted.length}</span>
            </h2>
            <p className="mb-2 text-caption text-secondary-text">{t.conflictsHint}</p>
            <ul className="flex flex-col gap-0.5">
              {conflicted.map((entry) => {
                const flatIdx = flatEntries.findIndex((f) => f.kind === 'conflict' && f.entry.path === entry.path)
                return (
                  <li key={entry.path} onContextMenu={(e) => void openFileContextMenu(e, entry)}>
                    <button
                      type="button"
                      onClick={() => selectFlat(flatIdx)}
                      className={`list-row w-full text-left ${selectedFile?.path === entry.path ? 'is-selected' : ''} [--row-accent:var(--color-warning-amber)] ${isRowFocused('conflict', entry.path) ? 'ring-1 ring-command-blue/50' : ''}`}
                    >
                      <AlertTriangle size={14} className="shrink-0 text-warning-amber" aria-hidden />
                      <span className="truncate text-body text-primary-text" title={entry.path}>
                        {entry.path}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={() => setConfirm({ type: 'abort' })}
              disabled={isBusy}
              className="btn-secondary mt-2 w-full justify-center border-warning-amber/40 text-warning-amber"
            >
              {t.abortMerge}
            </button>
          </section>
        )}

        <div className="p-3 pb-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t.filterFiles}
              aria-label={t.filterFiles}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="field flex-1"
            />
            <SectionHint align="right">
              <p className="mb-2 font-medium text-primary-text">{t.shortcuts}</p>
              <dl className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="kbd">↑ ↓</dt>
                  <dd className="text-right">{t.shortcutNavigate}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="kbd">{t.keySpace}</dt>
                  <dd className="text-right">{t.shortcutToggle}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="kbd">Ctrl + Enter</dt>
                  <dd className="text-right">{t.shortcutCommit}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="kbd">Ctrl + Shift + S</dt>
                  <dd className="text-right">{t.shortcutStageAll}</dd>
                </div>
              </dl>
            </SectionHint>
          </div>
        </div>

        {totalCount === 0 && committing ? (
          // The rows leave as soon as the commit lands, but their frozen dust
          // snapshot stays until the whole operation (push included) is done.
          // Hold the empty state until then so it arrives with the crumble.
          <div className="min-h-0 flex-1" />
        ) : totalCount === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <span className="empty-medallion rise-in mb-1 text-success-green">
              <Check size={20} aria-hidden />
            </span>
            <p className="text-title font-semibold text-primary-text">{t.cleanTree}</p>
            <p className="max-w-[240px] text-caption text-secondary-text">{t.cleanTreeHint}</p>
          </div>
        ) : (
          <div
            ref={listRef}
            tabIndex={0}
            role="grid"
            aria-label={t.changedFiles}
            aria-activedescendant={
              flatEntries[focusIndex]
                ? rowId(flatEntries[focusIndex].kind, flatEntries[focusIndex].entry.path)
                : undefined
            }
            onKeyDown={handleListKeyDown}
            className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-command-blue"
          >
            {shouldVirtualize ? (
              <div className="relative w-full" style={{ height: fileVirtualizer.getTotalSize() }}>
                {fileVirtualizer.getVirtualItems().map((vRow) => {
                  const row = virtualRows[vRow.index]
                  return (
                    <div
                      key={row.key}
                      data-index={vRow.index}
                      ref={fileVirtualizer.measureElement}
                      className="absolute top-0 left-0 w-full"
                      style={{ transform: `translateY(${vRow.start}px)` }}
                    >
                      {row.type === 'staged-header' ? (
                        <div role="row" aria-label={t.stagedRow(row.count)} className="px-3 py-2">
                          <div role="gridcell" className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-label uppercase tracking-wide text-tertiary-text">
                              {t.staged} <span className="count-badge">{row.count}</span>
                              <SectionHint text={t.stagedHint} />
                            </span>
                            <button
                              type="button"
                              onClick={handleUnstageAll}
                              disabled={row.count === 0 || bulkAction !== null}
                              className="flex items-center gap-1.5 text-caption text-command-blue transition-opacity hover:opacity-80 active:opacity-60 disabled:opacity-30"
                            >
                              {bulkAction === 'unstage' && <Loader2 size={12} className="animate-spin" aria-hidden />}
                              {bulkAction === 'unstage' ? t.unstaging : t.unstageAll}
                            </button>
                          </div>
                        </div>
                      ) : row.type === 'unstaged-header' ? (
                        <UnstagedSectionHeader
                          count={row.count}
                          bulkAction={bulkAction}
                          onStageAll={handleStageAll}
                          onDiscardAll={requestDiscardAll}
                        />
                      ) : row.type === 'empty-unstaged' ? (
                        <div role="row">
                          <p role="gridcell" className="px-3 py-2 text-caption text-tertiary-text">{t.noUnstaged}</p>
                        </div>
                      ) : (
                        (() => {
                          const { entry, kind, flatIdx } = row
                          const labelId = labelIdFor(kind, entry.path)
                          const staged = kind === 'staged'
                          return (
                            <ul role="presentation" className={`px-1.5 ${bulkAction === (staged ? 'unstage' : 'stage') || (!staged && bulkAction === 'discard') ? 'pointer-events-none opacity-40' : ''}`}>
                              <li
                                id={rowId(kind, entry.path)}
                                role="row"
                                aria-label={staged ? t.fileRowStaged(entry.path) : t.fileRowUnstaged(entry.path)}
                                aria-selected={selectedFile?.path === entry.path && selectedFile.staged === staged}
                                onContextMenu={(e) => void openFileContextMenu(e, entry)}
                                className={`list-row py-1.5 pr-1.5 ${selectedFile?.path === entry.path && selectedFile.staged === staged ? 'is-selected' : ''} ${isRowFocused(kind, entry.path) ? 'ring-1 ring-command-blue/50' : ''}`}
                              >
                                <div role="gridcell" className="flex min-w-0 flex-1 items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={staged}
                                    aria-labelledby={labelId}
                                    onChange={() => toggleStage(entry)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="size-4 shrink-0 accent-command-blue"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => selectFlat(flatIdx)}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                  >
                                    <StatusIcon entry={entry} />
                                    <span id={labelId} className="truncate text-body text-primary-text" title={entry.path}>
                                      {entry.path}
                                    </span>
                                  </button>
                                  {!staged && (
                                    <button
                                      type="button"
                                      title={t.discard}
                                      aria-label={t.discardFileAria(entry.path)}
                                      onClick={() => requestDiscard(entry.path)}
                                      className="shrink-0 rounded-sm p-1.5 text-tertiary-text transition-colors hover:bg-hover-overlay hover:text-danger-red active:scale-95"
                                    >
                                      <RotateCcw size={13} aria-hidden />
                                    </button>
                                  )}
                                </div>
                              </li>
                            </ul>
                          )
                        })()
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <>
            <div role="row" aria-label={t.stagedRow(filteredStaged.length)} className="px-3 py-2">
              <div role="gridcell" className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-label uppercase tracking-wide text-tertiary-text">
                  {t.staged} <span className="count-badge">{filteredStaged.length}</span>
                  <SectionHint text={t.stagedHint} />
                </span>
                <button
                  type="button"
                  onClick={handleUnstageAll}
                  disabled={filteredStaged.length === 0 || bulkAction !== null}
                  className="flex items-center gap-1.5 text-caption text-command-blue transition-opacity hover:opacity-80 active:opacity-60 disabled:opacity-30"
                >
                  {bulkAction === 'unstage' && <Loader2 size={12} className="animate-spin" aria-hidden />}
                  {bulkAction === 'unstage' ? t.unstaging : t.unstageAll}
                </button>
              </div>
            </div>
            <ul role="presentation" className={`flex flex-col gap-0.5 px-1.5 transition-opacity duration-150 ${bulkAction === 'unstage' ? 'pointer-events-none opacity-40' : ''}`}>
              {filteredStaged.map((entry) => {
                const labelId = labelIdFor('staged', entry.path)
                const flatIdx = flatEntries.findIndex((f) => f.kind === 'staged' && f.entry.path === entry.path)
                return (
                  <li
                    key={entry.path}
                    id={rowId('staged', entry.path)}
                    role="row"
                    aria-label={t.fileRowStaged(entry.path)}
                    aria-selected={selectedFile?.path === entry.path && selectedFile.staged}
                    onContextMenu={(e) => void openFileContextMenu(e, entry)}
                    className={`list-row py-1.5 pr-1.5 ${selectedFile?.path === entry.path && selectedFile.staged ? 'is-selected' : ''} ${isRowFocused('staged', entry.path) ? 'ring-1 ring-command-blue/50' : ''}`}
                  >
                    <div role="gridcell" className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked
                        aria-labelledby={labelId}
                        onChange={() => toggleStage(entry)}
                        onClick={(e) => e.stopPropagation()}
                        className="size-4 shrink-0 accent-command-blue"
                      />
                      <button
                        type="button"
                        onClick={() => selectFlat(flatIdx)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <StatusIcon entry={entry} />
                        <span id={labelId} className="truncate text-body text-primary-text" title={entry.path}>
                          {entry.path}
                        </span>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            <UnstagedSectionHeader
              count={filteredUnstaged.length}
              bulkAction={bulkAction}
              onStageAll={handleStageAll}
              onDiscardAll={requestDiscardAll}
            />
            <ul role="presentation" className={`flex flex-col gap-0.5 px-1.5 transition-opacity duration-150 ${bulkAction === 'stage' || bulkAction === 'discard' ? 'pointer-events-none opacity-40' : ''}`}>
              {filteredUnstaged.map((entry) => {
                const labelId = labelIdFor('unstaged', entry.path)
                const flatIdx = flatEntries.findIndex((f) => f.kind === 'unstaged' && f.entry.path === entry.path)
                return (
                  <li
                    key={entry.path}
                    id={rowId('unstaged', entry.path)}
                    role="row"
                    aria-label={t.fileRowUnstaged(entry.path)}
                    aria-selected={selectedFile?.path === entry.path && !selectedFile.staged}
                    onContextMenu={(e) => void openFileContextMenu(e, entry)}
                    className={`list-row py-1.5 pr-1.5 ${selectedFile?.path === entry.path && !selectedFile.staged ? 'is-selected' : ''} ${isRowFocused('unstaged', entry.path) ? 'ring-1 ring-command-blue/50' : ''}`}
                  >
                    <div role="gridcell" className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={false}
                        aria-labelledby={labelId}
                        onChange={() => toggleStage(entry)}
                        onClick={(e) => e.stopPropagation()}
                        className="size-4 shrink-0 accent-command-blue"
                      />
                      <button
                        type="button"
                        onClick={() => selectFlat(flatIdx)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <StatusIcon entry={entry} />
                        <span id={labelId} className="truncate text-body text-primary-text" title={entry.path}>
                          {entry.path}
                        </span>
                      </button>
                      <button
                        type="button"
                        title={t.discard}
                        aria-label={t.discardFileAria(entry.path)}
                        onClick={() => requestDiscard(entry.path)}
                        className="shrink-0 rounded-sm p-1.5 text-tertiary-text transition-colors hover:bg-hover-overlay hover:text-danger-red active:scale-95"
                      >
                        <RotateCcw size={13} aria-hidden />
                      </button>
                    </div>
                  </li>
                )
              })}
              {filteredUnstaged.length === 0 && (
                <li role="row" className="px-2 py-2 text-caption text-tertiary-text">
                  <span role="gridcell">{t.noUnstaged}</span>
                </li>
              )}
            </ul>
              </>
            )}
          </div>
        )}

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t.resizeCommitPanel}
          aria-valuemin={MIN_COMMIT_PANEL_HEIGHT}
          aria-valuemax={MAX_COMMIT_PANEL_HEIGHT}
          aria-valuenow={commitPanelHeight}
          tabIndex={0}
          onMouseDown={handleCommitPanelResizeStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCommitPanelHeight((h) => Math.min(MAX_COMMIT_PANEL_HEIGHT, h + 16))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCommitPanelHeight((h) => Math.max(MIN_COMMIT_PANEL_HEIGHT, h - 16))
            }
          }}
          className="h-1.5 shrink-0 cursor-row-resize border-t border-default-border bg-transparent transition-colors hover:bg-command-blue/40 active:bg-command-blue/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
        />

        <div
          ref={commitPanelRef}
          className="flex shrink-0 flex-col gap-2 overflow-y-auto border-t border-default-border bg-obsidian-panel p-3"
          style={{ height: commitPanelHeight }}
        >
          <h2 className="shrink-0 text-label uppercase tracking-wide text-tertiary-text">{t.commitHeading}</h2>
          {aiError && (
            <div className="flex items-start gap-2 rounded-md border border-danger-red/30 bg-danger-red-soft px-2.5 py-2 text-caption text-danger-red" role="alert">
              <span className="flex-1">{aiError}</span>
              <button type="button" className="underline" onClick={() => setAiError(null)} aria-label={t.dismissAiError}>
                {t.close}
              </button>
            </div>
          )}

          {/* Summary, description and the AI action share one bordered object so
              the panel reads as a single composer instead of three stacked boxes.
              `.field` supplies the system border, hover and focus-within ring; the
              children stay transparent and borderless inside it. */}
          <div
            className={`field flex shrink-0 grow basis-auto flex-col p-0 ${
              generating ? 'border-command-blue ring-[3px] ring-command-blue-soft' : ''
            }`}
          >
            <label htmlFor={summaryId} className="sr-only">
              {t.commitSummary}
            </label>
            <textarea
              id={summaryId}
              placeholder={
                generating
                  ? t.generatingWithAgent
                  : canConcludeMerge
                    ? t.summaryOptionalMerge
                    : t.summaryRequired
              }
              aria-label={t.commitSummary}
              value={summary}
              onChange={(e) => setSummary(e.target.value.replace(/\r?\n/g, ' '))}
              onKeyDown={(e) => {
                // The commit summary is conventionally a single logical line —
                // Enter shouldn't insert a line break into it.
                if (e.key === 'Enter') e.preventDefault()
              }}
              disabled={generating}
              rows={1}
              className="max-h-24 w-full shrink-0 resize-none border-0 border-b border-default-border bg-transparent px-3 py-2.5 text-body font-medium text-primary-text outline-none [field-sizing:content] placeholder:text-tertiary-text disabled:opacity-60"
            />

            <textarea
              placeholder={t.descriptionPlaceholder}
              aria-label={t.commitDescription}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={generating}
              className="min-h-12 w-full shrink-0 grow basis-auto resize-none border-0 bg-transparent px-3 py-2.5 text-body text-primary-text outline-none placeholder:text-tertiary-text disabled:opacity-60"
            />

            {/* Icon-only, so aria-label carries the name (or why it's unavailable). */}
            <div className="flex shrink-0 items-center justify-end px-1.5 pb-1.5">
              <button
                type="button"
                onClick={handleGenerateWithAi}
                disabled={generating || staged.length === 0 || !aiConfigured}
                title={aiConfigured ? ui.generateCommitTitle : aiNotConfigured}
                aria-label={
                  !aiConfigured ? aiNotConfigured : generating ? ui.generatingCommit : ui.generateCommit
                }
                aria-busy={generating}
                className={`btn-agent btn-agent-icon${generating ? ' is-generating' : ''}`}
              >
                <WandSparkles size={15} className="shrink-0" aria-hidden />
              </button>
            </div>
          </div>

          {commitDisabledReason && (
            <p id={`${summaryId}-commit-hint`} className="shrink-0 text-caption text-tertiary-text">
              {commitDisabledReason}
            </p>
          )}

          <div className="flex shrink-0 items-center gap-px">
            <button
              type="button"
              onClick={handleCommit}
              disabled={commitButtonDisabled}
              aria-describedby={commitDisabledReason ? `${summaryId}-commit-hint` : undefined}
              className={`btn-primary min-w-0 flex-1 justify-center overflow-hidden transition-colors duration-300 ${log.length > 0 ? 'rounded-r-none active:scale-100' : ''} ${justCommitted ? 'bg-success-green!' : ''}`}
            >
              {committing ? (
                <>
                  <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
                  <span className="truncate">{commitLabel}</span>
                </>
              ) : justCommitted ? (
                <>
                  <Check size={14} className="shrink-0 animate-[pop_0.3s_ease-out]" aria-hidden />
                  <span className="truncate">{commitLabel}</span>
                </>
              ) : (
                <>
                  <GitCommitHorizontal size={14} className="shrink-0" aria-hidden />
                  <span className="truncate">{commitLabel}</span>
                </>
              )}
            </button>
            {log.length > 0 && (
              <LastCommitMenu
                disabled={isBusy || committing}
                muted={commitButtonDisabled}
                onUndo={() => setConfirm({ type: 'undo' })}
                onAmend={() => setConfirm({ type: 'amend' })}
              />
            )}
          </div>
        </div>
      </div>

      {!narrow && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t.resizeChangesPanel}
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onMouseDown={handleResizeStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setSidebarWidth((w) => Math.max(MIN_SIDEBAR_WIDTH, w - 16))
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              setSidebarWidth((w) => Math.min(MAX_SIDEBAR_WIDTH, w + 16))
            }
          }}
          className="w-1 shrink-0 cursor-col-resize border-r border-default-border bg-transparent transition-colors hover:bg-command-blue/40 active:bg-command-blue/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
        />
      )}

      <div className={`min-w-0 flex-1 overflow-auto ${narrow && !showFileDetail ? 'hidden' : 'flex flex-col'}`}>
        {narrow && selectedFile && (
          <button
            type="button"
            onClick={() => clearSelectedFile()}
            className="flex h-10 shrink-0 items-center gap-2 border-b border-default-border px-3 text-body text-secondary-text hover:bg-hover-overlay hover:text-primary-text"
            aria-label={t.backToFileList}
          >
            <ArrowLeft size={16} aria-hidden /> {t.files}
          </button>
        )}
        {selectedFile && diffText && !(selectedFile.conflicted && conflictContent !== null) && (
          <div className="flex shrink-0 items-center gap-2 border-b border-default-border px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-caption text-tertiary-text" title={selectedFile.path}>
              {selectedFile.path.slice(0, selectedFile.path.lastIndexOf('/') + 1)}
              <span className="font-medium text-primary-text">
                {selectedFile.path.slice(selectedFile.path.lastIndexOf('/') + 1)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void explainDiff(selectedFile.path, diffText)}
              disabled={!aiConfigured || aiBusy}
              title={aiConfigured ? ui.explainDiff : aiNotConfigured}
              aria-label={aiConfigured ? ui.explainDiffAria(selectedFile.path) : aiNotConfigured}
              className="btn-secondary h-7 shrink-0 gap-1.5 px-2 text-caption disabled:opacity-40"
            >
              <Sparkles size={13} aria-hidden />
              {ui.explainDiff}
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          {selectedFile?.conflicted && conflictContent !== null ? (
            <ConflictResolver path={selectedFile.path} content={conflictContent} />
          ) : totalCount > 0 && !selectedFile ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="empty-medallion rise-in mb-1">
                <FileDiff size={20} aria-hidden />
              </span>
              <p className="text-body font-medium text-primary-text">{t.selectFileToReview}</p>
              <p className="max-w-sm text-caption text-tertiary-text">{t.selectFileHint}</p>
            </div>
          ) : (
            <DiffViewer
              diffText={diffText}
              hunkMode={hunkMode}
              hunkActionsDisabled={isHunkBusy}
              onStageHunk={(index) => selectedFile && void applyHunk(selectedFile.path, index, 'stage')}
              onUnstageHunk={(index) => selectedFile && void applyHunk(selectedFile.path, index, 'unstage')}
              onDiscardHunk={(index) => selectedFile && void applyHunk(selectedFile.path, index, 'discard')}
            />
          )}
        </div>
      </div>

      <ProtectedBranchDialog
        block={protectedBlock}
        existingBranches={branches.map((b) => b.name)}
        onCancel={() => setProtectedBlock(null)}
        onCreateBranch={(name) => {
          setProtectedBlock(null)
          // checkout -b keeps the working tree and the index: the staged files
          // and the message typed so far are all still there on the new branch.
          void createBranch(name, true)
        }}
      />
      <ConfirmDialog
        open={confirm?.type === 'abort'}
        title={t.abortMergeTitle}
        message={t.abortMergeMessage}
        confirmLabel={t.abortMerge}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirmed()}
      />
      <ConfirmDialog
        open={confirm?.type === 'discard'}
        title={
          confirm?.type === 'discard' && confirm.paths.length > 1
            ? t.discardManyTitle(confirm.paths.length)
            : t.discardTitle
        }
        message={confirm?.type === 'discard' ? discardMessage(confirm.paths) : ''}
        confirmLabel={t.discard}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirmed()}
      />

      <ConfirmDialog
        open={confirm?.type === 'undo'}
        title={t.undoTitle}
        message={status?.upstream && status.ahead === 0 ? t.undoPublishedMessage : t.undoMessage}
        confirmLabel={t.undoConfirm}
        danger={Boolean(status?.upstream && status.ahead === 0)}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirmed()}
      />
      <ConfirmDialog
        open={confirm?.type === 'amend'}
        title={t.amendTitle}
        message={status?.upstream && status.ahead === 0 ? t.amendPublishedMessage : t.amendMessage}
        confirmLabel={t.amendConfirm}
        danger={Boolean(status?.upstream && status.ahead === 0)}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirmed()}
      />
      <FileContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        target={contextMenu?.target ?? null}
        fullPath={contextMenu?.fullPath ?? null}
        fileExists={contextMenu?.fileExists ?? false}
        onClose={() => setContextMenu(null)}
        onDiscard={(path) => requestDiscard(path)}
        onIgnore={(patterns, paths, stopTracking) => void ignorePatterns(patterns, paths, stopTracking)}
        onCopy={(text) => void handleCopyPath(text)}
        onShowInExplorer={(path) => void handleShowInExplorer(path)}
        onOpenDefault={(path) => void handleOpenDefault(path)}
      />
    </div>
  )
}

export default ChangesView
