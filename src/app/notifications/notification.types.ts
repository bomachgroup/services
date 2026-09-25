export type NotificationTone = 'info' | 'success' | 'warning' | 'danger' | 'approval' | 'task'

export interface NotificationMetadata {
  entity_type?: string
  entity_id?: string | number
  [key: string]: unknown
}

export interface AppNotification {
  id: string
  title: string
  description: string
  timestamp: string
  tone: NotificationTone
  read: boolean
  link?: string
  metadata: NotificationMetadata
  eventType?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  action?: string
  entityType?: string
  entityId?: string
}

export interface NotificationListResult {
  count: number
  next: string | null
  previous: string | null
  notifications: AppNotification[]
}

export interface NotificationStats {
  unreadCount: number
}
