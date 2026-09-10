export type EstateType = 'residential' | 'commercial' | 'industrial' | 'mixed_use' | 'land'
export type EstateStatus = 'available' | 'sold_out' | 'under_development' | 'coming_soon'
export type PropertyType = 'plot' | 'residential' | 'commercial'
export type PropertyStatus =
  | 'not-for-sale'
  | 'available'
  | 'under_offer'
  | 'reserved'
  | 'sold'
  | 'hold'
export type BrokerageVerificationStatus = 'pending' | 'verified' | 'inspection_due'
export type BrokerageStatus = 'available' | 'sold' | 'off_market'
export type BrokeragePropertyType = 'residential' | 'commercial' | 'land'
export type PlotUse = 'residential' | 'commercial'
export type PricingMode = 'estate_rate' | 'manual_override'
export type FeePaymentTiming = 'upfront' | 'deferred'

export interface BoundaryPoint {
  lat: number
  lng: number
}

export interface BoundaryValidationResult {
  valid: boolean
  detail: string
  pointCount: number
}

export interface Choice<Value extends string = string> {
  value: Value
  label: string
}

export interface NamedDocument {
  id: number
  name: string
  file: string
  createdAt: string
}

export type EstateDocument = NamedDocument

export interface AdditionalFee {
  id?: string
  name: string
  amount: number
  paymentTiming: FeePaymentTiming
  active: boolean
}

export interface PropertyFeeOverride {
  estateFeeId: string
  action: 'override' | 'exclude'
  amount?: number | null
}

export interface PropertyFeeConfig {
  inheritEstateFees: boolean
  overrides: PropertyFeeOverride[]
  additionalFees: AdditionalFee[]
}

export interface EffectivePricingFee extends AdditionalFee {
  id: string
  source: 'estate' | 'property_override' | 'property'
}

export interface EffectivePropertyPricing {
  basePrice: number
  basePriceSource: PricingMode
  estateRate: number | null
  areaSqm: number | null
  fees: EffectivePricingFee[]
  feesTotal: number
  total: number
}

export interface PricingHistoryEvent {
  event: string
  at: string
  changedBy: number | null
  reason: string
  data: Record<string, unknown>
}

