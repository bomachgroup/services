export interface DropdownOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export function mapDropdownOptions(
  items: Array<{ value: string | number; label: string; description?: string; disabled?: boolean }>,
): DropdownOption[] {
  return items.map((item) => ({
    value: String(item.value),
    label: item.label,
    ...(item.description ? { description: item.description } : {}),
    ...(item.disabled ? { disabled: item.disabled } : {}),
  }))
}
