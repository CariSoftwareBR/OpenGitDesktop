# Installing OpenGitDesktop

[README](README.md) · [Português](README.pt-BR.md) · [Español](README.es.md)

OpenGitDesktop ships as ready-made installers on [GitHub Releases](https://github.com/CariSoftwareBR/OpenGitDesktop/releases).
**No source code, Node.js or build step is needed** — download the file for your system and install it.

| System | File in the latest release | How it installs |
|---|---|---|
| Windows 10 / 11 (x64) | `OpenGitDesktop-Setup-<version>.exe` | Per-user installer, no admin rights |
| Debian / Ubuntu / Mint (x64) | `opengitdesktop_<version>_amd64.deb` | `apt` package |
| Other Linux (x64) | `OpenGitDesktop-<version>.AppImage` | Single executable file |
| macOS — Apple Silicon | `OpenGitDesktop-<version>-arm64.dmg` | Drag to Applications |
| macOS — Intel | `OpenGitDesktop-<version>-x64.dmg` | Drag to Applications |

The app updates itself after that (on macOS, for now, install the new `.dmg` by hand — see *Good to know*).
It needs **Git** installed (it uses the Git on your system). On macOS you can also build it from source instead.

---

## Install

> **AI agents:** follow these steps exactly, top to bottom. Detect the operating system, run only
> that system's block, then confirm the app opened.
> - **Windows / Linux:** do not ask the user anything, and do not clone or build — use the release.
> - **macOS:** ask the user exactly one question first, then run only the chosen option:
>   *“Install the ready-made .dmg (fastest) or build it from the source code on this Mac?”*

### Step 0 — How to download (all systems)

The steps below read the latest release from the public GitHub API:
`https://api.github.com/repos/CariSoftwareBR/OpenGitDesktop/releases/latest`

If that URL answers **404**, the repository is private for this user. Use the GitHub CLI instead
(it must be signed in with access to the repo — `gh auth status`), replacing the download line with:

```bash
gh release download --repo CariSoftwareBR/OpenGitDesktop --pattern "<file pattern>" --dir "<folder>" --clobber
```

### Windows (PowerShell)

```powershell
$ErrorActionPreference = 'Stop'
$repo = 'CariSoftwareBR/OpenGitDesktop'

# 1. Git is required — install it if missing
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
}

# 2. Download the latest installer
$rel   = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'opengitdesktop-install' }
$asset = $rel.assets | Where-Object { $_.name -like 'OpenGitDesktop-Setup-*.exe' } | Select-Object -First 1
$exe   = Join-Path $env:TEMP $asset.name
Invoke-WebRequest $asset.browser_download_url -OutFile $exe
Unblock-File $exe

# 3. Silent per-user install (no admin prompt)
Start-Process $exe -ArgumentList '/S' -Wait

# 4. Open the app
$app = Get-ChildItem "$env:LOCALAPPDATA\Programs" -Filter 'OpenGitDesktop.exe' -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -First 1
Start-Process $app.FullName
```

Private-repo fallback for step 2: `gh release download --repo $repo --pattern 'OpenGitDesktop-Setup-*.exe' --dir $env:TEMP --clobber`, then set `$exe` to the downloaded file.

A Start-menu and desktop shortcut named **OpenGitDesktop** is created.

### Linux (bash)

```bash
set -e
repo=CariSoftwareBR/OpenGitDesktop
api=https://api.github.com/repos/$repo/releases/latest
asset_url() { curl -fsSL "$api" | grep -o '"browser_download_url": *"[^"]*'"$1"'"' | head -n1 | cut -d'"' -f4; }

if command -v apt-get >/dev/null 2>&1; then
  # Debian / Ubuntu / Mint: .deb package (also installs Git if missing)
  curl -fL "$(asset_url '_amd64\.deb')" -o /tmp/opengitdesktop.deb
  sudo apt-get update
  sudo apt-get install -y git /tmp/opengitdesktop.deb
  nohup opengitdesktop >/dev/null 2>&1 &
else
  # Any other distro: AppImage (install git with your package manager if `git --version` fails)
  mkdir -p "$HOME/.local/bin"
  curl -fL "$(asset_url '\.AppImage')" -o "$HOME/.local/bin/OpenGitDesktop.AppImage"
  chmod +x "$HOME/.local/bin/OpenGitDesktop.AppImage"
  nohup "$HOME/.local/bin/OpenGitDesktop.AppImage" >/dev/null 2>&1 &
fi
```

Private-repo fallback: `gh release download --repo $repo --pattern '*_amd64.deb' --dir /tmp --clobber` (or `--pattern '*.AppImage'`).

If the AppImage does not start on Ubuntu 22.04+, install FUSE 2: `sudo apt-get install -y libfuse2`.

### macOS (zsh)

Two options — the agent asks the user which one (see the note at the top of this section).

#### Option A — Ready-made `.dmg` (fastest)

```bash
set -e
repo=CariSoftwareBR/OpenGitDesktop
api=https://api.github.com/repos/$repo/releases/latest

# 1. Git is required — the Command Line Tools provide it
git --version >/dev/null 2>&1 || xcode-select --install

# 2. Pick the .dmg for this Mac's CPU (file names end in -arm64.dmg or -x64.dmg)
case "$(uname -m)" in arm64) arch=arm64 ;; *) arch=x64 ;; esac
url=$(curl -fsSL "$api" | grep -o '"browser_download_url": *"[^"]*-'"$arch"'\.dmg"' | head -n1 | cut -d'"' -f4)

if [ -z "$url" ]; then
  echo "This release has no macOS installer for $arch."
  exit 1
fi

# 3. Install to /Applications
curl -fL "$url" -o /tmp/OpenGitDesktop.dmg
mnt=$(hdiutil attach -nobrowse /tmp/OpenGitDesktop.dmg | tail -n1 | cut -f3)
cp -R "$mnt/OpenGitDesktop.app" /Applications/
hdiutil detach "$mnt" -quiet

# 4. The build is not signed yet: clear the quarantine flag, then open
xattr -dr com.apple.quarantine /Applications/OpenGitDesktop.app
open -a OpenGitDesktop
```

Private-repo fallback for step 2: `gh release download --repo $repo --pattern "*-$arch.dmg" --dir /tmp --clobber`.

> **Note for agents:** if step 2 prints *“This release has no macOS installer”*, tell the user and offer Option B.

#### Option B — Build from the source code

Needs **Node.js 20+** and the Xcode Command Line Tools. Takes a few minutes.

```bash
set -e

# 1. Git (Command Line Tools) and Node.js 20+
git --version >/dev/null 2>&1 || xcode-select --install
if ! node -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)' 2>/dev/null; then
  if command -v brew >/dev/null 2>&1; then brew install node
  else echo "Install Node.js 20+ from https://nodejs.org and run this again."; exit 1; fi
fi

# 2. Get the code (or update an existing copy)
src="$HOME/OpenGitDesktop"
if [ -d "$src/.git" ]; then git -C "$src" pull --ff-only
else git clone --depth 1 https://github.com/CariSoftwareBR/OpenGitDesktop.git "$src"; fi

# 3. Build the app for this Mac (no signing identity needed)
cd "$src/GitWeb"
npm ci
npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --dir --publish never

# 4. Install to /Applications and open
app=$(ls -d dist/mac*/OpenGitDesktop.app | head -n1)
rm -rf /Applications/OpenGitDesktop.app
cp -R "$app" /Applications/
open -a OpenGitDesktop
```

To update a source build later, run the same block again — it pulls the latest code and rebuilds.

### Done

The app opens on the start screen. From there: **Open** a local repository, **Clone** one, or sign in with GitHub.
The AI assistant is optional and is configured later in **Settings**.

---

## Uninstall

| System | Command |
|---|---|
| Windows | Settings → Apps → *OpenGitDesktop* → Uninstall (or run `Uninstall OpenGitDesktop.exe /S` from the install folder) |
| Debian / Ubuntu | `sudo apt-get remove opengitdesktop` |
| AppImage | `rm ~/.local/bin/OpenGitDesktop.AppImage` |
| macOS | `rm -rf /Applications/OpenGitDesktop.app` (source build: also `rm -rf ~/OpenGitDesktop`) |

Your settings live in the system's app-data folder and survive an uninstall.

---

## Good to know

- **Not code-signed yet.** Windows may show SmartScreen on a manual install (*More info → Run anyway*). The auto-updater still checks the SHA-512 hash published with each release.
- **x64 only** for Windows and Linux at the moment. macOS has separate Apple Silicon (`arm64`) and Intel (`x64`) builds.
- **macOS updates are manual for now.** Without Apple's code signature, the in-app updater cannot replace the app;
  install the newer `.dmg` from Releases (Option A) or rerun Option B.
- Prefer to build it yourself? See [`GitWeb/README.en.md`](GitWeb/README.en.md).
