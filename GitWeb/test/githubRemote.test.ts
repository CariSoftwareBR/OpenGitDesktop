import { describe, expect, it } from 'vitest'
import { apiBaseForHost, credentialKey, nextPageUrl, parseGitHubRemote } from '../src/shared/githubRemote'

describe('parseGitHubRemote', () => {
  it('parses https and ssh remotes', () => {
    expect(parseGitHubRemote('https://github.com/owner/repo.git')).toEqual({
      host: 'github.com',
      apiBase: 'https://api.github.com',
      owner: 'owner',
      repo: 'repo'
    })
    expect(parseGitHubRemote('git@github.com:owner/repo.git')?.repo).toBe('repo')
  })

  it('does not glue embedded credentials onto the host', () => {
    expect(parseGitHubRemote('https://user:tok@GitHub.com/o/r')?.host).toBe('github.com')
  })

  it('uses /api/v3 for enterprise hosts and a case-insensitive credential key', () => {
    expect(apiBaseForHost('ghe.example.com')).toBe('https://ghe.example.com/api/v3')
    expect(credentialKey('GitHub.com')).toBe(credentialKey('github.com'))
  })
})

describe('nextPageUrl', () => {
  it('returns the rel="next" link', () => {
    const link =
      '<https://api.github.com/user/repos?page=2>; rel="next", <https://api.github.com/user/repos?page=5>; rel="last"'
    expect(nextPageUrl(link)).toBe('https://api.github.com/user/repos?page=2')
  })

  it('returns null on the last page or without a header', () => {
    expect(nextPageUrl('<https://api.github.com/x?page=1>; rel="prev"')).toBeNull()
    expect(nextPageUrl(null)).toBeNull()
  })
})
