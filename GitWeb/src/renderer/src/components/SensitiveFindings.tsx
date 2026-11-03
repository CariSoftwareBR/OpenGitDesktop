import { FileWarning } from 'lucide-react'
import { useT } from '../lib/i18n'
import { groupFindings, type SensitiveSplit } from '../lib/sensitive'
import { toIgnorePattern } from '../lib/path'
import type { SensitiveFinding } from '../../../shared/sensitiveFiles'

// Shared by the pre-commit dialog and the AI chat's blocked card, so both
// show the same files, reasons and .gitignore preview the same way.

export function SensitiveFindingList({
  findings,
  tone,
  className = ''
}: {
  findings: SensitiveFinding[]
  tone: 'danger' | 'warning'
  className?: string
}): JSX.Element {
  const t = useT().security
  return (
    <ul className={`min-h-0 overflow-y-auto rounded-md border border-default-border bg-midnight-base ${className}`}>
      {groupFindings(findings, t).map((group) => (
        <li key={group.path} className="flex items-start gap-2.5 border-b border-default-border px-3 py-2.5 last:border-b-0">
          <FileWarning size={15} className={`mt-0.5 shrink-0 ${tone === 'danger' ? 'text-danger-red' : 'text-warning-amber'}`} aria-hidden />
          <div className="min-w-0">
            <div className="break-all font-mono text-caption text-primary-text">{group.path}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {group.reasons.map((reason) => (
                <span key={reason} className="rounded-pill border border-default-border bg-coal-raised px-2 py-0.5 text-label text-secondary-text">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** The code tip (when a token sits inside a file) and what would enter .gitignore. */
export function SensitiveNotes({ findings, split }: { findings: SensitiveFinding[]; split: SensitiveSplit }): JSX.Element {
  const t = useT().security
  const hasContentFinding = findings.some((f) => f.line !== undefined)
  return (
    <>
      {hasContentFinding && <p className="mt-3 text-caption text-tertiary-text">{t.contentTip}</p>}
      {split.ignorePaths.length > 0 && (
        <div className="mt-3">
          <p className="text-label font-normal text-tertiary-text">{t.ignorePreview}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {split.ignorePaths.map((path) => (
              <li key={path} className="break-all rounded-md border border-default-border bg-midnight-base px-2 py-0.5 font-mono text-caption text-primary-text">
                {toIgnorePattern(path)}
              </li>
            ))}
          </ul>
          {split.unstageOnlyPaths.length > 0 && (
            <p className="mt-1.5 text-caption text-tertiary-text">{t.codeOnlyUnstaged(split.unstageOnlyPaths.join(', '))}</p>
          )}
        </div>
      )}
    </>
  )
}
