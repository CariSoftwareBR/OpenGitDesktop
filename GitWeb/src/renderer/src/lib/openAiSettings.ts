import { create } from 'zustand'
import { useRepoStore } from '../store/repoStore'

export const AI_SETTINGS_SECTION_ID = 'configuracoes-ia'

export type SettingsTab = 'general' | 'ai' | 'appearance'

/** The Settings tab on screen; kept across visits so returning lands where the user left. */
export const useSettingsTabStore = create<{ tab: SettingsTab; setTab: (tab: SettingsTab) => void }>((set) => ({
  tab: 'general',
  setTab: (tab) => set({ tab })
}))

/** Opens Settings on a given tab. */
export function openSettings(tab: SettingsTab): void {
  useSettingsTabStore.getState().setTab(tab)
  useRepoStore.getState().setView('settings')
}

/** Opens Settings on the AI tab. */
export function openAiSettings(): void {
  openSettings('ai')
}
