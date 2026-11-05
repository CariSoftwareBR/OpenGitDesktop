export interface ParsedRemote {
  host: string
  owner: string
  name: string
}

/**
 * The account behind a remote path. Hosts that put routing in the path get it
 * removed, since the owner decides real folders on disk:
 *   Azure DevOps  org/proj/_git/repo, v3/org/proj/repo → org
 *   Bitbucket Server  scm/PROJ/repo → PROJ
 * Anything else keeps the whole path, so GitLab subgroups stay `a/b`.
 */
function ownerOf(host: string, segments: string[]): string {
  const hostname = host.toLowerCase().split(':')[0]
  const isVisualStudio = hostname.endsWith('.visualstudio.com')
  const isAzure = hostname === 'dev.azure.com' || hostname.endsWith('.dev.azure.com') || isVisualStudio
  if (isAzure) {
    if (segments[0] === 'v3' && segments.length >= 3) return segments[1]
    // org.visualstudio.com/[DefaultCollection/]proj/_git/repo has the org in the host.
    if (isVisualStudio) return hostname.split('.')[0]
    return segments[0]
  }
  const path = segments.slice(0, -1)
  if (path[0] === 'scm' && path.length >= 2) return path.slice(1).join('/')
  return path.join('/')
}

function parsedRemote(host: string, path: string): ParsedRemote | null {
  const segments = path.replace(/\.git\/?$/, '').split('/').filter(Boolean)
  if (segments.length < 2) return null
  return { host, owner: ownerOf(host, segments), name: segments[segments.length - 1] }
}

/** Any host, unlike parseGitHubRemote. */
export function parseRemoteUrl(raw: string): ParsedRemote | null {
  const url = raw.trim()
  if (!url) return null
  // scp-like (git@host:owner/repo). A URL with a scheme goes to the URL parser,
  // which is what tells a port from the first path segment.
  const scp = /^[\w.-]+@([^:/\s]+)[:/](.+)$/.exec(url)
  if (scp) return parsedRemote(scp[1], scp[2])
  try {
    const parsed = new URL(url)
    if (!/^(https?|git|ssh|git\+ssh):$/.test(parsed.protocol)) return null
    return parsedRemote(parsed.host, parsed.pathname)
  } catch {
    return null
  }
}

// Owners come from a URL anyone can write, so `git@host:../../x/repo` must not
// become a path that climbs out of the base folder. GitLab subgroups (`a/b`)
// are legitimate and become nested folders.
export function ownerFolders(owner: string): string[] | null {
  const segments = owner.split('/').filter(Boolean)
  if (segments.length === 0) return null
  // A trailing dot also covers `.` and `..`; Windows strips trailing dots and spaces.
  const safe = segments.every((segment) => !/[<>:"|?*\\\x00-\x1f]|[. ]$/.test(segment))
  return safe ? segments : null
}
