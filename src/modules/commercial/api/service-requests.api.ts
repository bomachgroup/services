import { apiClient } from '@/shared/api/api-client'

import { mapInvoice } from '../billing/billing.mapper'
import type { Invoice } from '../billing/billing.types'

import {
  mapClient,
  mapClients,
  mapClientsPage,
  mapEmployees,
  mapIntakeForm,
  mapServiceRequestChoices,
  mapServiceRequestDetail,
  mapServiceRequestList,
  mapServices,
} from './service-requests.mapper'
import type {
  BoundarySurveyEstimateInput,
  CalculatorEstimateResult,
  EngineeringCategoryInput,
  EngineeringCategoryOption,
  EngineeringEstimateInput,
  RestablishmentSurveyEstimateInput,
} from './calculator-estimate.types'
import type {
  ClientOption,
  CreateClientInput,
  CreateServiceRequestActivityInput,
  CreateServiceRequestAttachmentInput,
  CreateServiceRequestInput,
  EmployeeOption,
  PaginatedResult,
  ServiceIntakeForm,
  ServiceOption,
  ServiceRequestChoices,
  ServiceRequestDetail,
  ServiceRequestFilters,
  ServiceRequestListItem,
  ServiceRequestSummary,
  UpdateServiceRequestInput,
} from './service-requests.types'

function qs(filters: ServiceRequestFilters = {}) {
  const query = new URLSearchParams()
  const limit = filters.limit ?? 10
  const page = filters.page ?? 1
  query.set('limit', String(limit))
  query.set('offset', String((page - 1) * limit))
  if (filters.search) query.set('search', filters.search)
  if (filters.status) query.set('status', filters.status)
  if (filters.priority) query.set('priority', filters.priority)
  if (filters.branchId) query.set('branch_id', String(filters.branchId))
  if (filters.serviceId) query.set('service_id', String(filters.serviceId))
  return query.toString()
}

async function count(filters: ServiceRequestFilters = {}) {
  return mapServiceRequestList(
    await apiClient.get<unknown>(
      `/service-requests/admin?${qs({ ...filters, page: 1, limit: 1 })}`,
    ),
  ).count
}

