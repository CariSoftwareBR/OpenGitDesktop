---
target: ChangesView
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-03T03-50-25Z
slug: gitweb-src-renderer-src-views-changesview-tsx
closed: true
---
# Critique: GitWeb ChangesView

**Target:** `GitWeb/src/renderer/src/views/ChangesView.tsx`
**Mode:** Operate · daily stage → message → commit
**Method:** dual-agent (A: abce52dc-c51b-49c8-9e10-2721e00246ec · B: d277a4fb-2b02-4b45-85ce-b62002ebe2f7)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Commit/AI/bulk + justCommitted solid; commit+push progress and select-file loading opaque |
| 2 | Match System / Real World | 2 | EN section labels (Staged/Changes/Stage all) vs PT body copy |
| 3 | User Control and Freedom | 3 | Unstage, Abort confirm, Esc on ConfirmDialog; no filter clear; discard irreversible |
| 4 | Consistency and Standards | 2 | EN TopBar vs PT helpers; listbox rows nest checkboxes/buttons; AgentTrader tokens on GitWeb |
| 5 | Error Prevention | 3 | Commit gated; discard/abort confirm; commitAndPush upgrades risk without second confirm; danger autofocus |
| 6 | Recognition Rather Than Recall | 2 | Shortcut strip omits Ctrl+Shift+U; Discard + AI icon-only; status via color/icon |
| 7 | Flexibility and Efficiency | 3 | ↑↓/Space, Ctrl+Enter, Stage/Unstage all; no multi-select subset beyond filtered-all |
| 8 | Aesthetic and Minimalist Design | 2 | Always-on captions + shortcut primer + decorative UserCircle2 dilute commit CTA |
| 9 | Error Recovery | 2 | AI alert + Fechar good; Git failures mostly App banner with little in-view recovery |
| 10 | Help and Documentation | 2 | Inline captions help once; incomplete shortcuts; no path to AI settings on generate fail |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** Competent GitHub-Desktop-style workbench (340px file rail + diff, Staged/Changes split, checkbox stage, commit footer) that transfers almost unchanged to Fork/Sourcetree. Structural sameness fits Operate-mode Git, but almost nothing says GitWeb: no brand signal, supervised AI reduced to a Sparkles icon, and visual tokens still speak borrowed “command console” / AgentTrader language (`command-blue`, `shadow-command-glow`, phantom `calibre`). Strongest product character is PT workflow copy—and it collides with English chrome. Coherent dark IDE panel; interchangeable as a product.

**Deterministic scan:** CLI detector clean for ChangesView.tsx and full `GitWeb/src/renderer` (exit 0, 0 findings). Detector did not surface behavioral gaps (commit+push guardrails, ConfirmDialog autofocus, EN/PT split).

**Visual overlays:** Not available. Mutation preflight set `document.title` but CSP `script-src 'self'` blocked inline script execution and `http://localhost:8400/detect.js` injection. Electron `window.api` undefined in plain browser → App error before ChangesView rendered. No impeccable overlays or console findings claimed.

## Overall Impression

Solid Operate Git surface with conflict elevation and a strong commit-success peak—undermined by bilingual IA drift, instructional noise that never leaves, and commit+push that silently raises stakes. Biggest opportunity: one locale + treat remote publish like the discard/abort guards, then pin the commit composer so the daily action owns the viewport.

## What's Working

1. **Conflict treatment** — Amber soft panel, count pill, plain PT guidance, and confirmed Abortar merge make the scariest Git state scannable.
2. **Commit success peak** — Spinner → green Check + live region (`Commit criado…` / `…e enviado…`) closes the happy path well.
3. **Operate accelerators** — List nav, Space stage, Ctrl+Enter commit, Stage/Unstage all — power path exists without burying the mouse path.

## Priority Issues

### [P1] EN/PT label split on the primary IA
- **Why it matters:** First-timers and PT-primary users mistranslate Staged vs Changes; surface feels unfinished.
- **Fix:** Localize section titles and bulk actions to match body copy, or fully English the PT strings—one locale for the surface.
- **Suggested command:** `/impeccable clarify`

### [P1] Commit+push is high-stakes without matching guardrails
- **Why it matters:** Same click that was local now mutates remote; easy to miss if Settings was toggled earlier.
- **Fix:** When push is enabled, require confirm or a sticky “will publish” note + optional local-only path.
- **Suggested command:** `/impeccable harden`

### [P1] Destructive ConfirmDialog autofocuses Confirm
- **Why it matters:** Enter after open can destroy work—opposite of discard/abort reassurance.
- **Fix:** Focus Cancel by default on danger; Esc = cancel; add focus trap.
- **Suggested command:** `/impeccable audit`

### [P2] Always-on instructional noise + incomplete shortcuts
- **Why it matters:** Extraneous load every session; strip lists Ctrl+Shift+S but omits implemented Ctrl+Shift+U.
- **Fix:** Collapse helpers behind first-run/disclosure; complete or remove primer; full cheatsheet in Settings.
- **Suggested command:** `/impeccable distill`

### [P2] Flat hierarchy / generic Git-GUI silhouette
- **Why it matters:** Commit CTA doesn’t own the viewport; AI differentiator is a 14px icon; category-interchangeable.
- **Fix:** Pin commit composer; raise CTA weight; replace orphan UserCircle2; labeled AI compose when staged > 0.
- **Suggested command:** `/impeccable layout`

## Persona Red Flags

**Alex (Power User):** Accelerators exist, but shortcut strip lies by omission (Ctrl+Shift+U missing); no multi-select subset staging; danger dialog focusing Confirm slows discard muscle memory.

**Jordan (First-Timer):** English `Staged`/`Changes`/`Stage all` with PT explanations; RotateCcw discard looks like undo until hover; Sparkles AI unlabeled; UserCircle2 implies identity that isn’t there.

**Sam (Accessibility):** `role="listbox"` with nested checkbox + row button + discard breaks option semantics; status icon/color only (`aria-hidden`); ConfirmDialog focuses destructive action and lacks focus trap; DiffViewer lacks landmarks.

## Minor Observations

- Duplicate empty copy between ChangesView and DiffViewer.
- Filter has no clear control; filtered-empty doesn’t say “no matches.”
- Fixed 340px sidebar—no resize.
- `calibre` in tokens; only Inter ships.
- AI generate overwrites summary with no undo/preview.
- Diff unified only—no hunk chrome / path title in right pane.
- DESIGN.md still documents AgentTrader, not GitWeb (context drift).

## Questions to Consider

1. If GitWeb’s claim is “GUI + supervised AI,” why is AI commit compose a 14px sparkle instead of a labeled step?
2. Should the left rail be a commit composer that owns staging, or a file browser that happens to commit?
3. What would make this pane un-swappable with GitHub Desktop in five seconds?
4. Is bilingual chrome intentional, or which locale is the source of truth?
5. When commitAndPush is on, should the UI refuse to look like the low-stakes local button?
