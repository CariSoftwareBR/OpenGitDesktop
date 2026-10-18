---
name: GitWeb
description: Design system for GitWeb — a cross-platform desktop Git client with supervised AI assistance.
colors:
  midnight-base: "#0a0a0b"
  obsidian-panel: "#131315"
  coal-raised: "#1b1b1e"
  hover-overlay: "#ffffff0d"
  active-overlay: "#479ffa14"
  primary-text: "#ffffff"
  secondary-text: "#868f97"
  tertiary-text: "#999999"
  default-border: "#ffffff14"
  focus-border: "#479ffa"
  command-blue: "#479ffa"
  command-blue-soft: "#479ffa1f"
  attention-orange: "#ffa16c"
  attention-orange-soft: "#ffa16c1a"
  success-green: "#4ebe96"
  success-green-soft: "#4ebe961a"
  danger-red: "#e15c5c"
  danger-red-soft: "#261b1b"
  danger-fill: "#c24848"
  danger-fill-hover: "#ad3e3e"
  on-danger: "#ffffff"
  field-border: "#ffffff57"
  diff-add-ink: "#4ebe96"
  diff-hunk-ink: "#479ffa"
  diff-meta-ink: "#999999"
  diff-gutter-ink: "#858585"
  warning-amber: "#f2b84b"
  warning-amber-soft: "#f2b84b1f"
  action-surface: "#e6e6e6"
  action-ink: "#000000"
themeVariants:
  # `colors` above is the dark theme and the default/fallback. Each variant
  # below overrides the same role set for a different canvas/contrast
  # combination; roles not listed keep their dark-theme value unless a
  # component-level exception says otherwise. Selection between variants is
  # app logic (prefers-color-scheme + prefers-contrast + manual override),
  # not a design decision recorded here.
  light:
    midnight-base: "#f6f5f3"
    obsidian-panel: "#ffffff"
    coal-raised: "#ececea"
    hover-overlay: "#00000009"
    active-overlay: "#1f6fe014"
    primary-text: "#14171a"
    secondary-text: "#5b6570"
    tertiary-text: "#69727d"
    default-border: "#00000014"
    focus-border: "#1f6fe0"
    command-blue: "#1f6fe0"
    command-blue-soft: "#1f6fe014"
    attention-orange: "#b5590f"
    attention-orange-soft: "#b5590f14"
    success-green: "#157a55"
    success-green-soft: "#157a5514"
    danger-red: "#c22b2b"
    danger-red-soft: "#fbe9e9"
    danger-fill: "#c22b2b"
    danger-fill-hover: "#a82424"
    on-danger: "#ffffff"
    field-border: "#0000006b"
    diff-add-ink: "#136f4d"
    diff-hunk-ink: "#1b5fc1"
    diff-meta-ink: "#646d78"
    diff-gutter-ink: "#646d78"
    warning-amber: "#8a5a00"
    warning-amber-soft: "#8a5a0014"
    action-surface: "#262b30"
    action-ink: "#ffffff"
  dark-hc:
    midnight-base: "#000000"
    obsidian-panel: "#000000"
    coal-raised: "#0d0d0d"
    hover-overlay: "#ffffff26"
    active-overlay: "#7fc4ff26"
    primary-text: "#ffffff"
    secondary-text: "#e6e6e6"
    tertiary-text: "#cfcfcf"
    default-border: "#ffffff66"
    focus-border: "#7fc4ff"
    command-blue: "#7fc4ff"
    command-blue-soft: "#7fc4ff33"
    attention-orange: "#ffb366"
    attention-orange-soft: "#ffb36633"
    success-green: "#5be8ac"
    success-green-soft: "#5be8ac33"
    danger-red: "#ff6b6b"
    danger-red-soft: "#3a1414"
    danger-fill: "#ff6b6b"
    danger-fill-hover: "#ff8585"
    on-danger: "#000000"
    field-border: "#ffffff66"
    diff-add-ink: "#5be8ac"
    diff-hunk-ink: "#7fc4ff"
    diff-meta-ink: "#cfcfcf"
    diff-gutter-ink: "#cfcfcf"
    warning-amber: "#ffd166"
    warning-amber-soft: "#ffd16633"
    action-surface: "#f0f0f0"
    action-ink: "#000000"
  light-hc:
    midnight-base: "#ffffff"
    obsidian-panel: "#ffffff"
    coal-raised: "#f2f2f2"
    hover-overlay: "#00000026"
    active-overlay: "#0050b326"
    primary-text: "#000000"
    secondary-text: "#1a1a1a"
    tertiary-text: "#333333"
    default-border: "#00000066"
    focus-border: "#0050b3"
    command-blue: "#0050b3"
    command-blue-soft: "#0050b31a"
    attention-orange: "#8a3d00"
    attention-orange-soft: "#8a3d001a"
    success-green: "#0b6b46"
    success-green-soft: "#0b6b461a"
    danger-red: "#a30000"
    danger-red-soft: "#f7dede"
    danger-fill: "#a30000"
    danger-fill-hover: "#8a0000"
    on-danger: "#ffffff"
    field-border: "#0000006b"
    diff-add-ink: "#0b6b46"
    diff-hunk-ink: "#0050b3"
    diff-meta-ink: "#333333"
    diff-gutter-ink: "#333333"
    warning-amber: "#7a4b00"
    warning-amber-soft: "#7a4b001a"
    action-surface: "#202020"
    action-ink: "#ffffff"
