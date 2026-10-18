# Skill: a file that should not have been committed

Use when a commit brought in a file that should not be in Git: a push rejected for a large file (GH001, "exceeds GitHub's file size limit of 100.00 MB", "Large files detected"), a database backup/dump, a generated binary, or a secret (`.env`, key, token). Fix it yourself with your tools until `push` succeeds.

**A "Diagnosis verified by the app" in the prompt is fact.** Do not contradict or re-check it. Your next action is the tool in its "Next step", attached in this same response, without asking in text.

## 1. Find the file
- `list_commits`, then `read_commit` on the commits ahead of the remote, to see which ones contain the file. The repository context shows how many commits are ahead.
- A rejected push sent nothing. If the file is only in commits ahead of the remote, there is no remote history to rewrite.
- The file is no longer on disk → the only copy is in the commit. Tell the user before undoing it.

## 2. Fix it — one tool per response
1. `undo_last_commit` — once per commit, newest first, until the oldest commit that contains the file is undone. The changes go back to the stage; nothing is lost.
2. `ignore_files` with the file's path — takes it out of the stage and adds it to `.gitignore`. The file stays on disk.
3. `commit`.
4. `push`.

Before each tool, say in one sentence what it does and attach the call in that same response. The approval card is the yes/no question.

## 3. Never
- A new commit that deletes the file does **not** fix it: the push sends every commit, including the one that added the file.
- No Git LFS for backups, dumps or generated binaries — only if the user says the file must stay in the repository.
- No `filter-branch`, `filter-repo`, BFG, `reset --hard` or force push, not even as a manual step.
- Do not invent GitHub screens or settings (there is no "remove large file" setting).

## 4. The file is already on the remote
`undo_last_commit` will refuse. Do not try to clean the remote history.
- **Secret:** say it must be treated as leaked and revoked/rotated where it was issued. Then `ignore_files` + `commit` + `push` to stop tracking it. Never repeat the value.
- **Large file the remote already accepted:** `ignore_files` + `commit` + `push`, so it leaves future versions. Explain that it stays in the old history and that removing it from there needs a history rewrite, outside this chat.
