import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../shared/updates'
import type { Messages } from '../../../shared/i18n'

/** Shared by UpdateBadge (InitialView) and TopBar's inline update icon. */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    void window.api.app.getUpdateStatus().then(setStatus)
    return window.api.app.onUpdateStatus(setStatus)
  }, [])

  return status
}

export function updateStatusLabel(t: Messages['about'], status: UpdateStatus): string | null {
  switch (status.state) {
    case 'available':
      return t.badgeAvailable(status.version)
    case 'downloading':
      return t.badgeDownloading(Math.max(0, Math.min(100, Math.round(status.percent))))
    case 'downloaded':
      return t.badgeReady(status.version)
    default:
      return null
  }
}
