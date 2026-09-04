import { apiClient } from '@/shared/api/api-client'

import { quotationsApi } from '../quotation/quotation.api'
import type { Quotation } from '../quotation/quotation.types'
import {
  mapFinanceAccountList,
  mapInvoice,
  mapInvoiceList,
  mapPayment,
  mapPaymentList,
  mapPaymentSubmission,
  mapPaymentSubmissionList,
} from './billing.mapper'
import type {
  CreateInvoiceFromQuoteInput,
  CreatePaymentSubmissionInput,
  FinanceAccount,
  Invoice,
  InvoiceFilters,
  InvoiceSummary,
  PaginatedInvoices,
  PaginatedPayments,
  PaginatedPaymentSubmissions,
  PaymentSubmission,
  PaymentSubmissionStatus,
  RecordPaymentInput,
  ReviewPaymentSubmissionInput,
  UpdateInvoiceInput,
} from './billing.types'

function invoiceQuery(filters: InvoiceFilters = {}) {
  const query = new URLSearchParams()
  const limit = filters.limit ?? 10
  const page = filters.page ?? 1

  query.set('limit', String(limit))
  query.set('offset', String((page - 1) * limit))
  if (filters.search) query.set('search', filters.search)
  if (filters.status) query.set('status', filters.status)
  if (filters.quoteId) query.set('quote_id', String(filters.quoteId))
  if (filters.serviceRequestId) {
    query.set('service_request_id', String(filters.serviceRequestId))
  }
  if (filters.clientId) query.set('client_id', String(filters.clientId))
  return query.toString()
}

async function listAllInvoices(): Promise<Invoice[]> {
  const pageSize = 100
  const first = mapInvoiceList(
    await apiClient.get<unknown>(`/invoices?${invoiceQuery({ page: 1, limit: pageSize })}`),
  )
  const all = [...first.items]
  const totalPages = Math.ceil(first.count / pageSize)

  for (let page = 2; page <= totalPages; page += 1) {
    const next = mapInvoiceList(
      await apiClient.get<unknown>(`/invoices?${invoiceQuery({ page, limit: pageSize })}`),
    )
    all.push(...next.items)
  }

  return all
}

async function listAllAcceptedQuotes(): Promise<Quotation[]> {
  const pageSize = 100
  const first = await quotationsApi.list({
    status: 'accepted',
    page: 1,
    limit: pageSize,
  })
  const all = [...first.items]
  const totalPages = Math.ceil(first.count / pageSize)

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await quotationsApi.list({
      status: 'accepted',
      page,
      limit: pageSize,
    })
    all.push(...next.items)
  }

  return all
}

