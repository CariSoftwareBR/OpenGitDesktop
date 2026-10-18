import { aiUiStrings, type AiLanguage } from '../../../shared/aiPrompts'
import { useAiStore } from '../store/aiStore'

export function useAiLanguage(): AiLanguage {
  return useAiStore((state) => state.settings?.language ?? 'pt-BR')
}

export function useAiUi() {
  const language = useAiLanguage()
  return aiUiStrings(language)
}
