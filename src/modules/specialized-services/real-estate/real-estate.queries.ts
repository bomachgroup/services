import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { realEstateApi } from './real-estate.api'
import { realEstateKeys } from './real-estate.keys'
import type { BrokerageFilters, EstateFilters, PropertyFilters } from './real-estate.types'
export const realEstateQueries = {
  estateDirectory: (search = '', limit = 20) =>
    infiniteQueryOptions({
      queryKey: realEstateKeys.estateDirectory(search, limit),
      queryFn: ({ pageParam }) =>
        realEstateApi.listEstates({ ...(search ? { search } : {}), page: pageParam, limit }),
      initialPageParam: 1,
      staleTime: 15_000,
      getNextPageParam: (lastPage, pages) => {
        const loaded = pages.reduce((total, page) => total + page.items.length, 0)
        return loaded < lastPage.count ? pages.length + 1 : undefined
      },
    }),
  estates: (f: EstateFilters) =>
    queryOptions({
      queryKey: realEstateKeys.estateList(f),
      queryFn: () => realEstateApi.listEstates(f),
      placeholderData: (p) => p,
      staleTime: 15_000,
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: realEstateKeys.estateDetail(id),
      queryFn: () => realEstateApi.estateDetail(id),
      staleTime: 15_000,
    }),
  stats: (id: number) =>
    queryOptions({
      queryKey: realEstateKeys.estateStats(id),
      queryFn: () => realEstateApi.estateStats(id),
      staleTime: 10_000,
    }),
  layout: (id: number) =>
    queryOptions({
      queryKey: realEstateKeys.estateLayout(id),
      queryFn: () => realEstateApi.estateLayout(id),
      staleTime: 10_000,
    }),
  choices: () =>
    queryOptions({
      queryKey: realEstateKeys.estateChoices(),
      queryFn: realEstateApi.estateChoices,
      staleTime: 60_000,
    }),
  portfolioStats: () =>
    queryOptions({
      queryKey: realEstateKeys.portfolioStats(),
      queryFn: () => realEstateApi.portfolioStats(),
      staleTime: 15_000,
    }),
  properties: (estateId: number, f: PropertyFilters) =>
    queryOptions({
      queryKey: realEstateKeys.propertyList(estateId, f),
      queryFn: () => realEstateApi.listProperties(estateId, f),
      placeholderData: (p) => p,
      staleTime: 10_000,
    }),
  propertyDetail: (estateId: number, id: number) =>
    queryOptions({
      queryKey: realEstateKeys.propertyDetail(estateId, id),
      queryFn: () => realEstateApi.propertyDetail(estateId, id),
      staleTime: 15_000,
    }),
  propertyDirectory: (estateId: number, search = '', limit = 20) =>
    infiniteQueryOptions({
      queryKey: realEstateKeys.propertyDirectory(estateId, search, limit),
      queryFn: ({ pageParam }) =>
        realEstateApi.listProperties(estateId, {
          ...(search ? { search } : {}),
          page: pageParam,
          limit,
        }),
      initialPageParam: 1,
      staleTime: 10_000,
      getNextPageParam: (lastPage, pages) => {
        const loaded = pages.reduce((total, page) => total + page.items.length, 0)
        return loaded < lastPage.count ? pages.length + 1 : undefined
      },
    }),
  standaloneProperties: (f: PropertyFilters) =>
    queryOptions({
      queryKey: realEstateKeys.standalonePropertyList(f),
      queryFn: () => realEstateApi.listStandaloneProperties(f),
      placeholderData: (p) => p,
      staleTime: 10_000,
    }),
  standalonePropertyDirectory: (search = '', limit = 20) =>
    infiniteQueryOptions({
      queryKey: realEstateKeys.standalonePropertyDirectory(search, limit),
      queryFn: ({ pageParam }) =>
        realEstateApi.listStandaloneProperties({
          ...(search ? { search } : {}),
          page: pageParam,
          limit,
        }),
      initialPageParam: 1,
      staleTime: 10_000,
      getNextPageParam: (lastPage, pages) => {
        const loaded = pages.reduce((total, page) => total + page.items.length, 0)
        return loaded < lastPage.count ? pages.length + 1 : undefined
      },
    }),
  standalonePropertyDetail: (id: number) =>
    queryOptions({
      queryKey: realEstateKeys.standalonePropertyDetail(id),
      queryFn: () => realEstateApi.standalonePropertyDetail(id),
      staleTime: 15_000,
    }),
  brokerage: (f: BrokerageFilters) =>
    queryOptions({
      queryKey: realEstateKeys.brokerageList(f),
      queryFn: () => realEstateApi.listBrokerage(f),
      placeholderData: (p) => p,
      staleTime: 10_000,
    }),
  brokerageDirectory: (search = '', limit = 20) =>
    infiniteQueryOptions({
      queryKey: realEstateKeys.brokerageDirectory(search, limit),
      queryFn: ({ pageParam }) =>
        realEstateApi.listBrokerage({ ...(search ? { search } : {}), page: pageParam, limit }),
      initialPageParam: 1,
      staleTime: 10_000,
      getNextPageParam: (lastPage, pages) => {
        const loaded = pages.reduce((total, page) => total + page.items.length, 0)
        return loaded < lastPage.count ? pages.length + 1 : undefined
      },
    }),
  brokerageDetail: (id: number) =>
    queryOptions({
      queryKey: realEstateKeys.brokerageDetail(id),
      queryFn: () => realEstateApi.brokerageDetail(id),
      staleTime: 15_000,
    }),
  brokerageStats: () =>
    queryOptions({
      queryKey: realEstateKeys.brokerageStats(),
      queryFn: realEstateApi.brokerageStats,
      staleTime: 10_000,
    }),
  commercialContext: (requestId: number) =>
    queryOptions({
      queryKey: realEstateKeys.commercialContext(requestId),
      queryFn: () => realEstateApi.commercialContext(requestId),
      staleTime: 10_000,
    }),
  propertyCommercialHistory: (propertyId: number) =>
    queryOptions({
      queryKey: realEstateKeys.propertyCommercialHistory(propertyId),
      queryFn: () => realEstateApi.propertyCommercialHistory(propertyId),
      staleTime: 10_000,
    }),
  brokerageCommercialHistory: (listingId: number) =>
    queryOptions({
      queryKey: realEstateKeys.brokerageCommercialHistory(listingId),
      queryFn: () => realEstateApi.brokerageCommercialHistory(listingId),
      staleTime: 10_000,
    }),
}
