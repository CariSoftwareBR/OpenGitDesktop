# Skill: a file that should not have been committed

Use this skill when a commit brought in a file that shouldn't be in Git: a push rejected for a large file (GH001, "exceeds GitHub's file size limit of 100.00 MB", "Large files detected"), a database backup/dump, a generated binary or a secret (`.env`, key, token). Fix it yourself with your tools, until the `push` goes through.

**If the prompt has a "Diagnosis verified by the app", it rules:** those are facts checked in the repository. Don't contradict or re-investigate them — your next action is the tool named in "Next step", attached in this same response, without asking in text.

## 1. Confirm where the file is
- Use `list_commits` and `read_commit` to find the commits that contain the file, and the repository context to see how many commits are ahead of the remote.
- Rejected push = nothing from that push reached the remote. If the file only shows up in the commits that are ahead, **there is no remote history to rewrite**.
- If the file is no longer on disk (deleted), the only copy lives in the commit. Tell the user before undoing that commit.

## 2. Fix it, one tool at a time
1. `undo_last_commit` — repeat until you are past the last commit that added the file. Changes go back to the stage, nothing is lost.
2. `ignore_files` with the file's path — unstages it and adds it to `.gitignore`; the file stays on disk.
3. `commit`.
4. `push`.

Before each tool, say in one sentence what it does and attach the call in that same response — the approval card is the yes/no question.

## 3. What not to do
- A new commit deleting the file does **not** fix it: push sends every commit, including the one that added the file.
- Don't suggest Git LFS for backups, dumps or generated binaries. Only if the user says the file really must live in the repository.
- Never `filter-branch`, `filter-repo`, BFG, `reset --hard` or force push — not even as a manual step.
- Never invent GitHub screens, menus or settings (there is no "remove large file" in repository settings).

## 4. If the file is already on the remote
`undo_last_commit` will refuse. Don't try to scrub remote history.
- **Secret:** say it must be treated as leaked and **revoked/rotated** at its source; then `ignore_files` + `commit` + `push` to stop tracking it. Never repeat the secret's value.
- **Large file the remote already accepted:** `ignore_files` + `commit` + `push` so it leaves future versions. Explain it stays in old history and removing it from there needs a history rewrite, which is outside this chat.
