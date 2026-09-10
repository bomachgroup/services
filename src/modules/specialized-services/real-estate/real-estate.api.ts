import { apiClient } from '@/shared/api/api-client'
import { mapServiceRequestDetail } from '@/modules/commercial/api/service-requests.mapper'
import type { CreateServiceRequestInput } from '@/modules/commercial/api/service-requests.types'
import {
  mapBrokerageList,
  mapBrokerageListing,
  mapBrokerageStats,
  mapEstate,
  mapEstateChoices,
  mapEstateLayout,
  mapEstateList,
  mapEstateStats,
  mapPlotLayoutItem,
  mapProperty,
  mapPropertyList,
} from './real-estate.mapper'
import type {
  BrokerageFilters,
  BulkPropertyCreateInput,
  BoundaryPoint,
  BoundaryValidationResult,
  BrokerageVerificationStatus,
  CreateBrokerageInput,
  CreateEstateInput,
  CreatePropertyInput,
  EstateFilters,
  PropertyFilters,
  QuickUpdatePlotInput,
  RealEstateAssetSelectionInput,
  RealEstateCommercialContext,
  RealEstateCommercialHistoryItem,
} from './real-estate.types'

function pageQuery(filters: { page?: number; limit?: number }) {
  const q = new URLSearchParams()
  const limit = filters.limit ?? 20,
    page = filters.page ?? 1
  q.set('limit', String(limit))
  q.set('offset', String((page - 1) * limit))
  return q
}
function estateQuery(filters: EstateFilters = {}) {
  const q = pageQuery(filters)
  if (filters.search) q.set('search', filters.search)
  if (filters.estateType) q.set('estate_type', filters.estateType)
  if (filters.estateStatus) q.set('estate_status', filters.estateStatus)
  if (filters.country) q.set('country', filters.country)
  if (filters.isOurEstate !== undefined) q.set('is_our_estate', String(filters.isOurEstate))
  if (filters.isActive !== undefined) q.set('is_active', String(filters.isActive))
  return q.toString()
}
function propertyQuery(filters: PropertyFilters = {}) {
  const q = pageQuery(filters)
  if (filters.search) q.set('search', filters.search)
  if (filters.propertyType) q.set('property_type', filters.propertyType)
  if (filters.status) q.set('status', filters.status)
  if (filters.isOurProperty !== undefined) q.set('is_our_property', String(filters.isOurProperty))
  if (filters.isActive !== undefined) q.set('is_active', String(filters.isActive))
  return q.toString()
}
function brokerageQuery(filters: BrokerageFilters = {}) {
  const q = pageQuery(filters)
  if (filters.search) q.set('search', filters.search)
  if (filters.status) q.set('status', filters.status)
  if (filters.verificationStatus) q.set('verification_status', filters.verificationStatus)
  if (filters.propertyType) q.set('property_type', filters.propertyType)
  if (filters.isActive !== undefined) q.set('is_active', String(filters.isActive))
  return q.toString()
}

