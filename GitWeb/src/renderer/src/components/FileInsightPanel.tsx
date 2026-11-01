import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Bot, FileClock, History, Loader2, X } from 'lucide-react'
import type { FileBlame, FileTimelineEntry } from '../../../shared/git'
import { useRepoStore } from '../store/repoStore'
import { isAiConfigured, useAiStore } from '../store/aiStore'
import { ageRatio, relativeTime } from '../lib/relativeTime'
import { useFormatters, useLocale, useT } from '../lib/i18n'
import { useFocusTrap } from '../lib/useFocusTrap'
import { AUTHOR_LANES } from './ToolVisualCard'

const LINE_HEIGHT = 20

function hashColor(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h) % 8
}

/** Age tint: the newest lines glow in Command Blue, the oldest fade to nothing. */
function ageTint(ratio: number, strength: number): string {
  const alpha = (1 - ratio) * strength
  return `rgb(var(--blame-age) / ${alpha.toFixed(3)})`
}

function TimelineItem({
  entry,
  active,
  max,
  onSelect
}: {
  entry: FileTimelineEntry
  active: boolean
  max: number
  onSelect: () => void
}): JSX.Element {
  const locale = useLocale()
  const total = entry.additions + entry.deletions
  const width = max > 0 ? Math.max(6, (total / max) * 100) : 0
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={`list-row w-full flex-col items-stretch gap-1 py-2 text-left ${active ? 'is-selected' : ''}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: `var(--graph-${hashColor(entry.authorName)})` }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-caption font-medium text-primary-text" title={entry.summary}>
            {entry.summary}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 pl-3.5 text-[11px] text-tertiary-text">
          <span className="truncate">{entry.authorName}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{relativeTime(locale, entry.date)}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 font-mono">
            <span className="text-success-green">+{entry.additions}</span>
            <span className="text-danger-red">−{entry.deletions}</span>
          </span>
        </span>
        <span className="ml-3.5 flex h-1 overflow-hidden rounded-pill bg-default-border" aria-hidden>
          {total > 0 && (
            <span className="flex h-full" style={{ width: `${width}%` }}>
              <span className="h-full bg-success-green" style={{ width: `${(entry.additions / total) * 100}%` }} />
              <span className="h-full bg-danger-red" style={{ width: `${(entry.deletions / total) * 100}%` }} />
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

/**
 * Timeline (commits that changed the file) beside a line-by-line blame tinted
 * by age. Opened from a file's context menu, History's file list, or by the
 * agent's explain_file_history — in which case the line it talked about is
 * centered and marked.
 */
function FileInsightPanel(): JSX.Element | null {
  const insight = useRepoStore((s) => s.fileInsight)
  const close = useRepoStore((s) => s.closeFileInsight)
  const repoPath = useRepoStore((s) => s.currentRepoPath)
  const focusCommit = useRepoStore((s) => s.focusCommitInHistory)
  const setLogPath = useRepoStore((s) => s.setLogPath)
  const setView = useRepoStore((s) => s.setView)
  const aiSettings = useAiStore((s) => s.settings)
  const aiKey = useAiStore((s) => s.apiKey)
  const aiBusy = useAiStore((s) => s.isBusy)
  const sendMessage = useAiStore((s) => s.sendMessage)
  const setPanelOpen = useAiStore((s) => s.setPanelOpen)
  const t = useT().graph
  const fmt = useFormatters()
  const locale = useLocale()

  const [timeline, setTimeline] = useState<FileTimelineEntry[] | null>(null)
  const [rev, setRev] = useState<string | null>(null)
  const [blame, setBlame] = useState<FileBlame | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focusLine, setFocusLine] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, Boolean(insight), { onEscape: close, initialFocusRef: panelRef })

  const path = insight?.path ?? null

  useEffect(() => {
    if (!path || !repoPath) return
    let cancelled = false
    setTimeline(null)
    setRev(null)
    setError(null)
    window.api.git
      .fileTimeline(repoPath, path, 200)
      .then((entries) => !cancelled && setTimeline(entries))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
  }, [path, repoPath])

  useEffect(() => {
    setFocusLine(insight?.line ?? null)
    setRev(null)
  }, [insight?.nonce, insight?.line])

  useEffect(() => {
    if (!path || !repoPath) return
    let cancelled = false
    setBlame(null)
    window.api.git
      .fileBlame(repoPath, path, rev ?? undefined)
      .then((result) => !cancelled && setBlame(result))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
  }, [path, repoPath, rev])

  const ages = useMemo(() => {
    if (!blame) return { newest: 0, oldest: 0 }
    const times = Object.values(blame.commits)
      .filter((c) => !c.uncommitted && c.date)
      .map((c) => Date.parse(c.date))
    return { newest: Math.max(...times, 0), oldest: Math.min(...times, Date.now()) }
  }, [blame])

  const authors = useMemo(() => {
    if (!blame) return []
    const counts = new Map<string, number>()
    for (const line of blame.lines) {
      const c = blame.commits[line.hash]
      const name = c?.uncommitted ? t.uncommitted : (c?.authorName ?? '?')
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [blame, t.uncommitted])

  const virtualizer = useVirtualizer({
    count: blame?.lines.length ?? 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: 30
  })

  useEffect(() => {
    if (!blame || !focusLine) return
    const index = blame.lines.findIndex((l) => l.line === focusLine)
    if (index >= 0) requestAnimationFrame(() => virtualizer.scrollToIndex(index, { align: 'center' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blame, focusLine])

  if (!insight || !path) return null

  const maxChange = Math.max(1, ...(timeline ?? []).map((e) => e.additions + e.deletions))
  const aiReady = isAiConfigured(aiSettings, aiKey)
  const totalLines = blame?.lines.length ?? 0

  function askAi(line: number): void {
    if (!path) return
    setPanelOpen(true)
    void sendMessage(t.askAiLinePrompt(path, line))
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={t.fileInsightTitle(path)}
      tabIndex={-1}
      className="rise-in outline-none absolute inset-0 z-20 flex flex-col bg-obsidian-panel [animation-duration:260ms]"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-default-border px-3 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-command-blue-soft text-command-blue">
          <FileClock size={15} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label uppercase tracking-wide text-tertiary-text">{t.fileInsight}</p>
          <p className="truncate font-mono text-caption text-primary-text" title={path}>
            {path}
          </p>
        </div>
        {authors.length > 0 && (
          <div className="hidden min-w-[180px] max-w-[260px] flex-1 flex-col gap-1 md:flex" title={t.authorsTitle}>
            <div className="flex h-1.5 overflow-hidden rounded-pill" aria-hidden>
              {authors.map(([name, n], i) => (
                <span key={name} style={{ width: `${(n / totalLines) * 100}%`, background: `var(--graph-${AUTHOR_LANES[i % AUTHOR_LANES.length]})` }} />
              ))}
            </div>
            <p className="truncate text-[11px] text-tertiary-text">
              {authors
                .slice(0, 3)
                .map(([name, n]) => `${name} ${Math.round((n / totalLines) * 100)}%`)
                .join(' · ')}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            close()
            setView('history')
            void setLogPath(path)
          }}
          className="btn-ghost h-8 gap-1.5 px-2 text-caption"
          title={t.openInHistory}
        >
          <History size={14} aria-hidden /> <span className="hidden lg:inline">{t.openInHistory}</span>
        </button>
        <button type="button" onClick={close} className="btn-ghost h-8 px-2" aria-label={t.close} title={t.close}>
          <X size={16} aria-hidden />
        </button>
      </header>

      {error && <p className="border-b border-danger-red/30 bg-danger-red-soft px-3 py-2 text-caption text-danger-red">{error}</p>}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[290px] shrink-0 flex-col border-r border-default-border">
          <h3 className="px-3 pb-1 pt-3 text-label uppercase tracking-wide text-tertiary-text">{t.timeline}</h3>
          <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            <li>
              <button
                type="button"
                onClick={() => setRev(null)}
                aria-pressed={rev === null}
                className={`list-row w-full gap-1.5 py-2 text-left text-caption ${rev === null ? 'is-selected' : ''}`}
              >
                <span className="size-2 shrink-0 rounded-full bg-command-blue" aria-hidden />
                <span className="font-medium text-primary-text">{t.workingTree}</span>
              </button>
            </li>
            {timeline === null ? (
              <li className="flex items-center gap-1.5 px-3 py-2 text-caption text-tertiary-text">
                <Loader2 size={12} className="animate-spin" aria-hidden /> {t.loading}
              </li>
            ) : timeline.length === 0 ? (
              <li className="px-3 py-2 text-caption text-tertiary-text">{t.noTimeline}</li>
            ) : (
              timeline.map((entry) => (
                <TimelineItem key={entry.hash} entry={entry} active={rev === entry.hash} max={maxChange} onSelect={() => setRev(entry.hash)} />
              ))
            )}
          </ul>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-10 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap border-b border-default-border px-3 py-1.5">
            <h3 className="text-label uppercase tracking-wide text-tertiary-text">{t.blame}</h3>
            <span className="truncate rounded-pill border border-default-border px-2 text-[11px] text-secondary-text">
              {rev ? t.atCommit(rev.slice(0, 7)) : t.workingTree}
            </span>
            {rev && (
              <button type="button" onClick={() => setRev(null)} className="text-[11px] text-command-blue hover:underline">
                {t.backToWorkingTree}
              </button>
            )}
            {focusLine && (
              <span className="flex items-center gap-1.5">
                <span className="rounded-pill bg-command-blue-soft px-2 text-[11px] text-command-blue">{t.lineBy(focusLine)}</span>
                {aiReady && (
                  <button
                    type="button"
                    onClick={() => askAi(focusLine)}
                    disabled={aiBusy}
                    title={t.askAiLine}
                    className="flex h-6 shrink-0 items-center gap-1 rounded-pill bg-command-blue px-2.5 text-[11px] font-medium text-white transition-[filter] hover:brightness-110"
                  >
                    <Bot size={12} aria-hidden /> {t.askAiShort}
                  </button>
                )}
              </span>
            )}
            <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-tertiary-text xl:flex" aria-hidden>
              {t.ageNewest}
              <span className="h-1.5 w-16 rounded-pill" style={{ background: 'linear-gradient(90deg, rgb(var(--blame-age) / 0.9), rgb(var(--blame-age) / 0.04))' }} />
              {t.ageOldest}
            </span>
          </div>
          {blame?.truncated && (
            <p className="border-b border-default-border px-3 py-1 text-[11px] text-tertiary-text">
              {t.truncated(fmt.number(blame.lines.length), fmt.number(blame.totalLines))}
            </p>
          )}
          {!blame ? (
            <div className="flex flex-1 items-center justify-center gap-1.5 text-caption text-tertiary-text">
              <Loader2 size={13} className="animate-spin" aria-hidden /> {t.loading}
            </div>
          ) : (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto font-mono text-[12px]">
              <div className="relative min-w-max" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((row) => {
                  const line = blame.lines[row.index]
                  const commit = blame.commits[line.hash]
                  const runStart = row.index === 0 || blame.lines[row.index - 1].hash !== line.hash
                  const ratio = commit && !commit.uncommitted ? ageRatio(commit.date, ages.newest, ages.oldest) : 0
                  const focused = focusLine === line.line
                  return (
                    <div
                      key={row.key}
                      className={`group/line absolute left-0 flex w-full ${runStart && row.index > 0 ? 'border-t border-default-border' : ''} ${
                        focused ? 'bg-command-blue-soft' : 'hover:bg-hover-overlay'
                      }`}
                      style={{ transform: `translateY(${row.start}px)`, height: LINE_HEIGHT }}
                    >
                      <span
                        className="w-[3px] shrink-0"
                        style={{ background: commit?.uncommitted ? 'var(--color-attention-orange)' : ageTint(ratio, 0.95) }}
                        aria-hidden
                      />
                      <span
                        className="sticky left-0 z-[1] flex w-[230px] shrink-0 items-center gap-1.5 overflow-hidden bg-obsidian-panel px-2 font-sans text-[11px]"
                        style={{ boxShadow: `inset 230px 0 0 ${commit?.uncommitted ? 'var(--color-attention-orange-soft)' : ageTint(ratio, 0.16)}` }}
                      >
                        {runStart && commit && (
                          <button
                            type="button"
                            onClick={() => !commit.uncommitted && void focusCommit(commit.hash).then((ok) => ok && close())}
                            title={commit.uncommitted ? t.uncommitted : `${commit.summary}\n${commit.authorName} · ${fmt.dateTime(commit.date)}`}
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:text-command-blue"
                          >
                            <span
                              className="size-1.5 shrink-0 rounded-full"
                              style={{ background: commit.uncommitted ? 'var(--color-attention-orange)' : `var(--graph-${hashColor(commit.authorName)})` }}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate text-secondary-text">
                              {commit.uncommitted ? t.uncommitted : commit.authorName}
                            </span>
                            {!commit.uncommitted && <span className="shrink-0 text-tertiary-text">{relativeTime(locale, commit.date)}</span>}
                          </button>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFocusLine(focused ? null : line.line)}
                        aria-pressed={focused}
                        aria-label={t.lineBy(line.line)}
                        className={`w-12 shrink-0 select-none pr-2 text-right leading-5 hover:text-command-blue ${
                          focused ? 'font-semibold text-command-blue' : 'text-diff-gutter-ink'
                        }`}
                      >
                        {line.line}
                      </button>
                      <span className="whitespace-pre pr-4 leading-5 text-primary-text">{line.content || ' '}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default FileInsightPanel
