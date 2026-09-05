import type { SpecializedRequestPlugin } from '../types'

import {
  buildRealEstateRequestHandoff,
  createInitialRealEstateRequestContext,
  validateRealEstateRequestContext,
} from './real-estate.request-context'
import {
  RealEstateRequestContextFields,
  type RealEstateRequestContext,
} from './RealEstateRequestContextFields'

export const realEstateRequestPlugin: SpecializedRequestPlugin<RealEstateRequestContext> = {
  domain: 'real_estate',
  label: 'Real Estate',
  matchesService: (service) => service.specializedDomain === 'real_estate',
  skipIntakeForm: true,
  flowTitle: 'Start Estate Service Request',
  flowDescription:
    'Select the client and estate context, then continue to the estate sales workspace.',
  sectionTitle: 'Estate context',
  sectionDescription:
    'Choose an inventory source: estate, standalone property, or unlinked brokerage. Then pick the specific record to continue.',
  submitLabel: 'Continue to Estate Sales',
  initialContext: createInitialRealEstateRequestContext,
  validateContext: validateRealEstateRequestContext,
  buildHandoff: buildRealEstateRequestHandoff,
  ContextFields: RealEstateRequestContextFields,
}
