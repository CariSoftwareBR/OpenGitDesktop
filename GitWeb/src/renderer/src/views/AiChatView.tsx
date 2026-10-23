import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  GitBranch,
  Loader2,
  Maximize2,
  Minimize2,
  PanelRightClose,
  RotateCcw,
  SendHorizontal,
  Settings2,
  Square,
  Trash2,
  User,
  X
} from 'lucide-react'
import { useAiStore, isAiConfigured } from '../store/aiStore'
import { useGithubAuthStore } from '../store/githubAuthStore'
import { useRepoStore } from '../store/repoStore'
import ConfirmDialog from '../components/ConfirmDialog'
import EffortSlider from '../components/EffortSlider'
import Markdown from '../components/Markdown'
import ToolResult from '../components/ToolResult'
import ToolRunGroup from '../components/ToolRunGroup'
import InvestigationRunGroup from '../components/InvestigationRunGroup'
import PatchPreviewDialog from '../components/PatchPreviewDialog'
import ErrorExplainButton from '../components/ErrorExplainButton'
import { groupChatMessages, type ChatRenderItem } from '../lib/ai/chatGrouping'
import { captureDust, prefersReducedMotion } from '../lib/disintegrate'
import { isEmptyInvestigationMarkdown } from '../lib/ai/commitInvestigation'
import { toolSeverity, type ToolPreview, type ToolSeverity } from '../lib/ai/tools'
import { openAiSettings } from '../lib/openAiSettings'
import { useAiUi } from '../lib/useAiUi'

function severityStyles(severity: ToolSeverity | undefined, status: string): string {
  if (status === 'completed') return 'border-success-green/40'
  if (status === 'failed') return 'border-danger-red/40'
  if (status === 'cancelled') return 'border-default-border opacity-60'
  if (status === 'running') return 'border-default-border'

  if (severity === 'danger') return 'border-danger-red/50 bg-danger-red-soft/40'
  if (severity === 'write') return 'border-attention-orange/40'
  return 'border-default-border'
}

// Heuristic for "the assistant is asking which branch, not just narrating a
// decision it already made" — requires an actual question ending in "?" that
// mentions branches, so a declarative message like "vou criar o PR agora"
// doesn't get chips attached to it.
function looksLikeBranchQuestion(content: string): boolean {
  const trimmed = content.trim()
  return /\?\s*$/.test(trimmed) && /branch/i.test(trimmed)
}

// Lets the user answer a branch-related question by clicking a chip instead
// of typing the branch name.
function BranchQuickReplies(): JSX.Element | null {
  const branches = useRepoStore((s) => s.branches)
  const isBusy = useAiStore((s) => s.isBusy)
  const sendMessage = useAiStore((s) => s.sendMessage)
  if (branches.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {branches.map((b) => (
        <button
          key={b.name}
          onClick={() => sendMessage(b.name)}
          disabled={isBusy}
          className="btn-secondary h-7 min-w-0 max-w-full gap-1 px-2.5 text-caption"
          title={b.name}
        >
          <GitBranch size={11} className="shrink-0" /> <span className="truncate">{b.name}</span>
        </button>
      ))}
    </div>
  )
}

type PreviewFieldGroup = { block: true; field: ToolPreview['fields'][number] } | { block: false; fields: ToolPreview['fields'] }

// Consecutive one-line fields share one label/value grid, so their values
// line up and wrap inside their own column however narrow the panel gets; a
// multi-line value (a command, a file list) breaks the run with a full-width block.
function groupPreviewFields(fields: ToolPreview['fields']): PreviewFieldGroup[] {
  const groups: PreviewFieldGroup[] = []
  for (const field of fields) {
    const last = groups[groups.length - 1]
    if (field.value.includes('\n')) groups.push({ block: true, field })
    else if (last && !last.block) last.fields.push(field)
    else groups.push({ block: false, fields: [field] })
  }
  return groups
}

