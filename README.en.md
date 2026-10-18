# OpenGitDesktop

[Português](README.md) · **English** · [Español](README.es.md)

### The Git client that works with you — not instead of you.

Picture opening the repository, looking at the diff, asking *“create a branch, commit and open the PR”*… and watching each step happen **only after you approve it**.

That's **GitWeb**: a real Git client for Windows, macOS and Linux — with the full day-to-day workflow and an AI assistant that runs real actions on the repository, under your command.

No terminal required. No agent running loose in your history. Just speed with control.

---

## The idea

There are great Git clients. There are great AI agents. Almost none brings the two together the right way.

| GUI only | Agent only | **GitWeb** |
|---|---|---|
| You click everything | The AI does it alone | You talk — and **approve** every action |
| Safe, but slow | Fast, but risky | Fast **and** safe |

The difference isn't “having AI”. It's **tool-calling with mandatory human approval**: the AI proposes a branch, commit, push, stash, PR… and nothing touches the repository until you say yes.

---

## The full workflow — from clone to merge

### Repositories
Open, clone (by URL or straight from GitHub) or create from scratch. Recent repos always at hand. Sign in with **OAuth Device Flow** or a **Personal Access Token** — works on github.com and GitHub Enterprise.

### Changes
Stage, unstage and discard per file. A crisp diff. Commit with a message you write — or one the AI generates from what actually changed.

### History & branches
Browse the log, see what each commit changed, switch branches, create new ones, merge and resolve conflicts without leaving the app.

### Stash & sync
Put work in progress aside and bring it back when you need it. Fetch, pull, push and publish branch adapt to the ahead/behind/upstream state.

### Pull Requests
List, create, review files and comments, merge, close or reopen — all tied to your authenticated GitHub account.

### AI chat
Side panel or floating window. Speak in plain language. The AI reads the repo state and proposes real tools — each one with a preview and approval before it runs.

### Your language
The interface, the error messages and the AI's answers follow your system language — **Português (Brasil)**, **English** or **Español** — and you can switch at any time in Settings.

---

## The assistant, up close

It isn't a decorative chatbot. It's a supervised operator for your Git.

**It can:**
- Create, switch and merge branches
- Write a message and commit
- Push, pull and fetch
- Stash / stash pop
- List and create pull requests
- Help review and merge PRs (with dedicated skills)

**It can't:**
- Write to the repository without your approval
- Act on several repos at once — it only works on the one that's open
- Keep your keys off the machine: API keys and tokens stay in the OS vault (`safeStorage`)

Pick the provider: **OpenAI**, **Claude**, **OpenRouter**, **Ollama** or any local OpenAI-compatible endpoint. The full GUI works even with no AI configured — the assistant is an accelerator, not a dependency.

---

## GitHub authentication that makes life easier

Two paths, side by side:

1. **OAuth Device Flow** — “Continue with GitHub”, confirm the code at `github.com/login/device`, done.
2. **Personal Access Token** — for github.com or Enterprise Server.

The token works for the API **and** for the `git` CLI (HTTPS clone/fetch/pull/push). No separate Credential Manager setup for GitHub remotes. SSH keeps using your system config, untouched.

Credentials are encrypted via Credential Manager / Keychain / libsecret — never written to the repo. The token stays in the main process: the interface never receives it, it only asks for operations. Details on scopes, isolation and revocation in [GitWeb/README.en.md](GitWeb/README.en.md#github-authentication).

> **Release binaries are not signed yet.** Windows will show the SmartScreen warning and macOS will block it through Gatekeeper on first launch. The auto-updater checks the SHA-512 hash published with the release, but there is no code-signing chain — if that's unacceptable for you, build from source.

---

## Stack

| Area | Technology |
|---|---|
| Desktop | Electron |
| UI | React · TypeScript · Zustand · Tailwind · lucide-react |
| Build | electron-vite · electron-builder |
| Git | System CLI (`child_process` in main) |
| GitHub | REST API + OAuth Device Flow / PAT |
| AI | OpenAI · Claude · OpenRouter · Ollama · local |
| Security | Electron `safeStorage` |

```text
GitWeb/src/
├─ main/       → git, credentials, IPC, settings, device flow
├─ preload/    → typed bridge to the renderer
├─ shared/     → shared types and translations (i18n/)
└─ renderer/   → views, stores, GitHub client, AI tools
```

---

## Get started in 30 seconds

**Requirements:** Node.js 20+ and Git on the `PATH`.

```bash
cd GitWeb
npm install
npm run dev
```

### Packaging

```bash
npm run build        # bundle in out/
npm run build:win    # Windows (.exe / NSIS)
npm run build:mac    # macOS (.dmg / .zip)
npm run build:linux  # Linux (.AppImage / .deb)
```

> On Windows, building the NSIS installer locally needs **Developer Mode** (symbolic links). The app in `npm run dev` or `dist/win-unpacked/` runs fine without it.

Deeper technical docs: [`GitWeb/README.en.md`](GitWeb/README.en.md).

---

## What we believe

1. **You're in charge.** Every AI action on Git goes through explicit approval.
2. **AI is optional.** The Git client has to be excellent on its own.
3. **Local-first.** Tokens and keys stay on your machine, in the system vault.
4. **Real Git.** We use the Git installed on your system — the same one you trust in the terminal.

---

## Contributing

Issues and Pull Requests are welcome. Read the [contributing guide](CONTRIBUTING.md) (in Portuguese) and the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues follow [`SECURITY.md`](SECURITY.md).

---

## License

MIT — free to use, study, modify and distribute.

Made by [CariSoftwareBR](https://github.com/CariSoftwareBR).

---

<p align="center">
  <strong>Open the repo. Ask for the next step. Approve. Push.</strong><br/>
  <em>Git at the pace of a conversation — with you always in control.</em>
</p>
