import { create } from 'zustand'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../../shared/settings'
import { resolveLocale, type Locale } from '../../../shared/i18n/locales'

const DEFAULTS: AppSettings = DEFAULT_APP_SETTINGS

interface AppSettingsState {
  settings: AppSettings | null
  // OS language as main resolves it. Seeded from navigator so the first paint
  // is already in roughly the right language before the IPC answer arrives.
  systemLocale: Locale
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
}

// Bumps on every load/update so an in-flight get() cannot overwrite a newer
// toggle the user just made (classic SettingsView mount race).
let settingsEpoch = 0

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  settings: null,
  systemLocale: resolveLocale(navigator.languages),

  loadSettings: async () => {
    const epoch = ++settingsEpoch
    void window.api.settings
      .getSystemLocale()
      .then((systemLocale) => set({ systemLocale }))
      .catch(() => undefined)
    const settings = await window.api.settings.get()
    if (epoch !== settingsEpoch) return
    set({ settings })
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const epoch = ++settingsEpoch
    set((state) => ({
      settings: { ...(state.settings ?? DEFAULTS), ...partial }
    }))
    try {
      const settings = await window.api.settings.setAppSettings(partial)
      if (epoch !== settingsEpoch) return
      set({ settings })
    } catch (err) {
      if (epoch !== settingsEpoch) return
      const settings = await window.api.settings.get()
      set({ settings })
      throw err
    }
  }
}))
