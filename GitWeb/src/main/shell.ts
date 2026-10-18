import { shell } from 'electron'
import { existsSync } from 'fs'
import { dirname, resolve, sep } from 'path'
import { resolveRepoPath } from './gitProcess'

function isWithinRoot(root: string, target: string): boolean {
  const normalizedRoot = resolve(root)
  const normalizedTarget = resolve(target)
  if (process.platform === 'win32') {
    const rootLower = normalizedRoot.toLowerCase()
    const targetLower = normalizedTarget.toLowerCase()
    return targetLower === rootLower || targetLower.startsWith(rootLower + sep.toLowerCase())
  }
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(normalizedRoot + sep)
}

export async function showItemInFolder(cwd: string, relativePath: string): Promise<void> {
  const fullPath = resolveRepoPath(cwd, relativePath)
  if (!existsSync(fullPath)) {
    throw new Error(`Arquivo não encontrado: ${fullPath}`)
  }
  shell.showItemInFolder(fullPath)
}

export async function openPath(cwd: string, relativePath: string): Promise<string> {
  const fullPath = resolveRepoPath(cwd, relativePath)
  if (!existsSync(fullPath)) {
    // Open parent folder when the path is a deleted file — still constrained
    // to the resolved repo-relative target's parent (cannot escape the repo).
    const parent = dirname(fullPath)
    const root = resolveRepoPath(cwd, '.')
    if (!isWithinRoot(root, parent)) {
      throw new Error(`Arquivo não encontrado: ${fullPath}`)
    }
    if (existsSync(parent)) {
      const err = await shell.openPath(parent)
      if (err) throw new Error(err)
      return ''
    }
    throw new Error(`Arquivo não encontrado: ${fullPath}`)
  }
  const err = await shell.openPath(fullPath)
  if (err) throw new Error(err)
  return ''
}

export function pathExists(fullPath: string): boolean {
  return existsSync(fullPath)
}
