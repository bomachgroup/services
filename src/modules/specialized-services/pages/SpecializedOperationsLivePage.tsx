import { IconFilePlus, IconPlus, IconRefresh, IconSettings } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'

import { useAuth } from '@/app/auth'
import { SectionLoadingState } from '@/app/loading/SectionLoadingState'
import { hasPermission, PERMISSIONS } from '@/app/permissions'
import { serviceRequestQueries } from '@/modules/commercial/api/service-requests.queries'
import { serviceOrderQueries } from '@/modules/fulfillment/service-orders/service-order.queries'
import { serviceAdministrationQueries } from '@/modules/service-administration/api/service-administration.queries'
import { SPECIALIZED_DOMAIN_OPTIONS } from '@/modules/service-administration/api/specialized-service.utils'
import type { ServiceCatalogueItem } from '@/modules/service-administration/types/service-administration.types'
import type { AppSectionSearch } from '@/routes/app/$section'
import { presentError } from '@/shared/errors'
import { withoutSearchKeys } from '@/shared/navigation/search-state'
import { ErrorState } from '@/shared/ui'
import { DropdownSelect } from '@/shared/ui/dropdown-select'
import { EmptyState } from '@/shared/ui/empty-state'
import {
  CompactActionButton,
  CompactPageToolbar,
  ModulePageFrame,
  ModulePageStatus,
} from '@/shared/ui/module-controls'
import { CalculatorServiceCard } from '../components/CalculatorServiceCard'
import { CalculatorServiceDetailWorkspace } from '../workspaces/CalculatorServiceDetailWorkspace'
import '../styles/specialized-services.css'
import '../../commercial/styles/commercial.css'

const hasWorkflow = (s: ServiceCatalogueItem) =>
  Boolean(s.activeWorkflow || s.workflowName || s.workflowStages?.length)

