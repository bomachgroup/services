import { describe, expect, it } from 'vitest'

import { mapInvoice } from './billing.mapper'

const invoicePayload = {
  id: 7,
  invoice_number: 'INV-260901-001',
  client_id: 3,
  client_name: 'Ada Obi',
  service: { id: 1, name: 'Survey' },
  status: 'partially_paid',
  payment_schedule: '3 monthly installments',
  payment_instructions: 'Transfer to GTB',
  subtotal: '1000.00',
  tax_rate: '7.50',
  tax_amount: '75.00',
  total_amount: '1075.00',
  amount_paid: '475.00',
  balance: '600.00',
  payment_progress: 44.19,
  activation_threshold_amount: '215.00',
  real_estate_settlement_mode: 'installment',
  payment_due: {
    amount_due_now: '150.00',
    label: 'Installment 1',
    due_date: '2026-10-01',
    phase: 'installment',
    schedule_lines: [
      {
        sequence: 0,
        label: 'Down payment',
        due_date: '2026-09-01',
        amount: '215.00',
        status: 'paid',
      },
      {
        sequence: 1,
        label: 'Installment 1',
        due_date: '2026-10-01',
        amount: '150.00',
        status: 'partial',
        amount_remaining: '60.00',
      },
      {
        sequence: 2,
        label: 'Installment 2',
        due_date: null,
        amount: '335.00',
        status: 'pending',
      },
    ],
  },
  items: [],
  attachments: [],
  created_by_id: 1,
}

describe('mapInvoice paymentDue', () => {
  it('maps the payment due snapshot and schedule lines', () => {
    const invoice = mapInvoice(invoicePayload)

    expect(invoice.paymentDue).toEqual({
      amountDueNow: 150,
      label: 'Installment 1',
      dueDate: '2026-10-01',
      phase: 'installment',
      scheduleLines: [
        {
          sequence: 0,
          label: 'Down payment',
          dueDate: '2026-09-01',
          amount: 215,
          status: 'paid',
          amountRemaining: null,
        },
        {
          sequence: 1,
          label: 'Installment 1',
          dueDate: '2026-10-01',
          amount: 150,
          status: 'partial',
          amountRemaining: 60,
        },
        {
          sequence: 2,
          label: 'Installment 2',
          dueDate: null,
          amount: 335,
          status: 'pending',
          amountRemaining: null,
        },
      ],
    })
    expect(invoice.realEstateSettlementMode).toBe('installment')
  })

  it('falls back to balance when payment_due is missing', () => {
    const invoice = mapInvoice({
      ...invoicePayload,
      payment_due: undefined,
      balance: '600.00',
    })

    expect(invoice.paymentDue.amountDueNow).toBe(600)
    expect(invoice.paymentDue.label).toBe('')
    expect(invoice.paymentDue.phase).toBe('balance')
    expect(invoice.paymentDue.scheduleLines).toEqual([])
  })

  it('treats blank amount_remaining as null', () => {
    const invoice = mapInvoice({
      ...invoicePayload,
      payment_due: {
        amount_due_now: '150.00',
        label: 'x',
        phase: 'installment',
        schedule_lines: [
          { sequence: 0, label: 'Down', amount: '215.00', status: 'paid', amount_remaining: '' },
        ],
      },
    })

    const paidLine = invoice.paymentDue.scheduleLines[0]
    expect(paidLine?.amountRemaining).toBeNull()
  })
})
