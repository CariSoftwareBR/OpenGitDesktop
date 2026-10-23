import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GitBranchPlus, GitMerge, GitPullRequest, ShieldAlert, UploadCloud, type LucideIcon } from 'lucide-react'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useT } from '../lib/i18n'
import { sanitizeBranchInput, validateBranchName } from '../lib/branchName'
import type { BranchRules } from '../../../shared/github'

interface ProtectedBranchDialogProps {
  /** The protected branch and what it demands; null keeps the dialog closed. */
  block: { branch: string; rules: BranchRules } | null
  existingBranches: string[]
  onCancel: () => void
  onCreateBranch: (name: string) => void
}

interface Phase {
  icon: LucideIcon
  title: string
  hint: string
  /** Only the current phase carries an action: the branch name field. */
  body?: ReactNode
}

// Explains the way around a protected branch as the four phases the change
// will go through, with the first one actionable right here: a paragraph of
// prose read as a wall, the phases read as a path.
export default function ProtectedBranchDialog({
  block,
  existingBranches,
  onCancel,
  onCreateBranch
}: ProtectedBranchDialogProps): JSX.Element | null {
  const t = useT().changes
  const common = useT().common
  const titleId = useId()
  const descId = useId()
  const inputId = useId()
  const errorId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const open = block !== null

  useEffect(() => {
    if (!open) setName('')
  }, [open])

  useFocusTrap(panelRef, open, { onEscape: onCancel, initialFocusRef: inputRef })

  if (!block) return null

  const { branch, rules } = block
  const checks = rules.requiredChecks ?? []
  const trimmed = name.trim()
  const invalid = trimmed ? validateBranchName(trimmed, existingBranches) : null

  function submit(): void {
    if (!trimmed || invalid) return
    onCreateBranch(trimmed)
  }

  const phases: Phase[] = [
    {
      icon: GitBranchPlus,
      title: t.protectedPhaseBranch,
      hint: t.protectedPhaseBranchHint,
      body: (
        <div className="mt-2.5">
          <label htmlFor={inputId} className="block text-caption text-secondary-text">
            {t.newBranchName}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={name}
            placeholder="feature/…"
            onChange={(e) => setName(sanitizeBranchInput(e.target.value))}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? errorId : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            className="field mt-1.5 w-full"
          />
          {invalid && (
            <p id={errorId} role="alert" className="mt-1.5 text-caption text-danger-red">
              {invalid}
            </p>
          )}
        </div>
      )
    },
    { icon: UploadCloud, title: t.protectedPhasePush, hint: t.protectedPhasePushHint(branch) },
    { icon: GitPullRequest, title: t.protectedPhasePr, hint: t.protectedPhasePrHint(branch, checks.join(', ')) },
    { icon: GitMerge, title: t.protectedPhaseMerge, hint: t.protectedPhaseMergeHint(branch) }
  ]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={onCancel}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="max-h-full w-full min-w-0 max-w-lg overflow-y-auto rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-warning-amber/25 bg-warning-amber-soft text-warning-amber">
            <ShieldAlert size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-title font-semibold text-primary-text">
              {t.protectedBranchTitle(branch)}
            </h2>
            <p id={descId} className="mt-1 text-body text-secondary-text">
              {t.protectedBranchLead}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {rules.requiresPullRequest && <span className="chip-warning">{t.protectedRequiresPr}</span>}
          {checks.length > 0 && (
            <>
              <span className="chip-warning">{t.protectedRequiredChecks}</span>
              {checks.map((check) => (
                <span
                  key={check}
                  className="rounded-pill border border-default-border bg-midnight-base px-2 py-0.5 font-mono text-caption text-primary-text"
                >
                  {check}
                </span>
              ))}
            </>
          )}
        </div>

        <ol className="mt-5">
          {phases.map((phase, index) => {
            const current = index === 0
            const last = index === phases.length - 1
            const Icon = phase.icon
            return (
              <li key={phase.title} className="relative flex gap-3" aria-current={current ? 'step' : undefined}>
                {/* The rail: each marker's line runs down to the next one. */}
                {!last && <span className="absolute bottom-0 left-[15px] top-8 w-px bg-default-border" aria-hidden />}
                <span
                  className={`relative flex size-8 shrink-0 items-center justify-center rounded-pill border ${
                    current
                      ? 'border-command-blue bg-command-blue-soft text-command-blue'
                      : 'border-default-border bg-coal-raised text-secondary-text'
                  }`}
                >
                  <Icon size={15} aria-hidden />
                </span>
                <div className={`min-w-0 flex-1 ${last ? '' : 'pb-4'}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                    <span className="text-label uppercase text-tertiary-text">{t.protectedPhase(index + 1)}</span>
                    {current && <span className="chip-command">{t.protectedYouAreHere}</span>}
                  </div>
                  <h3 className={`text-body font-semibold ${current ? 'text-primary-text' : 'text-secondary-text'}`}>{phase.title}</h3>
                  <p className="text-caption text-secondary-text">{phase.hint}</p>
                  {phase.body}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-5 flex justify-end gap-2 border-t border-default-border pt-4">
          <button type="button" onClick={onCancel} className="btn-secondary">
            {common.cancel}
          </button>
          <button type="button" onClick={submit} disabled={!trimmed || Boolean(invalid)} className="btn-primary">
            {t.createBranchKeepChanges}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
