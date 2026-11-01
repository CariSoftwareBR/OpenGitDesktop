import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowLeft,
  Bug,
  Check,
  Copy,
  FileClock,
  GitBranch,
  GitBranchPlus,
  GitFork,
  GitCommitHorizontal,
  History,
  ListOrdered,
  Loader2,
  Tag,
  Undo2,
  Upload,
  X
} from 'lucide-react'
import { useRepoStore } from '../store/repoStore'
import { aiNotConfiguredMessage } from '../../../shared/aiPrompts'
import { isAiConfigured, useAiStore } from '../store/aiStore'
import { useAiUi } from '../lib/useAiUi'
import { NARROW_LAYOUT_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import DiffViewer from '../components/DiffViewer'
import ConfirmDialog, { PromptDialog } from '../components/ConfirmDialog'
import { sanitizeBranchInput, validateBranchName } from '../lib/branchName'
import Pagination from '../components/Pagination'
import CommitGraphCell, { graphColumnWidth } from '../components/CommitGraphCell'
import RefChips from '../components/RefChips'
import { computeGraphLayout, type GraphRow } from '../lib/commitGraph'
import { relativeTime } from '../lib/relativeTime'
import { useFormatters, useLocale, useT } from '../lib/i18n'
import type { Formatters } from '../../../shared/i18n'
import type { CommitRef, GraphCommit } from '../../../shared/git'

const MIN_FILES_WIDTH = 180
const MAX_FILES_WIDTH = 640
const DEFAULT_FILES_WIDTH = 260
const COMMIT_ROW_ESTIMATE = 58
const GRAPH_ROW_HEIGHT = 50
const HISTORY_PAGE_SIZE = 10
const MAX_GRAPH_LANES_SHOWN = 10

function formatDate(fmt: Formatters, iso: string): string {
  try {
    return fmt.dateTime(iso)
  } catch {
    return iso
  }
}

/**
 * Commits no remote-tracking ref reaches: walk parents from every commit that
 * carries a remote ref; whatever is left was never pushed.
 */
function computeLocalOnly(commits: GraphCommit[]): Set<string> {
  // The main process asked git directly; the walk below is only a fallback.
  if (commits.some((c) => c.unpublished !== undefined)) {
    return new Set(commits.filter((c) => c.unpublished).map((c) => c.hash))
  }
  const byHash = new Map(commits.map((c) => [c.hash, c]))
  const published = new Set<string>()
  const stack = commits.filter((c) => c.refs.some((r) => r.kind === 'remote')).map((c) => c.hash)
  while (stack.length > 0) {
    const hash = stack.pop() as string
    if (published.has(hash)) continue
    published.add(hash)
    for (const parent of byHash.get(hash)?.parents ?? []) if (!published.has(parent)) stack.push(parent)
  }
  // With no remote at all, "local only" would paint everything — say nothing then.
  if (published.size === 0) return new Set()
  return new Set(commits.filter((c) => !published.has(c.hash)).map((c) => c.hash))
}

function isHeadCommit(commit: GraphCommit): boolean {
  return commit.refs.some((r) => r.current || r.kind === 'head')
}

function CommitList({
  commits,
  graph,
  onSelect
}: {
  commits: GraphCommit[]
  graph: { rows: Map<string, GraphRow>; width: number; localOnly: Set<string> } | null
  onSelect: (hash: string) => void
}): JSX.Element {
  const selectedCommit = useRepoStore((s) => s.selectedCommit)
  const historyFocus = useRepoStore((s) => s.historyFocus)
  const status = useRepoStore((s) => s.status)
  const parentRef = useRef<HTMLDivElement>(null)
  const t = useT().history
  const g = useT().graph
  const fmt = useFormatters()
  const locale = useLocale()
  const [flashHash, setFlashHash] = useState<string | null>(null)

  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (graph ? GRAPH_ROW_HEIGHT : COMMIT_ROW_ESTIMATE),
    // Measured heights are cached per key. By index (the default), a new
    // commit at the top shifted every row onto its neighbour's height — rows
    // with a two-line summary then overlapped the next one.
    getItemKey: (index) => commits[index]?.hash ?? index,
    overscan: 12
  })

  // The agent (show_in_history) or a card asked to see a commit: bring it to
  // the middle of the list and let it glow for a moment.
  useEffect(() => {
    if (!historyFocus) return
    const index = commits.findIndex((c) => c.hash === historyFocus.hash)
    if (index === -1) return
    virtualizer.scrollToIndex(index, { align: 'center' })
    setFlashHash(historyFocus.hash)
    const timer = window.setTimeout(() => setFlashHash(null), 2600)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFocus?.nonce, commits])

  if (commits.length === 0) {
    return <div className="min-h-0 flex-1 px-3 py-4 text-center text-caption text-tertiary-text">{t.noCommits}</div>
  }

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
      <ul className="relative m-0 list-none p-0" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const commit = commits[row.index]
          const graphRow = graph?.rows.get(commit.hash)
          const head = isHeadCommit(commit)
          const localOnly = graph?.localOnly.has(commit.hash) ?? false
          const flashing = flashHash === commit.hash
          const selected = selectedCommit?.hash === commit.hash
          return (
            <li
              key={commit.hash}
              data-index={row.index}
              ref={graph ? undefined : virtualizer.measureElement}
              className={`absolute top-0 left-0 w-full ${graph ? '' : 'border-b border-default-border'}`}
              style={{ transform: `translateY(${row.start}px)`, height: graph ? GRAPH_ROW_HEIGHT : undefined }}
            >
              <button
                type="button"
                onClick={() => onSelect(commit.hash)}
                aria-current={selected ? 'true' : undefined}
                className={
                  graph
                    ? `group/row flex h-full w-full items-stretch gap-0 pr-2 text-left transition-colors duration-100 hover:bg-hover-overlay ${
                        selected ? 'bg-active-overlay' : ''
                      } ${flashing ? 'graph-focus' : ''}`
                    : `list-row w-full flex-col items-stretch gap-0.5 py-2.5 text-left ${selected ? 'is-selected' : ''} ${flashing ? 'graph-focus' : ''}`
                }
              >
                {graph && graphRow ? (
                  <>
                    <CommitGraphCell
                      row={graphRow}
                      width={graph.width}
                      height={GRAPH_ROW_HEIGHT}
                      isHead={head}
                      localOnly={localOnly}
                      focused={flashing}
                    />
                    <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <RefChips
                          refs={commit.refs}
                          ahead={status?.ahead ?? 0}
                          behind={status?.behind ?? 0}
                          max={2}
                        />
                        <span
                          className={`min-w-0 flex-1 truncate text-body ${head ? 'font-semibold' : 'font-medium'} ${
                            graphRow.isMerge ? 'text-secondary-text' : 'text-primary-text'
                          }`}
                          title={commit.summary}
                        >
                          {commit.summary}
                        </span>
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 text-caption text-tertiary-text">
                        <span className="min-w-0 truncate">{commit.authorName}</span>
                        <span aria-hidden>·</span>
                        <span className="shrink-0" title={formatDate(fmt, commit.date)}>
                          {relativeTime(locale, commit.date)}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="shrink-0 font-mono text-meta">{commit.shortHash}</span>
                        {localOnly && (
                          <span className="shrink-0 text-attention-orange" title={g.localOnly}>
                            ●
                          </span>
                        )}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <div className="whitespace-normal text-body font-medium text-primary-text [overflow-wrap:anywhere]">{commit.summary}</div>
                    <div className="whitespace-normal text-caption text-tertiary-text [overflow-wrap:anywhere]">
                      {commit.authorName} · {formatDate(fmt, commit.date)} · {commit.shortHash}
                    </div>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Where a commit already is — answers "is this fix in the release yet?" at a glance. */
function ContainedIn({ hash }: { hash: string }): JSX.Element {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const t = useT().graph
  const [refs, setRefs] = useState<CommitRef[] | null>(null)

  useEffect(() => {
    if (!currentRepoPath) return
    let cancelled = false
    setRefs(null)
    window.api.git
      .refsContaining(currentRepoPath, hash)
      .then((result) => !cancelled && setRefs(result))
      .catch(() => !cancelled && setRefs([]))
    return () => {
      cancelled = true
    }
  }, [currentRepoPath, hash])

  return (
    <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-label uppercase tracking-wide text-tertiary-text">{t.containedIn}</span>
      {refs === null ? (
        <span className="flex items-center gap-1 text-caption text-tertiary-text">
          <Loader2 size={11} className="animate-spin" aria-hidden /> {t.containedInLoading}
        </span>
      ) : refs.length === 0 ? (
        <span className="text-caption text-tertiary-text">{t.containedInNone}</span>
      ) : (
        <RefChips refs={refs} max={8} />
      )}
    </div>
  )
}

/** Long names like dependabot/npm_and_yarn/x/y keep their identifying tail. */
function shortBranchName(name: string): string {
  if (name.length <= 22) return name
  return `…/${name.split('/').pop() ?? name}`
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
  const logScope = useRepoStore((s) => s.logScope)
  const status = useRepoStore((s) => s.status)
  const setLogScope = useRepoStore((s) => s.setLogScope)
  const historyFocus = useRepoStore((s) => s.historyFocus)
  const openFileInsight = useRepoStore((s) => s.openFileInsight)
  const setRebasePlannerOpen = useRepoStore((s) => s.setRebasePlannerOpen)
  const createTag = useRepoStore((s) => s.createTag)
  const pushTag = useRepoStore((s) => s.pushTag)
  const narrow = useMediaQuery(NARROW_LAYOUT_QUERY)
  const [query, setQuery] = useState('')
  const t = useT().history
  const g = useT().graph
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
  const [tagTarget, setTagTarget] = useState<{ hash: string; shortHash: string } | null>(null)
  const [pushTagTarget, setPushTagTarget] = useState<string | null>(null)
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

  // A focus request means "show me this commit in the graph": a search would hide it.
  useEffect(() => {
    if (historyFocus) setQuery('')
  }, [historyFocus])

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
        document.removeEventListener('pointermove', onMouseMove)
        document.removeEventListener('pointerup', onMouseUp)
        document.removeEventListener('pointercancel', onMouseUp)
      }
      document.addEventListener('pointermove', onMouseMove)
      document.addEventListener('pointerup', onMouseUp)
      document.addEventListener('pointercancel', onMouseUp)
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
        commit.hash.toLowerCase().includes(needle) ||
        commit.refs.some((r) => r.name.toLowerCase().includes(needle))
    )
  }, [log, query])

  // Lanes only mean something over the unfiltered history: a search or a file
  // filter drops the commits that connect them.
  const graphMode = !query.trim() && !logPath
  const graph = useMemo(() => {
    if (!graphMode) return null
    const layout = computeGraphLayout(log)
    return {
      rows: new Map(layout.rows.map((row) => [row.hash, row])),
      width: graphColumnWidth(Math.min(layout.maxLanes, MAX_GRAPH_LANES_SHOWN)),
      localOnly: computeLocalOnly(log)
    }
  }, [graphMode, log])

  // Enough commits that were never pushed, on the current branch, to reorganize.
  const localOnHead = useMemo(() => {
    if (!graph) return 0
    const head = log.find(isHeadCommit)
    if (!head) return 0
    const byHash = new Map(log.map((c) => [c.hash, c]))
    let count = 0
    let cursor: GraphCommit | undefined = head
    while (cursor && graph.localOnly.has(cursor.hash)) {
      count++
      cursor = byHash.get(cursor.parents[0])
    }
    return count
  }, [graph, log])

  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(filteredLog.length / HISTORY_PAGE_SIZE))
  useEffect(() => {
    setPage(1)
  }, [query, logPath])
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount))
  }, [pageCount])
  // The graph is one continuous, virtualized canvas; paging would cut its lanes.
  const visibleLog = graphMode ? filteredLog : filteredLog.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE)

  const listWidth = narrow ? undefined : Math.min(580, Math.max(380, 290 + (graph?.width ?? 0)))

  const commitList = (
    <div
      className={`${narrow ? 'w-full' : 'shrink-0'} flex flex-col border-r border-default-border`}
      style={listWidth ? { width: listWidth } : undefined}
    >
      <div className="flex shrink-0 flex-col gap-1.5 p-2">
        <div className="flex items-center gap-1.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.search}
            className="field h-[34px] min-w-0 flex-1 py-0"
          />
          <button
            type="button"
            onClick={() => setRebasePlannerOpen(true)}
            disabled={repoBusy || localOnHead < 2}
            title={g.reorganizeTitle}
            className="btn-ghost h-[34px] shrink-0 gap-1.5 px-2 text-caption"
          >
            <ListOrdered size={14} aria-hidden />
            <span className={narrow ? 'sr-only' : undefined}>{g.reorganize}</span>
            {localOnHead >= 2 && (
              <span className="rounded-pill bg-attention-orange-soft px-1.5 text-label text-attention-orange">{localOnHead}</span>
            )}
          </button>
        </div>
        {!logPath && (
          <div role="radiogroup" aria-label={g.scopeLabel} className="flex rounded-md border border-default-border p-0.5">
            {(['branch', 'all'] as const).map((scope) => {
              const active = logScope === scope
              const branchName = status?.branch ?? 'HEAD'
              return (
                <button
                  key={scope}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void setLogScope(scope)}
                  title={scope === 'branch' ? g.scopeBranchTitle(branchName) : g.scopeAllTitle}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 py-1 text-caption transition-colors ${
                    active
                      ? 'bg-selection font-medium text-primary-text'
                      : 'text-secondary-text hover:bg-hover-overlay hover:text-primary-text'
                  }`}
                >
                  {scope === 'branch' ? <GitBranch size={12} aria-hidden /> : <GitFork size={12} aria-hidden />}
                  <span className="truncate">
                    {scope === 'branch' ? (narrow ? g.scopeBranch : shortBranchName(branchName)) : g.scopeAll}
                  </span>
                </button>
              )
            })}
          </div>
        )}
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
        {!graphMode && log.length > 0 && <p className="px-1 text-caption text-tertiary-text">{g.filteredNoGraph}</p>}
      </div>
      <CommitList commits={visibleLog} graph={graph} onSelect={(hash) => void selectCommit(hash)} />
      {!graphMode && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
    </div>
  )

  const commitTags = selectedCommitInfo?.refs.filter((r) => r.kind === 'tag') ?? []

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
      <div className="max-h-[45%] shrink-0 overflow-y-auto border-b border-default-border p-4">
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
          {selectedCommitInfo.parents.length > 1 && <> · {g.mergeCommit}</>}
        </p>
        <ContainedIn hash={selectedCommitInfo.hash} />
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
            onClick={() => setTagTarget({ hash: selectedCommitInfo.hash, shortHash: selectedCommitInfo.shortHash })}
            title={g.createTagTitle}
          >
            <Tag size={13} aria-hidden /> {g.createTag}
          </button>
          {commitTags.map((tag) => (
            <button
              key={tag.name}
              type="button"
              className="btn-ghost h-7 gap-1.5 px-2 text-caption"
              disabled={repoBusy}
              onClick={() => setPushTagTarget(tag.name)}
              title={g.pushTagTitle}
            >
              <Upload size={13} aria-hidden /> {g.pushTag(tag.name)}
            </button>
          ))}
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
        {selectedCommitInfo.body && <p className="mt-2 whitespace-pre-wrap text-body text-secondary-text">{selectedCommitInfo.body}</p>}
      </div>

      <div className={`flex min-h-0 flex-1 ${narrow ? 'flex-col' : ''}`}>
        <div
          className={`shrink-0 overflow-y-auto p-3 ${narrow ? 'max-h-40 border-b border-default-border' : ''}`}
          style={narrow ? undefined : { width: filesWidth }}
        >
          <h3 className="mb-2 text-label uppercase tracking-wide text-tertiary-text">{t.changedFiles}</h3>
          {selectedCommit.files.length === 0 && <p className="px-1 text-caption text-tertiary-text">{t.noChangedFiles}</p>}
          <ul className="flex flex-col gap-0.5">
            {selectedCommit.files.map((file) => {
              const filePath = file.path.split('\t').pop() ?? file.path
              return (
                <li key={file.path} className="group/file flex items-center gap-0.5">
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
                    title={g.fileInsightTitle(filePath)}
                    aria-label={g.fileInsightTitle(filePath)}
                    onClick={() => openFileInsight(filePath)}
                    className="shrink-0 rounded-sm p-1.5 text-tertiary-text hover:bg-hover-overlay hover:text-primary-text"
                  >
                    <FileClock size={13} aria-hidden />
                  </button>
                  <button
                    type="button"
                    title={t.fileHistoryTitle(file.path)}
                    aria-label={t.fileHistoryAria(file.path)}
                    onClick={() => void setLogPath(filePath)}
                    className="shrink-0 rounded-sm p-1.5 text-tertiary-text hover:bg-hover-overlay hover:text-primary-text"
                  >
                    <History size={13} aria-hidden />
                  </button>
                </li>
              )
            })}
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
            onPointerDown={handleResizeStart}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setFilesWidth((w) => Math.max(MIN_FILES_WIDTH, w - 16))
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                setFilesWidth((w) => Math.min(MAX_FILES_WIDTH, w + 16))
              }
            }}
            className="touch-none w-1 shrink-0 cursor-col-resize border-r border-default-border bg-transparent transition-colors hover:bg-command-blue/40 active:bg-command-blue/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
          />
        )}

        <div className="min-w-0 flex-1 overflow-auto">
          <DiffViewer diffText={commitDiffText} />
        </div>
      </div>
    </div>
  )

  const tagNames = useMemo(() => new Set(log.flatMap((c) => c.refs.filter((r) => r.kind === 'tag').map((r) => r.name))), [log])

  const dialogs = (
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
      <PromptDialog
        open={tagTarget !== null}
        title={g.tagDialogTitle}
        message={tagTarget ? g.tagDialogMessage(tagTarget.shortHash) : undefined}
        label={g.tagName}
        placeholder="v1.0.0"
        confirmLabel={g.createTag}
        transform={(value) => value.replace(/\s+/g, '-')}
        validate={(name) =>
          tagNames.has(name)
            ? g.tagNameTaken
            : /^[\w][\w.\-/]*$/.test(name) && !name.includes('..') && !name.endsWith('.') && !name.endsWith('/')
              ? null
              : g.tagNameInvalid
        }
        onCancel={() => setTagTarget(null)}
        onConfirm={(name) => {
          const target = tagTarget
          setTagTarget(null)
          if (target) void createTag(name, target.hash)
        }}
      />
      <ConfirmDialog
        open={pushTagTarget !== null}
        title={g.pushTagConfirmTitle}
        message={pushTagTarget ? g.pushTagConfirmMessage(pushTagTarget) : ''}
        confirmLabel={g.pushTagConfirm}
        onCancel={() => setPushTagTarget(null)}
        onConfirm={() => {
          const name = pushTagTarget
          setPushTagTarget(null)
          if (name) void pushTag(name)
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
        {dialogs}
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
      {dialogs}
    </div>
  )
}

export default HistoryView
