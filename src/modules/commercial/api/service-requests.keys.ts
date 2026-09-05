import type { ServiceRequestFilters } from './service-requests.types'

export const serviceRequestKeys = {
  all: ['commercial', 'service-requests'] as const,
  lists: () => [...serviceRequestKeys.all, 'list'] as const,
  list: (filters: ServiceRequestFilters) => [...serviceRequestKeys.lists(), filters] as const,
  details: () => [...serviceRequestKeys.all, 'detail'] as const,
  detail: (id: number) => [...serviceRequestKeys.details(), id] as const,
  choices: () => [...serviceRequestKeys.all, 'choices'] as const,
  clients: () => [...serviceRequestKeys.all, 'clients'] as const,
  clientSearch: (search: string) => [...serviceRequestKeys.clients(), 'search', search] as const,
  clientDirectory: (search: string, limit: number) =>
    [...serviceRequestKeys.clients(), 'directory', { search, limit }] as const,
  marketingLeadSearch: (search: string) =>
    [...serviceRequestKeys.all, 'marketing-leads', 'search', search] as const,
  marketingLeadDirectory: (search: string, limit: number) =>
    [...serviceRequestKeys.all, 'marketing-leads', 'directory', { search, limit }] as const,
  services: () => [...serviceRequestKeys.all, 'services'] as const,
  employees: () => [...serviceRequestKeys.all, 'employees'] as const,
  intake: (id: number) => [...serviceRequestKeys.all, 'intake', id] as const,
  pricingConfig: (serviceId: number) =>
    [...serviceRequestKeys.all, 'pricing-config', serviceId] as const,
  summary: () => [...serviceRequestKeys.all, 'summary'] as const,
}
