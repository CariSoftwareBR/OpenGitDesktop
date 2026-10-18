import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { getT } from '../lib/i18n'

interface State {
  error: Error | null
}

/**
 * Last line of defence: without it, a single render error anywhere unmounts the
 * whole tree and leaves an empty window with no way back but restarting. Here
 * the user sees what broke and can reload the UI (the repository and settings
 * live in main, so nothing is lost).
 */
class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    // A class component can't use the hook; the crash screen is static anyway.
    const t = getT().ui
    return (
      <div className="flex h-screen items-center justify-center bg-midnight-base p-6">
        <div role="alert" className="w-full max-w-lg rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating">
          <h1 className="flex items-center gap-2 text-title font-semibold text-primary-text">
            <AlertCircle size={18} className="shrink-0 text-danger-red" aria-hidden />
            {t.crashTitle}
          </h1>
          <p className="mt-2 text-body text-secondary-text">{t.crashMessage}</p>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-coal-raised p-3 font-mono text-caption text-danger-red">
            {error.message}
          </pre>
          <div className="mt-5 flex justify-end">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              {t.reloadUi}
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
