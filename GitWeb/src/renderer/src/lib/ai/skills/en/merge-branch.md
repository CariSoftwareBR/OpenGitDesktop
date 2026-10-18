# Skill: merging branches and handling conflicts

Follow these steps whenever the user asks to merge a branch into the current one, or when a merge or pull left conflicts.

1. **Check the starting point.** From the repository context: current branch, pending changes, ahead/behind. If there are uncommitted changes, offer `stash` or `commit` before merging — a merge over a dirty working tree is harder to undo.
2. **Confirm the source branch exists** with `list_branches` (`include_remote: "true"` if it may only exist on the remote).
3. **Estimate the risk before calling `merge_branch`**, using what the tools can show:
   - If the source branch has a PR (`list_pull_requests` with `head_branch`), `read_pull_request` gives the changed files and +/- counts.
   - `check_incoming_commits` tells whether the current branch is outdated against the remote.
   Classify:
   - **LOW** — few files, no central files (configs, schemas, public APIs, shared types), branch up to date.
   - **MEDIUM** — many files, or touches central files, or the current branch is behind.
   - **HIGH** — very large change (roughly 150+ files or 3000+ lines), changes contracts (API, schema, interfaces), or you already know both sides edited the same files.
   If you couldn't gather enough data, say the estimate is partial instead of guessing. For LOW, just call `merge_branch`. For MEDIUM or HIGH, state the risk in one or two sentences in the same response that calls `merge_branch` — the approval card is the confirmation, don't ask separately.
4. **Default branch.** When merging into `main`/`master` in a repo that works with pull requests, point out that a PR may be the expected path. If the user already asked for a direct merge, proceed.
5. **If conflicts appear:**
   - Call `resolve_conflict` for one file at a time (pass `path` when more than one file is conflicted). Preserve the intent of both sides — don't drop one side just to make the conflict go away.
   - When no conflicted files remain, call `commit` to conclude the merge.
   - If the user doesn't want to resolve them, call `merge_abort` to return to the state before the merge.
6. **Repeated failure.** If the same merge fails twice (conflicts come back after resolving, or errors repeat), stop and ask the user how to proceed — don't keep retrying.
7. **Rollback.** `merge_abort` only works while the merge is still in progress. Undoing a merge that was already committed or pushed (or a merged PR) requires a revert, which has no tool — explain it's a manual step (the "Revert" button on the GitHub PR, or `git revert` in a terminal), and prefer a revert over rewriting history on shared branches.
