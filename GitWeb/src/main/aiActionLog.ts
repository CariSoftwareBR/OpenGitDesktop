import { randomUUID } from 'crypto'
import { readJson, updateJson, writeJson } from './appDataStore'
import { appendToLog, sanitizeLog, sanitizeNewEntry, type AiActionEntry } from '../shared/aiActionLog'

// Local only, like the rest of app data: the log never leaves the machine.
const FILE_NAME = 'ai-action-log.json'

export async function listAiActions(): Promise<AiActionEntry[]> {
  return sanitizeLog(await readJson<unknown>(FILE_NAME, []))
}

export async function recordAiAction(input: unknown): Promise<AiActionEntry | null> {
  const entry = sanitizeNewEntry(input)
  if (!entry) return null
  const full: AiActionEntry = { id: randomUUID(), at: new Date().toISOString(), ...entry }
  await updateJson<unknown>(FILE_NAME, [], (current) => appendToLog(sanitizeLog(current), full))
  return full
}

export async function clearAiActions(): Promise<void> {
  await writeJson(FILE_NAME, [])
}
