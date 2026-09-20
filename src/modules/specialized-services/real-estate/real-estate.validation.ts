import type {
  AdditionalFee,
  BoundaryPoint,
  CreateBrokerageInput,
  CreateEstateInput,
  CreatePropertyInput,
  QuickUpdatePlotInput,
} from './real-estate.types'

const MANAGED_PROPERTY_STATUSES = new Set(['under_offer', 'reserved', 'sold'])

function validateBoundary(boundary: BoundaryPoint[] | undefined) {
  const points = boundary ?? []
  if (!points.length) return ''
  if (points.length < 3) return 'Boundary requires at least three coordinate points.'

  for (const [index, point] of points.entries()) {
    if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) {
      return `Boundary point ${index + 1} latitude must be between -90 and 90.`
    }
    if (!Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180) {
      return `Boundary point ${index + 1} longitude must be between -180 and 180.`
    }
  }
  return ''
}

function validateFees(fees: AdditionalFee[] | undefined) {
  for (const [index, fee] of (fees ?? []).entries()) {
    if (!fee.name.trim()) return `Fee ${index + 1} name is required.`
    if (!Number.isFinite(fee.amount) || fee.amount < 0) {
      return `Fee ${index + 1} amount must be zero or greater.`
    }
  }
  return ''
}

function validateCommercialPolicy(i: {
  allowReservation?: boolean
  reservationPercent?: number | null
  reservationDurationHours?: number | null
  requestClaimHoldHours?: number | null
  reservationRefundable?: boolean
  reservationRetentionPercent?: number | null
  allowInstallment?: boolean
  installmentDownPaymentPercent?: number | null
  installmentMonths?: number | null
  installmentGracePeriodDays?: number | null
}) {
  if (!Number.isFinite(i.requestClaimHoldHours ?? NaN) || (i.requestClaimHoldHours ?? 0) < 1) {
    return 'Request claim hold must be at least 1 hour.'
  }
  if (i.allowReservation) {
    if (!Number.isFinite(i.reservationPercent ?? NaN) || (i.reservationPercent ?? 0) <= 0) {
      return 'Reservation percent must be greater than zero.'
    }
    if ((i.reservationPercent ?? 0) > 100) return 'Reservation percent cannot exceed 100%.'
    if (
      !Number.isFinite(i.reservationDurationHours ?? NaN) ||
      (i.reservationDurationHours ?? 0) < 1
    ) {
      return 'Reservation duration is required.'
    }
    if (
      i.reservationRefundable === false &&
      (!Number.isFinite(i.reservationRetentionPercent ?? NaN) ||
        (i.reservationRetentionPercent ?? 0) < 0 ||
        (i.reservationRetentionPercent ?? 0) > 100)
    ) {
      return 'Reservation retention must be between 0 and 100%.'
    }
  }
  if (i.allowInstallment) {
    if (
      !Number.isFinite(i.installmentDownPaymentPercent ?? NaN) ||
      (i.installmentDownPaymentPercent ?? 0) <= 0
    ) {
      return 'Installment down payment must be greater than zero.'
    }
    if ((i.installmentDownPaymentPercent ?? 0) > 100) {
      return 'Installment down payment cannot exceed 100%.'
    }
    if (!Number.isFinite(i.installmentMonths ?? NaN) || (i.installmentMonths ?? 0) < 1) {
      return 'Installment term is required.'
    }
    if (
      !Number.isFinite(i.installmentGracePeriodDays ?? NaN) ||
      (i.installmentGracePeriodDays ?? 0) < 0
    ) {
      return 'Installment grace period cannot be negative.'
    }
  }
  return ''
}

