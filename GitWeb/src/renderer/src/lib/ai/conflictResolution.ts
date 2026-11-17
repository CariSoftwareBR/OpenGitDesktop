import type { ResolvedAiConfig } from '../../../../shared/ai'
import { conflictSummaryLanguageInstruction } from '../../../../shared/aiPrompts'
import { sendChatRequest, type ChatMessage } from './providers'
import {
  findDuplicateKeys,
  findLostChanges,
  keysDuplicatedByBoth,
  renderResolvedWithChoices,
  type ConflictBlock,
  type ConflictResolutionChoice,
  type FileBlock
} from '../conflicts'
import { getLocale, getT } from '../i18n'
import type { AiLanguage } from '../../../../shared/aiPrompts'

export interface ConflictBlockDecision {
  id: number
  choice: 'ours' | 'theirs' | 'both' | 'custom'
  text?: string[]
}

/** What the checks below found wrong with a proposal; shown on the approval card. */
export type ConflictProblem =
  | { kind: 'duplicateKeys'; blockId: number; keys: string[] }
  /** `lines`: what the `sideLabel` side wrote, which the proposal lost. */
  | { kind: 'lostChange'; blockId: number; sideLabel: string; lines: string[] }
  | { kind: 'invalidJson' }

export interface GeneratedConflictResolution {
  summary: string
  decisions: ConflictBlockDecision[]
  /** Empty when the proposal passed every check. */
  problems: ConflictProblem[]
}

const CONTEXT_LINES = 3
const MARKER_LINE = /^(<{7}|={7}$|>{7})/

function stripCodeFence(text: string): string {
  if (!text.startsWith('```')) return text
  const firstLineEnd = text.indexOf('\n')
  if (firstLineEnd < 0) return text
  const withoutStart = text.slice(firstLineEnd + 1)
  const endFence = withoutStart.lastIndexOf('```')
  return endFence >= 0 ? withoutStart.slice(0, endFence).trim() : withoutStart.trim()
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start >= 0 && end > start ? text.slice(start, end + 1) : text
}

// Regex-based recovery for JSON a smaller/local model got almost right but
// broke (unescaped quotes, trailing commas, etc.) — same technique as
// commitMessage.ts's tryParseMalformedJsonSuggestion, adapted for the
// decisions[] shape instead of a flat summary/description pair.
function tryParseMalformedJson(content: string): { decisions: ConflictBlockDecision[]; summary: string } | null {
  const decisions: ConflictBlockDecision[] = []
  const blockRegex = /\{\s*"id"\s*:\s*(\d+)\s*,\s*"choice"\s*:\s*"(ours|theirs|both|custom)"(?:\s*,\s*"text"\s*:\s*(\[[^\]]*\]))?\s*\}/g
  for (const match of content.matchAll(blockRegex)) {
    const id = Number(match[1])
    const choice = match[2] as ConflictBlockDecision['choice']
    let text: string[] | undefined
    if (match[3]) {
      try {
        text = JSON.parse(match[3])
      } catch {
        text = undefined
      }
    }
    decisions.push({ id, choice, text })
  }
  if (decisions.length === 0) return null

  const summaryMatch = content.match(/"summary"\s*:\s*"((?:\\.|[^"\\])*)"/s)
  const summary = summaryMatch ? summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : ''
  return { decisions, summary }
}

type ParsedAnswer = Omit<GeneratedConflictResolution, 'problems'>

function parseResponse(text: string): ParsedAnswer {
  const content = stripCodeFence(text.trim())
  const jsonText = extractJsonObject(content)

  try {
    const parsed = JSON.parse(jsonText)
    const decisions: ConflictBlockDecision[] = Array.isArray(parsed.decisions)
      ? parsed.decisions.map((d: { id: unknown; choice: unknown; text?: unknown }) => ({
          id: Number(d.id),
          choice: d.choice,
          text: Array.isArray(d.text) ? d.text.map(String) : undefined
        }))
      : []
    return { decisions, summary: String(parsed.summary ?? '').trim() }
  } catch {
    const malformed = tryParseMalformedJson(content)
    if (malformed) return malformed
    return { decisions: [], summary: '' }
  }
}

