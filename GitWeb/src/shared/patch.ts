export interface DiffHunk {
  header: string
  lines: string[]
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
}

export interface ParsedFileDiff {
  oldPath: string
  newPath: string
  preamble: string[]
  hunks: DiffHunk[]
}

export interface AnnotatedDiffLine {
  text: string
  kind: 'add' | 'remove' | 'hunk' | 'meta' | 'context'
  oldLine?: number
  newLine?: number
  hunkIndex?: number
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

export function parseHunkHeader(header: string): Pick<DiffHunk, 'oldStart' | 'oldCount' | 'newStart' | 'newCount'> | null {
  const match = header.match(HUNK_HEADER)
  if (!match) return null
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] == null ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newCount: match[4] == null ? 1 : Number(match[4])
  }
}

export function parseFileDiff(diffText: string): ParsedFileDiff | null {
  // Split on LF only. git terminates every diff line with LF, and a CR before it
  // is file content (a CRLF file committed as-is). Dropping it made every hunk
  // extracted from such a file fail `git apply` with "patch does not apply".
  const lines = diffText.endsWith('\n') ? diffText.slice(0, -1).split('\n') : diffText.split('\n')
  if (lines.length === 0 || (lines.length === 1 && !lines[0])) return null

  let oldPath = ''
  let newPath = ''
  const preamble: string[] = []
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null

  // Remaining pre-/post-image lines declared by the current hunk header. A hunk
  // body ends when both are consumed — without this, a removed line whose text
  // starts with "-- " (a SQL/Lua comment, say) reads as a "--- " file header and
  // gets stolen from the hunk, leaving a body that contradicts its own @@ counts.
  let remainingOld = 0
  let remainingNew = 0

  for (const rawLine of lines) {
    // Headers and metadata never carry content bytes, so they are compared
    // without a stray CR; hunk body lines below keep theirs.
    const line: string = rawLine.startsWith('@@') || !current ? rawLine.replace(/\r$/, '') : rawLine
    if (line.startsWith('@@')) {
      const parsed = parseHunkHeader(line)
      if (!parsed) continue
      current = { header: line, lines: [], ...parsed }
      remainingOld = parsed.oldCount
      remainingNew = parsed.newCount
      hunks.push(current)
      continue
    }
    if (current) {
      // "\ No newline at end of file" belongs to the hunk but counts for neither side.
      if (line.startsWith('\\')) {
        current.lines.push(line)
        continue
      }
      const consumesOld = line.startsWith('-') || line.startsWith(' ') || line === ''
      const consumesNew = line.startsWith('+') || line.startsWith(' ') || line === ''
      if ((consumesOld && remainingOld > 0) || (consumesNew && remainingNew > 0)) {
        current.lines.push(line)
        if (consumesOld) remainingOld--
        if (consumesNew) remainingNew--
        continue
      }
      // Counts exhausted and this line is not a "\ No newline" trailer, so the hunk
      // is over: fall through and let the line be read as the next file's header.
      current = null
    }
    if (line.startsWith('--- ')) {
      oldPath = line.slice(4).replace(/^[ab]\//, '').trim()
      preamble.push(line)
      continue
    }
    if (line.startsWith('+++ ')) {
      newPath = line.slice(4).replace(/^[ab]\//, '').trim()
      preamble.push(line)
      continue
    }
    preamble.push(line)
    const gitMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/)
    if (gitMatch) {
      oldPath = oldPath || gitMatch[1]
      newPath = newPath || gitMatch[2]
    }
  }

  if (hunks.length === 0) return null
  return { oldPath: oldPath || newPath, newPath: newPath || oldPath, preamble, hunks }
}

/** Splits a multi-file patch (git show / stash show -p) into one diff per file. */
export function splitPatchByFile(patch: string): { path: string; diff: string }[] {
  const files: { path: string; diff: string }[] = []
  const lines = patch.split('\n')
  let current: string[] | null = null
  let path = ''
  const flush = (): void => {
    if (current) files.push({ path, diff: current.join('\n') })
  }
  for (const line of lines) {
    const header = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
    if (header) {
      flush()
      current = [line]
      path = header[2]
      continue
    }
    current?.push(line)
  }
  flush()
  return files
}

export function extractHunkPatch(file: ParsedFileDiff, hunkIndex: number): string {
  const hunk = file.hunks[hunkIndex]
  if (!hunk) return ''
  const preamble = ensureDiffPreamble(file)
  return `${preamble.join('\n')}\n${hunk.header}\n${hunk.lines.join('\n')}\n`
}

function ensureDiffPreamble(file: ParsedFileDiff): string[] {
  const hasGitHeader = file.preamble.some((line) => line.startsWith('diff --git '))
  const hasMinus = file.preamble.some((line) => line.startsWith('--- '))
  const hasPlus = file.preamble.some((line) => line.startsWith('+++ '))
  if (hasGitHeader && hasMinus && hasPlus) return file.preamble.filter((line) => !line.startsWith('@@'))

  const path = file.newPath || file.oldPath
  const next = [...file.preamble.filter((line) => !line.startsWith('@@'))]
  if (!hasGitHeader) next.unshift(`diff --git a/${path} b/${path}`)
  if (!hasMinus) next.push(`--- a/${file.oldPath || path}`)
  if (!hasPlus) next.push(`+++ b/${file.newPath || path}`)
  return next
}

export function annotateDiff(diffText: string): AnnotatedDiffLine[] {
  const parsed = parseFileDiff(diffText)
  if (!parsed) {
    return diffText.split('\n').map((text) => ({
      text,
      kind: classifyLoose(text)
    }))
  }

  const rows: AnnotatedDiffLine[] = parsed.preamble.map((text) => ({ text, kind: 'meta' as const }))
  parsed.hunks.forEach((hunk, hunkIndex) => {
    rows.push({ text: hunk.header, kind: 'hunk', hunkIndex })
    let oldLine = hunk.oldStart
    let newLine = hunk.newStart
    for (const line of hunk.lines) {
      if (line.startsWith('\\')) {
        // "\ No newline at end of file" — a marker, not a line of either image.
        rows.push({ text: line, kind: 'meta', hunkIndex })
      } else if (line.startsWith('+')) {
        rows.push({ text: line, kind: 'add', newLine, hunkIndex })
        newLine++
      } else if (line.startsWith('-')) {
        rows.push({ text: line, kind: 'remove', oldLine, hunkIndex })
        oldLine++
      } else {
        rows.push({ text: line, kind: 'context', oldLine, newLine, hunkIndex })
        oldLine++
        newLine++
      }
    }
  })
  // Display only: the CR of a CRLF file is kept by the parser for patching.
  for (const row of rows) row.text = row.text.replace(/\r$/, '')
  return rows
}

function classifyLoose(line: string): AnnotatedDiffLine['kind'] {
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) return 'meta'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'remove'
  return 'context'
}