export function validateQuickPlotUpdate(i: QuickUpdatePlotInput) {
  if (i.pricingMode === 'manual_override' && (!Number.isFinite(i.price) || (i.price ?? 0) <= 0))
    return 'Property price must be greater than zero when overriding the estate rate.'
  if (
    i.pricingMode !== 'estate_rate' &&
    i.price !== undefined &&
    i.price != null &&
    (!Number.isFinite(i.price) || i.price <= 0)
  )
    return 'Property price must be greater than zero.'
  if (i.status === 'under_offer' || i.status === 'reserved' || i.status === 'sold') {
    return 'Reserved and sold status are set by the service-request payment flow, not inventory edits.'
  }
  return ''
}

export function validatePropertyStatus(status: string) {
  return MANAGED_PROPERTY_STATUSES.has(status)
    ? 'Under offer, reserved, and sold status are set by the commercial request and payment flow.'
    : ''
}
export type EstateFieldKey =
  | 'estateName'
  | 'estateCode'
  | 'developerCompanyName'
  | 'estateDescription'
  | 'state'
  | 'cityTown'
  | 'preciseAddress'
  | 'pricePerSqm'
  | 'minPriceOtherProperties'
  | 'reservationPercent'
  | 'reservationDurationHours'
  | 'requestClaimHoldHours'
  | 'reservationRetentionPercent'
  | 'installmentDownPaymentPercent'
  | 'installmentMonths'
  | 'installmentGracePeriodDays'
  | 'boundary'
  | 'additionalFees'
  | 'selectedLga'
  | 'documents'

export type EstateFieldErrors = Partial<Record<EstateFieldKey, string>>

export const estateFieldFocusOrder: EstateFieldKey[] = [
  'estateName',
  'estateCode',
  'developerCompanyName',
  'pricePerSqm',
  'estateDescription',
  'documents',
  'reservationPercent',
  'reservationDurationHours',
  'requestClaimHoldHours',
  'reservationRetentionPercent',
  'installmentDownPaymentPercent',
  'installmentMonths',
  'installmentGracePeriodDays',
  'state',
  'selectedLga',
  'cityTown',
  'preciseAddress',
  'boundary',
  'additionalFees',
  'minPriceOtherProperties',
]

export function firstEstateFieldError(errors: EstateFieldErrors): EstateFieldKey | null {
  return estateFieldFocusOrder.find((key) => Boolean(errors[key])) ?? null
}

export function validateEstateFields(i: CreateEstateInput): EstateFieldErrors {
  const errors: EstateFieldErrors = {}

  if (!i.estateName.trim()) errors.estateName = 'Estate name is required.'
  if (!i.estateCode.trim()) errors.estateCode = 'Estate code is required.'
  if (!i.developerCompanyName.trim()) {
    errors.developerCompanyName = 'Developer / company name is required.'
  }
  if (!i.estateDescription.trim()) errors.estateDescription = 'Estate description is required.'
  if (!i.state.trim()) errors.state = 'State is required.'
  if (!i.cityTown.trim()) errors.cityTown = 'City / town is required.'
  if (!i.preciseAddress.trim()) errors.preciseAddress = 'Precise address is required.'
  if (!Number.isFinite(i.pricePerSqm) || i.pricePerSqm < 0) {
    errors.pricePerSqm = 'Price per square metre must be zero or greater.'
  }
  if (
    i.minPriceOtherProperties != null &&
    i.maxPriceOtherProperties != null &&
    i.minPriceOtherProperties > i.maxPriceOtherProperties
  ) {
    errors.minPriceOtherProperties = 'Minimum property price cannot exceed maximum property price.'
  }
  if (!Number.isFinite(i.requestClaimHoldHours ?? NaN) || (i.requestClaimHoldHours ?? 0) < 1) {
    errors.requestClaimHoldHours = 'Request claim hold must be at least 1 hour.'
  }
  if (i.allowReservation) {
    if (!Number.isFinite(i.reservationPercent ?? NaN) || (i.reservationPercent ?? 0) <= 0) {
      errors.reservationPercent = 'Deposit must be greater than zero.'
    } else if ((i.reservationPercent ?? 0) > 100) {
      errors.reservationPercent = 'Deposit cannot exceed 100%.'
    }
    if (
      !Number.isFinite(i.reservationDurationHours ?? NaN) ||
      (i.reservationDurationHours ?? 0) < 1
    ) {
      errors.reservationDurationHours = 'Hold duration is required.'
    }
    if (
      i.reservationRefundable === false &&
      (!Number.isFinite(i.reservationRetentionPercent ?? NaN) ||
        (i.reservationRetentionPercent ?? 0) < 0 ||
        (i.reservationRetentionPercent ?? 0) > 100)
    ) {
      errors.reservationRetentionPercent = 'Retention must be between 0 and 100%.'
    }
  }
  if (i.allowInstallment) {
    if (
      !Number.isFinite(i.installmentDownPaymentPercent ?? NaN) ||
      (i.installmentDownPaymentPercent ?? 0) <= 0
    ) {
      errors.installmentDownPaymentPercent = 'Down payment must be greater than zero.'
    } else if ((i.installmentDownPaymentPercent ?? 0) > 100) {
      errors.installmentDownPaymentPercent = 'Down payment cannot exceed 100%.'
    }
    if (!Number.isFinite(i.installmentMonths ?? NaN) || (i.installmentMonths ?? 0) < 1) {
      errors.installmentMonths = 'Term in months is required.'
    }
    if (
      !Number.isFinite(i.installmentGracePeriodDays ?? NaN) ||
      (i.installmentGracePeriodDays ?? 0) < 0
    ) {
      errors.installmentGracePeriodDays = 'Grace period cannot be negative.'
    }
  }

  const boundaryError = validateBoundary(i.boundary)
  if (boundaryError) errors.boundary = boundaryError
  const feeError = validateFees(i.additionalFees)
  if (feeError) errors.additionalFees = feeError

  return errors
}

