import { IconFilePlus, IconPlus, IconSearch } from '@tabler/icons-react'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/app/auth'
import { SectionLoadingState } from '@/app/loading/SectionLoadingState'
import { hasPermission, PERMISSIONS } from '@/app/permissions'
import { presentError } from '@/shared/errors'
import { formatCurrency } from '@/shared/lib/formatters'
import type { AppSectionSearch } from '@/routes/app/$section'
import { withOptionalSearchValue, withoutSearchKeys } from '@/shared/navigation/search-state'
import { ErrorState, useToast } from '@/shared/ui'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'
import { EmptyState } from '@/shared/ui/empty-state'
import {
  CompactActionButton,
  CompactPageToolbar,
  ModulePageFrame,
  ModulePageStatus,
} from '@/shared/ui/module-controls'

import { serviceRequestsApi } from '../api/service-requests.api'
import { serviceRequestKeys } from '../api/service-requests.keys'
import { serviceRequestQueries } from '../api/service-requests.queries'
import type {
  CreateDirectInvoiceInput,
  CreateServiceRequestActivityInput,
  CreateServiceRequestAttachmentInput,
  CreateServiceRequestInput,
  UpdateServiceRequestInput,
} from '../api/service-requests.types'
import type { SpecializedRequestHandoff } from '@/modules/specialized-services/request-plugins'
import { CreateServiceRequestLiveWorkspace } from '../workspaces/CreateServiceRequestLiveWorkspace'
import { ServiceRequestDetailWorkspace } from '../workspaces/ServiceRequestDetailWorkspace'
import { CommercialRegisterPagination } from '../components/CommercialRegisterPagination'
import { commercialDeadlineState, requestStatusClass } from '../commercial.ui'
import {
  CommercialRegisterHeader,
  CommercialSummaryGrid,
} from '../components/CommercialRegisterChrome'
import '../styles/commercial.css'

const REQUEST_SUMMARY_CARDS = [
  ['New / unreviewed', 'newCount'],
  ['Site assessment required', 'siteAssessment'],
  ['Awaiting client information', 'awaitingClient'],
  ['Total Requests', 'total'],
] as const

function withoutRequestSearch(previous: AppSectionSearch) {
  const next = { ...previous }
  delete next.request
  return next
}

function withoutCreateSearch(previous: AppSectionSearch) {
  const next = { ...previous }
  delete next.create
  delete next.estate
  delete next.property
  delete next.standaloneProperty
  delete next.brokerage
  return next
}