type LineEdit = { kind: 'eq' | 'del' | 'add'; text: string }

export function unifiedPreview(path: string, before: string, after: string): string {
  if (before === after) return `--- a/${path}\n+++ b/${path}\n@@ arquivo inalterado @@\n`
  const oldLines = before.split('\n')
  const newLines = after.split('\n')
  const edits = diffLines(oldLines, newLines)
  return formatUnified(path, edits)
}

function diffLines(a: string[], b: string[]): LineEdit[] {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const prefix = a.slice(0, start).map((text) => ({ kind: 'eq' as const, text }))
  const suffix = a.slice(endA).map((text) => ({ kind: 'eq' as const, text }))
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)

  if (midA.length === 0) return [...prefix, ...midB.map((text) => ({ kind: 'add' as const, text })), ...suffix]
  if (midB.length === 0) return [...prefix, ...midA.map((text) => ({ kind: 'del' as const, text })), ...suffix]
  if (midA.length * midB.length > 250_000) {
    return [
      ...prefix,
      ...midA.map((text) => ({ kind: 'del' as const, text })),
      ...midB.map((text) => ({ kind: 'add' as const, text })),
      ...suffix
    ]
  }

  return [...prefix, ...myersDiff(midA, midB), ...suffix]
}

function myersDiff(a: string[], b: string[]): LineEdit[] {
  const n = a.length
  const m = b.length
  const max = n + m
  const offset = max
  const v = new Int32Array(2 * max + 1)
  const trace: Int32Array[] = []
  v[offset + 1] = 0

  for (let d = 0; d <= max; d++) {
    trace.push(Int32Array.from(v))
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
          ? v[offset + k + 1]
          : v[offset + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) return backtrackMyers(trace, a, b, d)
    }
  }
  return [...a.map((text) => ({ kind: 'del' as const, text })), ...b.map((text) => ({ kind: 'add' as const, text }))]
}

