import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { serviceRequestsApi } from './service-requests.api'
import { marketingLeadsApi } from './marketing-leads.api'
import { serviceRequestKeys } from './service-requests.keys'
import type { ServiceRequestFilters } from './service-requests.types'

export const DIRECTORY_PAGE_SIZE = 20

export const serviceRequestQueries = {
  list: (filters: ServiceRequestFilters) =>
    queryOptions({
      queryKey: serviceRequestKeys.list(filters),
      queryFn: () => serviceRequestsApi.list(filters),
      placeholderData: (previousData) => previousData,
      staleTime: 20_000,
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: serviceRequestKeys.detail(id),
      queryFn: () => serviceRequestsApi.detail(id),
      staleTime: 15_000,
    }),
  choices: () =>
    queryOptions({
      queryKey: serviceRequestKeys.choices(),
      queryFn: () => serviceRequestsApi.choices(),
      staleTime: 300_000,
    }),
  clients: () =>
    queryOptions({
      queryKey: serviceRequestKeys.clients(),
      queryFn: () => serviceRequestsApi.clients(),
      staleTime: 60_000,
    }),
  clientSearch: (search: string) =>
    queryOptions({
      queryKey: serviceRequestKeys.clientSearch(search),
      queryFn: () => serviceRequestsApi.searchClients(search),
      staleTime: 20_000,
    }),
  marketingLeadSearch: (search: string) =>
    queryOptions({
      queryKey: serviceRequestKeys.marketingLeadSearch(search),
      queryFn: () => marketingLeadsApi.search(search),
      staleTime: 20_000,
    }),
  clientDirectory: (search: string, limit = DIRECTORY_PAGE_SIZE) =>
    infiniteQueryOptions({
      queryKey: serviceRequestKeys.clientDirectory(search, limit),
      queryFn: ({ pageParam }) => serviceRequestsApi.listClients(search, limit, pageParam),
      initialPageParam: 0,
      staleTime: 20_000,
      getNextPageParam: (lastPage, pages) => {
        const loaded = pages.reduce((total, page) => total + page.items.length, 0)
        return loaded < lastPage.count ? loaded : undefined
      },
    }),
  marketingLeadDirectory: (search: string, limit = DIRECTORY_PAGE_SIZE) =>
    infiniteQueryOptions({
      queryKey: serviceRequestKeys.marketingLeadDirectory(search, limit),
      queryFn: ({ pageParam }) => marketingLeadsApi.list(search, limit, pageParam),
      initialPageParam: 0,
      staleTime: 20_000,
      getNextPageParam: (lastPage, pages) => {
        const loaded = pages.reduce((total, page) => total + page.items.length, 0)
        return loaded < lastPage.count ? loaded : undefined
      },
    }),
  services: () =>
    queryOptions({
      queryKey: serviceRequestKeys.services(),
      queryFn: () => serviceRequestsApi.services(),
      staleTime: 60_000,
    }),
  employees: () =>
    queryOptions({
      queryKey: serviceRequestKeys.employees(),
      queryFn: () => serviceRequestsApi.employees(),
      staleTime: 60_000,
      retry: false,
    }),
  intake: (id: number) =>
    queryOptions({
      queryKey: serviceRequestKeys.intake(id),
      queryFn: () => serviceRequestsApi.intakeForm(id),
      staleTime: 60_000,
    }),
  pricingConfig: (serviceId: number) =>
    queryOptions({
      queryKey: serviceRequestKeys.pricingConfig(serviceId),
      queryFn: () => serviceRequestsApi.activePricingConfig(serviceId),
      staleTime: 60_000,
      retry: false,
    }),
  summary: () =>
    queryOptions({
      queryKey: serviceRequestKeys.summary(),
      queryFn: () => serviceRequestsApi.summary(),
      staleTime: 20_000,
    }),
}
