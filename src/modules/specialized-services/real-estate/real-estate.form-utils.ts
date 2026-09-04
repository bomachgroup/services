import type { CreateEstateInput, Estate } from './real-estate.types'

export type EstateFormValues = CreateEstateInput & {
  tags: string
  minPriceOtherProperties: number
  maxPriceOtherProperties: number
  totalArea: number
  legalFee: number
  developmentFee: number
  receiptFee: number
}

export function parseEstateLocation(cityTown: string) {
  const parts = cityTown
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(', '),
      lga: parts[parts.length - 1] ?? '',
    }
  }

  return { city: cityTown, lga: '' }
}

export function mapEstateToFormValues(estate: Estate): EstateFormValues {
  return {
    isOurEstate: estate.isOurEstate,
    estateName: estate.estateName,
    estateCode: estate.estateCode,
    estateType: estate.estateType,
    developerCompanyName: estate.developerCompanyName,
    estateDescription: estate.estateDescription,
    country: estate.country || 'Nigeria',
    countryCode: estate.countryCode || 'NGA',
    state: estate.state,
    cityTown: parseEstateLocation(estate.cityTown).city,
    preciseAddress: estate.preciseAddress,
    hasCOfO: estate.hasCOfO,
    hasDeedOfAssignment: estate.hasDeedOfAssignment,
    hasSurveyPlan: estate.hasSurveyPlan,
    zoningInformation: estate.zoningInformation,
    hasPlanningPermit: estate.hasPlanningPermit,
    hasBuildingApproval: estate.hasBuildingApproval,
    hasEnvironmentalClearance: estate.hasEnvironmentalClearance,
    pricePerSqm: estate.pricePerSqm,
    availablePlotSizes: estate.availablePlotSizes,
    minPriceOtherProperties: estate.minPriceOtherProperties ?? 0,
    maxPriceOtherProperties: estate.maxPriceOtherProperties ?? 0,
    estateStatus: estate.estateStatus,
    totalArea: estate.totalArea ?? 0,
    areaUnit: estate.areaUnit || 'sqm',
    hasRoads: estate.hasRoads,
    hasElectricity: estate.hasElectricity,
    hasWater: estate.hasWater,
    hasFencing: estate.hasFencing,
    hasSecurity: estate.hasSecurity,
    hasDrainage: estate.hasDrainage,
    hasRecreation: estate.hasRecreation,
    legalFee: estate.legalFee ?? 0,
    developmentFee: estate.developmentFee ?? 0,
    receiptFee: estate.receiptFee ?? 0,
    tags: estate.tags.join(', '),
  }
}

export function createDefaultEstateFormValues(): EstateFormValues {
  return {
    isOurEstate: true,
    estateName: '',
    estateCode: '',
    estateType: 'residential',
    developerCompanyName: 'Bomach',
    estateDescription: '',
    country: 'Nigeria',
    countryCode: 'NGA',
    state: '',
    cityTown: '',
    preciseAddress: '',
    hasCOfO: false,
    hasDeedOfAssignment: false,
    hasSurveyPlan: false,
    zoningInformation: '',
    hasPlanningPermit: false,
    hasBuildingApproval: false,
    hasEnvironmentalClearance: false,
    pricePerSqm: 0,
    availablePlotSizes: '',
    minPriceOtherProperties: 0,
    maxPriceOtherProperties: 0,
    estateStatus: 'available',
    totalArea: 0,
    areaUnit: 'sqm',
    hasRoads: false,
    hasElectricity: false,
    hasWater: false,
    hasFencing: false,
    hasSecurity: false,
    hasDrainage: false,
    hasRecreation: false,
    legalFee: 0,
    developmentFee: 0,
    receiptFee: 0,
    tags: '',
  }
}
