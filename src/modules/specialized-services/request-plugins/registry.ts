import type { ServiceOption } from '@/modules/commercial/api/service-requests.types'

import { realEstateRequestPlugin } from './real-estate/real-estate.request-plugin'
import type { SpecializedRequestPlugin } from './types'

const specializedRequestPlugins: SpecializedRequestPlugin[] = [
  realEstateRequestPlugin as SpecializedRequestPlugin,
]

export function listSpecializedRequestPlugins() {
  return specializedRequestPlugins
}

export function resolveSpecializedRequestPlugin(
  service: ServiceOption | null | undefined,
): SpecializedRequestPlugin | null {
  if (!service?.specializedDomain) return null
  return specializedRequestPlugins.find((plugin) => plugin.matchesService(service)) ?? null
}
