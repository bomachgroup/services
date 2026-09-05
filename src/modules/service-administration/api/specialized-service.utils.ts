export const SPECIALIZED_DOMAIN_OPTIONS = [
  { value: '', label: 'None (standard service)' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'legal', label: 'Legal' },
  { value: 'other', label: 'Other' },
] as const

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
