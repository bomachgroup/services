import type { DropdownOption } from '@/shared/ui/dropdown-select'

export const SERVICE_CATALOGUE_STATUS_FILTER_OPTIONS: DropdownOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'inactive', label: 'Inactive' },
]

export const FULFILLMENT_MODE_OPTIONS: DropdownOption[] = [
  { value: 'Quick service order', label: 'Quick service order' },
  { value: 'Managed service case', label: 'Managed service case' },
  { value: 'Project & worksite', label: 'Project & worksite' },
  { value: 'Transaction & allocation', label: 'Transaction & allocation' },
  { value: 'Supply order', label: 'Supply order' },
]

export const PRICING_METHOD_OPTIONS_CREATE: DropdownOption[] = [
  { value: '', label: 'Select pricing method' },
  { value: 'Fixed', label: 'Fixed' },
  { value: 'Unit rate', label: 'Unit rate' },
  { value: 'Area rate', label: 'Area rate' },
  { value: 'Percentage', label: 'Percentage' },
]

export const PRICING_METHOD_OPTIONS_CONFIGURE: DropdownOption[] = [
  { value: 'Fixed', label: 'Fixed' },
  { value: 'Unit rate', label: 'Unit rate' },
  { value: 'Area rate', label: 'Area rate' },
  { value: 'Percentage', label: 'Percentage' },
  { value: 'Custom formula', label: 'Custom formula' },
]

export const SERVICE_STATUS_OPTIONS: DropdownOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Paused' },
]

export const SERVICE_STATUS_OPTIONS_WITH_PUBLISH: DropdownOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active / Publish' },
  { value: 'inactive', label: 'Paused' },
]

export const CLIENT_VISIBILITY_OPTIONS_VALUE: DropdownOption[] = [
  { value: 'visible', label: 'Visible in catalogue' },
  { value: 'internal', label: 'Internal only' },
  { value: 'hidden', label: 'Hidden' },
]

export const CLIENT_VISIBILITY_OPTIONS_LABEL: DropdownOption[] = [
  { value: 'Visible in catalogue', label: 'Visible in catalogue' },
  { value: 'Internal only', label: 'Internal only' },
  { value: 'Hidden', label: 'Hidden' },
]
