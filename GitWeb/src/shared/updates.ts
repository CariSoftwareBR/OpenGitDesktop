export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'disabled'; reason: string }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseName: string | null; releaseNotes: string | null }
  | { state: 'not-available'; version: string }
  | {
      state: 'downloading'
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
      /** Carried over from 'available', so a view opened mid-download still knows what it's getting. */
      version?: string
      releaseNotes?: string | null
    }
  | { state: 'downloaded'; version: string; releaseNotes: string | null }
  | { state: 'error'; message: string }
