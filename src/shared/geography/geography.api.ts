import { apiClient } from '@/shared/api/api-client'

type LocationListResponse = {
  items: string[]
}

function withQuery(path: string, params: Record<string, string>) {
  const search = new URLSearchParams(params)
  return `${path}?${search.toString()}`
}

export const geographyApi = {
  listNigeriaStates: () => apiClient.get<LocationListResponse>('/geography/nigeria/states'),

  listNigeriaLgas: (state: string) =>
    apiClient.get<LocationListResponse>(withQuery('/geography/nigeria/lgas', { state })),

  listNigeriaCities: (state: string, lga: string) =>
    apiClient.get<LocationListResponse>(withQuery('/geography/nigeria/cities', { state, lga })),
}
