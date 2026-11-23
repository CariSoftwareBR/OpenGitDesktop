import type { LanguagePreference } from './i18n/locales'
import type { SensitiveCheckMode } from './sensitiveFiles'
import type { IdentityProfile } from './identity'

/** Manual color-scheme override. `system` follows OS prefers-color-scheme;
 *  high-contrast variants are derived from prefers-contrast at apply time. */
export type ColorSchemePreference = 'system' | 'dark' | 'light'

export interface AppSettings {
  lastRepositoryPath: string | null
  // When true, a successful commit is immediately followed by a push (and
  // publishes the branch first if it has no upstream yet) — skips the
  // separate "now push it" step for people who always do both anyway.
  commitAndPush: boolean
  // When true, commits made through the app carry a Co-authored-by trailer
  // crediting OpenGitDesktop — the way users can support the project.
  coAuthorProject: boolean
  // Before each commit (Changes view and AI alike), look for .env files,
  // private keys and provider tokens in what is about to be committed.
  sensitiveCheck: boolean
  // `block` (default) refuses the commit, enforced in main; `warn` asks first.
  sensitiveCheckMode: SensitiveCheckMode
  colorScheme: ColorSchemePreference
  // Interface, main-process messages and AI replies all follow this one
  // language; `system` resolves from the OS preferred-language list.
  language: LanguagePreference
  // Parent folders offered in the clone destination combobox (most recent first).
  cloneBaseFolders: string[]
  lastCloneBaseFolder: string | null
  // When true, clones land in <base folder>/<account>/<repository> instead of
  // directly in the base folder.
  cloneOrganizeByOwner: boolean
  // Name and e-mail per account; a profile with a folder is applied to the
  // repositories below it through includeIf (see main/gitIdentity.ts).
  identityProfiles: IdentityProfile[]
  // Branches the AI assistant may never commit to, push or rewrite, even with
  // approval: it has to create another branch first.
  aiProtectedBranches: string[]
  // Danger-tier AI actions (push, merge, delete branches…) need a second
  // click on the approval card.
  aiConfirmDanger: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  lastRepositoryPath: null,
  commitAndPush: false,
  coAuthorProject: false,
  sensitiveCheck: true,
  sensitiveCheckMode: 'block',
  colorScheme: 'system',
  language: 'system',
  cloneBaseFolders: [],
  lastCloneBaseFolder: null,
  cloneOrganizeByOwner: false,
  identityProfiles: [],
  aiProtectedBranches: [],
  aiConfirmDanger: false
}

export const MAX_PROTECTED_BRANCHES = 30

/** Trimmed, deduplicated (case-sensitive, as Git is), and without names Git would reject outright. */
export function sanitizeBranchList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const name = item.trim()
    // `*` only as the trailing prefix wildcard (see isProtectedBranch).
    if (!name || name.startsWith('-') || /[\s~^:?[\\]/.test(name) || name.slice(0, -1).includes('*') || result.includes(name)) continue
    result.push(name)
  }
  return result.slice(0, MAX_PROTECTED_BRANCHES)
}

/**
 * Whether a branch is on the protected list. A trailing `*` matches a prefix
 * (`release/*`), which is how teams usually name the branches they guard.
 */
export function isProtectedBranch(branch: string | null | undefined, protectedBranches: string[]): boolean {
  if (!branch) return false
  return protectedBranches.some((pattern) =>
    pattern.endsWith('*') ? branch.startsWith(pattern.slice(0, -1)) : branch === pattern
  )
}

export const MAX_CLONE_BASE_FOLDERS = 10

/**
 * The project's co-author identity: the GitHub no-reply address of
 * CariSoftwareBRDev, the CariSoftwareBR project account (an organization
 * can't be a co-author). GitHub links the credit to that profile without
 * exposing any real e-mail address.
 */
export const PROJECT_CO_AUTHOR = 'OpenGitDesktop <347057149+CariSoftwareBRDev@users.noreply.github.com>'
export const PROJECT_CO_AUTHOR_TRAILER = `Co-authored-by: ${PROJECT_CO_AUTHOR}`

/**
 * Appends the project's Co-authored-by trailer to a commit description. Git
 * reads trailers from the message's last paragraph, so it goes after a blank
 * line — or joins an existing trailer block (other co-authors, Signed-off-by)
 * when the description already ends in one. Never added twice.
 */
export function withProjectCoAuthor(description: string): string {
  const body = description.replace(/\s+$/, '')
  if (body.toLowerCase().includes(PROJECT_CO_AUTHOR_TRAILER.toLowerCase())) return body
  if (!body) return PROJECT_CO_AUTHOR_TRAILER
  const lastParagraph = body.split(/\n\s*\n/).pop() ?? ''
  const endsInTrailers = lastParagraph.split('\n').every((line) => /^[A-Za-z][A-Za-z0-9-]*: \S/.test(line))
  return `${body}${endsInTrailers ? '\n' : '\n\n'}${PROJECT_CO_AUTHOR_TRAILER}`
}