const estatePayload = (i: CreateEstateInput) => ({
  is_our_estate: i.isOurEstate,
  estate_name: i.estateName,
  estate_code: i.estateCode,
  estate_type: i.estateType,
  developer_company_name: i.developerCompanyName,
  estate_description: i.estateDescription,
  country: i.country,
  country_code: i.countryCode ?? '',
  state: i.state,
  city_town: i.cityTown,
  precise_address: i.preciseAddress,
  boundary: i.boundary ?? [],
  documents: documentPayload(i.documents),
  has_c_of_o: i.hasCOfO,
  has_deed_of_assignment: i.hasDeedOfAssignment,
  has_survey_plan: i.hasSurveyPlan,
  zoning_information: i.zoningInformation ?? '',
  has_planning_permit: i.hasPlanningPermit,
  has_building_approval: i.hasBuildingApproval,
  has_environmental_clearance: i.hasEnvironmentalClearance,
  price_per_sqm: i.pricePerSqm,
  available_plot_sizes: i.availablePlotSizes ?? '',
  min_price_other_properties: i.minPriceOtherProperties ?? null,
  max_price_other_properties: i.maxPriceOtherProperties ?? null,
  estate_status: i.estateStatus,
  total_area: i.totalArea ?? null,
  area_unit: i.areaUnit,
  has_roads: i.hasRoads,
  has_electricity: i.hasElectricity,
  has_water: i.hasWater,
  has_fencing: i.hasFencing,
  has_security: i.hasSecurity,
  has_drainage: i.hasDrainage,
  has_recreation: i.hasRecreation,
  additional_fees: (i.additionalFees ?? []).map(feePayload),
  pricing_change_reason: i.pricingChangeReason ?? '',
  tags: i.tags ?? [],
  allow_reservation: Boolean(i.allowReservation),
  reservation_percent: i.allowReservation ? (i.reservationPercent ?? null) : null,
  reservation_duration_hours: i.allowReservation ? (i.reservationDurationHours ?? null) : null,
  request_claim_hold_hours: i.requestClaimHoldHours ?? 48,
  reservation_refundable: i.reservationRefundable !== false,
  reservation_retention_percent: i.allowReservation ? (i.reservationRetentionPercent ?? 0) : 0,
  allow_installment: Boolean(i.allowInstallment),
  installment_down_payment_percent: i.allowInstallment
    ? (i.installmentDownPaymentPercent ?? null)
    : null,
  installment_months: i.allowInstallment ? (i.installmentMonths ?? null) : null,
})
const feePayload = (fee: {
  id?: string
  name: string
  amount: number
  paymentTiming: string
  active: boolean
}) => ({
  ...(fee.id ? { id: fee.id } : {}),
  name: fee.name,
  amount: fee.amount,
  payment_timing: fee.paymentTiming,
  active: fee.active,
})
const feeConfigPayload = (config: CreatePropertyInput['feeConfig']) =>
  config
    ? {
        inherit_estate_fees: config.inheritEstateFees,
        overrides: config.overrides.map((override) => ({
          estate_fee_id: override.estateFeeId,
          action: override.action,
          ...(override.amount != null ? { amount: override.amount } : {}),
        })),
        additional_fees: config.additionalFees.map(feePayload),
      }
    : undefined
const documentPayload = (documents: CreatePropertyInput['documents']) =>
  (documents ?? []).map((document) => ({
    ...(document.id ? { id: document.id } : {}),
    name: document.name ?? 'Document',
    file_url: document.fileUrl ?? document.file ?? '',
  }))
const propertyPayload = (i: CreatePropertyInput) => ({
  is_our_property: i.isOurProperty,
  property_type: i.propertyType,
  plot_use: i.plotUse ?? '',
  property_name: i.propertyName,
  price: i.price ?? null,
  boundary: i.boundary ?? [],
  pricing_mode: i.pricingMode,
  ...(feeConfigPayload(i.feeConfig) ? { fee_config: feeConfigPayload(i.feeConfig) } : {}),
  pricing_change_reason: i.pricingChangeReason ?? '',
  description: i.description ?? '',
  status: i.status,
  plot_number: i.plotNumber ?? null,
  client_name: i.clientName ?? '',
  plot_size: i.plotSize ?? null,
  plot_size_unit: i.plotSizeUnit ?? 'sqm',
  building_type_residential: i.buildingTypeResidential ?? '',
  bedrooms: i.bedrooms ?? null,
  bathrooms: i.bathrooms ?? null,
  floors_residential: i.floorsResidential ?? null,
  total_area_residential: i.totalAreaResidential ?? null,
  building_type_commercial: i.buildingTypeCommercial ?? '',
  total_area_commercial: i.totalAreaCommercial ?? null,
  number_of_floors: i.numberOfFloors ?? null,
  units_offices: i.unitsOffices ?? null,
  images: i.images ?? [],
  documents: documentPayload(i.documents),
})
const brokeragePayload = (i: CreateBrokerageInput) => ({
  title: i.title,
  description: i.description ?? '',
  location: i.location,
  price: i.price,
  boundary: i.boundary ?? [],
  property_type: i.propertyType,
  owner_name: i.ownerName,
  owner_phone: i.ownerPhone ?? '',
  owner_email: i.ownerEmail ?? '',
  commission_rate: i.commissionRate,
  verification_status: i.verificationStatus,
  status: i.status,
  assigned_agent_id: i.assignedAgentId ?? null,
  estate_id: i.estateId ?? null,
  tags: i.tags ?? [],
  is_active: i.isActive ?? true,
  images: i.images ?? [],
  documents: documentPayload(i.documents),
  additional_fees: (i.additionalFees ?? []).map(feePayload),
  pricing_change_reason: i.pricingChangeReason ?? '',
})
const bulkPropertyPayload = (i: BulkPropertyCreateInput) => ({
  count: i.count,
  starting_number: i.startingNumber,
  name_prefix: i.namePrefix,
  template: propertyPayload(i.template),
})
const assetSelectionPayload = (items: RealEstateAssetSelectionInput[]) =>
  items.map((item, index) => ({
    ...(item.propertyId ? { property_id: item.propertyId } : {}),
    ...(item.brokerageListingId ? { brokerage_listing_id: item.brokerageListingId } : {}),
    sort_order: item.sortOrder ?? index * 10,
    ...(item.settlementMode ? { settlement_mode: item.settlementMode } : {}),
    ...(item.agreedPrice != null ? { agreed_price: item.agreedPrice } : {}),
  }))
