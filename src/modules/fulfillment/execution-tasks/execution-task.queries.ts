import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { executionTaskApi } from './execution-task.api'
import { executionTaskKeys } from './execution-task.keys'
import type { ExecutionTaskFilters } from './execution-task.types'

export const executionTaskQueries = {
  list: (orderId: number, filters: ExecutionTaskFilters) =>
    queryOptions({
      queryKey: executionTaskKeys.list(orderId, filters),
      queryFn: () => executionTaskApi.list(orderId, filters),
      placeholderData: (previousData) => previousData,
      staleTime: 10_000,
    }),

  detail: (orderId: number, taskId: number) =>
    queryOptions({
      queryKey: executionTaskKeys.detail(orderId, taskId),
      queryFn: () => executionTaskApi.detail(orderId, taskId),
      staleTime: 10_000,
    }),
  infiniteList: (orderId: number, filters: ExecutionTaskFilters = {}, limit = 20) =>
    infiniteQueryOptions({
      queryKey: [...executionTaskKeys.lists(orderId), 'infinite', filters, limit],
      queryFn: ({ pageParam }) =>
        executionTaskApi.list(orderId, { ...filters, page: pageParam, limit }),
      initialPageParam: 1,
      staleTime: 10_000,
      getNextPageParam: (lastPage, pages) => {
        const loaded = pages.reduce((total, page) => total + page.items.length, 0)
        return loaded < lastPage.count ? pages.length + 1 : undefined
      },
    }),
}
