import type { Invoice } from './billing.types'

export function getInvoiceCapabilities(
  invoice: Invoice,
  options?: { allowsServiceOrder?: boolean },
) {
  const hasPayment = invoice.amountPaid > 0
  const thresholdMet = Boolean(invoice.activationThresholdMetAt)
  const allowsServiceOrder = options?.allowsServiceOrder !== false

  return {
    edit: invoice.status === 'draft',
    send: invoice.status === 'draft' || invoice.status === 'sent',
    cancel: invoice.status !== 'cancelled' && !hasPayment,
    settleNoCharge:
      invoice.totalAmount <= 0 &&
      invoice.amountPaid <= 0 &&
      (invoice.status === 'sent' || invoice.status === 'viewed') &&
      !invoice.orderId,
    recordPayment: invoice.balance > 0 && !['draft', 'cancelled'].includes(invoice.status),
    readyForServiceOrder: thresholdMet && !invoice.orderId && allowsServiceOrder,
    hasServiceOrder: Boolean(invoice.orderId),
  }
}
