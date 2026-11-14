import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCircle2, ExternalLink, Globe, Loader2, Lock, ShieldAlert, ShieldBan, UploadCloud } from 'lucide-react'
import Github from './icons/Github'
import GithubLoginModal from './GithubLoginModal'
import Combobox from './Combobox'
import { SensitiveFindingList } from './SensitiveFindings'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'
import { basename } from '../lib/path'
import { useRepoStore } from '../store/repoStore'
import { useGithubAuthStore } from '../store/githubAuthStore'
import { useAppSettingsStore } from '../store/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../../../shared/settings'
import { sanitizeRepositoryName, type PublishRepositoryResult, type RepositoryOwner } from '../../../shared/github'
import type { SensitiveFinding } from '../../../shared/sensitiveFiles'

const HOST = 'github.com'

/**
 * Creates the GitHub repository for a local one that has no remote yet, sets
 * it as origin and pushes the current branch. Private by default. The whole
 * history goes up on the first push, so it is checked for sensitive files
 * first: block mode stops here (and in main), warn mode asks for an explicit
 * acknowledgement.
 */
export default function PublishRepositoryDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const t = useT().publish
  const common = useT().common
  const repoPath = useRepoStore((s) => s.currentRepoPath)
  const branch = useRepoStore((s) => s.status?.branch ?? 'main')
  const publishRepository = useRepoStore((s) => s.publishRepository)
  const repoError = useRepoStore((s) => s.error)
  const clearError = useRepoStore((s) => s.clearError)
  const user = useGithubAuthStore((s) => s.user)
  const userLoading = useGithubAuthStore((s) => s.userLoading)
  const loadCurrentUser = useGithubAuthStore((s) => s.loadCurrentUser)
  const setCurrentUser = useGithubAuthStore((s) => s.setCurrentUser)
  const checkMode = useAppSettingsStore((s) =>
    (s.settings?.sensitiveCheck ?? DEFAULT_APP_SETTINGS.sensitiveCheck)
      ? (s.settings?.sensitiveCheckMode ?? DEFAULT_APP_SETTINGS.sensitiveCheckMode)
      : null
  )

  const titleId = useId()
  const nameId = useId()
  const nameHintId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [owners, setOwners] = useState<RepositoryOwner[]>([])
  const [owner, setOwner] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [findings, setFindings] = useState<SensitiveFinding[] | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [result, setResult] = useState<PublishRepositoryResult | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  // Fresh form on every open, named after the folder.
  useEffect(() => {
    if (!open || !repoPath) return
    // oxlint-disable-next-line react/set-state-in-effect -- fresh form, named after the folder, each time the dialog opens
    setName(sanitizeRepositoryName(basename(repoPath)))
    setDescription('')
    setIsPrivate(true)
    setAcknowledged(false)
    setFailed(null)
    setResult(null)
    setFindings(null)
    void loadCurrentUser(HOST)
    if (checkMode) {
      void window.api.git
        .scanSensitiveHistory(repoPath)
        .then(setFindings)
        .catch(() => setFindings([]))
    } else {
      setFindings([])
    }
  }, [open, repoPath, checkMode, loadCurrentUser])

  useEffect(() => {
    if (!open || !user) return
    let alive = true
    void window.api.github
      .listRepositoryOwners(HOST)
      .catch((): RepositoryOwner[] => [{ login: user.login, kind: 'user', avatarUrl: user.avatarUrl }])
      .then((list) => {
        if (!alive) return
        setOwners(list)
        setOwner((current) => (list.some((o) => o.login === current) ? current : (list[0]?.login ?? user.login)))
      })
    return () => {
      alive = false
    }
  }, [open, user])

  useFocusTrap(panelRef, open && !loginOpen, {
    onEscape: publishing ? () => undefined : onClose,
    initialFocusRef: nameRef
  })

  if (!open) return null

  const trimmedName = sanitizeRepositoryName(name)
  const blocked = checkMode === 'block' && (findings?.length ?? 0) > 0
  const needsAck = checkMode === 'warn' && (findings?.length ?? 0) > 0
  const checking = findings === null
  const canPublish = Boolean(user && owner && trimmedName) && !checking && !blocked && (!needsAck || acknowledged) && !publishing

  async function submit(): Promise<void> {
    if (!canPublish) return
    setPublishing(true)
    setFailed(null)
    clearError()
    const published = await publishRepository({
      owner,
      name: trimmedName,
      description,
      private: isPrivate
    })
    setPublishing(false)
    if (published) {
      setResult(published)
      return
    }
    // Shown here, in the dialog that asked; not also in the app-wide banner,
    // which would outlive the dialog.
    setFailed(useRepoStore.getState().error ?? repoError)
    clearError()
  }

  const visibilityOptions = [
    { value: true, icon: Lock, label: t.private, hint: t.privateHint },
    { value: false, icon: Globe, label: t.public, hint: t.publicHint }
  ]

  // The login modal sits outside the scrim: React events bubble through
  // portals, so a click inside it would otherwise close this dialog.
  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4"
          role="presentation"
          onClick={(e) => {
            e.stopPropagation()
            if (!publishing && e.target === e.currentTarget) onClose()
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-full w-full min-w-0 max-w-lg flex-col overflow-y-auto rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-command-blue/30 bg-command-blue-soft text-command-blue">
                {result ? <CheckCircle2 size={18} aria-hidden /> : <UploadCloud size={18} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-title font-semibold text-primary-text">
                  {result ? t.doneTitle : t.title}
                </h2>
                <p className="mt-1 text-body text-secondary-text">{result ? t.doneLead(result.fullName, result.branch) : t.lead(branch)}</p>
              </div>
            </div>

            {result ? (
              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-default-border pt-4">
                <a href={result.htmlUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  <ExternalLink size={14} aria-hidden /> {t.open}
                </a>
                <button type="button" onClick={onClose} className="btn-secondary">
                  {t.close}
                </button>
              </div>
            ) : !user ? (
              <>
                <div className="mt-4 flex items-center gap-3 rounded-md border border-default-border bg-midnight-base px-3 py-3">
                  <Github size={18} className="shrink-0 text-secondary-text" />
                  <p className="min-w-0 flex-1 text-caption text-secondary-text">{t.signInLead}</p>
                  <button type="button" disabled={userLoading} onClick={() => setLoginOpen(true)} className="btn-primary shrink-0">
                    {t.signIn}
                  </button>
                </div>
                <div className="mt-5 flex justify-end border-t border-default-border pt-4">
                  <button type="button" onClick={onClose} className="btn-secondary">
                    {common.cancel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <p className="text-caption text-secondary-text">{t.owner}</p>
                    <Combobox
                      value={owner}
                      onChange={setOwner}
                      options={owners.map((o) => ({ value: o.login, label: o.kind === 'user' ? t.ownerYou(o.login) : o.login }))}
                      ariaLabel={t.owner}
                      disabled={publishing}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={nameId} className="block text-caption text-secondary-text">
                      {t.name}
                    </label>
                    <input
                      ref={nameRef}
                      id={nameId}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))}
                      onBlur={() => setName(trimmedName)}
                      disabled={publishing}
                      aria-describedby={nameHintId}
                      className="field mt-1.5 w-full font-mono"
                    />
                  </div>
                </div>
                <p id={nameHintId} className="mt-1.5 text-label font-normal text-tertiary-text">
                  {owner && trimmedName ? `github.com/${owner}/${trimmedName}` : t.nameHint}
                </p>

                <label htmlFor={descId} className="mt-3 block text-caption text-secondary-text">
                  {t.description}
                </label>
                <input
                  id={descId}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={publishing}
                  className="field mt-1.5 w-full"
                />

                <p className="mt-3 text-caption text-secondary-text">{t.visibility}</p>
                <div role="radiogroup" aria-label={t.visibility} className="mt-1.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {visibilityOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.label}
                        type="button"
                        role="radio"
                        aria-checked={isPrivate === option.value}
                        disabled={publishing}
                        onClick={() => setIsPrivate(option.value)}
                        className="choice-tile is-compact text-left"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-2 text-body font-semibold text-primary-text">
                            <Icon size={15} className="text-secondary-text" aria-hidden /> {option.label}
                          </span>
                          <span className="choice-check" aria-hidden>
                            <Check size={11} strokeWidth={3} />
                          </span>
                        </span>
                        <span className="mt-1 block text-caption text-secondary-text">{option.hint}</span>
                      </button>
                    )
                  })}
                </div>

                {checking && (
                  <p className="mt-3 flex items-center gap-1.5 text-caption text-tertiary-text" role="status">
                    <Loader2 size={12} className="animate-spin" aria-hidden /> {t.checking}
                  </p>
                )}
                {findings && findings.length > 0 && checkMode && (
                  <div
                    className={`mt-4 rounded-md border p-3 ${
                      blocked ? 'border-danger-red/30 bg-danger-red-soft' : 'border-warning-amber/25 bg-warning-amber-soft'
                    }`}
                  >
                    <p className={`flex items-start gap-2 text-caption ${blocked ? 'text-danger-red' : 'text-warning-amber'}`}>
                      {blocked ? (
                        <ShieldBan size={14} className="mt-0.5 shrink-0" aria-hidden />
                      ) : (
                        <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                      )}
                      {blocked ? t.historyBlocked : t.historyWarn}
                    </p>
                    <SensitiveFindingList findings={findings} tone={blocked ? 'danger' : 'warning'} className="mt-2.5 max-h-40" />
                    {needsAck && (
                      <label className="mt-2.5 flex items-center gap-2 text-caption text-primary-text">
                        <input
                          type="checkbox"
                          checked={acknowledged}
                          onChange={(e) => setAcknowledged(e.target.checked)}
                          className="file-check"
                        />
                        {t.acknowledge}
                      </label>
                    )}
                  </div>
                )}

                {failed && (
                  <p role="alert" className="mt-3 break-words text-caption text-danger-red [overflow-wrap:anywhere]">
                    {failed}
                  </p>
                )}

                {/* Cancel always last, on the far right. */}
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-default-border pt-4">
                  <button type="button" onClick={() => void submit()} disabled={!canPublish} className="btn-primary">
                    {publishing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <UploadCloud size={14} aria-hidden />}
                    {publishing ? t.publishing : t.publish}
                  </button>
                  <button type="button" onClick={onClose} disabled={publishing} className="btn-secondary">
                    {common.cancel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
      <GithubLoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        host={HOST}
        onSuccess={(loggedIn) => {
          setCurrentUser(loggedIn, HOST)
          setLoginOpen(false)
        }}
      />
    </>
  )
}
