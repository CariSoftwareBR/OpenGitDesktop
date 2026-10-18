import type { AiSettings, ResolvedAiConfig } from '../../../../shared/ai'
import {
  emptyInvestigationMarkdown,
  investigationConsolidationFallback,
  investigationFinalPrompt,
  investigationVerifyPrompt,
  investigationWorkerPrompt,
  isEmptyInvestigationMarkdown
} from '../../../../shared/aiPrompts'
import type { CommitFile } from '../../../../shared/git'
import { sendChatRequest, type ChatMessage } from './providers'

export { isEmptyInvestigationMarkdown }

export interface InvestigationProgress {
  completed: number
  total: number
  active: number
  stage: 'exploring' | 'consolidating' | 'completed'
  path?: string
  steps: InvestigationStep[]
  problemPaths: string[]
  findings: InvestigationFinding[]
}

export type InvestigationStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface InvestigationStep {
  path: string
  status: InvestigationStepStatus
}

export interface InvestigationFinding {
  id: string
  path: string
  priority: 'P1' | 'P2' | 'P3'
  line?: number
  claim: string
  description: string
  example?: string
  fix: string
}

interface WorkerFinding {
  priority: 'P1' | 'P2' | 'P3'
  line?: number
  claim: string
  description: string
  example?: string
  fix: string
  /** Diff lote that produced this finding. Stripped before the consolidator. */
  chunk?: string
}

interface FileReport {
  path: string
  coverage: 'complete' | 'partial' | 'failed' | 'skipped'
  findings: WorkerFinding[]
  error?: string
}

export interface CommitInvestigationInput {
  repoPath: string
  commit: { hash: string; shortHash: string; summary: string }
  settings: AiSettings
  apiKey: string
  config: ResolvedAiConfig
  isCancelled: () => boolean
  onProgress: (progress: InvestigationProgress) => void
  registerRequest: (requestId: string) => void
  unregisterRequest: (requestId: string) => void
}

function estimateTokens(text: string): number {
  // Source code and diff punctuation tokenise more densely than prose. Three
  // characters per token leaves a conservative margin across providers.
  return Math.ceil(text.length / 3)
}

function inputBudget(contextTokens: number): number {
  return Math.max(4_000, Math.floor(contextTokens * 0.6))
}

function fitToBudget(text: string, budget: number): string {
  if (estimateTokens(text) <= budget) return text
  return splitLongText(text, budget)[0] ?? text
}

function fileBasename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

function fileStem(path: string): string {
  return fileBasename(path).replace(/\.[^.]+$/, '')
}

function hunkDigest(patch: string, limit = 8): string {
  const headers = [...patch.matchAll(/^@@.+$/gm)].map((match) => match[0].trim())
  if (headers.length === 0) return ''
  const shown = headers.slice(0, limit)
  return shown.join('\n') + (headers.length > limit ? `\n… +${headers.length - limit} hunks` : '')
}

function buildCommitBrief(
  language: AiSettings['language'],
  commit: { hash: string; summary: string; body: string },
  files: CommitFile[],
  patches: Map<string, string>,
  tokenLimit: number
): string {
  const subjectLabel = language === 'pt-BR' ? 'Assunto' : 'Subject'
  const messageLabel = language === 'pt-BR' ? 'Mensagem' : 'Message'
  const filesLabel = language === 'pt-BR' ? 'Arquivos deste commit:' : 'Files in this commit:'
  const moreFilesLabel = language === 'pt-BR' ? 'arquivo(s)' : 'more file(s)'

  let brief = [
    `Commit ${commit.hash}`,
    `${subjectLabel}: ${commit.summary}`,
    commit.body.trim() ? `${messageLabel}:\n${commit.body.trim()}` : '',
    filesLabel
  ]
    .filter(Boolean)
    .join('\n')

  let included = 0
  for (const file of files) {
    const digest = hunkDigest(patches.get(file.path) ?? '')
    const entry = `${file.status} ${file.path}${digest ? `\n${digest}` : ''}`
    const next = `${brief}\n${entry}`
    if (estimateTokens(next) > tokenLimit) {
      brief += `\n… ${language === 'pt-BR' ? 'e mais' : 'and'} ${files.length - included} ${moreFilesLabel}`
      break
    }
    brief = next
    included++
  }
  return brief
}

