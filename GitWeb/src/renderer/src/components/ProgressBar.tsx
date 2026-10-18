/** Determinate progress bar. Extracted from AboutView's update download. */
function ProgressBar({ percent, label }: { percent: number; label?: string }): JSX.Element {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-hover-overlay"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
    >
      <div
        className="h-full rounded-full bg-command-blue transition-[width] duration-200"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export default ProgressBar
