import { describe, expect, it, vi } from 'vitest'

// getAiSettings reads the saved file through appDataStore; hand it whatever
// each test stores.
let stored: unknown = {}
vi.mock('electron', () => ({ app: { getPath: () => '' } }))
vi.mock('../src/main/appDataStore', () => ({
  readJson: vi.fn(async (_name: string, fallback: unknown) => stored ?? fallback),
  updateJson: vi.fn(),
  writeJson: vi.fn()
}))

const { toToolArguments, parseTextualToolCall } = await import('../src/shared/aiChat')
const { DEFAULT_MAX_DIFF_CHARS, MIN_MAX_DIFF_CHARS, normalizeMaxDiffChars } = await import('../src/shared/ai')
const { getAiSettings } = await import('../src/main/settings')

describe('toToolArguments', () => {
  it('turns JSON booleans and numbers into the strings tools compare against', () => {
    expect(toToolArguments({ draft: true, checkout: false, pull_request_number: 12 })).toEqual({
      draft: 'true',
      checkout: 'false',
      pull_request_number: '12'
    })
  })

  it('puts list items one per line and drops null/undefined', () => {
    expect(toToolArguments({ paths: ['a.ts', 'b, c.ts'], base: null, head: undefined })).toEqual({ paths: 'a.ts\nb, c.ts' })
  })

  it('keeps strings and serializes nested objects', () => {
    expect(toToolArguments({ title: 'x', meta: { a: 1 } })).toEqual({ title: 'x', meta: '{"a":1}' })
  })

  it('treats anything but a plain object as no arguments', () => {
    expect(toToolArguments(null)).toEqual({})
    expect(toToolArguments('x')).toEqual({})
    expect(toToolArguments(['a'])).toEqual({})
  })

  it('applies to the textual fallback too', () => {
    const { call } = parseTextualToolCall('<tool_call>{"name":"create_branch","arguments":{"branch_name":"x","checkout":false}}</tool_call>')
    expect(call?.arguments).toEqual({ branch_name: 'x', checkout: 'false' })
  })
})

describe('normalizeMaxDiffChars', () => {
  it('never lets the limit fall to nothing', () => {
    expect(normalizeMaxDiffChars(0)).toBe(MIN_MAX_DIFF_CHARS)
    expect(normalizeMaxDiffChars(-5)).toBe(MIN_MAX_DIFF_CHARS)
    expect(normalizeMaxDiffChars(8000.4)).toBe(8000)
    expect(normalizeMaxDiffChars(undefined)).toBe(DEFAULT_MAX_DIFF_CHARS)
    expect(normalizeMaxDiffChars(Number.NaN)).toBe(DEFAULT_MAX_DIFF_CHARS)
  })
})

describe('getAiSettings', () => {
  it('falls back to the default provider for an unknown name', async () => {
    stored = { activeProvider: 'gemini' }
    expect((await getAiSettings()).activeProvider).toBe('openai')
    stored = { activeProvider: 'toString' }
    expect((await getAiSettings()).activeProvider).toBe('openai')
  })

  it('keeps a known provider', async () => {
    stored = { activeProvider: 'local' }
    expect((await getAiSettings()).activeProvider).toBe('local')
  })

  it('applies the diff floor to a saved 0', async () => {
    stored = { maxDiffChars: 0 }
    expect((await getAiSettings()).maxDiffChars).toBe(MIN_MAX_DIFF_CHARS)
  })
})

describe('tool catalog display', () => {
  it('gives every tool a name in each language and its own icon', async () => {
    const { TOOL_CATALOG } = await import('../src/shared/aiChat')
    const { getMessages } = await import('../src/shared/i18n')
    const { SUPPORTED_LOCALES } = await import('../src/shared/i18n/locales')
    const { getToolDisplay } = await import('../src/renderer/src/lib/ai/toolDisplay')
    const { Check } = await import('lucide-react')

    for (const tool of TOOL_CATALOG) {
      for (const locale of SUPPORTED_LOCALES) {
        const display = getToolDisplay(tool.name, getMessages(locale).tools.label)
        expect(display.label, `${tool.name} (${locale})`).not.toBe(tool.name)
        expect(display.icon, tool.name).not.toBe(Check)
      }
    }
  })
})
