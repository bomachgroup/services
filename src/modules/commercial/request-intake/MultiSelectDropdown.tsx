import type { IntakeFieldOption } from '../api/service-requests.types'

import { DropdownSelect } from '@/shared/ui/dropdown-select'

/** @deprecated Use DropdownSelect with mode="multiple" from @/shared/ui/dropdown-select */
export function MultiSelectDropdown({
  id,
  label,
  required,
  placeholder,
  options,
  value,
  helpText,
  error,
  onChange,
  containerRef,
}: {
  id?: string
  label: string
  required?: boolean
  placeholder: string
  options: IntakeFieldOption[]
  value: string[]
  helpText?: string
  error?: string
  onChange: (next: string[]) => void
  containerRef?: (node: HTMLDivElement | null) => void
}) {
  return (
    <DropdownSelect
      id={id}
      mode="multiple"
      label={label}
      required={required}
      placeholder={placeholder}
      options={options}
      value={value}
      helpText={helpText}
      error={error}
      onChange={onChange}
      containerRef={containerRef}
      searchable
    />
  )
}
