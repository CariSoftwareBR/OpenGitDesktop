import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GitFork, Loader2 } from 'lucide-react'
import type { UpstreamStatus } from '../../../shared/github'
import { useRepoStore } from '../store/repoStore'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'

const TRIGGER =
  'flex h-[46px] items-center gap-3 px-4 text-left transition-[background-color,transform] duration-100 hover:bg-hover-overlay active:bg-primary-text/15 disabled:opacity-40'

type Phase = { kind: 'confirm' } | { kind: 'running' } | { kind: 'done'; message: string; warning: boolean } | { kind: 'error'; message: string }

function errorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  // IPC wraps the main-process message: "Error invoking remote method 'x': Error: …".
  return raw.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
}

/**
 * The fork's original, next to "Fetch origin": shown only in a clone that has
 * an `upstream` remote. It fetches the original when the repository opens and
 * whenever origin is fetched, and offers to bring its new commits into the
 * local main branch and on to the fork on GitHub.
 */
function UpstreamSyncCard({ compact }: { compact: boolean }): JSX.Element | null {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const repoStatus = useRepoStore((s) => s.status)
  const lastFetchedAt = useRepoStore((s) => s.lastFetchedAt)
  const isBusy = useRepoStore((s) => s.isBusy)
  const t = useT().topBar

  const [upstream, setUpstream] = useState<UpstreamStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [phase, setPhase] = useState<Phase | null>(null)
  // What the dialog describes: the comparison when it was opened, not the
  // one after the sync (which reads "0 new").
  const [shown, setShown] = useState<UpstreamStatus | null>(null)

  // Local comparison only (no network): cheap enough to redo on every status
  // refresh, which is what notices a commit, pull or branch switch.
  const readStatus = useCallback(async (): Promise<void> => {
    if (!currentRepoPath) return
    const next = await window.api.git.upstreamStatus(currentRepoPath).catch(() => null)
    if (useRepoStore.getState().currentRepoPath === currentRepoPath) setUpstream(next)
  }, [currentRepoPath])

  const fetchAndRead = useCallback(async (): Promise<void> => {
    if (!currentRepoPath) return
    setChecking(true)
    try {
      // Offline or a dead token: keep what the last fetch knew.
      await window.api.git.fetchUpstream(currentRepoPath).catch(() => undefined)
      await readStatus()
    } finally {
      setChecking(false)
    }
  }, [currentRepoPath, readStatus])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- reads the upstream comparison over IPC whenever git status changes
    void readStatus()
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- repoStatus is the trigger: a new git status means a commit, pull or switch
  }, [readStatus, repoStatus])

  // On opening the repository and after every fetch of origin.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- fetches the original over IPC when the repository opens or origin is fetched
    void fetchAndRead()
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- lastFetchedAt is the trigger: origin was just fetched
  }, [fetchAndRead, lastFetchedAt])

  if (!upstream) return null

  const name = upstream.fullName ?? 'upstream'
  const diverged = upstream.ahead > 0 && upstream.behind > 0
  let label = t.upstreamUpToDate
  let iconClass = 'text-secondary-text'
  if (diverged) {
    label = t.upstreamDivergedLabel(upstream.behind)
    iconClass = 'text-warning-amber'
  } else if (upstream.behind > 0) {
    label = t.upstreamBehind(upstream.behind)
    iconClass = 'text-attention-orange'
  }
  const subtitle = checking ? t.upstreamChecking : diverged ? t.upstreamDivergedHint(upstream.branch) : t.upstreamFrom(name)
  const working = checking || phase?.kind === 'running'
  const icon = working ? (
    <Loader2 size={16} className="animate-spin text-secondary-text" aria-hidden />
  ) : (
    <GitFork size={16} className={iconClass} aria-hidden />
  )

  function onActivate(): void {
    if (upstream && upstream.behind > 0) {
      setShown(upstream)
      setPhase({ kind: 'confirm' })
    }
    else void fetchAndRead()
  }

  async function runSync(): Promise<void> {
    if (!currentRepoPath) return
    setPhase({ kind: 'running' })
    try {
      const result = await window.api.git.syncWithUpstream(currentRepoPath)
      const store = useRepoStore.getState()
      await Promise.all([store.refreshStatus(), store.refreshBranches(), store.refreshLog()])
      await readStatus()
      if (result.brought === 0) setPhase({ kind: 'done', message: t.upstreamNothingNew, warning: false })
      else if (result.pushed) setPhase({ kind: 'done', message: t.upstreamSynced(result.brought, result.branch), warning: false })
      else if (result.pushError) {
        setPhase({ kind: 'done', message: t.upstreamSyncedLocalOnly(result.brought, result.branch, result.pushError), warning: true })
      } else setPhase({ kind: 'done', message: t.upstreamSyncedNoOrigin(result.brought, result.branch), warning: false })
    } catch (err) {
      await readStatus()
      setPhase({ kind: 'error', message: errorText(err) })
    }
  }

  const title = t.upstreamTitle(name)
  const trigger = compact ? (
    <button
      type="button"
      className="flex h-[46px] w-[46px] items-center justify-center text-secondary-text transition-[background-color,transform] duration-100 hover:bg-hover-overlay hover:text-primary-text disabled:opacity-40"
      onClick={onActivate}
      disabled={isBusy || working}
      title={`${label} — ${subtitle}`}
      aria-label={`${label}. ${subtitle}`}
    >
      {icon}
    </button>
  ) : (
    <button type="button" className={TRIGGER} onClick={onActivate} disabled={isBusy || working} title={title}>
      {icon}
      <span className="flex flex-col items-start gap-0.5 leading-tight">
        <span className="text-body font-medium text-primary-text">{label}</span>
        <span className="max-w-48 truncate text-label font-normal text-tertiary-text">{subtitle}</span>
      </span>
    </button>
  )

  return (
    <>
      <span className="w-px self-stretch bg-default-border" aria-hidden />
      {trigger}
      {phase && shown && (
        <UpstreamSyncDialog
          phase={phase}
          upstream={shown}
          name={name}
          onConfirm={() => void runSync()}
          onClose={() => setPhase(null)}
        />
      )}
    </>
  )
}

