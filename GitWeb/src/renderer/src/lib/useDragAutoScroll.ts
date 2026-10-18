import { useEffect, type RefObject } from 'react'

/** Distance from an edge, in px, where scrolling kicks in. */
const EDGE_ZONE = 90
/** Scroll speed at the very edge, in px per frame. */
const MAX_SPEED = 20

/**
 * Scrolls `ref` while a drag hovers near its top or bottom edge.
 *
 * HTML5 drag-and-drop does not auto-scroll a custom overflow container, so a
 * card near the bottom of a long list simply cannot be dragged to a folder that
 * is scrolled off the top — the pointer reaches the edge and nothing moves.
 * Speed ramps up with proximity so a slow approach nudges rather than jumps.
 */
export function useDragAutoScroll(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const element = ref.current
    if (!element || !active) return

    let pointerY: number | null = null
    let frame = 0

    // dragover fires on whatever is under the pointer and bubbles up here, so
    // this sees the pointer even over children that handle their own drops.
    const handleDragOver = (event: DragEvent): void => {
      pointerY = event.clientY
    }

    const step = (): void => {
      frame = requestAnimationFrame(step)
      if (pointerY === null) return

      const rect = element.getBoundingClientRect()
      const fromTop = pointerY - rect.top
      const fromBottom = rect.bottom - pointerY

      let delta = 0
      if (fromTop < EDGE_ZONE) delta = -MAX_SPEED * (1 - Math.max(0, fromTop) / EDGE_ZONE)
      else if (fromBottom < EDGE_ZONE) delta = MAX_SPEED * (1 - Math.max(0, fromBottom) / EDGE_ZONE)

      if (delta !== 0) element.scrollTop += delta
    }

    element.addEventListener('dragover', handleDragOver)
    frame = requestAnimationFrame(step)

    return () => {
      element.removeEventListener('dragover', handleDragOver)
      cancelAnimationFrame(frame)
    }
  }, [ref, active])
}
