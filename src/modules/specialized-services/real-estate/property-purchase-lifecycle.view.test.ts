import { describe, expect, it } from 'vitest'

import type { PropertyPurchase } from './real-estate.types'
import { buildPurchaseLifecycleViewModel } from './property-purchase-lifecycle.view'

const formatDateTime = (value: string) => `fmt:${value}`

function purchase(overrides: Partial<PropertyPurchase> = {}): PropertyPurchase {
  return {
    id: 1,
    propertyId: 10,
    propertyName: 'Residence 2',
    estateId: 2,
    estateName: 'Oak Estate',
    clientId: 7,
    clientUserId: 17,
    clientName: 'ONYEDIKACHI EJIM',
    clientEmail: 'buyer@example.com',
    invoiceId: null,
    mode: 'full_payment',
    agreedPrice: 5_000_000,
    reservationThresholdPercent: null,
    reservationAmount: null,
    installmentMonths: null,
    paymentWindowHours: 120,
    paymentWindowExpiresAt: '2026-09-01T20:11:00Z',
    approvedAt: '2026-08-28T20:11:00Z',
    nextPaymentDueAt: '2026-09-01T20:11:00Z',
    status: 'awaiting_payment',
    amountPaid: 0,
    canRequestPayment: true,
    hasLivePaymentRequest: false,
    reservedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdById: 3,
    createdAt: '2026-08-28T12:00:00Z',
    updatedAt: '2026-08-28T12:00:00Z',
    ...overrides,
  }
}

describe('buildPurchaseLifecycleViewModel', () => {
  it('uses full-payment language and hides installment deadlines', () => {
    const view = buildPurchaseLifecycleViewModel(purchase(), formatDateTime)

    expect(view.modeLabel).toBe('Full payment')
    expect(view.progress.title).toBe('Sale progress')
    expect(view.progress.subtitle).toContain('One verified payment')
    expect(view.deadlines).toEqual([
      {
        key: 'initial-deadline',
        label: 'Payment deadline',
        value: 'fmt:2026-09-01T20:11:00Z',
        note: '120h payment window',
      },
    ])
    expect(view.createPaymentLabel).toBe('Create payment request')
    expect(view.deadlines.some((item) => item.label.includes('installment'))).toBe(false)
  })

  it('uses reservation deposit language before the property is reserved', () => {
    const view = buildPurchaseLifecycleViewModel(
      purchase({
        mode: 'reservation',
        reservationThresholdPercent: 10,
        reservationAmount: 500_000,
      }),
      formatDateTime,
    )

    expect(view.progress.title).toBe('Reservation deposit')
    expect(view.progress.subtitle).toContain('Pay ₦500,000')
    expect(view.deadlines[0]?.label).toBe('Reservation deposit deadline')
    expect(view.createPaymentLabel).toBe('Create reservation deposit request')
    expect(view.outstandingLabel).toBe('Deposit due')
  })

  it('uses installment schedule language after the plan is active', () => {
    const view = buildPurchaseLifecycleViewModel(
      purchase({
        mode: 'installment',
        reservationAmount: 500_000,
        installmentMonths: 12,
        status: 'installment_active',
        amountPaid: 500_000,
        reservedAt: '2026-08-28T12:00:00Z',
        paymentWindowExpiresAt: null,
      }),
      formatDateTime,
    )

    expect(view.progress.title).toBe('Installment progress')
    expect(view.progress.subtitle).toContain('12-month plan')
    expect(view.deadlines[0]?.label).toBe('Next installment due')
    expect(view.createPaymentLabel).toBe('Create installment payment request')
  })
})