typography:
  display:
    fontFamily: "calibre, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "calibre, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  metric:
    fontFamily: "calibre, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "calibre, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "calibre, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  caption:
    fontFamily: "calibre, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "calibre, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  button: "8px"
  pill: "99px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action-surface}"
    textColor: "{colors.action-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "7px 16px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.primary-text}"
    textColor: "{colors.action-ink}"
  button-secondary:
    backgroundColor: "{colors.midnight-base}"
    textColor: "{colors.primary-text}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "7px 16px"
    height: "34px"
  button-danger:
    backgroundColor: "{colors.danger-fill}"
    textColor: "{colors.on-danger}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "7px 16px"
    height: "34px"
  input-default:
    backgroundColor: "{colors.midnight-base}"
    textColor: "{colors.primary-text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  card-default:
    backgroundColor: "{colors.obsidian-panel}"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.lg}"
    padding: "20px"
  chip-command:
    backgroundColor: "{colors.command-blue-soft}"
    textColor: "{colors.command-blue}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: GitWeb

## 1. Overview

**Creative North Star: "The Local Workbench"**

GitWeb is a dense, calm desktop Git workbench. Near-black surfaces keep attention on the repository state — changes, diffs, branches, conflicts, and the next commit — while chrome stays quiet. The visual system is controlled intensity: clear when something needs action (conflicts, errors, destructive confirms), restrained everywhere else.

The interface is a product workspace, not a spectacle. Compact controls, exact labels, restrained interaction color, and explicit semantic states support fast daily Git workflows. Navigation and chrome recede; success, danger, warnings, and primary actions remain unmistakable. The system rejects glossy generic SaaS marketing, neon decoration, and undifferentiated admin CRUD chrome.

**Key Characteristics:**
- Near-black tonal layers with crisp content contrast.
- Compact, decisive controls built for repeated operational use.
- Color reserved for interaction and semantic state.
- Dense layouts organized by hierarchy rather than decoration.
- Structure that preserves the primary task when the window is narrowed.

## 2. Colors

The palette is restrained at rest and categorical in motion: neutrals carry the workspace while operational colors identify action, attention, success, danger, and warning.

### Primary
- **Command Blue** (`#479ffa`): marks focus, active navigation, selected states, links, and informational feedback. It is an interaction signal, never ambient decoration.

### Secondary
- **Attention Orange** (`#ffa16c`): marks setup emphasis and information that deserves review but is not yet a warning or failure.

### Tertiary
- **Success Green** (`#4ebe96`): communicates successful execution, additions in diffs, and healthy state.
- **Danger Red** (`#e15c5c`): communicates destructive action, failed state, deletions in diffs, and conditions requiring intervention.
- **Warning Amber** (`#f2b84b`): communicates caution, merge conflicts, and unresolved operational risk.

### Neutral
- **Midnight Base** (`#0a0a0b`): the application canvas and recessed control background.
- **Obsidian Panel** (`#131315`): the default panel, menu, and card surface.
- **Coal Raised** (`#1b1b1e`): the raised layer for selected blocks and secondary surfaces.
- **Primary Text** (`#ffffff`): headings, key values, and active control content.
- **Secondary Text** (`#868f97`): body copy, descriptions, and supporting data.
- **Tertiary Text** (`#999999`): compact metadata and placeholders where contrast remains compliant.
- **Action Surface** (`#e6e6e6`): the default primary button surface with black action ink.

