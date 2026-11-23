import { useEffect, useId, useMemo, useState } from 'react'
import { Ban, CheckCircle2, GitBranch, Loader2, MousePointerClick, Plus, ShieldBan, Trash2, X, XCircle } from 'lucide-react'
import SettingRow from './SettingRow'
import Switch from '../Switch'
import { useAppSettingsStore } from '../../store/appSettingsStore'
import { useRepoStore } from '../../store/repoStore'
import { useLocale, useT } from '../../lib/i18n'
import { relativeTime } from '../../lib/relativeTime'
import { basename, pathKey } from '../../lib/path'
import { DEFAULT_APP_SETTINGS, sanitizeBranchList } from '../../../../shared/settings'
import type { AiActionEntry } from '../../../../shared/aiActionLog'

const SUGGESTED_BRANCHES = ['main', 'master', 'develop', 'release/*']

function ProtectedBranches(): JSX.Element {
  const t = useT().settings.aiRules
  const settings = useAppSettingsStore((s) => s.settings)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)
  const inputId = useId()
  const branches = settings?.aiProtectedBranches ?? DEFAULT_APP_SETTINGS.aiProtectedBranches
  const [draft, setDraft] = useState('')

  const save = (next: string[]): void => void updateSettings({ aiProtectedBranches: sanitizeBranchList(next) })
  const candidate = sanitizeBranchList([draft])[0] ?? null
  const canAdd = candidate !== null && !branches.includes(candidate)
  const suggestions = SUGGESTED_BRANCHES.filter((b) => !branches.includes(b))

  return (
    <div className="settings-group">
      <div className="settings-row flex flex-col gap-3">
        {branches.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {branches.map((branch) => (
              <li
                key={branch}
                className="flex items-center gap-1.5 rounded-pill border border-attention-orange/35 bg-attention-orange-soft py-0.5 pl-2.5 pr-1 font-mono text-caption text-primary-text"
              >
                <ShieldBan size={12} className="text-attention-orange" aria-hidden />
                {branch}
                <button
                  type="button"
                  onClick={() => save(branches.filter((b) => b !== branch))}
                  className="flex size-5 items-center justify-center rounded-full text-secondary-text transition-colors duration-100 hover:bg-hover-overlay hover:text-primary-text"
                  aria-label={t.remove(branch)}
                  title={t.remove(branch)}
                >
                  <X size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-caption text-tertiary-text">
            <GitBranch size={14} aria-hidden /> {t.noneProtected}
          </p>
        )}

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!canAdd || !candidate) return
            save([...branches, candidate])
            setDraft('')
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            {t.branchPlaceholder}
          </label>
          <input
            id={inputId}
            className="field min-w-0 flex-1 font-mono"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.branchPlaceholder}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" className="btn-secondary shrink-0" disabled={!canAdd}>
            <Plus size={13} aria-hidden /> {t.add}
          </button>
        </form>

        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-label text-tertiary-text">{t.suggestions}</span>
            {suggestions.map((branch) => (
              <button
                key={branch}
                type="button"
                onClick={() => save([...branches, branch])}
                className="rounded-pill border border-dashed border-default-border px-2 py-0.5 font-mono text-label text-secondary-text transition-colors duration-100 hover:border-attention-orange/50 hover:text-primary-text"
              >
                + {branch}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function decisionLook(entry: AiActionEntry): { icon: typeof Ban; tone: string; label: 'completed' | 'failed' | 'rejected' | 'blocked' } {
  if (entry.decision === 'blocked') return { icon: ShieldBan, tone: 'text-attention-orange bg-attention-orange-soft', label: 'blocked' }
  if (entry.decision === 'rejected') return { icon: Ban, tone: 'text-secondary-text bg-hover-overlay', label: 'rejected' }
  if (entry.outcome === 'failed') return { icon: XCircle, tone: 'text-danger-red bg-danger-red-soft', label: 'failed' }
  return { icon: CheckCircle2, tone: 'text-success-green bg-success-green-soft', label: 'completed' }
}

function LogEntry({ entry, showRepo }: { entry: AiActionEntry; showRepo: boolean }): JSX.Element {
  const t = useT().settings.aiRules
  const locale = useLocale()
  const look = decisionLook(entry)
  const Icon = look.icon
  const meta = [t[look.label], showRepo && entry.repoPath ? basename(entry.repoPath) : null, relativeTime(locale, entry.at)].filter(Boolean)

  const body = (
    <>
      <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${look.tone}`} aria-hidden>
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-medium text-primary-text">{entry.headline}</span>
          {entry.severity === 'danger' && (
            <span className="shrink-0 rounded-pill border border-danger-red/30 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-danger-red">
              {t.irreversible}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-caption text-secondary-text" title={new Date(entry.at).toLocaleString(locale)}>
          {meta.join(' · ')}
        </span>
      </span>
    </>
  )

  if (!entry.detail) return <li className="settings-row flex items-start gap-3">{body}</li>
  return (
    <li className="settings-row">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">{body}</summary>
        <pre className="ml-10 mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-default-border bg-midnight-base px-2.5 py-2 font-mono text-label text-secondary-text [overflow-wrap:anywhere]">
          {entry.detail}
        </pre>
      </details>
    </li>
  )
}

function ActionLog(): JSX.Element {
  const t = useT().settings.aiRules
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const filterId = useId()
  const [entries, setEntries] = useState<AiActionEntry[] | null>(null)
  const [error, setError] = useState(false)
  const [onlyThisRepo, setOnlyThisRepo] = useState(Boolean(currentRepoPath))
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    let alive = true
    window.api.aiLog
      .list()
      .then((list) => alive && setEntries(list))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!confirmClear) return
    const timer = setTimeout(() => setConfirmClear(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmClear])

  const filtering = onlyThisRepo && Boolean(currentRepoPath)
  const shown = useMemo(() => {
    if (!entries) return []
    if (!filtering || !currentRepoPath) return entries
    const key = pathKey(currentRepoPath)
    return entries.filter((e) => e.repoPath && pathKey(e.repoPath) === key)
  }, [entries, filtering, currentRepoPath])

  async function clear(): Promise<void> {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setConfirmClear(false)
    await window.api.aiLog.clear()
    setEntries([])
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {currentRepoPath ? (
          // A label around the switch: clicking the text toggles it too.
          <label className="flex cursor-pointer select-none items-center gap-2 text-caption text-secondary-text">
            <Switch checked={onlyThisRepo} onChange={setOnlyThisRepo} ariaLabelledBy={filterId} />
            <span id={filterId}>{t.onlyThisRepo}</span>
          </label>
        ) : (
          <span />
        )}
        {entries && entries.length > 0 && (
          <button
            type="button"
            onClick={() => void clear()}
            className={`btn-ghost h-8 px-2.5 ${confirmClear ? 'text-danger-red' : ''}`}
            aria-live="polite"
          >
            <Trash2 size={13} aria-hidden /> {confirmClear ? t.clearConfirm : t.clear}
          </button>
        )}
      </div>
      {shown.length > 0 ? (
        <ul className="settings-group">
          {shown.map((entry) => (
            <LogEntry key={entry.id} entry={entry} showRepo={!filtering} />
          ))}
        </ul>
      ) : (
      <div className="settings-group">
        {error ? (
          <p className="settings-row text-caption text-danger-red" role="alert">
            {t.loadError}
          </p>
        ) : !entries ? (
          <div className="settings-row flex items-center text-secondary-text">
            <Loader2 size={14} className="animate-spin" aria-hidden />
          </div>
        ) : (
          <p className="settings-row text-caption text-tertiary-text">{filtering ? t.emptyFiltered : t.empty}</p>
        )}
      </div>
      )}
    </>
  )
}

export default function AiRulesPanel(): JSX.Element {
  const t = useT().settings.aiRules
  const settings = useAppSettingsStore((s) => s.settings)
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <h2 className="settings-heading">{t.protectedHeading}</h2>
        <ProtectedBranches />
        <p className="text-caption text-tertiary-text">{t.protectedHint}</p>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="settings-heading">{t.confirmHeading}</h2>
        <div className="settings-group">
          <SettingRow
            icon={MousePointerClick}
            tone="red"
            label={t.confirmDanger}
            description={t.confirmDangerHint}
            checked={settings?.aiConfirmDanger ?? DEFAULT_APP_SETTINGS.aiConfirmDanger}
            onChange={(checked) => updateSettings({ aiConfirmDanger: checked })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="settings-heading">{t.logHeading}</h2>
        <p className="text-caption text-secondary-text">{t.logHint}</p>
        <ActionLog />
      </section>
    </>
  )
}
