import {
  IconAlertTriangle,
  IconArrowRight,
  IconBell,
  IconCircleCheck,
  IconFilePlus,
  IconRefresh,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'

import { presentError } from '@/shared/errors'
import { formatCurrency } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/cn'
import { DashboardSkeleton, EmptyState, ErrorState } from '@/shared/ui'
import { CommercialSummaryGrid } from '@/modules/commercial/components/CommercialRegisterChrome'
import '@/modules/commercial/styles/commercial.css'
import '@/modules/service-administration/styles/service-administration.css'

import { dashboardQueries } from '../api/dashboard.queries'
import type {
  CommandCenterOverview,
  DashboardActivityItem,
  DashboardAttentionItem,
  DashboardDestination,
  DashboardMetric,
  DashboardPipelineStage,
} from '../types/dashboard.types'
import '../styles/command-center.css'

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function severityClass(severity: DashboardAttentionItem['severity']) {
  if (severity === 'danger') return 'command-center-attention-item--danger'
  if (severity === 'warning') return 'command-center-attention-item--warning'
  return 'command-center-attention-item--info'
}

function attentionLabel(item: DashboardAttentionItem) {
  if (item.priority === 'critical') return 'Staff action'
  if (item.severity === 'danger') return 'Urgent'
  if (item.severity === 'warning') return 'Review'
  return 'Monitor'
}

function recordTypeLabel(recordType: string) {
  const labels: Record<string, string> = {
    approval: 'Approval',
    invoice: 'Invoice',
    order: 'Service order',
    quote: 'Quotation',
    request: 'Service request',
    property_sale: 'Property sale',
  }
  return labels[recordType] ?? recordType.replaceAll('_', ' ')
}

function destinationLabel(destination?: DashboardDestination) {
  if (!destination) return 'Open'
  const labels: Record<string, string> = {
    'service-requests': 'Open request',
    quotations: 'Open quote',
    'invoices-payments': 'Open invoice',
    approvals: 'Open approval',
    'service-orders': 'Open order',
  }
  return labels[destination.section] ?? 'Open'
}

function navigateToDestination(
  navigate: ReturnType<typeof useNavigate>,
  destination?: DashboardDestination,
) {
  if (!destination) return
  void navigate({
    to: '/app/$section',
    params: { section: destination.section },
    search: destination.search ?? {},
  })
}

function KpiGrid({ metrics }: { metrics: DashboardMetric[] }) {
  const navigate = useNavigate()

  return (
    <CommercialSummaryGrid
      ariaLabel="Operational summary"
      columns={5}
      items={metrics.map((metric) => ({
        label: metric.label,
        value:
          metric.valueFormat === 'currency'
            ? formatCurrency(metric.value, { compact: true })
            : metric.valueFormat === 'percent'
              ? `${metric.value}%`
              : metric.value.toLocaleString('en-NG'),
        note: metric.description,
        tone:
          metric.key === 'collected_revenue'
            ? 'positive'
            : metric.key === 'outstanding_invoices'
              ? 'warning'
              : metric.key === 'sla_risk'
                ? 'danger'
                : 'default',
        ...(metric.valueFormat === 'currency' ? { valueTitle: formatCurrency(metric.value) } : {}),
        ...(metric.destination
          ? { onClick: () => navigateToDestination(navigate, metric.destination) }
          : {}),
      }))}
    />
  )
}

function AttentionQueue({ items }: { items: DashboardAttentionItem[] }) {
  const navigate = useNavigate()

  return (
    <section className="command-center-card command-center-attention-card">
      <div className="command-center-card-header">
        <div>
          <div className="command-center-card-title">Needs attention</div>
          <div className="command-center-card-subtitle">
            Staff actions across commercial, property sales, billing, and delivery.
          </div>
        </div>
        <div className="command-center-card-header-actions">
          <span className="command-center-card-count">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          <span className="command-center-card-header-icon" aria-hidden="true">
            <IconBell size={15} />
          </span>
        </div>
      </div>

      {items.length ? (
        <div className="command-center-attention-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn('command-center-attention-item', severityClass(item.severity))}
              onClick={() => navigateToDestination(navigate, item.destination)}
              disabled={!item.destination}
            >
              <span className="command-center-attention-icon" aria-hidden="true">
                {item.severity === 'danger' ? (
                  <IconAlertTriangle size={15} />
                ) : (
                  <IconBell size={15} />
                )}
              </span>
              <span className="command-center-attention-main">
                <span className="command-center-attention-heading">
                  <strong>{item.title}</strong>
                  <span className="command-center-pill">{attentionLabel(item)}</span>
                </span>
                <span className="command-center-attention-description">{item.description}</span>
                <span className="command-center-attention-meta">
                  <span>{recordTypeLabel(item.recordType)}</span>
                  <span>{item.owner || 'Unassigned'}</span>
                  <span>{item.dueLabel || 'No deadline'}</span>
                </span>
              </span>
              <span className="command-center-attention-action">
                {destinationLabel(item.destination)}
                <IconArrowRight size={13} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="command-center-clear-state">
          <IconCircleCheck size={20} aria-hidden="true" />
          <div>
            <strong>Operations are clear</strong>
            <span>
              No urgent requests, approvals, billing issues, or delivery risks were returned.
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

function PipelineCard({ stages }: { stages: DashboardPipelineStage[] }) {
  const navigate = useNavigate()

  return (
    <section className="command-center-card">
      <div className="command-center-card-header">
        <div>
          <div className="command-center-card-title">Service delivery pipeline</div>
          <div className="command-center-card-subtitle">
            Current order work across mobilisation, delivery, review, and completion.
          </div>
        </div>
        <Link
          to="/app/$section"
          params={{ section: 'service-orders' }}
          className="command-center-text-link"
        >
          View orders
          <IconArrowRight size={13} />
        </Link>
      </div>

      {stages.length ? (
        <div className="command-center-pipeline-list">
          {stages.map((stage) => (
            <button
              key={stage.key}
              type="button"
              className={cn(
                'command-center-pipeline-row',
                stage.state === 'active' && 'is-active',
                stage.state === 'done' && 'is-done',
              )}
              onClick={() => navigateToDestination(navigate, stage.destination)}
              disabled={!stage.destination}
            >
              <span className="command-center-pipeline-state" aria-hidden="true" />
              <span className="command-center-pipeline-name">
                <strong>{stage.label}</strong>
                <small>
                  {stage.state === 'done'
                    ? 'Completed stage'
                    : stage.state === 'active'
                      ? 'Live work'
                      : 'No live orders'}
                </small>
              </span>
              <span className="command-center-pipeline-count">{stage.count}</span>
              <span className="command-center-pipeline-value">
                {stage.value ? formatCurrency(stage.value) : 'No value'}
              </span>
              <IconArrowRight size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No pipeline data" description="No service order stages were returned." />
      )}
    </section>
  )
}

function FinancePulse({ overview }: { overview: CommandCenterOverview }) {
  const finance = overview.finance

  return (
    <section className="command-center-card command-center-finance-card">
      <div className="command-center-card-header">
        <div>
          <div className="command-center-card-title">Finance pulse</div>
          <div className="command-center-card-subtitle">
            Current collected and receivable position.
          </div>
        </div>
        <Link
          to="/app/$section"
          params={{ section: 'invoices-payments' }}
          className="command-center-text-link"
        >
          View finance
          <IconArrowRight size={13} />
        </Link>
      </div>
      <div className="command-center-finance-list">
        <div>
          <span>Collected revenue</span>
          <strong>{formatCurrency(finance.collectedRevenue)}</strong>
        </div>
        <div>
          <span>Outstanding invoices</span>
          <strong>{formatCurrency(finance.outstanding)}</strong>
        </div>
        <div className={finance.overdue ? 'is-risk' : undefined}>
          <span>Overdue balance</span>
          <strong>{formatCurrency(finance.overdue)}</strong>
        </div>
        <div>
          <span>Approved expenses</span>
          <strong>{formatCurrency(finance.approvedExpenses)}</strong>
        </div>
        <div>
          <span>Operating margin</span>
          <strong>{finance.marginPct === null ? 'Not available' : `${finance.marginPct}%`}</strong>
        </div>
      </div>
    </section>
  )
}

function ActivityCard({ items }: { items: DashboardActivityItem[] }) {
  const navigate = useNavigate()

  return (
    <section className="command-center-card">
      <div className="command-center-card-header">
        <div>
          <div className="command-center-card-title">Recent activity</div>
          <div className="command-center-card-subtitle">
            Latest changes across service operations.
          </div>
        </div>
      </div>
      {items.length ? (
        <div className="command-center-activity-list">
          {items.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn('command-center-activity-row', item.destination && 'is-linked')}
              disabled={!item.destination}
              onClick={() => navigateToDestination(navigate, item.destination)}
            >
              <span className="command-center-activity-dot" aria-hidden="true" />
              <span className="command-center-activity-main">
                <strong>{item.title}</strong>
                <span>{item.description || item.recordType || 'Operational update'}</span>
              </span>
              <span className="command-center-activity-time">
                {formatDateTime(item.occurredAt)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No recent activity"
          description="No recent operational changes were returned."
        />
      )}
    </section>
  )
}

function WorkspaceLinks() {
  const links = [
    ['Service Requests', 'Review intake, ownership, and next actions.', 'service-requests'],
    ['Quotations', 'Prepare and approve commercial proposals.', 'quotations'],
    ['Invoices & Payments', 'Track billing, balances, and payment review.', 'invoices-payments'],
    ['Service Orders', 'Monitor delivery and fulfilment progress.', 'service-orders'],
    ['Calculator Library', 'Manage calculator-backed service pricing.', 'calculator-library'],
    ['Reports & Analytics', 'Open detailed operational reporting.', 'reports-analytics'],
  ] as const

  return (
    <section className="command-center-card">
      <div className="command-center-card-header">
        <div>
          <div className="command-center-card-title">Service workspaces</div>
          <div className="command-center-card-subtitle">
            Jump directly to the next operating area.
          </div>
        </div>
      </div>
      <div className="command-center-workspace-grid">
        {links.map(([label, description, section]) => (
          <Link
            key={section}
            to="/app/$section"
            params={{ section }}
            className="command-center-workspace-link"
          >
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <IconArrowRight size={14} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  )
}

function DashboardHeader({
  generatedAt,
  onRefresh,
  refreshing,
}: {
  generatedAt: string
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <section className="command-center-toolbar">
      <div className="command-center-toolbar-title">
        Service Command Center
        <small>Services / Live operational overview</small>
      </div>
      <div className="command-center-toolbar-meta">
        <span>Updated {formatDateTime(generatedAt)}</span>
        <button
          type="button"
          className="command-center-btn"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <IconRefresh size={14} className={refreshing ? 'command-center-spin' : undefined} />
          Refresh
        </button>
      </div>
      <Link
        to="/app/$section"
        params={{ section: 'service-requests' }}
        search={{ create: 'request' }}
        className="command-center-btn command-center-btn-primary"
      >
        <IconFilePlus size={14} />
        New Request
      </Link>
    </section>
  )
}

export function OperationsDashboardPage() {
  const overviewQuery = useQuery(dashboardQueries.overview())

  if (overviewQuery.isPending) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DashboardSkeleton />
      </div>
    )
  }

  if (overviewQuery.isError) {
    const error = presentError(overviewQuery.error, 'page-load')
    return (
      <div className="command-center">
        <section className="command-center-toolbar">
          <div className="command-center-toolbar-title">
            Service Command Center
            <small>Services / Live operational overview</small>
          </div>
        </section>
        <main className="command-center-content command-center-content--error">
          <ErrorState
            title="Command Center unavailable"
            description={error.message}
            onRetry={() => void overviewQuery.refetch()}
          />
        </main>
      </div>
    )
  }

  const overview = overviewQuery.data

  return (
    <div className="command-center">
      <DashboardHeader
        generatedAt={overview.generatedAt}
        onRefresh={() => void overviewQuery.refetch()}
        refreshing={overviewQuery.isFetching}
      />
      <main className="command-center-content">
        <div className="command-center-intro">
          <div>
            <span className="command-center-eyebrow">Operational position</span>
            <h1>Make the next decision quickly.</h1>
            <p>Review exceptions first, then move into the service workspace that owns the work.</p>
          </div>
          <span className="command-center-snapshot-pill">Live snapshot</span>
        </div>

        <KpiGrid metrics={overview.metrics} />
        <AttentionQueue items={overview.attentionItems} />

        <div className="command-center-primary-grid">
          <PipelineCard stages={overview.pipeline} />
          <FinancePulse overview={overview} />
        </div>

        <div className="command-center-secondary-grid">
          <ActivityCard items={overview.activity} />
          <WorkspaceLinks />
        </div>
      </main>
    </div>
  )
}
