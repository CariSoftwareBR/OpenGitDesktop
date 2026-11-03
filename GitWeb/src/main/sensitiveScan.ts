import { open } from 'fs/promises'
import { join } from 'path'
import { readGit, throwOnFailure } from './gitProcess'
import { getSettings } from './settings'
import { tMain } from './i18n'
import { findingPaths, scanForSensitive, type SensitiveFinding } from '../shared/sensitiveFiles'

/**
 * `staged`: what the next commit would contain.
 * `all`: everything the AI's auto-stage would add (tracked changes and new
 * files) — scanned before it stages, so the approval card can already show it.
 */
export type SensitiveScanScope = 'staged' | 'all'

// Untracked files are read from disk: bigger ones are almost never config.
const MAX_UNTRACKED_BYTES = 512 * 1024

function splitZ(output: string): string[] {
  return output.split('\0').filter(Boolean)
}

async function readTextFile(path: string): Promise<string | null> {
  const handle = await open(path, 'r').catch(() => null)
  if (!handle) return null
  try {
    const { size } = await handle.stat()
    if (size > MAX_UNTRACKED_BYTES) return null
    const buffer = Buffer.alloc(size)
    await handle.read(buffer, 0, size, 0)
    // A NUL byte early on means binary: nothing to read line by line.
    if (buffer.subarray(0, 8192).includes(0)) return null
    return buffer.toString('utf8')
  } finally {
    await handle.close()
  }
}

// -c core.quotePath=false keeps non-ASCII paths readable in the diff headers.
// --diff-filter=d: a deletion only removes content, it never adds a secret.
const DIFF_ARGS = ['-c', 'core.quotePath=false', 'diff', '--no-color', '--no-ext-diff', '-U0', '--diff-filter=d']

export async function scanSensitive(cwd: string, scope: SensitiveScanScope): Promise<SensitiveFinding[]> {
  const staged = await readGit([...DIFF_ARGS, '--cached'], cwd)
  throwOnFailure(staged, ['diff', '--cached'])
  const stagedNames = await readGit(['diff', '--cached', '--name-only', '-z', '--diff-filter=d'], cwd)
  throwOnFailure(stagedNames, ['diff', '--cached', '--name-only'])
  if (scope === 'staged') return scanForSensitive(splitZ(stagedNames.stdout), staged.stdout)

  const unstaged = await readGit([...DIFF_ARGS], cwd)
  throwOnFailure(unstaged, ['diff'])
  const unstagedNames = await readGit(['diff', '--name-only', '-z', '--diff-filter=d'], cwd)
  throwOnFailure(unstagedNames, ['diff', '--name-only'])
  const untracked = await readGit(['ls-files', '--others', '--exclude-standard', '-z'], cwd)
  throwOnFailure(untracked, ['ls-files', '--others'])

  const untrackedPaths = splitZ(untracked.stdout)
  const extraFiles: { path: string; content: string }[] = []
  for (const path of untrackedPaths) {
    const content = await readTextFile(join(cwd, path))
    if (content !== null) extraFiles.push({ path, content })
  }
  const paths = [...new Set([...splitZ(stagedNames.stdout), ...splitZ(unstagedNames.stdout), ...untrackedPaths])]
  return scanForSensitive(paths, `${staged.stdout}\n${unstaged.stdout}`, extraFiles)
}

/**
 * The main-process guard behind every commit path: with the check on and set
 * to block, a commit carrying a finding is refused here, whatever the renderer
 * did. In warn mode the renderer asks first; the commit itself goes through.
 */
export async function assertNoBlockedSensitive(cwd: string): Promise<void> {
  const settings = await getSettings()
  if (!settings.sensitiveCheck || settings.sensitiveCheckMode !== 'block') return
  const findings = await scanSensitive(cwd, 'staged')
  if (findings.length > 0) throw new Error(tMain().git.sensitiveBlocked(findingPaths(findings).join(', ')))
}
