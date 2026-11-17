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
// git always labels the base marker ("||||||| base", "||||||| 1a2b3c4"); a
// bare run of 7 pipes is content (a Markdown table row), not a marker.
const CONFLICT_BASE = /^\|{7} \S.*?\r?$/
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
  // In order, each diff3 block used once: two blocks with the same sides but
  // different bases must not both get the first one's base.
  let next = 0
  return blocks.map((block) => {
    if (block.type !== 'conflict' || block.base) return block
    const index = withBase.findIndex(
      (b, i) => i >= next && withoutCr(b.ours) === withoutCr(block.ours) && withoutCr(b.theirs) === withoutCr(block.theirs)
    )
    if (index < 0) return block
    next = index + 1
    return { ...block, base: withBase[index].base }
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

/**
 * The key syntax of a file the key checks below understand, by extension; null
 * for everything else. Code (Python, shell, Go, JSX…) is left out on purpose:
 * reassignments, keyword arguments and repeated fields are normal there, and a
 * line-based check would flag correct merges.
 */
export type KeyStyle = 'json' | 'yaml' | 'js' | 'env'

export function keyStyleFor(path: string): KeyStyle | null {
  const name = path.split(/[\\/]/).pop()?.toLowerCase() ?? ''
  if (name.endsWith('.json')) return 'json'
  if (/\.ya?ml$/.test(name)) return 'yaml'
  if (/\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/.test(name)) return 'js'
  if (/^\.env(?:\..+)?$|\.env$|\.ini$|\.properties$/.test(name)) return 'env'
  return null
}

// One key per line, in each style. `:` must not be followed by `/` (URLs) or
// another `:`; `=` not by `=` or `>`.
const KEY_PATTERNS: Record<KeyStyle, RegExp> = {
  json: /^\s*"([^"]+)"\s*:/,
  yaml: /^\s*(?:-\s+)?["']?([A-Za-z0-9_$][\w$./-]*)["']?\s*:(?:\s|$)/,
  js: /^\s*["'`]?([A-Za-z_$][\w$-]*)["'`]?\s*:(?![:/])/,
  env: /^\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*=(?![=>])/
}
// `default:` / `case x:` in a switch are labels, not keys.
const NOT_KEYS = new Set(['default', 'case'])

interface KeyedLine {
  key: string
  /** Column of the key — after a YAML "- ", so list items nest under it. */
  column: number
  /** The line as compared: trimmed, without \r and a trailing comma/semicolon. */
  text: string
}

/**
 * Each line's key, or null. Comment lines have none. The key's scope comes
 * from indentation: see scopedKeys.
 */
function readKey(line: string, style: KeyStyle): KeyedLine | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith(';')) return null
  const key = line.match(KEY_PATTERNS[style])?.[1]
  if (!key || NOT_KEYS.has(key)) return null
  const column = line.length - line.replace(/^\s*(?:-\s+)?/, '').length
  return { key, column, text: line.replace(/\r$/, '').trim().replace(/[,;]$/, '') }
}

/**
 * Walks the lines keeping the keys of the objects still open. A line that
 * starts left of a key closes that key's object: `worker:` after
 * `web: / image:` starts a new parent, `},` and `- ` start a new object or
 * list item. So the same key under different parents is never "the same".
 */
function scopedKeys(lines: string[], style: KeyStyle, onKey: (keyed: KeyedLine, repeated: boolean) => void): void {
  const open = new Map<string, number>() // `${column}|${key}` -> column
  for (const line of lines) {
    if (!line.trim()) continue
    const start = line.length - line.trimStart().length
    // An INI-style [section] starts over even at the same indentation.
    if (style === 'env' && line.trimStart().startsWith('[')) open.clear()
    for (const [id, column] of open) if (column > start) open.delete(id)
    const keyed = readKey(line, style)
    if (!keyed) continue
    const id = `${keyed.column}|${keyed.key}`
    onKey(keyed, open.has(id))
    open.set(id, keyed.column)
  }
}

