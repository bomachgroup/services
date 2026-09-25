import type { AppNotification } from './notification.types'

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return undefined
}

function nested(value: unknown, ...keys: string[]): string | undefined {
  let current: unknown = value
  for (const key of keys) current = object(current)[key]
  return text(current)
}

function dateLabel(value: string | undefined, includeTime = false): string | undefined {
  if (!value) return undefined
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    ...(includeTime && !dateOnly ? { timeStyle: 'short' as const } : {}),
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  }).format(parsed)
}

function moneyLabel(value: string | undefined): string | undefined {
  if (!value) return undefined
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `NGN ${value}`
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount)
}

function humanize(value: string | undefined): string | undefined {
  return value?.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function getNotificationDetails(notification: AppNotification): string[] {
  const details = object(notification.metadata.details)
  const kind = text(details.kind)
  const values: Array<string | undefined> = []

  if (kind === 'invoice') {
    values.push(
      nested(details, 'service', 'name'),
      moneyLabel(nested(details, 'amounts', 'balance_due', 'amount'))
        ? `Balance ${moneyLabel(nested(details, 'amounts', 'balance_due', 'amount'))}`
        : undefined,
      dateLabel(nested(details, 'invoice', 'due_date'))
        ? `Due ${dateLabel(nested(details, 'invoice', 'due_date'))}`
        : undefined,
    )
  } else if (kind === 'quote') {
    values.push(
      nested(details, 'service', 'name'),
      dateLabel(nested(details, 'quote', 'valid_until'))
        ? `Valid until ${dateLabel(nested(details, 'quote', 'valid_until'))}`
        : undefined,
    )
  } else if (kind === 'payment') {
    values.push(
      nested(details, 'payment', 'reference'),
      moneyLabel(nested(details, 'money', 'amount'))
        ? `Amount ${moneyLabel(nested(details, 'money', 'amount'))}`
        : undefined,
    )
  } else if (kind === 'service_task') {
    values.push(
      nested(details, 'task', 'title') || nested(details, 'task', 'number'),
      dateLabel(nested(details, 'task', 'due_date'))
        ? `Due ${dateLabel(nested(details, 'task', 'due_date'))}`
        : undefined,
    )
  } else if (kind === 'service_order') {
    values.push(
      nested(details, 'service', 'name'),
      humanize(nested(details, 'order', 'status')),
      dateLabel(nested(details, 'order', 'due_date'))
        ? `Due ${dateLabel(nested(details, 'order', 'due_date'))}`
        : undefined,
    )
  } else if (kind === 'deliverable') {
    values.push(
      nested(details, 'deliverable', 'type'),
      humanize(nested(details, 'deliverable', 'status')),
    )
  } else if (kind === 'real_estate') {
    values.push(
      nested(details, 'asset', 'label'),
      nested(details, 'installment', 'label') ||
        (nested(details, 'installment', 'sequence')
          ? `Installment ${nested(details, 'installment', 'sequence')}`
          : undefined),
      dateLabel(nested(details, 'asset', 'reservation_expires_at'), true)
        ? `Reservation expires ${dateLabel(nested(details, 'asset', 'reservation_expires_at'), true)}`
        : undefined,
    )
  }

  return [...new Set(values.filter((value): value is string => Boolean(value)))].slice(0, 3)
}

export function getNotificationPriorityLabel(
  priority: AppNotification['priority'],
): 'Urgent' | 'Action required' | undefined {
  if (priority === 'critical') return 'Urgent'
  if (priority === 'high') return 'Action required'
  return undefined
}
