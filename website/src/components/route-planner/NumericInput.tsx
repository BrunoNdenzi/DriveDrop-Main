'use client'

import { useEffect, useRef, useState } from 'react'

interface NumericInputProps {
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
  className?: string
  'aria-label'?: string
  id?: string
}

// Lets the field be emptied while typing; an invalid or empty value snaps back on blur.
export default function NumericInput({ value, min, max, onCommit, className, ...rest }: NumericInputProps) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])

  const parse = (raw: string): number | null => {
    if (!/^\d+$/.test(raw)) return null
    const parsed = Number(raw)
    return parsed >= min && parsed <= max ? parsed : null
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={text}
      className={className}
      onFocus={event => {
        focused.current = true
        event.currentTarget.select()
      }}
      onChange={event => {
        const raw = event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
        setText(raw)
        const parsed = parse(raw)
        if (parsed !== null) onCommit(parsed)
      }}
      onBlur={() => {
        focused.current = false
        const parsed = parse(text)
        if (parsed !== null) {
          setText(String(parsed))
          return
        }
        const settled = text === '' ? value : Math.min(max, Math.max(min, Number(text)))
        setText(String(settled))
        if (settled !== value) onCommit(settled)
      }}
    />
  )
}