export interface Estate {
  id: number
  isOurEstate: boolean
  estateName: string
  estateCode: string
  estateType: EstateType
  estateTypeDisplay: string
  developerCompanyName: string
  estateDescription: string
  country: string
  countryCode: string
  state: string
  cityTown: string
  preciseAddress: string
  boundary: BoundaryPoint[]
  documents: EstateDocument[]
  additionalFees: AdditionalFee[]
  pricingHistory: PricingHistoryEvent[]
  hasCOfO: boolean
  hasDeedOfAssignment: boolean
  hasSurveyPlan: boolean
  zoningInformation: string
  titleDocuments: string[]
  hasPlanningPermit: boolean
  hasBuildingApproval: boolean
  hasEnvironmentalClearance: boolean
  governmentApprovals: string[]
  pricePerSqm: number
  availablePlotSizes: string
  minPriceOtherProperties: number | null
  maxPriceOtherProperties: number | null
  estateStatus: EstateStatus
  estateStatusDisplay: string
  totalArea: number | null
  areaUnit: string
  hasRoads: boolean
  hasElectricity: boolean
  hasWater: boolean
  hasFencing: boolean
  hasSecurity: boolean
  hasDrainage: boolean
  hasRecreation: boolean
  amenities: string[]
  tags: string[]
  allowReservation: boolean
  reservationPercent: number | null
  reservationDurationHours: number | null
  requestClaimHoldHours: number | null
  reservationRefundable: boolean
  reservationRetentionPercent: number
  allowInstallment: boolean
  installmentDownPaymentPercent: number | null
  installmentMonths: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface EstateFilters {
  search?: string
  estateType?: EstateType
  estateStatus?: EstateStatus
  country?: string
  isOurEstate?: boolean
  isActive?: boolean
  page?: number
  limit?: number
}

export interface PaginatedEstates {
  count: number
  items: Estate[]
}

export interface EstateStats {
  total: number
  sold: number
  reserved: number
  underOffer: number
  available: number
  hold: number
  notForSale: number
  totalValue: number
  soldValue: number
}

export interface EstatePlotLayoutItem {
  id: number
  plotNumber: number | null
  propertyName: string
  propertyType: PropertyType
  propertyTypeDisplay: string
  plotUse: PlotUse | ''
  plotUseDisplay: string
  status: PropertyStatus
  statusDisplay: string
  plotSize: number | null
  plotSizeUnit: string
  price: number
  isOurProperty: boolean
  clientName: string
}

export interface EstateChoices {
  estateType: Choice<EstateType>[]
  estateStatus: Choice<EstateStatus>[]
  areaUnit: Choice[]
}

export interface CreateEstateInput {
  isOurEstate: boolean
  estateName: string
  estateCode: string
  estateType: EstateType
  developerCompanyName: string
  estateDescription: string
  country: string
  countryCode?: string
  state: string
  cityTown: string
  preciseAddress: string
  hasCOfO: boolean
  hasDeedOfAssignment: boolean
  hasSurveyPlan: boolean
  zoningInformation?: string
  hasPlanningPermit: boolean
  hasBuildingApproval: boolean
  hasEnvironmentalClearance: boolean
  pricePerSqm: number
  availablePlotSizes?: string
  minPriceOtherProperties?: number | null
  maxPriceOtherProperties?: number | null
  estateStatus: EstateStatus
  totalArea?: number | null
  areaUnit: string
  hasRoads: boolean
  hasElectricity: boolean
  hasWater: boolean
  hasFencing: boolean
  hasSecurity: boolean
  hasDrainage: boolean
  hasRecreation: boolean
  tags?: string[]
  boundary?: BoundaryPoint[]
  additionalFees?: AdditionalFee[]
  pricingHistory?: PricingHistoryEvent[]
  pricingChangeReason?: string
  documents?: Array<Partial<NamedDocument> & { fileUrl?: string }>
  allowReservation?: boolean
  reservationPercent?: number | null
  reservationDurationHours?: number | null
  requestClaimHoldHours?: number | null
  reservationRefundable?: boolean
  reservationRetentionPercent?: number | null
  allowInstallment?: boolean
  installmentDownPaymentPercent?: number | null
  installmentMonths?: number | null
}

export interface PropertyImage {
  id: number
  image: string
  caption: string
  createdAt: string
}

export interface Property {
  id: number
  isOurProperty: boolean
  estateId: number | null
  estateName: string
  estateCode: string
  propertyType: PropertyType
  propertyTypeDisplay: string
  plotUse: PlotUse | ''
  plotUseDisplay: string
  propertyName: string
  price: number
  boundary: BoundaryPoint[]
  pricingMode: PricingMode
  feeConfig: PropertyFeeConfig
  pricingHistory: PricingHistoryEvent[]
  effectivePricing: EffectivePropertyPricing | null
  description: string
  status: PropertyStatus
  statusDisplay: string
  plotNumber: number | null
  clientName: string
  plotSize: number | null
  plotSizeUnit: string
  buildingTypeResidential: string
  buildingTypeResidentialDisplay: string
  bedrooms: number | null
  bathrooms: number | null
  floorsResidential: number | null
  totalAreaResidential: number | null
  buildingTypeCommercial: string
  buildingTypeCommercialDisplay: string
  totalAreaCommercial: number | null
  numberOfFloors: number | null
  unitsOffices: number | null
  images: PropertyImage[]
  documents: NamedDocument[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PropertyFilters {
  propertyType?: PropertyType
  status?: PropertyStatus
  isOurProperty?: boolean
  isActive?: boolean
  search?: string
  page?: number
  limit?: number
}

export interface PaginatedProperties {
  count: number
  items: Property[]
}

export interface CreatePropertyInput {
  isOurProperty: boolean
  propertyType: PropertyType
  plotUse?: PlotUse | ''
  propertyName: string
  price?: number | null
  boundary?: BoundaryPoint[]
  pricingMode?: PricingMode
  feeConfig?: PropertyFeeConfig
  pricingChangeReason?: string
  description?: string
  status: PropertyStatus
  plotNumber?: number | null
  clientName?: string
  plotSize?: number | null
  plotSizeUnit?: string
  buildingTypeResidential?: string
  bedrooms?: number | null
  bathrooms?: number | null
  floorsResidential?: number | null
  totalAreaResidential?: number | null
  buildingTypeCommercial?: string
  totalAreaCommercial?: number | null
  numberOfFloors?: number | null
  unitsOffices?: number | null
  images?: string[]
  documents?: Array<Partial<NamedDocument> & { fileUrl?: string }>
}

export interface BulkPropertyCreateInput {
  count: number
  startingNumber: number
  namePrefix: string
  template: CreatePropertyInput
}

export interface BulkPropertyCreateResult {
  createdCount: number
  startingNumber: number
  endingNumber: number
}

export interface QuickUpdatePlotInput {
  status?: PropertyStatus
  price?: number | null
  clientName?: string
  pricingMode?: PricingMode
}

export type BatchItemStatus = 'queued' | 'creating' | 'created' | 'failed'

export interface PropertyBatchItem {
  key: string
  sequence: number
  input: CreatePropertyInput
  status: BatchItemStatus
  propertyId: number | null
  error: string
}

export interface BrokerageListing {
  id: number
  title: string
  description: string
  location: string
  price: number
  boundary: BoundaryPoint[]
  propertyType: BrokeragePropertyType
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  commissionRate: number
  verificationStatus: BrokerageVerificationStatus
  status: BrokerageStatus
  assignedAgentId: number | null
  estateId: number | null
  tags: string[]
  additionalFees: AdditionalFee[]
  pricingHistory: PricingHistoryEvent[]
  isActive: boolean
  images: Array<{ id: number; image: string; caption: string; createdAt: string }>
  documents: NamedDocument[]
  createdAt: string
  updatedAt: string
}

export interface BrokerageFilters {
  search?: string
  status?: BrokerageStatus
  verificationStatus?: BrokerageVerificationStatus
  propertyType?: BrokeragePropertyType
  isActive?: boolean
  page?: number
  limit?: number
}

export interface PaginatedBrokerageListings {
  count: number
  items: BrokerageListing[]
}

export interface BrokerageStats {
  total: number
  verified: number
  pendingVerification: number
  inspectionDue: number
  sold: number
  available: number
  offMarket: number
  totalListingValue: number
}

export interface CreateBrokerageInput {
  title: string
  description?: string
  location: string
  price: number
  boundary?: BoundaryPoint[]
  propertyType: BrokeragePropertyType
  ownerName: string
  ownerPhone?: string
  ownerEmail?: string
  commissionRate: number
  verificationStatus: BrokerageVerificationStatus
  status: BrokerageStatus
  assignedAgentId?: number | null
  estateId?: number | null
  tags?: string[]
  isActive?: boolean
  images?: string[]
  documents?: Array<Partial<NamedDocument> & { fileUrl?: string }>
  additionalFees?: AdditionalFee[]
  pricingChangeReason?: string
}

export const propertyStatuses: Array<Choice<PropertyStatus>> = [
  { value: 'available', label: 'Available' },
  { value: 'under_offer', label: 'Under offer' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'sold', label: 'Sold' },
  { value: 'hold', label: 'Hold' },
  { value: 'not-for-sale', label: 'Not for Sale' },
]

export const propertyTypes: Array<Choice<PropertyType>> = [
  { value: 'plot', label: 'Plot of Land' },
  { value: 'residential', label: 'Residential Building' },
  { value: 'commercial', label: 'Commercial Building' },
]

export const plotUses: Array<Choice<PlotUse>> = [
  { value: 'residential', label: 'Residential Plot' },
  { value: 'commercial', label: 'Commercial Plot' },
]

export const pricingModes: Array<Choice<PricingMode>> = [
  { value: 'estate_rate', label: 'Estate rate' },
  { value: 'manual_override', label: 'Manual override' },
]

export const feePaymentTimings: Array<Choice<FeePaymentTiming>> = [
  { value: 'upfront', label: 'Upfront' },
  { value: 'deferred', label: 'Deferred' },
]

export const estateTypes: Array<Choice<EstateType>> = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'land', label: 'Land' },
]

export const estateStatuses: Array<Choice<EstateStatus>> = [
  { value: 'available', label: 'Available' },
  { value: 'sold_out', label: 'Sold Out' },
  { value: 'under_development', label: 'Under Development' },
  { value: 'coming_soon', label: 'Coming Soon' },
]

export const brokerageVerificationStatuses: Array<Choice<BrokerageVerificationStatus>> = [
  { value: 'pending', label: 'Pending Verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'inspection_due', label: 'Inspection Due' },
]

export const brokerageStatuses: Array<Choice<BrokerageStatus>> = [
  { value: 'available', label: 'Available' },
  { value: 'sold', label: 'Sold' },
  { value: 'off_market', label: 'Off Market' },
]

export const brokeragePropertyTypes: Array<Choice<BrokeragePropertyType>> = [
  { value: 'land', label: 'Land' },
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
]

export const residentialBuildingTypes = [
  { value: 'house', label: 'House' },
  { value: 'villa', label: 'Villa' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'penthouse', label: 'Penthouse' },
] as const

export const commercialBuildingTypes = [
  { value: 'office', label: 'Office' },
  { value: 'retail', label: 'Retail Space' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'shopping_mall', label: 'Shopping Mall' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'mixed_use', label: 'Mixed Use' },
] as const

export const estateLegalApprovalInfrastructureOptions = [
  { value: 'hasCOfO', label: 'C of O' },
  { value: 'hasDeedOfAssignment', label: 'Deed of Assignment' },
  { value: 'hasSurveyPlan', label: 'Survey Plan' },
  { value: 'hasPlanningPermit', label: 'Planning Permit' },
  { value: 'hasBuildingApproval', label: 'Building Approval' },
  { value: 'hasEnvironmentalClearance', label: 'Environmental Clearance' },
  { value: 'hasRoads', label: 'Roads' },
  { value: 'hasElectricity', label: 'Electricity' },
  { value: 'hasWater', label: 'Water' },
  { value: 'hasFencing', label: 'Fencing' },
  { value: 'hasSecurity', label: 'Security' },
  { value: 'hasDrainage', label: 'Drainage' },
  { value: 'hasRecreation', label: 'Recreation' },
] as const

export type EstateLegalApprovalInfrastructureField =
  (typeof estateLegalApprovalInfrastructureOptions)[number]['value']

export interface RealEstateAssetSelectionInput {
  propertyId?: number
  brokerageListingId?: number
  sortOrder?: number
  settlementMode?: 'full_payment' | 'reservation' | 'installment'
  agreedPrice?: number
}

export interface RealEstateSuggestedQuoteItem {
  description: string
  kind: 'primary' | 'additional_charge'
  paymentTiming: 'deposit_based' | 'upfront' | 'deferred'
  quantity: number
  unitPrice: number
  sortOrder: number
  sourceContext: Record<string, unknown>
  assetType: string
  assetId: number
  assetName: string
}

export interface RealEstateRequestAsset {
  id: number
  assetType: string
  assetId: number
  assetName: string
  assetStatus: string
  price: number
  settlementMode: string
  reservationExpiresAt: string | null
  claimExpiresAt: string | null
  paymentPlan: Record<string, unknown>
  releasedAt: string | null
  releaseReason: string
}

export interface RealEstatePaymentPolicy {
  allowReservation: boolean
  reservationPercent: number | null
  reservationDurationHours: number | null
  requestClaimHoldHours: number | null
  reservationRefundable: boolean
  reservationRetentionPercent: number
  allowInstallment: boolean
  installmentDownPaymentPercent: number | null
  installmentMonths: number | null
  termsSummary: string[]
}

export interface RealEstateCommercialContext {
  requestId: number
  requestNumber: string
  requestContext: string
  stage: string
  assets: RealEstateRequestAsset[]
  suggestedQuoteItems: RealEstateSuggestedQuoteItem[]
  paymentPolicy: RealEstatePaymentPolicy
  paymentTermsSummary: string[]
  allowsServiceOrder: boolean
  requiresFulfillment: boolean
}

export interface RealEstateCommercialHistoryItem {
  id: number
  requestId: number
  requestNumber: string
  clientName: string
  serviceName: string
  requestStatus: string
  quoteNumber: string
  invoiceNumber: string
  assetType: string
  assetId: number
  assetName: string
  releasedAt: string | null
  releaseReason: string
  createdAt: string
}
