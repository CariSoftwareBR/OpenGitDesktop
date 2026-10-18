/** Manual color-scheme override. `system` follows OS prefers-color-scheme;
 *  high-contrast variants are derived from prefers-contrast at apply time. */
export type ColorSchemePreference = 'system' | 'dark' | 'light'

export interface AppSettings {
  lastRepositoryPath: string | null
  // When true, a successful commit is immediately followed by a push (and
  // publishes the branch first if it has no upstream yet) — skips the
  // separate "now push it" step for people who always do both anyway.
  commitAndPush: boolean
  colorScheme: ColorSchemePreference
  // Parent folders offered in the clone destination combobox (most recent first).
  cloneBaseFolders: string[]
  lastCloneBaseFolder: string | null
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  lastRepositoryPath: null,
  commitAndPush: false,
  colorScheme: 'system',
  cloneBaseFolders: [],
  lastCloneBaseFolder: null
}

export const MAX_CLONE_BASE_FOLDERS = 10
