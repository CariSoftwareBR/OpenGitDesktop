import { useLayoutEffect, useRef } from 'react'

/**
 * The raised pill behind the active option of a `.clone-segmented` control,
 * sliding from the old option to the new one instead of the background just
 * blinking across. Drop it in as the control's first child.
 *
 * It finds the active option by its ARIA state (`aria-selected` on tabs,
 * `aria-checked` on radios) and writes position and width straight onto its
 * own element: no React state, so a click costs one render, and a resize of
 * the control (the PR list is draggable) only moves the pill.
 *
 * It leaves on press, not on release: a click only fires on mouseup, and
 * waiting for it made every switch read as "click, then slide". If the press
 * ends anywhere but on that option, the pill goes back to the real selection.
 */
function SegmentThumb({ activeKey }: { activeKey: string }): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const thumb = ref.current
    const control = thumb?.parentElement
    if (!thumb || !control) return
    // Which option it was last sent to; also what makes a new choice re-place it.
    thumb.dataset.option = activeKey

    function moveTo(option: HTMLElement | null): void {
      if (!thumb) return
      if (!option) {
        thumb.style.opacity = '0'
        return
      }
      thumb.style.opacity = '1'
      thumb.style.width = `${option.offsetWidth}px`
      thumb.style.transform = `translateX(${option.offsetLeft}px)`
    }

    function selected(): HTMLElement | null {
      return control?.querySelector<HTMLElement>('[aria-selected="true"], [aria-checked="true"]') ?? null
    }

    function place(): void {
      moveTo(selected())
    }

    function onPointerDown(e: PointerEvent): void {
      if (e.button !== 0) return
      const option = (e.target as HTMLElement).closest<HTMLElement>('.clone-segment')
      if (option && !option.matches(':disabled') && control?.contains(option)) moveTo(option)
    }

    // A press released elsewhere (or cancelled) never clicks: go back home.
    // A real click re-renders first, and its layout effect places the pill
    // on the new selection before this frame runs.
    function onPointerEnd(): void {
      requestAnimationFrame(place)
    }

    place()
    // First placement lands without motion; only later moves slide.
    const frame = requestAnimationFrame(() => {
      thumb.dataset.ready = 'true'
    })
    const observer = new ResizeObserver(place)
    observer.observe(control)
    control.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      control.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerEnd)
    }
  }, [activeKey])

  return <span ref={ref} className="clone-segment-thumb" aria-hidden />
}

export default SegmentThumb
