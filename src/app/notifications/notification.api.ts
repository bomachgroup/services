import { apiClient } from '@/shared/api/api-client'
import { env } from '@/shared/config/env'

import {
  mapNotification,
  mapNotificationList,
  mapNotificationStats,
  type NotificationDto,
  type NotificationListDto,
  type NotificationStatsDto,
} from './notification.mapper'
import type {
  AppNotification,
  NotificationListResult,
  NotificationStats,
} from './notification.types'

export const notificationApi = {
  async list(
    params: { isRead?: boolean; limit?: number; offset?: number } = {},
  ): Promise<NotificationListResult> {
    const search = new URLSearchParams()

    if (params.isRead !== undefined) search.set('is_read', String(params.isRead))
    search.set('limit', String(params.limit ?? 20))
    search.set('offset', String(params.offset ?? 0))

    const listPath = env.notificationListPath || '/notifications/'
    const payload = await apiClient.get<NotificationListDto>(`${listPath}?${search.toString()}`)

    return mapNotificationList(payload)
  },

  async stats(): Promise<NotificationStats> {
    const payload = await apiClient.get<NotificationStatsDto>('/notifications/stats')
    return mapNotificationStats(payload)
  },

  async get(notificationId: string): Promise<AppNotification> {
    const payload = await apiClient.get<NotificationDto>(
      `/notifications/${encodeURIComponent(notificationId)}`,
    )
    return mapNotification(payload)
  },

  async markRead(notificationId: string): Promise<AppNotification> {
    const path = (env.notificationMarkReadPath || '/notifications/{id}/read').replace(
      '{id}',
      encodeURIComponent(notificationId),
    )
    const payload = await apiClient.patch<NotificationDto>(path)
    return mapNotification(payload)
  },

  async markAllRead(): Promise<void> {
    await apiClient.post(env.notificationMarkAllReadPath || '/notifications/read-all')
  },
}
