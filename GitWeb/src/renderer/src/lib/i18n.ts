import { useEffect } from 'react'
import { useAppSettingsStore } from '../store/appSettingsStore'
import {
  effectiveLocale,
  getFormatters,
  getMessages,
  type Formatters,
  type Locale,
  type Messages
} from '../../../shared/i18n'

type AppSettingsSnapshot = ReturnType<typeof useAppSettingsStore.getState>

// Until settings load, `system` is the only sensible guess: it is also the default.
function selectLocale(state: AppSettingsSnapshot): Locale {
  return effectiveLocale(state.settings?.language ?? 'system', state.systemLocale)
}

export function useLocale(): Locale {
  return useAppSettingsStore(selectLocale)
}

export function useT(): Messages {
  return getMessages(useLocale())
}

export function useFormatters(): Formatters {
  return getFormatters(useLocale())
}

/** For stores and plain functions; components should use the hooks so they re-render on a switch. */
export function getLocale(): Locale {
  return selectLocale(useAppSettingsStore.getState())
}

export function getT(): Messages {
  return getMessages(getLocale())
}

export function getFmt(): Formatters {
  return getFormatters(getLocale())
}

/** Keeps <html lang> in step, which screen readers and hyphenation rely on. */
export function useDocumentLanguage(): void {
  const locale = useLocale()
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
}
