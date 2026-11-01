import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FileDiff, Plus } from 'lucide-react'
import { annotateDiff, parseFileDiff, type AnnotatedDiffLine } from '../../../shared/patch'
import { useT } from '../lib/i18n'

interface DiffViewerProps {
  diffText: string
  hunkMode?: 'stage' | 'unstage' | 'none'
  /** Blocks hunk actions while a previous apply is still in flight. */
  hunkActionsDisabled?: boolean
  onStageHunk?: (hunkIndex: number) => void
  onUnstageHunk?: (hunkIndex: number) => void
  onDiscardHunk?: (hunkIndex: number) => void
  onCommentLine?: (line: number) => void
}

type LineKind = AnnotatedDiffLine['kind']

/**
 * Git's file preamble restates what the header above the diff already shows;
 * only the lines that say something new (mode changes, renames, "Binary files
 * differ") are kept.
 */
const NOISE_META = /^(diff --git |index [0-9a-f]+\.\.|--- |\+\+\+ )/

function isNoise(line: AnnotatedDiffLine): boolean {
  return line.kind === 'meta' && NOISE_META.test(line.text)
}

/** "@@ -12,6 +12,8 @@ function foo()" → the range, and the enclosing context git found. */
function splitHunkHeader(text: string): { range: string; context: string } {
  const match = /^(@@ [^@]+ @@)(.*)$/.exec(text)
  return match ? { range: match[1], context: match[2].trim() } : { range: text, context: '' }
}

function HunkHeaderText({ text }: { text: string }): JSX.Element {
  const { range, context } = splitHunkHeader(text)
  return (
    <span className="flex min-w-0 items-baseline gap-3">
      <span className="shrink-0 text-diff-hunk-ink">{range}</span>
      {context && <span className="truncate text-secondary-text">{context}</span>}
    </span>
  )
}

const VIRTUALIZE_THRESHOLD = 500
const ROW_HEIGHT = 20.15

const LINE_STYLES: Record<LineKind, string> = {
  add: 'bg-success-green-soft text-diff-add-ink',
  remove: 'bg-danger-red-soft text-danger-red',
  hunk: 'bg-command-blue-soft/60 text-diff-hunk-ink',
  meta: 'text-diff-meta-ink',
  context: 'text-secondary-text'
}

// Line-number gutter: tinted one step deeper than the line it belongs to, so
// additions and deletions read as a continuous band down the left edge.
const GUTTER_STYLES: Record<LineKind, string> = {
  add: 'bg-success-green-soft text-diff-add-ink',
  remove: 'bg-danger-red-soft text-danger-red',
  hunk: 'text-diff-hunk-ink',
  meta: 'text-diff-gutter-ink',
  context: 'text-diff-gutter-ink'
}

function DiffLine({
  line,
  onComment
}: {
  line: AnnotatedDiffLine
  onComment?: (line: number) => void
}): JSX.Element {
  const t = useT().ui
  const commentable = onComment && line.newLine != null && line.kind !== 'remove' && line.kind !== 'hunk' && line.kind !== 'meta'
  if (line.kind === 'hunk') {
    return (
      <div className="diff-hunk-row flex min-w-0 items-center">
        <span className="w-24 shrink-0 select-none" aria-hidden />
        <div className="min-w-0 flex-1 px-4 py-1">
          <HunkHeaderText text={line.text} />
        </div>
      </div>
    )
  }
  return (
    <div className={`group flex min-w-0 items-stretch ${LINE_STYLES[line.kind]}`}>
      <span
        className={`flex w-24 shrink-0 select-none border-r border-default-border tabular-nums ${GUTTER_STYLES[line.kind]}`}
        aria-hidden
      >
        {/* 48px per column fits five-digit line numbers at 13px mono. The
            +/- marker already leads line.text, so the gutter adds none. */}
        <span className="w-12 pr-2 text-right">{line.oldLine ?? ''}</span>
        <span className="w-12 pr-2 text-right">{line.newLine ?? ''}</span>
      </span>
      {commentable && (
        <button
          type="button"
          onClick={() => onComment(line.newLine!)}
          className="w-6 shrink-0 text-center text-[11px] text-tertiary-text opacity-0 hover:text-command-blue group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={t.commentLine(line.newLine!)}
          title={t.commentLine(line.newLine!)}
        >
          <Plus size={11} aria-hidden />
        </button>
      )}
      <div className="min-w-0 flex-1 px-4">{line.text || ' '}</div>
    </div>
  )
}

function HunkToolbar({
  hunkIndex,
  header,
  hunkMode,
  disabled,
  onStageHunk,
  onUnstageHunk,
  onDiscardHunk
}: {
  hunkIndex: number
  header: string
  hunkMode: 'stage' | 'unstage'
  disabled?: boolean
  onStageHunk?: (hunkIndex: number) => void
  onUnstageHunk?: (hunkIndex: number) => void
  onDiscardHunk?: (hunkIndex: number) => void
}): JSX.Element {
  const t = useT().ui
  const action =
    'diff-hunk-action inline-flex h-6 items-center rounded-pill px-2.5 font-sans text-caption font-medium transition-[background-color,transform,color] duration-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <div className="diff-hunk-row flex min-w-0 items-center gap-2 pr-2">
      <span className="w-24 shrink-0 select-none" aria-hidden />
      <div className="min-w-0 flex-1 px-4 py-1">
        <HunkHeaderText text={header} />
      </div>
      <span className="flex shrink-0 items-center gap-1">
        {hunkMode === 'stage' ? (
          <>
            <button type="button" disabled={disabled} onClick={() => onDiscardHunk?.(hunkIndex)} className={`${action} is-danger`}>
              {t.discardHunk}
            </button>
            <button type="button" disabled={disabled} onClick={() => onStageHunk?.(hunkIndex)} className={`${action} is-primary`}>
              {t.stageHunk}
            </button>
          </>
        ) : (
          <button type="button" disabled={disabled} onClick={() => onUnstageHunk?.(hunkIndex)} className={`${action} is-primary`}>
            {t.unstageHunk}
          </button>
        )}
      </span>
    </div>
  )
}