function relatedCommitPaths(findingPath: string, finding: WorkerFinding, files: CommitFile[]): string[] {
  const haystack = [finding.claim, finding.description, finding.example, finding.fix, findingPath]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return files
    .map((file) => file.path)
    .filter((path) => {
      if (path === findingPath) return false
      const stem = fileStem(path).toLowerCase()
      const base = fileBasename(path).toLowerCase()
      return stem.length >= 3 && (haystack.includes(stem) || haystack.includes(base))
    })
}

function packVerifyUserMessage(
  input: CommitInvestigationInput,
  brief: string,
  path: string,
  finding: WorkerFinding,
  ownPatch: string,
  related: { path: string; patch: string }[]
): string {
  const verifyPrompt = investigationVerifyPrompt(input.settings.language)
  const findingFileLabel = input.settings.language === 'pt-BR' ? 'Arquivo do achado' : 'Finding file'
  const findingLabel = input.settings.language === 'pt-BR' ? 'Achado' : 'Finding'
  const header = `${brief}\n\n${findingFileLabel}: ${path}\n${findingLabel}:\n${JSON.stringify(toPublicFinding(finding))}\n`
  const budget = inputBudget(input.settings.investigationContextTokens)
  let used = estimateTokens(verifyPrompt + header)
  const sections: string[] = []

  const append = (label: string, patch: string): boolean => {
    if (!patch.trim()) return true
    const wrapper = estimateTokens(`\n${label}\n\`\`\`diff\n\n\`\`\``)
    const remaining = budget - used - wrapper
    if (remaining < 400) return false
    const body = fitToBudget(patch, remaining)
    const block = `\n${label}\n\`\`\`diff\n${body}\n\`\`\``
    used += estimateTokens(block)
    sections.push(block)
    return estimateTokens(body) >= estimateTokens(patch)
  }

  append(
    input.settings.language === 'pt-BR' ? `Diff de ${path}:` : `Diff for ${path}:`,
    ownPatch || finding.chunk || ''
  )
  for (const file of related) {
    if (
      !append(
        input.settings.language === 'pt-BR' ? `Diff relacionado (${file.path}):` : `Related diff (${file.path}):`,
        file.patch
      )
    ) {
      break
    }
  }
  return header + sections.join('')
}

function chunkDiff(patch: string, contextTokens: number, overheadTokens = 0): string[] {
  const budget = Math.max(2_000, inputBudget(contextTokens) - overheadTokens)
  if (estimateTokens(patch) <= budget) return [patch]

  const firstHunk = patch.search(/^@@ /m)
  if (firstHunk < 0) return splitLongText(patch, budget)
  const header = patch.slice(0, firstHunk)
  const hunks = patch.slice(firstHunk).split(/(?=^@@ )/m).filter(Boolean)
  const chunks: string[] = []
  let current = header

  for (const hunk of hunks) {
    if (estimateTokens(header + hunk) > budget) {
      if (current !== header) chunks.push(current)
      chunks.push(...splitLongHunk(header, hunk, budget))
      current = header
      continue
    }
    if (estimateTokens(current + hunk) > budget && current !== header) {
      chunks.push(current)
      current = header
    }
    current += hunk
  }
  if (current !== header) chunks.push(current)
  return chunks.length > 0 ? chunks : [patch]
}

function splitLongHunk(header: string, hunk: string, budget: number): string[] {
  const lineBreak = hunk.indexOf('\n')
  if (lineBreak < 0) return splitLongText(header + hunk, budget)
  const hunkHeader = hunk.slice(0, lineBreak + 1)
  return splitLongText(hunk.slice(lineBreak + 1), budget - estimateTokens(header + hunkHeader)).map(
    (part) => header + hunkHeader + part
  )
}

