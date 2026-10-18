import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useClickOutside } from '../lib/useClickOutside'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  /** Accessible name when the trigger's visible text is only the current value. */
  ariaLabel?: string
  /** Id of a hint that describes the field (kept on both the trigger and the search input). */
  ariaDescribedBy?: string
  disabled?: boolean
  className?: string
}

function Combobox({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  disabled,
  className
}: ComboboxProps): JSX.Element {
  const listboxId = useId()
  const optionIdPrefix = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(
    () => (search.trim() ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase())) : options),
    [options, search]
  )

  const activeDescendantId =
    open && filtered[highlighted] ? `${optionIdPrefix}-${filtered[highlighted].value}` : undefined
  const accessibleName = ariaLabel ?? placeholder

  function openDropdown(): void {
    if (disabled) return
    setSearch('')
    const selectedIndex = options.findIndex((o) => o.value === value)
    setHighlighted(Math.max(0, selectedIndex))
    setOpen(true)
  }

  function choose(optionValue: string): void {
    onChange(optionValue)
    setOpen(false)
    setSearch('')
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    setHighlighted(0)
  }, [search])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const option = filtered[highlighted]
      if (option) choose(option.value)
    }
  }

  return (
    <div className={`relative ${className ?? ''}`} ref={ref}>
      {open ? (
        <div className="field flex h-[34px] w-full items-center gap-2 py-0">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selected?.label ?? placeholder ?? 'Buscar…'}
            aria-label={accessibleName ?? 'Buscar opção'}
            aria-describedby={ariaDescribedBy}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeDescendantId}
            aria-autocomplete="list"
            className="w-full bg-transparent text-body text-primary-text placeholder:text-tertiary-text outline-none"
          />
          <ChevronDown size={14} className="shrink-0 rotate-180 text-tertiary-text" aria-hidden />
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={openDropdown}
          aria-haspopup="listbox"
          aria-expanded={false}
          aria-controls={listboxId}
          aria-label={accessibleName}
          aria-describedby={ariaDescribedBy}
          className="field flex h-[34px] w-full items-center justify-between gap-2 py-0 text-left disabled:opacity-40"
        >
          <span className={`truncate ${selected ? 'text-primary-text' : 'text-tertiary-text'}`}>
            {selected?.label ?? placeholder ?? 'Selecione…'}
          </span>
          <ChevronDown size={14} className="shrink-0 text-tertiary-text" aria-hidden />
        </button>
      )}

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-64 w-full min-w-max overflow-y-auto rounded-md border border-default-border bg-coal-raised p-1 shadow-floating"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-caption text-tertiary-text" role="presentation">
              Nenhum resultado.
            </li>
          )}
          {filtered.map((option, index) => (
            <li
              key={option.value}
              id={`${optionIdPrefix}-${option.value}`}
              role="option"
              aria-selected={option.value === value}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(option.value)}
                className={
                  index === highlighted
                    ? 'flex w-full items-center justify-between gap-2 rounded-sm bg-active-overlay px-2.5 py-1.5 text-left text-body text-command-blue'
                    : 'flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-body text-primary-text'
                }
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check size={14} className="shrink-0" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Combobox
