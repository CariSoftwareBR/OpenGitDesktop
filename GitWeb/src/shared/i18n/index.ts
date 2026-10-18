import type { Locale } from './locales'
import main from './messages/main'
import settings from './messages/settings'
import common from './messages/common'
import topBar from './messages/topBar'
import about from './messages/about'
import initial from './messages/initial'
import changes from './messages/changes'
import history from './messages/history'
import stashes from './messages/stashes'
import dashboard from './messages/dashboard'
import pullRequests from './messages/pullRequests'
import aiSettings from './messages/aiSettings'
import clone from './messages/clone'
import githubLogin from './messages/githubLogin'
import ui from './messages/ui'
import stores from './messages/stores'
import tools from './messages/tools'

export * from './locales'

// Each namespace file keeps its three translations side by side and types
// `en`/`es` against the pt-BR object, so a missing or extra key fails typecheck.
const namespaces = {
  about,
  aiSettings,
  changes,
  clone,
  common,
  dashboard,
  githubLogin,
  history,
  initial,
  main,
  pullRequests,
  settings,
  stashes,
  stores,
  tools,
  topBar,
  ui
}

type Namespaces = typeof namespaces
export type Messages = { [K in keyof Namespaces]: Namespaces[K]['pt-BR'] }

const cache = new Map<Locale, Messages>()

export function getMessages(locale: Locale): Messages {
  let messages = cache.get(locale)
  if (!messages) {
    messages = Object.fromEntries(
      Object.entries(namespaces).map(([name, byLocale]) => [name, byLocale[locale]])
    ) as Messages
    cache.set(locale, messages)
  }
  return messages
}

/** Every translation of one message, for matching text that crossed IPC. */
export function allTranslations<T>(pick: (messages: Messages) => T): T[] {
  return (['pt-BR', 'en', 'es'] as const).map((locale) => pick(getMessages(locale)))
}

export interface Formatters {
  number: (value: number) => string
  decimal: (value: number) => string
  dateTime: (value: string | number | Date) => string
  date: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
}

const formatterCache = new Map<Locale, Formatters>()

export function getFormatters(locale: Locale): Formatters {
  let formatters = formatterCache.get(locale)
  if (!formatters) {
    const nf = new Intl.NumberFormat(locale)
    const nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    const dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' })
    formatters = {
      number: (value) => nf.format(value),
      decimal: (value) => nf1.format(value),
      dateTime: (value) => dtf.format(new Date(value)),
      date: (value, options) => new Intl.DateTimeFormat(locale, options).format(new Date(value))
    }
    formatterCache.set(locale, formatters)
  }
  return formatters
}
