import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { deliverableApi } from './deliverable.api'
import { deliverableKeys } from './deliverable.keys'
import type { DeliverableFilters } from './deliverable.types'

export const deliverableQueries = {
  list: (orderId: number, filters: DeliverableFilters) =>
    queryOptions({
      queryKey: deliverableKeys.list(orderId, filters),
      queryFn: () => deliverableApi.list(orderId, filters),
      placeholderData: (previousData) => previousData,
      staleTime: 10_000,
    }),

  detail: (orderId: number, deliverableId: number) =>
    queryOptions({
      queryKey: deliverableKeys.detail(orderId, deliverableId),
      queryFn: () => deliverableApi.detail(orderId, deliverableId),
      staleTime: 10_000,
    }),
  infiniteList: (orderId: number, filters: DeliverableFilters = {}, limit = 20) =>
    infiniteQueryOptions({
      queryKey: [...deliverableKeys.lists(orderId), 'infinite', filters, limit],
      queryFn: ({ pageParam }) =>
        deliverableApi.list(orderId, { ...filters, page: pageParam, limit }),
      initialPageParam: 1,
      staleTime: 10_000,
      getNextPageParam: (lastPage, pages) => {
        const loaded = pages.reduce((total, page) => total + page.items.length, 0)
        return loaded < lastPage.count ? pages.length + 1 : undefined
      },
    }),
}
