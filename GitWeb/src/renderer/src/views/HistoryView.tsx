import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowLeft, Bug, Check, Copy, GitBranchPlus, GitCommitHorizontal, History, Undo2, X } from 'lucide-react'
import { useRepoStore } from '../store/repoStore'
import { aiNotConfiguredMessage } from '../../../shared/aiPrompts'
import { isAiConfigured, useAiStore } from '../store/aiStore'
import { useAiUi } from '../lib/useAiUi'
import { NARROW_LAYOUT_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import DiffViewer from '../components/DiffViewer'
import ConfirmDialog, { PromptDialog } from '../components/ConfirmDialog'
import { sanitizeBranchInput, validateBranchName } from '../lib/branchName'
import Pagination from '../components/Pagination'
import { useFormatters, useLocale, useT } from '../lib/i18n'
import type { Formatters } from '../../../shared/i18n'

const MIN_FILES_WIDTH = 180
const MAX_FILES_WIDTH = 640
const DEFAULT_FILES_WIDTH = 260
const COMMIT_ROW_ESTIMATE = 58
const HISTORY_PAGE_SIZE = 10

function formatDate(fmt: Formatters, iso: string): string {
  try {
    return fmt.dateTime(iso)
  } catch {
    return iso
  }
}

function CommitList({
  commits,
  onSelect
}: {
  commits: { hash: string; shortHash: string; authorName: string; date: string; summary: string }[]
  onSelect: (hash: string) => void
}): JSX.Element {
  const selectedCommit = useRepoStore((s) => s.selectedCommit)
  const parentRef = useRef<HTMLDivElement>(null)
  const t = useT().history
  const fmt = useFormatters()

  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => COMMIT_ROW_ESTIMATE,
    // Measured heights are cached per key. By index (the default), a new
    // commit at the top shifted every row onto its neighbour's height — rows
    // with a two-line summary then overlapped the next one.
    getItemKey: (index) => commits[index]?.hash ?? index,
    overscan: 12
  })

  if (commits.length === 0) {
    return (
      <div className="min-h-0 flex-1 px-3 py-4 text-center text-caption text-tertiary-text">
        {t.noCommits}
      </div>
    )
  }

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
      <ul className="relative m-0 list-none p-0" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const commit = commits[row.index]
          return (
            <li
              key={commit.hash}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full border-b border-default-border"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <button
                type="button"
                onClick={() => onSelect(commit.hash)}
                className={`list-row w-full flex-col items-stretch gap-0.5 py-2.5 text-left ${selectedCommit?.hash === commit.hash ? 'is-selected' : ''}`}
              >
                <div className="whitespace-normal text-body font-medium text-primary-text [overflow-wrap:anywhere]">{commit.summary}</div>
                <div className="whitespace-normal text-caption text-tertiary-text [overflow-wrap:anywhere]">
                  {commit.authorName} · {formatDate(fmt, commit.date)} · {commit.shortHash}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function HistoryView(): JSX.Element {
  const selectedCommit = useRepoStore((s) => s.selectedCommit)
  const commitDiffText = useRepoStore((s) => s.commitDiffText)
  const selectCommit = useRepoStore((s) => s.selectCommit)
  const clearSelectedCommit = useRepoStore((s) => s.clearSelectedCommit)
  const selectCommitFile = useRepoStore((s) => s.selectCommitFile)
  const log = useRepoStore((s) => s.log)
  const logPath = useRepoStore((s) => s.logPath)
  const setLogPath = useRepoStore((s) => s.setLogPath)
  const narrow = useMediaQuery(NARROW_LAYOUT_QUERY)
  const [query, setQuery] = useState('')
  const t = useT().history
  const fmt = useFormatters()

  const selectedCommitInfo = selectedCommit ? log.find((c) => c.hash === selectedCommit.hash) : undefined

  const aiSettings = useAiStore((s) => s.settings)
  const aiApiKey = useAiStore((s) => s.apiKey)
  const loadAiSettings = useAiStore((s) => s.loadSettings)
  const investigateCommit = useAiStore((s) => s.investigateCommit)
  const clearChat = useAiStore((s) => s.clearChat)
  const aiBusy = useAiStore((s) => s.isBusy)
  const aiReady = isAiConfigured(aiSettings, aiApiKey)
  const aiNotConfigured = aiNotConfiguredMessage(useLocale())
  const ui = useAiUi()
  const branches = useRepoStore((s) => s.branches)
  const createBranch = useRepoStore((s) => s.createBranch)
  const revertCommit = useRepoStore((s) => s.revertCommit)
  const repoBusy = useRepoStore((s) => s.isBusy)
  const [branchFrom, setBranchFrom] = useState<{ hash: string; shortHash: string } | null>(null)
  const [revertTarget, setRevertTarget] = useState<{ hash: string; shortHash: string; summary: string } | null>(null)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  async function copyHash(hash: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(hash)
      setCopiedHash(hash)
      window.setTimeout(() => setCopiedHash((h) => (h === hash ? null : h)), 1500)
    } catch {
      // clipboard unavailable: nothing useful to report
    }
  }

  const [pendingExplore, setPendingExplore] = useState<{
    hash: string
    shortHash: string
    summary: string
  } | null>(null)

  function startExplore(commit: { hash: string; shortHash: string; summary: string }): void {
    clearChat()
    void investigateCommit(commit)
  }

  useEffect(() => {
    if (!aiSettings) void loadAiSettings()
  }, [aiSettings, loadAiSettings])

  const [filesWidth, setFilesWidth] = useState(DEFAULT_FILES_WIDTH)
  const draggingRef = useRef(false)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      draggingRef.current = true
      const startX = e.clientX
      const startWidth = filesWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(moveEvent: MouseEvent): void {
        if (!draggingRef.current) return
        const next = startWidth + (moveEvent.clientX - startX)
        setFilesWidth(Math.min(MAX_FILES_WIDTH, Math.max(MIN_FILES_WIDTH, next)))
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
    [filesWidth]
  )

  const filteredLog = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return log
    return log.filter(
      (commit) =>
        commit.summary.toLowerCase().includes(needle) ||
        commit.authorName.toLowerCase().includes(needle) ||
        commit.shortHash.toLowerCase().includes(needle) ||
        commit.hash.toLowerCase().includes(needle)
    )
  }, [log, query])

  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(filteredLog.length / HISTORY_PAGE_SIZE))
  useEffect(() => {
    setPage(1)
  }, [query, logPath])
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount))
  }, [pageCount])
  const pagedLog = filteredLog.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE)

  const commitList = (
    <div className={`${narrow ? 'w-full' : 'flex w-[280px] shrink-0 flex-col'} border-r border-default-border`}>
      <div className="flex shrink-0 flex-col gap-1.5 p-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.search}
          className="field h-[34px] py-0"
        />
        {logPath && (
          <button
            type="button"
            onClick={() => void setLogPath(null)}
            className="flex items-center gap-1 rounded-md border border-default-border px-2 py-1 text-left text-caption text-secondary-text hover:bg-hover-overlay"
          >
            <History size={12} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{logPath}</span>
            <X size={12} aria-hidden />
          </button>
        )}
      </div>
      <CommitList commits={pagedLog} onSelect={(hash) => void selectCommit(hash)} />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
    </div>
  )

  const detail = selectedCommit && selectedCommitInfo && (
    <div className="flex min-w-0 flex-1 flex-col">
      {narrow && (
        <button
          type="button"
          onClick={() => clearSelectedCommit()}
          className="flex h-10 shrink-0 items-center gap-2 border-b border-default-border px-3 text-body text-secondary-text hover:bg-hover-overlay hover:text-primary-text"
          aria-label={t.backToCommits}
        >
          <ArrowLeft size={16} aria-hidden /> {t.commits}
        </button>
      )}
      <div className="max-h-[40%] shrink-0 overflow-y-auto border-b border-default-border p-4">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-title font-semibold text-primary-text">{selectedCommitInfo.summary}</h2>
          <button
            type="button"
            onClick={() => {
              if (!aiReady) return
              const commit = {
                hash: selectedCommitInfo.hash,
                shortHash: selectedCommitInfo.shortHash,
                summary: selectedCommitInfo.summary
              }
              if (aiBusy) setPendingExplore(commit)
              else startExplore(commit)
            }}
            disabled={!aiReady}
            aria-label={ui.exploreBugAria(selectedCommitInfo.shortHash)}
            title={aiReady ? ui.exploreBugTitle : aiNotConfigured}
            className="chip-command shrink-0 cursor-pointer transition-colors duration-100 hover:bg-command-blue/15 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
          >
            <Bug size={12} aria-hidden />
            <span className={narrow ? 'sr-only' : undefined}>{ui.exploreBug}</span>
          </button>
        </div>
        <p className="mt-1 text-caption text-tertiary-text">
          {selectedCommitInfo.authorName} · {formatDate(fmt, selectedCommitInfo.date)} · {selectedCommitInfo.shortHash}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="btn-ghost h-7 gap-1.5 px-2 text-caption"
            onClick={() => void copyHash(selectedCommitInfo.hash)}
            title={t.copyHashTitle}
          >
            {copiedHash === selectedCommitInfo.hash ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            {copiedHash === selectedCommitInfo.hash ? t.copied : t.copyHash}
          </button>
          <button
            type="button"
            className="btn-ghost h-7 gap-1.5 px-2 text-caption"
            disabled={repoBusy}
            onClick={() => setBranchFrom({ hash: selectedCommitInfo.hash, shortHash: selectedCommitInfo.shortHash })}
            title={t.branchHereTitle}
          >
            <GitBranchPlus size={13} aria-hidden /> {t.branchHere}
          </button>
          <button
            type="button"
            className="btn-ghost h-7 gap-1.5 px-2 text-caption"
            disabled={repoBusy}
            onClick={() =>
              setRevertTarget({
                hash: selectedCommitInfo.hash,
                shortHash: selectedCommitInfo.shortHash,
                summary: selectedCommitInfo.summary
              })
            }
            title={t.revertTitle}
          >
            <Undo2 size={13} aria-hidden /> {t.revert}
          </button>
        </div>
        {selectedCommitInfo.body && (
          <p className="mt-2 whitespace-pre-wrap text-body text-secondary-text">{selectedCommitInfo.body}</p>
        )}
      </div>

      <div className={`flex min-h-0 flex-1 ${narrow ? 'flex-col' : ''}`}>
        <div
          className={`shrink-0 overflow-y-auto p-3 ${narrow ? 'max-h-40 border-b border-default-border' : ''}`}
          style={narrow ? undefined : { width: filesWidth }}
        >
          <h3 className="mb-2 text-label uppercase tracking-wide text-tertiary-text">{t.changedFiles}</h3>
          {selectedCommit.files.length === 0 && (
            <p className="px-1 text-caption text-tertiary-text">{t.noChangedFiles}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {selectedCommit.files.map((file) => (
              <li key={file.path} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => selectCommitFile(file.path)}
                  title={file.path}
                  className={`list-row min-w-0 flex-1 text-left ${selectedCommit.selectedPath === file.path ? 'is-selected' : ''}`}
                >
                  <span className="text-caption text-tertiary-text">{file.status}</span>
                  <span className="truncate text-body text-primary-text">{file.path}</span>
                </button>
                <button
                  type="button"
                  title={t.fileHistoryTitle(file.path)}
                  aria-label={t.fileHistoryAria(file.path)}
                  onClick={() => void setLogPath(file.path)}
                  className="shrink-0 rounded-sm p-1.5 text-tertiary-text hover:bg-hover-overlay hover:text-primary-text"
                >
                  <History size={13} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {!narrow && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t.resizeFiles}
            aria-valuemin={MIN_FILES_WIDTH}
            aria-valuemax={MAX_FILES_WIDTH}
            aria-valuenow={filesWidth}
            tabIndex={0}
            onMouseDown={handleResizeStart}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setFilesWidth((w) => Math.max(MIN_FILES_WIDTH, w - 16))
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                setFilesWidth((w) => Math.min(MAX_FILES_WIDTH, w + 16))
              }
            }}
            className="w-1 shrink-0 cursor-col-resize border-r border-default-border bg-transparent transition-colors hover:bg-command-blue/40 active:bg-command-blue/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
          />
        )}

        <div className="min-w-0 flex-1 overflow-auto">
          <DiffViewer diffText={commitDiffText} />
        </div>
      </div>
    </div>
  )

  const exploreDialog = (
    <>
    <PromptDialog
        open={branchFrom !== null}
        title={t.branchFromTitle}
        message={branchFrom ? t.branchFromMessage(branchFrom.shortHash) : undefined}
        label={t.branchName}
        placeholder="feature/…"
        confirmLabel={t.createBranch}
        transform={sanitizeBranchInput}
        validate={(name) => validateBranchName(name, branches.map((b) => b.name))}
        onCancel={() => setBranchFrom(null)}
        onConfirm={(name) => {
          const from = branchFrom
          setBranchFrom(null)
          if (from) void createBranch(name, true, from.hash)
        }}
      />
      <ConfirmDialog
        open={revertTarget !== null}
        title={t.revertDialogTitle}
        message={revertTarget ? t.revertDialogMessage(revertTarget.summary, revertTarget.shortHash) : ''}
        confirmLabel={t.revertConfirm}
        onCancel={() => setRevertTarget(null)}
        onConfirm={() => {
          const target = revertTarget
          setRevertTarget(null)
          if (target) void revertCommit(target.hash)
        }}
      />
      <ConfirmDialog
      open={pendingExplore !== null}
      title={t.stopWorkTitle}
      message={t.stopWorkMessage}
      confirmLabel={t.stopAndStart}
      cancelLabel={t.letFinish}
      onCancel={() => setPendingExplore(null)}
      onConfirm={() => {
        const commit = pendingExplore
        setPendingExplore(null)
        if (commit) startExplore(commit)
      }}
    />
    </>
  )

  if (narrow) {
    return (
      <div className="flex h-full">
        <h1 className="sr-only">{t.title}</h1>
        {selectedCommit ? detail : commitList}
        {exploreDialog}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <h1 className="sr-only">{t.title}</h1>
      {commitList}
      {detail ?? (
        <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-3 text-body text-secondary-text">
          <span className="empty-medallion rise-in">
            <GitCommitHorizontal size={20} aria-hidden />
          </span>
          {t.selectCommit}
        </div>
      )}
      {exploreDialog}
    </div>
  )
}

export default HistoryView
