import { resolveActiveConfig, type AiSettings } from '../../../../shared/ai'
import { commitMessageLanguageInstruction } from '../../../../shared/aiPrompts'
import { sendChatRequest } from './providers'

// Unlike generatePrDraft, this returns free-form markdown (rendered directly
// via the app's Markdown component) rather than structured JSON — it's an
// advisory opinion shown to the user, never parsed or used to gate anything.
function buildPrompt(
  title: string,
  body: string,
  headBranch: string,
  baseBranch: string,
  diff: string,
  language: AiSettings['language']
): string {
  const languageInstruction = commitMessageLanguageInstruction(language)

  return `You are a careful senior reviewer giving a quick pre-flight check before a pull request is created. Look at the proposed title/description together with the actual diff and give a short, honest opinion.

Cover, briefly:
- Whether the title and description actually match what the diff does (call out anything missing or wrong).
- Anything that looks risky or wrong in the diff itself: leaked secrets/credentials, leftover debug code, obviously missing tests, unresolved conflict markers, or similar.
- Whether the branch direction (head → base) looks sane, if you can tell.

Formatting:
- Reply in markdown, at most a short paragraph plus up to 5 bullet points.
- Start with a one-line verdict: either "✅ Tudo certo para criar a PR." or "⚠️ Alguns pontos para revisar antes de criar a PR." (translate the verdict sentence itself to the selected language, keep the emoji).
- If everything looks fine, don't invent problems — a short "looks good" is a valid answer.
- Never use backticks; wrap identifiers in single quotes instead.
- ${languageInstruction}

Pull request title:
${title || '(vazio)'}

Pull request description:
${body || '(vazio)'}

Branch: ${headBranch} → ${baseBranch}

Git diff:
${diff}`
}

export async function reviewPrDraft(
  settings: AiSettings,
  apiKey: string,
  {
    title,
    body,
    headBranch,
    baseBranch,
    diff
  }: { title: string; body: string; headBranch: string; baseBranch: string; diff: string }
): Promise<string> {
  const truncatedDiff = diff.slice(0, settings.maxDiffChars)
  const prompt = buildPrompt(title, body, headBranch, baseBranch, truncatedDiff, settings.language)

  const response = await sendChatRequest(resolveActiveConfig(settings), apiKey, [
    { role: 'system', content: 'You give concise, honest pre-flight reviews of pull requests before they are created.' },
    { role: 'user', content: prompt }
  ])

  return response.content.trim()
}
