import { formatCurrency } from '@/shared/lib/formatters'

/** Shared naira formatter - matches Service Operations HTML `money()`. */
export const commercialMoney = {
  format: formatCurrency,
}

function normalizeStatus(status: string) {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

export function requestStatusClass(status: string) {
  switch (normalizeStatus(status)) {
    case 'rejected':
      return 'commercial-pill-red'
    case 'cancelled':
      return 'commercial-pill-gray'
    case 'quoted':
    case 'converted':
    case 'completed':
      return 'commercial-pill-green'
    case 'awaiting_quotation':
    case 'client_approval':
    case 'awaiting_client':
    case 'site_assessment':
    case 'under_review':
      return 'commercial-pill-yellow'
    case 'new':
      return 'commercial-pill-blue'
    case 'finance_review_required':
    case 'installment_defaulted':
    case 'reservation_expired':
      return 'commercial-pill-red'
    default:
      return 'commercial-pill-blue'
  }
}

export function quotationStatusClass(status: string) {
  switch (normalizeStatus(status)) {
    case 'accepted':
    case 'approved':
      return 'commercial-pill-green'
    case 'rejected':
    case 'expired':
      return 'commercial-pill-red'
    case 'awaiting_approval':
    case 'pending_approval':
    case 'sent':
    case 'issued':
      return 'commercial-pill-yellow'
    case 'draft':
    case 'superseded':
      return 'commercial-pill-gray'
    default:
      return 'commercial-pill-blue'
  }
}

export function invoiceStatusClass(status: string) {
  switch (normalizeStatus(status)) {
    case 'paid':
      return 'commercial-pill-green'
    case 'overdue':
    case 'expired':
    case 'defaulted':
    case 'finance_review_required':
      return 'commercial-pill-red'
    case 'part_paid':
    case 'partially_paid':
    case 'pending':
    case 'pending_review':
      return 'commercial-pill-yellow'
    case 'draft':
    case 'cancelled':
      return 'commercial-pill-gray'
    default:
      return 'commercial-pill-blue'
  }
}

export function approvalStatusClass(status: string) {
  const normalized = normalizeStatus(status)
  if (normalized === 'approved') return 'commercial-pill-green'
  if (normalized === 'rejected') return 'commercial-pill-red'
  if (normalized === 'pending') return 'commercial-pill-yellow'
  return 'commercial-pill-gray'
}

export type CommercialDeadlineTone = 'default' | 'warning' | 'danger'

export interface CommercialDeadlineState {
  tone: CommercialDeadlineTone
  label: string
}

const CLOSED_DEADLINE_STATUSES = new Set([
  'accepted',
  'cancelled',
  'completed',
  'converted',
  'paid',
  'rejected',
  'superseded',
])

/** Returns a small, shared deadline cue for register rows without changing record status. */
export function commercialDeadlineState(
  dateValue: string | null | undefined,
  status?: string,
  now = new Date(),
): CommercialDeadlineState {
  if (!dateValue || (status && CLOSED_DEADLINE_STATUSES.has(normalizeStatus(status)))) {
    return { tone: 'default', label: '' }
  }

  const dueDate = new Date(`${dateValue.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(dueDate.getTime())) return { tone: 'default', label: '' }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000)

  if (daysUntilDue < 0) {
    const daysOverdue = Math.abs(daysUntilDue)
    return {
      tone: 'danger',
      label: `Overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`,
    }
  }
  if (daysUntilDue <= 3) {
    return {
      tone: 'warning',
      label:
        daysUntilDue === 0
          ? 'Due today'
          : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
    }
  }

  return { tone: 'default', label: '' }
}

export const quotationApprovers = [
  'Service Manager',
  'Head of Operations',
  'Finance Manager',
  'CEO / Founder',
] as const

export const invoicePaymentSchedules = [
  'Full payment',
  '30% mobilisation',
  '40% mobilisation',
  '50% mobilisation',
  '70% advance',
  'Milestone schedule',
] as const

export const defaultPaymentInstructions =
  'Pay through client wallet, payment gateway, bank transfer or approved POS.'
