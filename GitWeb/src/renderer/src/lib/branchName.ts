// Branch names typed in the UI. git's own rejection ("fatal: 'x' is not a valid
// branch name" plus hints) arrives in English after the dialog is gone, so the
// common cases are handled while typing instead — the rules below are the ones
// from `git check-ref-format` a person can realistically hit.

/** Whitespace becomes "-", as GitHub Desktop does: "minha feature" → "minha-feature". */
export function sanitizeBranchInput(value: string): string {
  return value.replace(/\s+/g, '-')
}

export function validateBranchName(name: string, existing: string[] = []): string | null {
  if (name.startsWith('-')) return 'O nome não pode começar com "-".'
  if (name === '@') return 'O nome não pode ser só "@".'
  if (/[~^:?*[\\\x00-\x1f\x7f]/.test(name)) return 'O nome não pode conter ~ ^ : ? * [ \\ nem caracteres de controle.'
  if (name.includes('..')) return 'O nome não pode conter "..".'
  if (name.includes('@{')) return 'O nome não pode conter "@{".'
  if (name.includes('//')) return 'O nome não pode conter "//".'
  if (name.startsWith('/') || name.endsWith('/')) return 'O nome não pode começar nem terminar com "/".'
  if (name.endsWith('.')) return 'O nome não pode terminar com ".".'
  if (name.split('/').some((part) => part.startsWith('.'))) return 'Nenhuma parte do nome pode começar com ".".'
  if (name.split('/').some((part) => part.endsWith('.lock'))) return 'Nenhuma parte do nome pode terminar com ".lock".'
  if (existing.some((b) => b.toLowerCase() === name.toLowerCase())) return `Já existe uma branch "${name}".`
  return null
}
