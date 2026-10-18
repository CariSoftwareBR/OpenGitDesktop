import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function listFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getAttribute('aria-hidden') !== 'true' && !el.hasAttribute('disabled')
  )
}

/**
 * Traps Tab within `containerRef` while `active`, restores focus on cleanup.
 * Optional `initialFocusRef` overrides "first focusable" (e.g. confirm button).
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options?: {
    onEscape?: () => void
    initialFocusRef?: RefObject<HTMLElement | null>
  }
): void {
  const { onEscape, initialFocusRef } = options ?? {}
  // Callers pass inline handlers (`onCancel={() => …}`), so the identity changes
  // on every parent render — e.g. the 8s status poll. Reading it through a ref
  // keeps the effect from re-running mid-dialog and yanking focus back to the
  // initial element.
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const initial = initialFocusRef?.current ?? listFocusable(container)[0]
    initial?.focus()

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && onEscapeRef.current) {
        e.preventDefault()
        onEscapeRef.current()
        return
      }
      if (e.key !== 'Tab' || !containerRef.current) return

      const items = listFocusable(containerRef.current)
      if (items.length === 0) {
        e.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [active, containerRef, initialFocusRef])
}
