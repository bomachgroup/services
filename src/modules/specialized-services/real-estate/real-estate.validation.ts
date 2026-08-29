import type {
  CreateBrokerageInput,
  CreateEstateInput,
  CreatePropertyInput,
  QuickUpdatePlotInput,
} from './real-estate.types'
import { validateBoundary } from './real-estate.boundary'

export function validatePropertyFields(i: CreatePropertyInput, options?: { requirePrice?: boolean }) {
  const errors: Record<string, string> = {}
  if (!i.propertyName.trim()) errors.propertyName = 'Property name is required.'
  const boundaryError = validateBoundary(i.boundary)
  if (boundaryError) errors.boundary = boundaryError
  const requirePrice = options?.requirePrice ?? true
  if (requirePrice && (i.price == null || !Number.isFinite(i.price) || i.price <= 0)) {
    errors.price = 'Property price must be greater than zero.'
  }
  if (i.propertyType === 'plot') {
    if (!i.plotSize || i.plotSize <= 0) errors.plotSize = 'Plot size must be greater than zero.'
  }
  if (i.propertyType === 'residential') {
    if (!i.buildingTypeResidential)
      errors.buildingTypeResidential = 'Residential building type is required.'
    if (!i.bedrooms) errors.bedrooms = 'Bedrooms are required.'
    if (!i.bathrooms) errors.bathrooms = 'Bathrooms are required.'
    if (!i.totalAreaResidential || i.totalAreaResidential <= 0) {
      errors.totalAreaResidential = 'Total area is required.'
    }
  }
  if (i.propertyType === 'commercial') {
    if (!i.buildingTypeCommercial)
      errors.buildingTypeCommercial = 'Commercial building type is required.'
    if (!i.totalAreaCommercial || i.totalAreaCommercial <= 0) {
      errors.totalAreaCommercial = 'Total area is required.'
    }
    if (!i.numberOfFloors) errors.numberOfFloors = 'Number of floors is required.'
  }
  return errors
}

export function validateQuickPlotUpdate(i: QuickUpdatePlotInput) {
  if (i.price !== undefined && (!Number.isFinite(i.price) || i.price <= 0))
    return 'Plot price must be greater than zero.'
  if (i.status === 'under_offer' || i.status === 'reserved' || i.status === 'sold')
    return 'Under offer, reserved, and sold states are controlled by the purchase workflow.'
  return ''
}
export function validateEstate(i: CreateEstateInput) {
  if (!i.estateName.trim()) return 'Estate name is required.'
  if (!i.estateCode.trim()) return 'Estate code is required.'
  if (!i.developerCompanyName.trim()) return 'Developer / company name is required.'
  if (!i.estateDescription.trim()) return 'Estate description is required.'
  if (!i.country.trim() || !i.state.trim() || !i.cityTown.trim() || !i.preciseAddress.trim())
    return 'Complete Estate location is required.'
  const boundaryError = validateBoundary(i.boundary)
  if (boundaryError) return boundaryError
  if (!Number.isFinite(i.pricePerSqm) || i.pricePerSqm < 0)
    return 'Price per square metre must be zero or greater.'
  if (
    i.minPriceOtherProperties != null &&
    i.maxPriceOtherProperties != null &&
    i.minPriceOtherProperties > i.maxPriceOtherProperties
  )
    return 'Minimum property price cannot exceed maximum property price.'
  if (i.reservationAllowed) {
    if (
      i.reservationThresholdPercent == null ||
      !Number.isFinite(i.reservationThresholdPercent) ||
      i.reservationThresholdPercent <= 0 ||
      i.reservationThresholdPercent > 100
    )
      return 'Reservation threshold must be greater than 0% and at most 100%.'
  } else if (i.reservationThresholdPercent != null) {
    return 'Reservation threshold must be empty when reservations are disabled.'
  }
  if (
    i.installmentAllowed &&
    i.maxInstallmentMonths != null &&
    (!Number.isInteger(i.maxInstallmentMonths) || i.maxInstallmentMonths < 1)
  )
    return 'Maximum plan length must be a positive whole number of months.'
  if (!i.installmentAllowed && i.maxInstallmentMonths != null)
    return 'Maximum plan length must be empty when installment plans are disabled.'
  if (!Number.isInteger(i.reservationPaymentWindowHours) || i.reservationPaymentWindowHours < 1)
    return 'Initial payment window must be at least 1 hour.'
  if (i.virtualTourUrl?.trim()) {
    try {
      new URL(i.virtualTourUrl)
    } catch {
      return 'Virtual tour link must be a valid URL.'
    }
  }
  return ''
}
export function validateProperty(i: CreatePropertyInput, options?: { requirePrice?: boolean }) {
  return Object.values(validatePropertyFields(i, options))[0] ?? ''
}
export function validateBrokerage(i: CreateBrokerageInput) {
  const boundaryError = validateBoundary(i.boundary)
  if (boundaryError) return boundaryError
  if (!i.title.trim() || !i.location.trim() || !i.ownerName.trim())
    return 'Title, location and owner / mandate giver are required.'
  if (!Number.isFinite(i.price) || i.price <= 0) return 'Asking price must be greater than zero.'
  if (i.commissionRate < 0 || i.commissionRate > 100)
    return 'Commission rate must be between 0 and 100%.'
  return ''
}
