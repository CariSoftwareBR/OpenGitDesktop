import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, Settings2 } from 'lucide-react'
import { useAppSettingsStore } from '../store/appSettingsStore'
import { useT } from '../lib/i18n'
import { openSettings } from '../lib/openAiSettings'
import { identityProblem, type RepoIdentity } from '../../../shared/identity'

/**
 * Above the commit box, only when something is off with who the commit will be
 * from: no identity at all (Git would refuse), or a repository of an account
 * with a profile about to commit with another e-mail. Silent otherwise.
 */
export default function CommitIdentityNotice({ repoPath }: { repoPath: string }): JSX.Element | null {
  const settingsText = useT().settings
  const t = settingsText.identity
  const profiles = useAppSettingsStore((s) => s.settings?.identityProfiles)
  const [repo, setRepo] = useState<RepoIdentity | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    window.api.identity
      .getOverview(repoPath)
      .then((o) => alive && setRepo(o.repo))
      .catch(() => alive && setRepo(null))
    return () => {
      alive = false
    }
    // `profiles` is the trigger, not an input: saving profiles in Settings can
    // change which identity this repository resolves to.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [repoPath, profiles])

  const problem = identityProblem(repo, profiles ?? [])
  if (!problem) return null

  async function apply(profileId: string): Promise<void> {
    setBusy(true)
    try {
      setRepo(await window.api.identity.applyProfile(repoPath, profileId))
    } catch {
      // Left as it was: the notice stays and Settings › Identidade shows the reason.
    } finally {
      setBusy(false)
    }
  }

  const tone = problem.kind === 'missing' ? 'border-danger-red/30 bg-danger-red-soft' : 'border-warning-amber/35 bg-warning-amber-soft'
  return (
    <div className={`flex shrink-0 flex-col gap-2 rounded-md border px-2.5 py-2 text-caption ${tone}`} role="status">
      <div className="flex items-start gap-2">
        <AlertTriangle size={13} className={`mt-0.5 shrink-0 ${problem.kind === 'missing' ? 'text-danger-red' : 'text-warning-amber'}`} aria-hidden />
        <span className="min-w-0 flex-1 text-primary-text [overflow-wrap:anywhere]">
          {problem.kind === 'missing' ? t.notConfigured : t.mismatch(problem.profile.account ?? '', problem.profile.email)}
        </span>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5">
        {problem.kind === 'mismatch' && (
          <button type="button" className="btn-secondary h-7 px-2.5 text-caption" disabled={busy} onClick={() => void apply(problem.profile.id)}>
            {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Check size={12} aria-hidden />}
            {t.applyProfileHere(problem.profile.account ?? '')}
          </button>
        )}
        <button type="button" className="btn-ghost h-7 px-2 text-caption" onClick={() => openSettings('identity')}>
          <Settings2 size={12} aria-hidden /> {settingsText.tabs.identity}
        </button>
      </div>
    </div>
  )
}
