import { resolveActiveConfig, type AiSettings } from '../../../../shared/ai'
import { commitMessageLanguageInstruction } from '../../../../shared/aiPrompts'
import { sendChatRequest } from './providers'
import { getLocale } from '../i18n'
import type { AiLanguage } from '../../../../shared/aiPrompts'

export interface GeneratedCommitMessage {
  summary: string
  description: string
}

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

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`)
  } catch {
    return value.replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
}

// Regex-based key extraction for JSON a smaller/local model got almost
// right but broke (unescaped quotes, trailing commas, etc.) — ported from
// AiCommitMessageService.TryParseMalformedJsonSuggestion so a broken
// response still yields a usable message instead of an error.
function tryParseMalformedJson(content: string): GeneratedCommitMessage | null {
  const summaryMatch = content.match(/"summary"\s*:\s*"((?:\\.|[^"\\])*)"/s)
  const descriptionMatch = content.match(/"description"\s*:\s*"((?:\\.|[^"\\])*)"/s)
  if (!summaryMatch && !descriptionMatch) return null

  const summary = summaryMatch ? decodeJsonString(summaryMatch[1]).trim() : ''
  const descriptionParts: string[] = []

  if (descriptionMatch) {
    const description = decodeJsonString(descriptionMatch[1]).trim()
    if (description) descriptionParts.push(description)

    const tail = content.slice((descriptionMatch.index ?? 0) + descriptionMatch[0].length)
    for (const match of tail.matchAll(/"((?:\\.|[^"\\])*)"/gs)) {
      const value = decodeJsonString(match[1])
      if (!value.trim()) {
        if (descriptionParts.length > 0 && descriptionParts[descriptionParts.length - 1] !== '') descriptionParts.push('')
        continue
      }
      descriptionParts.push(value.trim())
    }
  }

  const description = descriptionParts.join('\n').trim()
  if (!summary && !description) return null
  return { summary, description }
}

// Models reliably ignore the "no backticks" prompt instruction often enough
// that it needs a mechanical backstop — swap them for single quotes rather
// than trust the model to follow style instructions on its own.
function replaceBackticks(text: string): string {
  return text.replace(/`/g, "'")
}

function extractJson(text: string): GeneratedCommitMessage {
  const content = stripCodeFence(text.trim())
  const jsonText = extractJsonObject(content)

  const result = ((): GeneratedCommitMessage => {
    try {
      const parsed = JSON.parse(jsonText)
      return { summary: String(parsed.summary ?? '').trim(), description: String(parsed.description ?? '').trim() }
    } catch {
      const malformed = tryParseMalformedJson(content)
      if (malformed) return malformed

      const lines = content.split('\n').filter((l) => l.trim())
      return { summary: lines[0] ?? '', description: lines.slice(1).join('\n') }
    }
  })()

  return { summary: replaceBackticks(result.summary), description: replaceBackticks(result.description) }
}

// Ported verbatim (translated from C#) from AiCommitMessageService.BuildPrompt
// in the original WinUI app — this exact structure (short summary + blank
// line + 3-8 concrete bullets + optional impact sentence) is what produces
// commit messages worth reading, as opposed to a generic one-liner.
function buildPrompt(branch: string, status: string, diff: string, language: AiLanguage): string {
  const languageInstruction = commitMessageLanguageInstruction(language)

  return `Analyze the Git changes below and generate a commit message like GitHub Copilot would.

Requirements:
- Return only valid JSON.
- JSON shape: {"summary":"...","description":"..."}
- summary must be a polished sentence, concise, specific, and at most 72 characters.
- If the selected language is pt-BR, start the summary with a past participle verb form such as "Adicionado", "Atualizado", or "Removido", not an infinitive like "Adicionar". If it is Spanish, likewise use "Añadido", "Actualizado", or "Eliminado", not "Añadir".
- description must be useful for a real commit review, not a terse changelog.
- Start description with one short sentence that expands the summary.
- Then add a blank line and 3 to 8 bullet lines with concrete changes.
- Add one final short impact sentence when the diff shows user-facing behavior, safety, configuration, or workflow changes.
- Mention important files/classes/settings only when they clarify what changed.
- Cover all meaningful changes in the diff; avoid generic wording.
- Prefer behavior and user/developer impact over low-level implementation trivia.
- Do not invent changes that are not visible in the diff.
- Do not include reasoning, analysis notes, markdown fences, or <think> tags.
- Never use backticks. Wrap file names, class names, and code identifiers in single quotes instead, e.g. 'AiRequestError' not \`AiRequestError\`.
- ${languageInstruction}
- Do not wrap the JSON in markdown.

Branch:
${branch}

Git status:
${status}

Git diff:
${diff}`
}

export async function generateCommitMessage(
  settings: AiSettings,
  apiKey: string,
  branch: string,
  status: string,
  diff: string
): Promise<GeneratedCommitMessage> {
  const truncatedDiff = diff.slice(0, settings.maxDiffChars)
  const prompt = buildPrompt(branch, status, truncatedDiff, getLocale())

  const response = await sendChatRequest(resolveActiveConfig(settings), apiKey, [
    { role: 'system', content: 'You write accurate Git commit messages.' },
    { role: 'user', content: prompt }
  ])

  return extractJson(response.content)
}
