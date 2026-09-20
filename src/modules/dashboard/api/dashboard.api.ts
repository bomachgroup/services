import { apiClient } from '@/shared/api/api-client'
import { getRecordDestination } from '@/shared/navigation'

import type {
  CommandCenterOverview,
  DashboardActivityItem,
  DashboardAttentionItem,
  DashboardDestination,
  DashboardExecutiveAlert,
  DashboardMetric,
  DashboardPipelineStage,
} from '../types/dashboard.types'

interface FinancialsDto {
  revenue: string
  expenses: string
  outstanding: string
  margin_pct: number
}

interface ApprovalSummaryDto {
  items: Array<{
    domain: string
    count: number
    oldest_days: number
  }>
  total_pending: number
}

interface PipelineDto {
  stages: Array<{
    name: string
    count: number
    value: string
  }>
  conversion_rate: number
}

interface ActionItemDto {
  id: number
  type: string
  title: string
  description: string
  due_date: string | null
  priority: string
  link: string
}

interface ActivityDto {
  id: number
  type: string
  title: string
  description: string
  timestamp: string
  link: string
  actor_name: string
}

interface CommandCenterOverviewDto {
  generated_at: string
  kpis: Array<{
    key: string
    label: string
    value: string | number
    value_format?: 'number' | 'currency' | 'percent'
    description?: string
    link?: string
  }>
  attention: Array<{
    id: string
    severity: string
    title: string
    description: string
    record_type: string
    record_number: string
    due_label: string
    priority: string
    owner: string
    link: string
  }>
  pipeline: Array<{
    name: string
    count: number
    value: string | number
    state: 'done' | 'active' | 'pending'
    link?: string
  }>
  finance: {
    collected_revenue: string | number
    outstanding: string | number
    overdue: string | number
    approved_expenses: string | number
    margin_pct: number | null
  }
  activity: ActivityDto[]
}

