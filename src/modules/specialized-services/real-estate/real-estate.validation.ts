import type {
  AdditionalFee,
  BoundaryPoint,
  CreateBrokerageInput,
  CreateEstateInput,
  CreatePropertyInput,
  QuickUpdatePlotInput,
} from './real-estate.types'

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
  if (
    !Number.isFinite(i.requestClaimHoldHours ?? NaN) ||
    (i.requestClaimHoldHours ?? 0) < 1
  ) {
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
export function validateProperty(
  i: CreatePropertyInput,
  options?: {
    requirePlotNumber?: boolean
    takenPlotNumbers?: number[]
    excludePlotNumber?: number | null
  },
) {
  if (!i.propertyName.trim()) return 'Property name is required.'
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
  return ''
}
export function validateBrokerage(i: CreateBrokerageInput) {
  if (!i.title.trim() || !i.location.trim() || !i.ownerName.trim())
    return 'Title, location and owner / mandate giver are required.'
  if (!Number.isFinite(i.price) || i.price <= 0) return 'Asking price must be greater than zero.'
  if (i.commissionRate < 0 || i.commissionRate > 100)
    return 'Commission rate must be between 0 and 100%.'
  const boundaryError = validateBoundary(i.boundary)
  if (boundaryError) return boundaryError
  const feeError = validateFees(i.additionalFees)
  if (feeError) return feeError
  return ''
}
