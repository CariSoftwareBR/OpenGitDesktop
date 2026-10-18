# Skill: creating a pull request

Use when the user asks to create or open a pull request.

1. Look at the branch first: current branch and status in the repository context, `list_commits` for its recent commits, `read_changes` if there are uncommitted changes. Do not guess.
2. Write the title and body from what you found — never a generic placeholder.
3. Target branch: `list_branches`. Only one other branch → use it, do not ask. Several plausible targets (e.g. `main` and `develop`) → ask which one.
4. The current branch is the target branch → do not call `create_pull_request`. Say a feature branch is needed and offer `create_branch`.
5. GitHub needs the branch committed and pushed. In this order, one tool per response:
   - Uncommitted changes → `commit`.
   - Then `push`. It is always safe: its preview says when there is nothing to send. There is no "check if pushed" tool — just call `push`.
   - Then `create_pull_request`.
6. Once you have the title, body and target, call `create_pull_request` in that same response. Do not ask "should I proceed?" — the approval card is the confirmation.
7. When the user answers your target-branch question, your reply must include the next tool call (`commit`, `push` or `create_pull_request`). Never write "I'll create the PR now" and stop.
