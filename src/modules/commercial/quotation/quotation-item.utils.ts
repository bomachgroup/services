import type { QuotationItem, QuotationPaymentTiming } from './quotation.types'

export const quotationPaymentTimingLabels: Record<QuotationPaymentTiming, string> = {
  deposit_based: 'Deposit based',
  upfront: 'Due upfront',
  deferred: 'Deferred',
}

export function buildDefaultQuoteItems(input: {
  description: string
  serviceFee: number
  otherCharges?: number | undefined
}): QuotationItem[] {
  const primaryPrice = input.serviceFee || 0
  const items: QuotationItem[] = [
    {
      description: input.description || 'Primary service',
      kind: 'primary',
      kindDisplay: 'Primary Item',
      paymentTiming: 'deposit_based',
      paymentTimingDisplay: quotationPaymentTimingLabels.deposit_based,
      quantity: 1,
      unitPrice: primaryPrice,
      total: primaryPrice,
      sourceContext: {},
      sortOrder: 0,
    },
  ]

  if ((input.otherCharges ?? 0) > 0) {
    items.push({
      description: 'Other charges',
      kind: 'additional_charge',
      kindDisplay: 'Additional Charge',
      paymentTiming: 'upfront',
      paymentTimingDisplay: quotationPaymentTimingLabels.upfront,
      quantity: 1,
      unitPrice: input.otherCharges ?? 0,
      total: input.otherCharges ?? 0,
      sourceContext: {},
      sortOrder: 10,
    })
  }

  return items
}

function normalizeQuotationItem(item: QuotationItem): QuotationItem {
  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unitPrice) || 0
  const kind = item.kind === 'primary' ? 'primary' : 'additional_charge'
  const paymentTiming: QuotationPaymentTiming =
    kind === 'primary' ? 'deposit_based' : item.paymentTiming || 'upfront'

  return {
    ...item,
    kind,
    kindDisplay: kind === 'primary' ? 'Primary Item' : 'Additional Charge',
    paymentTiming,
    paymentTimingDisplay: quotationPaymentTimingLabels[paymentTiming],
    total: Math.round(quantity * unitPrice * 100) / 100,
  }
}

export function ensureSinglePrimary(items: QuotationItem[]): QuotationItem[] {
  if (!items.length) return items
  let primaryIndex = items.findIndex((item) => item.kind === 'primary')
  if (primaryIndex < 0) primaryIndex = 0

  return items.map((item, index) =>
    normalizeQuotationItem({
      ...item,
      kind: index === primaryIndex ? 'primary' : 'additional_charge',
      paymentTiming: index === primaryIndex ? 'deposit_based' : item.paymentTiming || 'upfront',
    }),
  )
}
