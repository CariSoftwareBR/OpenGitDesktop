import { Bot } from 'lucide-react'
import { isAiConfigured, useAiStore } from '../store/aiStore'
import { useAiUi } from '../lib/useAiUi'

function ErrorExplainButton({ error }: { error: string }): JSX.Element {
  const ui = useAiUi()
  const settings = useAiStore((s) => s.settings)
  const apiKey = useAiStore((s) => s.apiKey)
  const isBusy = useAiStore((s) => s.isBusy)
  const explainBannerError = useAiStore((s) => s.explainBannerError)
  const configured = isAiConfigured(settings, apiKey)

  return (
    <button
      type="button"
      onClick={() => void explainBannerError(error)}
      disabled={isBusy || !configured}
      title={configured ? ui.explainError : ui.explainErrorConfigure}
      aria-label={ui.explainError}
      className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-danger-red transition-colors hover:bg-hover-overlay disabled:opacity-40"
    >
      <Bot size={13} aria-hidden />
    </button>
  )
}

export default ErrorExplainButton
