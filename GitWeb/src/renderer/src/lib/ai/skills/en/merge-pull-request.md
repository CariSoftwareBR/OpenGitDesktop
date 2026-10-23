# Skill: merging a pull request

Use when the user asks to merge a pull request.

1. Find the PR: the number the user gave, or `list_pull_requests` (e.g. with `head_branch` set to the current branch).
2. `read_pull_request` before merging. Check:
   - It is open. Already merged or closed → say so and stop.
   - It is not a draft (`[draft]` in the first line). Draft → tell the user to mark it "Ready for review" on GitHub; there is no tool for that.
   - Comments with an open objection ("change this first", "I don't agree") → point them out before merging.
3. Method: `merge`, unless the user asked for `squash` or `rebase`, or the conversation already uses one. Do not ask otherwise.
4. Call `merge_pull_request` in that same response. Its approval card already warns that it cannot be undone — no extra question. Never write "I'll merge it now" and stop.
5. Merge refused by branch protection (required reviews or checks), or the user asks whether the checks passed / whether the PR is "unblocked yet" → `check_pull_request_status`. Say what is still missing (a running check, a failed check, an approval). Only call `merge_pull_request` again once the state is `clean`, `unstable` or `has_hooks`.
