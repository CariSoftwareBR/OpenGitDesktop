import { resolveActiveConfig, type AiSettings } from '../../../../shared/ai'
import { conflictSummaryLanguageInstruction } from '../../../../shared/aiPrompts'
import { sendChatRequest } from './providers'
import type { ConflictBlock, FileBlock } from '../conflicts'
import { getLocale, getT } from '../i18n'
import type { AiLanguage } from '../../../../shared/aiPrompts'

export interface ConflictBlockDecision {
  id: number
  choice: 'ours' | 'theirs' | 'both' | 'custom'
  text?: string[]
}

export interface GeneratedConflictResolution {
  summary: string
  decisions: ConflictBlockDecision[]
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

  const summaryMatch = content.match(/"summary"\s*:\s*"((?:\\.|[^"])*)"/s)
  const summary = summaryMatch ? summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : ''
  return { decisions, summary }
}

function parseResponse(text: string): GeneratedConflictResolution {
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
- "summary" is one short sentence describing what you resolved and why.
- ${languageInstruction}

Conflict blocks:
${blockDescriptions.join('\n\n')}`
}

export async function generateConflictResolution(
  settings: AiSettings,
  apiKey: string,
  path: string,
  blocks: FileBlock[]
): Promise<GeneratedConflictResolution> {
  const conflictBlocks = blocks.filter((b): b is ConflictBlock => b.type === 'conflict')
  const prompt = buildPrompt(path, blocks, getLocale())

  const response = await sendChatRequest(resolveActiveConfig(settings), apiKey, [
    { role: 'system', content: 'You resolve Git merge conflicts precisely and conservatively.' },
    { role: 'user', content: prompt }
  ])

  const result = parseResponse(response.content)
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

  return {
    summary: result.summary || getT().stores.conflictSummary(path),
    decisions: result.decisions
  }
}
