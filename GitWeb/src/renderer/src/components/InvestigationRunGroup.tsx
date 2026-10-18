import { useEffect, useState } from 'react'
import { Bot, BotMessageSquare, Bug, Check, ChevronDown, ChevronRight, Loader2, Square, Wrench, X } from 'lucide-react'
import type { InvestigationFinding, InvestigationStep, InvestigationStepStatus } from '../lib/ai/commitInvestigation'
import { useAiUi } from '../lib/useAiUi'

function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

function isRunning(status: InvestigationStepStatus): boolean {
  return status === 'running'
}

function RunningFile({ path }: { path: string }): JSX.Element {
  const ui = useAiUi()
  return (
    <span className="flex min-w-0 items-start gap-2 leading-none" title={path}>
      <BotMessageSquare size={22} className="mt-0.5 shrink-0 text-command-blue" aria-label={ui.investigationSubagent} />
      <span className="agent-busy-shimmer min-w-0 break-words whitespace-normal leading-[22px]">
        {ui.investigationAnalyzing(basename(path))}
      </span>
    </span>
  )
}

function InvestigationRunGroup({
  completed,
  total,
  active,
  stage,
  steps,
  problemPaths,
  findings = [],
  onProposeFix,
  proposingId
}: {
  completed: number
  total: number
  active: number
  stage: 'exploring' | 'consolidating' | 'completed'
  steps: InvestigationStep[]
  problemPaths: string[]
  findings?: InvestigationFinding[]
  onProposeFix?: (finding: InvestigationFinding) => void
  proposingId?: string | null
}): JSX.Element {
  const ui = useAiUi()
  const [showProblems, setShowProblems] = useState(false)
  const consolidating = stage === 'consolidating'
  const runningSteps = steps.filter((step) => isRunning(step.status))
  const running = consolidating || active > 0 || runningSteps.length > 0
  const failed = steps.filter((step) => step.status === 'failed').length
  const cancelled = steps.some((step) => step.status === 'cancelled')
  const header =
    stage === 'completed'
      ? ui.investigationFinished
      : running
        ? ui.investigationExploring(completed, total)
        : cancelled
          ? ui.investigationCancelled
          : ui.investigationFilesAnalyzed(total, failed)
  const showHeader = !running
  const canShowProblems = stage === 'completed' && (findings.length > 0 || problemPaths.length > 0)
  const showDetail = !canShowProblems

  useEffect(() => {
    if (canShowProblems) setShowProblems(true)
  }, [canShowProblems])

  return (
    <div className="w-full rounded-md border border-default-border bg-coal-raised p-3 text-body">
      {showHeader && (
        <button
          type="button"
          onClick={() => canShowProblems && setShowProblems((value) => !value)}
          disabled={!canShowProblems}
          aria-expanded={canShowProblems ? showProblems : undefined}
          className="flex w-full items-center gap-2 text-left text-primary-text disabled:pointer-events-none"
        >
          {running ? (
            <Loader2 size={13} className="shrink-0 animate-spin text-secondary-text" aria-hidden />
          ) : failed > 0 ? (
            <X size={13} className="shrink-0 text-danger-red" aria-hidden />
          ) : cancelled ? (
            <Square size={13} className="shrink-0 fill-current text-secondary-text" aria-hidden />
          ) : (
            <Bug size={13} className="shrink-0 text-secondary-text" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate font-medium">{header}</span>
          {canShowProblems &&
            (showProblems ? (
              <ChevronDown size={14} className="shrink-0 text-tertiary-text" />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-tertiary-text" />
            ))}
        </button>
      )}

      {showDetail && (
        <div className={`${showHeader ? 'mt-2' : ''} flex items-start gap-2 rounded-sm px-1 py-0.5`}>
          {!running && failed > 0 ? (
            <X size={13} className="mt-0.5 shrink-0 text-danger-red" aria-hidden />
          ) : !running && cancelled ? (
            <Square size={13} className="mt-0.5 shrink-0 fill-current text-secondary-text" aria-hidden />
          ) : !running ? (
            <Check size={13} className="mt-0.5 shrink-0 text-success-green" aria-hidden />
          ) : null}
          <span className="min-w-0 flex-1 text-caption text-primary-text">
            {consolidating || (running && runningSteps.length === 0) ? (
              <span className="flex min-w-0 items-center gap-2 leading-none">
                <Bot size={22} className="shrink-0 text-command-blue" aria-label={ui.investigationConsolidatingAria} />
                <span className="agent-busy-shimmer truncate leading-[22px]">{ui.investigationConsolidating}</span>
              </span>
            ) : runningSteps.length > 0 ? (
              <span className="flex flex-col gap-2">
                {running && (
                  <span className="text-tertiary-text">
                    {completed}/{total}
                    {runningSteps.length > 1 ? ui.investigationSubagents(runningSteps.length) : ''}
                  </span>
                )}
                {runningSteps.map((step) => (
                  <RunningFile key={step.path} path={step.path} />
                ))}
              </span>
            ) : cancelled ? (
              ui.investigationInterrupted
            ) : failed > 0 ? (
              ui.investigationPartialFailure
            ) : (
              <span className="text-secondary-text">{ui.emptyInvestigation}</span>
            )}
          </span>
        </div>
      )}
      {showProblems && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {findings.length > 0
            ? findings.map((finding) => (
                <li key={finding.id} className="flex min-w-0 flex-col gap-1 rounded-sm border border-default-border px-2 py-1.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <Bug size={13} className="mt-0.5 shrink-0 text-danger-red" aria-hidden />
                    <span className="min-w-0 flex-1 text-caption text-primary-text">
                      <span className="font-medium">[{finding.priority}]</span> {finding.path}
                      {finding.line != null ? `:${finding.line}` : ''} — {finding.claim}
                    </span>
                  </div>
                  {onProposeFix && (
                    <button
                      type="button"
                      onClick={() => onProposeFix(finding)}
                      disabled={Boolean(proposingId)}
                      className="btn-secondary self-start"
                    >
                      {proposingId === finding.id ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                      ) : (
                        <Wrench size={13} aria-hidden />
                      )}
                      {proposingId === finding.id ? ui.preparingFix : ui.proposeFix}
                    </button>
                  )}
                </li>
              ))
            : problemPaths.map((path) => (
                <li key={path} className="flex min-w-0 items-center gap-2 rounded-sm px-1 py-0.5 text-caption text-primary-text" title={path}>
                  <Bug size={13} className="shrink-0 text-danger-red" aria-hidden />
                  <span className="min-w-0 break-words">{path}</span>
                </li>
              ))}
        </ul>
      )}
    </div>
  )
}

export default InvestigationRunGroup
