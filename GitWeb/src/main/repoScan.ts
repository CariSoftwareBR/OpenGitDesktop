import { readdir } from 'fs/promises'
import { join } from 'path'

const MAX_SCAN_DEPTH = 2
const MAX_RESULTS = 200
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', 'build', 'out', 'venv', '__pycache__', 'vendor'])

async function scanLevel(dir: string, depth: number, results: string[]): Promise<void> {
  if (results.length >= MAX_RESULTS) return
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  const subDirs: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === '.git') {
      results.push(dir)
      return // don't recurse into a repo's own working tree
    }
    if (entry.name.startsWith('.') || SKIP_DIR_NAMES.has(entry.name)) continue
    subDirs.push(entry.name)
  }

  if (depth >= MAX_SCAN_DEPTH) return
  for (const name of subDirs) {
    if (results.length >= MAX_RESULTS) return
    await scanLevel(join(dir, name), depth + 1, results)
  }
}

/**
 * Finds git repositories nested inside a chosen folder (e.g. a projects
 * folder containing many repos as immediate or one-level-deep children).
 * Stops descending as soon as it finds a `.git` folder, so it returns
 * top-level repos rather than every nested submodule.
 */
export async function scanForRepositories(rootPath: string): Promise<string[]> {
  const results: string[] = []
  let entries
  try {
    entries = await readdir(rootPath, { withFileTypes: true })
  } catch {
    return []
  }

  const subDirs = entries.filter(
    (entry) => entry.isDirectory() && !entry.name.startsWith('.') && !SKIP_DIR_NAMES.has(entry.name)
  )
  for (const entry of subDirs) {
    if (results.length >= MAX_RESULTS) break
    await scanLevel(join(rootPath, entry.name), 1, results)
  }
  return results
}
