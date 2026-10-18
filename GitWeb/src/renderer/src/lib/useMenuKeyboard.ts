import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * ArrowUp/Down + Home/End + Escape for a `role="menu"` panel.
 * Focuses the first menuitem when `open` becomes true.
 */
export function useMenuKeyboard(
  menuRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
): void {
  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    if (!menu) return

    const items = (): HTMLElement[] =>
      Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'))

    // A menu with a filter field opens ready to type into it; ArrowDown from
    // there moves on to the items.
    const first = menu.querySelector<HTMLElement>('input') ?? items()[0]
    // preventScroll: without it, focusing an item that sits outside its
    // scroll-container ancestor's own box (e.g. a menu positioned below a
    // toolbar) makes the browser auto-scroll that ancestor to reveal it —
    // visibly yanking the whole toolbar around. See TopBar's menu portal.
    first?.focus({ preventScroll: true })

    function onKeyDown(e: KeyboardEvent): void {
      const list = items()
      if (list.length === 0) return
      const index = list.indexOf(document.activeElement as HTMLElement)

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = index < 0 ? 0 : (index + 1) % list.length
        list[next].focus()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next = index < 0 ? list.length - 1 : (index - 1 + list.length) % list.length
        list[next].focus()
        return
      }
      // A filter field inside the menu keeps its own caret keys.
      if ((e.key === 'Home' || e.key === 'End') && (e.target as HTMLElement | null)?.tagName === 'INPUT') return
      if (e.key === 'Home') {
        e.preventDefault()
        list[0].focus()
        return
      }
      if (e.key === 'End') {
        e.preventDefault()
        list[list.length - 1].focus()
      }
    }

    menu.addEventListener('keydown', onKeyDown)
    return () => menu.removeEventListener('keydown', onKeyDown)
  }, [open, menuRef, onClose])
}
