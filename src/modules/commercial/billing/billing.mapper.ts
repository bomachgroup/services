import type {
  Invoice,
  InvoicePaymentDuePhase,
  FinanceAccount,
  PaginatedInvoices,
  PaginatedPayments,
  PaginatedPaymentSubmissions,
  Payment,
  PaymentSubmission,
} from './billing.types'

type JsonRecord = Record<string, unknown>

const record = (value: unknown): JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonRecord) : {}

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)

function number(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableNumber(value: unknown) {
  return value == null || value === '' ? null : number(value)
}

function nullableText(value: unknown) {
  return value == null || value === '' ? null : text(value)
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function paginatedRows(payload: unknown) {
  if (Array.isArray(payload)) return { count: payload.length, rows: payload }
  const root = record(payload)
  const rows = Array.isArray(root.items)
    ? root.items
    : Array.isArray(root.results)
      ? root.results
      : Array.isArray(root.data)
        ? root.data
        : []
  return { count: number(root.count, rows.length), rows }
}

export function mapInvoice(payload: unknown): Invoice {
  const value = record(payload)
  const service = record(value.service)
  const order = record(value.order)

  return {
    id: number(value.id),
    invoiceNumber: text(value.invoice_number),
    clientId: number(value.client_id),
    clientName: text(value.client_name),
    quoteId: nullableNumber(value.quote_id),
    quoteNumber: text(value.quote_number),
    serviceRequestId: nullableNumber(value.service_request_id),
    serviceRequestNumber: text(value.service_request_number),
    serviceId: number(service.id),
    serviceName: text(service.name),
    orderId: nullableNumber(order.id),
    orderNumber: text(order.order_number),
    issueDate: text(value.issue_date),
    dueDate: text(value.due_date),
    subtotal: number(value.subtotal),
    taxRate: number(value.tax_rate),
    taxAmount: number(value.tax_amount),
    totalAmount: number(value.total_amount),
    amountPaid: number(value.amount_paid),
    balance: number(value.balance),
    paymentProgress: number(value.payment_progress),
    status: text(value.status, 'draft') as Invoice['status'],
    statusDisplay: text(value.status_display),
    realEstateSettlementMode: text(value.real_estate_settlement_mode),
    paymentSchedule: text(value.payment_schedule),
    paymentInstructions: text(value.payment_instructions),
    activationThresholdAmount: number(value.activation_threshold_amount),
    activationThresholdMetAt: nullableText(value.activation_threshold_met_at),
    paymentDue: (() => {
      const due = record(value.payment_due)
      return {
        amountDueNow: number(due.amount_due_now, number(value.balance)),
        label: text(due.label),
        dueDate: nullableText(due.due_date),
        phase: text(due.phase, 'balance') as InvoicePaymentDuePhase,
        scheduleLines: array(due.schedule_lines).map((item) => {
          const row = record(item)
          return {
            sequence: number(row.sequence),
            label: text(row.label),
            dueDate: nullableText(row.due_date),
            amount: number(row.amount),
            status: text(row.status, 'pending'),
            amountRemaining:
              row.amount_remaining == null || row.amount_remaining === ''
                ? null
                : number(row.amount_remaining),
          }
        }),
      }
    })(),
    notes: text(value.notes),
    items: array(value.items).map((item) => {
      const row = record(item)
      return {
        id: number(row.id),
        sourceQuoteItemId: nullableNumber(row.source_quote_item_id),
        description: text(row.description),
        kind: text(row.kind),
        kindDisplay: text(row.kind_display, text(row.kind)),
        paymentTiming: text(row.payment_timing),
        paymentTimingDisplay: text(row.payment_timing_display, text(row.payment_timing)),
        quantity: number(row.quantity),
        unitPrice: number(row.unit_price),
        total: number(row.total),
        sortOrder: number(row.sort_order),
        sourceContext: record(row.source_context),
      }
    }),
    attachments: array(value.attachments).map((item) => {
      const row = record(item)
      return {
        id: number(row.id),
        label: text(row.label) || text(row.file_name) || 'Document',
        fileName: text(row.file_name) || text(row.label) || 'Document',
        fileUrl: text(row.file_url),
        contentType: text(row.content_type),
        fileSizeBytes: number(row.file_size_bytes),
        sortOrder: number(row.sort_order),
        createdAt: text(row.created_at),
        updatedAt: text(row.updated_at),
      }
    }),
    createdAt: text(value.created_at),
    updatedAt: text(value.updated_at),
    createdById: number(value.created_by_id),
  }
}

export function mapInvoiceList(payload: unknown): PaginatedInvoices {
  const { count, rows } = paginatedRows(payload)
  return { count, items: rows.map(mapInvoice) }
}

export function mapPayment(payload: unknown): Payment {
  const value = record(payload)
  return {
    id: number(value.id),
    paymentReference: text(value.payment_reference),
    invoiceId: number(value.invoice_id),
    amount: number(value.amount),
    paymentMethod: text(value.payment_method, 'other') as Payment['paymentMethod'],
    paymentDate: text(value.payment_date),
    transactionReference: text(value.transaction_reference),
    financeAccountId: nullableNumber(value.finance_account_id),
    financeAccountName: text(value.finance_account_name),
    proofOfPayment: text(value.proof_of_payment),
    notes: text(value.notes),
    createdAt: text(value.created_at),
    updatedAt: text(value.updated_at),
    createdById: number(value.created_by_id),
    createdByName: text(value.created_by_name ?? value.recorded_by_name),
  }
}

export function mapPaymentList(payload: unknown): PaginatedPayments {
  const { count, rows } = paginatedRows(payload)
  return { count, items: rows.map(mapPayment) }
}

export function mapPaymentSubmission(payload: unknown): PaymentSubmission {
  const value = record(payload)
  const rawStatus = text(value.status, 'pending')
  const normalizedStatus =
    rawStatus === 'Pending Review'
      ? 'pending'
      : rawStatus === 'Confirmed'
        ? 'confirmed'
        : rawStatus === 'Rejected'
          ? 'rejected'
          : rawStatus

  return {
    id: number(value.id),
    reference: text(value.reference),
    invoiceNumber: text(value.invoice_number),
    invoiceId: number(value.invoice_id ?? value.invoice),
    clientName: text(value.client_name),
    amount: number(value.amount),
    paymentMethod: text(value.payment_method, 'other') as PaymentSubmission['paymentMethod'],
    paymentDate: text(value.payment_date),
    proofOfPayment: text(value.proof_of_payment),
    financeAccountId: nullableNumber(value.finance_account_id),
    financeAccountName: text(value.finance_account_name) || text(value.receiving_account_text),
    transactionReference: text(value.transaction_reference),
    submittedByType: text(value.submitted_by_type),
    status: normalizedStatus as PaymentSubmission['status'],
    statusDisplay: rawStatus,
    rejectionReason: text(value.rejection_reason),
    createdAt: text(value.created_at),
  }
}

export function mapPaymentSubmissionList(payload: unknown): PaginatedPaymentSubmissions {
  const { count, rows } = paginatedRows(payload)
  return { count, items: rows.map(mapPaymentSubmission) }
}

export function mapFinanceAccount(payload: unknown): FinanceAccount {
  const value = record(payload)
  return {
    id: number(value.id),
    displayName: text(value.display_name),
    accountType: text(value.account_type),
    accountTypeDisplay: text(value.account_type_display),
    branchName: text(value.branch_name),
    bankName: text(value.bank_name),
    accountNumber: text(value.account_number),
    accountName: text(value.account_name),
  }
}

export function mapFinanceAccountList(payload: unknown): FinanceAccount[] {
  return paginatedRows(payload).rows.map(mapFinanceAccount)
}
