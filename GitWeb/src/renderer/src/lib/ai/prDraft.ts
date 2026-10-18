import { resolveActiveConfig, type AiSettings } from '../../../../shared/ai'
import { commitMessageLanguageInstruction } from '../../../../shared/aiPrompts'
import { sendChatRequest } from './providers'
import { getLocale } from '../i18n'
import type { AiLanguage } from '../../../../shared/aiPrompts'

export interface GeneratedPrDraft {
  title: string
  body: string
}

// Same JSON-with-fallback approach as commitMessage.ts's extractJson/
// tryParseMalformedJson — kept local (not shared) since the two generators'
// prompts and field names differ enough that a shared helper would just add
// indirection for ~30 lines of parsing.
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

function tryParseMalformedJson(content: string): GeneratedPrDraft | null {
  const titleMatch = content.match(/"title"\s*:\s*"((?:\\.|[^"])*)"/s)
  const bodyMatch = content.match(/"body"\s*:\s*"((?:\\.|[^"])*)"/s)
  if (!titleMatch && !bodyMatch) return null

  const title = titleMatch ? decodeJsonString(titleMatch[1]).trim() : ''
  const body = bodyMatch ? decodeJsonString(bodyMatch[1]).trim() : ''
  if (!title && !body) return null
  return { title, body }
}

function replaceBackticks(text: string): string {
  return text.replace(/`/g, "'")
}

function extractJson(text: string): GeneratedPrDraft {
  const content = stripCodeFence(text.trim())
  const jsonText = extractJsonObject(content)

  const result = ((): GeneratedPrDraft => {
    try {
      const parsed = JSON.parse(jsonText)
      return { title: String(parsed.title ?? '').trim(), body: String(parsed.body ?? '').trim() }
    } catch {
      const malformed = tryParseMalformedJson(content)
      if (malformed) return malformed

      const lines = content.split('\n').filter((l) => l.trim())
      return { title: lines[0] ?? '', body: lines.slice(1).join('\n') }
    }
  })()

  return { title: replaceBackticks(result.title), body: replaceBackticks(result.body) }
}

const KEY_CHANGES_HEADING: Record<AiLanguage, string> = {
  'pt-BR': 'Principais mudanças',
  en: 'Key changes',
  es: 'Cambios principales'
}

function buildPrompt(
  headBranch: string,
  baseBranch: string,
  diff: string,
  language: AiLanguage
): string {
  const languageInstruction = commitMessageLanguageInstruction(language)
  const changesHeading = KEY_CHANGES_HEADING[language]

  return `Analyze the Git diff below (between branch "${baseBranch}" and "${headBranch}") and draft a pull request like GitHub Copilot would.

Requirements:
- Return only valid JSON.
- JSON shape: {"title":"...","body":"..."}
- title must be a polished sentence, concise, specific, and at most 72 characters.
- If the selected language is pt-BR, start the title with a past participle verb form such as "Adicionado", "Atualizado", or "Removido", not an infinitive like "Adicionar". If it is Spanish, likewise use "Añadido", "Actualizado", or "Eliminado", not "Añadir".
- body must be markdown useful for a real PR reviewer, not a terse changelog.
- Start body with one short paragraph summarizing the change.
- Then add a blank line and a "## ${changesHeading}" heading followed by 3 to 8 bullet points with concrete changes.
- Mention important files/classes/settings only when they clarify what changed.
- Cover all meaningful changes in the diff; avoid generic wording.
- Prefer behavior and user impact over low-level implementation trivia.
- Do not invent changes that are not visible in the diff.
- Do not include reasoning, analysis notes, or <think> tags.
- Never use backticks. Wrap file names, class names, and code identifiers in single quotes instead, e.g. 'AiRequestError' not \`AiRequestError\`.
- ${languageInstruction}
- Do not wrap the JSON in markdown.

Branch: ${headBranch} → ${baseBranch}

Git diff:
${diff}`
}

export async function generatePrDraft(
  settings: AiSettings,
  apiKey: string,
  { headBranch, baseBranch, diff }: { headBranch: string; baseBranch: string; diff: string }
): Promise<GeneratedPrDraft> {
  const truncatedDiff = diff.slice(0, settings.maxDiffChars)
  const prompt = buildPrompt(headBranch, baseBranch, truncatedDiff, getLocale())

  const response = await sendChatRequest(resolveActiveConfig(settings), apiKey, [
    { role: 'system', content: 'You write clear, accurate pull request titles and descriptions.' },
    { role: 'user', content: prompt }
  ])

  return extractJson(response.content)
}
