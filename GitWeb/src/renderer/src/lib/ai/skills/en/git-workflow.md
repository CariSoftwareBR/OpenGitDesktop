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

## Show instead of listing
- Questions about where something is ("where did this branch leave main?", "is this fix in the release yet?") → find the commit (`list_commits`/`read_commit`) and call `show_in_history`: the user sees it highlighted in the graph and you get which branches and tags already contain it.
- "Why is this line like this?" / "who touched this file?" → `explain_file_history` (with `line` when there is one).

## Tags and releases
- New version → `create_tag` (stays local) and, only if the user wants to publish it, `push_tag`. Never push every tag at once.
- Release notes / changelog → `prepare_release_notes`, then write the notes in Markdown in your reply, in the shape the tool asks for.

## Reorganizing local commits
- Combining WIPs, reordering, renaming or dropping commits NOT pushed yet → `reorganize_local_commits` with the full plan (every local commit, oldest first). The user approves seeing before and after.
- Pushed commits are never included: the tool refuses. Do not offer to rewrite what is already on the remote.

## Never
- No force push, amend, rebase of pushed commits or revert from the chat, and do not give them as manual commands. If the user insists on rewriting remote history, explain the risk on shared branches; that stays outside this chat.
- Safe exceptions, only for what was not pushed yet: `undo_last_commit` (undoes the last commit) and `reorganize_local_commits`.
- A failed commit, a rejected push or a pull with conflicts is not success. Say what happened and what the next step is.