/**
 * Keys written twice in the same object — the pattern a blind "keep both"
 * leaves behind. Only for the styles keyStyleFor knows; empty otherwise.
 */
export function findDuplicateKeys(lines: string[], style: KeyStyle | null): string[] {
  if (!style) return []
  const duplicated = new Set<string>()
  scopedKeys(lines, style, (keyed, repeated) => {
    if (repeated) duplicated.add(keyed.key)
  })
  return [...duplicated]
}

/**
 * Keys that "keep both" would write twice: one side's line followed by the
 * other's for the same key. Duplicates already inside one side are not the
 * merge's fault and are left out.
 */
export function keysDuplicatedByBoth(block: ConflictBlock, style: KeyStyle | null): string[] {
  const already = new Set([...findDuplicateKeys(block.ours, style), ...findDuplicateKeys(block.theirs, style)])
  return findDuplicateKeys([...block.ours, ...block.theirs], style).filter((key) => !already.has(key))
}

/** Each key's line; a key that appears more than once is ambiguous and left out. */
function uniqueKeyedLines(lines: string[], style: KeyStyle): Map<string, string> {
  const map = new Map<string, string>()
  const repeated = new Set<string>()
  for (const line of lines) {
    const keyed = readKey(line, style)
    if (!keyed) continue
    if (map.has(keyed.key)) repeated.add(keyed.key)
    map.set(keyed.key, keyed.text)
  }
  for (const key of repeated) map.delete(key)
  return map
}

export interface LostChange {
  side: 'ours' | 'theirs'
  /** The side's line for each key whose change the resolution undid. */
  lines: string[]
}

/**
 * Changes only one side made that the resolution puts back to the original:
 * the side changed a key, the other side kept the base line, and the result
 * has the base line again. Deliberately narrow — a renamed key, a reworded
 * value or a key both sides changed is the model's call and is not judged.
 * Needs the block's merge base and a style keyStyleFor knows.
 */
export function findLostChanges(block: ConflictBlock, resolved: string[], style: KeyStyle | null): LostChange[] {
  if (!block.base || !style) return []
  const base = uniqueKeyedLines(block.base, style)
  const result = uniqueKeyedLines(resolved, style)
  const sides = { ours: uniqueKeyedLines(block.ours, style), theirs: uniqueKeyedLines(block.theirs, style) }

  const lost: LostChange[] = []
  for (const side of ['ours', 'theirs'] as const) {
    const mine = sides[side]
    const other = sides[side === 'ours' ? 'theirs' : 'ours']
    const lines: string[] = []
    for (const [key, line] of mine) {
      const original = base.get(key)
      if (original === undefined || original === line) continue // added here, or unchanged
      if (other.get(key) !== original) continue // the other side changed it too
      if (result.get(key) === original) lines.push(line)
    }
    if (lines.length > 0) lost.push({ side, lines })
  }
  return lost
}

// Unlike renderResolved, a missing choice here throws instead of silently
// dropping the block: by the time this runs, the AI's response has already
// been validated as covering every block, so a missing id means a bug, not
// a legitimate in-progress state.
/**
 * Whether most of the file's lines end in CRLF. Decided over the whole file:
 * a block whose sides are empty has no line of its own to go by.
 */
function usesCrlf(blocks: FileBlock[]): boolean {
  let crlf = 0
  let total = 0
  for (const block of blocks) {
    const lines = block.type === 'text' ? block.lines : [...block.ours, ...block.theirs]
    for (const line of lines) {
      total++
      if (line.endsWith('\r')) crlf++
    }
  }
  return crlf * 2 > total
}

export function renderResolvedWithChoices(blocks: FileBlock[], choices: Map<number, ConflictResolutionChoice>): string {
  const outputLines: string[] = []
  const crlf = usesCrlf(blocks)

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
      outputLines.push(...choice.text.map((line) => (crlf && !line.endsWith('\r') ? `${line}\r` : line)))
    }
  }

  return outputLines.join('\n')
}
