import { useState } from 'react'
import { CheckCircle2, Loader2, Settings2, ShieldBan } from 'lucide-react'
import { useT } from '../lib/i18n'
import { ignoreSensitive, splitForIgnore, unstageSensitive } from '../lib/sensitive'
import { openSettings } from '../lib/openAiSettings'
import { SensitiveFindingList, SensitiveNotes } from './SensitiveFindings'
import type { SensitiveFinding } from '../../../shared/sensitiveFiles'

// The AI commit tool refused by the sensitive-file check (block mode). Drawn
// in place of the generic failed-tool card: the model's own text (with its
// instructions) stays out of sight, and the person gets the same list and
// ways out as the pre-commit dialog — no "retry", which would only block again.
export default function SensitiveBlockedCard({ findings }: { findings: SensitiveFinding[] }): JSX.Element {
  const t = useT().security
  const split = splitForIgnore(findings)
  const canIgnore = split.ignorePaths.length > 0
  const [state, setState] = useState<'idle' | 'busy' | 'unstaged' | 'ignored'>('idle')

  async function run(action: 'unstaged' | 'ignored'): Promise<void> {
    setState('busy')
    await (action === 'ignored' ? ignoreSensitive(split) : unstageSensitive(split))
    setState(action)
  }

  return (
    <div className="@container min-w-0 rounded-md border border-danger-red/35 bg-coal-raised p-3 text-body">
      <div className="flex items-start gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-danger-red/30 bg-danger-red-soft text-danger-red">
          <ShieldBan size={15} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-primary-text">{t.blockTitle}</div>
          <p className="mt-0.5 text-caption text-secondary-text">{t.aiCardLead}</p>
        </div>
        <button
          type="button"
          onClick={() => openSettings('security')}
          className="btn-ghost -mr-1 -mt-0.5 size-7 shrink-0 justify-center p-0"
          title={t.settingsLink}
          aria-label={t.settingsLink}
        >
          <Settings2 size={14} aria-hidden />
        </button>
      </div>

      <SensitiveFindingList findings={findings} tone="danger" className="mt-3" />
      <SensitiveNotes findings={findings} split={split} />

      {state === 'unstaged' || state === 'ignored' ? (
        <p className="mt-3 flex items-start gap-1.5 border-t border-default-border pt-3 text-caption text-success-green" role="status">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" aria-hidden />
          {state === 'ignored' ? t.doneIgnored : t.doneUnstaged}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-default-border pt-3">
          <button
            type="button"
            disabled={state === 'busy'}
            onClick={() => void run('unstaged')}
            className={`${canIgnore ? 'btn-secondary' : 'btn-primary'} h-8 flex-auto px-3 @[22rem]:flex-none`}
          >
            {t.unstage}
          </button>
          {canIgnore && (
            <button
              type="button"
              disabled={state === 'busy'}
              onClick={() => void run('ignored')}
              className="btn-primary h-8 flex-auto px-3 @[22rem]:flex-none"
            >
              {state === 'busy' && <Loader2 size={13} className="animate-spin" aria-hidden />}
              {t.ignore}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
