import {
  DropdownSelect,
  mapDropdownOptions,
  type DropdownOption,
} from '@/shared/ui/dropdown-select'

type OptionItem = {
  value: string | number
  label: string
  description?: string
  disabled?: boolean
}

type OptionSource = readonly OptionItem[] | OptionItem[]

type RealEstateFormDropdownProps = {
  label: string
  required?: boolean
  value: string
  onChange: (value: string) => void
  options: OptionSource
  disabled?: boolean
  placeholder?: string
  searchable?: boolean
  loading?: boolean
  fieldClassName?: string
  className?: string
  fullWidth?: boolean
}

function normalizeOptions(options: OptionSource): DropdownOption[] {
  return mapDropdownOptions(
    options as Array<{
      value: string | number
      label: string
      description?: string
      disabled?: boolean
    }>,
  )
}

export function RealEstateFormDropdown({
  label,
  required = false,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  searchable,
  loading = false,
  fieldClassName = 'commercial-field',
  className,
  fullWidth = true,
}: RealEstateFormDropdownProps) {
  const normalizedOptions = normalizeOptions(options)

  return (
    <DropdownSelect
      label={label}
      required={required}
      fullWidth={fullWidth}
      fieldClassName={fieldClassName}
      className={className}
      options={normalizedOptions}
      value={value}
      onChange={onChange}
      disabled={disabled}
      loading={loading}
      placeholder={placeholder}
      searchable={searchable ?? normalizedOptions.length >= 6}
    />
  )
}
