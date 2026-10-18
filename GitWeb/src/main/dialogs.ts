import { dialog, BrowserWindow } from 'electron'

export async function openDirectoryDialog(window: BrowserWindow | null): Promise<string | null> {
  const result = window
    ? await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
    : await dialog.showOpenDialog({ properties: ['openDirectory'] })

  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}