function ToolCallCard({ messageId, uiCall }: { messageId: string; uiCall: import('../store/aiStore').UiToolCall }): JSX.Element {
  const ui = useAiUi()
  const approveToolCall = useAiStore((s) => s.approveToolCall)
  const cancelToolCall = useAiStore((s) => s.cancelToolCall)
  const retryToolCall = useAiStore((s) => s.retryToolCall)
  const severity = uiCall.preview.severity ?? 'read'
  const borderColor = severityStyles(severity, uiCall.status)
  const approveClass =
    severity === 'danger' ? 'btn-danger h-8 px-3' : severity === 'write' ? 'btn-primary h-8 px-3' : 'btn-secondary h-8 px-3'
  const approveLabel = severity === 'danger' ? ui.toolApproveDanger : ui.toolApprove
  const isReadPullRequest = uiCall.call.name === 'read_pull_request'

  return (
    <div className={`@container min-w-0 rounded-md border bg-coal-raised p-3 text-body transition-colors duration-200 ${borderColor}`}>
      <div className="flex items-start gap-2 font-medium text-primary-text">
        {uiCall.status === 'running' && <Loader2 size={13} className="mt-[3px] shrink-0 animate-spin text-secondary-text" />}
        {uiCall.status === 'pending' && severity === 'danger' && (
          <AlertTriangle size={13} className="mt-[3px] shrink-0 text-danger-red" aria-hidden />
        )}
        <span className="min-w-0 [overflow-wrap:anywhere]">{uiCall.preview.headline}</span>
      </div>
      {groupPreviewFields(uiCall.preview.fields).map((group, index) =>
        group.block ? (
          <div key={group.field.label} className="mt-2.5 text-caption">
            <div className="mb-1 text-secondary-text">{group.field.label}</div>
            <div className="min-w-0 overflow-x-auto rounded-md border border-default-border bg-midnight-base px-2.5 py-2 text-body text-primary-text">
              <Markdown text={group.field.value} />
            </div>
          </div>
        ) : (
          <dl key={index} className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-caption">
            {group.fields.map((f) => (
              <Fragment key={f.label}>
                <dt className="text-secondary-text">{f.label}</dt>
                <dd className="min-w-0 whitespace-pre-wrap text-primary-text [overflow-wrap:anywhere]">{f.value}</dd>
              </Fragment>
            ))}
          </dl>
        )
      )}
      {uiCall.preview.warning && (
        <div
          className={`mt-2 flex items-start gap-1.5 text-caption ${
            severity === 'danger' ? 'text-danger-red' : 'text-attention-orange'
          }`}
          role="status"
        >
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{uiCall.preview.warning}</span>
        </div>
      )}

      {uiCall.status === 'pending' && (
        // Compact on the right when the card is wide; in a narrow panel they
        // share the row, and stack full-width once their labels no longer fit.
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-default-border pt-3">
          <button
            onClick={() => cancelToolCall(messageId, uiCall.call.id)}
            className="btn-secondary h-8 flex-auto px-3 @[22rem]:flex-none"
          >
            <X size={13} /> {ui.toolCancel}
          </button>
          <button onClick={() => approveToolCall(messageId, uiCall.call.id)} className={`${approveClass} flex-auto @[22rem]:flex-none`}>
            <Check size={13} /> {approveLabel}
          </button>
        </div>
      )}
      {uiCall.status === 'running' && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-default-border pt-2 text-caption" role="status">
          <span className="agent-busy-shimmer leading-[18px]">{ui.toolExecuting}</span>
        </div>
      )}
      {uiCall.status === 'failed' && (
        <div className="mt-2.5 flex flex-col gap-2 border-t border-default-border pt-2">
          <ToolResult text={uiCall.result ?? ''} tone="danger" />
          <button onClick={() => retryToolCall(messageId, uiCall.call.id)} className="btn-secondary h-8 w-fit px-3">
            <RotateCcw size={13} /> {ui.toolRetry}
          </button>
        </div>
      )}
      {(uiCall.status === 'completed' || uiCall.status === 'cancelled') && (
        <div className="mt-2.5 border-t border-default-border pt-2">
          <ToolResult
            text={uiCall.result ?? ''}
            tone="default"
            markdown={isReadPullRequest}
            headerLines={isReadPullRequest ? 5 : undefined}
          />
        </div>
      )}
    </div>
  )
}

