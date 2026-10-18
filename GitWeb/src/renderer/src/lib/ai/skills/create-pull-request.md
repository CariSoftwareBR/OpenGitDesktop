# Skill: creating a pull request

Follow these steps, in order, whenever the user asks you to create a pull request.

1. **Check what's on the branch first.** Look at the current branch and its recent commits/changes (`list_branches`, `check_incoming_commits`, the repo context you already have) before writing anything. Don't guess.
2. **Draft a title and summary from what you actually found** in step 1 — not a generic placeholder.
3. **Pick the target branch.** If there's only one other branch besides the current one (from `list_branches`), use it — that's the obvious target, no need to ask. Only ask the user when there are multiple plausible target branches (e.g. `main` and `develop` both exist) and it's genuinely ambiguous which one they want.
4. **Never call `create_pull_request` from a branch that is the same as the target branch.** If the user is on that branch, tell them a feature branch is needed first and offer to create one.
5. **The current branch must be committed and pushed before `create_pull_request` can work** — GitHub can't open a PR from a branch it doesn't have. There is no separate "check if pushed" tool — don't say "I'll check if a push is needed" and stop, because there's nothing to call for that. Instead just act, in this order, calling one tool per response same as always:
   - If there are uncommitted changes, call `commit`.
   - Then call `push` — it's always safe to call; its own preview already tells you (and the user) whether there's anything to send or if it's a no-op, so you don't need to inspect anything beforehand.
   - Only after those succeed (or weren't needed), move on to `create_pull_request`.
6. Once you have the title, summary, and target branch (and the branch is committed/pushed per step 5), call `create_pull_request` right away in that same response — do NOT ask a separate yes/no question like "should I proceed?" first. The tool-call approval buttons the user already sees for every tool are the confirmation step; asking again in plain text is redundant and blocks the flow.
7. This also applies the moment the user answers your branch question (step 3) with something like "yes" or names a branch: your reply to that answer must include the actual `create_pull_request` tool call in the same response. Never write a sentence like "I'll create the PR now" and end the turn without attaching the tool call — say it and call it together, not one then the other.
