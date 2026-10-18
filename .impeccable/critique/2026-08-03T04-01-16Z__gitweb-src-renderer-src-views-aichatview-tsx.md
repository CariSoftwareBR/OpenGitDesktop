---
target: AiChatView
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-03T04-01-16Z
slug: gitweb-src-renderer-src-views-aichatview-tsx
---
Method: dual-agent (A: 23598536-f02f-4ff1-b973-140f7ee112aa · B: a516ad4a-82b5-42e5-959b-10be94d2d794)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Thinking/card status work; no pending-approval count or stop while busy |
| 2 | Match System / Real World | 3 | Git tool headlines strong; settings jargon (Temperatura, reasoning) + EN/PT mix |
| 3 | User Control and Freedom | 2 | Cancel on tools; no abort while thinking; clearChat wipes pending gates with no confirm |
| 4 | Consistency and Standards | 2 | Destructive merge still btn-primary "Aprovar"; TopBar EN vs chat PT; feedback ≠ card patterns |
| 5 | Error Prevention | 2 | Warnings help; same Approve for read vs irreversible merge; clear-chat hazard |
| 6 | Recognition Rather Than Recall | 3 | Previews surface args; no capability map; repo/branch only in TopBar |
| 7 | Flexibility and Efficiency | 2 | Enter-to-send only; no stop/retry/templates; expert settings always visible |
| 8 | Aesthetic and Minimalist Design | 3 | Calm density; settings knobs compete with approval task |
| 9 | Error Recovery | 2 | Dismissible error; no retry on failed tool/send; weak post-failure next step |
| 10 | Help and Documentation | 1 | One empty-state sentence; supervised-approval model never explained |
| **Total** | | **23/40** | **Acceptable** |

#### Design Specificity Verdict

**LLM assessment:** Hybrid — product core, interchangeable shell. The ToolCallCard + prepareToolCall spine (human-readable Git headlines, live fields, amber irreversible warnings, Portuguese Git verbs) is authored for GitWeb's supervised-AI promise. The surrounding chrome (Bot empty state, bubble transcript, Configurações/Limpar conversa, single-line composer, side SettingsPanel) is category-interchangeable LLM chat. Supervised Git approval is specific; the Operate frame around it still reads as generic chat bolted into a Git client.

**Deterministic scan:** `detect.mjs --json` on AiChatView.tsx (and related Combobox, Markdown, lib/ai) exited 0 with `[]` — zero rule findings. Detector did not catch under-signaled destructive approval, clear-chat hazard, cognitive load from settings, or missing supervision framing; those are judgment/UX issues outside the regex detector.

**Visual overlays:** No reliable user-visible overlay. Browser injection skipped — Electron/vite at localhost:5173 was down; Chromium Playwright cannot reach the Electron renderer DOM (`window.api` missing). Fallback: CLI-only clean scan.

#### Overall Impression

The product differentiator — explicit human gate before Git mutations — is implemented in code but emotionally and visually underplayed. Biggest opportunity: make the approval surface feel like a trust gate, not a chatbot "Approve" button next to ordinary bubbles.

#### What's Working

1. **ToolCallCard + prepareToolCall** — live, human-readable previews with contextual warnings (behind remotes, auto-stage, irreversible merge). This is the differentiator.
2. **Token-faithful Operate chrome** — coal/obsidian surfaces, Command Blue user bubbles, status border semantics without SaaS glow spam.
3. **Unconfigured path** — auto-opens SettingsPanel and disables composer; avoids silent broken send.

#### Priority Issues

1. **[P0] Destructive approval under-signaled**
   - **What:** Merge/push/commit-with-auto-stage use the same `btn-primary` "Aprovar" as harmless tools; danger never uses Danger Red.
   - **Why it matters:** Core promise is supervised mutation; false calm invites mis-approve.
   - **Fix:** Severity-tiered cards (danger confirm / attention review / quiet read); irreversible actions need stronger confirm.
   - **Suggested command:** `/impeccable harden` (+ `/impeccable colorize`)

2. **[P1] Generic empty / missing supervision frame**
   - **What:** Empty state is Bot + "Pergunte algo…"; no "AI proposes, you approve before Git runs."
   - **Why it matters:** First-timers won't discover the trust model until mid-flight.
   - **Fix:** Empty/onboard block: capabilities + explicit human-gate sentence + 2–3 example prompts.
   - **Suggested command:** `/impeccable onboard` (+ `/impeccable clarify`)

3. **[P1] Limpar conversa destroys pending gates**
   - **What:** `clearChat` wipes messages with no confirm; peer ghost button next to Configurações.
   - **Why it matters:** One misclick nukes awaiting Aprovar/Cancel — trust-boundary failure.
   - **Fix:** Confirm when pending/running tools exist; demote clear visually.
   - **Suggested command:** `/impeccable harden`

4. **[P2] Settings as LLM laboratory**
   - **What:** Temperature, maxDiffChars, reasoning effort always visible beside chat.
   - **Why it matters:** Extraneous load for Operate; distracts from approve/send.
   - **Fix:** Progressive disclosure — essentials first; advanced behind disclosure.
   - **Suggested command:** `/impeccable distill`

5. **[P2] Busy path has no abort / weak recovery**
   - **What:** No stop during thinking; failed tools are text-only; no retry.
   - **Why it matters:** Stuck/failed turns feel dead; user resorts to clear or leave.
   - **Fix:** Stop generation; Retry on failed card/error banner.
   - **Suggested command:** `/impeccable harden`

#### Persona Red Flags

**Alex (Power User):** Icon-only Bot in TopBar; no keyboard power beyond Enter; cannot stop a long think; cannot batch-approve; temperature knobs in the way of model/key.

**Jordan (First-Timer):** Empty state doesn't explain supervision; settings jargon opaque; after approve, raw result + auto-continue — "did it work? where do I see the branch?"; mixed EN tabs vs PT chat.

**Sam (Accessibility):** Composer disable reason not announced; running state relies on spinner + color border; dense caption stacks; icon-only TopBar AI control.

**Dev who wants supervised AI Git ops:** Approval lives inside chat scroll, not a dedicated gate/queue; no deep link from completed tool → Changes/History/PR; repo/branch absent from chat header; promise implemented but underplayed vs a normal chatbot.

#### Minor Observations

- REASONING_LABELS.off = 'Off' while siblings are Portuguese
- testResult always text-success-green
- handleTest/handleLoadModels silently save first
- Pending vs running border difference is subtle (/30 vs /50 + glow)

#### Questions to Consider

1. If the first viewport of AI Chat didn't look like a chat thread, what would "supervised Git ops" look like instead — an action queue?
2. Should "Aprovar" for merge_pull_request ever share visual language with "Aprovar" for list_branches?
3. Why is clearing the conversation as easy as opening settings, when pending cards are the trust boundary?
4. What should the user feel 2 seconds after a successful push — a monospace string, or a return path into Changes/History?
5. Is Temperature a first-class Operate control, or evidence the panel was ported from an API playground?