const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const number = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const nullableText = (value: unknown) => (value == null ? null : text(value))
const boundaryValidationPayload = (boundary: BoundaryPoint[]) => ({
  boundary,
})
const mapBoundaryValidation = (payload: unknown): BoundaryValidationResult => {
  const value = record(payload)
  return {
    valid: Boolean(value.valid),
    detail: text(value.detail, 'Boundary is valid.'),
    pointCount: number(value.point_count),
  }
}
const mapCommercialContext = (payload: unknown): RealEstateCommercialContext => {
  const value = record(payload)
  const assets = Array.isArray(value.assets) ? value.assets : []
  const suggested = Array.isArray(value.suggested_quote_items) ? value.suggested_quote_items : []
  const policy = record(value.payment_policy)
  const terms = Array.isArray(value.payment_terms_summary)
    ? value.payment_terms_summary.filter((item): item is string => typeof item === 'string')
    : Array.isArray(policy.terms_summary)
      ? policy.terms_summary.filter((item): item is string => typeof item === 'string')
      : []
  return {
    requestId: number(value.request_id),
    requestNumber: text(value.request_number),
    requestContext: text(value.request_context),
    stage: text(value.stage),
    assets: assets.map((item) => {
      const asset = record(item)
      return {
        id: number(asset.id),
        assetType: text(asset.asset_type),
        assetId: number(asset.asset_id),
        assetName: text(asset.asset_name),
        assetStatus: text(asset.asset_status),
        price: number(asset.price),
        settlementMode: text(asset.settlement_mode),
        reservationExpiresAt: nullableText(asset.reservation_expires_at),
        claimExpiresAt: nullableText(asset.claim_expires_at),
        paymentPlan: record(asset.payment_plan),
        releasedAt: nullableText(asset.released_at),
        releaseReason: text(asset.release_reason),
      }
    }),
    suggestedQuoteItems: suggested.map((item) => {
      const quoteItem = record(item)
      return {
        description: text(quoteItem.description),
        kind: text(
          quoteItem.kind,
          'primary',
        ) as RealEstateCommercialContext['suggestedQuoteItems'][number]['kind'],
        paymentTiming: text(
          quoteItem.payment_timing,
          'deposit_based',
        ) as RealEstateCommercialContext['suggestedQuoteItems'][number]['paymentTiming'],
        quantity: number(quoteItem.quantity) || 1,
        unitPrice: number(quoteItem.unit_price),
        sortOrder: number(quoteItem.sort_order),
        sourceContext: record(quoteItem.source_context),
        assetType: text(quoteItem.asset_type),
        assetId: number(quoteItem.asset_id),
        assetName: text(quoteItem.asset_name),
      }
    }),
    paymentPolicy: {
      allowReservation: Boolean(policy.allow_reservation),
      reservationPercent:
        policy.reservation_percent == null || policy.reservation_percent === ''
          ? null
          : number(policy.reservation_percent),
      reservationDurationHours:
        policy.reservation_duration_hours == null || policy.reservation_duration_hours === ''
          ? null
          : number(policy.reservation_duration_hours),
      requestClaimHoldHours:
        policy.request_claim_hold_hours == null || policy.request_claim_hold_hours === ''
          ? 48
          : number(policy.request_claim_hold_hours),
      reservationRefundable: policy.reservation_refundable !== false,
      reservationRetentionPercent: number(policy.reservation_retention_percent),
      allowInstallment: Boolean(policy.allow_installment),
      installmentDownPaymentPercent:
        policy.installment_down_payment_percent == null ||
        policy.installment_down_payment_percent === ''
          ? null
          : number(policy.installment_down_payment_percent),
      installmentMonths:
        policy.installment_months == null || policy.installment_months === ''
          ? null
          : number(policy.installment_months),
      termsSummary: terms,
    },
    paymentTermsSummary: terms,
    allowsServiceOrder: Boolean(value.allows_service_order),
    requiresFulfillment: Boolean(value.requires_fulfillment),
  }
}
const mapCommercialHistory = (payload: unknown): RealEstateCommercialHistoryItem[] =>
  (Array.isArray(payload) ? payload : []).map((item) => {
    const value = record(item)
    return {
      id: number(value.id),
      requestId: number(value.request_id),
      requestNumber: text(value.request_number),
      clientName: text(value.client_name),
      serviceName: text(value.service_name),
      requestStatus: text(value.request_status),
      quoteNumber: text(value.quote_number),
      invoiceNumber: text(value.invoice_number),
      assetType: text(value.asset_type),
      assetId: number(value.asset_id),
      assetName: text(value.asset_name),
      releasedAt: nullableText(value.released_at),
      releaseReason: text(value.release_reason),
      createdAt: text(value.created_at),
    }
  })

