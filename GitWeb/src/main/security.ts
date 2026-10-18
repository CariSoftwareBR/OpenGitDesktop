import { join, normalize } from 'path'
import { fileURLToPath } from 'url'

/** The page packaged builds load — main/index.ts hands this to loadFile(). */
export const RENDERER_INDEX = join(__dirname, '../renderer/index.html')

function samePath(a: string, b: string): boolean {
  const left = normalize(a)
  const right = normalize(b)
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right
}

// The one definition of "this is our own UI". Packaged builds load the
// renderer from disk (file://); `npm run dev` loads it from the electron-vite
// dev server. Anything else is a page we did not ship and must not be trusted
// with the preload API — see main/index.ts (navigation guards) and main/ipc.ts
// (per-handler sender check).
//
// "Any file://" is not enough: an HTML file the user opens from a cloned repo
// (or one a link navigates to) would be file:// too, and would get the whole
// git and credential surface. Only our own index.html qualifies; the hash and
// query string are ignored because the SPA may route through them.
export function isAppOrigin(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol === 'file:') {
    parsed.hash = ''
    parsed.search = ''
    try {
      return samePath(fileURLToPath(parsed), RENDERER_INDEX)
    } catch {
      return false
    }
  }

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (!devUrl) return false
  try {
    return parsed.origin === new URL(devUrl).origin
  } catch {
    return false
  }
}
