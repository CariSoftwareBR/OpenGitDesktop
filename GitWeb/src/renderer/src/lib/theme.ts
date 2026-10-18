import { useEffect } from 'react'
import type { ColorSchemePreference } from '../../../shared/settings'

export type ResolvedTheme = 'dark' | 'light' | 'dark-hc' | 'light-hc'

export function resolveTheme(preference: ColorSchemePreference): ResolvedTheme {
  const prefersDark =
    preference === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : preference === 'dark'
  const prefersHc = window.matchMedia('(prefers-contrast: more)').matches
  if (prefersDark) return prefersHc ? 'dark-hc' : 'dark'
  return prefersHc ? 'light-hc' : 'light'
}

/** Dark is the CSS `@theme` baseline — omit `data-theme` for that variant. */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement
  if (theme === 'dark') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = theme
  }
  root.style.colorScheme = theme.startsWith('light') ? 'light' : 'dark'
}

/**
 * Keeps `data-theme` in sync with the user preference and OS media queries.
 * Preference `system` follows `prefers-color-scheme`; contrast media bumps to *-hc.
 */
export function useResolvedTheme(preference: ColorSchemePreference): void {
  useEffect(() => {
    function sync(): void {
      applyTheme(resolveTheme(preference))
    }
    sync()

    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    const contrast = window.matchMedia('(prefers-contrast: more)')
    scheme.addEventListener('change', sync)
    contrast.addEventListener('change', sync)
    return () => {
      scheme.removeEventListener('change', sync)
      contrast.removeEventListener('change', sync)
    }
  }, [preference])
}
