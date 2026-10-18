import { getMessages, type Locale, type Messages } from '../shared/i18n'

// Kept free of Electron imports so gitProcess & co. stay testable under plain
// Node; index.ts resolves the OS language and calls setMainLocale at startup.
let current: Locale = 'pt-BR'

export function setMainLocale(locale: Locale): void {
  current = locale
}

export function getMainLocale(): Locale {
  return current
}

export function tMain(): Messages['main'] {
  return getMessages(current).main
}