function buildPrompt(path: string, blocks: FileBlock[], language: AiLanguage): string {
  const languageInstruction = conflictSummaryLanguageInstruction(language)

  const blockDescriptions: string[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.type !== 'conflict') continue

    const before = blocks[i - 1]
    const after = blocks[i + 1]
    const contextBefore = before?.type === 'text' ? before.lines.slice(-CONTEXT_LINES) : []
    const contextAfter = after?.type === 'text' ? after.lines.slice(0, CONTEXT_LINES) : []

    blockDescriptions.push(
      [
        `Block #${block.id}:`,
        contextBefore.length > 0 ? `Context before:\n${contextBefore.join('\n')}` : '',
        block.base ? `Original (merge base, before either side changed it):\n${block.base.join('\n')}` : '',
        `"${block.oursLabel}" side:\n${block.ours.join('\n')}`,
        `"${block.theirsLabel}" side:\n${block.theirs.join('\n')}`,
        contextAfter.length > 0 ? `Context after:\n${contextAfter.join('\n')}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  return `You are resolving Git merge conflicts in the file "${path}". For each conflict block below, decide how to resolve it.

Requirements:
- Return only valid JSON, no markdown fences, no backticks, no reasoning text.
- JSON shape: {"decisions":[{"id":<number>,"choice":"ours"|"theirs"|"both"|"custom","text":["line1","line2"]}],"summary":"..."}
- Every block id listed below must appear exactly once in "decisions".
- "text" is required (and must be non-empty) only when "choice" is "custom" — use it when the correct resolution genuinely combines or rewrites both sides, not just one or "both" concatenated.
- "text" lines must be plain resolved content — never include conflict marker lines (<<<<<<<, =======, >>>>>>>).
- "choice":"both" means "ours" lines followed by "theirs" lines, verbatim, with no reordering — only use it when that concatenation is actually correct, not as a default.
- When both sides change the same keys or lines, "both" writes them twice; use "custom" and write each one once, keeping the change each side made.
- When a block shows the original, compare each side against it: a value a side left as in the original was not changed by that side, so keep the other side's change for it. Only where both sides changed the same value do you have to choose between them.
- "summary" is one short sentence describing what you resolved and why. It must describe the content you actually return.
- ${languageInstruction}

Conflict blocks:
${blockDescriptions.join('\n\n')}`
}

export function decisionsToChoices(decisions: ConflictBlockDecision[]): Map<number, ConflictResolutionChoice> {
  return new Map(decisions.map((d) => [d.id, d.choice === 'custom' ? { text: d.text ?? [] } : d.choice]))
}

function sideOnlyChoices(blocks: FileBlock[], side: 'ours' | 'theirs'): Map<number, ConflictResolutionChoice> {
  return new Map(blocks.filter((b): b is ConflictBlock => b.type === 'conflict').map((b) => [b.id, side]))
}

function parsesAsJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

function resolvedLines(block: ConflictBlock, decision: ConflictBlockDecision): string[] {
  if (decision.choice === 'ours') return block.ours
  if (decision.choice === 'theirs') return block.theirs
  if (decision.choice === 'both') return [...block.ours, ...block.theirs]
  return decision.text ?? []
}

/**
 * Checks a proposal for the mistakes a model makes when it merges blindly:
 * keys written twice in one object (a "both" that should have been "custom"),
 * a change only one side made thrown away (needs the block's merge base), and
 * a JSON file that no longer parses. The JSON check only runs when either side
 * on its own was valid JSON, so JSON-with-comments files never trip it.
 */
export function findResolutionProblems(path: string, blocks: FileBlock[], decisions: ConflictBlockDecision[]): ConflictProblem[] {
  const problems: ConflictProblem[] = []
  for (const block of blocks) {
    if (block.type !== 'conflict') continue
    const decision = decisions.find((d) => d.id === block.id)
    let keys: string[] = []
    if (decision?.choice === 'both') {
      keys = keysDuplicatedByBoth(block)
    } else if (decision?.choice === 'custom' && decision.text) {
      const already = new Set([...findDuplicateKeys(block.ours), ...findDuplicateKeys(block.theirs)])
      keys = findDuplicateKeys(decision.text).filter((key) => !already.has(key))
    }
    if (keys.length > 0) problems.push({ kind: 'duplicateKeys', blockId: block.id, keys })

    if (decision) {
      for (const lost of findLostChanges(block, resolvedLines(block, decision))) {
        const sideLabel = lost.side === 'ours' ? block.oursLabel : block.theirsLabel
        problems.push({ kind: 'lostChange', blockId: block.id, sideLabel, lines: lost.lines })
      }
    }
  }

  if (/\.json$/i.test(path)) {
    const sideIsJson =
      parsesAsJson(renderResolvedWithChoices(blocks, sideOnlyChoices(blocks, 'ours'))) ||
      parsesAsJson(renderResolvedWithChoices(blocks, sideOnlyChoices(blocks, 'theirs')))
    if (sideIsJson && !parsesAsJson(renderResolvedWithChoices(blocks, decisionsToChoices(decisions)))) {
      problems.push({ kind: 'invalidJson' })
    }
  }
  return problems
}

function describeProblemsForModel(problems: ConflictProblem[]): string {
  const lines = problems.map((p) => {
    if (p.kind === 'duplicateKeys') {
      return `- Block #${p.blockId}: your resolution writes these keys twice in the same object: ${p.keys.join(', ')}. Merge the two sides with "custom", writing each key once and keeping the change each side made.`
    }
    if (p.kind === 'lostChange') {
      return `- Block #${p.blockId}: only the "${p.sideLabel}" side changed these, the other side left them as in the original, so they must appear exactly like this in the result: ${p.lines.join(' | ')}`
    }
    return '- The resolved file is not valid JSON.'
  })
  return [
    'Your resolution has problems:',
    ...lines,
    'Return the corrected JSON in the same shape, covering every block again, and make "summary" describe exactly the content you return.'
  ].join('\n')
}

