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
  return (
    <input
      id={id}
      className={cn('commercial-number-input', className)}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      disabled={disabled}
      value={formatGroupedNumberFieldValue(value)}
      onChange={(event) => {
        const sanitized = sanitizeGroupedNumberInput(event.target.value)
        onChange(parseGroupedNumberFieldValue(sanitized))
      }}
    />
  )
}
