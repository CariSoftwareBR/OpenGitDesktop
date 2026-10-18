// Branch names typed in the UI. git's own rejection ("fatal: 'x' is not a valid
// branch name" plus hints) arrives in English after the dialog is gone, so the
// common cases are handled while typing instead — the rules below are the ones
// from `git check-ref-format` a person can realistically hit.

import { getT } from './i18n'

/** Whitespace becomes "-", as GitHub Desktop does: "minha feature" → "minha-feature". */
export function sanitizeBranchInput(value: string): string {
  return value.replace(/\s+/g, '-')
}

export function validateBranchName(name: string, existing: string[] = []): string | null {
  const t = getT().stores
  if (name.startsWith('-')) return t.branchStartsWithDash
  if (name === '@') return t.branchIsAt
  if (/[~^:?*[\\\x00-\x1f\x7f]/.test(name)) return t.branchControlChars
  if (name.includes('..')) return t.branchDoubleDot
  if (name.includes('@{')) return t.branchAtBrace
  if (name.includes('//')) return t.branchDoubleSlash
  if (name.startsWith('/') || name.endsWith('/')) return t.branchSlashEdge
  if (name.endsWith('.')) return t.branchEndsWithDot
  if (name.split('/').some((part) => part.startsWith('.'))) return t.branchPartDot
  if (name.split('/').some((part) => part.endsWith('.lock'))) return t.branchPartLock
  if (existing.some((b) => b.toLowerCase() === name.toLowerCase())) return t.branchExists(name)
  return null
}
