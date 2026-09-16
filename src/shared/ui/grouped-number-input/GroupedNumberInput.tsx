import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import {
  formatGroupedNumberFieldValue,
  parseGroupedNumberFieldValue,
  sanitizeGroupedNumberInput,
} from '@/shared/lib/number-input'

type GroupedNumberInputProps = {
  value: number | null | undefined
  onChange: (value: number) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  id?: string
}

export function GroupedNumberInput({
  value,
  onChange,
  className,
  placeholder,
  disabled = false,
  id,
}: GroupedNumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const caretPosRef = useRef<number | null>(null)
  const [displayValue, setDisplayValue] = useState(() => formatGroupedNumberFieldValue(value))

  useEffect(() => {
    const sanitized = sanitizeGroupedNumberInput(displayValue)
    const currentNum = parseGroupedNumberFieldValue(sanitized)
    if (value !== currentNum) {
      setDisplayValue(formatGroupedNumberFieldValue(value))
    }
  }, [value, displayValue])

  useLayoutEffect(() => {
    if (caretPosRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(caretPosRef.current, caretPosRef.current)
      caretPosRef.current = null
    }
  })

  return (
    <input
      ref={inputRef}
      id={id}
      className={cn('commercial-number-input', className)}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      disabled={disabled}
      value={displayValue}
      onChange={(event) => {
        const input = event.target
        const raw = input.value
        const cursor = input.selectionStart ?? raw.length
        const nonCommasBefore = raw.slice(0, cursor).replace(/,/g, '').length

        const sanitized = sanitizeGroupedNumberInput(raw)
        const hasTrailingDot = sanitized.endsWith('.')
        const num = parseGroupedNumberFieldValue(sanitized)
        const [whole = '', frac] = sanitized.split('.')
        const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        let newDisplay = formattedWhole
        if (hasTrailingDot) {
          newDisplay = `${formattedWhole}.`
        } else if (frac !== undefined && frac !== '') {
          newDisplay = `${formattedWhole}.${frac}`
        }

        let newCursor = 0
        let count = 0
        for (let i = 0; i < newDisplay.length; i++) {
          if (count >= nonCommasBefore) break
          if (newDisplay[i] !== ',') count++
          newCursor = i + 1
        }

        caretPosRef.current = newCursor
        setDisplayValue(newDisplay)
        onChange(num)
      }}
    />
  )
}
