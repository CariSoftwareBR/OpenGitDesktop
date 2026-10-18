import { useEffect, useState } from 'react'

/** Subscribes to a CSS media query; updates on change. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    function onChange(): void {
      setMatches(mql.matches)
    }
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Below this, multi-pane Git views switch to one-pane-at-a-time. */
export const NARROW_LAYOUT_QUERY = '(max-width: 960px)'

/** Below this, docked AI chat overlays instead of shrinking the main pane. */
export const COMPACT_SHELL_QUERY = '(max-width: 1100px)'
