# Skill: everyday Git workflow (commit, push, pull, branches, stash)

Follow these rules whenever the user asks to commit, push, pull, create or switch branches, stash, or fix their Git identity.

1. **Look before acting.** Start from the repository context you already have (branch, upstream ahead/behind, status). Call `read_changes` when you need the actual diff — never describe changes you haven't seen. `read_changes` does **not** show new untracked files (`??` in the status): before committing, open each of them with `read_file`.
2. **Committing (`commit`).** The tool writes the message itself, in the app's configured language — don't draft a message or promise a specific format.
   - If nothing is staged, `commit` stages *everything* pending. When the pending changes clearly mix unrelated work (e.g. a feature plus an unrelated config tweak), say so and suggest the user stage one group at a time in the Changes tab. If it's one logical change, go ahead.
   - If the diff looks like it contains a secret (`.env` content, private keys, API tokens, passwords), stop before committing: name the file path, never repeat the value, and ask the user how to proceed.
   - If there are unresolved merge conflicts, follow the merge-branch skill instead.
   - If the commit fails with "Author identity unknown" / "Please tell me who you are", call `get_git_identity`, then offer `set_git_identity` (ask local vs. global if the user didn't say).
3. **Default branch.** When about to commit or push straight to `main`/`master`, mention it once and offer `create_branch` for a topic branch. If the user confirms they want the default branch, proceed — don't ask again.
4. **Before `push`.** If the context shows the branch is behind its upstream, or you're not sure, call `check_incoming_commits`. If there are incoming commits, call `pull` first, then `push`. A rejected (non-fast-forward) push means pull and integrate. There is no force-push tool — never present one as an option, not even as a manual command; if the user insists on rewriting remote history, explain why it's risky on shared branches and that it stays outside this chat.
5. **Pulling (`pull`).** With uncommitted changes that could collide, suggest `stash` (or `commit`) first. If the pull ends in conflicts, follow the merge-branch skill.
6. **Branches.** Name new branches with a prefix matching the intent — `feature/`, `fix/`, `refactor/`, `docs/`, `hotfix/` — lowercase, words separated by `-` (e.g. `feature/pr-wizard`). Before `switch_branch` with uncommitted changes, offer `stash` first and mention `stash_pop` brings them back later.
7. **No history rewriting.** There are no tools for amend, rebase, revert, tags, or force push, and you don't teach those commands as a manual step. The one exception is `undo_last_commit`, which undoes the last commit not yet pushed.
8. **Report honestly.** A failed commit, rejected push, or pull with conflicts is not success — say what happened and what the next step is.
