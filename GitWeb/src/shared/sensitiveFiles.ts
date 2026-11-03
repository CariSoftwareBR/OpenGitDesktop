// Detects files that should not go into a commit: secrets by file name (.env,
// private keys, credential stores) and by content (provider tokens in the
// added lines). Pure, so the main process (which enforces "block") and the
// tests share one definition. Findings never carry the secret itself — only
// where it is and what it looks like — so nothing sensitive crosses IPC or
// reaches an AI prompt.

export type SensitiveKind =
  | 'envFile'
  | 'privateKeyFile'
  | 'sshKey'
  | 'keystore'
  | 'credentialsFile'
  | 'privateKey'
  | 'githubToken'
  | 'gitlabToken'
  | 'awsKey'
  | 'openaiKey'
  | 'anthropicKey'
  | 'googleKey'
  | 'slackToken'
  | 'stripeKey'
  | 'npmToken'
  | 'genericSecret'

export interface SensitiveFinding {
  path: string
  kind: SensitiveKind
  /** 1-based line in the new file, for content findings. */
  line?: number
}

/** What the app does when a commit carries a finding. */
export type SensitiveCheckMode = 'warn' | 'block'

/** Upper bound on findings reported, so a dump of keys can't flood the dialog. */
export const MAX_SENSITIVE_FINDINGS = 50

// Templates meant to be committed: they document the variables, not the values.
const ENV_TEMPLATE = /^\.env\.(example|sample|template|dist|defaults)$/i

const NAME_RULES: { kind: SensitiveKind; test: (name: string, path: string) => boolean }[] = [
  {
    kind: 'envFile',
    // .envrc: direnv's file, usually a list of `export TOKEN=…`.
    test: (name) => (/^\.env(rc)?$/i.test(name) || /^\.env\..+/i.test(name)) && !ENV_TEMPLATE.test(name)
  },
  { kind: 'sshKey', test: (name) => /^id_(rsa|dsa|ecdsa|ed25519)(_sk)?$/i.test(name) },
  { kind: 'privateKeyFile', test: (name) => /\.(pem|key|ppk)$/i.test(name) },
  { kind: 'keystore', test: (name) => /\.(p12|pfx|jks|keystore)$/i.test(name) },
  {
    kind: 'credentialsFile',
    test: (name, path) =>
      /^(\.git-credentials|\.netrc|_netrc|\.htpasswd|\.pgpass)$/i.test(name) ||
      /^(credentials|secrets?)\.(json|ya?ml|toml|xml)$/i.test(name) ||
      /^service[-_]?account.*\.json$/i.test(name) ||
      /(^|\/)\.aws\/credentials$/i.test(path)
  }
]

// Built from pieces so this file never contains a literal that a secret
// scanner (gitleaks, GitHub push protection, this module) would flag.
const PRIVATE_KEY_HEADER = new RegExp('-----BEGIN (?:[A-Z0-9]+ )*PRIVATE ' + 'KEY(?: BLOCK)?-----')

