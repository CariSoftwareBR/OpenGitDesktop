import { describe, expect, it } from 'vitest'
import { ownerFolders, parseRemoteUrl } from '../src/shared/remoteOwner'

describe('parseRemoteUrl', () => {
  it.each([
    ['https://github.com/acme/site.git', 'acme', 'site'],
    ['git@github.com:acme/site.git', 'acme', 'site'],
    ['ssh://git@github.com/acme/site.git', 'acme', 'site'],
    // A port is not part of the path.
    ['ssh://git@gitlab.empresa.com:2222/acme/site.git', 'acme', 'site'],
    ['https://gitlab.empresa.com:8443/acme/site.git', 'acme', 'site'],
    // GitLab subgroups are real folders of the account.
    ['git@gitlab.com:grupo/time/projeto.git', 'grupo/time', 'projeto'],
    ['https://gitlab.com/grupo/time/projeto', 'grupo/time', 'projeto'],
    // Azure DevOps puts routing in the path.
    ['https://dev.azure.com/org/proj/_git/repo', 'org', 'repo'],
    ['https://org@dev.azure.com/org/proj/_git/repo', 'org', 'repo'],
    ['git@ssh.dev.azure.com:v3/org/proj/repo', 'org', 'repo'],
    ['org@vs-ssh.visualstudio.com:v3/org/proj/repo', 'org', 'repo'],
    ['https://org.visualstudio.com/proj/_git/repo', 'org', 'repo'],
    ['https://org.visualstudio.com/DefaultCollection/proj/_git/repo', 'org', 'repo'],
    // So does Bitbucket Server.
    ['https://bitbucket.empresa.com/scm/PROJ/repo.git', 'PROJ', 'repo'],
    // An account that happens to be called scm is still an account.
    ['https://github.com/scm/repo.git', 'scm', 'repo']
  ])('%s', (url, owner, name) => {
    expect(parseRemoteUrl(url)).toMatchObject({ owner, name })
  })

  it.each(['', 'C:\\repos\\site.git', '/srv/git/site.git', 'file:///srv/git/acme/site.git', 'https://github.com/site'])(
    'finds no owner in %j',
    (url) => {
      expect(parseRemoteUrl(url)).toBeNull()
    }
  )
})

describe('ownerFolders', () => {
  it('splits subgroups into folders', () => {
    expect(ownerFolders('grupo/time')).toEqual(['grupo', 'time'])
  })

  it.each(['', '..', '../../fora', 'a/../b', 'a:b', 'a\\b', 'fim.', 'fim '])('refuses %j', (owner) => {
    expect(ownerFolders(owner)).toBeNull()
  })
})
