import type { CSSProperties } from 'react'

import type { StreamlineIconName } from './streamline-manifest'

type StreamlineIconProps = {
  name: StreamlineIconName
  size?: number
  className?: string
  label?: string
}

export function StreamlineIcon({
  name,
  size = 24,
  className,
  label,
}: StreamlineIconProps) {
  const style = {
    '--streamline-icon-mask': `url(/icons/streamline/${name}.svg)`,
    width: size,
    height: size,
  } as CSSProperties

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`inline-block shrink-0 bg-current [mask-image:var(--streamline-icon-mask)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] ${className ?? ''}`}
      role={label ? 'img' : undefined}
      style={style}
    />
  )
}