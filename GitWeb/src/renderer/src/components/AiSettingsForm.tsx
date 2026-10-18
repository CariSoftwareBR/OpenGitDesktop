import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Bot, Check, Lock, RotateCcw } from 'lucide-react'
import {
  DEFAULT_MAX_DIFF_CHARS,
  REASONING_EFFORT_LEVELS,
  SYSTEM_SAMPLING,
  type AiProvider,
  type AiSettings,
  type ReasoningEffort,
  type SamplingMode,
  type SamplingParams,
  type SamplingProfile
} from '../../../shared/ai'
import { credentialKey, useAiStore } from '../store/aiStore'
import Combobox from './Combobox'

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'local', label: 'Local (compatível OpenAI)' }
]

const LANGUAGE_OPTIONS = [
  { value: 'pt-BR', label: 'Português' },
  { value: 'en', label: 'English' }
]

const REASONING_LABELS: Record<ReasoningEffort, string> = {
  off: 'Desligado',
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  xhigh: 'Muito alto'
}
const REASONING_OPTIONS = REASONING_EFFORT_LEVELS.map((level) => ({ value: level, label: REASONING_LABELS[level] }))

const INVESTIGATION_CONCURRENCY_OPTIONS = [
  { value: '0', label: 'Não usar' },
  ...Array.from({ length: 8 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))
]

const INVESTIGATION_CONTEXT_OPTIONS = [
  { value: '32768', label: '32k' },
  { value: '65536', label: '64k' },
  { value: '98304', label: '96k' },
  { value: '131072', label: '128k' }
]

/**
 * A labelled control with an optional hint. The hint sits outside the <label>
 * so it doesn't become part of the control's accessible name ("API key Guardada
 * no cofre…"); pass `hintId` and point the control's aria-describedby at it.
 */
