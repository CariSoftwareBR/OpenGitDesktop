import { app } from 'electron'
import { effectiveLocale, resolveLocale, type LanguagePreference, type Locale } from '../shared/i18n/locales'
import { setMainLocale } from './i18n'

/** The OS language list first; app.getLocale() covers platforms that return none. */
export function systemLocale(): Locale {
  return resolveLocale([...app.getPreferredSystemLanguages(), app.getLocale()])
}

export function applyLanguagePreference(preference: LanguagePreference): void {
  setMainLocale(effectiveLocale(preference, systemLocale()))
}
