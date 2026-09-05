import type { QuotationStatus } from './quotation.types'

export function getQuotationCapabilities(
  status: QuotationStatus,
  options?: { hasActiveInvoice?: boolean },
) {
  const hasActiveInvoice = options?.hasActiveInvoice ?? false

  return {
    edit: status === 'draft' || status === 'awaiting_approval',
    approve: status === 'awaiting_approval',
    clientRespond: status === 'sent',
    createInvoice: status === 'accepted' && !hasActiveInvoice,
    viewInvoice: status === 'accepted' && hasActiveInvoice,
    revise: status === 'rejected' || status === 'expired',
  }
}
