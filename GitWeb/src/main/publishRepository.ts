import { getRemoteUrl, pushBranch, readGit, runGit, throwOnFailure } from './gitProcess'
import { createRepository } from './githubApi'
import { getSettings } from './settings'
import { scanHistory } from './sensitiveScan'
import { tMain } from './i18n'
import { findingPaths } from '../shared/sensitiveFiles'
import { sanitizeRepositoryName, type PublishRepositoryInput, type PublishRepositoryResult } from '../shared/github'

const HOST = 'github.com'

/**
 * Creates the repository on GitHub, sets it as origin and pushes the current
 * branch with upstream. Everything that can be refused is checked before the
 * repository exists, so a refusal never leaves an empty repository behind;
 * only the push itself can fail afterwards, and its error says the
 * repository is already there and how to finish.
 */
export async function publishRepository(cwd: string, input: PublishRepositoryInput): Promise<PublishRepositoryResult> {
  const t = tMain().publish
  const name = sanitizeRepositoryName(input.name)
  if (!name || name === '.' || name === '..') throw new Error(t.invalidName)

  if (await getRemoteUrl(cwd)) throw new Error(t.hasRemote)
  if ((await readGit(['rev-parse', '-q', '--verify', 'HEAD'], cwd)).exitCode !== 0) throw new Error(t.noCommits)
  const branchResult = await readGit(['symbolic-ref', '--short', '-q', 'HEAD'], cwd)
  const branch = branchResult.stdout.trim()
  if (branchResult.exitCode !== 0 || !branch) throw new Error(t.noBranch)

  // Block mode holds here as it does for commits. Warn mode was already
  // asked in the dialog or the approval card.
  const settings = await getSettings()
  if (settings.sensitiveCheck && settings.sensitiveCheckMode === 'block') {
    const findings = await scanHistory(cwd)
    if (findings.length > 0) throw new Error(t.blocked(findingPaths(findings).join(', ')))
  }

  const repo = await createRepository(HOST, { owner: input.owner, name, description: input.description.trim(), private: input.private })
  throwOnFailure(await runGit(['remote', 'add', 'origin', repo.cloneUrl], cwd), ['remote', 'add', 'origin'])
  try {
    await pushBranch(cwd, branch, true)
  } catch (err) {
    const reason = (err instanceof Error ? err.message : String(err)).split('\n')[0].trim()
    throw new Error(t.pushFailed(repo.htmlUrl, reason.endsWith('.') ? reason : `${reason}.`))
  }
  return { fullName: repo.fullName, htmlUrl: repo.htmlUrl, branch }
}