// Order matters: the first matching rule names the kind (sk-ant- before sk-).
const CONTENT_RULES: { kind: SensitiveKind; pattern: RegExp }[] = [
  { kind: 'privateKey', pattern: PRIVATE_KEY_HEADER },
  { kind: 'githubToken', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/ },
  { kind: 'gitlabToken', pattern: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { kind: 'awsKey', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { kind: 'anthropicKey', pattern: /\bsk-ant-[A-Za-z0-9_-]{32,}/ },
  { kind: 'openaiKey', pattern: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/ },
  { kind: 'googleKey', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: 'slackToken', pattern: /\bxox[abposr]-[0-9A-Za-z-]{10,}/ },
  { kind: 'stripeKey', pattern: /\b[sr]k_live_[0-9A-Za-z]{24,}/ },
  { kind: 'npmToken', pattern: /\bnpm_[A-Za-z0-9]{36}\b/ }
]

// `password = "…"`, `apiKey: '…'`, `CLIENT_SECRET="…"`: a secret-ish name
// assigned a quoted literal with no spaces. The value test below drops the
// usual placeholders so a config template doesn't trip it.
const GENERIC_ASSIGNMENT =
  /(?:pass(?:word|wd)?|secret|api[_-]?key|access[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key|client[_-]?secret)["']?\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/i
const PLACEHOLDER = /(example|changeme|change_me|placeholder|dummy|sample|your[_-]|<|>|\$\{|\{\{|%s|x{4,}|\*{3,}|\.{3})/i

function looksLikeRealSecret(value: string): boolean {
  if (PLACEHOLDER.test(value)) return false
  if (/^(.)\1+$/.test(value)) return false
  // Real secrets mix letters and digits; words and identifiers rarely do.
  return /[A-Za-z]/.test(value) && /\d/.test(value)
}

function baseName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] ?? path
}

/** The name-based kind for a repository path (forward slashes), or null. */
export function sensitiveFileKind(path: string): SensitiveKind | null {
  const normalized = path.replace(/\\/g, '/')
  const name = baseName(normalized)
  if (name.toLowerCase().endsWith('.pub')) return null
  return NAME_RULES.find((rule) => rule.test(name, normalized))?.kind ?? null
}

/** The content-based kind found in one line of text, or null. */
export function sensitiveLineKind(line: string): SensitiveKind | null {
  for (const rule of CONTENT_RULES) if (rule.pattern.test(line)) return rule.kind
  const generic = GENERIC_ASSIGNMENT.exec(line)
  if (generic && looksLikeRealSecret(generic[1])) return 'genericSecret'
  return null
}

// One finding per (path, kind): the first line is enough to point at it.
class FindingSet {
  private readonly seen = new Set<string>()
  readonly items: SensitiveFinding[] = []

  add(finding: SensitiveFinding): void {
    if (this.items.length >= MAX_SENSITIVE_FINDINGS) return
    const key = `${finding.path}\0${finding.kind}`
    if (this.seen.has(key)) return
    this.seen.add(key)
    this.items.push(finding)
  }
}

// `+++ b/path`, possibly C-quoted when the path has special characters.
function diffTargetPath(header: string): string | null {
  let raw = header.slice(4).trim()
  if (raw === '/dev/null') return null
  if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1).replace(/\\(["\\])/g, '$1')
  return raw.startsWith('b/') ? raw.slice(2) : raw
}

/**
 * Scans a commit's contents: the paths it adds or changes (deletions don't
 * count — removing a .env is the fix) and the unified diff of those changes.
 * Only added lines are read, so a secret that is being removed is not flagged.
 * `extraFiles` are new files whose content is not in the diff (untracked
 * files about to be staged), scanned whole.
 */
export function scanForSensitive(
  paths: string[],
  diff: string,
  extraFiles: { path: string; content: string }[] = []
): SensitiveFinding[] {
  const found = new FindingSet()

  for (const path of paths) {
    const kind = sensitiveFileKind(path)
    if (kind) found.add({ path, kind })
  }

  let current: string | null = null
  let lineNo = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      current = diffTargetPath(line)
      continue
    }
    if (line.startsWith('diff --git ')) {
      current = null
      continue
    }
    if (line.startsWith('@@')) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line)
      lineNo = match ? Number(match[1]) : 0
      continue
    }
    if (!current) continue
    if (line.startsWith('+')) {
      const kind = sensitiveLineKind(line.slice(1))
      if (kind) found.add({ path: current, kind, line: lineNo })
      lineNo++
    } else if (line.startsWith(' ')) {
      lineNo++
    }
  }

  for (const file of extraFiles) {
    file.content.split('\n').forEach((line, index) => {
      const kind = sensitiveLineKind(line)
      if (kind) found.add({ path: file.path, kind, line: index + 1 })
    })
  }

  return found.items
}

/** Distinct paths of a finding list, in order. */
export function findingPaths(findings: SensitiveFinding[]): string[] {
  return [...new Set(findings.map((f) => f.path))]
}

/**
 * Masks what the sensitive-file check would flag before text leaves for an AI
 * provider: inside a unified diff, every content line of a name-flagged file
 * (.env, keys…) collapses into one placeholder per run; anywhere, a line with
 * a token or secret becomes the placeholder (a diff's +/-/space marker kept).
 * Line-based on purpose — the model still sees which files and where changed.
 */
export function redactSensitiveText(text: string, placeholder: string): { text: string; redacted: number } {
  let redacted = 0
  let inSensitiveFile = false
  let lastWasPlaceholder = false
  const out: string[] = []

  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const target = /^diff --git (?:"?a\/.*?"?) "?b\/(.+?)"?$/.exec(line)?.[1]
      inSensitiveFile = target ? sensitiveFileKind(target) !== null : false
      lastWasPlaceholder = false
      out.push(line)
      continue
    }
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      const path = diffTargetPath(line.startsWith('+++ ') ? line : `+++ ${line.slice(4)}`)
      if (path && sensitiveFileKind(path)) inSensitiveFile = true
      out.push(line)
      continue
    }
    if (line.startsWith('@@')) {
      lastWasPlaceholder = false
      out.push(line)
      continue
    }
    const marker = /^[+\- ]/.test(line) ? line[0] : ''
    if (inSensitiveFile && marker) {
      redacted++
      if (!lastWasPlaceholder) out.push(`${marker}${placeholder}`)
      lastWasPlaceholder = true
      continue
    }
    lastWasPlaceholder = false
    if (sensitiveLineKind(line)) {
      redacted++
      const indent = /^[+\- ]?\s*/.exec(line)?.[0] ?? ''
      out.push(`${indent}${placeholder}`)
      continue
    }
    out.push(line)
  }
  return { text: out.join('\n'), redacted }
}