function backtrackMyers(trace: Int32Array[], a: string[], b: string[], dHit: number): LineEdit[] {
  const edits: LineEdit[] = []
  let x = a.length
  let y = b.length
  const offset = a.length + b.length

  for (let d = dHit; d > 0; d--) {
    const v = trace[d]
    const k = x - y
    const prevK = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? k + 1 : k - 1
    const prevX = v[offset + prevK]
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      edits.push({ kind: 'eq', text: a[x - 1] })
      x--
      y--
    }
    if (x === prevX) {
      edits.push({ kind: 'add', text: b[y - 1] })
      y--
    } else {
      edits.push({ kind: 'del', text: a[x - 1] })
      x--
    }
  }
  while (x > 0 && y > 0) {
    edits.push({ kind: 'eq', text: a[x - 1] })
    x--
    y--
  }
  while (x > 0) {
    edits.push({ kind: 'del', text: a[x - 1] })
    x--
  }
  while (y > 0) {
    edits.push({ kind: 'add', text: b[y - 1] })
    y--
  }
  return edits.reverse()
}

function formatUnified(path: string, edits: LineEdit[]): string {
  const hunks: string[] = [`--- a/${path}`, `+++ b/${path}`]
  const context = 3
  let oldLine = 1
  let newLine = 1
  let i = 0

  while (i < edits.length) {
    while (i < edits.length && edits[i].kind === 'eq') {
      oldLine++
      newLine++
      i++
    }
    if (i >= edits.length) break

    let start = i
    let scan = i
    let eqRun = 0
    while (scan < edits.length) {
      if (edits[scan].kind === 'eq') {
        eqRun++
        if (eqRun > context * 2) break
      } else {
        eqRun = 0
      }
      scan++
    }
    const end = eqRun > context * 2 ? scan - eqRun + context + 1 : edits.length
    start = Math.max(0, start - context)

    let oldCount = 0
    let newCount = 0
    for (let j = start; j < end; j++) {
      if (edits[j].kind !== 'add') oldCount++
      if (edits[j].kind !== 'del') newCount++
    }
    const hunkOld = oldLine - (i - start)
    const hunkNew = newLine - (i - start)
    const body = [`@@ -${hunkOld}${oldCount === 1 ? '' : `,${oldCount}`} +${hunkNew}${newCount === 1 ? '' : `,${newCount}`} @@`]
    for (let j = start; j < end; j++) {
      const edit = edits[j]
      body.push(edit.kind === 'eq' ? ` ${edit.text}` : edit.kind === 'del' ? `-${edit.text}` : `+${edit.text}`)
    }
    hunks.push(body.join('\n'))
    for (let j = i; j < end; j++) {
      if (edits[j].kind !== 'add') oldLine++
      if (edits[j].kind !== 'del') newLine++
    }
    i = end
  }

  return hunks.join('\n')
}
