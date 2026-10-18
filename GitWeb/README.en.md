# OpenGitDesktop

[Português](README.md) · **English** · [Español](README.es.md)

Cross-platform Git client (Windows, macOS, Linux), inspired by [GitDesktop](../GitDesktop) — the WinUI 3 (Windows-only) version of this same project. This is a new, independent app; `GitDesktop/` still exists and is maintained in parallel.

## Stack

| Area | Technology |
|---|---|
| Desktop shell | Electron |
| UI | React + TypeScript + Zustand |
| Icons | lucide-react |
| Build/dev | electron-vite (Vite) |
| Packaging | electron-builder |
| Git | Git CLI (via `child_process.spawn` in the main process) |
| GitHub | REST API (in the main process) + OAuth Device Flow or PAT, both also used to authenticate the `git` CLI |
| AI | OpenAI, Claude, OpenRouter, Ollama or a local OpenAI-compatible endpoint |
| Credentials | Electron `safeStorage` (Credential Manager / Keychain / libsecret) |

## Requirements

- Node.js 20+
- Git installed and available on the `PATH`

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build        # builds the bundle (out/)
npm run build:win    # packages for Windows (.exe via NSIS)
npm run build:mac    # packages for macOS (.dmg/.zip)
npm run build:linux  # packages for Linux (.AppImage/.deb)
```

Real cross-platform packaging runs in CI (`.github/workflows/gitweb-build.yml`, Windows/macOS/Linux matrix). Locally, building the `.exe` (NSIS) installer on Windows requires Developer Mode (Settings → System → For developers) — without it, the packaging tool can't create the symbolic links it uses internally. The app runs fine without it (`npm run dev` or the `.exe` built in `dist/win-unpacked/`).

## Release

**Automatic:** every push to `main`/`master` that changes `GitWeb/` produces a **patch** release (e.g. 0.1.0 → 0.1.1), pushes the tag and publishes the installers (Windows/macOS/Linux) to the GitHub Release. The workflow is `.github/workflows/gitweb-auto-release.yml`.

**Manual** (minor/major, or forcing a patch locally):

```bash
npm run release:minor   # or :major / :patch
```

This bumps the version, pushes the tag, and the `.github/workflows/gitweb-release.yml` workflow publishes the Release.

## Structure

```text
src/
├─ main/          # main process (Node) — git, credentials, dialogs, IPC, settings
├─ preload/       # contextBridge — typed API exposed to the renderer
├─ shared/        # types shared by main/preload/renderer
│  └─ i18n/       # locales and translation dictionaries (pt-BR, en, es)
└─ renderer/
   └─ src/
      ├─ views/       # Initial, Changes, History, Stashes, PullRequests, AiChat
      ├─ components/  # TopBar, DiffViewer, ConflictResolver
      ├─ store/       # global state (zustand): repo, pull requests, AI
      └─ lib/         # github.ts (REST), ai/ (providers, tools, commit message, skills/)
```

## Features

- Open, clone (URL or GitHub sign-in via OAuth Device Flow/PAT with a repository list) and create repositories; recent list.
- Changes: per-file stage/unstage/discard, diff, commit, AI-generated commit description.
- History: commit log, changed files, per-commit diff.
- Branches: switch, create, merge (with a basic conflict-resolution editor when needed).
- Stash: create, apply, pop, drop — wired into the main navigation.
- Sync: fetch/pull/push/publish branch that adapts to the ahead/behind/upstream state.
- Pull Requests: sign in with OAuth Device Flow (GitHub.com) or PAT (GitHub.com or Enterprise), list, create, view files/comments, merge, close/reopen.
- AI chat with tools (create/switch/merge branch, commit, push/pull/fetch, stash, list/create PR) with a human-approval step before each action.
- Interface, main-process messages and AI answers in Portuguese (Brazil), English or Spanish — following the system language by default, switchable live in Settings.
- Automatic light/dark themes (from the system preference) and high-contrast support (Windows High Contrast Mode / `prefers-contrast`).

## GitHub authentication

OpenGitDesktop offers two ways to sign in to GitHub, side by side — neither replaces the other:

- **OAuth Device Flow** (default, `github.com` only): click "Continue with GitHub", confirm a one-time code at `github.com/login/device` and the app receives the token. It needs a registered OAuth App with Device Flow enabled, whose `client_id` lives in `GitWeb/src/main/githubDeviceFlow.ts` (or in the `GITWEB_GITHUB_OAUTH_CLIENT_ID` environment variable, for anyone building from source who wants their own OAuth App).
- **Personal Access Token**: required for GitHub Enterprise Server (Device Flow would need a separate OAuth App per instance), also available on `github.com`.

The resulting token — from either method — is stored encrypted via `safeStorage` (`GitWeb/src/main/credentials.ts`) and used both for REST API calls and to authenticate `git` CLI operations (clone/fetch/pull/push) over HTTPS, through an `http.extraHeader` applied per invocation only (never written to `.git/config`). That removes the need to set up Git Credential Manager separately for GitHub repositories. SSH remotes keep using the system SSH configuration, unchanged.

### Requested scopes

Device Flow requests `repo` and `workflow`. `repo` grants read and write access to every public and private repository the account can reach — it's the smallest scope GitHub offers for a general-purpose Git client, since OAuth Apps have no per-repository granularity. GitHub requires `workflow` to push commits that change files in `.github/workflows/`; without it, `git push` is rejected in those cases. The sign-in screen shows both scopes before you authorize.

### How the token is isolated

The token **never** reaches the renderer process. Every GitHub API call runs in the main process (`GitWeb/src/main/githubApi.ts`), which resolves the token from the vault on each call; the renderer only sends `host`/`owner`/`repo` over IPC and receives already-mapped objects. The renderer's `Content-Security-Policy` uses `connect-src 'self'`, so there's nowhere to leak it to. The vault exposed to the renderer (`window.api.secrets`) only accepts keys prefixed with `GitWeb/AI/` — the AI provider keys —, and every IPC handler validates the origin of the frame that called it.

### Never enter a device flow code you didn't generate

The `client_id` is public by the nature of Device Flow — anyone can start a sign-in with the same
`client_id` (GitHub CLI has exactly the same property). The attack this enables is *device code
phishing*: someone starts the flow, sends you the eight-character code and asks you to confirm it at
`github.com/login/device`. GitHub's page will show "OpenGitDesktop" as usual, but the attacker is the one who gets
the token. A public client has no way to prevent this. The rule is simple: **only enter a code that OpenGitDesktop
itself has just shown on your screen.**

### Signing out does not revoke the authorization

Signing out deletes the token from this machine, but the OAuth App authorization stays active on your account. Revoking it from the app would require a *client secret*, which a public Device Flow client can't keep. That's why, after signing out, the app shows the link to `github.com/settings/connections/applications/<client_id>`, where you actually revoke access.

## Known differences from GitDesktop (WinUI)

- AI chat works on the current repository; there's no "global" mode spanning multiple repositories.
- Native tool-calling is handled in a unified way (OpenAI-compatible schema for OpenAI/OpenRouter/Ollama/local + Anthropic Messages API for Claude), without the extra text fallback the WinUI app uses for providers that reject `tools`.

## Status

All planned phases (bootstrap, core screens, stash/conflicts, GitHub+PRs, AI, polish/packaging, CI) are implemented and pass `npm run typecheck` + `npm run build`. Manually tested against a real repository.
