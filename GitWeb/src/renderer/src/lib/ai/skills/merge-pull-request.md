# Skill: merging a pull request

Follow these steps, in order, whenever the user asks you to merge a pull request.

1. **Identify the PR.** If the user gave a number, use it. Otherwise call `list_pull_requests` to find the right one (e.g. the one from the current branch).
2. **Read it first with `read_pull_request` before merging** — don't merge blind. Check:
   - It's actually open (not already merged or closed).
   - It isn't a draft. If it is, tell the user it needs to be marked "ready for review" first — there's no tool for that, so it's a manual step for them on GitHub.
   - Skim the comments for anything that reads like an unresolved objection ("change this first", "I don't agree", etc.). If you see one, point it out to the user before merging rather than merging over it silently.
3. **Pick the merge method.** Default to `merge` unless the user said otherwise or the conversation already established a convention (squash/rebase). Don't ask unless it's genuinely unclear.
4. Once the PR checks out, call `merge_pull_request` right away in that same response — same rule as always: don't write "I'll merge it now" and stop without attaching the tool call. This tool already shows an irreversible-action approval card, so no extra confirmation question is needed.