### Named Rules

**The Operational Color Rule.** Chromatic color always means action or state. If a hue does not help the operator decide, remove it.

**The Data-Viz Exception.** Charts on the Dashboard are the one place hue encodes *identity* (a language, a contributor) instead of action or state. They use their own `--viz-1…8` categorical set and a `--viz-seq-1…5` blue ramp (defined in `global.css`), validated for colour-vision deficiency against the real panel surfaces, separately stepped for dark and light. Chart text stays in text tokens; every coloured mark has a visible text label beside it.

**The Red Means Danger Rule.** Danger Red is reserved for destructive actions, failures, and intervention. It is forbidden as decorative emphasis.

**The Contrast Before Atmosphere Rule.** Readability wins over subtlety. Muted text and placeholders must meet WCAG 2.2 AA against their actual surface, in every theme variant, not only the dark default.

### Theme Variants

The dark palette above (`colors:`) is the default and the reference identity — every other variant is that same role set recomposed for a different canvas, never a mechanical color inversion:

- **Light**: a warm near-white canvas (`#f6f5f3`, not sterile white) replaces Midnight Base; every semantic hue (Command Blue, Success Green, Danger Red, Warning Amber, Attention Orange) is deepened enough to still read as text at WCAG AA on that canvas — the same hue family, recomposed, never the raw dark-theme value lightened. The primary button flips from a light "ink" surface to a dark one (`#262b30`) so it stays the single strongest tonal object in the room, matching what Action Surface already does in the dark theme.
- **Dark, high contrast** and **Light, high contrast**: pure black or pure white canvas. Every role that depended on a subtle tonal step (panel vs. raised) or a low-alpha overlay (borders, hover, active) instead depends on an always-visible border or a brightened/deepened, more saturated hue — subtlety is exactly what a high-contrast user cannot rely on. Text and semantic colors clear 6.5:1–14:1 against their canvas, well past the 4.5:1 floor the other two variants target.

Full token values live in `themeVariants` in this file's frontmatter, and are mirrored as CSS custom-property overrides per `data-theme` value in `GitWeb/src/renderer/src/styles/global.css`. Selecting a variant (from `prefers-color-scheme`, `prefers-contrast`, or a manual override) is application logic, not a design decision this file makes.

**The Recomposed, Not Inverted Rule.** A new theme variant may never be produced by mechanically inverting or lightening/darkening the dark theme's raw values. Compose each surface, text, and semantic role independently against its own canvas, verify contrast, and only then compare against the sibling variants for family resemblance.

## 3. Typography

**Display Font:** calibre with Inter and system sans-serif fallbacks  
**Body Font:** calibre with Inter and system sans-serif fallbacks  
**Mono Font:** JetBrains Mono for diffs, hashes, and genuine code content only

**Character:** One technical sans family carries the product chrome. Hierarchy comes from size, weight, and spacing rather than competing typefaces. Monospace is reserved for repository content, never UI labels.

### Hierarchy
- **Display** (600, `34px`, `0.95`): reserved for rare hero statements (e.g. empty first-run). Tracking must never tighten beyond `-0.04em`.
- **Headline** (600, `22px`, `1.2`): page titles and major workflow headings.
- **Metric** (600, `18px`, `1.2`): compact counts and values that must lead within a block.
- **Title** (600, `16px`, `1.3`): panel titles, dialog titles, and high-priority row labels.
- **Body** (400, `14px`, `1.5`): instructions, descriptions, controls, and operational copy; prose is capped near `70ch`.
- **Caption** (400, `12px`, `1.45`): secondary metadata on pointer-precise layouts.
- **Label** (600, `10px`, `0.08em`, uppercase when categorical): section headers and short state labels only.

### Named Rules

**The One-Family Rule.** Product labels, buttons, data, and headings use the same sans family. Display fonts are prohibited in operational UI.

**The Tabular Data Rule.** Counts, hashes (when aligned), and timestamps use tabular numerals whenever columns or repeated values must align.

