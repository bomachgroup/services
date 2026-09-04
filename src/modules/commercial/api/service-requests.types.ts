export type ServiceRequestStatus =
  | 'new'
  | 'under_review'
  | 'awaiting_client'
  | 'site_assessment'
  | 'quoted'
  | 'converted'
  | 'rejected'

export type ServiceRequestPriority = 'normal' | 'high' | 'critical'

export interface ServiceRequestChoice {
  value: string
  label: string
}

export interface ServiceRequestChoices {
  statuses: ServiceRequestChoice[]
  priorities: ServiceRequestChoice[]
  sources: ServiceRequestChoice[]
  customerTypes: ServiceRequestChoice[]
  activityTypes: ServiceRequestChoice[]
  activityOutcomes: ServiceRequestChoice[]
}

export interface ServiceRequestListItem {
  id: number
  requestNumber: string
  clientId: number
  clientName: string
  serviceId: number
  serviceName: string
  branchId: number | null
  branchName: string
  quoteId: number | null
  quoteNumber: string
  contactName: string
  contactPhone: string
  contactEmail: string
  customerType: string
  source: string
  sourceReference: string
  status: ServiceRequestStatus
  statusDisplay: string
  priority: ServiceRequestPriority
  budget: number | null
  estimatedValue: number
  preferredDate: string | null
  dueDate: string | null
  nextAction: string
  scopeSummary: string
  ownerId: number | null
  ownerName: string
  createdAt: string
  updatedAt: string
}

export interface ServiceRequestAnswer {
  id: number
  fieldKey: string
  label: string
  fieldType: string
  value: unknown
  sortOrder: number
}

export interface ServiceRequestAttachment {
  id: number
  fieldKey: string
  label: string
  fileName: string
  fileUrl: string
  contentType: string
  fileSizeBytes: number
  uploadedById: number | null
  createdAt: string
}

export interface ServiceRequestActivity {
  id: number
  activityType: string
  activityTypeDisplay: string
  outcome: string
  outcomeDisplay: string
  note: string
  nextAction: string
  nextFollowUpAt: string | null
  createdById: number | null
  createdByName: string
  createdAt: string
}

export interface ServiceRequestDetail extends ServiceRequestListItem {
  serviceLeadId: number | null
  crmLeadId: number | null
  requestFormId: number
  requestFormVersion: number
  pricingConfigId: number | null
  pricingConfigVersion: number | null
  workflowId: number | null
  workflowVersion: number | null
  answersSnapshot: Record<string, unknown>
  formSnapshot: Record<string, unknown>
  answers: ServiceRequestAnswer[]
  attachments: ServiceRequestAttachment[]
  activities: ServiceRequestActivity[]
}

export interface PaginatedResult<T> {
  count: number
  items: T[]
}

export interface ServiceRequestFilters {
  search?: string
  status?: string
  priority?: string
  branchId?: number
  serviceId?: number
  page?: number
  limit?: number
}

export interface ServiceRequestSummary {
  total: number
  newCount: number
  underReview: number
  awaitingClient: number
  siteAssessment: number
  highPriority: number
}

export interface CreateClientInput {
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
}

export interface ClientOption {
  id: number
  name: string
  email: string
  phone: string
  companyName: string
  active: boolean
}

export interface BranchOption {
  id: number
  name: string
}

export interface ServiceOption {
  id: number
  code: string
  name: string
  parentName: string
  specializedServiceId?: number | null
  specializedDomain?: string | null
  activeBranches: BranchOption[]
}

export interface ServicePricingFieldOption {
  value: string
  label: string
}

export interface ServicePricingField {
  id: number
  key: string
  label: string
  fieldType: string
  defaultValue: unknown
  required: boolean
  options: ServicePricingFieldOption[]
  validation: Record<string, unknown>
  sortOrder: number
}

export interface ServicePricingConfig {
  id: number
  serviceId: number
  serviceName: string
  name: string
  version: number
  pricingType: string
  formula: string
  taxRate: number
  depositPercent: number
  discountApprovalThresholdPercent: number
  status: string
  active: boolean
  fieldCount: number
  fields: ServicePricingField[]
}

export interface EmployeeOption {
  id: number
  name: string
  roleName: string
  branchName: string
}

export interface IntakeFieldOption {
  value: string
  label: string
}

export interface IntakeField {
  id: number
  key: string
  label: string
  fieldType: string
  required: boolean
  options: IntakeFieldOption[]
  validation: Record<string, unknown>
  helpText: string
  placeholder: string
  sortOrder: number
}

export interface ServiceIntakeForm {
  service: {
    id: number
    code: string
    name: string
    parentName: string
    specializedDomain: string | null
    defaultSlaDays: number
    fulfillmentMode: string
  }
  form: {
    id: number
    name: string
    version: number
    status: string
    active: boolean
    fields: IntakeField[]
  }
}

export interface CreateServiceRequestInput {
  clientId: number
  serviceId: number
  branchId?: number
  contactName: string
  contactPhone: string
  contactEmail: string
  customerType: string
  source: string
  sourceReference: string
  priority: ServiceRequestPriority
  budget?: number
  estimatedValue: number
  preferredDate?: string
  dueDate?: string
  nextAction: string
  scopeSummary: string
  answers: Record<string, unknown>
  crmLeadId?: number
}

export interface UpdateServiceRequestInput {
  status?: ServiceRequestStatus
  priority?: ServiceRequestPriority
  branchId?: number | null
  ownerId?: number | null
  budget?: number | null
  dueDate?: string | null
  nextAction?: string
  estimatedValue?: number
  scopeSummary?: string
}

export interface CreateServiceRequestActivityInput {
  activityType: string
  outcome: string
  note: string
  nextAction?: string
  nextFollowUpAt?: string | null
}

export interface CreateServiceRequestAttachmentInput {
  fieldKey?: string
  label?: string
  fileName?: string
  fileUrl: string
  contentType?: string
  fileSizeBytes?: number
}
