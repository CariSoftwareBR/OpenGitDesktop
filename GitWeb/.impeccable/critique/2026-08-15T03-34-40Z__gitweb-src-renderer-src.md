---
target: GitWeb renderer UI
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-15T03-34-40Z
slug: gitweb-src-renderer-src
---
Method: dual-agent (A: ac73c20b-0d6f-4c51-bfae-4950873ae698 · B: d6c18481-022d-4f70-9d0a-b12c5fa7b774)

# Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Sync/ahead excellent; Commit disabled does not say remaining requirement once files are staged |
| 2 | Match System / Real World | 2 | Portuguese Git copy, then History dates via toLocaleString() and untranslated Pop |
| 3 | User Control and Freedom | 3 | Esc/cancel on ConfirmDialog; merge PR and stash Pop have no confirm |
| 4 | Consistency and Standards | 2 | Workbench vs document pages; AI settings split between chat and Settings |
| 5 | Error Prevention | 2 | Discard/abort/drop gated; merge, close PR, and Pop are one click; danger dialogs focus Confirm |
| 6 | Recognition Rather Than Recall | 2 | Settings/AI/About icon-only in TopBar; shortcuts behind CircleHelp |
| 7 | Flexibility and Efficiency | 2 | Few accelerators; no command palette or multi-select; new branch is window.prompt |
| 8 | Aesthetic and Minimalist Design | 2 | Tokens are quiet; equal-weight header cards and default AI column crowd the daily path |
| 9 | Error Recovery | 3 | Portuguese banners and AI retry; irreversible discard not recoverable in-app |
| 10 | Help and Documentation | 2 | Stash help and section hints; no task help in About; AI teacher needs a configured model |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

**Start here.** Partially authored for GitWeb, still category-interchangeable as a GitHub Desktop descendant.

**LLM assessment:** The token system (midnight/obsidian/coal, Command Blue, Action Surface pills) is real. The Sync card, conflict banner, discard confirms, and supervised AI approval gates are product-specific. Chrome, home tiles, Settings cards, History empty state, and a default AI column could serve an unrelated Electron tool unchanged.

**Deterministic scan:** CLI detector exit 0, 0 findings, not degraded. No antipatterns in `GitWeb/src/renderer/src`. The scan does not contradict the specificity verdict; it only says the implementation is clean of the detector's slop rules.

**Visual overlays:** No overlay. CSP `script-src 'self'` / `connect-src 'self'` blocked `detect.js` from the live server (port 8400). Mutation preflight succeeded; script execution did not. Fallback: CLI-only evidence.

## Overall Impression

A competent dark Git workbench with an honest AI-approval contract, but the daily changes → diff → commit path is not the visual protagonist. Chrome and a default AI column tax every view. High-stakes actions are uneven: discard is careful, merge and Pop are not.

## What's Working

1. **TopBar Sync card** — one control that changes meaning (fetch / publish / pull N / push N) with count. Git-client design, not admin chrome.
2. **Supervised AI as a contract** — empty-state copy, pending chip, severity-coded approval. The product's distinctive idea is visible.
3. **Operational color + Portuguese confirms** — conflict strip and danger copy treat Git as irreversible on purpose. Detector found no gradient-text or token slop.

## Priority Issues

**[P1] The daily path is not the visual protagonist**
- **Why it matters:** Operators cannot feel the workbench. Empty diff/history monuments and a docked AI column become louder than commit.
- **Fix:** Auto-select the first dirty file; keep AI collapsed until summoned; make Commit the strongest object in the left column and state why it is disabled.
- **Suggested command:** `/impeccable layout`

**[P1] Chrome overload and orphaned Settings**
- **Why it matters:** Every view pays a tax before the task. Settings is not a tab, so location is ambiguous.
- **Fix:** One status line (repo · branch · sync); labeled tabs that include or indicate Settings; demote About; remove Settings from the home tile row.
- **Suggested command:** `/impeccable distill`

**[P1] High-stakes actions are inconsistent**
- **Why it matters:** Trust is the product. Unconfirmed merge trains users to click through dialogs that do exist. Danger confirms focus the destructive button.
- **Fix:** Same ConfirmDialog for merge/close/pop; focus Cancel when danger; replace window.prompt with an in-app field.
- **Suggested command:** `/impeccable harden`

**[P2] Split AI settings**
- **Why it matters:** Two setup walls. Configuring AI feels bolted on.
- **Fix:** One AI section in Settings; chat header only links there.
- **Suggested command:** `/impeccable shape`

**[P2] Labels fight the domain**
- **Why it matters:** Unstaged header "Alterações" vs tab "Alterações"; stash "Pop"; History timestamps not pt-BR; Explorar bug uses chip-danger.
- **Fix:** Rename unstaged; Portuguese for Pop; locale dates; chip-command for Explorar bug.
- **Suggested command:** `/impeccable clarify`

## Persona Red Flags

**Alex (power Git user):** No command palette; no multi-select; Nova branch is window.prompt; default AI column steals diff width; Explorar bug looks destructive.

**Jordan (first Git-GUI user):** Five equal home tiles; icon-only Settings/AI/About; disabled Commit with coaching only when nothing is staged; discard is rotate-ccw icon; Pop/origin/PAT jargon.

**Sam (keyboard/SR):** ConfirmDialog focuses the destructive button; SectionHint tooltips stay in the a11y tree at opacity 0; file status is icon+color without a letter; Settings is aria-pressed on an icon while Git tabs keep labels.

## Minor Observations

- Recentes list is wider than the InitialView brand row.
- Diff has no line numbers or split view.
- AboutView replaces the entire shell and drops repo context.
- Cognitive load: 6/8 checklist failures (high).
- Resize separators are keyboard-operable — keep them.

## Questions to Consider

- If the AI cannot speak until summoned, does GitWeb become a Git client again?
- What if opening a repo always landed on a filled diff and a live commit composer?
- Why is discarding a file harder than merging a pull request?
