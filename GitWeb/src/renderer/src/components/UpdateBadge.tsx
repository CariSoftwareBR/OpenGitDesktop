import { DownloadCloud } from 'lucide-react'
import { useRepoStore } from '../store/repoStore'
import { updateStatusLabel, useUpdateStatus } from '../lib/useUpdateStatus'
import { useT } from '../lib/i18n'

// Floating corner indicator used only where there's no TopBar to embed an
// icon button into (InitialView). Once a repo is open, TopBar renders the
// equivalent inline, right after the "Sobre" button — see TopBar.tsx.
function UpdateBadge(): JSX.Element | null {
  const status = useUpdateStatus()
  const setView = useRepoStore((s) => s.setView)

  const label = updateStatusLabel(useT().about, status)
  if (!label) return null

  const ready = status.state === 'downloaded'

  return (
    <button
      type="button"
      onClick={() => setView('about')}
      title={label}
      aria-label={label}
      className={
        ready
          ? 'fixed right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-command-blue/50 bg-obsidian-panel text-command-blue shadow-command-glow transition-transform duration-150 hover:scale-105 active:scale-95'
          : 'fixed right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-default-border bg-obsidian-panel text-command-blue transition-transform duration-150 hover:scale-105 active:scale-95'
      }
    >
      <DownloadCloud size={18} className={status.state === 'downloading' ? 'animate-pulse' : undefined} aria-hidden />
      {ready && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-obsidian-panel bg-command-blue" aria-hidden />}
    </button>
  )
}

export default UpdateBadge