function textOf(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function codeOf(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback
}

function mapEngineeringCategory(item: unknown): EngineeringCategoryOption {
  const row = (item ?? {}) as Record<string, unknown>
  return {
    id: Number(row.id ?? 0),
    name: textOf(row.name),
    categoryType: textOf(row.category_type),
    unitPrice: Number(row.unit_price ?? 0),
    maxBedrooms: Number(row.max_bedrooms_default ?? 0),
    maxFloors: Number(row.max_floors_default ?? 0),
    extraBedroomFee: Number(row.extra_bedroom_fee ?? 0),
    extraFloorFee: Number(row.extra_floor_fee ?? 0),
    maxArea:
      row.max_area_default == null || row.max_area_default === ''
        ? null
        : Number(row.max_area_default),
    areaFee: row.area_fee == null || row.area_fee === '' ? null : Number(row.area_fee),
    timelineDays:
      row.timeline_days_default == null || row.timeline_days_default === ''
        ? null
        : Number(row.timeline_days_default),
    timelineFee:
      row.timeline_fee == null || row.timeline_fee === '' ? null : Number(row.timeline_fee),
    active: row.is_active !== false,
  }
}

export const serviceRequestsApi = {
  async list(
    filters: ServiceRequestFilters = {},
  ): Promise<PaginatedResult<ServiceRequestListItem>> {
    return mapServiceRequestList(
      await apiClient.get<unknown>(`/service-requests/admin?${qs(filters)}`),
    )
  },

  async detail(requestId: number): Promise<ServiceRequestDetail> {
    return mapServiceRequestDetail(
      await apiClient.get<unknown>(`/service-requests/admin/${requestId}`),
    )
  },

  async choices(): Promise<ServiceRequestChoices> {
    return mapServiceRequestChoices(await apiClient.get<unknown>('/service-requests/choices'))
  },

  async clients(): Promise<ClientOption[]> {
    return mapClients(await apiClient.get<unknown>('/clients/admin/clients'))
  },

  async searchClients(search: string, limit = 20): Promise<ClientOption[]> {
    const page = await this.listClients(search, limit, 0)
    return page.items
  },

  async listClients(
    search: string,
    limit = 20,
    offset = 0,
  ): Promise<PaginatedResult<ClientOption>> {
    const query = new URLSearchParams()
    query.set('limit', String(limit))
    query.set('offset', String(offset))
    if (search.trim()) query.set('search', search.trim())
    return mapClientsPage(await apiClient.get<unknown>(`/clients/clients/?${query.toString()}`))
  },

  async createClient(input: CreateClientInput): Promise<ClientOption> {
    return mapClient(
      await apiClient.post<unknown>('/clients/clients/', {
        email: input.email.trim(),
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone_number: input.phoneNumber.trim(),
      }),
    )
  },

  async services(): Promise<ServiceOption[]> {
    return mapServices(
      await apiClient.get<unknown>(
        '/services/catalogue?status=active&client_visibility=visible&limit=100&offset=0',
      ),
    )
  },

  async employees(): Promise<EmployeeOption[]> {
    return mapEmployees(
      await apiClient.get<unknown>('/employees/employees?is_active=true&limit=100&offset=0'),
    )
  },

  async intakeForm(serviceId: number): Promise<ServiceIntakeForm> {
    return mapIntakeForm(
      await apiClient.get<unknown>(`/service-requests/services/${serviceId}/intake-form`),
    )
  },

  async uploadFile(file: File, signal?: AbortSignal): Promise<string> {
    const formData = new FormData()
    formData.set('file', file)
    const payload = await apiClient.post<{ url: string }>('/others/upload-file', formData, {
      ...(signal ? { signal } : {}),
    })
    return payload.url
  },

  async summary(): Promise<ServiceRequestSummary> {
    const [total, newCount, underReview, awaitingClient, siteAssessment, high, critical] =
      await Promise.all([
        count(),
        count({ status: 'new' }),
        count({ status: 'under_review' }),
        count({ status: 'awaiting_client' }),
        count({ status: 'site_assessment' }),
        count({ priority: 'high' }),
        count({ priority: 'critical' }),
      ])
    return {
      total,
      newCount,
      underReview,
      awaitingClient,
      siteAssessment,
      highPriority: high + critical,
    }
  },

  async create(input: CreateServiceRequestInput): Promise<ServiceRequestDetail> {
    return mapServiceRequestDetail(
      await apiClient.post<unknown>('/service-requests/admin', {
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
        ...(input.commercialPath ? { commercial_path: input.commercialPath } : {}),
      }),
    )
  },

  async update(requestId: number, input: UpdateServiceRequestInput) {
    return mapServiceRequestDetail(
      await apiClient.patch<unknown>(`/service-requests/admin/${requestId}`, {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.branchId !== undefined ? { branch_id: input.branchId } : {}),
        ...(input.ownerId !== undefined ? { owner_id: input.ownerId } : {}),
        ...(input.budget !== undefined ? { budget: input.budget } : {}),
        ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        ...(input.nextAction !== undefined ? { next_action: input.nextAction } : {}),
        ...(input.estimatedValue !== undefined ? { estimated_value: input.estimatedValue } : {}),
        ...(input.calculatorInputs !== undefined
          ? { calculator_inputs: input.calculatorInputs }
          : {}),
        ...(input.commercialPath !== undefined ? { commercial_path: input.commercialPath } : {}),
        ...(input.directExtraCharges !== undefined
          ? {
              direct_extra_charges: input.directExtraCharges.map((charge, index) => ({
                description: charge.description,
                quantity: charge.quantity ?? 1,
                unit_price: charge.unitPrice,
                kind: 'additional_charge',
                payment_timing: charge.paymentTiming || 'upfront',
                source_context: {},
                sort_order: (index + 1) * 10,
              })),
            }
          : {}),
        ...(input.directDiscount !== undefined ? { direct_discount: input.directDiscount } : {}),
        ...(input.directTaxRate !== undefined ? { direct_tax_rate: input.directTaxRate } : {}),
        ...(input.directThreshold !== undefined ? { direct_threshold: input.directThreshold } : {}),
        ...(input.scopeSummary !== undefined ? { scope_summary: input.scopeSummary } : {}),
      }),
    )
  },

  async estimateBoundary(
    serviceId: number,
    input: BoundarySurveyEstimateInput,
  ): Promise<CalculatorEstimateResult> {
    const payload = (await apiClient.post<unknown>(`/services/${serviceId}/calculator/estimate`, {
      area: input.area,
      unit: input.unit,
      customer_type: input.customer_type,
      boundary_registration: input.boundary_registration,
      plots: input.plots,
      single_plan: input.single_plan,
      state: input.state,
      lga: input.lga,
      country: input.country,
    })) as Record<string, unknown>
    return {
      total: Number(payload.total ?? 0),
      calculatorCode: codeOf(payload.calculator_code, 'BOUNDARY-SURVEY'),
      raw: payload,
    }
  },

  async estimateRestablishment(
    serviceId: number,
    input: RestablishmentSurveyEstimateInput,
  ): Promise<CalculatorEstimateResult> {
    const payload = (await apiClient.post<unknown>(
      `/services/${serviceId}/calculator/restablishment-survey/estimate`,
      { number_of_beacons: input.number_of_beacons },
    )) as Record<string, unknown>
    return {
      total: Number(payload.total ?? 0),
      calculatorCode: codeOf(payload.calculator_code, 'RESTABLISHMENT-SURVEY'),
      raw: payload,
    }
  },

  async estimateEngineering(
    serviceId: number,
    input: EngineeringEstimateInput,
  ): Promise<CalculatorEstimateResult> {
    const payload = (await apiClient.post<unknown>(
      `/services/${serviceId}/calculator/engineering/estimate`,
      {
        category_name: input.category_name,
        number_of_bedrooms: input.number_of_bedrooms,
        number_of_floors: input.number_of_floors,
        ...(input.area_sqm != null ? { area_sqm: input.area_sqm } : {}),
        ...(input.timeline_days != null ? { timeline_days: input.timeline_days } : {}),
      },
    )) as Record<string, unknown>
    return {
      total: Number(payload.total ?? 0),
      calculatorCode: textOf(payload.calculator_code),
      raw: payload,
    }
  },

  async engineeringCategories(includeInactive = false): Promise<EngineeringCategoryOption[]> {
    const payload = await apiClient.get<unknown>(
      includeInactive
        ? '/services/engineering-categories?include_inactive=true'
        : '/services/engineering-categories',
    )
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).items)
        ? ((payload as Record<string, unknown>).items as unknown[])
        : []
    return rows.map(mapEngineeringCategory)
  },

  async restablishmentUnitPrice(): Promise<number | null> {
    try {
      const payload = (await apiClient.get<unknown>(
        '/services/restablishment-survey-unit-price',
      )) as Record<string, unknown>
      const parsed = Number(payload.unit_price)
      return Number.isFinite(parsed) ? parsed : null
    } catch {
      return null
    }
  },

  async setRestablishmentUnitPrice(unitPrice: number): Promise<number> {
    const payload = (await apiClient.put<unknown>('/services/restablishment-survey-unit-price', {
      unit_price: unitPrice,
    })) as Record<string, unknown>
    return Number(payload.unit_price ?? unitPrice)
  },

  async createEngineeringCategory(
    input: EngineeringCategoryInput,
  ): Promise<EngineeringCategoryOption> {
    return mapEngineeringCategory(
      await apiClient.post<unknown>('/services/engineering-categories', {
        name: input.name.trim(),
        category_type: input.category_type.trim(),
        unit_price: input.unit_price,
        max_bedrooms_default: input.max_bedrooms_default,
        max_floors_default: input.max_floors_default,
        extra_bedroom_fee: input.extra_bedroom_fee,
        extra_floor_fee: input.extra_floor_fee,
        ...(input.max_area_default != null ? { max_area_default: input.max_area_default } : {}),
        ...(input.area_fee != null ? { area_fee: input.area_fee } : {}),
        ...(input.timeline_days_default != null
          ? { timeline_days_default: input.timeline_days_default }
          : {}),
        ...(input.timeline_fee != null ? { timeline_fee: input.timeline_fee } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      }),
    )
  },

  async updateEngineeringCategory(
    categoryId: number,
    input: Partial<EngineeringCategoryInput>,
  ): Promise<EngineeringCategoryOption> {
    const payload: Record<string, unknown> = {}
    if (input.name !== undefined) payload.name = input.name.trim()
    if (input.category_type !== undefined) payload.category_type = input.category_type.trim()
    if (input.unit_price !== undefined) payload.unit_price = input.unit_price
    if (input.max_bedrooms_default !== undefined)
      payload.max_bedrooms_default = input.max_bedrooms_default
    if (input.max_floors_default !== undefined)
      payload.max_floors_default = input.max_floors_default
    if (input.extra_bedroom_fee !== undefined) payload.extra_bedroom_fee = input.extra_bedroom_fee
    if (input.extra_floor_fee !== undefined) payload.extra_floor_fee = input.extra_floor_fee
    if (input.max_area_default !== undefined) payload.max_area_default = input.max_area_default
    if (input.area_fee !== undefined) payload.area_fee = input.area_fee
    if (input.timeline_days_default !== undefined)
      payload.timeline_days_default = input.timeline_days_default
    if (input.timeline_fee !== undefined) payload.timeline_fee = input.timeline_fee
    if (input.is_active !== undefined) payload.is_active = input.is_active
    return mapEngineeringCategory(
      await apiClient.put<unknown>(`/services/engineering-categories/${categoryId}`, payload),
    )
  },

  async deleteEngineeringCategory(categoryId: number): Promise<void> {
    await apiClient.delete(`/services/engineering-categories/${categoryId}`)
  },

  async addActivity(requestId: number, input: CreateServiceRequestActivityInput) {
    await apiClient.post(`/service-requests/admin/${requestId}/activities`, {
      activity_type: input.activityType,
      outcome: input.outcome,
      note: input.note,
      next_action: input.nextAction ?? '',
      next_follow_up_at: input.nextFollowUpAt ?? null,
    })
  },

  async addAttachment(requestId: number, input: CreateServiceRequestAttachmentInput) {
    await apiClient.post(`/service-requests/admin/${requestId}/attachments`, {
      field_key: input.fieldKey ?? '',
      label: input.label ?? '',
      file_name: input.fileName ?? '',
      file_url: input.fileUrl,
      content_type: input.contentType ?? '',
      file_size_bytes: input.fileSizeBytes ?? 0,
    })
  },

  async setBalancePlan(requestId: number, mode: 'full_payment' | 'installment') {
    return mapServiceRequestDetail(
      await apiClient.post<unknown>(`/service-requests/admin/${requestId}/balance-plan`, {
        mode,
      }),
    )
  },

  async createInvoiceFromRequest(
    requestId: number,
    input: { dueDate: string; paymentInstructions?: string; notes?: string },
  ): Promise<Invoice> {
    return mapInvoice(
      await apiClient.post<unknown>(`/service-requests/admin/${requestId}/invoice`, {
        due_date: input.dueDate,
        ...(input.paymentInstructions !== undefined
          ? { payment_instructions: input.paymentInstructions }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      }),
    )
  },

  async cancelReservation(requestId: number, reason = '') {
    return mapServiceRequestDetail(
      await apiClient.post<unknown>(`/service-requests/admin/${requestId}/cancel-reservation`, {
        reason,
      }),
    )
  },
}