**The Uppercase Budget Rule.** Uppercase tracking is reserved for compact categorical labels and section headers; it must not become a decorative scaffold.

## 4. Elevation

GitWeb uses structural layering. Midnight Base, Obsidian Panel, and Coal Raised establish most depth; subtle borders separate adjacent surfaces. Shadows belong to floating menus, dialogs, toasts, and genuine overlays. Ambient card shadow must not be the default treatment for every panel.

### Shadow Vocabulary
- **Floating Surface** (`rgba(0, 0, 0, 0.8) 0 12px 44px -12px`): menus, dialogs, toasts, and overlays that must separate from the application shell.
- **Subtle Edge** (`rgba(0, 0, 0, 0.85) 0 1px 0`): compact notification surfaces or controls that need a single lower edge.
- **Command Glow** (`0 0 20px rgba(71, 159, 250, 0.06)`): rare informational emphasis around an active system surface, never routine card decoration.
- **Raised** (`--shadow-raised`: a 1px inset top highlight plus `0 1px 2px` drop): cards, the header status cluster, and tile controls. It reads as a machined edge, not a float, so it does not break the No Ghost Card Rule. Disabled in high-contrast variants.

### Motion

- **View enter**: switching tabs brings the incoming view up 6px with a 3px de-blur over 280ms (expo ease-out). It uses `backwards` fill only, so no transform or filter lingers to trap `position: fixed` menus.
- **List selection**: rows mark hover and selection with a short rounded accent pill on the leading edge that grows from the row's middle (`--row-accent` recolors it; conflicts use Warning Amber).
- **Tab indicator**: the active tab's underline grows from its center.
- **Assistant standby**: the empty-chat emblem breathes a soft Command Blue ring. It is the only idle loop in the app.
- All of it collapses under `prefers-reduced-motion`.

### Named Rules

**The Structural Layering Rule.** Use tonal surface changes and borders first. Add shadow only when an element physically floats above its context.

**The No Ghost Card Rule.** Never pair a one-pixel border with a wide decorative drop shadow on ordinary cards or buttons.

### Scrollbars

Every scrollable surface — vertical **and** horizontal — uses the application scrollbar, never the operating system default.

- **Thumb** (`rgba(255, 255, 255, 0.16)`): visible against Obsidian Panel without competing with content.
- **Thumb, hover** (`rgba(255, 255, 255, 0.32)`): confirms the bar is grabbable.
- **Track**: always transparent — the panel behind it supplies the surface.
- **Thickness**: `10px` with a `2px` transparent inset (`background-clip: padding-box`). Firefox gets the same result through `scrollbar-width: thin`.

Declared once globally in `GitWeb/src/renderer/src/styles/global.css` under `@layer base`. Scrollable areas inherit it; they must not restyle it locally.

**The Application Scrollbar Rule.** Scrollable surfaces use the application scrollbar in both axes. Never ship a default OS scrollbar inside a panel, and never hide a scrollbar that still scrolls.

**The Far-Right Vertical Scrollbar Rule.** A page-level or pane-level vertical scrollbar must sit on the far right edge of the surface that owns the scroll — the window, `main`, or the split pane — never on a centered column. Center the content *inside* a full-width scroller (`h-full overflow-y-auto` wrapping `mx-auto max-w-*`). Do not put `overflow-y-auto` on the `max-w-*` wrapper itself; that parks the thumb in the middle of the window. Nested widget scrollers (combobox lists, modal repo lists, the About release-notes card) stay on their own box.

## 5. Components

Components are compact and decisive. Every control must expose a familiar affordance and a complete set of default, hover, focus, active, disabled, loading, and error states where applicable.

### Buttons
- **Shape:** primary, secondary and semantic actions use the button radius (`8px`) — a softened rectangle, never the full pill, which stays reserved for chips, badges, switches and progress tracks. Compact icon and ghost controls use the small or medium radius (`6px` to `10px`). A split button (action + attached menu trigger) squares the two inner corners where the halves meet and keeps the button radius on the outer ones.
- **Primary:** Action Surface with black text, `7px 16px` padding, and a `34px` default height.
- **Hover / Focus:** hover increases surface contrast; keyboard focus is a two-pixel solid Focus Border (Command Blue) outline, which must hold 3:1 against every surface it lands on — never a translucent ring. State transitions complete in `100ms` to `150ms`.
- **Secondary / Ghost / Semantic:** secondary remains transparent with a quiet border; ghost controls recede to secondary text; danger variants are reserved for destructive actions and fill with Danger Fill under On Danger text (≥4.5:1 in every theme); Danger Red stays the text/icon hue.

