import { useEffect, useRef, useState } from 'react'
import type { ClonePhase, CloneProgress } from '../../../shared/git'

const PHASE_LABEL: Record<ClonePhase, string> = {
  counting: 'Contando objetos',
  compressing: 'Comprimindo objetos',
  receiving: 'Recebendo objetos',
  resolving: 'Resolvendo deltas',
  checkingOut: 'Atualizando arquivos'
}

export function clonePhaseLabel(phase: ClonePhase): string {
  return PHASE_LABEL[phase]
}

interface CloneProgressState {
  progress: CloneProgress | null
  /** Seconds since the last progress event — how a stalled clone is spotted. */
  stalledFor: number
  reset: () => void
}

/**
 * Subscribes to clone progress pushed from main. Mirrors useUpdateStatus, plus a
 * 1s tick while a clone is live so the UI can say "sem resposta há Ns" — a bar
 * that simply stops moving looks identical to one that is merely slow.
 *
 * `destination` is the clone being watched, or null when none is running. The
 * event carries its own destination, and only matching ones are taken: main
 * broadcasts to the whole frame, so a clone still winding down (a cancelled one
 * whose last packets are draining) would otherwise drive this bar.
 */
export function useCloneProgress(destination: string | null): CloneProgressState {
  const [progress, setProgress] = useState<CloneProgress | null>(null)
  const [stalledFor, setStalledFor] = useState(0)
  const lastEventAt = useRef<number>(Date.now())
  // Read inside the listener so the subscription survives destination changes.
  const watched = useRef(destination)
  watched.current = destination

  useEffect(() => {
    return window.api.git.onCloneProgress((next) => {
      if (next.destination !== watched.current) return
      lastEventAt.current = Date.now()
      setStalledFor(0)
      setProgress(next)
    })
  }, [])

  useEffect(() => {
    if (destination === null) return
    lastEventAt.current = Date.now()
    const id = window.setInterval(() => {
      setStalledFor(Math.floor((Date.now() - lastEventAt.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [destination])

  return {
    progress,
    stalledFor,
    reset: () => {
      setProgress(null)
      setStalledFor(0)
    }
  }
}
