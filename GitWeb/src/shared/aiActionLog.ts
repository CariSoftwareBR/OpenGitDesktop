// The assistant's action log: every action that would change something,
// with what the user decided and how it ended. Read-only lookups are left out —
// they run on their own and would bury the decisions that matter.

export type AiActionSeverity = 'write' | 'danger'
/** approved: the user clicked approve. rejected: cancelled. blocked: a rule in Settings stopped it before the card. */
export type AiActionDecision = 'approved' | 'rejected' | 'blocked'
export type AiActionOutcome = 'completed' | 'failed'

export interface AiActionEntry {
  id: string
  /** ISO time. */
  at: string
  repoPath: string | null
  tool: string
  headline: string
  severity: AiActionSeverity
  decision: AiActionDecision
  /** Only for approved actions. */
  outcome: AiActionOutcome | null
  /** The result or the reason, shortened. */
  detail: string | null
}

export type NewAiActionEntry = Omit<AiActionEntry, 'id' | 'at'>

export const MAX_AI_ACTION_LOG = 500
export const MAX_AI_ACTION_DETAIL = 600

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

/** Validates one entry coming from the renderer (or a hand-edited file); null when unusable. */
export function sanitizeNewEntry(value: unknown): NewAiActionEntry | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const tool = text(raw.tool, 80)
  const headline = text(raw.headline, 300)
  const severity = raw.severity === 'write' || raw.severity === 'danger' ? raw.severity : null
  const decision = raw.decision === 'approved' || raw.decision === 'rejected' || raw.decision === 'blocked' ? raw.decision : null
  if (!tool || !headline || !severity || !decision) return null
  const outcome = decision === 'approved' && (raw.outcome === 'completed' || raw.outcome === 'failed') ? raw.outcome : null
  return {
    repoPath: text(raw.repoPath, 1000),
    tool,
    headline,
    severity,
    decision,
    outcome,
    detail: text(raw.detail, MAX_AI_ACTION_DETAIL)
  }
}

export function sanitizeLog(value: unknown): AiActionEntry[] {
  if (!Array.isArray(value)) return []
  const result: AiActionEntry[] = []
  for (const item of value) {
    const entry = sanitizeNewEntry(item)
    const raw = item as Record<string, unknown>
    if (!entry || typeof raw.id !== 'string' || typeof raw.at !== 'string' || Number.isNaN(Date.parse(raw.at))) continue
    result.push({ id: raw.id, at: raw.at, ...entry })
  }
  return result.slice(0, MAX_AI_ACTION_LOG)
}

/** Newest first, capped: the oldest entries fall off the end. */
export function appendToLog(log: AiActionEntry[], entry: AiActionEntry): AiActionEntry[] {
  return [entry, ...log].slice(0, MAX_AI_ACTION_LOG)
}