export const billingApi = {
  async list(filters: InvoiceFilters = {}): Promise<PaginatedInvoices> {
    return mapInvoiceList(await apiClient.get<unknown>(`/invoices?${invoiceQuery(filters)}`))
  },

  async detail(invoiceId: number): Promise<Invoice> {
    return mapInvoice(await apiClient.get<unknown>(`/invoices/${invoiceId}`))
  },

  async summary(): Promise<InvoiceSummary> {
    const invoices = await listAllInvoices()
    return {
      totalInvoiced: invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      paid: invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      outstanding: invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.balance), 0),
      overdue: invoices.filter((invoice) => invoice.status === 'overdue').length,
      count: invoices.length,
    }
  },

  async allInvoices(): Promise<Invoice[]> {
    return listAllInvoices()
  },

  async eligibleAcceptedQuotes(): Promise<Quotation[]> {
    const [quotes, invoices] = await Promise.all([listAllAcceptedQuotes(), listAllInvoices()])
    const activeInvoiceQuoteIds = new Set(
      invoices
        .filter((invoice) => invoice.status !== 'cancelled' && invoice.quoteId)
        .map((invoice) => invoice.quoteId),
    )
    return quotes.filter((quote) => !activeInvoiceQuoteIds.has(quote.id))
  },

  async invoiceForQuote(quoteId: number): Promise<Invoice | null> {
    const result = await billingApi.list({ quoteId, page: 1, limit: 1 })
    const invoice = result.items.find(
      (item) => item.quoteId === quoteId && item.status !== 'cancelled',
    )
    return invoice ?? null
  },

  async createFromQuote(input: CreateInvoiceFromQuoteInput): Promise<Invoice> {
    return mapInvoice(
      await apiClient.post<unknown>(`/quotes/${input.quoteId}/invoice`, {
        due_date: input.dueDate,
        payment_schedule: input.paymentSchedule,
        payment_instructions: input.paymentInstructions,
        notes: input.notes,
      }),
    )
  },

  async update(invoiceId: number, input: UpdateInvoiceInput): Promise<Invoice> {
    return mapInvoice(
      await apiClient.patch<unknown>(`/invoices/${invoiceId}`, {
        due_date: input.dueDate,
        payment_schedule: input.paymentSchedule,
        payment_instructions: input.paymentInstructions,
        notes: input.notes,
      }),
    )
  },

  async send(invoiceId: number, paymentInstructions?: string): Promise<Invoice> {
    return mapInvoice(
      await apiClient.post<unknown>(`/invoices/${invoiceId}/send`, {
        ...(paymentInstructions !== undefined ? { payment_instructions: paymentInstructions } : {}),
      }),
    )
  },

  async cancel(invoiceId: number): Promise<Invoice> {
    return mapInvoice(await apiClient.post<unknown>(`/invoices/${invoiceId}/cancel`, {}))
  },

  async payments(invoiceId: number): Promise<PaginatedPayments> {
    return mapPaymentList(
      await apiClient.get<unknown>(`/payments?invoice_id=${invoiceId}&limit=100&offset=0`),
    )
  },

  async recordPayment(input: RecordPaymentInput) {
    // Best-effort fresh-balance check. Backend must still own concurrency safety.
    const invoice = await billingApi.detail(input.invoiceId)
    if (input.amount > invoice.balance) {
      throw new Error('Payment exceeds the current outstanding balance.')
    }

    return mapPayment(
      await apiClient.post<unknown>('/payments', {
        invoice_id: input.invoiceId,
        amount: input.amount,
        payment_method: input.paymentMethod,
        payment_date: input.paymentDate,
        transaction_reference: input.transactionReference,
        notes: input.notes,
        created_by_id: input.createdById,
      }),
    )
  },

  async financeAccounts(): Promise<FinanceAccount[]> {
    return mapFinanceAccountList(
      await apiClient.get<unknown>('/finance/accounts?is_active=true&limit=100&offset=0'),
    )
  },

  async createPaymentSubmission(input: CreatePaymentSubmissionInput): Promise<PaymentSubmission> {
    return mapPaymentSubmission(
      await apiClient.post<unknown>('/finance/payments/submissions', {
        invoice_id: input.invoiceId,
        finance_account_id: input.financeAccountId,
        amount: input.amount,
        payment_method: input.paymentMethod,
        payment_date: input.paymentDate,
        transaction_reference: input.transactionReference,
        proof_of_payment: input.proofOfPayment,
        notes: input.notes,
      }),
    )
  },

  async paymentSubmissions(
    status: PaymentSubmissionStatus | '' = 'pending',
    invoiceId?: number,
  ): Promise<PaginatedPaymentSubmissions> {
    const query = new URLSearchParams()
    query.set('limit', '100')
    query.set('offset', '0')
    if (status) query.set('status', status)
    if (invoiceId) query.set('invoice_id', String(invoiceId))
    return mapPaymentSubmissionList(
      await apiClient.get<unknown>(`/invoices/payment-submissions?${query.toString()}`),
    )
  },

  async reviewPaymentSubmission(submissionId: number, input: ReviewPaymentSubmissionInput) {
    return mapPaymentSubmission(
      await apiClient.post<unknown>(`/invoices/payment-submissions/${submissionId}/review`, {
        status: input.status,
        ...(input.financeAccountId ? { finance_account_id: input.financeAccountId } : {}),
        rejection_reason: input.rejectionReason ?? '',
      }),
    )
  },
}
