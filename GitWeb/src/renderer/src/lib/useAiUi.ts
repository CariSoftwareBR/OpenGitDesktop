import { aiUiStrings, type AiLanguage } from '../../../shared/aiPrompts'
import { useLocale } from './i18n'

export function useAiLanguage(): AiLanguage {
  return useLocale()
}

export function useAiUi() {
  return aiUiStrings(useLocale())
}
