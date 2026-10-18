import { app, shell, session, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { initAutoUpdater } from './updater'
import { isAppOrigin, RENDERER_INDEX } from './security'
import { getSettings, migrateLegacyAiLanguage } from './settings'
import { applyLanguagePreference } from './language'

// Resolved at runtime from __dirname, so it has to exist both unpackaged and
// inside the asar — electron-builder.yml ships build/icon.{png,ico} for that reason.
// The Windows .exe and the macOS bundle carry their own icon, but the window
// and taskbar entry read this one, and Linux relies on it entirely.
// Windows gets the multi-size .ico: scaling the 1024px PNG down for the
// taskbar looks blurry.
const APP_ICON = join(__dirname, process.platform === 'win32' ? '../../build/icon.ico' : '../../build/icon.png')

// The app was called GitWeb, and Electron names the data folder after the
// product. Pinning the old folder keeps settings, recent repos and saved
// logins: on Windows the key that decrypts secrets.json lives in this folder's
// "Local State", so a fresh folder would leave every stored token unreadable.
// Must run before anything reads userData.
const USER_DATA_DIR = 'GitWeb'
app.setPath('userData', join(app.getPath('appData'), USER_DATA_DIR))

// Must run before app.whenReady(). Chromium's Local Network Access checks
// block or reset fetch() to LAN LLM servers (192.168.x, localhost:11434).
app.commandLine.appendSwitch(
  'disable-features',
  'LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults'
)

// Denies in-app windows and forwards only http/https to the user's browser.
function openExternalAndDeny(url: string): { action: 'deny' } {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      void shell.openExternal(parsed.toString())
    }
  } catch {
    // ignore malformed URLs
  }
  return { action: 'deny' }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    icon: APP_ICON,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.on('console-message', (details) => {
      console.log(`[renderer:${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`)
    })
  }

  // Navigation and window-open guards are installed globally in
  // app.on('web-contents-created') below, which already covers this window.

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(RENDERER_INDEX)
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId('com.gitweb.app')
  // Packaged, the .app bundle's icns sets the Dock icon. Under `npm run dev`
  // the process is Electron.app, so the Dock would show Electron's icon.
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(APP_ICON)

  // Before any IPC handler or the updater can produce a message.
  try {
    await migrateLegacyAiLanguage()
    applyLanguagePreference((await getSettings()).language)
  } catch (err) {
    console.error('Failed to load the language preference:', err)
  }

  // The preload runs on whatever page a webContents ends up showing, so a
  // top-level navigation to a remote origin would hand `window.api` — the whole
  // git and credential surface — to that page. setWindowOpenHandler only covers
  // window.open/target=_blank, so this is the other half of that guard.
  // Applies to every webContents, including any the app doesn't create itself.
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (!isAppOrigin(url)) {
        event.preventDefault()
        openExternalAndDeny(url)
      }
    })
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.setWindowOpenHandler((details) => openExternalAndDeny(details.url))
  })

  // Camera/mic/etc. stay denied. Local-network access has to be allowed —
  // otherwise Chromium blocks the LAN OpenAI-compatible servers this app
  // is built to talk to (Ollama, llama.cpp, Qwen on 192.168.x).
  const allowedPermissions = new Set(['local-network-access'])
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowedPermissions.has(permission))
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowedPermissions.has(permission))
  })

  registerIpcHandlers()
  createWindow()
  initAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