export function validateEstate(i: CreateEstateInput) {
  const errors = validateEstateFields(i)
  const firstKey = firstEstateFieldError(errors)
  return firstKey ? (errors[firstKey] ?? '') : ''
}

export type PropertyFieldKey =
  | 'propertyName'
  | 'price'
  | 'plotNumber'
  | 'plotUse'
  | 'plotSize'
  | 'buildingTypeResidential'
  | 'bedrooms'
  | 'bathrooms'
  | 'totalAreaResidential'
  | 'buildingTypeCommercial'
  | 'totalAreaCommercial'
  | 'numberOfFloors'
  | 'requestClaimHoldHours'
  | 'reservationPercent'
  | 'reservationDurationHours'
  | 'reservationRetentionPercent'
  | 'installmentDownPaymentPercent'
  | 'installmentMonths'
  | 'installmentGracePeriodDays'
  | 'boundary'
  | 'additionalFees'

export type PropertyFieldErrors = Partial<Record<PropertyFieldKey, string | undefined>>

export const propertyFieldFocusOrder: PropertyFieldKey[] = [
  'propertyName',
  'price',
  'plotNumber',
  'plotUse',
  'plotSize',
  'buildingTypeResidential',
  'bedrooms',
  'bathrooms',
  'totalAreaResidential',
  'buildingTypeCommercial',
  'totalAreaCommercial',
  'numberOfFloors',
  'requestClaimHoldHours',
  'reservationPercent',
  'reservationDurationHours',
  'reservationRetentionPercent',
  'installmentDownPaymentPercent',
  'installmentMonths',
  'installmentGracePeriodDays',
  'boundary',
  'additionalFees',
]

export function firstPropertyFieldError(errors: PropertyFieldErrors): PropertyFieldKey | null {
  return propertyFieldFocusOrder.find((key) => Boolean(errors[key])) ?? null
}

