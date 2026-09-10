import { formatCurrency } from '@/shared/lib/formatters'

import type { Property } from './real-estate.types'

const AREA_TO_SQM: Record<string, number> = {
  sqm: 1,
  hectare: 10000,
  hectares: 10000,
  acre: 4046.8564224,
  acres: 4046.8564224,
  sqft: 0.09290304,
}

function propertyAreaSqm(property: Property): number | null {
  const fromEffective = property.effectivePricing?.areaSqm
  if (fromEffective != null && fromEffective > 0) return fromEffective

  if (property.propertyType === 'plot') {
    if (property.plotSize == null || property.plotSize <= 0) return null
    const factor = AREA_TO_SQM[(property.plotSizeUnit || 'sqm').toLowerCase()] ?? 1
    return Math.round(property.plotSize * factor * 100) / 100
  }
  if (property.propertyType === 'residential') {
    return property.totalAreaResidential != null && property.totalAreaResidential > 0
      ? property.totalAreaResidential
      : null
  }
  return property.totalAreaCommercial != null && property.totalAreaCommercial > 0
    ? property.totalAreaCommercial
    : null
}

/**
 * Resolve the sellable property base price.
 * Estate-rate properties are rate × area (sqm). Manual override uses stored price.
 * Prefer API effectivePricing when present; otherwise compute client-side.
 */
export function resolvePropertySaleBasePrice(
  property: Property | null | undefined,
  estatePricePerSqm?: number | null,
): number {
  if (!property) return 0

  if (property.pricingMode === 'manual_override') {
    return property.price > 0 ? property.price : 0
  }

  const effective = property.effectivePricing
  if (effective?.basePriceSource === 'estate_rate' && effective.basePrice > 0) {
    return effective.basePrice
  }

  const rate = effective?.estateRate ?? estatePricePerSqm ?? null
  const area = propertyAreaSqm(property)
  if (rate != null && rate > 0 && area != null && area > 0) {
    return Math.round(rate * area * 100) / 100
  }

  if (effective?.basePrice && effective.basePrice > 0) return effective.basePrice
  return property.price > 0 ? property.price : 0
}

/** Base price plus active fees when the API provided them. */
export function resolvePropertyPackageTotal(
  property: Property | null | undefined,
  estatePricePerSqm?: number | null,
): number {
  const base = resolvePropertySaleBasePrice(property, estatePricePerSqm)
  if (!property) return base

  const effective = property.effectivePricing
  if (effective?.total && effective.total > 0 && effective.basePrice > 0) {
    const feeDelta = effective.total - effective.basePrice
    return Math.round((base + Math.max(0, feeDelta)) * 100) / 100
  }

  return base
}

export function propertyPriceSourceLabel(
  property: Property | null | undefined,
  estatePricePerSqm?: number | null,
): string {
  if (!property) return ''
  if (property.pricingMode === 'manual_override') return 'Listed property price'

  const effective = property.effectivePricing
  const rate = effective?.estateRate ?? estatePricePerSqm ?? null
  const area = propertyAreaSqm(property)
  if (rate != null && area != null) {
    return `Estate rate · ${formatCurrency(rate)}/sqm × ${Number(area).toLocaleString()} sqm`
  }
  return 'Calculated from estate rate'
}
