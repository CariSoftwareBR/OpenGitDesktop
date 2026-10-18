import { useEffect, type RefObject } from 'react'

type AnyElementRef = RefObject<HTMLElement | null>

// Accepts multiple refs so a trigger whose panel is portaled elsewhere in
// the DOM (e.g. to document.body, to escape an ancestor's clipped overflow)
// can still count a click inside the panel as "inside" — a click target
// only counts as outside when it's outside every given ref.
export function useClickOutside(refs: AnyElementRef | AnyElementRef[], onOutside: () => void): void {
  useEffect(() => {
    const list = Array.isArray(refs) ? refs : [refs]
    function handlePointerDown(event: MouseEvent): void {
      const target = event.target as Node
      const insideAny = list.some((r) => r.current?.contains(target))
      if (!insideAny) onOutside()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [refs, onOutside])
}