export function ServiceRequestsLivePage({ recordSearch }: { recordSearch: AppSectionSearch }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [manualCreateOpen, setManualCreateOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(recordSearch.search ?? '')
  const [syncedSearch, setSyncedSearch] = useState(recordSearch.search ?? '')

  const selectedRequestId = recordSearch.request ? Number(recordSearch.request) : null
  const page = recordSearch.page ?? 1

  const filters = useMemo(
    () => ({
      ...(recordSearch.search ? { search: recordSearch.search } : {}),
      ...(recordSearch.status ? { status: recordSearch.status } : {}),
      ...(recordSearch.priority ? { priority: recordSearch.priority } : {}),
      ...(recordSearch.branch ? { branchId: Number(recordSearch.branch) } : {}),
      ...(recordSearch.service ? { serviceId: Number(recordSearch.service) } : {}),
      page,
      limit: 10,
    }),
    [
      page,
      recordSearch.branch,
      recordSearch.priority,
      recordSearch.search,
      recordSearch.service,
      recordSearch.status,
    ],
  )

  const listQuery = useQuery(serviceRequestQueries.list(filters))
  const summaryQuery = useQuery(serviceRequestQueries.summary())
  const choicesQuery = useQuery(serviceRequestQueries.choices())
  const clientsQuery = useQuery(serviceRequestQueries.clients())
  const servicesQuery = useQuery(serviceRequestQueries.services())
  const directServiceId = recordSearch.service ? Number(recordSearch.service) : 0
  const directServiceAlreadyLoaded = Boolean(
    directServiceId && servicesQuery.data?.some((service) => service.id === directServiceId),
  )
  const directServiceQuery = useQuery({
    ...serviceRequestQueries.service(directServiceId),
    enabled: Boolean(directServiceId) && servicesQuery.isSuccess && !directServiceAlreadyLoaded,
  })
  const services = useMemo(() => {
    const items = servicesQuery.data ?? []
    if (!directServiceQuery.data || items.some((service) => service.id === directServiceId)) {
      return items
    }
    return [...items, directServiceQuery.data]
  }, [directServiceId, directServiceQuery.data, servicesQuery.data])

  const employeesQuery = useQuery({
    ...serviceRequestQueries.employees(),
    enabled: hasPermission(user, PERMISSIONS.employeesList),
  })

  const detailQuery = useQuery({
    ...serviceRequestQueries.detail(selectedRequestId ?? 0),
    enabled: Boolean(selectedRequestId) && hasPermission(user, PERMISSIONS.serviceRequestsView),
  })
  const [estimateError, setEstimateError] = useState<{ requestId: number; message: string } | null>(
    null,
  )
  const detail = detailQuery.data
  const detailIsCalculator =
    detail?.pricingMode === 'calculator' && detail.calculatorCode.trim() !== ''

  const categoriesQuery = useQuery(
    queryOptions({
      queryKey: [...serviceRequestKeys.detail(detail?.id ?? 0), 'engineering-categories'],
      queryFn: () => serviceRequestsApi.engineeringCategories(),
      enabled:
        detailIsCalculator &&
        (detail?.calculatorCode === 'ARCHITECTURAL-DRAWING' ||
          detail?.calculatorCode === 'BUILDING-CONSTRUCTION'),
      staleTime: 300_000,
    }),
  )
  const unitPriceQuery = useQuery(
    queryOptions({
      queryKey: [...serviceRequestKeys.detail(detail?.id ?? 0), 'restablishment-unit-price'],
      queryFn: () => serviceRequestsApi.restablishmentUnitPrice(),
      enabled: detailIsCalculator && detail?.calculatorCode === 'RESTABLISHMENT-SURVEY',
      staleTime: 300_000,
    }),
  )

  const invalidate = async (requestId?: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.summary() }),
      ...(requestId
        ? [
            queryClient.invalidateQueries({
              queryKey: serviceRequestKeys.detail(requestId),
            }),
          ]
        : []),
    ])
  }

  const createMutation = useMutation({
    mutationFn: async ({
      input,
      attachments,
    }: {
      input: CreateServiceRequestInput
      attachments: CreateServiceRequestAttachmentInput[]
    }) => {
      const request = await serviceRequestsApi.create(input)
      const attachmentFailures: CreateServiceRequestAttachmentInput[] = []

      for (const attachment of attachments) {
        try {
          await serviceRequestsApi.addAttachment(request.id, attachment)
        } catch {
          attachmentFailures.push(attachment)
        }
      }

      return { request, attachmentFailures }
    },
    onSuccess: async ({ request, attachmentFailures }) => {
      await invalidate(request.id)
      setManualCreateOpen(false)
      toast.success(`Request ${request.requestNumber} created`)
      if (attachmentFailures.length > 0) {
        toast.warning('Some documents could not be attached', {
          description: 'Open the request to retry the failed documents.',
        })
      }
      await navigate({
        to: '/app/$section',
        params: { section: 'service-requests' },
        search: (previous) => ({
          ...withoutCreateSearch(previous),
          request: String(request.id),
        }),
      })
    },
    onError: (error) => {
      const presented = presentError(error, 'form-submit')
      toast.error('Service Request could not be created', {
        description: presented.message,
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ requestId, input }: { requestId: number; input: UpdateServiceRequestInput }) =>
      serviceRequestsApi.update(requestId, input),
    onSuccess: async (request) => {
      await invalidate(request.id)
      toast.success('Service Request updated')
    },
    onError: (error) => {
      toast.error('Service Request could not be updated', {
        description: presentError(error, 'background-action').message,
      })
    },
  })

  const invoiceMutation = useMutation({
    mutationFn: async ({
      requestId,
      input,
    }: {
      requestId: number
      input: CreateDirectInvoiceInput
    }) => {
      // Persist the billing draft first so issue reads the latest figures.
      await serviceRequestsApi.update(requestId, {
        directExtraCharges: input.billing.extraCharges.map((charge, index) => ({
          description: charge.description,
          quantity: charge.quantity ?? 1,
          unitPrice: charge.unitPrice,
          paymentTiming: charge.paymentTiming ?? 'upfront',
          sourceContext: {},
          sortOrder: index * 10,
        })),
        directDiscount: input.billing.discount,
        directTaxRate: input.billing.taxRate,
        directThreshold: input.billing.threshold,
      })
      return serviceRequestsApi.createInvoiceFromRequest(requestId, {
        dueDate: input.dueDate,
        paymentInstructions: input.paymentInstructions,
      })
    },
    onSuccess: async (invoice) => {
      await invalidate(detailQuery.data?.id ?? 0)
      toast.success(`Invoice ${invoice.invoiceNumber} created`)
      await navigate({
        to: '/app/$section',
        params: { section: 'invoices-payments' },
        search: { invoice: String(invoice.id) },
      })
    },
    onError: (error) => {
      toast.error('Invoice could not be created', {
        description: presentError(error, 'form-submit').message,
      })
    },
  })

  const activityMutation = useMutation({
    mutationFn: ({
      requestId,
      input,
    }: {
      requestId: number
      input: CreateServiceRequestActivityInput
    }) => serviceRequestsApi.addActivity(requestId, input),
    onSuccess: async (_, variables) => {
      await invalidate(variables.requestId)
      toast.success('Activity recorded')
    },
    onError: (error) => {
      toast.error('Activity could not be recorded', {
        description: presentError(error, 'background-action').message,
      })
    },
  })

  const estimateMutation = useMutation({
    mutationFn: async ({
      requestId,
      serviceId,
      calculatorCode,
      inputs,
    }: {
      requestId: number
      serviceId: number
      calculatorCode: string
      inputs: Record<string, unknown>
    }) => {
      const textInput = (value: unknown) => (typeof value === 'string' ? value : '')
      const total =
        calculatorCode === 'BOUNDARY-SURVEY'
          ? (
              await serviceRequestsApi.estimateBoundary(serviceId, {
                area: Number(inputs.area ?? 0),
                unit: inputs.unit === 'ha' ? 'ha' : 'sqm',
                customer_type: inputs.customer_type === 'corporate' ? 'corporate' : 'individual',
                boundary_registration: Boolean(inputs.boundary_registration ?? true),
                plots: Math.max(1, Math.floor(Number(inputs.plots ?? 1))),
                single_plan: typeof inputs.single_plan === 'boolean' ? inputs.single_plan : null,
                state: textInput(inputs.state),
                lga: textInput(inputs.lga),
                country: textInput(inputs.country),
              })
            ).total
          : calculatorCode === 'RESTABLISHMENT-SURVEY'
            ? (
                await serviceRequestsApi.estimateRestablishment(serviceId, {
                  number_of_beacons: Math.max(1, Math.floor(Number(inputs.number_of_beacons ?? 0))),
                })
              ).total
            : (
                await serviceRequestsApi.estimateEngineering(serviceId, {
                  category_name: textInput(inputs.category_name),
                  number_of_bedrooms: Math.max(
                    0,
                    Math.floor(Number(inputs.number_of_bedrooms ?? 0)),
                  ),
                  number_of_floors: Math.max(0, Math.floor(Number(inputs.number_of_floors ?? 0))),
                  ...(inputs.area_sqm != null && inputs.area_sqm !== ''
                    ? { area_sqm: Number(inputs.area_sqm) }
                    : {}),
                  ...(inputs.timeline_days != null && inputs.timeline_days !== ''
                    ? { timeline_days: Math.floor(Number(inputs.timeline_days)) }
                    : {}),
                })
              ).total
      return serviceRequestsApi.update(requestId, {
        calculatorInputs: inputs,
        estimatedValue: total,
      })
    },
    onSuccess: async (request) => {
      setEstimateError(null)
      await invalidate(request.id)
      toast.success(`Estimate updated: ${request.requestNumber}`)
    },
    onError: (error, variables) => {
      const message = presentError(error, 'form-submit').message
      setEstimateError({ requestId: variables.requestId, message })
      toast.error('Estimate could not be computed', { description: message })
    },
  })

  const attachmentMutation = useMutation({
    mutationFn: ({
      requestId,
      input,
    }: {
      requestId: number
      input: CreateServiceRequestAttachmentInput
    }) => serviceRequestsApi.addAttachment(requestId, input),
    onSuccess: async (_, variables) => {
      await invalidate(variables.requestId)
      toast.success('Attachment added')
    },
    onError: (error) => {
      toast.error('Attachment could not be added', {
        description: presentError(error, 'background-action').message,
      })
    },
  })

  const setSearch = useCallback(
    (patch: Partial<AppSectionSearch>) => {
      void navigate({
        to: '/app/$section',
        params: { section: 'service-requests' },
        search: (previous) => ({
          ...withoutSearchKeys(previous, Object.keys(patch) as Array<keyof AppSectionSearch>),
          ...patch,
          page:
            patch.page ??
            (Object.keys(patch).some((key) => key !== 'page') ? 1 : (previous.page ?? 1)),
        }),
        replace: true,
      })
    },
    [navigate],
  )

  const setSearchValue = useCallback(
    function <Key extends keyof AppSectionSearch>(
      key: Key,
      value: AppSectionSearch[Key] | '' | null,
    ) {
      void navigate({
        to: '/app/$section',
        params: { section: 'service-requests' },
        search: (previous) => ({
          ...withoutSearchKeys(previous, [key]),
          ...withOptionalSearchValue<AppSectionSearch, Key>(key, value),
          page: 1,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  const clearFilters = useCallback(() => {
    setSearchDraft('')
    void navigate({
      to: '/app/$section',
      params: { section: 'service-requests' },
      search: (previous) =>
        withoutSearchKeys(previous, ['search', 'status', 'priority', 'branch', 'service', 'page']),
      replace: true,
    })
  }, [navigate])

  if ((recordSearch.search ?? '') !== syncedSearch) {
    setSyncedSearch(recordSearch.search ?? '')
    setSearchDraft(recordSearch.search ?? '')
  }

  useEffect(() => {
    if (searchDraft === (recordSearch.search ?? '')) return
    const timeoutId = window.setTimeout(() => {
      setSearchValue('search', searchDraft)
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [recordSearch.search, searchDraft, setSearchValue])

  const createOpen = manualCreateOpen || recordSearch.create === 'request'

  if (
    listQuery.isPending ||
    choicesQuery.isPending ||
    clientsQuery.isPending ||
    servicesQuery.isPending ||
    (Boolean(directServiceId) && !directServiceAlreadyLoaded && directServiceQuery.isPending)
  ) {
    return <SectionLoadingState section="service-requests" />
  }

  if (
    listQuery.isError ||
    choicesQuery.isError ||
    clientsQuery.isError ||
    servicesQuery.isError ||
    directServiceQuery.isError
  ) {
    const error =
      listQuery.error ??
      choicesQuery.error ??
      clientsQuery.error ??
      servicesQuery.error ??
      directServiceQuery.error
    const presented = presentError(error, 'page-load')

    return (
      <ModulePageStatus title="Service Requests" breadcrumb="Commercial flow / Requests">
        <ErrorState
          title={presented.title}
          description={presented.message}
          onRetry={() => {
            void listQuery.refetch()
            void choicesQuery.refetch()
            void clientsQuery.refetch()
            void servicesQuery.refetch()
            if (directServiceId && !directServiceAlreadyLoaded) {
              void directServiceQuery.refetch()
            }
          }}
        />
      </ModulePageStatus>
    )
  }

  const requests = listQuery.data.items
  const choices = choicesQuery.data
  const hasActiveFilters =
    Boolean(recordSearch.search) ||
    Boolean(recordSearch.status) ||
    Boolean(recordSearch.priority) ||
    Boolean(recordSearch.branch) ||
    Boolean(recordSearch.service)
  const totalPages = Math.max(1, Math.ceil(listQuery.data.count / 10))
  const recordCountLabel = `${listQuery.data.count} ${listQuery.data.count === 1 ? 'request' : 'requests'}`
  const branches = Array.from(
    new Map(
      services.flatMap((service) =>
        service.activeBranches.map((branch) => [branch.id, branch] as const),
      ),
    ).values(),
  )
  const statusFilterOptions = [
    { value: '', label: 'All statuses' },
    ...mapDropdownOptions(choices.statuses),
  ]
  const priorityFilterOptions = [
    { value: '', label: 'All priorities' },
    ...mapDropdownOptions(choices.priorities),
  ]
  const branchFilterOptions = [
    { value: '', label: 'All branches' },
    ...branches.map((branch) => ({ value: String(branch.id), label: branch.name })),
  ]
  const serviceFilterOptions = [
    { value: '', label: 'All services' },
    ...services.map((service) => ({ value: String(service.id), label: service.name })),
  ]

  return (
    <ModulePageFrame
      header={
        <CompactPageToolbar
          title="Service Requests"
          breadcrumb="Commercial flow / Requests"
          secondaryAction={
            <CompactActionButton
              disabled={!hasPermission(user, PERMISSIONS.serviceRequestsCreate)}
              locked={!hasPermission(user, PERMISSIONS.serviceRequestsCreate)}
              onClick={() => setManualCreateOpen(true)}
            >
              <IconFilePlus size={14} />
              New Request
            </CompactActionButton>
          }
          primaryAction={
            <CompactActionButton
              tone="primary"
              onClick={() =>
                void navigate({
                  to: '/app/$section',
                  params: { section: 'service-catalogue' },
                })
              }
            >
              <IconPlus size={14} />
              Create Service
            </CompactActionButton>
          }
        />
      }
    >
      <main className="commercial-content">
        <CommercialSummaryGrid
          ariaLabel="Request summary"
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
          errorNote="The request register is still available."
          items={
            summaryQuery.data
              ? REQUEST_SUMMARY_CARDS.map(([label, key]) => ({
                  label,
                  value: summaryQuery.data[key],
                }))
              : []
          }
        />

        <section className="commercial-card">
          <CommercialRegisterHeader
            title="Service Request Register"
            description="Live commercial requests across your current workspace"
            countLabel={recordCountLabel}
            refreshing={listQuery.isFetching}
            action={
              <CompactActionButton
                tone="primary"
                disabled={!hasPermission(user, PERMISSIONS.serviceRequestsCreate)}
                locked={!hasPermission(user, PERMISSIONS.serviceRequestsCreate)}
                onClick={() => setManualCreateOpen(true)}
              >
                <IconFilePlus size={14} />
                New Request
              </CompactActionButton>
            }
          />

          <div className="commercial-filters">
            <label className="commercial-search">
              <IconSearch size={14} aria-hidden="true" />
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  if (searchDraft === (recordSearch.search ?? '')) return
                  setSearchValue('search', searchDraft)
                }}
                placeholder="Search request, client, service or contact"
              />
            </label>

            <DropdownSelect
              compact
              placeholder="All statuses"
              options={statusFilterOptions}
              value={recordSearch.status ?? ''}
              onChange={(value) => setSearchValue('status', value)}
            />

            <DropdownSelect
              compact
              placeholder="All priorities"
              options={priorityFilterOptions}
              value={recordSearch.priority ?? ''}
              onChange={(value) => setSearchValue('priority', value)}
            />

            <DropdownSelect
              compact
              placeholder="All branches"
              options={branchFilterOptions}
              value={recordSearch.branch ?? ''}
              onChange={(value) => setSearchValue('branch', value)}
            />

            <DropdownSelect
              compact
              className="ui-dropdown--service-filter"
              placeholder="All services"
              options={serviceFilterOptions}
              value={recordSearch.service ?? ''}
              onChange={(value) => setSearchValue('service', value)}
            />
          </div>

          {requests.length === 0 ? (
            <EmptyState
              title={
                hasActiveFilters
                  ? 'No service requests match the current filters'
                  : 'No service requests yet'
              }
              description={
                hasActiveFilters
                  ? 'Try adjusting or clearing the search and filter settings to bring matching requests back into view.'
                  : 'Service requests will appear here after the first request is created.'
              }
              action={
                hasActiveFilters ? (
                  <button type="button" className="commercial-btn" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="commercial-table-wrap">
              <table className="commercial-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Client</th>
                    <th>Service</th>
                    <th>Source</th>
                    <th>Estimate</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Next</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => {
                    const deadline = commercialDeadlineState(request.dueDate, request.status)
                    const rowClass =
                      deadline.tone === 'danger'
                        ? 'commercial-table-row--danger'
                        : deadline.tone === 'warning'
                          ? 'commercial-table-row--warning'
                          : ''

                    return (
                      <tr key={request.id} className={rowClass}>
                        <td>
                          <b>{request.requestNumber}</b>
                          <small>
                            {new Date(request.createdAt).toLocaleDateString('en-GB')} ·{' '}
                            {request.branchName || 'No branch'}
                          </small>
                        </td>
                        <td>
                          <b>{request.clientName}</b>
                          <small>{request.customerType}</small>
                        </td>
                        <td>
                          <b>{request.serviceName}</b>
                          <small>{request.branchName || 'No branch'}</small>
                        </td>
                        <td>{request.source}</td>
                        <td>
                          <b>{formatCurrency(request.estimatedValue || request.budget || 0)}</b>
                        </td>
                        <td>
                          <span className={`commercial-pill ${requestStatusClass(request.status)}`}>
                            {request.statusDisplay}
                          </span>
                        </td>
                        <td>{request.ownerName || 'Unassigned'}</td>
                        <td>
                          <span
                            className="commercial-table-truncate commercial-table-truncate--next"
                            title={request.nextAction || '-'}
                          >
                            {request.nextAction || '-'}
                          </span>
                          {deadline.label ? <small>{deadline.label}</small> : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="commercial-btn commercial-btn-small"
                            disabled={!hasPermission(user, PERMISSIONS.serviceRequestsView)}
                            onClick={() =>
                              void navigate({
                                to: '/app/$section',
                                params: { section: 'service-requests' },
                                search: (previous) => ({
                                  ...previous,
                                  request: String(request.id),
                                }),
                              })
                            }
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <CommercialRegisterPagination
            countLabel={recordCountLabel}
            page={page}
            totalPages={totalPages}
            onPageChange={(nextPage) => setSearch({ page: nextPage })}
          />
        </section>
      </main>

      {createOpen ? (
        <CreateServiceRequestLiveWorkspace
          clients={clientsQuery.data}
          services={services}
          choices={choices}
          saving={createMutation.isPending}
          initialServiceId={recordSearch.service ? Number(recordSearch.service) : 0}
          initialSpecializedContext={
            recordSearch.property
              ? {
                  sourceMode: 'estate',
                  estateId: recordSearch.estate ? Number(recordSearch.estate) : 0,
                  selectedId: Number(recordSearch.property),
                  settlementMode: 'full_payment',
                  agreedPrice: null,
                }
              : recordSearch.standaloneProperty
                ? {
                    sourceMode: 'standalone',
                    estateId: 0,
                    selectedId: Number(recordSearch.standaloneProperty),
                    settlementMode: 'full_payment',
                    agreedPrice: null,
                  }
                : recordSearch.brokerage
                  ? {
                      sourceMode: 'brokerage',
                      estateId: 0,
                      selectedId: Number(recordSearch.brokerage),
                      settlementMode: 'full_payment',
                      agreedPrice: null,
                    }
                  : null
          }
          onClose={() => {
            setManualCreateOpen(false)
            if (recordSearch.create !== 'request') return
            void navigate({
              to: '/app/$section',
              params: { section: 'service-requests' },
              search: (previous) => withoutCreateSearch(previous),
              replace: true,
            })
          }}
          onSubmit={(input, attachments) => createMutation.mutateAsync({ input, attachments })}
          onContinueSpecialized={(handoff: SpecializedRequestHandoff, createdRequest) => {
            setManualCreateOpen(false)
            void navigate({
              to: '/app/$section',
              params: { section: createdRequest ? 'quotations' : handoff.navigation.section },
              search: (previous) => ({
                ...withoutCreateSearch(withoutRequestSearch(previous)),
                ...(createdRequest
                  ? { request: String(createdRequest.id) }
                  : handoff.navigation.search),
              }),
            })
          }}
        />
      ) : null}

      {selectedRequestId && detailQuery.isPending ? (
        <div className="commercial-modal-backdrop">
          <section className="commercial-modal">
            <div className="commercial-empty">Loading Request 360...</div>
          </section>
        </div>
      ) : null}

      {selectedRequestId && detailQuery.isError ? (
        <div className="commercial-modal-backdrop">
          <section className="commercial-modal">
            <EmptyState
              title="Request could not be opened"
              description={presentError(detailQuery.error, 'section-load').message}
            />
            <footer className="commercial-modal-footer">
              <button
                type="button"
                className="commercial-btn"
                onClick={() =>
                  void navigate({
                    to: '/app/$section',
                    params: { section: 'service-requests' },
                    search: (previous) => withoutRequestSearch(previous),
                  })
                }
              >
                Close
              </button>
              <button
                type="button"
                className="commercial-btn commercial-btn-primary"
                onClick={() => void detailQuery.refetch()}
              >
                Retry
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {detailQuery.data ? (
        <ServiceRequestDetailWorkspace
          request={detailQuery.data}
          choices={choices}
          employees={employeesQuery.data ?? []}
          saving={updateMutation.isPending || invoiceMutation.isPending}
          activitySaving={activityMutation.isPending}
          attachmentSaving={attachmentMutation.isPending}
          estimating={estimateMutation.isPending}
          estimateError={
            estimateError && estimateError.requestId === detailQuery.data.id
              ? estimateError.message
              : ''
          }
          categories={categoriesQuery.data ?? []}
          categoriesLoading={Boolean(categoriesQuery.isPending)}
          unitPrice={unitPriceQuery.data ?? null}
          onClose={() =>
            void navigate({
              to: '/app/$section',
              params: { section: 'service-requests' },
              search: (previous) => withoutRequestSearch(previous),
            })
          }
          onUpdate={(input) =>
            updateMutation.mutate({
              requestId: detailQuery.data.id,
              input,
            })
          }
          onActivity={(input) =>
            activityMutation.mutate({
              requestId: detailQuery.data.id,
              input,
            })
          }
          onAttachment={(input) =>
            attachmentMutation.mutate({
              requestId: detailQuery.data.id,
              input,
            })
          }
          onPrepareQuotation={() =>
            void navigate({
              to: '/app/$section',
              params: { section: 'quotations' },
              search: { request: String(detailQuery.data.id) },
            })
          }
          onCreateInvoice={(input) =>
            invoiceMutation.mutate({
              requestId: detailQuery.data.id,
              input,
            })
          }
          onEstimate={async (inputs) => {
            setEstimateError(null)
            await estimateMutation.mutateAsync({
              requestId: detailQuery.data.id,
              serviceId: detailQuery.data.serviceId,
              calculatorCode: detailQuery.data.calculatorCode,
              inputs,
            })
          }}
        />
      ) : null}
    </ModulePageFrame>
  )
}
