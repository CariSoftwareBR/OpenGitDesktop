// Renderer runs without Node's `path` module (contextIsolation, no nodeIntegration),
// so path helpers needed purely for display are reimplemented as plain string ops.

function isWindowsDriveRoot(path: string): boolean {
  return /^[a-zA-Z]:[\\/]?$/.test(path)
}

function separatorOf(path: string): string {
  return path.includes('\\') || /^[a-zA-Z]:/.test(path) ? '\\' : '/'
}

/** Drops trailing separators but keeps `C:\` (a drive root is a real path). */
export function stripTrailingSep(path: string): string {
  if (isWindowsDriveRoot(path)) {
    const drive = path.slice(0, 2)
    return path.includes('/') ? `${drive}/` : `${drive}\\`
  }
  return path.replace(/[\\/]+$/, '') || path
}

export function basename(fullPath: string): string {
  const normalized = stripTrailingSep(fullPath)
  if (isWindowsDriveRoot(normalized)) return normalized
  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || normalized
}

export function dirname(fullPath: string): string {
  const normalized = stripTrailingSep(fullPath)
  if (!normalized || isWindowsDriveRoot(normalized) || normalized === '/') return normalized
  const sep = separatorOf(fullPath)
  const parts = normalized.split(/[\\/]/)
  if (parts.length <= 1) return ''
  const parentParts = parts.slice(0, -1)
  if (parentParts.length === 1 && /^[a-zA-Z]:$/.test(parentParts[0])) {
    return `${parentParts[0]}${sep}`
  }
  if (parentParts.length === 1 && parentParts[0] === '') return '/'
  return parentParts.join(sep)
}

export function joinPath(parent: string, child: string): string {
  const trimmedChild = child.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '')
  if (!trimmedChild) return parent
  if (!parent) return trimmedChild
  const trimmedParent = stripTrailingSep(parent)
  const sep = separatorOf(parent)
  if (/^[a-zA-Z]:$/.test(trimmedParent)) return `${trimmedParent}${sep}${trimmedChild}`
  return `${trimmedParent}${sep}${trimmedChild}`
}

export function pathsEqual(a: string, b: string): boolean {
  return stripTrailingSep(a).toLowerCase() === stripTrailingSep(b).toLowerCase()
}
