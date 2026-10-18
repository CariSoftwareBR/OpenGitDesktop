---
target: ChangesView
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-03T03-38-04Z
slug: gitweb-src-renderer-src-views-changesview-tsx
---
# Critique: GitWeb ChangesView

**Target:** `GitWeb/src/renderer/src/views/ChangesView.tsx`  
**Mode:** Operate · daily stage → message → commit  
**Method:** dual-agent

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loaders, bulk dimming, commit success solid; abort/busy and author/push state weak in-panel |
| 2 | Match System / Real World | 2 | PT/EN mix OK for Git users; “Working tree”, legacy token metaphor, unlabeled author slot |
| 3 | User Control and Freedom | 2 | Stage/unstage reversible; discard confirmed; abort merge has no exit guard / no undo |
| 4 | Consistency and Standards | 2 | borrowed token vocabulary on GitWeb; confirm vs no-confirm; English headers vs PT actions |
| 5 | Error Prevention | 2 | Discard confirm + disabled commit; abort unguarded; silent commit-and-push risk |
| 6 | Recognition Rather Than Recall | 3 | Lists/checkboxes/icons visible; discard + AI icon-only |
| 7 | Flexibility and Efficiency | 1 | Stage/Unstage all + filter; no keyboard shortcuts, no multi-select range, no hunk stage |
| 8 | Aesthetic and Minimalist Design | 3 | Dense, purposeful Operate layout; decorative UserCircle2; borrowed aesthetic |
| 9 | Error Recovery | 2 | App error banner; AI alert; discard irreversible after confirm |
| 10 | Help and Documentation | 1 | Tooltips/aria-label only; empty states don’t teach staging |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** Mostly category-interchangeable with a thin GitWeb veneer. Master–detail (lists + commit form | diff) matches GitHub Desktop / Fork / Sourcetree. Visual tokens still used trading-adjacent names (profit/risk) at critique time. Product-specific signals that do land: PT-BR operational copy mixed with English Git labels; optional AI compose as accelerant; conflict strip elevated before staging.

**Deterministic scan:** CLI detector clean for ChangesView, DiffViewer, ConflictResolver, and full renderer under default config (exit 0, 0 findings). With `--no-config`, one warning: `border-accent-on-rounded` at `TopBar.tsx:252` — false positive (`border-transparent` + `rounded-t-sm`; already has impeccable-disable-line). Detector did not surface the P0 abort-merge gap (behavioral, not visual antipattern).

**Visual overlays:** Not available. Playwright reached InitialView / crash only (`window.api` undefined). Mutation preflight worked; `detect.js` inject blocked by CSP (`script-src 'self'`). No in-page detector run; no overlays claimed.

## Overall Impression

Competent Operate Git client surface with a strong commit-success peak and a conflict-first strip that correctly interrupts the happy path — undermined by an unguarded Abort merge, power-user inefficiency, and empty states that don’t teach. Biggest opportunity: make destructive exits as careful as Discard, then give Alex accelerators and Jordan scaffolding without bloating the dock.

## What's Working

1. **Conflict-first elevation** — amber soft section + conflict rows before staged/unstaged correctly blocks the happy path with the blocking state.
2. **Commit dock feedback** — disabled until ready; “Commitando…”; morph to “Commit criado”; branch name on the primary CTA.
3. **Bulk stage/unstage honesty** — spinner + list opacity during bulk ops without a modal.

## Priority Issues

### [P0] Abortar merge has no confirmation
- **Why it matters:** More destructive than Discard (which warns). One misclick undoes merge work.
- **Fix:** In-app confirm matching discard severity; keep warning-tier styling.
- **Suggested command:** `/impeccable harden`

### [P1] Primary path has no keyboard accelerators
- **Why it matters:** Power users stage/commit dozens of times daily; checkbox-only is slow vs Desktop/CLI.
- **Fix:** Shortcuts for stage focused file, Stage all, Commit; arrow-key file list.
- **Suggested command:** `/impeccable shape` (interaction model) then `/impeccable harden`

### [P1] Empty / first-timer scaffolding missing
- **Why it matters:** “Working tree limpa.” / “Selecione um arquivo…” / English “Staged Changes” don’t teach staging or next step.
- **Fix:** Task-oriented empty states; gloss Git terms once in PT.
- **Suggested command:** `/impeccable onboard` + `/impeccable clarify`

### [P2] High-stakes UX uses browser confirm/alert; commit-and-push invisible
- **Why it matters:** Native dialogs break visual trust; push-after-commit can surprise when setting is on.
- **Fix:** In-app dialogs/toasts; reflect push intent on CTA (“Commit e push em {branch}”).
- **Suggested command:** `/impeccable harden` + `/impeccable clarify`

### [P2] A11y gaps on stage → commit path
- **Why it matters:** Orphan checkboxes; success state not announced to AT.
- **Fix:** aria-labelledby on checkboxes; aria-live on commit success/error.
- **Suggested command:** `/impeccable audit`

## Persona Red Flags

**Alex (Power User):** No shortcuts; no multi-select/range; no hunk staging. Abandonment risk high on repetitive commits.

**Jordan (First-Timer):** English stage labels without gloss; checkboxes don’t explain staging; Sparkles unclear; may type Resumo with zero staged and not understand disabled Commit.

**Sam (Accessibility):** Unnamed checkboxes beside path buttons; Abort reachable without confirm (motor slip); justCommitted visual-only. Focus ring exists globally — positive.

## Minor Observations

- Fixed 340px left column; HistoryView has resize — inconsistency.
- Truncated paths lack title tooltip on path buttons.
- Decorative UserCircle2 never shows Git author.
- Section labels English vs empty strings PT.
- DESIGN.md previously named another product — now owned by GitWeb.

## Questions to Consider

1. If Abort is more destructive than Discard, why is Discard the only action that asks “are you sure?”
2. Would the commit dock feel like *your* commit if it showed the Git author and whether this click will also push?
3. What would “one thing at a time” look like during conflicts — resolve first, then stage/commit — without losing power-user density on the happy path?
4. Is GitWeb willing to own a Git-native visual language, or will Operate UI forever speak a trading-adjacent profit/risk dialect?

## Cognitive Load

3 checklist failures (Single focus, One thing at a time, Minimal choices under conflict) → **moderate**. Conflicted tree exposes ≥5 concurrent top-level actions (Abort, Unstage all, Stage all, AI compose, Commit).