export const realEstateApi = {
  listEstates: async (f: EstateFilters = {}) =>
    mapEstateList(await apiClient.get<unknown>(`/estates/?${estateQuery(f)}`)),
  estateDetail: async (id: number) => mapEstate(await apiClient.get<unknown>(`/estates/${id}`)),
  estateStats: async (id: number) =>
    mapEstateStats(await apiClient.get<unknown>(`/estates/${id}/stats`)),
  estateLayout: async (id: number) =>
    mapEstateLayout(await apiClient.get<unknown>(`/estates/${id}/layout`)),
  estateChoices: async () =>
    mapEstateChoices(await apiClient.get<unknown>('/estates/choices/fields')),
  createEstate: async (i: CreateEstateInput) =>
    mapEstate(await apiClient.post<unknown>('/estates/', estatePayload(i))),
  updateEstate: async (id: number, i: CreateEstateInput) =>
    mapEstate(await apiClient.put<unknown>(`/estates/${id}`, estatePayload(i))),
  deleteEstate: async (id: number) => apiClient.delete<unknown>(`/estates/${id}`),
  validateEstateBoundary: async (boundary: BoundaryPoint[], estateId?: number | null) =>
    mapBoundaryValidation(
      await apiClient.post<unknown>(
        estateId ? `/estates/${estateId}/validate-boundary` : '/estates/validate-boundary',
        boundaryValidationPayload(boundary),
      ),
    ),

  listProperties: async (estateId: number, f: PropertyFilters = {}) =>
    mapPropertyList(
      await apiClient.get<unknown>(`/estates/${estateId}/properties?${propertyQuery(f)}`),
    ),
  propertyDetail: async (estateId: number, id: number) =>
    mapProperty(await apiClient.get<unknown>(`/estates/${estateId}/properties/${id}`)),
  createProperty: async (estateId: number, i: CreatePropertyInput) =>
    mapProperty(
      await apiClient.post<unknown>(`/estates/${estateId}/properties`, propertyPayload(i)),
    ),
  updateProperty: async (estateId: number, id: number, i: CreatePropertyInput) =>
    mapProperty(
      await apiClient.put<unknown>(`/estates/${estateId}/properties/${id}`, propertyPayload(i)),
    ),
  deleteProperty: async (estateId: number, id: number) =>
    apiClient.delete<unknown>(`/estates/${estateId}/properties/${id}`),
  validatePropertyBoundary: async (
    estateId: number,
    boundary: BoundaryPoint[],
    propertyId?: number | null,
  ) =>
    mapBoundaryValidation(
      await apiClient.post<unknown>(
        propertyId
          ? `/estates/${estateId}/properties/${propertyId}/validate-boundary`
          : `/estates/${estateId}/properties/validate-boundary`,
        boundaryValidationPayload(boundary),
      ),
    ),
  bulkCreateProperties: async (estateId: number, i: BulkPropertyCreateInput) => {
    const result = await apiClient.post<Record<string, unknown>>(
      `/estates/${estateId}/properties/bulk`,
      bulkPropertyPayload(i),
    )
    return {
      createdCount: Number(result.created_count ?? 0),
      startingNumber: Number(result.starting_number ?? i.startingNumber),
      endingNumber: Number(result.ending_number ?? i.startingNumber + i.count - 1),
    }
  },
  listStandaloneProperties: async (f: PropertyFilters = {}) =>
    mapPropertyList(await apiClient.get<unknown>(`/estates/properties/all?${propertyQuery(f)}`)),
  createStandaloneProperty: async (i: CreatePropertyInput) =>
    mapProperty(await apiClient.post<unknown>('/estates/properties/all', propertyPayload(i))),
  updateStandaloneProperty: async (id: number, i: CreatePropertyInput) =>
    mapProperty(await apiClient.put<unknown>(`/estates/properties/all/${id}`, propertyPayload(i))),
  deleteStandaloneProperty: async (id: number) =>
    apiClient.delete<unknown>(`/estates/properties/all/${id}`),
  updatePropertyRecord: async (
    property: { id: number; estateId: number | null },
    i: CreatePropertyInput,
  ) => {
    if (property.estateId) {
      return mapProperty(
        await apiClient.put<unknown>(
          `/estates/${property.estateId}/properties/${property.id}`,
          propertyPayload(i),
        ),
      )
    }
    return mapProperty(
      await apiClient.put<unknown>(`/estates/properties/all/${property.id}`, propertyPayload(i)),
    )
  },
  quickUpdatePropertyInventory: async (estateId: number, id: number, i: QuickUpdatePlotInput) =>
    mapPlotLayoutItem(
      await apiClient.patch<unknown>(`/estates/${estateId}/plots/${id}/quick-update`, {
        ...(i.status !== undefined ? { status: i.status } : {}),
        ...(i.pricingMode !== undefined ? { pricing_mode: i.pricingMode } : {}),
        ...(i.pricingMode === 'estate_rate'
          ? {}
          : i.price !== undefined
            ? { price: i.price }
            : {}),
        ...(i.clientName !== undefined ? { client_name: i.clientName } : {}),
      }),
    ),

  listBrokerage: async (f: BrokerageFilters = {}) =>
    mapBrokerageList(await apiClient.get<unknown>(`/brokerage/?${brokerageQuery(f)}`)),
  brokerageStats: async () => mapBrokerageStats(await apiClient.get<unknown>('/brokerage/stats')),
  createBrokerage: async (i: CreateBrokerageInput) =>
    mapBrokerageListing(await apiClient.post<unknown>('/brokerage/', brokeragePayload(i))),
  updateBrokerage: async (id: number, i: CreateBrokerageInput) =>
    mapBrokerageListing(await apiClient.put<unknown>(`/brokerage/${id}`, brokeragePayload(i))),
  verifyBrokerage: async (id: number, verificationStatus: BrokerageVerificationStatus) =>
    mapBrokerageListing(
      await apiClient.patch<unknown>(`/brokerage/${id}/verify`, {
        verification_status: verificationStatus,
      }),
    ),
  deleteBrokerage: async (id: number) => apiClient.delete<unknown>(`/brokerage/${id}`),
  createCommercialRequest: async (
    input: CreateServiceRequestInput & { assetSelection: RealEstateAssetSelectionInput[] },
  ) =>
    mapServiceRequestDetail(
      await apiClient.post<unknown>('/real-estate/service-requests', {
        client_id: input.clientId,
        service_id: input.serviceId,
        ...(input.branchId ? { branch_id: input.branchId } : {}),
        contact_name: input.contactName,
        contact_phone: input.contactPhone,
        contact_email: input.contactEmail,
        customer_type: input.customerType,
        source: input.source,
        source_reference: input.sourceReference,
        priority: input.priority,
        ...(input.budget !== undefined ? { budget: input.budget } : {}),
        estimated_value: input.estimatedValue,
        ...(input.preferredDate ? { preferred_date: input.preferredDate } : {}),
        ...(input.dueDate ? { due_date: input.dueDate } : {}),
        next_action: input.nextAction,
        scope_summary: input.scopeSummary,
        answers: input.answers,
        ...(input.crmLeadId ? { crm_lead_id: input.crmLeadId } : {}),
        asset_selection: assetSelectionPayload(input.assetSelection),
      }),
    ),
  commercialContext: async (requestId: number) =>
    mapCommercialContext(
      await apiClient.get<unknown>(`/real-estate/service-requests/${requestId}/commercial-context`),
    ),
  replaceCommercialAssets: async (
    requestId: number,
    assetSelection: RealEstateAssetSelectionInput[],
  ) =>
    mapCommercialContext(
      await apiClient.put<unknown>(`/real-estate/service-requests/${requestId}/assets`, {
        asset_selection: assetSelectionPayload(assetSelection),
      }),
    ),
  cancelCommercialRequest: async (requestId: number, reason: string) =>
    mapServiceRequestDetail(
      await apiClient.post<unknown>(`/real-estate/service-requests/${requestId}/cancel`, {
        reason,
      }),
    ),
  propertyCommercialHistory: async (propertyId: number) =>
    mapCommercialHistory(
      await apiClient.get<unknown>(`/real-estate/properties/${propertyId}/commercial-history`),
    ),
  brokerageCommercialHistory: async (listingId: number) =>
    mapCommercialHistory(
      await apiClient.get<unknown>(`/real-estate/brokerage/${listingId}/commercial-history`),
    ),
}
