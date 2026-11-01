import type { BlameCommit, BlameLine, BranchOverview, ChurnPoint, CommitRef, FileHotspot, FileLineStat, RebaseAction, RebaseStep, RepoChurn } from './git'

/**
 * Parses `%D` from a log run with `--decorate=full`:
 *   "HEAD -> refs/heads/main, refs/remotes/origin/main, tag: refs/tags/v1.0"
 * Full ref names keep a branch called "origin/x" from being mistaken for a
 * remote one. Symbolic remote HEADs, the stash and notes are left out.
 */
export function parseDecorations(raw: string): CommitRef[] {
  const refs: CommitRef[] = []
  for (const part of raw.split(', ').map((p) => p.trim()).filter(Boolean)) {
    if (part === 'HEAD') {
      refs.push({ name: 'HEAD', kind: 'head' })
      continue
    }
    let name = part
    let current = false
    if (name.startsWith('HEAD -> ')) {
      name = name.slice('HEAD -> '.length)
      current = true
    }
    if (name.startsWith('tag: ')) {
      refs.push({ name: name.slice('tag: '.length).replace(/^refs\/tags\//, ''), kind: 'tag' })
    } else if (name.startsWith('refs/heads/')) {
      refs.push({ name: name.slice('refs/heads/'.length), kind: 'local', ...(current ? { current: true } : {}) })
    } else if (name.startsWith('refs/remotes/')) {
      const short = name.slice('refs/remotes/'.length)
      if (!short.endsWith('/HEAD')) refs.push({ name: short, kind: 'remote' })
    }
  }
  // Current branch first, then local, remote, tags — the order the eye scans.
  const rank: Record<CommitRef['kind'], number> = { head: 0, local: 1, remote: 2, tag: 3 }
  return refs.sort((a, b) => Number(Boolean(b.current)) - Number(Boolean(a.current)) || rank[a.kind] - rank[b.kind])
}

export const UNCOMMITTED_HASH = '0000000000000000000000000000000000000000'

/** Parses `git blame --porcelain`. Commit headers appear only on a hash's first line. */
export function parseBlamePorcelain(stdout: string): { lines: BlameLine[]; commits: Record<string, BlameCommit> } {
  const lines: BlameLine[] = []
  const commits: Record<string, BlameCommit> = {}
  const rows = stdout.split('\n')
  let current: { hash: string; line: number } | null = null

  for (const row of rows) {
    if (row.startsWith('\t')) {
      if (current) lines.push({ line: current.line, content: row.slice(1).replace(/\r$/, ''), hash: current.hash })
      current = null
      continue
    }
    const header = /^([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/.exec(row)
    if (header) {
      const hash = header[1]
      current = { hash, line: Number(header[2]) }
      if (!commits[hash]) {
        commits[hash] = {
          hash,
          shortHash: hash.slice(0, 7),
          authorName: '',
          date: '',
          summary: '',
          uncommitted: hash === UNCOMMITTED_HASH
        }
      }
      continue
    }
    if (!current) continue
    const commit = commits[current.hash]
    const space = row.indexOf(' ')
    const key = space === -1 ? row : row.slice(0, space)
    const value = space === -1 ? '' : row.slice(space + 1)
    if (key === 'author') commit.authorName = value
    else if (key === 'author-time') commit.date = new Date(Number(value) * 1000).toISOString()
    else if (key === 'summary') commit.summary = value
  }
  return { lines, commits }
}

/** Sums `--numstat` lines ("12\t3\tpath", "-\t-\tbinary"). */
export function sumNumstat(block: string): { additions: number; deletions: number; files: number } {
  let additions = 0
  let deletions = 0
  let files = 0
  for (const line of block.split('\n')) {
    const match = /^(\d+|-)\t(\d+|-)\t/.exec(line)
    if (!match) continue
    files++
    if (match[1] !== '-') additions += Number(match[1])
    if (match[2] !== '-') deletions += Number(match[2])
  }
  return { additions, deletions, files }
}

const REBASE_ACTIONS: Record<string, RebaseAction> = {
  pick: 'pick',
  p: 'pick',
  keep: 'pick',
  reword: 'reword',
  r: 'reword',
  squash: 'squash',
  s: 'squash',
  fixup: 'fixup',
  f: 'fixup',
  drop: 'drop',
  d: 'drop'
}

/**
 * Reads a plan in git's todo shape, oldest commit first, one per line:
 *   pick a1b2c3d
 *   squash d4e5f6a
 *   reword 9f8e7d6 New message
 * Lines starting with "#" and blank lines are ignored.
 */
export function parseRebasePlan(text: string): RebaseStep[] {
  const steps: RebaseStep[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^(\w+)\s+([0-9a-fA-F]{4,40})\b\s*(.*)$/.exec(line)
    if (!match) throw new Error(line)
    const action = REBASE_ACTIONS[match[1].toLowerCase()]
    if (!action) throw new Error(line)
    const rest = match[3].trim()
    steps.push({ hash: match[2].toLowerCase(), action, ...(rest && (action === 'reword' || action === 'squash') ? { message: rest } : {}) })
  }
  return steps
}

export type RebasePlanProblem =
  | { kind: 'unknown'; hash: string }
  | { kind: 'ambiguous'; hash: string }
  | { kind: 'duplicate'; hash: string }
  | { kind: 'missing'; hashes: string[] }
  | { kind: 'squashFirst' }
  | { kind: 'nothingKept' }
  | { kind: 'emptyMessage'; hash: string }

/**
 * Checks a plan against the local commits (oldest first) and expands short
 * hashes to full ones. Every local commit must appear exactly once, so an
 * omission can never silently drop work.
 */
export function validateRebasePlan(
  steps: RebaseStep[],
  localHashes: string[]
): { ok: true; steps: RebaseStep[] } | { ok: false; problem: RebasePlanProblem } {
  const resolved: RebaseStep[] = []
  const seen = new Set<string>()
  for (const step of steps) {
    const matches = localHashes.filter((h) => h.startsWith(step.hash.toLowerCase()))
    if (matches.length === 0) return { ok: false, problem: { kind: 'unknown', hash: step.hash } }
    if (matches.length > 1) return { ok: false, problem: { kind: 'ambiguous', hash: step.hash } }
    const hash = matches[0]
    if (seen.has(hash)) return { ok: false, problem: { kind: 'duplicate', hash: step.hash } }
    seen.add(hash)
    if (step.action === 'reword' && !step.message?.trim()) return { ok: false, problem: { kind: 'emptyMessage', hash: step.hash } }
    resolved.push({ ...step, hash })
  }
  const missing = localHashes.filter((h) => !seen.has(h))
  if (missing.length > 0) return { ok: false, problem: { kind: 'missing', hashes: missing } }
  const kept = resolved.filter((s) => s.action !== 'drop')
  if (kept.length === 0) return { ok: false, problem: { kind: 'nothingKept' } }
  if (kept[0].action === 'squash' || kept[0].action === 'fixup') return { ok: false, problem: { kind: 'squashFirst' } }
  return { ok: true, steps: resolved }
}

/* ── Working-tree stats, branch overview and churn ─────────────────────── */

/**
 * `git diff --numstat -z`: "adds\tdels\tpath\0", or for a rename
 * "adds\tdels\t\0old\0new\0" — the new path is the one status reports.
 */
export function parseNumstatZ(out: string): FileLineStat[] {
  const parts = out.split('\0')
  const rows: FileLineStat[] = []
  for (let i = 0; i < parts.length; i++) {
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(parts[i])
    if (!match) continue
    let path = match[3]
    if (path === '') {
      path = parts[i + 2] ?? ''
      i += 2
    }
    const binary = match[1] === '-'
    rows.push({ path, additions: binary ? 0 : Number(match[1]), deletions: binary ? 0 : Number(match[2]), binary })
  }
  return rows
}

/** `for-each-ref` rows of: name, HEAD marker, ISO date, upstream, track, subject — split by \x1f. */
export function parseBranchOverview(out: string): BranchOverview[] {
  return out
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [name = '', head = '', date = '', upstream = '', track = '', ...subject] = line.split('\x1f')
      const ahead = /ahead (\d+)/.exec(track)
      const behind = /behind (\d+)/.exec(track)
      return {
        name,
        isCurrent: head.trim() === '*',
        date,
        subject: subject.join('\x1f'),
        upstream: upstream || null,
        ahead: ahead ? Number(ahead[1]) : 0,
        behind: behind ? Number(behind[1]) : 0,
        gone: /gone/.test(track)
      }
    })
}

/** "src/{old => new}/a.ts" and "old.ts => new.ts" both resolve to the new path. */
export function renamedPath(path: string): string {
  const braced = path.replace(/\{([^{}]*) => ([^{}]*)\}/g, (_m, _from: string, to: string) => to)
  const plain = braced.includes(' => ') ? braced.split(' => ').pop() ?? braced : braced
  return plain.replace(/\/{2,}/g, '/').replace(/^\//, '')
}

/**
 * `git log --numstat --format=\x1e%aI`: one record per commit, its date then
 * numstat lines. Returns per-commit totals and the most-touched files.
 */
export function parseChurnLog(out: string, limit: number, hotspotCount = 12): RepoChurn {
  const records = out.split('\x1e').filter((record) => record.trim())
  const commits: ChurnPoint[] = []
  const files = new Map<string, FileHotspot>()
  for (const record of records) {
    const lines = record.split('\n')
    const date = lines[0].trim()
    let additions = 0
    let deletions = 0
    for (const line of lines.slice(1)) {
      const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line)
      if (!match) continue
      const adds = match[1] === '-' ? 0 : Number(match[1])
      const dels = match[2] === '-' ? 0 : Number(match[2])
      additions += adds
      deletions += dels
      const path = renamedPath(match[3])
      const entry = files.get(path)
      if (entry) {
        entry.commits++
        entry.additions += adds
        entry.deletions += dels
      } else {
        files.set(path, { path, commits: 1, additions: adds, deletions: dels })
      }
    }
    commits.push({ date, additions, deletions })
  }
  const hotspots = [...files.values()]
    .sort((a, b) => b.commits - a.commits || b.additions + b.deletions - (a.additions + a.deletions))
    .slice(0, hotspotCount)
  return { commits, hotspots, truncated: records.length >= limit }
}
