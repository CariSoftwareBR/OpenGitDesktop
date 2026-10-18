import { app } from 'electron'
import { join } from 'path'
import { mkdir, readFile, rename, writeFile } from 'fs/promises'

const locks = new Map<string, Promise<unknown>>()

function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve()
  const next = previous.then(task, task)
  locks.set(
    key,
    next.catch(() => undefined)
  )
  return next
}

function filePath(fileName: string): string {
  return join(app.getPath('userData'), fileName)
}

export async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath(fileName), 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// Windows can transiently EPERM/EBUSY a rename onto an existing file when
// antivirus or the search indexer has it open for scanning right after our
// own write — the lock clears itself within a few ms, so a short retry loop
// resolves it without surfacing an error to the user.
async function renameWithRetry(temp: string, target: string): Promise<void> {
  const attempts = 5
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await rename(temp, target)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (attempt === attempts || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw err
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt))
    }
  }
}

export function writeJson<T>(fileName: string, value: T): Promise<void> {
  return withLock(fileName, async () => {
    await mkdir(app.getPath('userData'), { recursive: true })
    const target = filePath(fileName)
    const temp = `${target}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify(value, null, 2), 'utf-8')
    await renameWithRetry(temp, target)
  })
}

// Read-modify-write, atomically, under the same per-file lock as writeJson.
// Callers that used to do `readJson` then `writeJson` as two separate steps
// (setAppSettings + setLastRepositoryPath both touching settings.json is the
// case that actually bit us) could interleave: both read the same stale
// snapshot before either wrote, so whichever write landed second clobbered
// the other's change. Holding the lock across the whole read+merge+write
// sequence is what makes concurrent updates to the same file safe.
export function updateJson<T>(fileName: string, fallback: T, updater: (current: T) => T): Promise<T> {
  return withLock(fileName, async () => {
    let current: T
    try {
      const raw = await readFile(filePath(fileName), 'utf-8')
      current = JSON.parse(raw) as T
    } catch {
      current = fallback
    }
    const next = updater(current)
    await mkdir(app.getPath('userData'), { recursive: true })
    const target = filePath(fileName)
    const temp = `${target}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify(next, null, 2), 'utf-8')
    await renameWithRetry(temp, target)
    return next
  })
}