export function mapPropertyValidationMessage(
  message: string,
  propertyType?: CreatePropertyInput['propertyType'],
): PropertyFieldErrors {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('boundary') ||
    normalized.includes('latitude') ||
    normalized.includes('longitude')
  ) {
    return { boundary: message }
  }
  if (normalized.includes('fee')) return { additionalFees: message }
  if (normalized.includes('property name')) return { propertyName: message }
  if (normalized.includes('price')) return { price: message }
  if (normalized.includes('plot use')) return { plotUse: message }
  if (normalized.includes('plot size')) return { plotSize: message }
  if (
    normalized.includes('plot number') ||
    normalized.includes('plot ') ||
    normalized.includes('unique')
  ) {
    return { plotNumber: message }
  }
  if (normalized.includes('residential building type')) return { buildingTypeResidential: message }
  if (normalized.includes('commercial building type')) return { buildingTypeCommercial: message }
  if (normalized.includes('bedrooms')) return { bedrooms: message }
  if (normalized.includes('bathrooms')) return { bathrooms: message }
  if (normalized.includes('total area')) {
    return propertyType === 'commercial'
      ? { totalAreaCommercial: message }
      : { totalAreaResidential: message }
  }
  if (normalized.includes('number of floors')) return { numberOfFloors: message }
  if (normalized.includes('claim hold')) return { requestClaimHoldHours: message }
  if (normalized.includes('reservation percent')) return { reservationPercent: message }
  if (normalized.includes('reservation duration')) return { reservationDurationHours: message }
  if (normalized.includes('reservation retention')) return { reservationRetentionPercent: message }
  if (normalized.includes('installment down payment')) {
    return { installmentDownPaymentPercent: message }
  }
  if (normalized.includes('installment term')) return { installmentMonths: message }
  if (normalized.includes('installment grace')) return { installmentGracePeriodDays: message }
  return {}
}

export function mapPropertySubmitFieldErrors(
  submitFieldErrors?: Record<string, string>,
): PropertyFieldErrors {
  const mapped: PropertyFieldErrors = {}
  const fieldMap: Record<string, PropertyFieldKey> = {
    property_name: 'propertyName',
    propertyName: 'propertyName',
    price: 'price',
    plot_number: 'plotNumber',
    plotNumber: 'plotNumber',
    plot_use: 'plotUse',
    plotUse: 'plotUse',
    plot_size: 'plotSize',
    plotSize: 'plotSize',
    building_type_residential: 'buildingTypeResidential',
    buildingTypeResidential: 'buildingTypeResidential',
    bedrooms: 'bedrooms',
    bathrooms: 'bathrooms',
    total_area_residential: 'totalAreaResidential',
    totalAreaResidential: 'totalAreaResidential',
    building_type_commercial: 'buildingTypeCommercial',
    buildingTypeCommercial: 'buildingTypeCommercial',
    total_area_commercial: 'totalAreaCommercial',
    totalAreaCommercial: 'totalAreaCommercial',
    number_of_floors: 'numberOfFloors',
    numberOfFloors: 'numberOfFloors',
    request_claim_hold_hours: 'requestClaimHoldHours',
    requestClaimHoldHours: 'requestClaimHoldHours',
    reservation_percent: 'reservationPercent',
    reservationPercent: 'reservationPercent',
    reservation_duration_hours: 'reservationDurationHours',
    reservationDurationHours: 'reservationDurationHours',
    reservation_retention_percent: 'reservationRetentionPercent',
    reservationRetentionPercent: 'reservationRetentionPercent',
    installment_down_payment_percent: 'installmentDownPaymentPercent',
    installmentDownPaymentPercent: 'installmentDownPaymentPercent',
    installment_months: 'installmentMonths',
    installmentMonths: 'installmentMonths',
    installment_grace_period_days: 'installmentGracePeriodDays',
    installmentGracePeriodDays: 'installmentGracePeriodDays',
    boundary: 'boundary',
    additional_fees: 'additionalFees',
    additionalFees: 'additionalFees',
  }

  for (const [key, message] of Object.entries(submitFieldErrors ?? {})) {
    if (!message) continue
    const field = fieldMap[key] ?? (key.startsWith('boundary.') ? 'boundary' : undefined)
    if (field) mapped[field] = message
  }
  return mapped
}