function ChatAvatar({ role }: { role: 'user' | 'assistant' }): JSX.Element {
  const avatarUrl = useGithubAuthStore((s) => s.user?.avatarUrl)
  // A signed-in user sees their own GitHub photo here, the same identity the
  // top bar shows; the generic icon stays the fallback for signed-out sessions
  // and for a photo that fails to load.
  const [avatarFailed, setAvatarFailed] = useState(false)
  const isUser = role === 'user'

  if (isUser && avatarUrl && !avatarFailed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden
        onError={() => setAvatarFailed(true)}
        className="size-7 shrink-0 rounded-full border border-command-blue/35 object-cover"
      />
    )
  }

  return (
    <div
      className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${
        isUser
          ? 'border-command-blue/35 bg-command-blue-soft text-command-blue'
          : 'border-default-border bg-coal-raised text-secondary-text'
      }`}
      aria-hidden
    >
      {isUser ? <User size={14} /> : <Bot size={14} />}
    </div>
  )
}

function ThinkingBubble(): JSX.Element {
  const ui = useAiUi()
  return (
    <div className="flex items-start gap-2">
      <ChatAvatar role="assistant" />
      <div className="flex items-center pt-[3px] text-body">
        <span className="agent-busy-shimmer leading-[22px]" role="status">
          {ui.chatThinking}
        </span>
      </div>
    </div>
  )
}

function AiChatView(): JSX.Element {
  const settings = useAiStore((s) => s.settings)
  const apiKey = useAiStore((s) => s.apiKey)
  const messages = useAiStore((s) => s.messages)
  const isBusy = useAiStore((s) => s.isBusy)
  const phase = useAiStore((s) => s.phase)
  const error = useAiStore((s) => s.error)
  const loadSettings = useAiStore((s) => s.loadSettings)
  const sendMessage = useAiStore((s) => s.sendMessage)
  const clearChat = useAiStore((s) => s.clearChat)
  const clearError = useAiStore((s) => s.clearError)
  const stopGeneration = useAiStore((s) => s.stopGeneration)
  const retryAssistantTurn = useAiStore((s) => s.retryAssistantTurn)
  const setPanelOpen = useAiStore((s) => s.setPanelOpen)
  const floating = useAiStore((s) => s.floating)
  const setFloating = useAiStore((s) => s.setFloating)
  const floatingRect = useAiStore((s) => s.floatingRect)
  const setFloatingRect = useAiStore((s) => s.setFloatingRect)
  const proposeFix = useAiStore((s) => s.proposeFix)
  const applyPendingFix = useAiStore((s) => s.applyPendingFix)
  const dismissPendingFix = useAiStore((s) => s.dismissPendingFix)
  const pendingFix = useAiStore((s) => s.pendingFix)
  const ui = useAiUi()

  const isConfigured = isAiConfigured(settings, apiKey)

  const [input, setInput] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  // Consecutive read-only calls of the same tool render as one progress card
  // instead of one approval card per call — see groupChatMessages.
  const renderItems = useMemo(() => groupChatMessages(messages), [messages])

  // Clearing the chat turns it to dust. The moment the conversation empties,
  // the last items keep rendering as a "ghost" (decided during render, so no
  // frame ever shows the empty chat early) just long enough to be snapshotted
  // into the dust overlay; then the real, empty chat is swapped in beneath it.
  const [ghost, setGhost] = useState<ChatRenderItem[] | null>(null)
  const [prevRenderItems, setPrevRenderItems] = useState(renderItems)
  if (renderItems !== prevRenderItems) {
    setPrevRenderItems(renderItems)
    if (
      renderItems.length === 0 &&
      prevRenderItems.length > 0 &&
      !prefersReducedMotion()
    ) {
      setGhost(prevRenderItems)
    }
  }
  // A new message mid-snap wins over the ghost.
  const activeGhost = ghost && renderItems.length === 0 ? ghost : null

  // Starting a conversation dusts the welcome screen the same way: as soon as
  // the agent gets work, the welcome stays put (the conversation held back)
  // until it's been snapshotted, then the conversation appears beneath it.
  // The ghost check keeps a clear — which also empties the chat — from
  // counting as "a conversation started".
  const welcomeVisible = messages.length === 0 && !isBusy && !activeGhost
  const [welcomeDusting, setWelcomeDusting] = useState(false)
  const [prevWelcomeVisible, setPrevWelcomeVisible] = useState(welcomeVisible)
  if (welcomeVisible !== prevWelcomeVisible) {
    setPrevWelcomeVisible(welcomeVisible)
    setWelcomeDusting(
      !welcomeVisible && !activeGhost && !prefersReducedMotion()
    )
  }
  const showWelcome = welcomeVisible || welcomeDusting
  const displayItems = welcomeDusting ? [] : (activeGhost ?? renderItems)

  /** Snapshots the chat area into dust, then runs `swap` to reveal what's next. */
  function dustAndSwap(swap: () => void): () => void {
    const container = scrollRef.current
    const frame = requestAnimationFrame(() => {
      void (async () => {
        try {
          if (!container) throw new Error('Chat indisponível.')
          const dust = await captureDust(container.getBoundingClientRect())
          swap()
          void dust.play()
        } catch {
          // The effect is decoration; if the snapshot fails, just move on.
          swap()
        }
      })()
    })
    return () => cancelAnimationFrame(frame)
  }

  useEffect(() => (ghost ? dustAndSwap(() => setGhost(null)) : undefined), [ghost])
  useEffect(() => (welcomeDusting ? dustAndSwap(() => setWelcomeDusting(false)) : undefined), [welcomeDusting])

  // Only real approval gates count here. Read-only tools run without asking
  // (see aiStore's auto-approve loop), so they pass through pending/running in
  // a blink — counting them made the header badge flash on every file the
  // assistant read, announcing an approval that was never being waited on.
  const pendingCount = messages.reduce(
    (n, m) => n + (m.toolCalls?.filter((c) => c.status === 'pending' && toolSeverity(c.call.name) !== 'read').length ?? 0),
    0
  )
  const hasPendingGates = pendingCount > 0

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // A newly arrived assistant reply is anchored at its first line rather than
  // its last — replies like "Explicar diff" land whole and are read top-down.
  // Replies shorter than the viewport still end up flush with the bottom.
  const lastMessage = messages[messages.length - 1]
  const lastAnchoredIdRef = useRef(lastMessage?.id)
  useEffect(() => {
    // Nothing to follow in an empty chat — and while it's being dusted, the
    // ghost must stay exactly where the user last saw it.
    if (messages.length === 0 || !stickToBottomRef.current) return
    const container = scrollRef.current
    if (lastMessage && lastMessage.id !== lastAnchoredIdRef.current) {
      lastAnchoredIdRef.current = lastMessage.id
      const row = container?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(lastMessage.id)}"]`)
      if (container && row && lastMessage.role === 'assistant') {
        const gap = parseFloat(getComputedStyle(container).paddingTop) || 0
        container.scrollTop += row.getBoundingClientRect().top - container.getBoundingClientRect().top - gap
        // Set now: the phase change that follows would otherwise re-run this
        // effect before the scroll event lands and yank the view to the end.
        stickToBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 48
        return
      }
    }
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages, phase, lastMessage])

  function handleChatScroll(): void {
    const element = scrollRef.current
    if (!element) return
    stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
  }

  async function handleSend(): Promise<void> {
    if (!input.trim() || isBusy) return
    const text = input.trim()
    setInput('')
    stickToBottomRef.current = true
    await sendMessage(text)
  }

  function handleClearClick(): void {
    if (hasPendingGates || messages.length > 0) {
      setConfirmClear(true)
      return
    }
    clearChat()
  }

  function applyExample(prompt: string): void {
    if (isBusy || !isConfigured) return
    setInput(prompt)
  }

  // Drag-to-move for the floating window — clicking the header's empty space
  // moves it, clicking an actual button in it still works normally.
  function handleHeaderMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    if (!floating) return
    // The effort popover lives inside the header too: dragging its slider must
    // not drag the window.
    if ((e.target as HTMLElement).closest('button, input, [role="dialog"]')) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startRect = floatingRect
    document.body.style.userSelect = 'none'

    function onMouseMove(moveEvent: MouseEvent): void {
      const maxX = Math.max(0, window.innerWidth - startRect.width)
      const maxY = Math.max(0, window.innerHeight - startRect.height)
      setFloatingRect({
        x: Math.min(Math.max(0, startRect.x + (moveEvent.clientX - startX)), maxX),
        y: Math.min(Math.max(0, startRect.y + (moveEvent.clientY - startY)), maxY)
      })
    }
    function onMouseUp(): void {
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // Resize-by-corner for the floating window — no upper bound besides the
  // viewport, so it can be made "as big as wanted" like the user asked.
  function handleResizeStart(e: React.MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startRect = floatingRect
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(moveEvent: MouseEvent): void {
      const maxWidth = window.innerWidth - startRect.x
      const maxHeight = window.innerHeight - startRect.y
      setFloatingRect({
        width: Math.min(maxWidth, Math.max(360, startRect.width + (moveEvent.clientX - startX))),
        height: Math.min(maxHeight, Math.max(320, startRect.height + (moveEvent.clientY - startY)))
      })
    }
    function onMouseUp(): void {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const composerDisabledReason = !isConfigured
    ? ui.chatComposerNotConfigured
    : isBusy
      ? ui.chatComposerBusy
      : undefined

  return (
    <div className="@container relative flex h-full min-h-0 flex-col">
      {floating && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={ui.chatFloatResize}
          aria-valuemin={360}
          aria-valuemax={Math.max(360, Math.floor(typeof window !== 'undefined' ? window.innerWidth - floatingRect.x : 360))}
          aria-valuenow={Math.round(floatingRect.width)}
          tabIndex={0}
          onMouseDown={handleResizeStart}
          onKeyDown={(e) => {
            const step = 16
            if (e.key === 'ArrowRight') {
              e.preventDefault()
              setFloatingRect({
                width: Math.min(window.innerWidth - floatingRect.x, floatingRect.width + step)
              })
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setFloatingRect({ width: Math.max(360, floatingRect.width - step) })
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setFloatingRect({
                height: Math.min(window.innerHeight - floatingRect.y, floatingRect.height + step)
              })
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setFloatingRect({ height: Math.max(320, floatingRect.height - step) })
            }
          }}
          className="absolute bottom-0 right-0 z-10 size-6 cursor-nwse-resize rounded-tl-sm hover:bg-command-blue/30 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-command-blue"
        />
      )}
      <div
        className={`relative flex min-w-0 items-center gap-1 border-b border-default-border p-2 ${floating ? 'cursor-move' : ''}`}
        onMouseDown={handleHeaderMouseDown}
      >
            <button
              type="button"
              onClick={() => openAiSettings()}
              className="btn-ghost"
              title={ui.chatSettings}
              aria-label={ui.chatSettings}
            >
              <Settings2 size={14} aria-hidden />
              <span className="hidden @[420px]:inline">{ui.chatSettingsLabel}</span>
            </button>
            <button
              type="button"
              onClick={handleClearClick}
              className="btn-ghost text-tertiary-text"
              disabled={messages.length === 0 && !hasPendingGates}
              title={hasPendingGates ? ui.chatClearPending : ui.chatClear}
              aria-label={hasPendingGates ? ui.chatClearPending : ui.chatClear}
            >
              <Trash2 size={14} aria-hidden />
              <span className="hidden @[420px]:inline">{ui.chatClear}</span>
            </button>
            {hasPendingGates && (
              <span className="rounded-pill border border-attention-orange/40 bg-attention-orange-soft px-2 py-0.5 text-caption text-attention-orange">
                {pendingCount}
              </span>
            )}
            <EffortSlider disabled={isBusy} />
            <button
              className="btn-ghost ml-auto text-tertiary-text"
              onClick={() => setFloating(!floating)}
              aria-label={floating ? ui.chatDock : ui.chatFloat}
              title={floating ? ui.chatDockBack : ui.chatFloat}
              aria-pressed={floating}
            >
              {floating ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              className="btn-ghost text-tertiary-text"
              onClick={() => setPanelOpen(false)}
              aria-label={floating ? ui.chatCloseFloat : ui.chatCollapse}
              title={floating ? ui.chatCloseFloat : ui.chatCollapse}
            >
              {floating ? <X size={15} /> : <PanelRightClose size={15} />}
            </button>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 border-b border-danger-red/30 bg-danger-red-soft px-3 py-2 text-body text-danger-red">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 break-words">
                {error}
                <ErrorExplainButton error={error} />
              </span>
              <button
                type="button"
                className="btn-ghost h-7 shrink-0 px-2 text-danger-red"
                onClick={() => retryAssistantTurn()}
                disabled={isBusy}
                aria-label={ui.chatRetry}
              >
                <RotateCcw size={13} />
              </button>
              <button type="button" className="hit-area rounded-sm p-1 hover:bg-hover-overlay" onClick={clearError} aria-label={ui.chatCloseError}>
                <X size={14} />
              </button>
            </div>
          )}

          <div ref={scrollRef} onScroll={handleChatScroll} className="relative min-h-0 flex-1 overflow-y-auto p-3">
            {showWelcome && (
              <div
                aria-hidden={welcomeDusting || undefined}
                className={`flex h-full flex-col items-center justify-center gap-4 px-2 text-center ${
                  welcomeDusting ? 'pointer-events-none' : ''
                }`}
              >
                {/* Two elements: .ai-emblem's breathing loop and .rise-in both set
                    `animation`, so on one element the entrance would be lost. */}
                <span className="rise-in">
                  <span className="ai-emblem">
                    <Bot size={22} aria-hidden />
                  </span>
                </span>
                <div className="rise-in max-w-[34ch] space-y-1.5 [animation-delay:60ms]">
                  <p className="text-title font-semibold text-primary-text">{ui.chatEmptyTitle}</p>
                  <p className="text-caption text-secondary-text text-pretty">{ui.chatEmptyBody}</p>
                </div>
                {!isConfigured && (
                  <button type="button" onClick={() => openAiSettings()} className="btn-primary">
                    <Settings2 size={14} aria-hidden />
                    {ui.chatConfigure}
                  </button>
                )}
                <div className="rise-in flex w-full max-w-[400px] flex-col gap-1.5 [animation-delay:120ms]">
                  {ui.examplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => applyExample(prompt)}
                      disabled={!isConfigured || isBusy}
                      className="group/prompt flex items-center gap-2 rounded-md border border-default-border bg-coal-raised px-3 py-2 text-left text-caption text-secondary-text shadow-[var(--shadow-raised)] transition-[border-color,color,background-color,transform] duration-150 hover:border-command-blue/40 hover:bg-active-overlay hover:text-primary-text active:scale-[0.99] disabled:opacity-40"
                    >
                      <span className="flex-1">{prompt}</span>
                      <ArrowUpRight
                        size={13}
                        className="shrink-0 text-command-blue opacity-0 transition-[opacity,transform] duration-200 group-hover/prompt:translate-x-0.5 group-hover/prompt:-translate-y-0.5 group-hover/prompt:opacity-100"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {displayItems.map((item, itemIdx) =>
                item.kind === 'group' ? (
                  // Same row shape as an assistant message (avatar gutter +
                  // full column) so the group card lines up with the replies
                  // and tool cards above and below it.
                  <div key={item.id} className="flex items-start gap-2">
                    <ChatAvatar role="assistant" />
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                      <ToolRunGroup
                        toolName={item.toolName}
                        steps={item.steps}
                        hasFollowingMessage={itemIdx < displayItems.length - 1}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    key={item.message.id}
                    data-message-id={item.message.id}
                    className={`flex gap-2 ${item.message.role === 'user' ? 'flex-row-reverse items-end' : 'items-start'}`}
                  >
                    <ChatAvatar role={item.message.role === 'user' ? 'user' : 'assistant'} />
                    <div
                      className={`flex min-w-0 flex-col gap-2 ${
                        item.message.role === 'user' ? 'max-w-[85%] items-end' : 'flex-1 items-start'
                      }`}
                    >
                      {item.message.investigation && (
                        <InvestigationRunGroup
                          {...item.message.investigation}
                          findings={item.message.investigation.findings ?? []}
                          onProposeFix={(finding) => void proposeFix(finding)}
                          proposingId={pendingFix?.status === 'proposing' ? pendingFix.finding.id : null}
                        />
                      )}
                      {item.message.content &&
                        !(item.message.investigation && isEmptyInvestigationMarkdown(item.message.content)) &&
                        (item.message.role === 'user' ? (
                          <div className="min-w-0 max-w-full whitespace-pre-wrap rounded-lg border border-command-blue/30 bg-command-blue-soft px-3 py-2 text-body text-primary-text [overflow-wrap:anywhere]">
                            {item.message.content}
                          </div>
                        ) : (
                          // Replies are plain prose on the panel, no box: the user's
                          // bubble and the tool cards are what stand out. pt-[3px]
                          // centers the first line on the avatar; max-w-full keeps
                          // a wide code block or table scrolling inside the column.
                          <div className="min-w-0 max-w-full pt-[3px] text-body leading-relaxed text-primary-text">
                            <Markdown text={item.message.content} />
                          </div>
                        ))}
                      {item.message.toolCalls?.map((uiCall) => (
                        <div key={uiCall.call.id} className="w-full">
                          <ToolCallCard messageId={item.message.id} uiCall={uiCall} />
                        </div>
                      ))}
                      {/* Lets the user answer a "which branch?" question by clicking
                          instead of typing — only on the newest assistant message,
                          while it's genuinely the user's turn to reply. The index
                          compared here is the one in `messages`, not in the grouped
                          list, so grouping can't shift what counts as "newest". */}
                      {item.index === messages.length - 1 &&
                        item.message.role === 'assistant' &&
                        !item.message.toolCalls?.length &&
                        phase === 'idle' &&
                        !isBusy &&
                        looksLikeBranchQuestion(item.message.content) && <BranchQuickReplies />}
                    </div>
                  </div>
                )
              )}
              {phase === 'thinking' && !activeGhost && !welcomeDusting && (
                <div className="rise-in flex flex-col items-start gap-2">
                  <ThinkingBubble />
                </div>
              )}
            </div>
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-default-border p-2">
            <div className="relative">
              <textarea
                placeholder={ui.chatPlaceholder}
                aria-label={ui.chatPlaceholder}
                title={composerDisabledReason}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                disabled={!isConfigured || isBusy}
                rows={3}
                className="field min-h-[88px] w-full resize-y pb-11 pr-12 leading-normal"
              />
              {phase === 'thinking' || phase === 'executing' ? (
                <button
                  onClick={stopGeneration}
                  className="absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-md border border-default-border bg-coal-raised text-secondary-text transition-colors hover:bg-hover-overlay hover:text-primary-text"
                  aria-label={ui.chatStopAria}
                  title={ui.chatStop}
                >
                  <Square size={12} className="fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!isConfigured || isBusy || !input.trim()}
                  className="absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-action-surface text-action-ink transition-[filter,transform] duration-100 hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                  aria-label={ui.chatSend}
                  title={ui.chatSend}
                >
                  <SendHorizontal size={14} />
                </button>
              )}
            </div>
          </div>

      <ConfirmDialog
        open={confirmClear}
        title={ui.chatClearTitle}
        message={hasPendingGates ? ui.chatClearPendingMessage(pendingCount) : ui.chatClearMessage}
        confirmLabel={ui.chatClearConfirm}
        danger
        confirmClassName="btn-clear-chat-confirm"
        onConfirm={() => {
          setConfirmClear(false)
          clearChat()
        }}
        onCancel={() => setConfirmClear(false)}
      />
      <PatchPreviewDialog
        open={pendingFix?.status === 'ready' || pendingFix?.status === 'applying'}
        title={ui.patchPreviewTitle}
        message={ui.patchPreviewMessage(pendingFix?.finding.claim ?? '')}
        diffText={pendingFix?.diff ?? ''}
        confirmLabel={ui.patchPreviewConfirm}
        busy={pendingFix?.status === 'applying'}
        onConfirm={() => void applyPendingFix()}
        onCancel={dismissPendingFix}
      />
    </div>
  )
}

export default AiChatView
