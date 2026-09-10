import type { QuotationItem } from './quotation.types'

export interface QuotationPricingInput {
  serviceFee: number
  otherCharges: number
  items?: QuotationItem[]
  discount: number
  taxRate: number
  depositPercent: number
}

const money = (value: number) => Math.round(value * 100) / 100

export function calculateQuotationPreview(input: QuotationPricingInput) {
  const items =
    input.items && input.items.length > 0
      ? input.items
      : [
          {
            description: 'Service fee',
            kind: 'primary',
            kindDisplay: 'Primary Item',
            paymentTiming: 'deposit_based',
            paymentTimingDisplay: 'Deposit Based',
            quantity: 1,
            unitPrice: input.serviceFee,
            total: input.serviceFee,
            sourceContext: {},
            sortOrder: 0,
          } satisfies QuotationItem,
          {
            description: 'Other charges',
            kind: 'additional_charge',
            kindDisplay: 'Additional Charge',
            paymentTiming: 'upfront',
            paymentTimingDisplay: 'Upfront',
            quantity: 1,
            unitPrice: input.otherCharges,
            total: input.otherCharges,
            sourceContext: {},
            sortOrder: 10,
          } satisfies QuotationItem,
        ]

  const grouped = {
    deposit_based: 0,
    upfront: 0,
    deferred: 0,
  }
  for (const item of items) {
    const total = Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0)
    grouped[item.paymentTiming] += total
  }
  const subtotal = money(grouped.deposit_based + grouped.upfront + grouped.deferred)
  const discount = Math.max(0, input.discount)
  const taxable = Math.max(subtotal - discount, 0)
  const taxAmount = money(taxable * (Math.max(0, input.taxRate) / 100))
  const amount = money(taxable + taxAmount)

  const effective = {
    deposit_based: 0,
    upfront: 0,
    deferred: 0,
  }
  if (subtotal > 0) {
    const discountFactor = (subtotal - discount) / subtotal
    const taxFactor = 1 + Math.max(0, input.taxRate) / 100
    effective.deposit_based = money(grouped.deposit_based * discountFactor * taxFactor)
    effective.upfront = money(grouped.upfront * discountFactor * taxFactor)
    effective.deferred = money(grouped.deferred * discountFactor * taxFactor)
    const diff = money(
      amount - money(effective.deposit_based + effective.upfront + effective.deferred),
    )
    if (diff) {
      if (grouped.deferred > 0) effective.deferred = money(effective.deferred + diff)
      else if (grouped.upfront > 0) effective.upfront = money(effective.upfront + diff)
      else effective.deposit_based = money(effective.deposit_based + diff)
    }
  }

  const depositAmount = money(effective.deposit_based * (Math.max(0, input.depositPercent) / 100))
  const initialPaymentAmount = Math.min(amount, money(depositAmount + effective.upfront))
  return { subtotal, taxable, taxAmount, amount, depositAmount, initialPaymentAmount }
}

export function validateQuotationPricing(input: QuotationPricingInput) {
  const errors: Partial<Record<keyof QuotationPricingInput, string>> = {}
  const subtotal = Number(input.serviceFee) + Number(input.otherCharges)
  if (!Number.isFinite(input.serviceFee) || input.serviceFee <= 0)
    errors.serviceFee = 'Service fee must be greater than zero.'
  if (input.items && input.items.filter((item) => item.kind === 'primary').length < 1)
    errors.serviceFee = 'Add at least one primary quote item.'
  if (input.items?.some((item) => item.quantity <= 0 || item.unitPrice < 0))
    errors.serviceFee = 'Quote item quantity and price must be valid.'
  if (!Number.isFinite(input.otherCharges) || input.otherCharges < 0)
    errors.otherCharges = 'Other charges cannot be negative.'
  if (!Number.isFinite(input.discount) || input.discount < 0)
    errors.discount = 'Discount cannot be negative.'
  else if (input.discount > subtotal) errors.discount = 'Discount cannot exceed subtotal.'
  if (!Number.isFinite(input.taxRate) || input.taxRate < 0 || input.taxRate > 100)
    errors.taxRate = 'Tax must be between 0 and 100.'
  if (
    !Number.isFinite(input.depositPercent) ||
    input.depositPercent < 0 ||
    input.depositPercent > 100
  )
    errors.depositPercent = 'Deposit must be between 0 and 100.'
  return errors
}
