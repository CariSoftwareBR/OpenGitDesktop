import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Bot, CheckCircle2, X } from 'lucide-react'
import { useRepoStore } from './store/repoStore'
import { usePullRequestStore } from './store/pullRequestStore'
import { useAppSettingsStore } from './store/appSettingsStore'
import { useAiStore } from './store/aiStore'
import { useResolvedTheme } from './lib/theme'
import { COMPACT_SHELL_QUERY, useMediaQuery } from './lib/useMediaQuery'
import InitialView from './views/InitialView'
import ChangesView from './views/ChangesView'
import HistoryView from './views/HistoryView'
import StashesView from './views/StashesView'
import PullRequestsView from './views/PullRequestsView'
import DashboardView from './views/DashboardView'
import AiChatView from './views/AiChatView'
import SettingsView from './views/SettingsView'
import AboutView from './views/AboutView'
import TopBar from './components/TopBar'
import UpdateBadge from './components/UpdateBadge'
import ErrorExplainButton from './components/ErrorExplainButton'
import { useDocumentLanguage, useT } from './lib/i18n'

const MIN_CHAT_WIDTH = 320
const MAX_CHAT_WIDTH = 720
const DEFAULT_CHAT_WIDTH = 400

function App(): JSX.Element {
  const currentRepoPath = useRepoStore((s) => s.currentRepoPath)
  const view = useRepoStore((s) => s.view)
  const openRepository = useRepoStore((s) => s.openRepository)
  const error = useRepoStore((s) => s.error)
  const clearError = useRepoStore((s) => s.clearError)
  const prError = usePullRequestStore((s) => s.error)
  const clearPrError = usePullRequestStore((s) => s.clearError)
  const prSuccessMessage = usePullRequestStore((s) => s.successMessage)
  const clearPrSuccessMessage = usePullRequestStore((s) => s.clearSuccessMessage)
  const detectRemote = usePullRequestStore((s) => s.detectRemote)
  const loadAppSettings = useAppSettingsStore((s) => s.loadSettings)
  const colorScheme = useAppSettingsStore((s) => s.settings?.colorScheme ?? 'system')
  useResolvedTheme(colorScheme)
  useDocumentLanguage()
  const t = useT().common
  const compactShell = useMediaQuery(COMPACT_SHELL_QUERY)
  const panelOpen = useAiStore((s) => s.panelOpen)
  const setPanelOpen = useAiStore((s) => s.setPanelOpen)
  const floating = useAiStore((s) => s.floating)
  const floatingRect = useAiStore((s) => s.floatingRect)

  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH)
  const draggingRef = useRef(false)

  const handleChatResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      draggingRef.current = true
      const startX = e.clientX
      const startWidth = chatWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(moveEvent: MouseEvent): void {
        if (!draggingRef.current) return
        // Dragging the left edge of the chat: moving left grows the panel.
        const next = startWidth - (moveEvent.clientX - startX)
        setChatWidth(Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, next)))
      }
      function onMouseUp(): void {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [chatWidth]
  )

  useEffect(() => {
    loadAppSettings()
    void useAiStore.getState().loadSettings()
    window.api.settings.get().then(async ({ lastRepositoryPath }) => {
      if (lastRepositoryPath) await openRepository(lastRepositoryPath)
      if (document.documentElement.dataset.browserPreview === 'true') {
        setPanelOpen(true)
      }
    })
    // Runs once on startup to restore the last-opened repository, mirroring
    // RepositoryService's behavior in the WinUI app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (currentRepoPath) detectRemote()
    else usePullRequestStore.getState().reset()
  }, [currentRepoPath, detectRemote])

  useEffect(() => {
    if (!prSuccessMessage) return
    const id = setTimeout(() => clearPrSuccessMessage(), 5000)
    return () => clearTimeout(id)
  }, [prSuccessMessage, clearPrSuccessMessage])

  // External editors change files on disk — refresh when the window is focused
  // again, and lightly poll while visible so Changes stays in sync without
  // having to leave/re-open the repository.
  useEffect(() => {
    if (!currentRepoPath) return

    const STATUS_POLL_MS = 8000
    let pollId: ReturnType<typeof setInterval> | null = null

    function refreshFromDisk(): void {
      const { currentRepoPath: path, isBusy, refreshStatus } = useRepoStore.getState()
      if (!path || isBusy) return
      // Skip background polls while the document is hidden — focus handler
      // refreshes immediately when the window returns.
      if (document.visibilityState !== 'visible') return
      void refreshStatus()
    }

    function startPolling(): void {
      if (pollId !== null) return
      pollId = setInterval(refreshFromDisk, STATUS_POLL_MS)
    }

    function stopPolling(): void {
      if (pollId === null) return
      clearInterval(pollId)
      pollId = null
    }

    function onFocus(): void {
      refreshFromDisk()
      startPolling()
    }

    function onBlur(): void {
      stopPolling()
    }

    function onVisibility(): void {
      if (document.visibilityState === 'visible') onFocus()
      else onBlur()
    }

    if (document.visibilityState === 'visible') startPolling()

    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopPolling()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [currentRepoPath])

  if (view === 'about') {
    return <AboutView />
  }

  if (!currentRepoPath) {
    if (view === 'settings') return <SettingsView />
    return (
      <>
        <InitialView />
        <UpdateBadge />
      </>
    )
  }

  const errors = [error, prError].filter(Boolean) as string[]
  const dockedChat = panelOpen && !floating && !compactShell
  const overlayChat = panelOpen && (floating || compactShell)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-midnight-base">
      <TopBar />
      {errors.map((message, index) => (
        <div
          key={`${index}-${message}`}
          role="alert"
          className="flex items-center gap-2 border-b border-danger-red/30 bg-danger-red-soft px-4 py-2 text-body text-danger-red"
        >
          <AlertCircle size={14} className="shrink-0" aria-hidden />
          <span className="flex-1 break-words">
            {message}
            <ErrorExplainButton error={message} />
          </span>
          <button
            type="button"
            className="hit-area rounded-sm p-1 text-danger-red transition-colors hover:bg-hover-overlay"
            onClick={() => {
              if (message === error) clearError()
              if (message === prError) clearPrError()
            }}
            aria-label={t.dismissError}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {prSuccessMessage && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-success-green/30 bg-success-green-soft px-4 py-2 text-body text-success-green"
        >
          <CheckCircle2 size={14} className="shrink-0" aria-hidden />
          <span className="flex-1 break-words">{prSuccessMessage}</span>
          <button
            type="button"
            className="hit-area rounded-sm p-1 text-success-green transition-colors hover:bg-hover-overlay"
            onClick={clearPrSuccessMessage}
            aria-label={t.dismissSuccess}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <main className="view-enter min-w-0 flex-1 overflow-hidden">
          {view === 'changes' && <ChangesView />}
          {view === 'history' && <HistoryView />}
          {view === 'stash' && <StashesView />}
          {view === 'pullRequests' && <PullRequestsView />}
          {view === 'dashboard' && <DashboardView />}
          {view === 'settings' && <SettingsView />}
        </main>

        {dockedChat && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t.resizeAiChat}
              aria-valuemin={MIN_CHAT_WIDTH}
              aria-valuemax={MAX_CHAT_WIDTH}
              aria-valuenow={chatWidth}
              tabIndex={0}
              onMouseDown={handleChatResizeStart}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  setChatWidth((w) => Math.min(MAX_CHAT_WIDTH, w + 16))
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  setChatWidth((w) => Math.max(MIN_CHAT_WIDTH, w - 16))
                }
              }}
              className="w-1 shrink-0 cursor-col-resize border-l border-default-border bg-transparent transition-colors hover:bg-command-blue/40 active:bg-command-blue/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
            />
            <aside
              className="flex h-full shrink-0 flex-col overflow-hidden border-l border-default-border bg-obsidian-panel"
              style={{ width: chatWidth }}
              aria-label={t.aiChat}
            >
              <AiChatView />
            </aside>
          </>
        )}
        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex w-9 shrink-0 flex-col items-center justify-center gap-2 border-l border-default-border bg-obsidian-panel text-secondary-text transition-colors hover:bg-hover-overlay hover:text-primary-text"
            aria-label={t.openAiChat}
            title={t.openAiChat}
          >
            <Bot size={16} />
          </button>
        )}
      </div>

      {overlayChat && (
        <div
          className="fixed z-30 flex flex-col overflow-hidden rounded-lg border border-default-border bg-obsidian-panel shadow-floating"
          style={
            floating
              ? { left: floatingRect.x, top: floatingRect.y, width: floatingRect.width, height: floatingRect.height }
              : {
                  right: 16,
                  bottom: 16,
                  width: Math.min(chatWidth, window.innerWidth - 32),
                  height: Math.min(520, window.innerHeight - 96)
                }
          }
          aria-label={floating ? t.aiChatFloating : t.aiChat}
        >
          <AiChatView />
        </div>
      )}
    </div>
  )
}

export default App
