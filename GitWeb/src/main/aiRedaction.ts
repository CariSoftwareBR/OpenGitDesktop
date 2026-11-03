import { getSettings } from './settings'
import { tMain } from './i18n'
import { redactSensitiveText } from '../shared/sensitiveFiles'
import type { ChatMessage } from '../shared/aiChat'

/**
 * Every request to an AI provider passes here first (see the ai:* IPC
 * handlers). With the sensitive-file check on, secrets in diffs, file
 * excerpts and tool results are masked before they leave the machine — the
 * provider never receives a .env's values or a token, in warn mode included.
 */
export async function redactForAi(messages: ChatMessage[]): Promise<ChatMessage[]> {
  if (!(await getSettings()).sensitiveCheck) return messages
  const placeholder = tMain().ai.sensitiveOmitted
  return messages.map((m) => (m.content ? { ...m, content: redactSensitiveText(m.content, placeholder).text } : m))
}

/** read_file on a .env, a private key…: refused outright, like an ignored file. */
export async function assertAgentMayRead(path: string, isSensitive: boolean): Promise<void> {
  if (isSensitive && (await getSettings()).sensitiveCheck) throw new Error(tMain().git.agentReadSensitive(path))
}
