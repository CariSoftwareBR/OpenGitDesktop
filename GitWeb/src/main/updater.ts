import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/updates'
import { tMain } from './i18n'

const UPDATE_OWNER = 'CariSoftwareBR'
const UPDATE_REPO = 'OpenGitDesktop'

interface ResolvedUpdateFile {
  url: { pathname: string }
  info: { url: string }
}

// Works around a real electron-updater bug that only shows up because this
// repo is private: on a public repo, resolveFiles() keeps each asset's
// filename-suffixed URL (".../gitweb_1.2.3_amd64.deb"), so DebUpdater's
// findFile() can pick the right file by extension. For a private repo,
// PrivateGitHubProvider.resolveFiles() swaps that in for GitHub's API asset
// URL (".../releases/assets/<id>") to attach the auth header — which has no
// file extension at all. findFile()'s extension filter then matches nothing,
// and it silently falls back to files[0], i.e. whichever asset
// electron-builder listed first in latest-linux.yml — the AppImage, since
// `linux.target` in electron-builder.yml lists it before deb. DebUpdater then
// downloads the AppImage and tries `dpkg -i` on it, which fails, retries via
// `apt-get install -f -y` (a no-op — hence the second sudo prompt), and the
// app never actually updates.
//
// Fix: monkeypatch findFile() to also match the extension against
// info.url — the original filename from latest-linux.yml, which
// PrivateGitHubProvider still carries alongside the API asset URL. Since
// this only adds a second way to match (never removes one), it cannot change
// behavior for the public-repo/Windows/macOS/AppImage paths, which already
// match via the URL pathname.
//
// This has to ship in a release before this bug can fix itself: the
// currently-installed binary is what decides which file to download when
// checking for the *next* version, so a build with this patch must be
// installed manually once (see the "Verificar atualizações" error message)
// before auto-update starts working going forward.
function patchPrivateGitHubAssetFileMatching(): void {
  try {
    // require(), not import — this must reach the exact same live module
    // object electron-updater's own internals hold onto (Node's require
    // cache guarantees that), so reassigning findFile here is actually seen
    // by DebUpdater.js's `Provider_1.findFile(...)` call.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const providerModule = require('electron-updater/out/providers/Provider') as {
      findFile: (files: ResolvedUpdateFile[], extension: string, not?: string[] | null) => ResolvedUpdateFile | undefined
    }

    const matchesExtension = (file: ResolvedUpdateFile, extension: string): boolean => {
      const suffix = `.${extension.toLowerCase()}`
      if (file.url.pathname.toLowerCase().endsWith(suffix)) return true
      return file.info.url.toLowerCase().endsWith(suffix)
    }

    providerModule.findFile = (files, extension, not) => {
      if (files.length === 0) {
        throw new Error('No files provided')
      }
      const filteredFiles = files.filter((it) => matchesExtension(it, extension))
      const result =
        filteredFiles.find((it) => [it.url.pathname, it.info.url].some((n) => n.includes(process.arch))) ?? filteredFiles.shift()
      if (result) return result
      if (not == null) return files[0]
      return files.find((fileInfo) => !not.some((ext) => matchesExtension(fileInfo, ext)))
    }
  } catch {
    // electron-updater's internal file layout changed underneath us — fall
    // back to upstream (possibly buggy for the deb+private-repo case)
    // behavior rather than crashing the updater entirely.
  }
}

let currentStatus: UpdateStatus = { state: 'idle' }
/** The version being downloaded, repeated on every progress tick. */
let downloadingTarget: { version: string; releaseNotes: string | null } | null = null
let initialized = false

