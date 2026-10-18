import { SiGithub } from '@icons-pack/react-simple-icons'
import { forwardRef, type ComponentProps } from 'react'

/** Official GitHub mark via Simple Icons (Lucide v1 dropped brand icons). */
const Github = forwardRef<SVGSVGElement, ComponentProps<typeof SiGithub>>(
  ({ title = '', color = 'currentColor', ...props }, ref) => (
    <SiGithub ref={ref} title={title} color={color} aria-hidden {...props} />
  )
)

Github.displayName = 'Github'

export default Github
