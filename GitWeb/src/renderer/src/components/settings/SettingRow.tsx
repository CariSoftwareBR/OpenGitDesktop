import { useId } from 'react'
import type { LucideIcon } from 'lucide-react'
import Switch from '../Switch'

/** A Settings row with an icon, a label, a description and a switch on the right. */
export default function SettingRow({
  icon: Icon,
  tone = 'neutral',
  label,
  description,
  checked,
  onChange,
  children
}: {
  icon: LucideIcon
  tone?: 'blue' | 'orange' | 'green' | 'red' | 'neutral'
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Extra detail under the description. */
  children?: React.ReactNode
}): JSX.Element {
  const labelId = useId()
  return (
    <div className="settings-row flex items-center gap-3.5">
      <span className={`settings-icon is-${tone}`}>
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div id={labelId} className="text-body font-semibold text-primary-text">
          {label}
        </div>
        <p className="mt-0.5 text-caption text-secondary-text">{description}</p>
        {children}
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabelledBy={labelId} />
    </div>
  )
}
