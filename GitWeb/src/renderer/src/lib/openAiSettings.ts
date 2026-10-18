import { useRepoStore } from '../store/repoStore'

export const AI_SETTINGS_SECTION_ID = 'configuracoes-ia'

/** Opens Settings and scrolls to the unified AI section. */
export function openAiSettings(): void {
  useRepoStore.getState().setView('settings')
  window.setTimeout(() => {
    document.getElementById(AI_SETTINGS_SECTION_ID)?.scrollIntoView({ block: 'start' })
  }, 0)
}
