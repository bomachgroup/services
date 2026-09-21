import type {
  ServiceOrder,
  ServiceOrderPaymentStatus,
  ServiceOrderStatus,
} from './service-order.types'

export function serviceOrderStatusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function serviceOrderStatusClass(status: ServiceOrderStatus) {
  if (status === 'completed') return 'commercial-pill-green'
  if (status === 'cancelled') return 'commercial-pill-red'
  if (status === 'on_hold' || status === 'quality_review' || status === 'awaiting_client') {
    return 'commercial-pill-yellow'
  }
  return 'commercial-pill-blue'
}

export function serviceOrderPaymentStatusClass(status: ServiceOrderPaymentStatus) {
  if (status === 'paid') return 'commercial-pill-green'
  if (status === 'partial') return 'commercial-pill-yellow'
  return 'commercial-pill-red'
}

export function serviceOrderIsOverdue(order: Pick<ServiceOrder, 'orderStatus' | 'dueDate'>) {
  if (!order.dueDate || ['completed', 'cancelled'].includes(order.orderStatus)) return false
  const due = new Date(`${order.dueDate}T23:59:59`)
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now()
}

export function serviceOrderStatusOptions(status: ServiceOrderStatus) {
  const transitions: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
    pending_mobilisation: ['pending_mobilisation', 'active', 'on_hold', 'cancelled'],
    active: ['active', 'quality_review', 'awaiting_client', 'on_hold', 'cancelled'],
    quality_review: ['quality_review', 'awaiting_client', 'active', 'on_hold', 'cancelled'],
    awaiting_client: ['awaiting_client', 'active', 'completed', 'on_hold', 'cancelled'],
    on_hold: ['on_hold', 'active', 'cancelled'],
    completed: ['completed'],
    cancelled: ['cancelled'],
  }
  return transitions[status]
}
