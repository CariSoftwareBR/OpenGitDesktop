import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Circle, Loader2, X } from 'lucide-react'
import type { UiToolCall } from '../store/aiStore'
import type { ToolRunStep } from '../lib/ai/chatGrouping'
import { getToolDisplay } from '../lib/ai/toolDisplay'
import ToolResult from './ToolResult'
import { useT } from '../lib/i18n'

function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

function stepLabel(uiCall: UiToolCall, wholeCommit: string): string {
  const path = uiCall.resolvedArgs.path || uiCall.call.arguments.path
  if (path) return basename(path)
  const commitField = uiCall.preview.fields.find((f) => f.label === 'Commit')
  return commitField ? wholeCommit : uiCall.preview.headline
}

function StepIcon({ status }: { status: UiToolCall['status'] }): JSX.Element {
  if (status === 'running') return <Loader2 size={13} className="shrink-0 animate-spin text-command-blue" aria-hidden />
  if (status === 'completed') return <Check size={13} className="shrink-0 text-success-green" aria-hidden />
  if (status === 'failed') return <X size={13} className="shrink-0 text-danger-red" aria-hidden />
  if (status === 'cancelled') return <X size={13} className="shrink-0 text-tertiary-text" aria-hidden />
  return <Circle size={13} className="shrink-0 text-tertiary-text" aria-hidden />
}

function statusText(status: UiToolCall['status']): string {
  if (status === 'completed') return 'text-success-green'
  if (status === 'failed') return 'text-danger-red'
  if (status === 'cancelled') return 'text-tertiary-text line-through'
  return 'text-primary-text'
}

function ToolRunGroup({
  toolName,
  steps,
  hasFollowingMessage
}: {
  toolName: string
  steps: ToolRunStep[]
  /** True once something was rendered after the group — i.e. the assistant
   * moved on and the exploration is over. */
  hasFollowingMessage: boolean
}): JSX.Element {
  const [openStep, setOpenStep] = useState<string | null>(null)
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)

  const t = useT().tools
  const { label, icon: Icon } = getToolDisplay(toolName, t.label)
  const active = steps.some((s) => s.uiCall.status === 'running' || s.uiCall.status === 'pending')
  const done = steps.filter((s) => s.uiCall.status === 'completed').length
  const failed = steps.filter((s) => s.uiCall.status === 'failed').length

  // Watch it work while it runs; get out of the way once the answer arrives.
  const expanded = manualExpanded ?? (active || !hasFollowingMessage)

  const subjectField = steps[0].uiCall.preview.fields.find((f) => f.label === 'Commit')
  const subject = subjectField ? subjectField.value.split(' — ')[0] : undefined

  const summary = active
    ? `${label} · ${done}/${steps.length}`
    : `${t.readings(steps.length)}${failed > 0 ? ` · ${t.withErrors(failed)}` : ''}`

  return (
    <div className="w-full rounded-md border border-default-border bg-coal-raised p-3 text-body">
      <button
        type="button"
        onClick={() => setManualExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-left text-primary-text"
      >
        {active ? (
          <Loader2 size={13} className="shrink-0 animate-spin text-secondary-text" aria-hidden />
        ) : (
          <Icon size={13} className="shrink-0 text-secondary-text" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {active ? t.exploring : summary}
          {subject && <span className="text-secondary-text"> · {subject}</span>}
        </span>
        {expanded ? (
          <ChevronDown size={14} className="shrink-0 text-tertiary-text" aria-hidden />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-tertiary-text" aria-hidden />
        )}
      </button>

      {expanded && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {steps.map((step) => {
            const isOpen = openStep === step.uiCall.call.id
            const result = step.uiCall.result
            return (
              <li key={step.uiCall.call.id} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => setOpenStep(isOpen ? null : step.uiCall.call.id)}
                  disabled={!result}
                  aria-expanded={isOpen}
                  // A step with no result yet isn't clickable, but it must not
                  // look dimmed — it's the file being read right now, the most
                  // important line in the card. Overrides the global
                  // `button:disabled` opacity.
                  className="flex items-center gap-2 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-hover-overlay disabled:pointer-events-none disabled:opacity-100"
                >
                  <StepIcon status={step.uiCall.status} />
                  <span className={`min-w-0 flex-1 truncate text-caption ${statusText(step.uiCall.status)}`}>
                    {stepLabel(step.uiCall, t.wholeCommit)}
                  </span>
                </button>
                {step.narration && (
                  <p className="truncate pl-6 text-caption text-tertiary-text" title={step.narration}>
                    {step.narration}
                  </p>
                )}
                {isOpen && result && (
                  <div className="mt-1 ml-6 rounded-md border border-default-border bg-midnight-base px-2.5 py-2">
                    <ToolResult text={result} tone={step.uiCall.status === 'failed' ? 'danger' : 'default'} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default ToolRunGroup
