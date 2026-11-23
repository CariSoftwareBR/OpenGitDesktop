# OpenGitDesktop

[Português](README.md) · **English** · [Español](README.es.md)

Cross-platform Git client (Windows, macOS, Linux), inspired by GitDesktop — the WinUI 3 (Windows-only) version of this same project. This is a new, independent app; GitDesktop is still maintained in parallel, outside this repository.

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
| Credentials | Electron `safeStorage` (DPAPI on Windows, Keychain on macOS, libsecret on Linux), encrypted into `secrets.json` in the app-data folder |

## Requirements

- Node.js 22.12+ (recommended: 26, the version used by CI and `.nvmrc`)
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

**Automatic:** every push to `main`/`master` that changes `GitWeb/` produces a **patch** release (e.g. 0.1.0 → 0.1.1) once lint, typecheck and tests pass: it pushes the tag and publishes the installers (Windows/macOS/Linux) to the GitHub Release. A push whose last commit says `[skip release]` makes no release — in a PR merge that commit is the merge commit, which carries the PR title, so put the marker in the title. The workflow is `.github/workflows/gitweb-auto-release.yml`.

**Manual** (minor/major, or forcing a patch):

```bash
npm run release:minor   # or :major / :patch; "-- --dry-run" only shows the version
```

The script (`scripts/tag-release.mjs`) works out the next version from the latest tag — `package.json`'s version lags behind on purpose — and pushes only the tag; the `.github/workflows/gitweb-release.yml` workflow packages and publishes the Release. It needs a clean working tree and `HEAD` equal to `origin/main`.

**Local, Windows only** (when CI can't package): `npm run release:local` — or `publicar-release.bat` at the repository root — packages on this machine and publishes the Release with the Windows installer.

## Structure

```text
src/
├─ main/          # main process (Node) — git, GitHub API, AI calls, credentials, dialogs, IPC, settings
├─ preload/       # contextBridge — typed API exposed to the renderer
├─ shared/        # types shared by main/preload/renderer
│  └─ i18n/       # locales and translation dictionaries (pt-BR, en, es)
└─ renderer/
   └─ src/
      ├─ views/       # Initial, Changes, History, Stashes, PullRequests, Collaborators, Dashboard, Messages, Settings, About, AiChat
      ├─ components/  # TopBar, DiffViewer, ConflictResolver, …
      ├─ store/       # global state (zustand): repo, pull requests, collaborators, GitHub sign-in, messages, settings, AI
      └─ lib/         # github.ts (types and remote parsing; the API runs in main/githubApi.ts), ai/ (providers, tools, commit message, skills/)
```

## Features

- Open, clone (URL or GitHub sign-in via OAuth Device Flow/PAT with a repository list) and create repositories; recent list.
- Changes: per-file stage/unstage/discard, diff, commit, AI-generated commit description.
- History: commit log, changed files, per-commit diff.
- Branches: switch, create, merge (with a basic conflict-resolution editor when needed).
- Stash: create, apply, pop, drop — wired into the main navigation.
- Sync: fetch/pull/push/publish branch that adapts to the ahead/behind/upstream state.
- Pull Requests: sign in with OAuth Device Flow (GitHub.com) or PAT (GitHub.com or Enterprise), list, create, view files/comments, merge, close/reopen.
- Collaborators: see who has access, invite by username, cancel invitations, remove people and change permissions (on organization repositories), right in the app.
- AI chat with tools (create/switch/merge branch, commit, push/pull/fetch, stash, list/create PR) on the open repository, plus batch check, fetch and pull across the recent repositories. Every action that changes something asks for approval before it runs; read-only ones run right away.
- Interface, main-process messages and AI answers in Portuguese (Brazil), English or Spanish — following the system language by default, switchable live in Settings.
- Light/dark theme that follows the system or is picked in Settings (System/Dark/Light), and high-contrast support (Windows High Contrast Mode / `prefers-contrast`).

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

## Tool-calling

Native tool-calling is handled in a unified way: OpenAI-compatible schema for OpenAI/OpenRouter/Ollama/local and the Anthropic Messages API for Claude. For providers that reject `tools`, the app falls back to text: the tools are described in the prompt and the call is read from the answer.

## Status

All planned phases (bootstrap, core screens, stash/conflicts, GitHub+PRs, AI, polish/packaging, CI) are implemented and pass `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. Manually tested against a real repository.
