import { useState } from 'react'
import { Archive, ArrowDownToLine, Bot, ChevronDown, ChevronRight, CircleHelp, Loader2, PackageOpen, Trash2 } from 'lucide-react'
import { splitStatus, useRepoStore } from '../store/repoStore'
import { isAiConfigured, useAiStore } from '../store/aiStore'
import ConfirmDialog from '../components/ConfirmDialog'
import DiffViewer from '../components/DiffViewer'
import { splitPatchByFile } from '../../../shared/patch'
import { useT } from '../lib/i18n'

interface StashPreview {
  ref: string
  loading: boolean
  files: { path: string; diff: string }[]
  selected: string | null
  error: string | null
}

function StashesView(): JSX.Element {
  const stashes = useRepoStore((s) => s.stashes)
  const status = useRepoStore((s) => s.status)
  const isBusy = useRepoStore((s) => s.isBusy)
  const pushStash = useRepoStore((s) => s.pushStash)
  const applyStash = useRepoStore((s) => s.applyStash)
  const popStash = useRepoStore((s) => s.popStash)
  const dropStash = useRepoStore((s) => s.dropStash)
  const aiSettings = useAiStore((s) => s.settings)
  const apiKey = useAiStore((s) => s.apiKey)
  const askAsTeacher = useAiStore((s) => s.askAsTeacher)
  const isAiBusy = useAiStore((s) => s.isBusy)

  const [message, setMessage] = useState('')
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [popTarget, setPopTarget] = useState<string | null>(null)
  const [preview, setPreview] = useState<StashPreview | null>(null)
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const t = useT().stashes

  // What a stash holds, reviewed before choosing Aplicar / Restaurar / Descartar.
  async function togglePreview(ref: string): Promise<void> {
    if (preview?.ref === ref) {
      setPreview(null)
      return
    }
    if (!currentRepoPath) return
    setPreview({ ref, loading: true, files: [], selected: null, error: null })
    try {
      const files = splitPatchByFile(await window.api.git.stashPatch(currentRepoPath, ref))
      setPreview((p) => (p?.ref === ref ? { ...p, loading: false, files, selected: files[0]?.path ?? null } : p))
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      setPreview((p) => (p?.ref === ref ? { ...p, loading: false, error } : p))
    }
  }
  const { staged, unstaged, conflicted } = splitStatus(status)
  const hasChanges = staged.length + unstaged.length + conflicted.length > 0
  const aiReady = isAiConfigured(aiSettings, apiKey)

  async function handlePush(): Promise<void> {
    await pushStash(message.trim())
    setMessage('')
  }

  async function askAiAboutStash(topic = t.aiTopic): Promise<void> {
    if (!aiReady || isAiBusy) return
    await askAsTeacher(topic)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <h1 className="sr-only">Stash</h1>
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-body font-medium text-primary-text">{t.newStash}</h2>
          <button
            type="button"
            onClick={() => void askAiAboutStash()}
            disabled={!aiReady || isAiBusy}
            title={aiReady ? t.askAiTitle : t.aiNotConfigured}
            aria-label={t.askAiAria}
            className="-m-1.5 flex h-7 w-7 items-center justify-center rounded-sm text-tertiary-text transition-colors hover:text-secondary-text disabled:opacity-40"
          >
            <CircleHelp size={17} aria-hidden />
          </button>
        </div>
        <input
          type="text"
          placeholder={t.messagePlaceholder}
          aria-label={t.messageLabel}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!hasChanges || isBusy}
          className="field"
        />
        <button type="button" onClick={handlePush} disabled={!hasChanges || isBusy} className="btn-primary justify-center">
          <Archive size={14} />
          {t.stashChanges}
        </button>
        {!hasChanges && <p className="text-caption text-tertiary-text">{t.noChanges}</p>}
      </div>

      <ul className="flex flex-col gap-2">
        {stashes.map((stash) => (
          <li key={stash.ref} className="card flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void togglePreview(stash.ref)}
              aria-expanded={preview?.ref === stash.ref}
              title={t.previewTitle}
              className="flex min-w-0 flex-1 items-start gap-1.5 rounded-sm text-left hover:opacity-90"
            >
              {preview?.ref === stash.ref ? (
                <ChevronDown size={14} className="mt-0.5 shrink-0 text-tertiary-text" aria-hidden />
              ) : (
                <ChevronRight size={14} className="mt-0.5 shrink-0 text-tertiary-text" aria-hidden />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-caption text-tertiary-text">{stash.ref}</span>
                <span className="truncate text-body text-primary-text">{stash.message}</span>
              </span>
            </button>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => void askAiAboutStash(t.aiTopicStash(stash.ref, stash.message))}
                disabled={!aiReady || isAiBusy}
                title={aiReady ? t.askAiStashTitle : t.aiNotConfigured}
                aria-label={t.askAiStashAria(stash.ref)}
                className="btn-ghost text-command-blue hover:text-command-blue"
              >
                <Bot size={14} />
              </button>
              <button type="button" onClick={() => applyStash(stash.ref)} disabled={isBusy} title={t.applyTitle} className="btn-ghost">
                <ArrowDownToLine size={14} />
                {t.apply}
              </button>
              <button
                type="button"
                onClick={() => setPopTarget(stash.ref)}
                disabled={isBusy}
                title={t.popTitle}
                aria-label={t.popAria(stash.ref)}
                className="btn-ghost"
              >
                <PackageOpen size={14} />
                {t.pop}
              </button>
              <button
                type="button"
                onClick={() => setDropTarget(stash.ref)}
                disabled={isBusy}
                title={t.drop}
                aria-label={t.dropAria(stash.ref)}
                className="btn-ghost text-danger-red hover:text-danger-red"
              >
                <Trash2 size={14} />
              </button>
            </div>
            </div>
            {preview?.ref === stash.ref && (
              <div className="flex flex-col gap-2 border-t border-default-border pt-3">
                {preview.loading && (
                  <p className="flex items-center gap-1.5 text-caption text-tertiary-text">
                    <Loader2 size={13} className="animate-spin" aria-hidden /> {t.loadingContent}
                  </p>
                )}
                {preview.error && <p className="text-caption text-danger-red">{preview.error}</p>}
                {!preview.loading && !preview.error && preview.files.length === 0 && (
                  <p className="text-caption text-tertiary-text">{t.noTextDiff}</p>
                )}
                {preview.files.length > 0 && (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {preview.files.map((file) => (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => setPreview((p) => (p ? { ...p, selected: file.path } : p))}
                          aria-pressed={preview.selected === file.path}
                          className={`rounded-md border px-2 py-0.5 font-mono text-caption ${
                            preview.selected === file.path
                              ? 'border-command-blue bg-command-blue-soft text-command-blue'
                              : 'border-default-border text-secondary-text hover:bg-hover-overlay'
                          }`}
                        >
                          {file.path}
                        </button>
                      ))}
                    </div>
                    <div className="h-72 overflow-hidden rounded-md border border-default-border">
                      <DiffViewer diffText={preview.files.find((f) => f.path === preview.selected)?.diff ?? ''} />
                    </div>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
        {stashes.length === 0 && (
          <li className="flex flex-col items-center gap-3 py-8 text-center text-caption text-secondary-text">
            <span className="empty-medallion rise-in">
              <Archive size={20} aria-hidden />
            </span>
            {t.empty}
          </li>
        )}
      </ul>

      <ConfirmDialog
        open={popTarget !== null}
        title={t.popDialogTitle}
        message={popTarget ? t.popDialogMessage(popTarget) : ''}
        confirmLabel={t.pop}
        danger
        onCancel={() => setPopTarget(null)}
        onConfirm={() => {
          const ref = popTarget
          setPopTarget(null)
          if (ref) void popStash(ref)
        }}
      />
      <ConfirmDialog
        open={dropTarget !== null}
        title={t.dropDialogTitle}
        message={dropTarget ? t.dropDialogMessage(dropTarget) : ''}
        confirmLabel={t.drop}
        danger
        onCancel={() => setDropTarget(null)}
        onConfirm={() => {
          const ref = dropTarget
          setDropTarget(null)
          if (ref) void dropStash(ref)
        }}
      />
      </div>
    </div>
  )
}

export default StashesView