function splitLongText(text: string, budget: number): string[] {
  const charBudget = Math.max(1_000, budget * 3)
  const lines = text.split(/(?<=\n)/)
  const parts: string[] = []
  let current = ''
  for (const line of lines) {
    if (current.length + line.length > charBudget && current) {
      parts.push(current)
      current = ''
    }
    if (line.length > charBudget) {
      if (current) parts.push(current)
      for (let index = 0; index < line.length; index += charBudget) parts.push(line.slice(index, index + charBudget))
    } else {
      current += line
    }
  }
  if (current) parts.push(current)
  return parts
}

function extractJsonObject(content: string): string {
  const candidate = content.trim().replace(/^```json\s*|```$/gim, '')
  return candidate.match(/\{[\s\S]*\}/)?.[0] ?? candidate
}

function hasReproExample(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const example = value.trim()
  return example.length > 0 && (example.includes('→') || example.includes('->'))
}

function toPublicFinding(finding: WorkerFinding): Omit<WorkerFinding, 'chunk'> {
  return {
    priority: finding.priority,
    line: finding.line,
    claim: finding.claim,
    description: finding.description,
    example: finding.example,
    fix: finding.fix
  }
}

function findingKey(path: string, finding: WorkerFinding): string {
  return `${path}\0${finding.line ?? ''}\0${finding.claim.trim().toLowerCase()}`
}

function parseFindings(content: string): WorkerFinding[] {
  try {
    const parsed = JSON.parse(extractJsonObject(content)) as { findings?: unknown }
    if (!Array.isArray(parsed.findings)) return []
    return parsed.findings.flatMap((item): WorkerFinding[] => {
      if (!item || typeof item !== 'object') return []
      const value = item as Record<string, unknown>
      if (
        !['P1', 'P2', 'P3'].includes(String(value.priority)) ||
        typeof value.claim !== 'string' ||
        typeof value.description !== 'string' ||
        typeof value.fix !== 'string' ||
        !hasReproExample(value.example)
      ) {
        return []
      }
      const line = typeof value.line === 'number' && Number.isFinite(value.line) ? Math.round(value.line) : undefined
      return [{
        priority: value.priority as WorkerFinding['priority'],
        line,
        claim: value.claim.trim(),
        description: value.description.trim(),
        example: value.example.trim(),
        fix: value.fix.trim()
      }]
    })
  } catch {
    // A malformed worker answer must not turn into a fabricated finding.
    return []
  }
}

function parseVerdict(content: string): 'confirm' | 'reject' {
  try {
    const parsed = JSON.parse(extractJsonObject(content)) as { verdict?: unknown }
    return parsed.verdict === 'confirm' ? 'confirm' : 'reject'
  } catch {
    return 'reject'
  }
}

function workerMessages(
  language: AiSettings['language'],
  brief: string,
  path: string,
  chunk: string,
  part: number,
  parts: number
): ChatMessage[] {
  const fileLabel = language === 'pt-BR' ? 'Arquivo' : 'File'
  const batchLabel = language === 'pt-BR' ? 'Lote' : 'Batch'
  return [
    { role: 'system', content: investigationWorkerPrompt(language) },
    {
      role: 'user',
      content: `${brief}\n\n${fileLabel}: ${path}\n${batchLabel} ${part}/${parts}\n\n\`\`\`diff\n${chunk}\n\`\`\``
    }
  ]
}

function verifyMessages(
  input: CommitInvestigationInput,
  brief: string,
  path: string,
  finding: WorkerFinding,
  ownPatch: string,
  related: { path: string; patch: string }[]
): ChatMessage[] {
  return [
    { role: 'system', content: investigationVerifyPrompt(input.settings.language) },
    { role: 'user', content: packVerifyUserMessage(input, brief, path, finding, ownPatch, related) }
  ]
}

function finalMessages(input: CommitInvestigationInput, reports: FileReport[]): ChatMessage[] {
  // Do not send a long list of clean files to the final model. This is what
  // keeps the main context small even when the commit touched hundreds of files.
  const compactReports = reports
    .filter((report) => report.findings.length > 0 || (report.coverage !== 'complete' && report.coverage !== 'skipped'))
    .map(({ path, coverage, findings, error }) => ({
      path,
      coverage,
      findings: findings.map(toPublicFinding),
      error
    }))
  return [
    { role: 'system', content: investigationFinalPrompt(input.settings.language) },
    {
      role: 'user',
      content: `Commit ${input.commit.hash} ("${input.commit.summary}"). Resultados dos subagentes:\n${JSON.stringify(compactReports)}`
    }
  ]
}

