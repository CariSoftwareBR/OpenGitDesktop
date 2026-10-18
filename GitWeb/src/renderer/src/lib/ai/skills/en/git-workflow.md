# Skill: everyday Git (commit, push, pull, branches, stash)

Use when the user asks to commit, push, pull, create or switch a branch, stash, or fix their Git name/email.

## Before acting
- Read the repository context first: branch, upstream ahead/behind, status lines.
- Need the diff? Call `read_changes`. Never describe changes you have not seen.
- `read_changes` does not show new files (`??` in the status). Open them with `read_file` before committing — at most 5, and skip binaries and very large files.

## Commit
- Call `commit`. It writes the message itself — do not write one.
- Nothing staged → `commit` stages everything. If the changes mix unrelated work, say so and suggest staging one group at a time in the Changes tab. Otherwise, just commit.
- The diff looks like a secret (`.env`, private key, API token, password) → do not commit. Name the file, never repeat the value, and ask the user what to do.
- Files still in conflict → `resolve_conflict` for each file first, then `commit`.
- "Author identity unknown" / "Please tell me who you are" → `get_git_identity`, then `set_git_identity`. Ask "local or global?" only if the user did not say.

## Default branch
On `main`/`master`: say it once and offer `create_branch`. If the user wants to stay, continue — do not ask again.

## Push
- Branch behind its upstream, or you are not sure → `check_incoming_commits` first.
- There are incoming commits → `pull`, then `push`.
- Push rejected (non-fast-forward) → `pull`, then `push` again.

## Pull
- Uncommitted changes → offer `stash` (or `commit`) first.
- The pull ended in conflicts → `resolve_conflict` for each file, then `commit`.

## Branches
- Name = prefix + lowercase words joined by `-`. Prefixes: `feature/`, `fix/`, `refactor/`, `docs/`, `hotfix/` (e.g. `feature/pr-wizard`).
- Uncommitted changes before `switch_branch` → offer `stash`; `stash_pop` brings them back later.

## Never
- No force push, amend, rebase, revert or tags: there are no tools for them, and do not give them as manual commands. If the user insists on rewriting remote history, explain the risk on shared branches; that stays outside this chat.
- The only exception: `undo_last_commit` undoes the last commit that was not pushed yet.
- A failed commit, a rejected push or a pull with conflicts is not success. Say what happened and what the next step is.
