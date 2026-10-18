import { describe, expect, it } from 'vitest'
import { effectiveLocale, getMessages, resolveLocale, SUPPORTED_LOCALES } from '../src/shared/i18n'
import { selectScmSkills } from '../src/shared/aiPrompts'

const user = (content: string) => ({ role: 'user' as const, content })

describe('resolveLocale', () => {
  it('maps any Portuguese or Spanish variant to the supported locale', () => {
    expect(resolveLocale(['pt-PT'])).toBe('pt-BR')
    expect(resolveLocale(['pt_BR'])).toBe('pt-BR')
    expect(resolveLocale(['es-MX'])).toBe('es')
    expect(resolveLocale(['en-GB'])).toBe('en')
  })

  it('takes the first supported tag and falls back to English', () => {
    expect(resolveLocale(['fr-FR', 'es-AR', 'pt-BR'])).toBe('es')
    expect(resolveLocale(['fr', 'de'])).toBe('en')
    expect(resolveLocale([])).toBe('en')
  })

  it('lets an explicit preference override the system language', () => {
    expect(effectiveLocale('system', 'es')).toBe('es')
    expect(effectiveLocale('pt-BR', 'es')).toBe('pt-BR')
  })
})

type Shape = string | number | ((...args: never[]) => unknown) | Shape[] | { [key: string]: Shape }

// Calls every message function with placeholder arguments so a translation
// that renders empty (or throws) is caught, not just a missing key.
function walk(value: unknown, path: string, out: Map<string, string>): void {
  if (typeof value === 'function') {
    const rendered = (value as (...args: unknown[]) => unknown)('x', 2, 'y', 'z')
    out.set(`${path}()`, typeof rendered === 'string' ? rendered : String(rendered))
  } else if (Array.isArray(value)) {
    out.set(`${path}.length`, String(value.length))
    value.forEach((item, index) => walk(item, `${path}[${index}]`, out))
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, Shape>)) walk(child, `${path}.${key}`, out)
  } else {
    out.set(path, String(value))
  }
}

describe('message dictionaries', () => {
  const flattened = SUPPORTED_LOCALES.map((locale) => {
    const out = new Map<string, string>()
    walk(getMessages(locale), locale, out)
    return { locale, entries: new Map([...out].map(([key, text]) => [key.slice(locale.length), text])) }
  })

  it('have the same keys in every locale', () => {
    const [reference, ...others] = flattened
    for (const other of others) {
      expect([...other.entries.keys()].sort(), other.locale).toEqual([...reference.entries.keys()].sort())
    }
  })

  // "All time" has no previous period to compare against, so its label is blank on purpose.
  const intentionallyEmpty = new Set(['.dashboard.period.all.comparison'])

  it('never render an empty string', () => {
    for (const { locale, entries } of flattened) {
      const empty = [...entries]
        .filter(([key, text]) => text.trim() === '' && !intentionallyEmpty.has(key))
        .map(([key]) => key)
      expect(empty, locale).toEqual([])
    }
  })
})

describe('selectScmSkills — Spanish triggers', () => {
  it('detects Spanish requests', () => {
    expect(selectScmSkills([user('haz commit y push de la rama actual')])).toEqual(['git-workflow'])
    expect(selectScmSkills([user('necesito fusionar la rama develop')])).toContain('merge-branch')
    expect(selectScmSkills([user('¿quiénes son los dueños del código de este módulo?')])).toEqual(['codeowners'])
    expect(selectScmSkills([user('analiza los riesgos de este repositorio')])).toEqual(['repository-risk'])
  })

  it('routes an unwanted file in Spanish to unwanted-file alone', () => {
    expect(selectScmSkills([user('subí sin querer un archivo muy grande')])).toEqual(['unwanted-file'])
    expect(selectScmSkills([user('ese archivo no debería haber sido commiteado')])).toEqual(['unwanted-file'])
  })
})
