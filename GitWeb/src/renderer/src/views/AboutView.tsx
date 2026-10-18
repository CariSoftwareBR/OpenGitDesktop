import { useEffect, useState, type CSSProperties } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FolderGit2, Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import { useRepoStore } from '../store/repoStore'
import Markdown from '../components/Markdown'
import type { UpdateStatus } from '../../../shared/updates'
import { allTranslations, type Locale, type Messages } from '../../../shared/i18n'
import { useLocale, useT } from '../lib/i18n'

type AboutMessages = Messages['about']

function formatBuildTime(locale: Locale, iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date)
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

/**
 * Deliberately free of the download percent: the message stays put for the
 * whole download and the number lives in its own tabular slot, so the line
 * doesn't reflow on every progress tick.
 */
function updateMessage(t: Messages, status: UpdateStatus, targetVersion: string | null): string {
  switch (status.state) {
    case 'idle':
      return t.about.idle
    case 'disabled':
      // Main fixes this reason at startup; follow a later language switch.
      return allTranslations((m) => m.main.updater.onlyInstalled).includes(status.reason)
        ? t.main.updater.onlyInstalled
        : status.reason
    case 'checking':
      return t.about.checking
    case 'available':
    case 'downloading':
      return targetVersion ? t.about.downloadingVersion(targetVersion) : t.about.downloadingUpdate
    case 'not-available':
      return t.about.upToDate
    case 'downloaded':
      return t.about.readyToRestart(status.version)
    case 'error':
      return status.message
  }
}

function StateChip({ t, status }: { t: AboutMessages; status: UpdateStatus }): JSX.Element | null {
  switch (status.state) {
    case 'checking':
      return <span className="chip-command">{t.chipChecking}</span>
    case 'available':
    case 'downloading':
      return <span className="chip-command">{t.chipDownloading}</span>
    case 'downloaded':
      return <span className="chip-success">{t.chipReady}</span>
    case 'not-available':
      return <span className="chip-success">{t.chipUpToDate}</span>
    case 'error':
      return <span className="chip-danger">{t.chipError}</span>
    case 'disabled':
      return (
        <span className="inline-flex items-center rounded-pill border border-default-border bg-hover-overlay px-2.5 py-0.5 text-label uppercase text-secondary-text">
          {t.chipDisabled}
        </span>
      )
    default:
      return null
  }
}

function StatusIcon({ status }: { status: UpdateStatus }): JSX.Element {
  switch (status.state) {
    case 'checking':
      return <Loader2 size={16} className="animate-spin text-command-blue" aria-hidden />
    case 'available':
    case 'downloading':
      return <Download size={16} className="text-command-blue" aria-hidden />
    case 'downloaded':
    case 'not-available':
      return <CheckCircle2 size={16} className="text-success-green" aria-hidden />
    case 'error':
      return <AlertCircle size={16} className="text-danger-red" aria-hidden />
    default:
      return <RefreshCw size={16} className="text-tertiary-text" aria-hidden />
  }
}

/** Staggered entrance: each block rises in a beat after the one above it. */
function stagger(step: number): CSSProperties {
  return { animationDelay: `${step * 70}ms` }
}

