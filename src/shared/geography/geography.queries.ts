import { queryOptions } from '@tanstack/react-query'

import { geographyApi } from './geography.api'
import { geographyKeys } from './geography.keys'

const geographyQueryDefaults = {
  staleTime: 24 * 60 * 60 * 1000,
  refetchOnMount: 'always' as const,
  retry: 1,
}

export const geographyQueries = {
  nigeriaStates: () =>
    queryOptions({
      queryKey: geographyKeys.nigeriaStates(),
      queryFn: () => geographyApi.listNigeriaStates(),
      ...geographyQueryDefaults,
    }),

  nigeriaLgas: (state: string) =>
    queryOptions({
      queryKey: geographyKeys.nigeriaLgas(state),
      queryFn: () => geographyApi.listNigeriaLgas(state),
      enabled: Boolean(state),
      ...geographyQueryDefaults,
    }),

  nigeriaCities: (state: string, lga: string) =>
    queryOptions({
      queryKey: geographyKeys.nigeriaCities(state, lga),
      queryFn: () => geographyApi.listNigeriaCities(state, lga),
      enabled: Boolean(state && lga),
      ...geographyQueryDefaults,
    }),
}
