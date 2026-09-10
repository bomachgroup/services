export type InvoiceStatus =
  'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'

export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'mobile_money' | 'other'

export type PaymentSubmissionStatus = 'pending' | 'confirmed' | 'rejected'

export interface InvoiceItem {
  id: number
  sourceQuoteItemId: number | null
  description: string
  kind: string
  kindDisplay: string
  paymentTiming: string
  paymentTimingDisplay: string
  quantity: number
  unitPrice: number
  total: number
  sortOrder: number
  sourceContext: Record<string, unknown>
}

export interface InvoiceAttachment {
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

export interface InvoiceScheduleLine {
  sequence: number
  label: string
  dueDate: string | null
  amount: number
  status: string
  amountRemaining: number | null
}

export type InvoicePaymentDuePhase = 'activation' | 'installment' | 'balance' | 'paid'

export interface InvoicePaymentDue {
  amountDueNow: number
  label: string
  dueDate: string | null
  phase: InvoicePaymentDuePhase
  scheduleLines: InvoiceScheduleLine[]
}

export interface Invoice {
  id: number
  invoiceNumber: string
  clientId: number
  clientName: string
  quoteId: number | null
  quoteNumber: string
  serviceRequestId: number | null
  serviceRequestNumber: string
  serviceId: number
  serviceName: string
  orderId: number | null
  orderNumber: string
  issueDate: string
  dueDate: string
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  amountPaid: number
  balance: number
  paymentProgress: number
  status: InvoiceStatus
  statusDisplay: string
  realEstateSettlementMode: string
  paymentSchedule: string
  paymentInstructions: string
  activationThresholdAmount: number
  activationThresholdMetAt: string | null
  paymentDue: InvoicePaymentDue
  notes: string
  items: InvoiceItem[]
  attachments: InvoiceAttachment[]
  createdAt: string
  updatedAt: string
  createdById: number
}

export interface PaginatedInvoices {
  count: number
  items: Invoice[]
}

export interface InvoiceFilters {
  search?: string
  status?: string
  quoteId?: number
  serviceRequestId?: number
  clientId?: number
  page?: number
  limit?: number
}

export interface InvoiceSummary {
  totalInvoiced: number
  paid: number
  outstanding: number
  overdue: number
  count: number
}

export interface Payment {
  id: number
  paymentReference: string
  invoiceId: number
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  transactionReference: string
  financeAccountId: number | null
  financeAccountName: string
  proofOfPayment: string
  notes: string
  createdAt: string
  updatedAt: string
  createdById: number
  createdByName: string
}

export interface PaginatedPayments {
  count: number
  items: Payment[]
}

export interface PaymentSubmission {
  id: number
  reference: string
  invoiceNumber: string
  invoiceId: number
  clientName: string
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  proofOfPayment: string
  financeAccountId: number | null
  financeAccountName: string
  transactionReference: string
  submittedByType: string
  status: PaymentSubmissionStatus
  statusDisplay: string
  rejectionReason: string
  createdAt: string
}

export interface FinanceAccount {
  id: number
  displayName: string
  accountType: string
  accountTypeDisplay: string
  branchName: string
  bankName: string
  accountNumber: string
  accountName: string
}

export interface PaginatedPaymentSubmissions {
  count: number
  items: PaymentSubmission[]
}

export interface CreateInvoiceFromQuoteInput {
  quoteId: number
  dueDate: string
  paymentSchedule: string
  paymentInstructions: string
  notes: string
}

export interface UpdateInvoiceInput {
  dueDate: string
  paymentSchedule: string
  paymentInstructions: string
  notes: string
  attachments?: InvoiceAttachment[]
}

export interface RecordPaymentInput {
  invoiceId: number
  financeAccountId: number
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  transactionReference: string
  notes: string
  proofOfPayment?: string
  createdById: number
}

export interface CreatePaymentSubmissionInput {
  invoiceId: number
  financeAccountId: number
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  transactionReference: string
  proofOfPayment: string
  notes: string
}

export interface ReviewPaymentSubmissionInput {
  status: 'confirmed' | 'rejected'
  financeAccountId?: number
  rejectionReason?: string
}

export const paymentMethodOptions: Array<{
  value: PaymentMethod
  label: string
}> = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'other', label: 'Other' },
]
