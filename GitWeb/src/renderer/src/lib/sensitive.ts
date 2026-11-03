import type { Messages } from '../../../shared/i18n'
import { sensitiveFileKind, type SensitiveFinding } from '../../../shared/sensitiveFiles'
import { DEFAULT_APP_SETTINGS } from '../../../shared/settings'
import { useAppSettingsStore } from '../store/appSettingsStore'
import { getT } from './i18n'
import { useRepoStore } from '../store/repoStore'
import { toIgnorePattern } from './path'

export interface SensitiveFileGroup {
  path: string
  /** "Token do GitHub · linha 12" — one entry per kind found in the file. */
  reasons: string[]
}

/** Findings grouped by file, each reason already labelled. */
export function groupFindings(findings: SensitiveFinding[], t: Messages['security']): SensitiveFileGroup[] {
  const groups = new Map<string, string[]>()
  for (const finding of findings) {
    const label = t.kinds[finding.kind]
    const reason = finding.line ? `${label} · ${t.line(finding.line)}` : label
    groups.set(finding.path, [...(groups.get(finding.path) ?? []), reason])
  }
  return [...groups].map(([path, reasons]) => ({ path, reasons }))
}

/** One-line summary for the AI approval card and the model: `.env (Arquivo de ambiente), …`. */
export function describeFindings(findings: SensitiveFinding[], t: Messages['security'], max = 8): string {
  const groups = groupFindings(findings, t)
  const shown = groups.slice(0, max).map((g) => `${g.path} (${g.reasons.join('; ')})`)
  if (groups.length > max) shown.push(t.more(groups.length - max))
  return shown.join(', ')
}

export interface SensitiveSplit {
  allPaths: string[]
  /** Flagged by name (.env, id_rsa…): never meant to be versioned, so .gitignore fits. */
  ignorePaths: string[]
  /** Flagged only by content (a token inside code): ignoring would hide the code. */
  unstageOnlyPaths: string[]
}

export function splitForIgnore(findings: SensitiveFinding[]): SensitiveSplit {
  const byName = new Set(findings.filter((f) => f.line === undefined).map((f) => f.path))
  const allPaths = [...new Set(findings.map((f) => f.path))]
  return {
    allPaths,
    ignorePaths: allPaths.filter((path) => byName.has(path)),
    unstageOnlyPaths: allPaths.filter((path) => !byName.has(path))
  }
}

/** Unstages every flagged file; they stay on disk as they are. */
export async function unstageSensitive(split: SensitiveSplit): Promise<void> {
  await useRepoStore.getState().unstagePaths(split.allPaths)
}

/**
 * Name-flagged files go into .gitignore and leave the index (git rm --cached,
 * so a tracked one stops being tracked); content-flagged ones are unstaged.
 */
export async function ignoreSensitive(split: SensitiveSplit): Promise<void> {
  const repo = useRepoStore.getState()
  if (split.ignorePaths.length > 0) await repo.ignorePatterns(split.ignorePaths.map(toIgnorePattern), split.ignorePaths, true)
  if (split.unstageOnlyPaths.length > 0) await useRepoStore.getState().unstagePaths(split.unstageOnlyPaths)
}

/**
 * Thrown by the AI commit tool in block mode. The message is for the model;
 * the findings let the chat draw a proper card for the person instead.
 */
export class SensitiveBlockedError extends Error {
  constructor(
    message: string,
    readonly findings: SensitiveFinding[]
  ) {
    super(message)
    this.name = 'SensitiveBlockedError'
  }
}

/**
 * Content about to go to the AI with a known path but no diff header (a new
 * file's raw text): a name-flagged file (.env, key…) is replaced whole by the
 * placeholder while the check is on. Token lines elsewhere are masked by the
 * main process on every request.
 */
export function withheldForAi(path: string, content: string): string {
  const enabled = useAppSettingsStore.getState().settings?.sensitiveCheck ?? DEFAULT_APP_SETTINGS.sensitiveCheck
  return enabled && sensitiveFileKind(path) ? getT().main.ai.sensitiveOmitted : content
}
