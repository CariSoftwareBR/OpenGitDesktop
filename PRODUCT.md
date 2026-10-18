# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

*(Electron desktop shell — Windows, macOS, Linux — built with a React/TypeScript renderer; the design language is the same across platforms, not native-per-OS, so it is treated as `web` rather than `adaptive`.)*

## Users

Developers in the general open-source community who want a free, cross-platform Git GUI client. There is no single organization or team this is built for — it is a public tool for anyone who works with Git and wants a desktop client with built-in AI assistance.

## Product Purpose

GitWeb is a cross-platform (Windows/macOS/Linux) desktop Git client — an alternative to GitHub Desktop — covering the core Git workflow (changes/stage/commit, history, branches, stash, sync) plus GitHub Pull Request management (via Personal Access Token), with an integrated AI chat assistant that can read repository state and execute Git actions on the user's behalf.

Success means a developer can complete their everyday Git workflow (stage → commit → sync, branch, resolve conflicts, manage PRs) without dropping to the terminal, and can optionally hand routine or exploratory steps to the AI assistant while staying in control of what actually happens to their repository.

## Positioning

The differentiating mechanism is the AI chat assistant's tool-calling with mandatory human approval: the assistant can propose and execute real Git/GitHub actions (create/switch/merge branch, commit, push/pull/fetch, stash, list/create PR) via natural language, but every action requires explicit user approval before it runs. This is what a plain Git GUI (GitHub Desktop, Fork, GitKraken, Sourcetree) cannot offer, and what a bare AI coding agent cannot offer safely — GitWeb sits at the intersection of "full Git GUI" and "supervised AI operator," never letting the assistant act unsupervised on the user's repository.

## Operating Context

- Desktop app, one local Git repository open at a time (opened, cloned, or created from disk).
- Everyday workflows: reviewing working-tree changes and diffs, staging/unstaging/discarding files, writing and committing (optionally AI-generated) commit messages, browsing commit history and per-commit diffs, creating/switching/merging branches, resolving merge conflicts, managing stashes, and fetch/pull/push/publish based on ahead/behind/upstream state.
- GitHub integration: connecting via OAuth Device Flow or a Personal Access Token (github.com or GitHub Enterprise), listing/creating/merging/closing Pull Requests, viewing PR files and comments.
- AI assistant: configured per-provider (OpenAI, Claude, OpenRouter, Ollama, or a local OpenAI-compatible endpoint), operating only against the currently open repository, proposing tool calls that the user must approve individually before execution.
- Sibling project: **GitDesktop**, a WinUI 3 (Windows-only) app covering similar ground, developed and maintained in parallel by the same author. GitWeb is not a replacement or successor to it — the two coexist, and product decisions here should not assume GitDesktop will be deprecated or folded in.

## Capabilities and Constraints

- GitHub authentication supports two methods, side by side: OAuth Device Flow (github.com only) and Personal Access Token (github.com or GitHub Enterprise Server — required for Enterprise, since Device Flow needs an OAuth App registered on that specific instance). This reverses the prior constraint ("Personal Access Token only — no OAuth Device Flow"), which is now out of date. Whichever method the user logs in with, the resulting token also authenticates the underlying `git` CLI (clone/fetch/pull/push over HTTPS) via a per-invocation `http.extraHeader`, so a separately configured Git Credential Manager is no longer required for GitHub remotes.
- The AI chat operates on the single currently-open repository; there is no cross-repository or "global" AI mode.
- AI provider credentials (API keys) are stored via the OS-backed secure store (Windows Credential Manager / macOS Keychain / libsecret), never written to the repo or synced; per-provider settings (model, base URL, temperature, reasoning effort, language) persist locally in app data.
- Tool-calling is unified across providers (OpenAI-compatible schema for OpenAI/OpenRouter/Ollama/local; Anthropic Messages API for Claude) — GitWeb does not implement the WinUI sibling's textual tool-call fallback for providers that reject native `tools`.
- Git operations run through the Git CLI via child process in the main process, not a Git library — the user's installed Git (must be on `PATH`) is the source of truth for repository behavior.
- Theming ships four variants: dark (default), light, and a high-contrast version of each. Settings → Tema offers Sistema/Escuro/Claro; Sistema follows `prefers-color-scheme`, and the OS high-contrast preference (`prefers-contrast: more`) switches to the matching HC variant automatically. There is no manual high-contrast toggle in-app.

## Brand Commitments

- App name in-product and in code is **GitWeb**. The parent repository is named `OpenGitDesktop` and contains both `GitWeb` (this Electron app) and `GitDesktop` (the WinUI sibling) as sibling projects, developed in parallel. No single umbrella brand name has been confirmed to supersede these two project names.
- Author: CariSoftwareBR.

## Evidence on Hand

- `GitWeb/README.md` documents the stack, feature set, and known differences from the GitDesktop (WinUI) sibling app — treated as strong evidence for this record, except where it visibly disagrees with the shipped implementation.
- No testimonials, case studies, press, benchmarks, or pricing exist. This is an unreleased/early-stage OSS project; future work must not fabricate any of these.

## Product Principles

1. Every AI-initiated action on the repository requires explicit human approval before execution — no autonomous writes to the user's Git state.
2. Feature parity of intent (not pixel parity) with the GitDesktop sibling app matters more than platform-native conventions, since both are the same product idea aimed at different platform reach.
3. Local-first control of credentials and AI configuration: nothing provider-related leaves the user's machine except the calls the user's own configured provider makes.
4. The core Git workflow must remain fully usable without ever touching the AI assistant — AI is an accelerant, not a dependency.

## Accessibility & Inclusion

No product-specific accessibility requirement has been confirmed beyond general good practice. The high-contrast variants (see Capabilities and Constraints) are implemented and follow the OS contrast preference; interactive text, focus indicators, and filled controls target WCAG 2.2 AA in the standard themes and well above it in the HC variants.
