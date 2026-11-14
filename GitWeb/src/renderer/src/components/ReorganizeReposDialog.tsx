import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, FolderOpen, FolderSync, LoaderCircle } from 'lucide-react'
import { useAppSettingsStore } from '../store/appSettingsStore'
import { useRepoStore } from '../store/repoStore'
import { rememberCloneBaseFolder } from '../lib/cloneDestination'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'
import type { ReorganizePlan, ReorganizeResult } from '../../../shared/repoOrganize'

/** Paths in the lists read better from the chosen folder down. */
function fromRoot(path: string, root: string): string {
  return path.toLowerCase().startsWith(root.toLowerCase()) ? path.slice(root.length).replace(/^[\\/]+/, '') : path
}

function PathRow({ from, to, note }: { from: string; to?: string; note?: string }): JSX.Element {
  return (
    <li className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 font-mono text-caption">
        <span className="min-w-0 flex-1 truncate text-secondary-text" title={from}>
          {from}
        </span>
        {to && (
          <>
            <ArrowRight size={13} className="shrink-0 text-tertiary-text" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-primary-text" title={to}>
              {to}
            </span>
          </>
        )}
      </div>
      {note && <p className="text-caption text-tertiary-text">{note}</p>}
    </li>
  )
}

/**
 * Settings → Clone: moves the repositories already on disk to
 * <folder>/<account>/<repository>. Nothing moves until the preview is confirmed.
 */
export default function ReorganizeReposDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const t = useT().settings.reorganize
  const common = useT().common
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const chooseRef = useRef<HTMLButtonElement>(null)
  const settings = useAppSettingsStore((s) => s.settings)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)
  const reorganizeRepositories = useRepoStore((s) => s.reorganizeRepositories)

  const [root, setRoot] = useState<string | null>(null)
  const [plan, setPlan] = useState<ReorganizePlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [result, setResult] = useState<ReorganizeResult | null>(null)

  useEffect(() => {
    if (!open) return
    setRoot(settings?.lastCloneBaseFolder ?? null)
    setResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    setPlan(null)
    setError(null)
    if (!open || !root) return
    let stale = false
    window.api.repoOrganize
      .plan(root)
      .then((next) => {
        if (!stale) setPlan(next)
      })
      .catch((err: unknown) => {
        if (!stale) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      stale = true
    }
  }, [open, root])

  function close(): void {
    // Renames can't be called back halfway through.
    if (!moving) onClose()
  }

  useFocusTrap(panelRef, open, { onEscape: close, initialFocusRef: chooseRef })

  if (!open) return null

  async function choose(): Promise<void> {
    const picked = await window.api.dialogs.openDirectory()
    if (picked) setRoot(picked)
  }

  async function confirm(): Promise<void> {
    if (!plan) return
    setMoving(true)
    setError(null)
    try {
      const outcome = await reorganizeRepositories(plan.root, plan.moves)
      setResult(outcome)
      // New clones go to the folder that was just organized.
      if (outcome.moved.length > 0) await updateSettings(rememberCloneBaseFolder(plan.root, settings?.cloneBaseFolders ?? []))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setMoving(false)
    }
  }

  const base = plan?.root ?? ''
  const scanning = Boolean(root) && !plan && !error
  const canMove = Boolean(plan && plan.moves.length > 0) && !moving

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
        className="flex max-h-[calc(100vh-2rem)] w-full min-w-0 max-w-2xl flex-col rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
      >
        <div className="flex shrink-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-command-blue/30 bg-command-blue-soft text-command-blue">
            <FolderSync size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-title font-semibold text-primary-text">
              {t.title}
            </h2>
            <p className="mt-1 text-body text-secondary-text">{t.lead}</p>
          </div>
        </div>

        {result ? (
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" role="status">
            <p className="text-body font-medium text-primary-text">{t.movedSummary(result.moved.length)}</p>
            {result.recentError && <p className="text-caption text-attention-orange">{t.recentError(result.recentError)}</p>}
            {result.failed.length > 0 && (
              <>
                <p className="text-caption font-medium text-attention-orange">{t.failedHeading(result.failed.length)}</p>
                <ul className="divide-y divide-default-border rounded-md border border-default-border">
                  {result.failed.map((failure) => (
                    <PathRow
                      key={failure.from}
                      from={fromRoot(failure.from, base)}
                      note={failure.detail ? `${t.failure[failure.reason]}: ${failure.detail}` : t.failure[failure.reason]}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="mt-4 shrink-0 text-caption text-secondary-text">{t.folder}</p>
            <div className="mt-1.5 flex min-w-0 shrink-0 items-center gap-2">
              <span
                className={`min-w-0 flex-1 truncate rounded-md border border-default-border bg-midnight-base px-2.5 py-1.5 font-mono text-caption ${
                  root ? 'text-primary-text' : 'text-tertiary-text'
                }`}
                title={root ?? undefined}
              >
                {root ?? t.noFolder}
              </span>
              <button ref={chooseRef} type="button" onClick={() => void choose()} disabled={moving} className="btn-secondary shrink-0">
                <FolderOpen size={14} aria-hidden /> {t.chooseFolder}
              </button>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {scanning && (
                <p className="flex items-center gap-2 text-caption text-secondary-text" role="status">
                  <LoaderCircle size={14} className="animate-spin" aria-hidden /> {t.scanning}
                </p>
              )}
              {plan?.rootIsRepository && <p className="text-caption text-attention-orange">{t.rootIsRepository}</p>}
              {plan && !plan.rootIsRepository && (
                <>
                  <p className="text-body text-primary-text" role="status">
                    {t.summary(plan.moves.length, plan.alreadyOrganized)}
                  </p>
                  {plan.moves.length > 0 && (
                    <ul className="divide-y divide-default-border rounded-md border border-default-border">
                      {/* The plan comes in running order; by destination reads account by account. */}
                      {[...plan.moves]
                        .sort((a, b) => a.to.localeCompare(b.to))
                        .map((move) => (
                          <PathRow key={move.from} from={fromRoot(move.from, base)} to={fromRoot(move.to, base)} />
                        ))}
                    </ul>
                  )}
                  {plan.skipped.length > 0 && (
                    <>
                      <p className="text-caption font-medium text-secondary-text">{t.skippedHeading(plan.skipped.length)}</p>
                      <ul className="divide-y divide-default-border rounded-md border border-default-border">
                        {plan.skipped.map((skip) => (
                          <PathRow key={skip.path} from={fromRoot(skip.path, base)} note={t.reason[skip.reason]} />
                        ))}
                      </ul>
                    </>
                  )}
                  {plan.moves.length > 0 && <p className="text-caption text-secondary-text">{t.safetyNote}</p>}
                </>
              )}
            </div>
          </>
        )}

        {error && <p className="mt-3 shrink-0 text-caption text-danger-red">{error}</p>}

        {/* Cancel always last, on the far right. */}
        <div className="mt-5 flex shrink-0 justify-end gap-2 border-t border-default-border pt-4">
          {result ? (
            <button type="button" onClick={close} className="btn-primary">
              {common.close}
            </button>
          ) : (
            <>
              <button type="button" disabled={!canMove} onClick={() => void confirm()} className="btn-primary">
                {moving ? t.moving : t.move(plan?.moves.length ?? 0)}
              </button>
              <button type="button" disabled={moving} onClick={close} className="btn-secondary">
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
