import { pathToFileURL } from 'url'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { isAppOrigin, RENDERER_INDEX } from '../src/main/security'

describe('isAppOrigin', () => {
  afterEach(() => {
    delete process.env.ELECTRON_RENDERER_URL
  })

  it('accepts the shipped index.html, with or without a hash', () => {
    const url = pathToFileURL(RENDERER_INDEX).href
    expect(isAppOrigin(url)).toBe(true)
    expect(isAppOrigin(`${url}#/history`)).toBe(true)
  })

  it('rejects any other file:// page', () => {
    expect(isAppOrigin(pathToFileURL(join(RENDERER_INDEX, '..', 'other.html')).href)).toBe(false)
    expect(isAppOrigin('file:///C:/Users/me/repo/docs/index.html')).toBe(false)
    expect(isAppOrigin('file:///tmp/evil.html')).toBe(false)
  })

  it('rejects remote origins and accepts only the dev server origin', () => {
    expect(isAppOrigin('https://example.com/')).toBe(false)
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    expect(isAppOrigin('http://localhost:5173/#/x')).toBe(true)
    expect(isAppOrigin('http://localhost:5174/')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isAppOrigin('not a url')).toBe(false)
  })
})