export function SpecializedOperationsLivePage({
  recordSearch,
}: {
  recordSearch: AppSectionSearch
}) {
  const { user } = useAuth(),
    navigate = useNavigate()
  const canServices = hasPermission(user, PERMISSIONS.servicesList)
  const canViewService = hasPermission(user, PERMISSIONS.servicesView)
  const canRequests = hasPermission(user, PERMISSIONS.serviceRequestsList)
  const canCreateRequest = hasPermission(user, PERMISSIONS.serviceRequestsCreate)
  const canOrders = hasPermission(user, PERMISSIONS.ordersList)

  const allQ = useQuery({
    ...serviceAdministrationQueries.catalogueList({
      status: 'active',
      calculatorOnly: true,
      limit: 100,
      offset: 0,
    }),
    enabled: canServices,
  })
  const domainOptions = useMemo(
    () =>
      SPECIALIZED_DOMAIN_OPTIONS.filter((option) => option.value && option.value !== 'real_estate'),
    [],
  )
  const calculatorServices = useMemo(
    () => (allQ.data?.items ?? []).filter((item) => item.specializedDomain !== 'real_estate'),
    [allQ.data?.items],
  )
  const availableDomains = useMemo(() => {
    const configured = new Set(
      calculatorServices
        .map((item) => item.specializedDomain?.trim())
        .filter((value): value is string => Boolean(value)),
    )
    return domainOptions.filter((option) => configured.has(option.value))
  }, [calculatorServices, domainOptions])
  const specializedDomain =
    recordSearch.specializedDomain &&
    availableDomains.some((option) => option.value === recordSearch.specializedDomain)
      ? recordSearch.specializedDomain
      : ''
  const services = useMemo(() => {
    const search = recordSearch.search?.trim().toLowerCase() ?? ''
    return calculatorServices.filter((service) => {
      if (specializedDomain && service.specializedDomain !== specializedDomain) return false
      if (!search) return true
      return [service.name, service.code, service.description, service.calculatorName]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search))
    })
  }, [calculatorServices, recordSearch.search, specializedDomain])
  const selected =
    calculatorServices.find((x) => Number(x.id) === Number(recordSearch.service)) ?? null
  const serviceId = selected ? Number(selected.id) : null
  const detailQ = useQuery({
    ...serviceAdministrationQueries.catalogueDetail(serviceId ?? 0),
    enabled: Boolean(serviceId) && canViewService,
  })
  const requestQ = useQuery({
    ...serviceRequestQueries.list({ serviceId: serviceId ?? 0, page: 1, limit: 10 }),
    enabled: Boolean(serviceId) && canRequests,
  })
  const orderQ = useQuery({
    ...serviceOrderQueries.list({
      ...(selected ? { search: selected.name } : {}),
      page: 1,
      limit: 50,
    }),
    enabled: Boolean(serviceId) && canOrders,
  })
  const orders = useMemo(
    () => (orderQ.data?.items ?? []).filter((x) => x.serviceId === serviceId),
    [orderQ.data?.items, serviceId],
  )
  const detail = detailQ.data ?? selected
  const activeServices = services.filter((x) => x.status === 'active').length
  const workflows = services.filter(hasWorkflow).length
  const branches = new Set(services.flatMap((x) => x.branchNames)).size
  const avgSla = services.length
    ? Math.round(services.reduce((n, x) => n + (x.slaDays ?? 0), 0) / services.length)
    : 0

  const setContext = (nextDomain: string, nextService?: string, nextSearch = '') =>
    void navigate({
      to: '/app/$section',
      params: { section: 'survey-engineering-others' },
      search: (p) => ({
        ...withoutSearchKeys(p, ['specializedDomain', 'service', 'page', 'search', 'status']),
        ...(nextDomain ? { specializedDomain: nextDomain } : {}),
        ...(nextService ? { service: nextService } : {}),
        ...(nextSearch ? { search: nextSearch } : {}),
      }),
      replace: true,
    })
  const refresh = () =>
    Promise.all([
      allQ.refetch(),
      ...(serviceId
        ? [
            detailQ.refetch(),
            ...(canRequests ? [requestQ.refetch()] : []),
            ...(canOrders ? [orderQ.refetch()] : []),
          ]
        : []),
    ])
  const openRequest = (id?: number | null) =>
    void navigate({
      to: '/app/$section',
      params: { section: 'service-requests' },
      search: {
        create: 'request',
        ...(id ? { service: String(id) } : {}),
      },
    })
  const openRequests = (id: number) =>
    void navigate({
      to: '/app/$section',
      params: { section: 'service-requests' },
      search: { service: String(id) },
    })
  const openRequestDetail = (id: number) =>
    void navigate({
      to: '/app/$section',
      params: { section: 'service-requests' },
      search: { request: String(id) },
    })
  const openOrderDetail = (id: number) =>
    void navigate({
      to: '/app/$section',
      params: { section: 'service-orders' },
      search: { order: String(id) },
    })

  if (!canServices) {
    return (
      <ModulePageStatus
        title="Survey / Engineering / Others"
        breadcrumb="Specialized Services / Operations"
      >
        <ErrorState
          title="Service Catalogue access not granted"
          description="You do not have permission to list Services required by this workspace."
        />
      </ModulePageStatus>
    )
  }

  if (allQ.isPending) return <SectionLoadingState section="survey-engineering-others" />
  if (allQ.isError) {
    const e = presentError(allQ.error, 'page-load')
    return (
      <ModulePageStatus
        title="Survey / Engineering / Others"
        breadcrumb="Specialized Services / Operations"
      >
        <ErrorState title={e.title} description={e.message} onRetry={() => void allQ.refetch()} />
      </ModulePageStatus>
    )
  }

  return (
    <ModulePageFrame
      header={
        <CompactPageToolbar
          title="Survey / Engineering / Others"
          breadcrumb="Specialized Services / Operations"
          secondaryAction={
            <CompactActionButton
              disabled={!canCreateRequest}
              locked={!canCreateRequest}
              onClick={() =>
                void navigate({
                  to: '/app/$section',
                  params: { section: 'service-requests' },
                  search: {
                    create: 'request',
                    ...(serviceId ? { service: String(serviceId) } : {}),
                  },
                })
              }
            >
              <IconFilePlus size={14} />
              New Request
            </CompactActionButton>
          }
          primaryAction={
            <CompactActionButton
              tone="primary"
              disabled={!canServices}
              locked={!canServices}
              onClick={() =>
                void navigate({ to: '/app/$section', params: { section: 'service-catalogue' } })
              }
            >
              <IconPlus size={14} />
              Create Service
            </CompactActionButton>
          }
        />
      }
    >
      <main className="specialized-content">
        {calculatorServices.length ? (
          <section className="specialized-kpi-grid specialized-kpi-grid--top">
            {[
              ['Active Services', activeServices],
              ['Configured Workflows', workflows],
              ['Branches Covered', branches],
              ['Average SLA', `${avgSla}d`],
            ].map(([l, v]) => (
              <article className="specialized-kpi-card specialized-kpi-card--nt" key={String(l)}>
                <div>{l}</div>
                <strong>{v}</strong>
              </article>
            ))}
          </section>
        ) : null}

        <section className="specialized-card specialized-operations-toolbar">
          <div className="specialized-filter-row specialized-filter-row--compact">
            <DropdownSelect
              compact
              label="Specialized domain"
              fieldClassName="specialized-field specialized-specialized-selector"
              options={
                availableDomains.length
                  ? [
                      { value: '', label: 'All calculator services' },
                      ...availableDomains.map((option) => ({
                        value: option.value,
                        label: option.label,
                      })),
                    ]
                  : [{ value: '', label: 'No calculator services' }]
              }
              value={specializedDomain}
              onChange={(value) => setContext(value)}
            />
            <DropdownSelect
              compact
              label="Service"
              fieldClassName="specialized-field specialized-specialized-selector"
              placeholder="All services"
              disabled={!calculatorServices.length}
              searchable
              options={[
                { value: '', label: 'All services' },
                ...services.map((service) => ({
                  value: String(service.id),
                  label: service.name,
                })),
              ]}
              value={
                services.some((service) => service.id === selected?.id) ? String(selected?.id) : ''
              }
              onChange={(value) =>
                setContext(specializedDomain, value || undefined, recordSearch.search ?? '')
              }
            />
            <span className="specialized-grow" />
            <div className="specialized-action-row">
              <CompactActionButton onClick={() => void refresh()}>
                <IconRefresh size={14} />
                Refresh
              </CompactActionButton>
              <CompactActionButton
                onClick={() =>
                  void navigate({
                    to: '/app/$section',
                    params: { section: 'service-catalogue' },
                    search: selected
                      ? {
                          search: selected.name,
                          ...(specializedDomain ? { specializedDomain } : {}),
                        }
                      : specializedDomain
                        ? { specializedDomain }
                        : {},
                  })
                }
              >
                <IconSettings size={14} />
                Open Catalogue
              </CompactActionButton>
            </div>
          </div>
        </section>

        {!calculatorServices.length ? (
          <EmptyState
            title="No calculator services configured"
            description="Active services with an attached calculator will appear here from the Service Catalogue."
          />
        ) : (
          <>
            <section className="specialized-card">
              <header className="specialized-card-header">
                <div>
                  <div className="specialized-card-title">Calculator Services</div>
                  <div className="specialized-card-subtitle">
                    Active survey, engineering, and other services with calculator-backed pricing
                  </div>
                </div>
                <span className="commercial-count">{services.length} services</span>
              </header>
              {services.length ? (
                <div className="specialized-calculator-grid">
                  {services.map((s) => (
                    <CalculatorServiceCard
                      key={s.id}
                      service={s}
                      selected={selected?.id === s.id}
                      canCreateRequest={canCreateRequest}
                      onViewDetails={() =>
                        setContext(specializedDomain, s.id, recordSearch.search ?? '')
                      }
                      onCreateRequest={() => openRequest(Number(s.id))}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No services match this filter"
                  description="Try another domain or clear the search and service filters."
                />
              )}
            </section>

            {detail ? (
              <CalculatorServiceDetailWorkspace
                detail={detail}
                requests={requestQ.data?.items ?? []}
                orders={orders}
                canRequests={canRequests}
                canOrders={canOrders}
                canCreateRequest={canCreateRequest}
                requestsLoading={requestQ.isPending}
                ordersLoading={orderQ.isPending}
                onClose={() => setContext(specializedDomain, undefined, recordSearch.search ?? '')}
                onCreateRequest={() => openRequest(Number(detail.id))}
                onOpenRequests={() => openRequests(Number(detail.id))}
                onOpenOrders={() =>
                  void navigate({
                    to: '/app/$section',
                    params: { section: 'service-orders' },
                    search: selected ? { search: selected.name } : {},
                  })
                }
                onOpenRequest={openRequestDetail}
                onOpenOrder={openOrderDetail}
              />
            ) : null}
          </>
        )}
      </main>
    </ModulePageFrame>
  )
}
