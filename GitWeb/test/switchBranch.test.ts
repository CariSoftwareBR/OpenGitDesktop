import { describe, expect, it } from 'vitest'
import { parseCheckoutBlockers, stashBranchName } from '../src/shared/git'

const TRACKED_AND_UNTRACKED = [
  'error: Your local changes to the following files would be overwritten by checkout:',
  '\tTreinamento PT_BR/.gitignore',
  '\tTreinamento PT_BR/README.md',
  'Please commit your changes or stash them before you switch branches.',
  'error: The following untracked working tree files would be overwritten by checkout:',
  '\tnotes.txt',
  'Please move or remove them before you switch branches.',
  'Aborting'
].join('\n')

describe('parseCheckoutBlockers', () => {
  it('collects tracked and untracked blockers, with spaces in paths', () => {
    expect(parseCheckoutBlockers(TRACKED_AND_UNTRACKED)).toEqual([
      'Treinamento PT_BR/.gitignore',
      'Treinamento PT_BR/README.md',
      'notes.txt'
    ])
  })

  it('handles CRLF output', () => {
    expect(parseCheckoutBlockers(TRACKED_AND_UNTRACKED.replace(/\n/g, '\r\n'))).toHaveLength(3)
  })

  it('returns null for any other checkout failure', () => {
    expect(parseCheckoutBlockers("error: pathspec 'nope' did not match any file(s) known to git")).toBeNull()
  })
})

describe('stashBranchName', () => {
  it('reads the branch from both stash subject forms', () => {
    expect(stashBranchName('On treinamento-ptbr: Alterações deixadas em treinamento-ptbr')).toBe('treinamento-ptbr')
    expect(stashBranchName('WIP on feature/x: 1a2b3c4 Ajusta filtro')).toBe('feature/x')
  })

  it('returns null for an unexpected subject', () => {
    expect(stashBranchName('something else')).toBeNull()
  })
})