function UpstreamSyncDialog({
  phase,
  upstream,
  name,
  onConfirm,
  onClose
}: {
  phase: Phase
  upstream: UpstreamStatus
  name: string
  onConfirm: () => void
  onClose: () => void
}): JSX.Element {
  const t = useT().topBar
  const common = useT().common
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const running = phase.kind === 'running'
  const close = (): void => {
    if (!running) onClose()
  }
  useFocusTrap(panelRef, true, { onEscape: close, initialFocusRef: primaryRef })

  const finished = phase.kind === 'done' || phase.kind === 'error'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full min-w-0 max-w-md rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
      >
        <h2 id={titleId} className="flex items-center gap-2 text-title font-semibold text-primary-text">
          <GitFork size={16} className="text-attention-orange" aria-hidden />
          {t.upstreamSyncTitle}
        </h2>
        <p id={descId} className="mt-2 text-body text-secondary-text [overflow-wrap:anywhere]">
          {t.upstreamSyncMessage(name, upstream.behind, upstream.branch)}
        </p>
        <p className="mt-2 text-caption text-tertiary-text">{t.upstreamExplain(name)}</p>

        {!finished && (
          <ol className="fork-steps mt-4" aria-label={t.upstreamStepsAria}>
            <li>
              <span className="fork-step-dot" aria-hidden>
                1
              </span>
              <span>{t.upstreamStepBring(upstream.branch)}</span>
            </li>
            <li>
              <span className="fork-step-dot" aria-hidden>
                2
              </span>
              <span>{t.upstreamStepPush(upstream.branch)}</span>
            </li>
          </ol>
        )}

        {phase.kind === 'running' && (
          <p className="mt-4 flex items-center gap-2 text-caption text-secondary-text" role="status" aria-live="polite">
            <Loader2 size={14} className="animate-spin" aria-hidden /> {t.upstreamRunning}
          </p>
        )}
        {phase.kind === 'done' && (
          <p
            role="status"
            className={`mt-4 rounded-md border px-3 py-2 text-caption [overflow-wrap:anywhere] ${
              phase.warning ? 'border-warning-amber/30 bg-warning-amber/10 text-warning-amber' : 'border-success-green/30 bg-success-green-soft text-success-green'
            }`}
          >
            {phase.message}
          </p>
        )}
        {phase.kind === 'error' && (
          <p role="alert" className="mt-4 rounded-md border border-danger-red/30 bg-danger-red-soft px-3 py-2 text-caption text-danger-red [overflow-wrap:anywhere]">
            {phase.message}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {finished ? (
            <button ref={primaryRef} type="button" onClick={onClose} className="btn-primary">
              {common.close}
            </button>
          ) : (
            <>
              <button ref={primaryRef} type="button" onClick={onConfirm} disabled={running} className="btn-primary">
                {t.upstreamSyncConfirm}
              </button>
              <button type="button" onClick={close} disabled={running} className="btn-secondary">
                {common.cancel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default UpstreamSyncCard
