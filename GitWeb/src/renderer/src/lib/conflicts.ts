import { getT } from './i18n'

export interface ConflictBlock {
  type: 'conflict'
  id: number
  oursLabel: string
  theirsLabel: string
  ours: string[]
  theirs: string[]
  /**
   * The merge-base lines — the code before either side changed it. Present when
   * the file was written in diff3 style or attachBaseLines found the block.
   */
  base?: string[]
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
const CONFLICT_BASE = /^\|{7}(?:\s.*?)?\r?$/
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
    while (i < lines.length && !CONFLICT_MID.test(lines[i]) && !CONFLICT_BASE.test(lines[i])) {
      ours.push(lines[i])
      i++
    }

    // diff3 / zdiff3 style: a ||||||| section with the merge base sits between
    // ours and =======. Without this it was read as part of ours.
    let base: string[] | undefined
    if (i < lines.length && CONFLICT_BASE.test(lines[i])) {
      base = []
      i++
      while (i < lines.length && !CONFLICT_MID.test(lines[i])) {
        base.push(lines[i])
        i++
      }
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

    blocks.push({ type: 'conflict', id: conflictId++, oursLabel, theirsLabel, ours, theirs, ...(base ? { base } : {}) })
  }

  flushText()
  return blocks
}

const withoutCr = (lines: string[]): string => lines.map((line) => line.replace(/\r$/, '')).join('\n')

/**
 * Copies each block's merge-base lines from a diff3 rendering of the same
 * conflict (see getConflictDiff3) onto the blocks read from the working file.
 * Blocks are matched by their ours/theirs content, line endings aside, so a
 * block the user already edited, or one the two merges cut differently, just
 * stays without a base.
 */
export function attachBaseLines(blocks: FileBlock[], diff3Content: string): FileBlock[] {
  const withBase = parseConflictBlocks(diff3Content).filter(
    (b): b is ConflictBlock => b.type === 'conflict' && b.base !== undefined
  )
  return blocks.map((block) => {
    if (block.type !== 'conflict' || block.base) return block
    const match = withBase.find(
      (b) => withoutCr(b.ours) === withoutCr(block.ours) && withoutCr(b.theirs) === withoutCr(block.theirs)
    )
    return match ? { ...block, base: match.base } : block
  })
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

// "key: value", "key = value", '"key": value', "KEY=value", "const key = ..."
// — the shapes config files and object literals share. `=>`, `==` and `::`
// are not assignments.
const KEY_LINE = /^\s*(?:export\s+)?(?:(?:const|let|var)\s+)?["'`]?([A-Za-z_$][\w$.-]*)["'`]?\s*[:=](?![=>:])/
// Labels and keywords that legitimately repeat at one indentation (Python
// `else:`, `case:` in a switch).
const NOT_KEYS = new Set(['else', 'elif', 'try', 'except', 'finally', 'do', 'default', 'case', 'then', 'http', 'https'])
// A bracket or a YAML list item starts a new object, where the same key is
// expected again: `{ name }, { name }` and `- name: a / - name: b` are fine.
const SCOPE_BREAK = /[{}[\]]|^\s*- /

/**
 * Keys written twice in the same object — same indentation, no bracket or list
 * item between them. Language-agnostic on purpose: it reads lines, not syntax,
 * so it only catches the pattern a blind merge leaves behind.
 */
export function findDuplicateKeys(lines: string[]): string[] {
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  let scope = 0
  for (const line of lines) {
    if (SCOPE_BREAK.test(line)) {
      scope++
      continue
    }
    const key = line.match(KEY_LINE)?.[1]
    if (!key || NOT_KEYS.has(key)) continue
    const indent = line.length - line.trimStart().length
    const id = `${scope}|${indent}|${key}`
    if (seen.has(id)) duplicated.add(key)
    else seen.add(id)
  }
  return [...duplicated]
}

/**
 * Keys that "keep both" would write twice: one side's line followed by the
 * other's for the same key. Duplicates already inside one side are not the
 * merge's fault and are left out.
 */
export function keysDuplicatedByBoth(block: ConflictBlock): string[] {
  const already = new Set([...findDuplicateKeys(block.ours), ...findDuplicateKeys(block.theirs)])
  return findDuplicateKeys([...block.ours, ...block.theirs]).filter((key) => !already.has(key))
}

/** Each key's line, as written (trimmed, trailing comma/semicolon and \r dropped); the first one wins. */
function keyedLines(lines: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of lines) {
    const key = line.match(KEY_LINE)?.[1]
    if (!key || NOT_KEYS.has(key) || map.has(key)) continue
    map.set(key, line.replace(/\r$/, '').trim().replace(/[,;]$/, ''))
  }
  return map
}

export interface LostChange {
  side: 'ours' | 'theirs'
  /** The side's line for each key it changed that the resolution lost. */
  lines: string[]
}

/**
 * Changes only one side made that the resolved lines throw away: a key that
 * side changed (the other kept the base value) now back to something else, or
 * a key only that side added now missing. Needs the block's merge base; keys
 * both sides changed are a real choice and are not judged.
 */
export function findLostChanges(block: ConflictBlock, resolved: string[]): LostChange[] {
  if (!block.base) return []
  const base = keyedLines(block.base)
  const result = keyedLines(resolved)
  const sides = { ours: keyedLines(block.ours), theirs: keyedLines(block.theirs) }

  const lost: LostChange[] = []
  for (const side of ['ours', 'theirs'] as const) {
    const mine = sides[side]
    const other = sides[side === 'ours' ? 'theirs' : 'ours']
    const lines: string[] = []
    for (const [key, line] of mine) {
      const changedHere = base.get(key) !== line
      const otherKeptBase = other.get(key) === base.get(key)
      if (changedHere && otherKeptBase && result.get(key) !== line) lines.push(line)
    }
    if (lines.length > 0) lost.push({ side, lines })
  }
  return lost
}

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
    else {
      // Model-written lines come without \r; in a CRLF file they would leave
      // the resolved block with mixed line endings.
      const crlf = [...block.ours, ...block.theirs].some((line) => line.endsWith('\r'))
      outputLines.push(...choice.text.map((line) => (crlf && !line.endsWith('\r') ? `${line}\r` : line)))
    }
  }

  return outputLines.join('\n')
}