function Field({
  label,
  children,
  hint,
  hintId
}: {
  label: string
  children: ReactNode
  hint?: string
  hintId?: string
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 text-caption text-secondary-text">
      <label className="flex flex-col gap-1.5">
        {label}
        {children}
      </label>
      {hint ? (
        <span id={hintId} className="text-tertiary-text">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

const SAMPLING_MODE_OPTIONS: { value: SamplingMode; label: string }[] = [
  { value: 'system', label: 'Padrão do sistema' },
  { value: 'user', label: 'Padrão do usuário' },
  { value: 'none', label: 'Sem padrão' }
]

const SAMPLING_FIELDS: { key: keyof SamplingParams; label: string }[] = [
  { key: 'temperature', label: 'temperature' },
  { key: 'topP', label: 'top_p' },
  { key: 'topK', label: 'top_k' },
  { key: 'minP', label: 'min_p' },
  { key: 'presencePenalty', label: 'presence_penalty' },
  { key: 'repetitionPenalty', label: 'repetition_penalty' }
]

const SAMPLING_COLUMNS: { key: keyof SamplingProfile; label: string }[] = [
  { key: 'thinking', label: 'Com pensamento' },
  { key: 'nonThinking', label: 'Sem pensamento' }
]

// Keeps the typed text locally so a cell can be cleared or start with "-" / "0."
// mid-edit; only a finite number reaches the draft, and blur restores the last
// valid value if the text was left incomplete.
function SamplingNumberInput({
  value,
  onChange,
  ariaLabel
}: {
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}): JSX.Element {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => {
        setText(e.target.value)
        const parsed = Number(e.target.value.replace(',', '.'))
        if (e.target.value.trim() !== '' && Number.isFinite(parsed)) onChange(parsed)
      }}
      onBlur={() => {
        focused.current = false
        setText(String(value))
      }}
      aria-label={ariaLabel}
      className="field h-8 w-full py-0 text-right tabular-nums"
    />
  )
}

function copyOfSystemSampling(): SamplingProfile {
  return { thinking: { ...SYSTEM_SAMPLING.thinking }, nonThinking: { ...SYSTEM_SAMPLING.nonThinking } }
}

function sameProfile(a: SamplingProfile, b: SamplingProfile): boolean {
  return SAMPLING_COLUMNS.every((c) => SAMPLING_FIELDS.every((f) => a[c.key][f.key] === b[c.key][f.key]))
}

// Sampling profile picker: the system profile is shown read-only, the user
// profile is the same grid with editable cells, and "sem padrão" sends nothing.
function SamplingSection({
  mode,
  userSampling,
  onModeChange,
  onUserSamplingChange
}: {
  mode: SamplingMode
  userSampling: SamplingProfile
  onModeChange: (mode: SamplingMode) => void
  onUserSamplingChange: (profile: SamplingProfile) => void
}): JSX.Element {
  const modeHintId = useId()
  const profile = mode === 'user' ? userSampling : SYSTEM_SAMPLING

  function setValue(column: keyof SamplingProfile, key: keyof SamplingParams, value: number): void {
    if (!Number.isFinite(value)) return
    onUserSamplingChange({ ...userSampling, [column]: { ...userSampling[column], [key]: value } })
  }

  return (
    <div className="flex flex-col gap-2 border-t border-default-border pt-3">
      <Field
        label="Parâmetros de amostragem"
        hint="Com esforço de raciocínio desligado vale a coluna Sem pensamento; ligado, Com pensamento."
        hintId={modeHintId}
      >
        <Combobox
          value={mode}
          onChange={(v) => onModeChange(v as SamplingMode)}
          options={SAMPLING_MODE_OPTIONS}
          ariaLabel="Parâmetros de amostragem"
          ariaDescribedBy={modeHintId}
        />
      </Field>

      {mode === 'none' ? (
        <p className="text-caption text-tertiary-text">
          Nenhum parâmetro de amostragem é enviado; o servidor usa os próprios padrões.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-caption">
            <thead>
              <tr>
                <th className="py-1 pr-2 text-left font-normal text-tertiary-text">Parâmetro</th>
                {SAMPLING_COLUMNS.map((c) => (
                  <th key={c.key} className="py-1 pl-2 text-right font-normal text-tertiary-text">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLING_FIELDS.map((f) => (
                <tr key={f.key}>
                  <td className="py-1 pr-2 font-mono text-secondary-text">{f.label}</td>
                  {SAMPLING_COLUMNS.map((c) => (
                    <td key={c.key} className="py-1 pl-2">
                      {mode === 'user' ? (
                        <SamplingNumberInput
                          value={profile[c.key][f.key]}
                          onChange={(v) => setValue(c.key, f.key, v)}
                          ariaLabel={`${f.label} — ${c.label}`}
                        />
                      ) : (
                        <span className="block text-right font-mono tabular-nums text-primary-text">{profile[c.key][f.key]}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'user' && (
        <button
          type="button"
          onClick={() => onUserSamplingChange(copyOfSystemSampling())}
          disabled={sameProfile(userSampling, SYSTEM_SAMPLING)}
          className="flex items-center gap-1 self-start text-caption text-secondary-text transition-opacity hover:text-primary-text hover:opacity-80 disabled:opacity-30"
        >
          <RotateCcw size={11} /> Copiar do sistema
        </button>
      )}
    </div>
  )
}

function AiSettingsForm(): JSX.Element | null {
  const settings = useAiStore((s) => s.settings)
  const models = useAiStore((s) => s.models)
  const isBusy = useAiStore((s) => s.isBusy)
  const testResult = useAiStore((s) => s.testResult)
  const saveSettings = useAiStore((s) => s.saveSettings)
  const testConnection = useAiStore((s) => s.testConnection)
  const loadModels = useAiStore((s) => s.loadModels)
  const loadSettings = useAiStore((s) => s.loadSettings)
  const updateInvestigation = useAiStore((s) => s.updateInvestigationSettings)

  const [draft, setDraft] = useState<AiSettings | null>(settings)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const apiKeyHintId = useId()
  const baseUrlHintId = useId()
  const maxDiffHintId = useId()
  const effortHintId = useId()

  useEffect(() => {
    if (!settings) void loadSettings()
  }, [settings, loadSettings])

  useEffect(() => {
    if (settings) setDraft((current) => current ?? settings)
  }, [settings])

  useEffect(() => {
    if (!draft) return
    window.api.secrets.get(credentialKey(draft.activeProvider)).then((key) => setApiKeyDraft(key ?? ''))
  }, [draft?.activeProvider])

  if (!draft) return null

  function update<K extends keyof AiSettings>(key: K, value: AiSettings[K]): void {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  function persistInvestigation<K extends 'investigationConcurrency' | 'investigationContextTokens'>(
    key: K,
    value: AiSettings[K]
  ): void {
    update(key, value)
    void updateInvestigation({ [key]: value })
  }

  function updateProvider(field: 'model' | 'apiBaseUrl', value: string): void {
    setDraft((d) =>
      d
        ? { ...d, providers: { ...d.providers, [d.activeProvider]: { ...d.providers[d.activeProvider], [field]: value } } }
        : d
    )
  }

  async function handleSave(): Promise<void> {
    if (!draft) return
    await window.api.secrets.save(credentialKey(draft.activeProvider), apiKeyDraft)
    await saveSettings(draft)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  async function handleTest(): Promise<void> {
    await handleSave()
    await testConnection()
  }

  async function handleLoadModels(): Promise<void> {
    await handleSave()
    await loadModels()
  }

  const activeProviderConfig = draft.providers[draft.activeProvider]

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-default-border bg-obsidian-panel p-4">
      <Field label="Provedor">
        <Combobox
          value={draft.activeProvider}
          onChange={(v) => update('activeProvider', v as AiProvider)}
          options={PROVIDERS}
          ariaLabel="Provedor de IA"
        />
      </Field>

      <Field label="API key" hint="Guardada no cofre do sistema operacional." hintId={apiKeyHintId}>
        <div className="relative">
          <input
            type="password"
            aria-describedby={apiKeyHintId}
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
            placeholder="sk-…"
            className="field pr-8"
            autoComplete="off"
          />
          <span
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary-text"
            title="Armazenada no cofre do sistema"
            aria-hidden
          >
            <Lock size={13} />
          </span>
        </div>
      </Field>

      <Field
        label="URL base (opcional)"
        hint="Ollama, LM Studio ou outro endpoint compatível com a API da OpenAI."
        hintId={baseUrlHintId}
      >
        <input
          type="text"
          aria-describedby={baseUrlHintId}
          placeholder="https://…"
          title="Para Ollama, LM Studio ou outro endpoint compatível com a API da OpenAI."
          value={activeProviderConfig.apiBaseUrl}
          onChange={(e) => updateProvider('apiBaseUrl', e.target.value)}
          className="field"
        />
      </Field>

      <Field label="Modelo">
        <div className="flex gap-2">
          <Combobox
            className="flex-1"
            value={activeProviderConfig.model}
            onChange={(v) => updateProvider('model', v)}
            disabled={models.length === 0 && !activeProviderConfig.model}
            placeholder="Carregar modelos…"
            ariaLabel="Modelo de IA"
            options={
              activeProviderConfig.model && !models.includes(activeProviderConfig.model)
                ? [{ value: activeProviderConfig.model, label: activeProviderConfig.model }, ...models.map((m) => ({ value: m, label: m }))]
                : models.map((m) => ({ value: m, label: m }))
            }
          />
          <button
            type="button"
            onClick={() => void handleLoadModels()}
            disabled={isBusy}
            title="Carregar modelos disponíveis"
            aria-label="Carregar modelos disponíveis"
            className="btn-ghost shrink-0 border border-default-border px-2.5"
          >
            <RotateCcw size={13} className={isBusy ? 'animate-spin' : ''} />
          </button>
        </div>
      </Field>

      <Field label="Idioma das respostas">
        <Combobox
          value={draft.language}
          onChange={(v) => update('language', v as AiSettings['language'])}
          options={LANGUAGE_OPTIONS}
          ariaLabel="Idioma das respostas"
        />
      </Field>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center justify-between border-t border-default-border pt-3 text-caption text-secondary-text hover:text-primary-text"
        aria-expanded={showAdvanced}
      >
        <span className="text-label uppercase tracking-wide text-tertiary-text">Avançado</span>
        <span>{showAdvanced ? 'Ocultar' : 'Mostrar'}</span>
      </button>

      {showAdvanced && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-caption text-secondary-text">Comportamento do modelo</span>
            <button
              type="button"
              onClick={() => update('maxDiffChars', DEFAULT_MAX_DIFF_CHARS)}
              disabled={draft.maxDiffChars === DEFAULT_MAX_DIFF_CHARS}
              className="flex items-center gap-1 text-caption text-secondary-text transition-opacity hover:text-primary-text hover:opacity-80 disabled:opacity-30"
            >
              <RotateCcw size={11} /> Padrão
            </button>
          </div>

          <Field label="Limite do diff" hint="Máx. de caracteres enviados à IA" hintId={maxDiffHintId}>
            <input
              type="text"
              aria-describedby={maxDiffHintId}
              inputMode="numeric"
              value={draft.maxDiffChars}
              onChange={(e) => update('maxDiffChars', Number(e.target.value) || 0)}
              className="field"
            />
          </Field>

          <Field label="Esforço de raciocínio" hint="Mais esforço = respostas mais lentas e cuidadosas" hintId={effortHintId}>
            <Combobox
              value={draft.reasoningEffort}
              onChange={(v) => update('reasoningEffort', v as ReasoningEffort)}
              options={REASONING_OPTIONS}
              ariaLabel="Esforço de raciocínio"
              ariaDescribedBy={effortHintId}
            />
          </Field>

          <SamplingSection
            mode={draft.samplingMode}
            userSampling={draft.userSampling}
            onModeChange={(m) => update('samplingMode', m)}
            onUserSamplingChange={(p) => update('userSampling', p)}
          />
        </>
      )}

      <div className="flex gap-2 border-t border-default-border pt-3">
        <button type="button" onClick={() => void handleSave()} disabled={isBusy} className="btn-primary flex-1 justify-center">
          {savedFlash ? <Check size={14} /> : null} {savedFlash ? 'Salvo' : 'Salvar'}
        </button>
        <button type="button" onClick={() => void handleTest()} disabled={isBusy} className="btn-secondary flex-1 justify-center">
          Testar conexão
        </button>
      </div>
      {testResult && <p className="text-caption text-success-green">{testResult}</p>}

      <div className="flex items-start gap-3 border-t border-default-border pt-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-coal-raised text-secondary-text">
          <Bot size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-title font-semibold text-primary-text">Investigação de commits</div>
          <p className="mt-0.5 text-caption text-secondary-text">
            Cada subagente analisa um arquivo ou lote isolado; aumentar os dois valores também aumenta uso e custo de IA.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-caption text-secondary-text">
              Subagentes simultâneos
              <Combobox
                value={String(draft.investigationConcurrency)}
                onChange={(value) => persistInvestigation('investigationConcurrency', Number(value))}
                options={INVESTIGATION_CONCURRENCY_OPTIONS}
                ariaLabel="Subagentes simultâneos"
              />
            </label>
            <label className="flex flex-col gap-1 text-caption text-secondary-text">
              Contexto por subagente (tokens)
              <Combobox
                value={String(draft.investigationContextTokens)}
                onChange={(value) => persistInvestigation('investigationContextTokens', Number(value))}
                options={INVESTIGATION_CONTEXT_OPTIONS}
                ariaLabel="Contexto por subagente"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AiSettingsForm