export function validatePropertyFields(
  i: CreatePropertyInput,
  options?: {
    requirePlotNumber?: boolean
    takenPlotNumbers?: number[]
    excludePlotNumber?: number | null
  },
): PropertyFieldErrors {
  const errors: PropertyFieldErrors = {}

  if (!i.propertyName.trim()) errors.propertyName = 'Property name is required.'
  if (i.pricingMode !== 'estate_rate' && (!Number.isFinite(i.price) || (i.price ?? 0) <= 0)) {
    errors.price = 'Property price must be greater than zero.'
  }
  if (options?.requirePlotNumber) {
    if (!i.plotNumber || i.plotNumber < 1) {
      errors.plotNumber = 'Plot number is required.'
    } else {
      const taken = (options.takenPlotNumbers ?? []).filter(
        (value) => value !== options.excludePlotNumber,
      )
      if (taken.includes(i.plotNumber)) {
        errors.plotNumber = `Plot ${i.plotNumber} already exists in this estate. Each plot number must be unique.`
      }
    }
  }
  if (i.propertyType === 'plot') {
    if (!i.plotUse) errors.plotUse = 'Plot use is required.'
    if (!i.plotSize || i.plotSize <= 0) errors.plotSize = 'Plot size must be greater than zero.'
  }
  if (i.propertyType === 'residential') {
    if (!i.buildingTypeResidential) {
      errors.buildingTypeResidential = 'Residential building type is required.'
    }
    if (!i.bedrooms || i.bedrooms < 1) errors.bedrooms = 'Bedrooms are required.'
    if (!i.bathrooms || i.bathrooms < 1) errors.bathrooms = 'Bathrooms are required.'
    if (!i.totalAreaResidential || i.totalAreaResidential <= 0) {
      errors.totalAreaResidential = 'Total area is required.'
    }
  }
  if (i.propertyType === 'commercial') {
    if (!i.buildingTypeCommercial) {
      errors.buildingTypeCommercial = 'Commercial building type is required.'
    }
    if (!i.totalAreaCommercial || i.totalAreaCommercial <= 0) {
      errors.totalAreaCommercial = 'Total area is required.'
    }
    if (!i.numberOfFloors || i.numberOfFloors < 1) {
      errors.numberOfFloors = 'Number of floors is required.'
    }
  }

  const boundaryError = validateBoundary(i.boundary)
  if (boundaryError) errors.boundary = boundaryError
  const feeError = validateFees(i.feeConfig?.additionalFees)
  if (feeError) errors.additionalFees = feeError
  const policyError = validateCommercialPolicy(i)
  if (policyError) Object.assign(errors, mapPropertyValidationMessage(policyError, i.propertyType))

  return errors
}