// A flat row list so hunk mode and plain mode share one renderer — and therefore
// one virtualizer. Toolbars are rows like any other line.
type DiffRow =
  | { kind: 'line'; line: AnnotatedDiffLine }
  | { kind: 'toolbar'; hunkIndex: number; header: string }

function VirtualizedDiff({
  rows,
  renderRow,
  className
}: {
  rows: DiffRow[]
  renderRow: (row: DiffRow, index: number) => JSX.Element
  className: string
}): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20
  })

  return (
    <div ref={parentRef} className={className}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
          >
            {renderRow(rows[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

function DiffViewer({
  diffText,
  hunkMode = 'none',
  hunkActionsDisabled = false,
  onStageHunk,
  onUnstageHunk,
  onDiscardHunk,
  onCommentLine
}: DiffViewerProps): JSX.Element {
  const [confirmDiscard, setConfirmDiscard] = useState<number | null>(null)
  const messages = useT()
  const t = messages.ui

  // The viewer keeps its place in the tree when another file is selected, so the
  // confirmation bar has to be dropped with the diff it belonged to — otherwise
  // confirming it would discard a hunk of the file the user just left.
  useEffect(() => {
    setConfirmDiscard(null)
  }, [diffText])

  const parsed = useMemo(() => (hunkMode !== 'none' ? parseFileDiff(diffText) : null), [diffText, hunkMode])
  const hunkRows = useMemo<DiffRow[] | null>(() => {
    if (!parsed || parsed.hunks.length === 0) return null
    const rows: DiffRow[] = parsed.preamble
      .map((text) => ({ kind: 'line' as const, line: { text, kind: 'meta' as const } }))
      .filter((row) => !isNoise(row.line))
    parsed.hunks.forEach((hunk, hunkIndex) => {
      // The toolbar carries the hunk header, so the annotated header line is dropped.
      rows.push({ kind: 'toolbar', hunkIndex, header: hunk.header })
      for (const line of annotateDiff(`${hunk.header}\n${hunk.lines.join('\n')}`)) {
        if (line.kind === 'hunk') continue
        rows.push({ kind: 'line', line: { ...line, hunkIndex } })
      }
    })
    return rows
  }, [parsed])
  // Only parsed a second time when hunk mode is off, so a big diff is not walked twice.
  const plainRows = useMemo<DiffRow[]>(
    () =>
      hunkRows
        ? []
        : annotateDiff(diffText)
            .filter((line) => !isNoise(line))
            .map((line) => ({ kind: 'line' as const, line })),
    [hunkRows, diffText]
  )

  if (!diffText) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="empty-medallion rise-in mb-1">
          <FileDiff size={20} aria-hidden />
        </span>
        <p className="text-body font-medium text-primary-text">{t.selectFileForDiff}</p>
        <p className="max-w-sm text-caption text-tertiary-text">{t.selectFileForDiffHint}</p>
      </div>
    )
  }

  const rows: DiffRow[] = hunkRows ?? plainRows
  const containerClass = hunkRows
    ? 'h-full overflow-auto font-mono text-[13px] leading-[1.55]'
    : 'h-full overflow-auto whitespace-pre font-mono text-[13px] leading-[1.55]'

  const renderRow = (row: DiffRow, index: number): JSX.Element => {
    if (row.kind === 'toolbar') {
      return (
        <div key={`toolbar-${row.hunkIndex}`}>
          <HunkToolbar
            hunkIndex={row.hunkIndex}
            header={row.header}
            hunkMode={hunkMode === 'unstage' ? 'unstage' : 'stage'}
            disabled={hunkActionsDisabled}
            onStageHunk={onStageHunk}
            onUnstageHunk={onUnstageHunk}
            onDiscardHunk={setConfirmDiscard}
          />
          {confirmDiscard === row.hunkIndex && (
            <div className="flex items-center gap-3 bg-danger-red-soft py-1.5 pr-3 pl-[112px] font-sans text-caption text-danger-red">
              {t.discardHunkConfirm}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  onDiscardHunk?.(row.hunkIndex)
                  setConfirmDiscard(null)
                }}
              >
                {t.discard}
              </button>
              <button type="button" className="text-secondary-text underline" onClick={() => setConfirmDiscard(null)}>
                {messages.common.cancel}
              </button>
            </div>
          )}
        </div>
      )
    }
    return (
      <div key={`line-${index}`} className={hunkRows ? 'whitespace-pre' : undefined}>
        <DiffLine line={row.line} onComment={onCommentLine} />
      </div>
    )
  }

  if (rows.length > VIRTUALIZE_THRESHOLD) {
    return <VirtualizedDiff rows={rows} renderRow={renderRow} className={containerClass} />
  }

  return <div className={containerClass}>{rows.map((row, index) => renderRow(row, index))}</div>
}

export default DiffViewer