function number(value: string | number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function destinationFromBackend(type: string, link: string) {
  const match = link.match(
    /^\/(orders|quotes|invoices|approvals|requests|tasks|deliverables|feedback)\/(.+)$/,
  )

  if (match) {
    const [, resource, id] = match
    if (resource && id) {
      const entityType =
        resource === 'quotes'
          ? 'quote'
          : resource === 'invoices'
            ? 'invoice'
            : resource === 'approvals'
              ? 'approval'
              : resource === 'requests'
                ? 'request'
                : resource === 'orders'
                  ? 'order'
                  : resource.slice(0, -1)

      return getRecordDestination(entityType, id) ?? undefined
    }
  }

  return getRecordDestination(type, undefined) ?? undefined
}

function collectionDestination(link: string): DashboardDestination | undefined {
  const destinations: Record<string, DashboardDestination> = {
    '/requests': { section: 'service-requests' },
    '/quotes': { section: 'quotations' },
    '/invoices': { section: 'invoices-payments' },
    '/approvals': { section: 'approvals' },
    '/orders': { section: 'service-orders' },
  }
  return destinations[link]
}

function mapOverviewActivity(item: ActivityDto): DashboardActivityItem {
  const destination = destinationFromBackend(item.type, item.link)
  return {
    id: `${item.type}-${item.id}`,
    title: item.title,
    description: item.description,
    ...(item.actor_name ? { actor: item.actor_name } : {}),
    occurredAt: item.timestamp,
    recordType: item.type,
    ...(destination ? { destination } : {}),
  }
}

export const dashboardApi = {
  async overview(): Promise<CommandCenterOverview> {
    const dto = await apiClient.get<CommandCenterOverviewDto>('/command-center/overview')

    return {
      generatedAt: dto.generated_at,
      metrics: dto.kpis.map((metric) => {
        const destination = collectionDestination(metric.link ?? '')
        return {
          key: metric.key as DashboardMetric['key'],
          label: metric.label,
          value: number(metric.value),
          ...(metric.value_format ? { valueFormat: metric.value_format } : {}),
          description: metric.description ?? '',
          ...(destination ? { destination } : {}),
        }
      }),
      attentionItems: dto.attention.map((item) => {
        const destination = destinationFromBackend(item.record_type, item.link)
        return {
          id: item.id,
          severity:
            item.severity === 'danger' || item.severity === 'warning' ? item.severity : 'info',
          title: item.title,
          description: item.description,
          recordType: item.record_type,
          ...(item.record_number ? { recordNumber: item.record_number } : {}),
          ...(item.due_label ? { dueLabel: item.due_label } : {}),
          ...(item.priority ? { priority: item.priority } : {}),
          ...(item.owner ? { owner: item.owner } : {}),
          ...(destination ? { destination } : {}),
        }
      }),
      pipeline: dto.pipeline.map((stage, index) => {
        const destination = stage.link ? collectionDestination(stage.link) : undefined
        return {
          key: stage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `stage-${index + 1}`,
          label: stage.name,
          count: stage.count,
          value: number(stage.value),
          state: stage.state,
          ...(destination ? { destination } : {}),
        }
      }),
      finance: {
        collectedRevenue: number(dto.finance.collected_revenue),
        outstanding: number(dto.finance.outstanding),
        overdue: number(dto.finance.overdue),
        approvedExpenses: number(dto.finance.approved_expenses),
        marginPct: dto.finance.margin_pct,
      },
      activity: dto.activity.map(mapOverviewActivity),
    }
  },

  async financials(): Promise<DashboardMetric[]> {
    const dto = await apiClient.get<FinancialsDto>('/command-center/financials')

    return [
      {
        key: 'outstanding_invoices',
        label: 'Verified revenue',
        value: number(dto.revenue),
        valueFormat: 'currency',
        description: 'Recognized revenue across active operations',
      },
      {
        key: 'open_requests',
        label: 'Approved expenses',
        value: number(dto.expenses),
        valueFormat: 'currency',
        description: 'Approved operating spend',
      },
      {
        key: 'payment_submissions',
        label: 'Outstanding',
        value: number(dto.outstanding),
        valueFormat: 'currency',
        description: 'Amount still pending collection',
      },
      {
        key: 'service_configuration',
        label: 'Margin',
        value: dto.margin_pct,
        valueFormat: 'percent',
        description: 'Current operating margin',
      },
    ]
  },

  async pendingApprovals(): Promise<{ total: number; alerts: DashboardExecutiveAlert[] }> {
    const dto = await apiClient.get<ApprovalSummaryDto>('/command-center/pending-approvals')

    return {
      total: dto.total_pending,
      alerts: dto.items.map((item) => ({
        id: `approval-${item.domain}`,
        severity: item.count > 0 ? 'warning' : 'info',
        title: item.domain
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (character) => character.toUpperCase()),
        description:
          item.count === 0
            ? 'No pending items'
            : `${item.count} pending${item.oldest_days > 0 ? ` - oldest ${item.oldest_days}d` : ''}`,
        value: item.count,
        valueFormat: 'number',
        destination: { section: 'approvals' },
      })),
    }
  },

  async pipeline(): Promise<{ stages: DashboardPipelineStage[]; conversionRate: number }> {
    const dto = await apiClient.get<PipelineDto>('/command-center/pipeline')

    return {
      stages: dto.stages.map((stage) => ({
        key: stage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: stage.name,
        count: stage.count,
        description: `Value: ${number(stage.value).toLocaleString('en-NG')}`,
        state: 'pending',
        destination: { section: 'service-orders' },
      })),
      conversionRate: dto.conversion_rate,
    }
  },

  async actionItems(): Promise<DashboardAttentionItem[]> {
    const dto = await apiClient.get<ActionItemDto[]>('/command-center/action-items')

    return dto.map((item) => {
      const destination = destinationFromBackend(item.type, item.link)

      return {
        id: String(item.id),
        severity: item.priority === 'high' || item.priority === 'critical' ? 'warning' : 'info',
        title: item.title,
        description: item.description,
        recordType: item.type,
        ...(item.due_date ? { dueLabel: item.due_date } : {}),
        priority: item.priority,
        ...(destination ? { destination } : {}),
      }
    })
  },

  async activity(): Promise<DashboardActivityItem[]> {
    const dto = await apiClient.get<ActivityDto[]>('/command-center/activity')

    return dto.map((item) => {
      const destination = destinationFromBackend(item.type, item.link)

      return {
        id: `${item.type}-${item.id}`,
        title: item.title,
        description: item.description,
        ...(item.actor_name ? { actor: item.actor_name } : {}),
        occurredAt: item.timestamp,
        recordType: item.type,
        ...(destination ? { destination } : {}),
      }
    })
  },
}