function AboutView(): JSX.Element {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const setView = useRepoStore((s) => s.setView)
  const messages = useT()
  const t = messages.about
  const locale = useLocale()
  const [version, setVersion] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [checking, setChecking] = useState(false)
  // Version and notes are remembered across states (the main process repeats
  // them on 'downloading' too), so the notes never vanish for the download
  // and pop back at the end, jolting the page twice.
  const [target, setTarget] = useState<{ version: string; notes: string | null } | null>(null)

  useEffect(() => {
    void window.api.app.getVersion().then(setVersion)
    void window.api.app.getUpdateStatus().then(setUpdateStatus)
    return window.api.app.onUpdateStatus(setUpdateStatus)
  }, [])

  useEffect(() => {
    if (
      updateStatus.state === 'available' ||
      updateStatus.state === 'downloaded' ||
      (updateStatus.state === 'downloading' && updateStatus.version)
    ) {
      const next = { version: updateStatus.version ?? '', notes: updateStatus.releaseNotes ?? null }
      setTarget((prev) => (prev?.version === next.version && prev.notes === next.notes ? prev : next))
    }
  }, [updateStatus])

  function handleBack(): void {
    setView(currentRepoPath ? 'settings' : 'changes')
  }

  async function handleCheckForUpdates(): Promise<void> {
    setChecking(true)
    try {
      const status = await window.api.app.checkForUpdates()
      setUpdateStatus(status)
    } finally {
      setChecking(false)
    }
  }

  async function handleInstall(): Promise<void> {
    await window.api.app.quitAndInstall()
  }

  const buildLabel = formatBuildTime(locale, __BUILD_TIME__)
  const state = updateStatus.state
  const inFlow = state === 'available' || state === 'downloading' || state === 'downloaded'
  const downloading = state === 'available' || state === 'downloading'
  const checkingNow = checking || state === 'checking'
  const percent =
    state === 'downloading'
      ? Math.max(0, Math.min(100, Math.round(updateStatus.percent)))
      : state === 'downloaded'
        ? 100
        : 0
  const notes = inFlow ? (target?.notes ?? null) : null

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-midnight-base">
      <header className="relative z-10 flex items-center px-4 py-3">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-[42px] items-center gap-2 rounded-md border border-default-border bg-coal-raised px-3 text-body text-secondary-text transition-[background-color,color,transform] duration-100 hover:bg-hover-overlay hover:text-primary-text active:scale-[0.98]"
          aria-label={t.back}
        >
          <ArrowLeft size={16} />
          {t.back}
        </button>
      </header>

      {/* Full-width scroller (thumb on the window's right edge), content
          centered inside it. Anchored from the top, not centered vertically:
          the update panel grows as an update comes in, and centering made the
          logo and title ride up and down with it. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 pt-[7vh] pb-16">
          <div className="rise-in about-emblem" style={stagger(0)}>
            <FolderGit2 size={34} strokeWidth={1.75} aria-hidden />
          </div>

          <h1 className="rise-in mt-8 text-display font-semibold text-primary-text" style={stagger(1)}>
            GitWeb
          </h1>
          <p className="rise-in mt-3 text-center text-body text-secondary-text" style={stagger(1)}>
            {t.tagline}
          </p>

          <div className="rise-in mt-5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5" style={stagger(2)}>
            <span className="chip-command min-w-[5.5ch] justify-center tabular-nums normal-case tracking-normal">
              {version ? `v${version}` : '…'}
            </span>
            <span className="text-caption tabular-nums text-tertiary-text">{t.buildOf(buildLabel)}</span>
          </div>

          <section
            aria-label={t.updates}
            className="rise-in card mt-10 w-full overflow-hidden p-0"
            style={stagger(3)}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-4">
              <h2 className="text-label uppercase text-tertiary-text">{t.updates}</h2>
              <StateChip t={t} status={updateStatus} />
            </div>

            <div className="flex flex-col gap-4 px-5 pt-3 pb-5">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  <StatusIcon status={updateStatus} />
                </span>
                <p
                  className={`min-w-0 flex-1 text-body ${
                    state === 'error'
                      ? 'text-danger-red'
                      : state === 'downloaded' || state === 'not-available'
                        ? 'text-primary-text'
                        : 'text-secondary-text'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {updateMessage(messages, updateStatus, target?.version ?? null)}
                </p>
                {inFlow && (
                  <span className="shrink-0 text-metric tabular-nums text-primary-text">
                    {percent}
                    <span className="text-caption text-tertiary-text">%</span>
                  </span>
                )}
              </div>

              {/* One block from the first byte to "pronta": the bar fills to
                  100% and the counters keep their slots, so nothing reflows. */}
              {inFlow && (
                <div>
                  <div
                    className="update-track"
                    role="progressbar"
                    aria-label={t.downloadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                  >
                    <div
                      className="update-fill"
                      data-state={state === 'downloaded' ? 'done' : 'active'}
                      style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-caption tabular-nums text-tertiary-text">
                    <span>
                      {state === 'downloading'
                        ? t.transferred(formatBytes(updateStatus.transferred), formatBytes(updateStatus.total))
                        : state === 'downloaded'
                          ? t.downloadDone
                          : t.preparingDownload}
                    </span>
                    {state === 'downloading' && <span>{formatBytes(updateStatus.bytesPerSecond)}/s</span>}
                  </div>
                </div>
              )}

              {state !== 'disabled' && (
                <div className="flex justify-end">
                  {state === 'downloaded' ? (
                    <button type="button" className="btn-primary" onClick={() => void handleInstall()}>
                      <RotateCcw size={14} aria-hidden />
                      {t.restartAndInstall}
                    </button>
                  ) : downloading ? (
                    // Kept in place (disabled) rather than removed, so the
                    // panel holds its height while the download runs.
                    <button type="button" className="btn-secondary" disabled>
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      {t.downloadingButton}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={checkingNow}
                      onClick={() => void handleCheckForUpdates()}
                    >
                      <RefreshCw size={14} className={checkingNow ? 'animate-spin' : undefined} aria-hidden />
                      {t.checkForUpdates}
                    </button>
                  )}
                </div>
              )}
            </div>

            {notes && (
              // No separate "O que mudou" label — the release notes markdown
              // from CI (release-notes.md) already opens with that heading.
              // A section of the same card (divider, not a nested card); its
              // own scroller is the allowed widget exception. overflow-x-hidden
              // guards against the overflow shorthand quirk letting a long
              // unbroken token add a horizontal bar.
              <div className="rise-in max-h-56 overflow-y-auto overflow-x-hidden border-t border-default-border px-5 py-4 text-left text-caption text-secondary-text">
                <Markdown text={notes} />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

export default AboutView
