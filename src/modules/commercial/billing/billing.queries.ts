import { queryOptions } from '@tanstack/react-query'

import { billingApi } from './billing.api'
import { billingKeys } from './billing.keys'
import type { InvoiceFilters, PaymentSubmissionStatus } from './billing.types'

export const billingQueries = {
  list: (filters: InvoiceFilters) =>
    queryOptions({
      queryKey: billingKeys.invoiceList(filters),
      queryFn: () => billingApi.list(filters),
      placeholderData: (previousData) => previousData,
      staleTime: 20_000,
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: billingKeys.invoiceDetail(id),
      queryFn: () => billingApi.detail(id),
      staleTime: 15_000,
    }),
  summary: () =>
    queryOptions({
      queryKey: billingKeys.summary(),
      queryFn: () => billingApi.summary(),
      staleTime: 20_000,
    }),
  allInvoices: () =>
    queryOptions({
      queryKey: billingKeys.allInvoices(),
      queryFn: () => billingApi.allInvoices(),
      staleTime: 20_000,
    }),
  eligibleQuotes: () =>
    queryOptions({
      queryKey: billingKeys.eligibleQuotes(),
      queryFn: () => billingApi.eligibleAcceptedQuotes(),
      staleTime: 20_000,
    }),
  financeAccounts: () =>
    queryOptions({
      queryKey: billingKeys.financeAccounts(),
      queryFn: () => billingApi.financeAccounts(),
      staleTime: 60_000,
    }),
  payments: (invoiceId: number) =>
    queryOptions({
      queryKey: billingKeys.payments(invoiceId),
      queryFn: () => billingApi.payments(invoiceId),
      staleTime: 15_000,
    }),
  submissions: (status: PaymentSubmissionStatus | '', invoiceId?: number) =>
    queryOptions({
      queryKey: billingKeys.submissions(status, invoiceId),
      queryFn: () => billingApi.paymentSubmissions(status, invoiceId),
      staleTime: 15_000,
    }),
  allPaymentSubmissions: () =>
    queryOptions({
      queryKey: billingKeys.allPaymentSubmissions(),
      queryFn: () => billingApi.paymentSubmissions('', undefined),
      staleTime: 15_000,
    }),
  invoiceForQuote: (quoteId: number) =>
    queryOptions({
      queryKey: billingKeys.invoiceForQuote(quoteId),
      queryFn: () => billingApi.invoiceForQuote(quoteId),
      staleTime: 15_000,
    }),
}
