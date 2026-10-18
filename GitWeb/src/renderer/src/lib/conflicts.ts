import { getT } from './i18n'

export interface ConflictBlock {
  type: 'conflict'
  id: number
  oursLabel: string
  theirsLabel: string
  ours: string[]
  theirs: string[]
}

export interface TextBlock {
  type: 'text'
  lines: string[]
}

export type FileBlock = ConflictBlock | TextBlock

// Trailing \r? tolerates CRLF files (the default on Windows with
// core.autocrlf=true) — content.split('\n') leaves a stray \r at the end of
// each line, which without this would silently fail to match "=======\r",
// breaking conflict-block detection entirely on any CRLF repo. Line content
// itself (ours/theirs/text) is still stored and reconstructed byte-for-byte
// as split, so this only changes marker *recognition*, not output fidelity.
const CONFLICT_START = /^<{7}\s?(.*?)\r?$/
const CONFLICT_MID = /^={7}\r?$/
const CONFLICT_END = /^>{7}\s?(.*?)\r?$/

export function parseConflictBlocks(content: string): FileBlock[] {
  const lines = content.split('\n')
  const blocks: FileBlock[] = []
  let textBuffer: string[] = []
  let conflictId = 0
  let i = 0

  const flushText = (): void => {
    if (textBuffer.length > 0) {
      blocks.push({ type: 'text', lines: textBuffer })
      textBuffer = []
    }
  }

  while (i < lines.length) {
    const startMatch = lines[i].match(CONFLICT_START)
    if (!startMatch) {
      textBuffer.push(lines[i])
      i++
      continue
    }

    flushText()
    const oursLabel = startMatch[1] || 'ours'
    const ours: string[] = []
    i++
    while (i < lines.length && !CONFLICT_MID.test(lines[i])) {
      ours.push(lines[i])
      i++
    }
    i++ // skip =======

    const theirs: string[] = []
    while (i < lines.length && !CONFLICT_END.test(lines[i])) {
      theirs.push(lines[i])
      i++
    }
    const endMatch = lines[i]?.match(CONFLICT_END)
    const theirsLabel = endMatch?.[1] || 'theirs'
    i++ // skip >>>>>>> line

    blocks.push({ type: 'conflict', id: conflictId++, oursLabel, theirsLabel, ours, theirs })
  }

  flushText()
  return blocks
}

export function hasConflictMarkers(content: string): boolean {
  return content.split('\n').some((line) => CONFLICT_START.test(line))
}

export type Resolution = 'ours' | 'theirs' | 'both'

export function renderResolved(blocks: FileBlock[], resolutions: Map<number, Resolution>): string {
  const outputLines: string[] = []

  for (const block of blocks) {
    if (block.type === 'text') {
      outputLines.push(...block.lines)
      continue
    }
    const resolution = resolutions.get(block.id)
    if (resolution === 'ours') outputLines.push(...block.ours)
    else if (resolution === 'theirs') outputLines.push(...block.theirs)
    else if (resolution === 'both') outputLines.push(...block.ours, ...block.theirs)
  }

  return outputLines.join('\n')
}

// AI-assisted resolution path (resolve_conflict chat tool) — additive to the
// manual 3-choice Resolution/renderResolved above, which stay untouched.
// A plain object {text} carries AI-authored merged content for a block
// instead of just picking a side.
export type ConflictResolutionChoice = 'ours' | 'theirs' | 'both' | { text: string[] }

// Unlike renderResolved, a missing choice here throws instead of silently
// dropping the block: by the time this runs, the AI's response has already
// been validated as covering every block, so a missing id means a bug, not
// a legitimate in-progress state.
export function renderResolvedWithChoices(blocks: FileBlock[], choices: Map<number, ConflictResolutionChoice>): string {
  const outputLines: string[] = []

  for (const block of blocks) {
    if (block.type === 'text') {
      outputLines.push(...block.lines)
      continue
    }
    const choice = choices.get(block.id)
    if (choice === undefined) throw new Error(getT().stores.conflictBlockUnresolved(block.id))
    if (choice === 'ours') outputLines.push(...block.ours)
    else if (choice === 'theirs') outputLines.push(...block.theirs)
    else if (choice === 'both') outputLines.push(...block.ours, ...block.theirs)
    else outputLines.push(...choice.text)
  }

  return outputLines.join('\n')
}
