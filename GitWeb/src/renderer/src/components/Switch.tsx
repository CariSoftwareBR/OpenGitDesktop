function Switch({
  checked,
  onChange,
  disabled,
  ariaLabel,
  ariaLabelledBy
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
  ariaLabelledBy?: string
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-[42px] shrink-0 rounded-pill border transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-command-blue ${
        checked ? 'border-command-blue bg-command-blue' : 'border-default-border bg-coal-raised'
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute top-0.5 left-0 h-[18px] w-[18px] rounded-full bg-switch-thumb shadow-subtle-edge transition-transform duration-150 ${
          checked ? 'translate-x-[21px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default Switch
