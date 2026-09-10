import type { ClientOption, ServiceOption } from '@/modules/commercial/api/service-requests.types'

import type { SpecializedRequestFormValues } from '../types'

import type { RealEstateRequestContext } from './RealEstateRequestContextFields'

/** Matches backend SALE_CAPABLE_REQUEST_CONTEXTS — asset claim / commercial create. */
export const SALE_CAPABLE_REQUEST_CONTEXTS = new Set([
  'land_sale',
  'property_brokerage',
  'agency_land',
  'agency_house',
])

export function realEstateRequestContext(service: ServiceOption | null | undefined): string {
  const config = service?.specializedConfig
  if (!config || typeof config !== 'object') return ''
  const value = config.request_context
  return typeof value === 'string' ? value : ''
}

export function allowedRealEstateSourceModes(
  service: ServiceOption | null | undefined,
): Set<RealEstateRequestContext['sourceMode']> {
  const context = realEstateRequestContext(service)
  if (context === 'land_sale') return new Set(['estate', 'standalone'])
  if (context === 'property_brokerage' || context === 'agency_land' || context === 'agency_house') {
    return new Set(['brokerage'])
  }
  return new Set(['estate', 'standalone', 'brokerage'])
}

export function isSaleCapableRealEstateService(service: ServiceOption | null | undefined): boolean {
  return (
    service?.specializedDomain === 'real_estate' &&
    SALE_CAPABLE_REQUEST_CONTEXTS.has(realEstateRequestContext(service))
  )
}

export function createInitialRealEstateRequestContext(): RealEstateRequestContext {
  return {
    sourceMode: 'estate',
    estateId: 0,
    selectedId: null,
    settlementMode: 'full_payment',
    agreedPrice: null,
    inventoryPrice: null,
  }
}

export function validateRealEstateRequestContext(
  context: RealEstateRequestContext | null | undefined,
  service?: ServiceOption | null,
) {
  if (!context) return 'Choose an inventory source to continue.'
  if (!allowedRealEstateSourceModes(service).has(context.sourceMode)) {
    const requestContext = realEstateRequestContext(service)
    if (requestContext === 'property_brokerage') {
      return 'Property brokerage requests require an unlinked brokerage listing.'
    }
    if (requestContext === 'agency_land')
      return 'Agency land requests require a land brokerage listing.'
    if (requestContext === 'agency_house') {
      return 'Agency house requests require a residential brokerage listing.'
    }
    return 'Choose an inventory source supported by this service.'
  }
  if (!context.settlementMode) return 'Choose the purchase mode to continue.'

  if (context.sourceMode === 'estate') {
    if (!context.estateId) return 'Select an estate to continue.'
    if (!context.selectedId) return 'Select a property in this estate to continue.'
    return null
  }

  if (context.sourceMode === 'standalone') {
    if (!context.selectedId) return 'Select a standalone property to continue.'
    return null
  }

  if (context.sourceMode === 'brokerage') {
    if (!context.selectedId) return 'Select an unlinked brokerage listing to continue.'
    return null
  }

  return 'Choose an inventory source to continue.'
}

export function buildRealEstateRequestHandoff({
  service,
  context,
  client,
  formValues,
}: {
  service: ServiceOption
  context: RealEstateRequestContext
  client: ClientOption | null
  formValues: SpecializedRequestFormValues
}) {
  const sharedSearch = {
    service: String(service.id),
  }

  const navigationSearch =
    context.sourceMode === 'estate'
      ? {
          ...sharedSearch,
          estate: String(context.estateId),
          ...(context.selectedId ? { property: String(context.selectedId) } : {}),
        }
      : context.sourceMode === 'standalone'
        ? {
            ...sharedSearch,
            standaloneProperty: String(context.selectedId),
          }
        : {
            ...sharedSearch,
            brokerage: String(context.selectedId),
          }

  return {
    domain: 'real_estate',
    serviceId: service.id,
    ...(client ? { clientId: client.id } : {}),
    ...(formValues.contactName ? { contactName: formValues.contactName } : {}),
    ...(formValues.contactPhone ? { contactPhone: formValues.contactPhone } : {}),
    ...(formValues.contactEmail ? { contactEmail: formValues.contactEmail } : {}),
    ...(formValues.branchId ? { branchId: formValues.branchId } : {}),
    ...(formValues.crmLeadId ? { crmLeadId: formValues.crmLeadId } : {}),
    context: {
      sourceMode: context.sourceMode,
      estateId: context.estateId,
      selectedId: context.selectedId,
      settlementMode: context.settlementMode,
      agreedPrice: context.agreedPrice,
      inventoryPrice: context.inventoryPrice,
    },
    navigation: {
      section: 'real-estate-inventory',
      search: navigationSearch,
    },
  }
}
