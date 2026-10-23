import { usePullRequestStore } from '../store/pullRequestStore'
import type { BranchRules } from '../../../shared/github'
import { pushTargetBranch, type RepoStatus } from '../../../shared/git'

// Rules change rarely and every commit asks, so one read per branch is reused
// for a few minutes instead of costing three GitHub calls per click. A failed
// read is remembered too, briefly: the Changes view and the store both ask for
// the same commit, and offline that must not mean waiting twice.
const TTL_MS = 5 * 60_000
const FAILURE_TTL_MS = 60_000
const cache = new Map<string, { block: BranchRules | null; at: number; ttl: number }>()

/**
 * The rules that keep a push from here out of its target branch — a pull
 * request or status checks — or null when the push would be taken. Also null
 * whenever that cannot be known (no GitHub remote, signed out, offline):
 * GitHub still has the final word at push time, so an unknown must never stop
 * a commit.
 */
export async function directPushBlock(
  status: Pick<RepoStatus, 'branch' | 'upstream'> | null
): Promise<{ branch: string; rules: BranchRules } | null> {
  const branch = status ? pushTargetBranch(status) : null
  const { remote, user } = usePullRequestStore.getState()
  if (!branch || !remote || !user) return null

  const key = `${remote.host}/${remote.owner}/${remote.repo}#${branch}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.block && { branch, rules: hit.block }

  try {
    const rules = await window.api.github.getBranchRules(remote.host, remote.owner, remote.repo, branch)
    // A fresh commit has no passing checks yet, so required checks reject a
    // direct push just as surely as a pull-request rule does.
    const block = rules.requiresPullRequest || (rules.requiredChecks?.length ?? 0) > 0 ? rules : null
    // Nothing found because nothing could be read is not "unprotected".
    const unknown = !block && rules.requiredChecks === null
    cache.set(key, { block, at: Date.now(), ttl: unknown ? FAILURE_TTL_MS : TTL_MS })
    return block && { branch, rules: block }
  } catch {
    cache.set(key, { block: null, at: Date.now(), ttl: FAILURE_TTL_MS })
    return null
  }
}