// True while a check or an autoDownload-triggered download is already in
// flight. Guards against the silent startup timer (fires at +8s) and a
// manual "Verificar atualizações" click both calling
// autoUpdater.checkForUpdates() — two concurrent calls drive the same
// single set of event listeners below, so their checking/available/
// downloading events interleave and the renderer sees the status (and
// download percent) jump backward and oscillate, which reads as the update
// panel "blinking". Covers the whole check-through-download window, not
// just the check step: checkForUpdates() itself only awaits the version
// check, but autoDownload keeps the download running (and this flag set)
// after that promise settles.
function isUpdateInProgress(status: UpdateStatus): boolean {
  return status.state === 'checking' || status.state === 'available' || status.state === 'downloading'
}

function broadcast(status: UpdateStatus): void {
  currentStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('app:update-status', status)
    }
  }
}

// electron-updater's GitHub provider normally returns the release body as a
// plain string (release-notes.md, published by the CI workflow); the
// Array<ReleaseNoteInfo> shape only shows up for multi-version update feeds
// (e.g. generic provider channels), so join defensively rather than assume.
function normalizeReleaseNotes(notes: string | { note?: string | null }[] | null | undefined): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes.trim() || null
  const joined = notes
    .map((n) => n.note?.trim())
    .filter((n): n is string => Boolean(n))
    .join('\n\n')
  return joined || null
}

function formatError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (/404|Unable to find latest version/i.test(raw)) {
    return tMain().updater.releasesUnavailable(`${UPDATE_OWNER}/${UPDATE_REPO}`)
  }
  return raw
}

/**
 * The releases repo is public, so the feed needs no token: updates work for
 * users who never signed in to GitHub, and nobody's token is sent along.
 * Do NOT set `private: true` or pass a token — either one switches
 * electron-updater to PrivateGitHubProvider (GitHub API, rate-limited, and
 * with `private: true` it also picks up any unrelated GH_TOKEN/GITHUB_TOKEN
 * from the environment).
 */
function configureFeed(): void {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: UPDATE_OWNER,
    repo: UPDATE_REPO
  })
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus
}

export function initAutoUpdater(): void {
  if (initialized) return
  initialized = true

  patchPrivateGitHubAssetFileMatching()

  if (!app.isPackaged) {
    currentStatus = {
      state: 'disabled',
      reason: tMain().updater.onlyInstalled
    }
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    broadcast({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    const releaseNotes = normalizeReleaseNotes(info.releaseNotes)
    downloadingTarget = { version: info.version, releaseNotes }
    broadcast({
      state: 'available',
      version: info.version,
      releaseName: info.releaseName ?? null,
      releaseNotes
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    broadcast({
      state: 'not-available',
      version: info.version
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast({
      state: 'downloading',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
      ...downloadingTarget
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({
      state: 'downloaded',
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes)
    })
  })

  autoUpdater.on('error', (err) => {
    broadcast({
      state: 'error',
      message: formatError(err)
    })
  })

  // Quiet startup check — user can also trigger from About.
  setTimeout(() => {
    void checkForUpdates().catch(() => {
      // Errors already flow through the 'error' event / return path.
    })
  }, 8_000)
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    const status: UpdateStatus = {
      state: 'disabled',
      reason: tMain().updater.onlyInstalled
    }
    broadcast(status)
    return status
  }

  // A check or download is already running — return its current status
  // instead of starting a redundant, racing second one.
  if (isUpdateInProgress(currentStatus)) return currentStatus

  configureFeed()

  try {
    broadcast({ state: 'checking' })
    const result = await autoUpdater.checkForUpdates()
    if (!result) {
      const status: UpdateStatus = {
        state: 'error',
        message: tMain().updater.checkFailed
      }
      broadcast(status)
      return status
    }
    // autoDownload keeps running (and broadcasting downloading/downloaded)
    // after this promise settles — checkForUpdates() itself only awaits the
    // version-check step, not the download. currentStatus already reflects
    // whatever the 'update-available'/'update-not-available' listener just
    // broadcast.
    return currentStatus
  } catch (err) {
    const status: UpdateStatus = { state: 'error', message: formatError(err) }
    broadcast(status)
    return status
  }
}

export function quitAndInstall(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall(false, true)
}
