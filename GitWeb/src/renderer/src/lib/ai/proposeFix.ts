import type { InvestigationFinding } from './commitInvestigation'
import {
  proposeFixNoContentError,
  proposeFixPrompt,
  proposeFixUserMessage,
  type AiLanguage
} from '../../../../shared/aiPrompts'
import type { AiSettings } from '../../../../shared/ai'
import { sendChatRequest } from './providers'
import { unifiedPreview } from '../../../../shared/patch'
import type { ResolvedAiConfig } from '../../../../shared/ai'

export async function proposeFileFix(input: {
  finding: InvestigationFinding
  fileContent: string
  language: AiLanguage
  config: ResolvedAiConfig
  apiKey: string
  requestId: string
}): Promise<{ content: string; diff: string }> {
  const response = await sendChatRequest(
    input.config,
    input.apiKey,
    [
      { role: 'system', content: proposeFixPrompt(input.language) },
      {
        role: 'user',
        content: proposeFixUserMessage(input.language, input.finding, input.fileContent)
      }
    ],
    [],
    input.requestId
  )

  const raw = response.content.trim().replace(/^```json\s*|```$/gim, '')
  const objectText = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw
  const parsed = JSON.parse(objectText) as { content?: unknown }
  if (typeof parsed.content !== 'string' || !parsed.content) {
    throw new Error(proposeFixNoContentError(input.language))
  }
  return {
    content: parsed.content,
    diff: unifiedPreview(input.finding.path, input.fileContent, parsed.content)
  }
}
