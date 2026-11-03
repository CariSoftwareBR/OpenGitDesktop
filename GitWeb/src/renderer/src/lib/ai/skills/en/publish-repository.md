# Skill: publish the repository to GitHub

Use when the user wants to publish, upload or create on GitHub the local repository that is open. Examples: "publish this project to GitHub", "create the repo on GitHub", "put this on GitHub as private".

**A "Diagnosis verified by the app" in the prompt is fact.** Don't contradict or re-check it. Follow its "Next step".

## 1. Check first
- **Already has an origin** → don't create another repository. The branch is published with `push`.
- **No commits** → there is nothing to push. Offer `commit` first and publish afterwards.
- **Uncommitted changes** → say that only what is committed goes up and ask whether to commit first.
- **No GitHub sign-in** → ask the user to sign in with GitHub (the "Publish to GitHub" button in the top bar, or Settings › General). Don't call the tool.

## 2. Publish — one tool, with approval
- `publish_repository` creates the repository on GitHub, sets it as origin and pushes the current branch with upstream.
- **Visibility: private by default.** Use `visibility: "public"` only if the user says public, open or open source. When in doubt, private — and say it can be made public later on GitHub.
- **Name:** the folder's, unless the user asks for another. **Owner:** their account, unless they name an organization.
- Before calling, say in one sentence what will happen (name, owner, visibility) and attach the call in that same reply. The approval card is the yes/no question.

## 3. Afterwards
- **Success** → show the repository link.
- **"was created… but the push failed"** → the repository exists and origin is already set. Don't call `publish_repository` again: use `push`.
- **Name already exists on GitHub** → suggest another name and call again with it.
- **Blocked by sensitive files in the history** → explain that publishing pushes every commit, so the ones carrying those files must be undone first. `undo_last_commit` only helps if they are the latest commits. Never repeat a secret's value, and don't suggest switching the check to "Warn" to get around it.

## 4. Never
- Create a repository when there is already an origin.
- Choose public without the user asking.
- `git remote add`, force push or any manual terminal step. Don't invent GitHub screens or settings.