function investigationConfig(config: ResolvedAiConfig): ResolvedAiConfig {
  // Sampling now comes from the AI settings profile (resolveActiveConfig picks the
  // thinking / non-thinking set from the reasoning effort), like every other call.
  return config
}

function sortFindings(findings: WorkerFinding[]): WorkerFinding[] {
  return [...findings].sort((left, right) => (left.line ?? 1_000_000_000) - (right.line ?? 1_000_000_000) || left.claim.localeCompare(right.claim))
}

function sortReports(reports: FileReport[]): void {
  reports.sort((left, right) => left.path.localeCompare(right.path))
  for (const report of reports) report.findings = sortFindings(report.findings)
}

export async function investigateCommitWithWorkers(input: CommitInvestigationInput): Promise<string | null> {
  const files = await window.api.git.commitFiles(input.commit.hash, input.repoPath)
  const details = await window.api.git.commitDetails(input.repoPath, input.commit.hash).catch(() => null)
  const config = investigationConfig(input.config)
  const patches = new Map<string, string>()
  for (const file of files) {
    if (input.isCancelled()) return null
    patches.set(file.path, await window.api.git.commitDiff(input.commit.hash, file.path, input.repoPath))
  }
  const briefLimit = Math.min(3_000, Math.floor(inputBudget(input.settings.investigationContextTokens) * 0.25))
  const brief = buildCommitBrief(
    input.settings.language,
    { hash: input.commit.hash, summary: input.commit.summary, body: details?.body ?? '' },
    files,
    patches,
    briefLimit
  )
  const reports: FileReport[] = []
  const statuses = new Map<string, InvestigationStepStatus>(files.map((file) => [file.path, 'pending']))
  let nextFile = 0
  let completed = 0
  let active = 0
  let stage: InvestigationProgress['stage'] = 'exploring'
  const findingsForUi = (): InvestigationFinding[] =>
    reports.flatMap((report) =>
      report.findings.map((finding, index) => ({
        id: `${report.path}:${finding.line ?? 'n'}:${index}:${finding.claim}`,
        path: report.path,
        priority: finding.priority,
        line: finding.line,
        claim: finding.claim,
        description: finding.description,
        example: finding.example,
        fix: finding.fix
      }))
    )

  const reportProgress = (path?: string): void =>
    input.onProgress({
      completed,
      total: files.length,
      active,
      stage,
      path,
      steps: files.map((file) => ({ path: file.path, status: statuses.get(file.path) ?? 'pending' })),
      problemPaths: reports.filter((report) => report.findings.length > 0).map((report) => report.path),
      findings: findingsForUi()
    })
  reportProgress()

  async function inspectFile(file: CommitFile): Promise<FileReport> {
    const patch = patches.get(file.path) ?? ''
    if (!patch.trim()) return { path: file.path, coverage: 'skipped', findings: [] }
    const workerPrompt = investigationWorkerPrompt(input.settings.language)
    const overhead = estimateTokens(workerPrompt + brief)
    const chunks = chunkDiff(patch, input.settings.investigationContextTokens, overhead)
    const findings: WorkerFinding[] = []
    let coverage: FileReport['coverage'] = 'complete'

    for (let index = 0; index < chunks.length; index++) {
      if (input.isCancelled()) return { path: file.path, coverage: 'partial', findings }
      const requestId = `investigate-${Date.now()}-${Math.random().toString(36).slice(2)}`
      input.registerRequest(requestId)
      try {
        const response = await sendChatRequest(
          config,
          input.apiKey,
          workerMessages(input.settings.language, brief, file.path, chunks[index], index + 1, chunks.length),
          [],
          requestId
        )
        const chunk = chunks[index]
        findings.push(...parseFindings(response.content).map((finding) => ({ ...finding, chunk })))
      } catch (error) {
        if (input.isCancelled()) return { path: file.path, coverage: 'partial', findings }
        coverage = 'partial'
      } finally {
        input.unregisterRequest(requestId)
      }
    }
    return { path: file.path, coverage, findings }
  }

  async function worker(): Promise<void> {
    while (!input.isCancelled()) {
      const file = files[nextFile++]
      if (!file) return
      active++
      statuses.set(file.path, 'running')
      reportProgress(file.path)
      try {
        const report = await inspectFile(file)
        reports.push(report)
        statuses.set(file.path, report.coverage === 'failed' ? 'failed' : 'completed')
      } catch (error) {
        reports.push({ path: file.path, coverage: 'failed', findings: [], error: error instanceof Error ? error.message : String(error) })
        statuses.set(file.path, 'failed')
      } finally {
        active--
        completed++
        reportProgress(file.path)
      }
    }
  }

  async function confirmFinding(path: string, finding: WorkerFinding): Promise<boolean> {
    const ownPatch = patches.get(path) || finding.chunk || ''
    if (!ownPatch.trim()) return false
    const related = relatedCommitPaths(path, finding, files)
      .map((relatedPath) => ({ path: relatedPath, patch: patches.get(relatedPath) ?? '' }))
      .filter((file) => file.patch.trim())
    const requestId = `investigate-verify-${Date.now()}-${Math.random().toString(36).slice(2)}`
    input.registerRequest(requestId)
    try {
      const response = await sendChatRequest(
        config,
        input.apiKey,
        verifyMessages(input, brief, path, finding, ownPatch, related),
        [],
        requestId
      )
      return parseVerdict(response.content) === 'confirm'
    } catch {
      return false
    } finally {
      input.unregisterRequest(requestId)
    }
  }

  async function verifyReports(concurrency: number): Promise<void> {
    type Job = { path: string; finding: WorkerFinding }
    const seen = new Set<string>()
    const jobs: Job[] = []
    for (const report of reports) {
      const unique: WorkerFinding[] = []
      for (const finding of report.findings) {
        const key = findingKey(report.path, finding)
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(finding)
        jobs.push({ path: report.path, finding })
      }
      report.findings = unique
    }
    jobs.sort((left, right) => left.path.localeCompare(right.path) || findingKey(left.path, left.finding).localeCompare(findingKey(right.path, right.finding)))
    if (jobs.length === 0) return

    const confirmed = new Set<WorkerFinding>()
    let nextJob = 0
    async function verifier(): Promise<void> {
      while (!input.isCancelled()) {
        const job = jobs[nextJob++]
        if (!job) return
        reportProgress(job.path)
        try {
          if (await confirmFinding(job.path, job.finding)) confirmed.add(job.finding)
        } finally {
          reportProgress(job.path)
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => verifier()))
    for (const report of reports) {
      report.findings = report.findings.filter((finding) => confirmed.has(finding)).map(toPublicFinding)
    }
    reportProgress()
  }

  // "Não usar" keeps a single sequential worker, without parallel subagents.
  const requestedWorkers = Math.max(1, input.settings.investigationConcurrency)
  const workerCount = Math.min(requestedWorkers, Math.max(1, files.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  if (input.isCancelled()) return null
  sortReports(reports)

  stage = 'consolidating'
  reportProgress()
  await verifyReports(requestedWorkers)
  if (input.isCancelled()) return null
  sortReports(reports)

  const hasIncompleteCoverage = reports.some((report) => report.coverage === 'partial' || report.coverage === 'failed')
  const hasFindings = reports.some((report) => report.findings.length > 0)
  if (!hasFindings && !hasIncompleteCoverage) {
    stage = 'completed'
    reportProgress()
    return emptyInvestigationMarkdown(input.settings.language)
  }

  const requestId = `investigate-summary-${Date.now()}-${Math.random().toString(36).slice(2)}`
  input.registerRequest(requestId)
  try {
    const response = await sendChatRequest(config, input.apiKey, finalMessages(input, reports), [], requestId)
    stage = 'completed'
    reportProgress()
    return response.content.trim() || investigationConsolidationFallback(input.settings.language)
  } finally {
    input.unregisterRequest(requestId)
  }
}
