import type { ClientOption, ServiceOption } from '@/modules/commercial/api/service-requests.types'

import type { SpecializedRequestFormValues } from '../types'

import type { RealEstateRequestContext } from './RealEstateRequestContextFields'

export function createInitialRealEstateRequestContext(): RealEstateRequestContext {
  return {
    sourceMode: 'estate',
    estateId: 0,
    selectedId: null,
  }
}

export function validateRealEstateRequestContext(
  context: RealEstateRequestContext | null | undefined,
) {
  if (!context) return 'Choose an inventory source to continue.'

  if (context.sourceMode === 'estate') {
    if (!context.estateId) return 'Select an estate to continue.'
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
    },
    navigation: {
      section: 'real-estate-inventory',
      search: navigationSearch,
    },
  }
}
