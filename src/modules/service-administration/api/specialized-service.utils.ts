import type { DropdownOption } from '@/shared/ui/dropdown-select/types'

export const SPECIALIZED_DOMAIN_OPTIONS = [
  { value: '', label: 'None (standard service)' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'legal', label: 'Legal' },
  { value: 'other', label: 'Other' },
] as const

const SPECIALIZED_WORKFLOW_VARIANTS: Record<string, DropdownOption[]> = {
  real_estate: [
    { value: 'land_sale', label: 'Land sale' },
    { value: 'fractional_ownership', label: 'Fractional ownership' },
    { value: 'property_brokerage', label: 'Property brokerage' },
    { value: 'estate_development', label: 'Estate development' },
    { value: 'estate_investment', label: 'Estate investment' },
    { value: 'agency_land', label: 'Estate agency — land' },
    { value: 'agency_house', label: 'Estate agency — house' },
    { value: 'property_sale', label: 'Property sale' },
    { value: 'estate_management', label: 'Estate management' },
  ],
  engineering: [
    { value: 'site_assessment', label: 'Site assessment' },
    { value: 'structural_design', label: 'Structural design' },
  ],
  legal: [
    { value: 'conveyancing', label: 'Conveyancing' },
    { value: 'title_search', label: 'Title search' },
  ],
  other: [{ value: 'general', label: 'General specialized flow' }],
}

export function specializedWorkflowVariantOptions(
  domain: string,
  currentValue = '',
): DropdownOption[] {
  const presets = SPECIALIZED_WORKFLOW_VARIANTS[domain] ?? []
  const options = [...presets]

  if (currentValue && !options.some((option) => option.value === currentValue)) {
    options.unshift({
      value: currentValue,
      label: `${currentValue.replace(/_/g, ' ')} (saved)`,
    })
  }

  return options
}

export function specializedPayload(domain: string | null | undefined, requestContext: string) {
  if (!domain) {
    return { specialized_domain: '' as const }
  }

  const config: Record<string, unknown> = {}
  const context = requestContext.trim()
  if (context) {
    config.request_context = context
  }

  return {
    specialized_domain: domain,
    specialized_config: config,
  }
}

export function readSpecializedRequestContext(
  config: Record<string, unknown> | null | undefined,
): string {
  const value = config?.request_context
  return typeof value === 'string' ? value : ''
}
