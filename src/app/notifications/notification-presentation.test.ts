import { describe, expect, it } from 'vitest'

import type { AppNotification } from './notification.types'
import { getNotificationDetails, getNotificationPriorityLabel } from './notification-presentation'

function notification(details: Record<string, unknown>): AppNotification {
  return {
    id: '1',
    title: 'Test notification',
    description: 'Details',
    timestamp: '2026-09-25T10:00:00Z',
    tone: 'warning',
    read: false,
    metadata: { details },
  }
}

describe('notification presentation', () => {
  it('shows invoice service, outstanding balance, and due date', () => {
    const values = getNotificationDetails(
      notification({
        kind: 'invoice',
        invoice: { number: 'INV-42', due_date: '2026-10-01' },
        service: { name: 'Survey' },
        amounts: {
          balance_due: { amount: '125000.00', currency: 'NGN' },
        },
      }),
    )

    expect(values).toContain('Survey')
    expect(values.some((value) => value.includes('125,000'))).toBe(true)
    expect(values.some((value) => value.startsWith('Due '))).toBe(true)
  })

  it('uses a property label and does not expose an internal asset id', () => {
    const values = getNotificationDetails(
      notification({
        kind: 'real_estate',
        asset: { id: '9001', label: 'Plot 12', reservation_expires_at: '2026-09-26T10:00:00Z' },
      }),
    )

    expect(values).toContain('Plot 12')
    expect(values.join(' ')).not.toContain('9001')
  })

  it('surfaces only actionable priority levels', () => {
    expect(getNotificationPriorityLabel('critical')).toBe('Urgent')
    expect(getNotificationPriorityLabel('high')).toBe('Action required')
    expect(getNotificationPriorityLabel('normal')).toBeUndefined()
  })
})
