import type {
  BlameCommit,
  CommitFileStat,
  CommitRef,
  CommitSummary,
  CommitSummaryWithStats,
  RebaseStep
} from '../../../../shared/git'
import type { PullRequestStatus } from '../../../../shared/github'

/**
 * Structured twin of a tool's text result (or of its approval card), rendered
 * as a card in the chat. Renderer-only: the model still reads the text — the
 * visual exists for the person, who should not have to parse a block of hashes.
 */
export type ToolVisual =
  | { kind: 'commits'; commits: CommitSummaryWithStats[]; localOnly: string[] }
  | { kind: 'commit'; commit: CommitSummary & { parents: string[] }; files: CommitFileStat[]; focusPath?: string }
  | {
      kind: 'repos'
      repos: {
        name: string
        path: string
        branch: string | null
        ahead: number
        behind: number
        dirty: number
        incoming: boolean
        error?: string
      }[]
    }
  | { kind: 'prStatus'; status: PullRequestStatus }
  /** "These N commits go to <target>" — merge and push approvals. */
  | { kind: 'flow'; source: string; target: string; commits: CommitSummary[]; total: number; newBranch?: boolean }
  /** show_in_history: the commit pointed at, and where it already is. */
  | { kind: 'focus'; commit: CommitSummary; containedIn: CommitRef[] }
  | { kind: 'release'; from: string | null; to: string; commits: CommitSummary[]; total: number }
  /** A local reorganization: the commits as they are (oldest first) and the plan. */
  | { kind: 'rebase'; before: CommitSummary[]; steps: RebaseStep[] }
  | {
      kind: 'blame'
      path: string
      line?: number
      lineText?: string
      commit?: BlameCommit
      authors: { name: string; lines: number }[]
      timeline: CommitSummary[]
    }
  | { kind: 'tags'; tags: { name: string; shortTarget: string; date: string; message: string }[] }

export interface ToolOutput {
  text: string
  visual?: ToolVisual
}

export function toToolOutput(result: string | ToolOutput): ToolOutput {
  return typeof result === 'string' ? { text: result } : result
}

export type ReleaseGroup = 'feat' | 'fix' | 'other'

/** Conventional-commit-ish grouping, tolerant of pt/en/es verbs. */
export function releaseGroup(summary: string): ReleaseGroup {
  const s = summary.trim().toLowerCase()
  if (/^(feat|feature)(\(.+\))?!?:/.test(s) || /^(adiciona|add|added|cria|implementa|implement|nuevo|agrega|añade|novo|nova)\b/.test(s)) {
    return 'feat'
  }
  if (/^(fix|hotfix|bugfix)(\(.+\))?!?:/.test(s) || /^(corrige|fix|fixes|fixed|corrige|arregla|soluciona|resolve)\b/.test(s)) {
    return 'fix'
  }
  return 'other'
}
