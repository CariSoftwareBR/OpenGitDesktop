import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Every `title` in the app renders through here. Hovering — or focusing from
// the keyboard — an element that has one swaps the OS tooltip for a styled
// one: the attribute is parked in data-tooltip-title while the tooltip is up,
// so the native one never appears, and put back when it goes, leaving the DOM
// as React wrote it. Nothing at the call sites changes; a plain `title` is
// still the way to give a control a tooltip.

const SHOW_DELAY_MS = 450
/** Moving to another control right after a tooltip closed shows the next one at once. */
const WARM_WINDOW_MS = 400
const GAP = 8
const VIEWPORT_MARGIN = 8
const PARKED = 'data-tooltip-title'
const LABELLED = 'data-tooltip-labelled'
const DESCRIBED = 'data-tooltip-describedby'

interface Tip {
  key: number
  target: Element
  text: string
}

interface Position {
  left: number
  top: number
  placement: 'top' | 'bottom'
  arrowX: number
}

function findTarget(node: EventTarget | null): Element | null {
  if (!(node instanceof Element)) return null
  const el = node.closest(`[title], [${PARKED}]`)
  if (!el) return null
  const text = el.getAttribute('title') ?? el.getAttribute(PARKED)
  return text?.trim() ? el : null
}

export default function TooltipLayer(): JSX.Element | null {
  const tooltipId = useId()
  const [tip, setTip] = useState<Tip | null>(null)
  const [pos, setPos] = useState<Position | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current: Element | null = null
    let suppressed: Element | null = null
    let timer: number | undefined
    let shownAt = 0
    let hiddenAt = 0
    let seq = 0
    let observer: MutationObserver | null = null

    // Moves the title aside; while parked the element keeps its accessible
    // name (title is the fallback name of icon-only controls) and points at
    // the tooltip as its description.
    function park(el: Element): void {
      const title = el.getAttribute('title')
      if (title === null) return
      el.setAttribute(PARKED, title)
      el.removeAttribute('title')
      if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !el.textContent?.trim()) {
        el.setAttribute('aria-label', title)
        el.setAttribute(LABELLED, '')
      }
      const describedBy = el.getAttribute('aria-describedby')
      el.setAttribute(DESCRIBED, describedBy ?? '')
      el.setAttribute('aria-describedby', describedBy ? `${describedBy} ${tooltipId}` : tooltipId)
    }

    function restore(el: Element): void {
      const parked = el.getAttribute(PARKED)
      // React may have written a newer title meanwhile; that one wins.
      if (parked !== null && !el.hasAttribute('title')) el.setAttribute('title', parked)
      el.removeAttribute(PARKED)
      if (el.hasAttribute(LABELLED)) {
        el.removeAttribute('aria-label')
        el.removeAttribute(LABELLED)
      }
      if (el.hasAttribute(DESCRIBED)) {
        const previous = el.getAttribute(DESCRIBED)
        if (previous) el.setAttribute('aria-describedby', previous)
        else el.removeAttribute('aria-describedby')
        el.removeAttribute(DESCRIBED)
      }
    }

    function hide(): void {
      window.clearTimeout(timer)
      observer?.disconnect()
      observer = null
      if (current) restore(current)
      if (shownAt) hiddenAt = Date.now()
      shownAt = 0
      current = null
      setTip(null)
      setPos(null)
    }

    function show(el: Element, delay: number): void {
      if (current === el) return
      hide()
      current = el
      park(el)
      // A re-render that sets a new title while it's parked: take the new
      // text and park it again, so the native tooltip stays away.
      observer = new MutationObserver(() => {
        const next = el.getAttribute('title')
        if (next === null) return
        park(el)
        if (shownAt) setTip((t) => (t && t.target === el ? { ...t, text: next } : t))
      })
      observer.observe(el, { attributes: true, attributeFilter: ['title'] })

      const warm = Date.now() - hiddenAt < WARM_WINDOW_MS
      timer = window.setTimeout(
        () => {
          if (!el.isConnected || current !== el) return
          shownAt = Date.now()
          setTip({ key: ++seq, target: el, text: el.getAttribute(PARKED) ?? '' })
        },
        warm ? 0 : delay
      )
    }

    function onPointerOver(e: PointerEvent): void {
      if (e.pointerType === 'touch') return
      const el = findTarget(e.target)
      if (el !== suppressed) suppressed = null
      if (!el) {
        if (current) hide()
        return
      }
      if (el !== suppressed) show(el, SHOW_DELAY_MS)
    }

    function onPointerOut(e: PointerEvent): void {
      // Left the window altogether.
      if (!e.relatedTarget && current) hide()
    }

    // Clicking a control dismisses its tooltip until the pointer leaves it.
    function onPointerDown(e: PointerEvent): void {
      suppressed = findTarget(e.target)
      if (current) hide()
    }

    function onFocusIn(e: FocusEvent): void {
      const target = e.target
      if (!(target instanceof Element) || !target.matches(':focus-visible')) return
      const el = findTarget(target)
      if (el) show(el, SHOW_DELAY_MS)
    }

    function onFocusOut(e: FocusEvent): void {
      if (current && e.target instanceof Element && current.contains(e.target)) hide()
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && current) hide()
    }

    function onScrollOrResize(): void {
      if (current) hide()
    }

    document.addEventListener('pointerover', onPointerOver, true)
    document.addEventListener('pointerout', onPointerOut, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('blur', onScrollOrResize)
    return () => {
      hide()
      document.removeEventListener('pointerover', onPointerOver, true)
      document.removeEventListener('pointerout', onPointerOut, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('blur', onScrollOrResize)
    }
  }, [tooltipId])

  // Above the control when there's room, below otherwise (the header row);
  // slid sideways to stay on screen, with the arrow still on the control.
  useLayoutEffect(() => {
    const node = tipRef.current
    if (!tip || !node) return
    const target = tip.target.getBoundingClientRect()
    const { width, height } = node.getBoundingClientRect()
    const placement = target.top - GAP - height >= VIEWPORT_MARGIN ? 'top' : 'bottom'
    const top = placement === 'top' ? target.top - GAP - height : target.bottom + GAP
    const center = target.left + target.width / 2
    const left = Math.min(Math.max(center - width / 2, VIEWPORT_MARGIN), window.innerWidth - width - VIEWPORT_MARGIN)
    const arrowX = Math.min(Math.max(center - left, 10), width - 10)
    setPos({ left, top, placement, arrowX })
  }, [tip])

  if (!tip) return null

  // A multi-line title reads as a heading plus details.
  const [firstLine, ...rest] = tip.text.split('\n')
  const details = rest.join('\n').trim()

  return createPortal(
    <div
      key={tip.key}
      ref={tipRef}
      id={tooltipId}
      role="tooltip"
      data-placement={pos?.placement}
      className={`app-tooltip pointer-events-none fixed z-[100] max-w-[min(360px,calc(100vw-16px))] rounded-md border border-default-border bg-coal-raised px-2.5 py-1.5 text-caption leading-snug text-primary-text text-balance shadow-floating [overflow-wrap:anywhere] ${
        pos ? '' : 'invisible'
      }`}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
    >
      <span className={details ? 'font-medium' : undefined}>{firstLine}</span>
      {details && <span className="mt-0.5 block whitespace-pre-line text-secondary-text">{details}</span>}
      {pos && (
        <span
          aria-hidden
          className={`absolute size-2 rotate-45 border-default-border bg-coal-raised ${
            pos.placement === 'top' ? '-bottom-[5px] border-b border-r' : '-top-[5px] border-l border-t'
          }`}
          style={{ left: pos.arrowX - 4 }}
        />
      )}
    </div>,
    document.body
  )
}
