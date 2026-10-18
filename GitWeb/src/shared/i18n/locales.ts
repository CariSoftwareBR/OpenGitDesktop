export type Locale = 'pt-BR' | 'en' | 'es'

/** What the user picked in Settings; `system` follows the OS language list. */
export type LanguagePreference = 'system' | Locale

export const SUPPORTED_LOCALES: readonly Locale[] = ['pt-BR', 'en', 'es']

/** Each language named in itself, so anyone can find their own in the picker. */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  es: 'Español'
}

export const FALLBACK_LOCALE: Locale = 'en'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || isLocale(value)
}

/**
 * First supported language in an ordered BCP 47 list (OS or browser
 * preferences). Any Portuguese variant maps to pt-BR, any Spanish one to es;
 * a list with neither falls back to English.
 */
export function resolveLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const primary = tag.toLowerCase().split(/[-_]/)[0]
    if (primary === 'pt') return 'pt-BR'
    if (primary === 'es') return 'es'
    if (primary === 'en') return 'en'
  }
  return FALLBACK_LOCALE
}

export function effectiveLocale(preference: LanguagePreference, systemLocale: Locale): Locale {
  return preference === 'system' ? systemLocale : preference
}
