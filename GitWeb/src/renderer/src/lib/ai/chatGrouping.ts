import type { ChatUiMessage, UiToolCall } from '../../store/aiStore'
import { toolSeverity } from './tools'

export interface ToolRunStep {
  messageId: string
  uiCall: UiToolCall
  /** What the assistant said in the turn that requested this call. */
  narration: string
}

export type ChatRenderItem =
  | { kind: 'message'; message: ChatUiMessage; index: number }
  | { kind: 'group'; id: string; toolName: string; steps: ToolRunStep[] }

// The model may only request one tool per response, so reading N files is N
// separate assistant turns — each with its own approval card and its own
// synthetic "[Tool feedback]" message. Rendered literally that is a wall of
// near-identical cards, so consecutive read-only calls of the same tool (and,
// for read_commit, the same commit) collapse into one live progress card.
//
// Write/danger tools are never grouped: their approve/cancel gate has to stay
// one card per action.
// Read tools whose answer is a picture (a card), not a reading to skim past:
// collapsing them into a progress group would hide exactly what they show.
const VISUAL_READ_TOOLS = new Set([
  'list_commits',
  'show_in_history',
  'explain_file_history',
  'check_all_repos',
  'check_pull_request_status',
  'prepare_release_notes',
  'list_tags'
])

export function groupChatMessages(messages: ChatUiMessage[]): ChatRenderItem[] {
  const items: ChatRenderItem[] = []

  function groupableCall(message: ChatUiMessage): UiToolCall | null {
    if (message.role !== 'assistant' || message.toolCalls?.length !== 1) return null
    const uiCall = message.toolCalls[0]
    if (VISUAL_READ_TOOLS.has(uiCall.call.name)) return null
    return toolSeverity(uiCall.call.name) === 'read' ? uiCall : null
  }

  // Two calls belong together only if they address the same thing — reading
  // two different commits stays two cards.
  function subjectOf(uiCall: UiToolCall): string {
    return uiCall.resolvedArgs.ref ?? uiCall.call.arguments.ref ?? ''
  }

  let i = 0
  while (i < messages.length) {
    const message = messages[i]

    // The synthetic tool-result message duplicates what the card already
    // shows; it exists for the model, not for the reader.
    if (message.toolFeedback) {
      i++
      continue
    }

    const first = groupableCall(message)
    if (!first) {
      items.push({ kind: 'message', message, index: i })
      i++
      continue
    }

    const toolName = first.call.name
    const subject = subjectOf(first)
    const steps: ToolRunStep[] = [{ messageId: message.id, uiCall: first, narration: message.content }]
    const groupId = message.id
    i++

    while (i < messages.length) {
      const next = messages[i]
      if (next.toolFeedback) {
        const sameTool = next.toolFeedback.every((entry) => entry.name === toolName)
        if (!sameTool) break
        i++
        continue
      }
      const call = groupableCall(next)
      if (!call || call.call.name !== toolName || subjectOf(call) !== subject) break
      steps.push({ messageId: next.id, uiCall: call, narration: next.content })
      i++
    }

    items.push({ kind: 'group', id: groupId, toolName, steps })
  }

  return items
}
