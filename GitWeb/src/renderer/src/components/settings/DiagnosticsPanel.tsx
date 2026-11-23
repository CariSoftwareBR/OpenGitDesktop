import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, Wrench, XCircle } from 'lucide-react'
import { useAiStore, isAiConfigured } from '../../store/aiStore'
import { useRepoStore } from '../../store/repoStore'
import { useLocale, useT } from '../../lib/i18n'
import { listModels } from '../../lib/ai/providers'
import { relativeTime } from '../../lib/relativeTime'
import { useSettingsTabStore } from '../../lib/openAiSettings'
import { resolveActiveConfig, type AiProvider } from '../../../../shared/ai'
import type { DiagnosticCheck, DiagnosticFixId, DiagnosticStatus } from '../../../../shared/diagnostics'

function errorText(err: unknown): string {
  return err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)
}

const STATUS_LOOK: Record<DiagnosticStatus, { icon: typeof Info; tone: string; ring: string }> = {
  ok: { icon: CheckCircle2, tone: 'text-success-green bg-success-green-soft', ring: '' },
  info: { icon: Info, tone: 'text-command-blue bg-command-blue-soft', ring: '' },
  warn: { icon: AlertTriangle, tone: 'text-warning-amber bg-warning-amber-soft', ring: 'shadow-[inset_3px_0_0_var(--color-warning-amber)]' },
  error: { icon: XCircle, tone: 'text-danger-red bg-danger-red-soft', ring: 'shadow-[inset_3px_0_0_var(--color-danger-red)]' }
}

function CheckRow({
  status,
  title,
  description,
  value,
  children
}: {
  status: DiagnosticStatus
  title: string
  description: string
  value?: string | null
  children?: React.ReactNode
}): JSX.Element {
  const t = useT().settings.diagnostics
  const look = STATUS_LOOK[status]
  const Icon = look.icon
  return (
    <li className={`settings-row flex items-start gap-3.5 ${look.ring}`}>
      <span className={`flex size-[34px] shrink-0 items-center justify-center rounded-[10px] ${look.tone}`}>
        <Icon size={16} aria-label={t.statusLabel[status]} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-body font-semibold text-primary-text">{title}</span>
          {value && (
            <span className="max-w-full truncate rounded-pill border border-default-border bg-coal-raised px-2 py-0.5 font-mono text-label text-secondary-text" title={value}>
              {value}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-caption text-secondary-text">{description}</p>
        {children}
      </div>
    </li>
  )
}

function FixBox({ command, busy, onFix }: { command: string; busy: boolean; onFix: () => void }): JSX.Element {
  const t = useT().settings.diagnostics
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border border-default-border bg-midnight-base px-2.5 py-1.5 font-mono text-label text-primary-text" title={`${t.willRun}: ${command}`}>
        <span className="mr-1.5 select-none text-tertiary-text">$</span>
        {command}
      </code>
      <button type="button" className="btn-primary h-8 shrink-0 px-3" onClick={onFix} disabled={busy}>
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Wrench size={13} aria-hidden />}
        {busy ? t.fixing : t.fix}
      </button>
    </div>
  )
}

const PROVIDER_NAMES: Record<AiProvider, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  local: ''
}

/** The AI check runs here: the provider key lives in the renderer's settings store, not in main. */
function AiCheck(): JSX.Element {
  const all = useT()
  const t = all.settings.diagnostics
  const setTab = useSettingsTabStore((s) => s.setTab)
  const settings = useAiStore((s) => s.settings)
  const apiKey = useAiStore((s) => s.apiKey)
  const loadSettings = useAiStore((s) => s.loadSettings)
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'failed'; detail?: string }>({ state: 'idle' })

  useEffect(() => {
    if (!settings) void loadSettings()
  }, [settings, loadSettings])

  if (!settings || !isAiConfigured(settings, apiKey)) {
    return (
      <CheckRow status="info" title={t.checks.ai.title} description={t.checks.ai.notConfigured}>
        <button type="button" className="btn-secondary mt-2.5 h-8 px-3" onClick={() => setTab('ai')}>
          {t.openAi}
        </button>
      </CheckRow>
    )
  }

  const provider = PROVIDER_NAMES[settings.activeProvider] || all.aiSettings.localCompatible
  const model = settings.providers[settings.activeProvider].model

  async function run(): Promise<void> {
    if (!settings) return
    setTest({ state: 'testing' })
    try {
      await listModels(resolveActiveConfig(settings), apiKey)
      setTest({ state: 'ok' })
    } catch (err) {
      setTest({ state: 'failed', detail: errorText(err) })
    }
  }

  const status: DiagnosticStatus = test.state === 'ok' ? 'ok' : test.state === 'failed' ? 'error' : 'info'
  const description =
    test.state === 'ok'
      ? t.checks.ai.ok(provider, model)
      : test.state === 'failed'
        ? t.checks.ai.failed(test.detail ?? '')
        : t.checks.ai.configured(provider, model)

  return (
    <CheckRow status={status} title={t.checks.ai.title} description={description}>
      {test.state !== 'ok' && (
        <button type="button" className="btn-secondary mt-2.5 h-8 px-3" onClick={() => void run()} disabled={test.state === 'testing'}>
          {test.state === 'testing' ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <RefreshCw size={13} aria-hidden />}
          {test.state === 'testing' ? t.testingAi : t.testAi}
        </button>
      )}
    </CheckRow>
  )
}

