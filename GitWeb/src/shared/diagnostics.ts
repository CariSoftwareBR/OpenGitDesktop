// Environment checks shown in Settings › Diagnóstico. Main runs them and
// returns plain data; the renderer owns every word shown for them.

export type DiagnosticId = 'git' | 'identity' | 'longPaths' | 'safeDirectory' | 'lfs' | 'ssh' | 'credentialHelper' | 'github'

export type DiagnosticStatus = 'ok' | 'warn' | 'error' | 'info'

/** Fixes main knows how to run; the renderer can only name one of these, never send a command. */
export type DiagnosticFixId = 'enableLongPaths' | 'trustRepository'

/** Why a check landed where it did, for the text the renderer picks. */
export type DiagnosticReason =
  | 'ok'
  | 'notFound'
  | 'outdated'
  | 'missingName'
  | 'missingEmail'
  | 'missingBoth'
  | 'disabled'
  | 'dubiousOwnership'
  | 'usedButMissing'
  | 'notInstalled'
  | 'notConfigured'
  | 'notSignedIn'
  | 'tokenInvalid'
  | 'missingRepoScope'
  | 'unreachable'

export interface DiagnosticCheck {
  id: DiagnosticId
  status: DiagnosticStatus
  reason: DiagnosticReason
  /** A value worth showing as-is: a version, a login, a helper name. */
  value: string | null
  fix: { id: DiagnosticFixId; command: string } | null
}

/** Below this, the app still works, but some screens lose features (safe.directory handling, newer status fields). */
export const MIN_RECOMMENDED_GIT: [number, number] = [2, 36]

/** `git version 2.47.1.windows.1` → [2, 47, 1]. */
export function parseGitVersion(output: string): [number, number, number] | null {
  const match = /git version (\d+)\.(\d+)(?:\.(\d+))?/.exec(output)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)]
}

export function isGitVersionAtLeast(version: [number, number, number], min: [number, number]): boolean {
  return version[0] > min[0] || (version[0] === min[0] && version[1] >= min[1])
}

/** `git@host:…` and `ssh://…` remotes go through the ssh client; https ones do not. */
export function isSshRemote(url: string | null): boolean {
  if (!url) return false
  const trimmed = url.trim()
  return /^ssh:\/\//i.test(trimmed) || /^[^/\\:@\s]+@[^/\\:\s]+:(?!\/\/)/.test(trimmed)
}

/** Order that reads top-down: the essentials first, the optional integrations after. */
export const DIAGNOSTIC_ORDER: DiagnosticId[] = ['git', 'identity', 'safeDirectory', 'longPaths', 'lfs', 'ssh', 'credentialHelper', 'github']

/** Worst status first, then the fixed order, so problems lead the list. */
export function sortChecks(checks: DiagnosticCheck[]): DiagnosticCheck[] {
  const weight: Record<DiagnosticStatus, number> = { error: 0, warn: 1, info: 2, ok: 3 }
  return [...checks].sort(
    (a, b) => weight[a.status] - weight[b.status] || DIAGNOSTIC_ORDER.indexOf(a.id) - DIAGNOSTIC_ORDER.indexOf(b.id)
  )
}
