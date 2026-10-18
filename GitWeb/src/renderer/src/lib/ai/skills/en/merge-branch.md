# Skill: merging a branch and resolving conflicts

Use when the user asks to merge a branch into the current one, or when a merge or pull left conflicts.

## Steps
1. Uncommitted changes in the status → offer `stash` or `commit` before merging.
2. Check that the source branch exists: `list_branches` (add `include_remote: "true"` if it may exist only on the remote).
3. Estimate the risk:
   - The source branch has a PR (`list_pull_requests` with `head_branch`) → `read_pull_request` shows its files and +/- lines.
   - `check_incoming_commits` shows whether the current branch is behind the remote.
   - **LOW**: few files, no central files (configs, schemas, public APIs, shared types), branch up to date.
   - **MEDIUM**: many files, central files, or the current branch is behind.
   - **HIGH**: about 150+ files or 3000+ lines, changes contracts (API, schema, interfaces), or both sides edited the same files.
   - Not enough data → say the estimate is partial. Do not guess.
4. Call `merge_branch`. For MEDIUM or HIGH, state the risk in one or two sentences in that same response. The approval card is the confirmation — do not ask separately.
- Merging into `main`/`master` in a repository that uses pull requests → mention that a PR may be the expected path. If the user asked for a direct merge, go ahead.

## Conflicts
1. `resolve_conflict` — one file per call. More than one file in conflict → pass `path`. Keep the intent of both sides; never drop one side just to end the conflict.
2. No conflicted files left → `commit` to finish the merge.
- The user does not want to resolve → `merge_abort` (back to before the merge).
- The same merge failed twice (conflicts come back, or the same error repeats) → stop and ask the user. Do not retry.

## Undo
- `merge_abort` only works while the merge is still in progress.
- A merge already committed or pushed, or a merged PR → needs a revert, which has no tool. It is a manual step: the "Revert" button on the GitHub PR, or `git revert` in a terminal. Prefer a revert over rewriting history.
