import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Brain } from 'lucide-react'
import { DEFAULT_CHAT_REASONING_EFFORT, REASONING_EFFORT_LEVELS, resolveActiveConfig } from '../../../shared/ai'
import { useAiStore } from '../store/aiStore'
import { useAiUi } from '../lib/useAiUi'
import { useClickOutside } from '../lib/useClickOutside'

const DEFAULT_EFFORT = DEFAULT_CHAT_REASONING_EFFORT
const LAST = REASONING_EFFORT_LEVELS.length - 1

// Chat-header control for OpenAI-style `reasoning_effort`: a trigger showing the
// current level and a popover with a stepped slider (one stop per level).
function EffortSlider({ disabled }: { disabled?: boolean }): JSX.Element | null {
  const settings = useAiStore((s) => s.settings)
  const chatEffort = useAiStore((s) => s.chatReasoningEffort)
  const setReasoningEffort = useAiStore((s) => s.setChatReasoningEffort)
  const ui = useAiUi()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const effort = chatEffort
  const index = REASONING_EFFORT_LEVELS.indexOf(effort)

  // Direction of the last change drives which side the new label slides in
  // from; `changeKey` remounts the animated nodes so the keyframes replay.
  const previousIndex = useRef(index)
  const [motion, setMotion] = useState<{ key: number; forward: boolean }>({ key: 0, forward: true })
  useEffect(() => {
    if (previousIndex.current === index) return
    setMotion((m) => ({ key: m.key + 1, forward: index > previousIndex.current }))
    previousIndex.current = index
  }, [index])

  if (!settings) return null

  const percent = (index / LAST) * 100
  const model = resolveActiveConfig(settings).model
  const labelClass = motion.key === 0 ? '' : motion.forward ? 'effort-label-in-forward' : 'effort-label-in-back'

  function choose(next: number): void {
    const level = REASONING_EFFORT_LEVELS[Math.min(LAST, Math.max(0, next))]
    if (level !== effort) setReasoningEffort(level)
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ui.chatEffort}: ${ui.chatEffortLevels[effort]}`}
        title={ui.chatEffort}
        className={`btn-ghost overflow-hidden transition-colors duration-300 ${effort === 'off' ? 'text-tertiary-text' : 'text-command-blue'}`}
      >
        <Brain key={`zap-${motion.key}`} size={14} className={motion.key === 0 ? '' : 'effort-zap-pop'} aria-hidden />
        <span key={`trigger-${motion.key}`} className={`text-caption ${labelClass}`}>
          {ui.chatEffortLevels[effort]}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ui.chatEffort}
          className="effort-panel-in absolute left-0 top-[calc(100%+6px)] z-30 w-[300px] origin-top rounded-lg border border-default-border bg-coal-raised p-4 shadow-floating"
        >
          <div className="flex items-start gap-2">
            <Brain
              size={15}
              className={`mt-0.5 shrink-0 transition-colors duration-300 ${effort === 'off' ? 'text-tertiary-text' : 'text-command-blue'}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1 overflow-hidden text-center">
              <p key={`title-${motion.key}`} className={`text-body font-semibold text-primary-text ${labelClass}`}>
                {ui.chatEffortLevels[effort]}
              </p>
              {model && <p className="truncate text-caption text-tertiary-text">{model}</p>}
            </div>
            <button
              type="button"
              onClick={() => choose(REASONING_EFFORT_LEVELS.indexOf(DEFAULT_EFFORT))}
              disabled={effort === DEFAULT_EFFORT}
              className="hit-area effort-reset shrink-0 rounded-sm p-0.5 text-tertiary-text hover:text-primary-text disabled:opacity-40"
              aria-label={ui.chatEffortReset}
              title={ui.chatEffortReset}
            >
              <RotateCcw size={14} aria-hidden />
            </button>
          </div>

          <div className="relative mx-2 mt-4 h-6">
            {/* Visual track; the transparent range input on top owns pointer and keyboard input. */}
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-hover-overlay" />
            <div className="effort-glide absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-primary-text" style={{ width: `${percent}%` }} />
            {REASONING_EFFORT_LEVELS.map((level, i) => (
              <span
                key={level}
                className={`effort-stop absolute top-1/2 size-1.5 rounded-full bg-tertiary-text ${i > index ? 'opacity-100' : 'effort-stop-passed'}`}
                style={{ left: `${(i / LAST) * 100}%` }}
                aria-hidden
              />
            ))}
            <span className="effort-glide absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${percent}%` }} aria-hidden>
              <span
                key={`thumb-${motion.key}`}
                className={`block size-5 rounded-full border-2 border-coal-raised bg-primary-text shadow-floating ${motion.key === 0 ? '' : 'effort-thumb-pop'}`}
              />
            </span>
            <input
              type="range"
              min={0}
              max={LAST}
              step={1}
              value={index}
              onChange={(e) => choose(Number(e.target.value))}
              aria-label={ui.chatEffort}
              aria-valuetext={ui.chatEffortLevels[effort]}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          <p className="mt-3 text-center text-caption text-tertiary-text">{ui.chatEffortHint}</p>
        </div>
      )}
    </div>
  )
}

export default EffortSlider
