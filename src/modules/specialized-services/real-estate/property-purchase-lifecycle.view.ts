import { formatCurrency } from '@/shared/lib/formatters'

import type { PropertyPurchase, PurchaseMode } from './real-estate.types'

export interface PurchaseLifecycleDeadline {
  key: string
  label: string
  value: string
  note?: string
}

export interface PurchaseLifecycleProgress {
  title: string
  subtitle: string
  percent: number
}

export interface PurchaseLifecycleViewModel {
  modeLabel: string
  sectionSubtitle: string
  progress: PurchaseLifecycleProgress
  deadlines: PurchaseLifecycleDeadline[]
  createPaymentLabel: string
  expireLabel: string
  defaultLabel: string
  outstandingLabel: string
}

export function purchaseModeLabel(mode: PurchaseMode) {
  switch (mode) {
    case 'full_payment':
      return 'Full payment'
    case 'reservation':
      return 'Reservation'
    case 'installment':
      return 'Installment plan'
  }
}

function outstandingAmount(purchase: PropertyPurchase) {
  return Math.max(0, purchase.agreedPrice - purchase.amountPaid)
}

function depositDue(purchase: PropertyPurchase) {
  if (purchase.reservationAmount == null) return outstandingAmount(purchase)
  return Math.max(0, purchase.reservationAmount - purchase.amountPaid)
}

function paymentProgress(amountPaid: number, target: number) {
  if (target <= 0) return 0
  return Math.min(100, Math.round((amountPaid / target) * 100))
}

function awaitingInitialPayment(purchase: PropertyPurchase) {
  return (
    purchase.status === 'awaiting_payment' ||
    (purchase.status === 'awaiting_approval' && purchase.amountPaid === 0)
  )
}

function buildProgress(purchase: PropertyPurchase): PurchaseLifecycleProgress {
  const outstanding = outstandingAmount(purchase)
  const depositRemaining = depositDue(purchase)

  if (purchase.mode === 'full_payment') {
    return {
      title: 'Sale progress',
      subtitle:
        outstanding > 0
          ? `One verified payment of ${formatCurrency(outstanding)} completes this purchase.`
          : 'Purchase fully settled.',
      percent: paymentProgress(purchase.amountPaid, purchase.agreedPrice),
    }
  }

  if (purchase.mode === 'reservation') {
    if (awaitingInitialPayment(purchase) && purchase.reservationAmount != null) {
      return {
        title: 'Reservation deposit',
        subtitle: `Pay ${formatCurrency(depositRemaining)} to reserve this property. Agreed sale price ${formatCurrency(purchase.agreedPrice)}.`,
        percent: paymentProgress(purchase.amountPaid, purchase.reservationAmount),
      }
    }

    if (purchase.status === 'reserved') {
      return {
        title: 'Balance toward sale',
        subtitle: `Reservation secured. ${formatCurrency(outstanding)} remains before ownership transfer.`,
        percent: paymentProgress(purchase.amountPaid, purchase.agreedPrice),
      }
    }

    return {
      title: 'Reservation progress',
      subtitle: `Track verified payments toward the agreed sale price of ${formatCurrency(purchase.agreedPrice)}.`,
      percent: paymentProgress(purchase.amountPaid, purchase.agreedPrice),
    }
  }

  if (awaitingInitialPayment(purchase) && purchase.reservationAmount != null) {
    const months = purchase.installmentMonths
    return {
      title: 'Initial deposit',
      subtitle: months
        ? `Pay ${formatCurrency(depositRemaining)} before the ${months}-month installment plan begins.`
        : `Pay ${formatCurrency(depositRemaining)} before installment payments begin.`,
      percent: paymentProgress(purchase.amountPaid, purchase.reservationAmount),
    }
  }

  if (purchase.status === 'installment_active') {
    const months = purchase.installmentMonths
    return {
      title: 'Installment progress',
      subtitle: months
        ? `${months}-month plan · ${formatCurrency(outstanding)} outstanding`
        : `${formatCurrency(outstanding)} outstanding on the installment plan`,
      percent: paymentProgress(purchase.amountPaid, purchase.agreedPrice),
    }
  }

  return {
    title: 'Payment progress',
    subtitle: `Track verified payments toward ${formatCurrency(purchase.agreedPrice)}.`,
    percent: paymentProgress(purchase.amountPaid, purchase.agreedPrice),
  }
}

function buildDeadlines(
  purchase: PropertyPurchase,
  formatDateTime: (value: string) => string,
): PurchaseLifecycleDeadline[] {
  if (purchase.status === 'installment_active' && purchase.nextPaymentDueAt) {
    return [
      {
        key: 'next-installment',
        label: 'Next installment due',
        value: formatDateTime(purchase.nextPaymentDueAt),
        note: `${purchase.paymentWindowHours}h grace window`,
      },
    ]
  }

  if (purchase.status === 'awaiting_payment' && purchase.paymentWindowExpiresAt) {
    const label =
      purchase.mode === 'full_payment'
        ? 'Payment deadline'
        : purchase.mode === 'reservation'
          ? 'Reservation deposit deadline'
          : purchase.reservationAmount != null
            ? 'Initial deposit deadline'
            : 'First installment deadline'

    return [
      {
        key: 'initial-deadline',
        label,
        value: formatDateTime(purchase.paymentWindowExpiresAt),
        note: `${purchase.paymentWindowHours}h payment window`,
      },
    ]
  }

  return []
}

function buildCreatePaymentLabel(purchase: PropertyPurchase) {
  if (purchase.status === 'installment_active') {
    return 'Create installment payment request'
  }

  if (purchase.mode === 'full_payment') {
    return 'Create payment request'
  }

  if (purchase.mode === 'reservation') {
    return purchase.status === 'reserved'
      ? 'Create balance payment request'
      : 'Create reservation deposit request'
  }

  if (purchase.reservationAmount != null && purchase.amountPaid < purchase.reservationAmount) {
    return 'Create deposit request'
  }

  return 'Create installment payment request'
}

export function buildPurchaseLifecycleViewModel(
  purchase: PropertyPurchase,
  formatDateTime: (value: string) => string,
): PurchaseLifecycleViewModel {
  const sectionSubtitle =
    purchase.mode === 'full_payment'
      ? 'This is a single-payment purchase. Verified receipt completes the sale.'
      : purchase.mode === 'reservation'
        ? 'Pay the reservation deposit to hold the property, then settle the balance later.'
        : 'Pay the initial deposit, then continue through the installment schedule.'

  const outstandingLabel =
    purchase.mode === 'reservation' && awaitingInitialPayment(purchase)
      ? 'Deposit due'
      : 'Outstanding'

  return {
    modeLabel: purchaseModeLabel(purchase.mode),
    sectionSubtitle,
    progress: buildProgress(purchase),
    deadlines: buildDeadlines(purchase, formatDateTime),
    createPaymentLabel: buildCreatePaymentLabel(purchase),
    expireLabel:
      purchase.mode === 'reservation'
        ? 'Expire unpaid reservation'
        : purchase.mode === 'installment'
          ? 'Expire unpaid purchase'
          : 'Expire unpaid purchase',
    defaultLabel: 'Mark overdue installment defaulted',
    outstandingLabel,
  }
}
