import type { LanguagePreference } from './i18n/locales'

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
  colorScheme: ColorSchemePreference
  // Interface, main-process messages and AI replies all follow this one
  // language; `system` resolves from the OS preferred-language list.
  language: LanguagePreference
  // Parent folders offered in the clone destination combobox (most recent first).
  cloneBaseFolders: string[]
  lastCloneBaseFolder: string | null
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  lastRepositoryPath: null,
  commitAndPush: false,
  coAuthorProject: false,
  colorScheme: 'system',
  language: 'system',
  cloneBaseFolders: [],
  lastCloneBaseFolder: null
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