export function validateProperty(
  i: CreatePropertyInput,
  options?: {
    requirePlotNumber?: boolean
    takenPlotNumbers?: number[]
    excludePlotNumber?: number | null
    currentStatus?: string
  },
) {
  if (!i.propertyName.trim()) return 'Property name is required.'
  const statusError = options?.currentStatus !== i.status ? validatePropertyStatus(i.status) : ''
  if (statusError) return statusError
  if (i.pricingMode !== 'estate_rate' && (!Number.isFinite(i.price) || (i.price ?? 0) <= 0))
    return 'Property price must be greater than zero.'
  if (options?.requirePlotNumber) {
    if (!i.plotNumber || i.plotNumber < 1) return 'Plot number is required.'
    const taken = (options.takenPlotNumbers ?? []).filter(
      (value) => value !== options.excludePlotNumber,
    )
    if (taken.includes(i.plotNumber)) {
      return `Plot ${i.plotNumber} already exists in this estate. Each plot number must be unique.`
    }
  }
  if (i.propertyType === 'plot' && !i.plotUse) return 'Plot use is required.'
  if (i.propertyType === 'plot' && (!i.plotSize || i.plotSize <= 0))
    return 'Plot size must be greater than zero.'
  if (i.propertyType === 'residential') {
    if (!i.buildingTypeResidential) return 'Residential building type is required.'
    if (!i.bedrooms || !i.bathrooms || !i.totalAreaResidential)
      return 'Bedrooms, bathrooms and total area are required for residential property.'
  }
  if (i.propertyType === 'commercial') {
    if (!i.buildingTypeCommercial) return 'Commercial building type is required.'
    if (!i.totalAreaCommercial || !i.numberOfFloors)
      return 'Total area and number of floors are required for commercial property.'
  }
  const boundaryError = validateBoundary(i.boundary)
  if (boundaryError) return boundaryError
  const feeError = validateFees(i.feeConfig?.additionalFees)
  if (feeError) return feeError
  const policyError = validateCommercialPolicy(i)
  if (policyError) return policyError
  return ''
}
export function validateBrokerage(i: CreateBrokerageInput) {
  if (!i.title.trim()) return 'Property title is required.'
  if (!i.location.trim()) return 'Location is required.'
  if (!i.ownerName.trim()) return 'Owner / mandate giver is required.'
  if (!Number.isFinite(i.price) || i.price <= 0) return 'Asking price must be greater than zero.'
  if (i.commissionRate < 0 || i.commissionRate > 100)
    return 'Commission rate must be between 0 and 100%.'
  const boundaryError = validateBoundary(i.boundary)
  if (boundaryError) return boundaryError
  const feeError = validateFees(i.additionalFees)
  if (feeError) return feeError
  const policyError = validateCommercialPolicy(i)
  if (policyError) return policyError
  return ''
}

export type BrokerageFieldKey =
  | 'title'
  | 'location'
  | 'ownerName'
  | 'price'
  | 'commissionRate'
  | 'requestClaimHoldHours'
  | 'reservationPercent'
  | 'reservationDurationHours'
  | 'reservationRetentionPercent'
  | 'installmentDownPaymentPercent'
  | 'installmentMonths'
  | 'installmentGracePeriodDays'
  | 'boundary'
  | 'additionalFees'

export type BrokerageFieldErrors = Partial<Record<BrokerageFieldKey, string | undefined>>

export function firstBrokerageFieldError(errors: BrokerageFieldErrors): BrokerageFieldKey | null {
  const order: BrokerageFieldKey[] = [
    'title',
    'location',
    'ownerName',
    'price',
    'commissionRate',
    'requestClaimHoldHours',
    'reservationPercent',
    'reservationDurationHours',
    'reservationRetentionPercent',
    'installmentDownPaymentPercent',
    'installmentMonths',
    'installmentGracePeriodDays',
    'boundary',
    'additionalFees',
  ]
  return order.find((key) => Boolean(errors[key])) ?? null
}

export function mapBrokerageValidationMessage(message: string): BrokerageFieldErrors {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('boundary') ||
    normalized.includes('latitude') ||
    normalized.includes('longitude')
  ) {
    return { boundary: message }
  }
  if (normalized.includes('fee')) return { additionalFees: message }
  if (normalized.includes('title')) return { title: message }
  if (normalized.includes('location')) return { location: message }
  if (normalized.includes('owner') || normalized.includes('mandate')) return { ownerName: message }
  if (normalized.includes('asking price')) return { price: message }
  if (normalized.includes('commission')) return { commissionRate: message }
  if (normalized.includes('claim hold')) return { requestClaimHoldHours: message }
  if (normalized.includes('reservation percent')) return { reservationPercent: message }
  if (normalized.includes('reservation duration')) return { reservationDurationHours: message }
  if (normalized.includes('reservation retention')) return { reservationRetentionPercent: message }
  if (normalized.includes('installment down payment')) {
    return { installmentDownPaymentPercent: message }
  }
  if (normalized.includes('installment term')) return { installmentMonths: message }
  if (normalized.includes('installment grace')) return { installmentGracePeriodDays: message }
  return {}
}