export default function DiagnosticsPanel(): JSX.Element {
  const t = useT().settings.diagnostics
  const locale = useLocale()
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const setTab = useSettingsTabStore((s) => s.setTab)
  const [checks, setChecks] = useState<DiagnosticCheck[] | null>(null)
  const [running, setRunning] = useState(false)
  const [fixing, setFixing] = useState<DiagnosticFixId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [, tick] = useState(0)

  const run = useCallback(async (): Promise<void> => {
    setRunning(true)
    setError(null)
    try {
      setChecks(await window.api.diagnostics.run(currentRepoPath))
      setCheckedAt(new Date().toISOString())
    } catch (err) {
      setError(t.failed(errorText(err)))
    } finally {
      setRunning(false)
    }
  }, [currentRepoPath, t])

  useEffect(() => {
    void run()
    // Once per visit: re-running on every translation change is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRepoPath])

  // Keeps "verificado há 2 min" honest while the tab stays open.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  async function fix(id: DiagnosticFixId): Promise<void> {
    setFixing(id)
    setError(null)
    try {
      setChecks(await window.api.diagnostics.fix(id, currentRepoPath))
      setCheckedAt(new Date().toISOString())
    } catch (err) {
      setError(t.failed(errorText(err)))
    } finally {
      setFixing(null)
    }
  }

  const problems = checks?.filter((c) => c.status === 'warn' || c.status === 'error').length ?? 0

  function describe(check: DiagnosticCheck): { title: string; description: string } {
    const copy = t.checks[check.id] as { title: string } & Record<string, string>
    return { title: copy.title, description: copy[check.reason] ?? '' }
  }

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <div className="settings-group">
          <div className="settings-row flex items-center gap-3.5">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                !checks ? 'bg-hover-overlay text-secondary-text' : problems === 0 ? 'bg-success-green-soft text-success-green' : 'bg-warning-amber-soft text-warning-amber'
              }`}
              aria-hidden
            >
              {!checks || running ? <Loader2 size={18} className="animate-spin" /> : problems === 0 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            </span>
            <div className="min-w-0 flex-1" aria-live="polite">
              <div className="text-title font-semibold text-primary-text">
                {!checks ? t.running : problems === 0 ? t.allGood : t.issues(problems)}
              </div>
              <p className="mt-0.5 text-caption text-secondary-text">
                {checkedAt && !running ? t.checkedAt(relativeTime(locale, checkedAt)) : t.hint}
              </p>
            </div>
            <button type="button" className="btn-secondary h-8 shrink-0 px-3" onClick={() => void run()} disabled={running || fixing !== null}>
              <RefreshCw size={13} className={running ? 'animate-spin' : undefined} aria-hidden />
              {running ? t.running : t.rerun}
            </button>
          </div>
        </div>
        {error && (
          <p className="text-caption text-danger-red" role="alert">
            {error}
          </p>
        )}
      </section>

      {checks && (
        <section className="flex flex-col gap-2.5">
          <ul className="settings-group">
            {checks.map((check) => {
              const { title, description } = describe(check)
              return (
                <CheckRow key={check.id} status={check.status} title={title} description={description} value={check.value}>
                  {check.fix && <FixBox command={check.fix.command} busy={fixing === check.fix.id} onFix={() => void fix(check.fix!.id)} />}
                  {check.id === 'identity' && check.status !== 'ok' && (
                    <button type="button" className="btn-secondary mt-2.5 h-8 px-3" onClick={() => setTab('identity')}>
                      {t.openIdentity}
                    </button>
                  )}
                  {check.id === 'github' && (check.reason === 'notSignedIn' || check.reason === 'tokenInvalid') && (
                    <button type="button" className="btn-secondary mt-2.5 h-8 px-3" onClick={() => setTab('general')}>
                      {t.openAccount}
                    </button>
                  )}
                </CheckRow>
              )
            })}
            <AiCheck />
          </ul>
          <p className="text-caption text-tertiary-text">{t.hint}</p>
        </section>
      )}
    </>
  )
}
