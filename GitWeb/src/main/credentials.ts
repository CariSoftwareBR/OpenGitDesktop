import { app, safeStorage } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir, rename } from 'fs/promises'

// Single cross-platform secret store: safeStorage uses Credential Manager on
// Windows, Keychain on macOS and libsecret (Secret Service) on Linux under
// the hood. This replaces HelloKeyProtector.cs + WindowsCredentialStore.cs
// with one code path for all three OSes.
const STORE_FILE = () => join(app.getPath('userData'), 'secrets.json')
const STORE_LOCK_KEY = 'secrets.json'

type SecretMap = Record<string, string> // key -> base64-encoded encrypted blob

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

async function readStore(): Promise<SecretMap> {
  try {
    const raw = await readFile(STORE_FILE(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// Temp file + rename: a crash mid-write must not leave a truncated
// secrets.json, which readStore() would read as empty — and the next save
// would then persist that, dropping every other stored token and key.
async function writeStore(store: SecretMap): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  const target = STORE_FILE()
  const temp = `${target}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(store, null, 2), 'utf-8')
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(temp, target)
      return
    } catch (err) {
      // Windows: antivirus/indexer can briefly hold the target open.
      const code = (err as NodeJS.ErrnoException).code
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw err
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt))
    }
  }
}

export async function saveSecret(key: string, value: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level secret encryption is not available on this machine')
  }
  return withLock(STORE_LOCK_KEY, async () => {
    const store = await readStore()
    store[key] = safeStorage.encryptString(value).toString('base64')
    await writeStore(store)
  })
}

export async function getSecret(key: string): Promise<string | null> {
  return withLock(STORE_LOCK_KEY, async () => {
    const store = await readStore()
    const blob = store[key]
    if (!blob) return null
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-level secret encryption is not available on this machine')
    }
    try {
      return safeStorage.decryptString(Buffer.from(blob, 'base64'))
    } catch (err) {
      throw new Error(
        `Failed to decrypt secret "${key}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
  })
}

export async function deleteSecret(key: string): Promise<void> {
  return withLock(STORE_LOCK_KEY, async () => {
    const store = await readStore()
    delete store[key]
    await writeStore(store)
  })
}
