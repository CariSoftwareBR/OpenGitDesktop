#!/usr/bin/env bash
# OpenGitDesktop installer for Linux (x64) and macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/CariSoftwareBR/OpenGitDesktop/main/install.sh | bash
#
# Linux:  Debian / Ubuntu / Mint get the .deb (apt, also installs Git);
#         any other distro gets the AppImage in ~/.local/bin.
# macOS:  the ready-made .dmg for this Mac's CPU, copied to /Applications.
#         To build from source instead, see INSTALL.md.
# Set OPENGITDESKTOP_NO_LAUNCH=1 to install without opening the app.

# Everything runs inside main(), so a download cut short never runs half a script.
main() {
  set -euo pipefail

  local repo=CariSoftwareBR/OpenGitDesktop
  local api="https://api.github.com/repos/$repo/releases/latest"
  tmp=$(mktemp -d)  # not local: the EXIT trap runs after main() returns
  trap 'rm -rf "$tmp"' EXIT

  say()  { printf '==> %s\n' "$*"; }
  fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
  launch() { [ "${OPENGITDESKTOP_NO_LAUNCH:-}" != 1 ]; }

  command -v curl >/dev/null 2>&1 || fail "curl is required."

  say "Finding the latest release..."
  local release
  release=$(curl -fsSL -H 'User-Agent: opengitdesktop-install' "$api") || fail "could not read $api"
  # First download URL whose file name matches the pattern (an extended regex).
  asset_url() {
    printf '%s\n' "$release" | grep -oE '"browser_download_url": *"[^"]*'"$1"'"' | head -n1 | cut -d'"' -f4
  }
  download() {  # $1 url, $2 file
    [ -n "$1" ] || fail "this release has no installer for your system."
    say "Downloading ${1##*/}..."
    curl -fL --progress-bar "$1" -o "$2"
  }

  local sudo=""
  [ "$(id -u)" -eq 0 ] || sudo=sudo

  case "$(uname -s)" in
    Linux)
      [ "$(uname -m)" = x86_64 ] || fail "only x64 Linux builds are published for now (this machine is $(uname -m))."

      if command -v apt-get >/dev/null 2>&1; then
        download "$(asset_url '_amd64\.deb')" "$tmp/opengitdesktop.deb"
        chmod 644 "$tmp/opengitdesktop.deb"   # apt's sandbox user must be able to read it
        chmod 755 "$tmp"
        say "Installing the .deb package (this asks for your password)..."
        $sudo apt-get update -qq
        $sudo apt-get install -y git "$tmp/opengitdesktop.deb"
        say "OpenGitDesktop installed. Find it in your app menu, or run: opengitdesktop"
        if launch && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
          nohup opengitdesktop >/dev/null 2>&1 &
        fi
      else
        local bin="$HOME/.local/bin" app
        app="$bin/OpenGitDesktop.AppImage"
        mkdir -p "$bin"
        download "$(asset_url '\.AppImage')" "$tmp/OpenGitDesktop.AppImage"
        chmod +x "$tmp/OpenGitDesktop.AppImage"
        mv -f "$tmp/OpenGitDesktop.AppImage" "$app"
        say "OpenGitDesktop installed: $app"
        command -v git >/dev/null 2>&1 || say "Git was not found: install it with your package manager (the app needs it)."
        say "If it does not start, install FUSE 2 (libfuse2 / fuse2 / fuse-libs)."
        if launch && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
          nohup "$app" >/dev/null 2>&1 &
        fi
      fi
      ;;

    Darwin)
      if ! git --version >/dev/null 2>&1; then
        say "Git is required: opening the Command Line Tools installer. Finish it, then open the app."
        xcode-select --install 2>/dev/null || true
      fi

      local arch=x64
      [ "$(uname -m)" = arm64 ] && arch=arm64
      download "$(asset_url "-$arch\\.dmg")" "$tmp/OpenGitDesktop.dmg"

      say "Installing to /Applications..."
      local mnt="$tmp/mnt" dest=/Applications/OpenGitDesktop.app
      mkdir -p "$mnt"
      hdiutil attach -nobrowse -readonly -quiet -mountpoint "$mnt" "$tmp/OpenGitDesktop.dmg"
      local s=""
      [ -w /Applications ] || s=$sudo
      $s rm -rf "$dest"
      $s cp -R "$mnt/OpenGitDesktop.app" /Applications/
      hdiutil detach "$mnt" -quiet || true

      # The build is not code-signed yet: clear the quarantine flag so it opens.
      $s xattr -dr com.apple.quarantine "$dest" 2>/dev/null || true
      say "OpenGitDesktop installed: $dest"
      if launch; then open -a OpenGitDesktop; fi
      ;;

    *)
      fail "unsupported system $(uname -s). On Windows, run in PowerShell: irm https://raw.githubusercontent.com/$repo/main/install.ps1 | iex"
      ;;
  esac
}

main "$@"
