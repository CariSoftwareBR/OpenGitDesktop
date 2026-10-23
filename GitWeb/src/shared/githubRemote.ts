export interface RemoteInfo {
  host: string
  apiBase: string
  owner: string
  repo: string
}

// Supports:
//   https://github.com/owner/repo.git
//   https://github.enterprise.com/owner/repo
//   git@github.com:owner/repo.git
export function parseGitHubRemote(url: string): RemoteInfo | null {
  // `[^/@]+` for the host so `https://user:pass@host/o/r` can't be parsed with
  // the credentials glued onto the host — that would key the token store on a
  // host that doesn't exist, and silently break auth.
  const httpsMatch = url.match(/^https?:\/\/(?:[^/@]*@)?([^/@]+)\/([^/]+)\/(.+?)(\.git)?\/?$/)
  const sshMatch = url.match(/^git@([^:]+):([^/]+)\/(.+?)(\.git)?$/)
  const match = httpsMatch || sshMatch
  if (!match) return null

  const [, rawHost, owner, repo] = match
  // Hostnames are case-insensitive but the credential key is not, so normalize
  // here: `https://GitHub.com/...` must resolve to the same stored token as
  // `https://github.com/...`.
  const host = normalizeHost(rawHost)
  return { host, apiBase: apiBaseForHost(host), owner, repo }
}

function normalizeHost(host: string): string {
  return host.toLowerCase()
}

export function apiBaseForHost(host: string): string {
  return normalizeHost(host) === 'github.com' ? 'https://api.github.com' : `https://${normalizeHost(host)}/api/v3`
}

/** GraphQL lives beside REST on github.com but not under /api/v3 on Enterprise Server. */
export function graphqlUrlForHost(host: string): string {
  return normalizeHost(host) === 'github.com' ? 'https://api.github.com/graphql' : `https://${normalizeHost(host)}/api/graphql`
}

// Key used to persist a GitHub token (PAT or OAuth) via the secure credential
// store — shared so main (git CLI auth injection) and renderer (REST API
// login) always resolve the same secret for a given host.
export function credentialKey(host: string): string {
  return `GitWeb/GitHub/${normalizeHost(host)}`
}

/** The rel="next" target of a GitHub `Link` header, or null on the last page. */
export function nextPageUrl(link: string | null): string | null {
  if (!link) return null
  for (const part of link.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="?next"?/.exec(part)
    if (match) return match[1]
  }
  return null
}
