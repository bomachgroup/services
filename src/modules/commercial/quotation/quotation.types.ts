export type QuotationStatus =
  'draft' | 'awaiting_approval' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'superseded'

export type QuotationItemKind = 'primary' | 'additional_charge'
export type QuotationPaymentTiming = 'deposit_based' | 'upfront' | 'deferred'

export interface QuotationItem {
  id?: number
  description: string
  kind: QuotationItemKind
  kindDisplay: string
  paymentTiming: QuotationPaymentTiming
  paymentTimingDisplay: string
  quantity: number
  unitPrice: number
  total: number
  sourceContext: Record<string, unknown>
  sortOrder: number
}

export interface CommercialAttachment {
  id?: number
  label: string
  fileName: string
  fileUrl: string
  contentType: string
  fileSizeBytes: number
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface Quotation {
  id: number
  quoteNumber: string
  clientId: number
  clientName: string
  serviceId: number
  serviceName: string
  serviceRequestId: number | null
  serviceRequestNumber: string
  previousQuoteId: number | null
  previousQuoteNumber: string
  version: number
  requiredApproverRoleId: number | null
  requiredApproverRoleName: string
  description: string
  scopeSummary: string
  terms: string
  serviceFee: number
  otherCharges: number
  discount: number
  subtotal: number
  taxRate: number
  taxAmount: number
  depositPercent: number
  depositAmount: number
  initialPaymentAmount: number
  amount: number
  validUntil: string
  status: QuotationStatus
  statusDisplay: string
  realEstateSettlementMode: string
  approvedById: number | null
  approvedByName: string
  approvedAt: string | null
  sentAt: string | null
  clientRespondedAt: string | null
  clientRejectionReason: string
  createdById: number | null
  createdByName: string
  createdAt: string
  updatedAt: string
  items: QuotationItem[]
  attachments: CommercialAttachment[]
}

export interface PaginatedQuotations {
  count: number
  items: Quotation[]
}

export interface QuotationFilters {
  search?: string
  status?: string
  page?: number
  limit?: number
}

export interface QuotationSummary {
  total: number
  awaitingApproval: number
  sent: number
  accepted: number
  rejectedOrExpired: number
  acceptanceRate: number
}

export interface RoleOption {
  id: number
  name: string
}

export interface CreateQuotationInput {
  clientId: number
  serviceId: number
  serviceRequestId: number
  description: string
  scopeSummary: string
  terms: string
  serviceFee: number
  otherCharges: number
  items?: QuotationItem[]
  attachments?: CommercialAttachment[]
  discount: number
  taxRate: number
  depositPercent: number
  validUntil: string
  requiredApproverRoleId: number
  previousQuoteId?: number
}

export type UpdateQuotationInput = Omit<
  CreateQuotationInput,
  'clientId' | 'serviceId' | 'serviceRequestId' | 'previousQuoteId'
>

export type ClientQuotationDecision =
  { decision: 'accepted' } | { decision: 'rejected'; reason: string }
