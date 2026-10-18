# Skill: reviewing a pull request

Use when the user asks to review or evaluate a pull request ("is this PR good?", "any problems in this PR?").

1. Find the PR: the number the user gave, or `list_pull_requests`.
2. `read_pull_request` with `include_diffs: "true"`. File names and +/- counts are not enough to judge code. Comments are included by default — read them too.
3. Answer in text, in this order:
   - What the PR does (short).
   - What is done well.
   - Problems found in the diff: bugs, edge cases, security, inconsistency with the rest of the code. Name the file (and the line or function). Nothing wrong → say so; do not invent problems.
   - Optional, non-blocking suggestions.
4. Never paste the diff or code blocks back. Describe each problem in your own words; quote one short line at most.
5. Be honest about severity: a real bug is not a "suggestion", and a style nitpick is not a serious problem.
6. The review is text only. Post it on GitHub only if the user asks: `review_pull_request` (`APPROVE`, `REQUEST_CHANGES` or `COMMENT`; `body` is required for the last two) or `comment_pull_request`. GitHub does not let the user approve their own PR — use `COMMENT` then.
7. Do not merge from a review. If the user asks to merge, follow the merge steps.
