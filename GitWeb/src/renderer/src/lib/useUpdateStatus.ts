import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../shared/updates'

/** Shared by UpdateBadge (InitialView) and TopBar's inline update icon. */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    void window.api.app.getUpdateStatus().then(setStatus)
    return window.api.app.onUpdateStatus(setStatus)
  }, [])

  return status
}

export function updateStatusLabel(status: UpdateStatus): string | null {
  switch (status.state) {
    case 'available':
      return `Nova versão ${status.version} disponível`
    case 'downloading':
      return `Baixando atualização… ${Math.max(0, Math.min(100, Math.round(status.percent)))}%`
    case 'downloaded':
      return `Versão ${status.version} pronta para instalar`
    default:
      return null
  }
}
