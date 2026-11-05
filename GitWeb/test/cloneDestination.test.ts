import { describe, expect, it } from 'vitest'
import {
  cloneParentFolder,
  collectCloneBaseFolders,
  destinationForNewBase,
  destinationForPlacement,
  placementPath,
  type ClonePlacement
} from '../src/renderer/src/lib/cloneDestination'
import { pathKey } from '../src/renderer/src/lib/path'

const placement = (overrides: Partial<ClonePlacement> = {}): ClonePlacement => ({
  base: 'C:\\Github',
  owner: 'acme',
  repo: 'site',
  byOwner: true,
  ...overrides
})

describe('placementPath', () => {
  it('puts the repository inside its account folder', () => {
    expect(placementPath(placement())).toBe('C:\\Github\\acme\\site')
  })

  it('ignores the account when the option is off', () => {
    expect(placementPath(placement({ byOwner: false }))).toBe('C:\\Github\\site')
  })

  it('falls back to the base folder when the account is unknown', () => {
    expect(placementPath(placement({ owner: '' }))).toBe('C:\\Github\\site')
  })

  it('stays on the base folder before a repository is chosen', () => {
    expect(placementPath(placement({ owner: '', repo: '' }))).toBe('C:\\Github')
  })

  it('nests GitLab subgroups', () => {
    expect(placementPath(placement({ owner: 'group/team' }))).toBe('C:\\Github\\group\\team\\site')
  })

  it('does not repeat the account when the base already is its folder', () => {
    expect(placementPath(placement({ base: 'C:\\Github\\ACME' }))).toBe('C:\\Github\\ACME\\site')
  })

  it.each(['..', '../../evil', 'a/../b', '.', 'a:b', 'a\\b', 'trailing.', 'trailing '])(
    'refuses %j as a folder, keeping the clone in the base folder',
    (owner) => {
      expect(cloneParentFolder(placement({ owner }))).toBe('C:\\Github')
    }
  )
})

describe('destinationForPlacement', () => {
  it('follows the account when another repository is chosen', () => {
    const next = placement({ owner: 'other', repo: 'api' })
    expect(destinationForPlacement('C:\\Github\\acme\\site', placement(), next)).toBe('C:\\Github\\other\\api')
  })

  it('moves a destination that was still only the base folder', () => {
    expect(destinationForPlacement('C:\\Github', placement({ owner: '', repo: '' }), placement())).toBe(
      'C:\\Github\\acme\\site'
    )
  })

  it('keeps a custom name the user typed', () => {
    const next = placement({ owner: 'other', repo: 'api' })
    expect(destinationForPlacement('D:\\custom\\folder', placement(), next)).toBe('D:\\custom\\folder')
  })

  it('keeps an edited parent, but the folder follows the repository', () => {
    const next = placement({ owner: 'other', repo: 'api' })
    expect(destinationForPlacement('D:\\outra\\site', placement(), next)).toBe('D:\\outra\\api')
  })

  it('never produces a relative path when there is no base folder yet', () => {
    const none = placement({ base: '', owner: '', repo: '' })
    expect(destinationForPlacement('', none, { ...none, owner: 'acme', repo: 'site' })).toBe('')
  })
})

describe('destinationForNewBase', () => {
  it('moves a destination that followed the placement', () => {
    const next = placement({ base: 'D:\\Novo' })
    expect(destinationForNewBase('C:\\Github\\acme\\site', placement(), next)).toBe('D:\\Novo\\acme\\site')
  })

  it('keeps a custom name, under the new account folder', () => {
    const next = placement({ base: 'D:\\Novo' })
    expect(destinationForNewBase('C:\\x\\meu-nome', placement(), next)).toBe('D:\\Novo\\acme\\meu-nome')
  })

  it('stays on the base folder before a repository is chosen', () => {
    const none = placement({ owner: '', repo: '' })
    expect(destinationForNewBase('C:\\Github', none, { ...none, base: 'D:\\Novo' })).toBe('D:\\Novo')
  })
})

describe('collectCloneBaseFolders', () => {
  it('does not offer the account folders inside a known base', () => {
    const recents = ['C:\\Github\\acme\\site', 'C:\\Github\\other\\api', 'C:\\Github\\grupo\\time\\proj', 'D:\\Solto\\repo']
    expect(collectCloneBaseFolders(['C:\\Github'], null, recents)).toEqual(['C:\\Github', 'D:\\Solto'])
  })

  it('still offers a repository parent that is the base itself', () => {
    expect(collectCloneBaseFolders([], 'C:\\Github', ['C:\\Github\\site'])).toEqual(['C:\\Github'])
  })

  it('offers parents when no base is known yet', () => {
    expect(collectCloneBaseFolders([], null, ['C:\\Github\\site'])).toEqual(['C:\\Github'])
  })

  it('is not fooled by a folder that only starts with the same name', () => {
    expect(collectCloneBaseFolders(['C:\\Git'], null, ['C:\\Github\\site'])).toEqual(['C:\\Git', 'C:\\Github'])
  })
})

describe('pathKey', () => {
  it('names a Windows folder the same however it is spelled', () => {
    expect(pathKey('C:/Git/Site/')).toBe(pathKey('c:\\git\\site'))
  })

  it('keeps letter case on case-sensitive paths', () => {
    expect(pathKey('/r/Site')).not.toBe(pathKey('/r/site'))
  })
})