### Chips
- **Style:** compact pill, soft semantic background, matching semantic text, and a low-contrast full border.
- **State:** blue identifies selection or information, green success, red danger, orange attention, amber warning, and neutral metadata. Color must be reinforced by text or iconography.

### Cards / Containers
- **Corner Style:** gently rounded (`16px` maximum for cards; `10px` for embedded blocks).
- **Background:** Obsidian Panel on Midnight Base; Coal Raised only for nested emphasis without creating a card inside a card.
- **Shadow Strategy:** flat by default; use the Floating Surface shadow only for true overlays.
- **Border:** one-pixel Default Border separates panels where tonal contrast is insufficient.
- **Internal Padding:** `16px` to `20px`; dense rows use `8px` to `12px` vertical rhythm.

### Inputs / Fields
- **Style:** Midnight Base, Primary Text, a one-pixel Field Border (3:1 against both the fill and the surrounding panel, so an empty field is findable at rest), `6px` radius, and `10px 12px` padding. Hover strengthens the edge to half-strength Primary Text.
- **Focus:** Command Blue border with a three-pixel Command Blue Soft ring.
- **Error / Disabled:** Danger Red communicates invalid state with adjacent text; disabled controls remain legible, preserve their label, and reduce opacity without disappearing.

### Navigation

Desktop navigation is a compact top tab strip with labels — Changes, History, Stash, Pull Requests, and Settings. The active route uses Primary Text with a Command Blue underline. Hover reveals affordance without introducing new color. Repo, branch, and sync share one status cluster in the header; About lives in Settings, not as a competing header icon.

### Switches and Floating Menus

Switches use a `42px` by `24px` track with an `18px` thumb and explicit text labels. Comboboxes and row-action menus use Obsidian Panel with a `10px` radius and escape scroll-container clipping. Floating surfaces must manage keyboard focus.

## 6. Do's and Don'ts

### Do:
- **Do** surface blocking Git state (conflicts, errors, ahead/behind) before secondary chrome.
- **Do** use Command Blue only for interaction, focus, selection, and information.
- **Do** use Success Green, Danger Red, and Warning Amber with text or icons so state never depends on hue alone.
- **Do** use Midnight Base, Obsidian Panel, and Coal Raised to create structural depth before adding shadow.
- **Do** keep ordinary cards at or below the canonical `16px` radius and embedded blocks at `10px` or below.
- **Do** preserve complete keyboard operation, visible focus, reduced-motion alternatives, and WCAG 2.2 AA contrast.
- **Do** let scrollable areas inherit the global application scrollbar, in both axes.
- **Do** put page or pane scroll on a full-width container so the vertical thumb rides the far right edge; center content inside that scroller.
- **Do** require explicit confirmation for destructive Git actions (discard, abort merge, drop stash, pop stash, merge or close a pull request). Danger confirms focus Cancel, not the destructive button.

### Don't:
- **Don't** turn GitWeb into glossy generic SaaS marketing with decorative gradients, hero-metric templates, or glass cards.
- **Don't** use neon glows or speculative hype aesthetics.
- **Don't** reduce the product to an undifferentiated CRUD admin panel; keep the daily Git path (changes → diff → commit) primary.
- **Don't** compete with that path using equal-weight header cards or icon-only Settings/About buttons; Settings is a labeled tab, About lives inside it.
- **Don't** use decorative grid backgrounds unless the surface is an actual charting or spatial canvas.
- **Don't** use gradient text, colored side-stripe borders thicker than the list-row accent system, nested cards, or identical card grids as default structure.
- **Don't** use `24px`, `28px`, or larger card radii; those values are implementation drift, not part of this system.
- **Don't** apply the Floating Surface shadow to ordinary bordered cards or buttons.
- **Don't** leave the default OS scrollbar on any scrollable surface, restyle scrollbars per component, or hide a bar on content that still scrolls.
- **Don't** put `overflow-y-auto` on a centered `max-w-*` column; the vertical bar must not float in the middle of the window.
