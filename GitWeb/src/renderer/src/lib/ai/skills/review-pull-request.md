# Skill: reviewing/evaluating a pull request

Follow these steps whenever the user asks you to review, evaluate, or judge the quality of a pull request (e.g. "is this PR good?", "any problems with this PR?", "review this PR").

1. **Identify the PR** (number given, or find it via `list_pull_requests`).
2. **Call `read_pull_request` with `include_diffs: "true"`** — you cannot judge code quality from file names and +/- counts alone. Also include comments, since prior review feedback is relevant context.
3. **Write the review as plain text in your reply** — this is advisory, read-only analysis, not an action, so no tool call is needed to "submit" it. Cover, in this order:
   - A short summary of what the PR does.
   - What's done well.
   - Concrete issues found in the diff — bugs, edge cases, security concerns, inconsistency with the rest of the codebase. Reference the actual file/lines you saw in the diff, not generic advice. If you found nothing concerning, say so plainly instead of inventing a problem.
   - Optional, non-blocking suggestions for improvement.
   Reply in the same language the conversation has been using.
4. **Never paste the diff (or large chunks of code) back into your reply.** You already have it from `read_pull_request` — describe each issue in your own words and point at the file (and line/function if you know it). A quote longer than one short line breaks the chat's layout and isn't more useful than a clear description.
5. Be honest about severity — don't soften a real bug into a minor suggestion, and don't inflate a style nitpick into a serious problem. If the PR looks fine, say it looks fine; don't manufacture issues to seem thorough.
6. This skill never merges or changes anything by itself — if the user then asks to merge, follow the merge-pull-request skill separately.
