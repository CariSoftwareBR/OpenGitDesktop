import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useClickOutside } from '../lib/useClickOutside'
import { pathsEqual } from '../lib/path'
import { useT } from '../lib/i18n'

interface CloneDestinationFieldProps {
  value: string
  baseFolders: string[]
  selectedBase: string
  onValueChange: (value: string) => void
  onSelectBase: (base: string) => void
  disabled?: boolean
}

function CloneDestinationField({
  value,
  baseFolders,
  selectedBase,
  onValueChange,
  onSelectBase,
  disabled
}: CloneDestinationFieldProps): JSX.Element {
  const listboxId = useId()
  const t = useT().clone
  const optionIdPrefix = useId()
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const activeIndex = Math.min(highlighted, Math.max(0, baseFolders.length - 1))
  const activeDescendantId =
    open && baseFolders[activeIndex] ? `${optionIdPrefix}-${activeIndex}` : undefined

  useEffect(() => {
    if (!open) return
    const selectedIndex = baseFolders.findIndex((folder) => pathsEqual(folder, selectedBase))
    setHighlighted(Math.max(0, selectedIndex))
  }, [open, baseFolders, selectedBase])

  function choose(folder: string): void {
    onSelectBase(folder)
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setHighlighted((h) => Math.min(h + 1, Math.max(0, baseFolders.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setHighlighted((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault()
      const folder = baseFolders[activeIndex]
      if (folder) choose(folder)
    }
  }

  return (
    <div className="relative min-w-0 flex-1" ref={ref}>
      <div className="field flex h-[34px] w-full items-center gap-1 py-0">
        <input
          ref={inputRef}
          type="text"
          placeholder={t.destinationPlaceholder}
          aria-label={t.destinationAria}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          role="combobox"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent py-0 text-body text-primary-text placeholder:text-tertiary-text outline-none"
        />
        <button
          type="button"
          aria-label={t.baseFoldersAria}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
          disabled={disabled}
          className="hit-area shrink-0 rounded-sm p-1 text-tertiary-text hover:bg-hover-overlay"
        >
          <ChevronDown size={14} className={open ? 'rotate-180' : undefined} aria-hidden />
        </button>
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute bottom-[calc(100%+4px)] left-0 z-30 max-h-48 w-full overflow-y-auto rounded-md border border-default-border bg-coal-raised p-1 shadow-floating"
        >
          {baseFolders.length === 0 && (
            <li className="px-3 py-2 text-caption text-tertiary-text" role="presentation">
              {t.noBaseFolders(t.chooseFolder)}
            </li>
          )}
          {baseFolders.map((folder, index) => {
            const selected = pathsEqual(folder, selectedBase)
            return (
              <li key={folder} id={`${optionIdPrefix}-${index}`} role="option" aria-selected={selected}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(folder)}
                  className={
                    index === activeIndex
                      ? 'flex w-full items-center justify-between gap-2 rounded-sm bg-active-overlay px-2.5 py-1.5 text-left text-body text-command-blue'
                      : 'flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-body text-primary-text'
                  }
                >
                  <span className="truncate">{folder}</span>
                  {selected && <Check size={14} className="shrink-0" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default CloneDestinationField