/** Parses and checks one answer's shape; throws when it is unusable. */
function readAnswer(content: string, conflictBlocks: ConflictBlock[]): ParsedAnswer {
  const result = parseResponse(content)
  if (result.decisions.length === 0) throw new Error(getT().stores.aiNoResolution)

  const seenIds = new Set(result.decisions.map((d) => d.id))
  const missing = conflictBlocks.filter((b) => !seenIds.has(b.id))
  if (missing.length > 0) throw new Error(getT().stores.aiMissingBlocks)

  for (const decision of result.decisions) {
    if (decision.choice !== 'custom') continue
    if (!decision.text || decision.text.length === 0) {
      throw new Error(getT().stores.aiCustomEmpty(decision.id))
    }
    if (decision.text.some((line) => MARKER_LINE.test(line))) {
      throw new Error(getT().stores.aiStillHasMarkers(decision.id))
    }
  }
  return result
}

/**
 * `config` carries the reasoning effort: the chat tool passes the chat's own
 * selector, so the proposal gets the effort the user sees in the panel.
 * A proposal that fails findResolutionProblems gets one corrective round; if
 * the model still gets it wrong, the problems travel with the result so the
 * approval card can show them.
 */
export async function generateConflictResolution(
  config: ResolvedAiConfig,
  apiKey: string,
  path: string,
  blocks: FileBlock[]
): Promise<GeneratedConflictResolution> {
  const conflictBlocks = blocks.filter((b): b is ConflictBlock => b.type === 'conflict')
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You resolve Git merge conflicts precisely and conservatively.' },
    { role: 'user', content: buildPrompt(path, blocks, getLocale()) }
  ]

  // keepContent: the answer's lines are written into the file, so a masked
  // secret would replace the real one in the code.
  const ask = (): Promise<string> =>
    sendChatRequest(config, apiKey, messages, [], undefined, { keepContent: true }).then((r) => r.content)

  const firstContent = await ask()
  const first = readAnswer(firstContent, conflictBlocks)
  let best: GeneratedConflictResolution = { ...first, problems: findResolutionProblems(path, blocks, first.decisions) }

  if (best.problems.length > 0) {
    messages.push({ role: 'assistant', content: firstContent }, { role: 'user', content: describeProblemsForModel(best.problems) })
    try {
      const second = readAnswer(await ask(), conflictBlocks)
      const problems = findResolutionProblems(path, blocks, second.decisions)
      if (problems.length <= best.problems.length) best = { ...second, problems }
    } catch {
      // The corrective round is a bonus: an unusable second answer leaves the
      // first one standing, with its problems still flagged on the card.
    }
  }

  return { ...best, summary: best.summary || getT().stores.conflictSummary(path) }
}
