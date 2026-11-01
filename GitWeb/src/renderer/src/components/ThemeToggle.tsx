import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useAppSettingsStore } from '../store/appSettingsStore'
import { useT } from '../lib/i18n'

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = (): void => setDark(query.matches)
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return dark
}

/**
 * One click between light and dark. It writes an explicit preference (the
 * Settings view still offers "follow the system"), so the choice survives a
 * restart. The icon shows where the click takes you: a sun in the dark, a
 * moon in the light — and the two swap with a quarter turn.
 */
function ThemeToggle({ className = '' }: { className?: string }): JSX.Element {
  const preference = useAppSettingsStore((s) => s.settings?.colorScheme ?? 'system')
  const updateSettings = useAppSettingsStore((s) => s.updateSettings)
  const systemDark = useSystemDark()
  const t = useT().topBar
  const dark = preference === 'system' ? systemDark : preference === 'dark'
  const label = dark ? t.themeToLight : t.themeToDark

  return (
    <button
      type="button"
      onClick={() => void updateSettings({ colorScheme: dark ? 'light' : 'dark' })}
      title={label}
      aria-label={label}
      className={`group/theme flex items-center justify-center overflow-hidden rounded-md border border-default-border bg-coal-raised text-secondary-text shadow-[var(--shadow-raised)] transition-[background-color,color,transform] duration-150 hover:bg-hover-overlay hover:text-primary-text active:scale-95 ${className}`}
    >
      {/* The icons stack inside their own box, so callers can position the
          button however they like without fighting a `relative` here. */}
      <span className="relative flex size-[18px] items-center justify-center">
        <Sun
          size={17}
          aria-hidden
          className={`absolute transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover/theme:text-warning-amber ${
            dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
          }`}
        />
        <Moon
          size={16}
          aria-hidden
          className={`absolute transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover/theme:text-command-blue ${
            dark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
        />
      </span>
    </button>
  )
}

export default ThemeToggle
