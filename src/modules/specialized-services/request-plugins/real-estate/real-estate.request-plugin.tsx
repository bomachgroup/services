import type { SpecializedRequestPlugin } from '../types'

import {
  buildRealEstateRequestHandoff,
  createInitialRealEstateRequestContext,
  isSaleCapableRealEstateService,
  validateRealEstateRequestContext,
} from './real-estate.request-context'
import {
  RealEstateRequestContextFields,
  type RealEstateRequestContext,
} from './RealEstateRequestContextFields'

export const realEstateRequestPlugin: SpecializedRequestPlugin<RealEstateRequestContext> = {
  domain: 'real_estate',
  label: 'Real Estate',
  matchesService: (service) => isSaleCapableRealEstateService(service),
  skipIntakeForm: true,
  flowTitle: 'Create Real Estate Request',
  flowDescription:
    'Select the client, inventory asset and purchase terms before creating the request.',
  sectionTitle: 'Estate context',
  sectionDescription:
    'Choose the asset being sold or reserved, then confirm how the customer wants to proceed.',
  submitLabel: 'Create Request and Build Quote',
  initialContext: createInitialRealEstateRequestContext,
  validateContext: validateRealEstateRequestContext,
  buildHandoff: buildRealEstateRequestHandoff,
  ContextFields: RealEstateRequestContextFields,
}
