import type { RealEstateCommercialContext } from '@/modules/specialized-services/real-estate/real-estate.types'

export type RealEstateQuoteDeposit = {
  percent: number
  title: string
  detail: string
}

/** Map estate settlement mode + policy into the quotation deposit percent. */
export function deriveRealEstateQuoteDeposit(
  context: RealEstateCommercialContext | undefined,
): RealEstateQuoteDeposit | null {
  if (!context?.assets.length) return null

  const mode = context.assets[0]?.settlementMode || 'full_payment'
  const policy = context.paymentPolicy
  const summary = context.paymentTermsSummary.filter(Boolean).join(' · ')

  if (mode === 'reservation') {
    const percent = Math.max(0, Math.min(100, policy.reservationPercent ?? 0))
    return {
      percent,
      title: 'Reservation deposit',
      detail: summary || 'From estate reservation policy',
    }
  }

  if (mode === 'installment') {
    const percent = Math.max(0, Math.min(100, policy.installmentDownPaymentPercent ?? 0))
    return {
      percent,
      title: 'Installment down payment',
      detail: summary || 'From estate installment policy',
    }
  }

  return {
    percent: 100,
    title: 'Full payment',
    detail: summary || '',
  }
}
