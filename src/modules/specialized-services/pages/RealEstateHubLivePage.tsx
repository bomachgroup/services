import {
  IconBuilding,
  IconEdit,
  IconExternalLink,
  IconFilePlus,
  IconHome,
  IconMap2,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/app/auth'
import { SectionLoadingState } from '@/app/loading/SectionLoadingState'
import { canPerformAction, hasPermission, PERMISSIONS } from '@/app/permissions'
import type { AppSectionSearch } from '@/routes/app/$section'
import { presentError } from '@/shared/errors'
import { formatCurrency } from '@/shared/lib/formatters'
import { withOptionalSearchValue, withoutSearchKeys } from '@/shared/navigation/search-state'
import { ErrorState, useToast } from '@/shared/ui'
import { EmptyState } from '@/shared/ui/empty-state'
import {
  CompactActionButton,
  CompactPageToolbar,
  ModulePageFrame,
} from '@/shared/ui/module-controls'

import { realEstateApi } from '../real-estate/real-estate.api'
import { realEstateKeys } from '../real-estate/real-estate.keys'
import { realEstateQueries } from '../real-estate/real-estate.queries'
import {
  type BrokerageListing,
  type BrokerageVerificationStatus,
  type CreateBrokerageInput,
  type CreateEstateInput,
  type CreatePropertyInput,
  type Estate,
  type Property,
  type PropertyStatus,
} from '../real-estate/real-estate.types'

import '../../commercial/styles/commercial.css'
import '../styles/specialized-services.css'

const CreateBrokerageLiveWorkspace = lazy(() =>
  import('../workspaces/CreateBrokerageLiveWorkspace').then((module) => ({
    default: module.CreateBrokerageLiveWorkspace,
  })),
)

const CreateEstateLiveWorkspace = lazy(() =>
  import('../workspaces/CreateEstateLiveWorkspace').then((module) => ({
    default: module.CreateEstateLiveWorkspace,
  })),
)

const CreatePropertyLiveWorkspace = lazy(() =>
  import('../workspaces/CreatePropertyLiveWorkspace').then((module) => ({
    default: module.CreatePropertyLiveWorkspace,
  })),
)

const EditPropertyLiveWorkspace = lazy(() =>
  import('../workspaces/EditPropertyLiveWorkspace').then((module) => ({
    default: module.EditPropertyLiveWorkspace,
  })),
)

function RealEstateWorkspaceFallback() {
  return (
    <div className="commercial-modal-backdrop" role="presentation">
      <section
        className="commercial-modal specialized-real-estate-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Loading workspace"
      >
        <div className="commercial-modal-body">
          <div className="commercial-notice">Loading workspace…</div>
        </div>
      </section>
    </div>
  )
}

function statusClass(status: PropertyStatus) {
  if (status === 'available') return 'av'
  if (status === 'reserved') return 'rs'
  if (status === 'sold') return 'sd'
  return 'hd'
}

function TypeIcon({ property }: { property: Property }) {
  if (property.propertyType === 'plot') return <IconMap2 size={15} />
  if (property.propertyType === 'residential') return <IconHome size={15} />
  return <IconBuilding size={15} />
}

function statusLabel(status: PropertyStatus, display?: string) {
  return display || status.replaceAll('_', ' ')
}

function verificationClass(status: string) {
  if (status === 'verified') return 'verified'
  if (status === 'rejected') return 'rejected'
  return 'pending'
}

function EstateTypeIcon({ estate }: { estate: Estate }) {
  if (estate.estateType === 'land') return <IconMap2 size={18} />
  if (estate.estateType === 'commercial' || estate.estateType === 'industrial')
    return <IconBuilding size={18} />
  return <IconHome size={18} />
}

function EstateCard({
  estate,
  canEdit,
  onOpen,
  onEdit,
}: {
  estate: Estate
  canEdit: boolean
  onOpen: () => void
  onEdit: () => void
}) {
  return (
    <article className={`specialized-estate-card specialized-estate-card--${estate.estateStatus}`}>
      <div className="specialized-estate-card-accent" aria-hidden="true" />
      <div className="specialized-estate-card-main">
        <div className="specialized-estate-card-header-row">
          <div className="specialized-estate-card-icon">
            <EstateTypeIcon estate={estate} />
          </div>
          <div className="specialized-estate-card-heading">
            <div className="specialized-estate-card-top">
              <span className="specialized-estate-card-code">{estate.estateCode}</span>
              <span className={`specialized-pill specialized-pill--estate-${estate.estateStatus}`}>
                {estate.estateStatusDisplay || estate.estateStatus.replaceAll('_', ' ')}
              </span>
            </div>
            <h3 className="specialized-estate-card-name">{estate.estateName}</h3>
          </div>
        </div>
        <p className="specialized-estate-card-meta">
          {estate.cityTown}, {estate.state}
        </p>
        <div className="specialized-estate-card-stats">
          <div>
            <span>Type</span>
            <strong>{estate.estateTypeDisplay || estate.estateType}</strong>
          </div>
          <div>
            <span>Ownership</span>
            <strong>{estate.isOurEstate ? 'Our estate' : 'Partner'}</strong>
          </div>
          {estate.pricePerSqm ? (
            <div>
              <span>Price / sqm</span>
              <strong>{formatCurrency(estate.pricePerSqm)}</strong>
            </div>
          ) : null}
        </div>
      </div>
      <div className="specialized-estate-card-actions">
        <button
          type="button"
          className="specialized-btn specialized-btn-small specialized-btn-primary"
          onClick={onOpen}
        >
          <IconExternalLink size={13} />
          Open
        </button>
        {canEdit ? (
          <button type="button" className="specialized-btn specialized-btn-small" onClick={onEdit}>
            <IconEdit size={13} />
            Edit
          </button>
        ) : null}
      </div>
    </article>
  )
}

function PropertyTypeBadge({ property }: { property: Property }) {
  return (
    <span className="specialized-inventory-type">
      <TypeIcon property={property} />
      {property.propertyTypeDisplay || property.propertyType}
    </span>
  )
}

function BrokerageTableRow({
  listing,
  highlighted,
  canVerify,
  canDelete,
  onVerify,
  onDelete,
}: {
  listing: BrokerageListing
  highlighted: boolean
  canVerify: boolean
  canDelete: boolean
  onVerify: () => void
  onDelete: () => void
}) {
  return (
    <tr
      id={highlighted ? `brokerage-row-${listing.id}` : undefined}
      className={highlighted ? 'is-highlighted' : undefined}
    >
      <td>
        <div className="specialized-inventory-name">
          <span className="specialized-inventory-name-text">{listing.title}</span>
        </div>
        <div className="specialized-inventory-sub">{listing.propertyType}</div>
      </td>
      <td className="specialized-hub-cell-truncate">{listing.location}</td>
      <td className="specialized-hub-cell-nowrap">{formatCurrency(listing.price)}</td>
      <td>
        <span
          className={`specialized-pill specialized-pill--verification-${verificationClass(listing.verificationStatus)}`}
        >
          {listing.verificationStatus.replaceAll('_', ' ')}
        </span>
      </td>
      <td className="specialized-hub-cell-actions">
        <div className="specialized-inline-actions">
          {canVerify && listing.verificationStatus !== 'verified' ? (
            <button
              type="button"
              className="specialized-btn specialized-btn-small"
              onClick={onVerify}
            >
              Verify
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="specialized-btn specialized-btn-small"
              onClick={onDelete}
            >
              Delete
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

export function RealEstateHubLivePage({ recordSearch }: { recordSearch: AppSectionSearch }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [searchDraft, setSearchDraft] = useState(recordSearch.search ?? '')
  const [syncedSearch, setSyncedSearch] = useState(recordSearch.search ?? '')
  const [estateOpen, setEstateOpen] = useState(false)
  const [editingEstate, setEditingEstate] = useState<Estate | null>(null)
  const [propertyOpen, setPropertyOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [brokerageOpen, setBrokerageOpen] = useState(false)

  const canEstateList = hasPermission(user, PERMISSIONS.estatesList)
  const canEstateCreate = hasPermission(user, PERMISSIONS.estatesCreate)
  const canEstateUpdate = hasPermission(user, PERMISSIONS.estatesUpdate)
  const canPropertyList = hasPermission(user, PERMISSIONS.propertiesList)
  const canPropertyCreate = hasPermission(user, PERMISSIONS.propertiesCreate)
  const canPropertyUpdate = hasPermission(user, PERMISSIONS.propertiesUpdate)
  const canBrokerageList = hasPermission(user, PERMISSIONS.brokerageList)
  const canBrokerageCreate = hasPermission(user, PERMISSIONS.brokerageCreate)
  const canBrokerageUpdate = hasPermission(user, PERMISSIONS.brokerageUpdate)
  const canBrokerageDelete = hasPermission(user, PERMISSIONS.brokerageDelete)
  const canCreateServiceRequest = canPerformAction(user, 'requestCreate')
  const canCreateService = canPerformAction(user, 'serviceCreate')

  const estatesQuery = useQuery({
    ...realEstateQueries.estates({
      ...(recordSearch.search ? { search: recordSearch.search } : {}),
      page: 1,
      limit: 100,
    }),
    enabled: canEstateList,
  })
  const standaloneQuery = useQuery({
    ...realEstateQueries.standaloneProperties({ page: 1, limit: 100 }),
    enabled: canPropertyList,
  })
  const brokerageQuery = useQuery({
    ...realEstateQueries.brokerage({ page: 1, limit: 100 }),
    enabled: canBrokerageList,
  })
  const brokerageStatsQuery = useQuery({
    ...realEstateQueries.brokerageStats(),
    enabled: canBrokerageList,
  })

  const estates = useMemo(() => estatesQuery.data?.items ?? [], [estatesQuery.data?.items])
  const standaloneProperties = useMemo(
    () => standaloneQuery.data?.items ?? [],
    [standaloneQuery.data?.items],
  )
  const unlinkedBrokerage = useMemo(
    () => (brokerageQuery.data?.items ?? []).filter((listing) => listing.estateId == null),
    [brokerageQuery.data?.items],
  )

  const highlightedBrokerageId = recordSearch.brokerage ? Number(recordSearch.brokerage) : null

  const setSearchValue = useCallback(
    function <Key extends keyof AppSectionSearch>(
      key: Key,
      value: AppSectionSearch[Key] | '' | null,
    ) {
      void navigate({
        to: '/app/$section',
        params: { section: 'real-estate-inventory' },
        search: (previous) => ({
          ...withoutSearchKeys(previous, [key]),
          ...withOptionalSearchValue<AppSectionSearch, Key>(key, value),
        }),
        replace: true,
      })
    },
    [navigate],
  )

  const openEstate = useCallback(
    (id: number) => {
      void navigate({
        to: '/app/$section',
        params: { section: 'real-estate-inventory' },
        search: (previous) => ({
          ...withoutSearchKeys(previous, ['property']),
          estate: String(id),
        }),
      })
    },
    [navigate],
  )

  if ((recordSearch.search ?? '') !== syncedSearch) {
    setSyncedSearch(recordSearch.search ?? '')
    setSearchDraft(recordSearch.search ?? '')
  }
  useEffect(() => {
    if (searchDraft === (recordSearch.search ?? '')) return
    const id = window.setTimeout(() => setSearchValue('search', searchDraft), 350)
    return () => clearTimeout(id)
  }, [recordSearch.search, searchDraft, setSearchValue])

  const deepLinkedStandaloneProperty = useMemo(() => {
    if (!recordSearch.standaloneProperty || !standaloneProperties.length) return null
    const propertyId = Number(recordSearch.standaloneProperty)
    if (!Number.isFinite(propertyId)) return null
    return standaloneProperties.find((item) => item.id === propertyId) ?? null
  }, [recordSearch.standaloneProperty, standaloneProperties])

  const activeEditingProperty = editingProperty ?? deepLinkedStandaloneProperty
  useEffect(() => {
    if (!highlightedBrokerageId || !unlinkedBrokerage.length) return
    document
      .getElementById(`brokerage-row-${highlightedBrokerageId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightedBrokerageId, unlinkedBrokerage.length])

  const invalidateEstates = async () => {
    await queryClient.invalidateQueries({ queryKey: realEstateKeys.estates() })
  }

  const invalidateStandalone = async () => {
    await queryClient.invalidateQueries({ queryKey: realEstateKeys.standaloneProperties() })
  }

  const invalidateBrokerage = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: realEstateKeys.brokerage() }),
      queryClient.invalidateQueries({ queryKey: realEstateKeys.brokerageStats() }),
    ])
  }

  const createEstateMutation = useMutation({
    mutationFn: (input: CreateEstateInput) => realEstateApi.createEstate(input),
    onSuccess: async (estate) => {
      await invalidateEstates()
      setEstateOpen(false)
      toast.success(`Estate ${estate.estateCode} created`)
      openEstate(estate.id)
    },
    onError: (error) =>
      toast.error('Estate could not be created', {
        description: presentError(error, 'form-submit').message,
      }),
  })

  const updateEstateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: CreateEstateInput }) =>
      realEstateApi.updateEstate(id, input),
    onSuccess: async (estate) => {
      await Promise.all([
        invalidateEstates(),
        queryClient.invalidateQueries({ queryKey: realEstateKeys.estateDetail(estate.id) }),
      ])
      setEditingEstate(null)
      toast.success(`Estate ${estate.estateCode} updated`)
    },
    onError: (error) =>
      toast.error('Estate could not be updated', {
        description: presentError(error, 'form-submit').message,
      }),
  })

  const createPropertyMutation = useMutation({
    mutationFn: ({
      estateId,
      property,
    }: {
      estateId: number | null
      property: CreatePropertyInput
    }) =>
      estateId
        ? realEstateApi.createProperty(estateId, property)
        : realEstateApi.createStandaloneProperty(property),
    onSuccess: async (property, { estateId }) => {
      setPropertyOpen(false)
      if (estateId) {
        await queryClient.invalidateQueries({ queryKey: realEstateKeys.properties(estateId) })
        toast.success('Property created')
        openEstate(estateId)
        return
      }
      await invalidateStandalone()
      toast.success(`Standalone property ${property.propertyName} created`)
    },
    onError: (error) =>
      toast.error('Property could not be created', {
        description: presentError(error, 'form-submit').message,
      }),
  })

  const updatePropertyMutation = useMutation({
    mutationFn: ({ property, input }: { property: Property; input: CreatePropertyInput }) =>
      realEstateApi.updatePropertyRecord({ id: property.id, estateId: property.estateId }, input),
    onSuccess: async () => {
      await invalidateStandalone()
      setEditingProperty(null)
      toast.success('Property updated')
    },
    onError: (error) =>
      toast.error('Property could not be updated', {
        description: presentError(error, 'form-submit').message,
      }),
  })

  const createBrokerageMutation = useMutation({
    mutationFn: (input: CreateBrokerageInput) => realEstateApi.createBrokerage(input),
    onSuccess: async () => {
      setBrokerageOpen(false)
      await invalidateBrokerage()
      toast.success('Brokerage listing added')
    },
    onError: (error) =>
      toast.error('Brokerage listing could not be created', {
        description: presentError(error, 'form-submit').message,
      }),
  })

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: BrokerageVerificationStatus }) =>
      realEstateApi.verifyBrokerage(id, status),
    onSuccess: async () => {
      await invalidateBrokerage()
      toast.success('Brokerage verification updated')
    },
  })

  const deleteBrokerageMutation = useMutation({
    mutationFn: (id: number) => realEstateApi.deleteBrokerage(id),
    onSuccess: async () => {
      await invalidateBrokerage()
      toast.success('Brokerage listing deleted')
    },
  })

  const initialLoading =
    (canEstateList && estatesQuery.isPending) ||
    (canPropertyList && standaloneQuery.isPending) ||
    (canBrokerageList && (brokerageQuery.isPending || brokerageStatsQuery.isPending))

  if (initialLoading) {
    return <SectionLoadingState section="real-estate-inventory" />
  }

  return (
    <ModulePageFrame
      header={
        <CompactPageToolbar
          title="Real Estate"
          breadcrumb="Specialized Services / Real Estate"
          secondaryAction={
            <CompactActionButton
              disabled={!canCreateServiceRequest}
              locked={!canCreateServiceRequest}
              onClick={() =>
                void navigate({
                  to: '/app/$section',
                  params: { section: 'service-requests' },
                  search: { create: 'request' },
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
              disabled={!canCreateService}
              locked={!canCreateService}
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
        <section className="specialized-card">
          <header className="specialized-card-header specialized-card-header-utility">
            <div>
              <div className="specialized-card-title">Real Estate Portfolio</div>
              <div className="specialized-card-subtitle">
                Browse estates, standalone properties and brokerage listings not linked to an
                estate.
              </div>
            </div>
            <div className="specialized-action-row">
              <button
                type="button"
                className="specialized-btn"
                onClick={() => {
                  void Promise.all([
                    estatesQuery.refetch(),
                    standaloneQuery.refetch(),
                    brokerageQuery.refetch(),
                    brokerageStatsQuery.refetch(),
                  ])
                }}
              >
                <IconRefresh size={14} />
                Refresh
              </button>
              <button
                type="button"
                className="specialized-btn"
                disabled={!canBrokerageCreate}
                onClick={() => setBrokerageOpen(true)}
              >
                <IconPlus size={14} />
                Add Brokerage Listing
              </button>
              <button
                type="button"
                className="specialized-btn"
                disabled={!canPropertyCreate}
                onClick={() => setPropertyOpen(true)}
              >
                <IconPlus size={14} />
                Add Property
              </button>
              <button
                type="button"
                className="specialized-btn specialized-btn-primary"
                disabled={!canEstateCreate}
                onClick={() => setEstateOpen(true)}
              >
                <IconPlus size={14} />
                Add Estate
              </button>
            </div>
          </header>
          <div className="specialized-filter-row">
            <label className="commercial-search">
              <IconSearch size={14} />
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search estates"
              />
            </label>
          </div>
        </section>

        <section className="specialized-card">
          <header className="specialized-card-header">
            <div>
              <div className="specialized-card-title">Estates</div>
              <div className="specialized-card-subtitle">
                Select an estate to open its property inventory board.
              </div>
            </div>
          </header>
          {!canEstateList ? (
            <EmptyState
              title="Estate access required"
              description="You need estate list access before estates can be reviewed here."
            />
          ) : estatesQuery.isError ? (
            <ErrorState
              title="Estates could not be loaded"
              description={presentError(estatesQuery.error, 'section-load').message}
              onRetry={() => void estatesQuery.refetch()}
            />
          ) : recordSearch.search && !estates.length ? (
            <EmptyState
              title="No estates match this search"
              description="Change the search or clear it to review other estate records."
            />
          ) : !estates.length ? (
            <EmptyState
              title="No estates yet"
              description="Add the first estate record, then create its property inventory."
              action={
                canEstateCreate ? (
                  <button
                    type="button"
                    className="commercial-btn commercial-btn-primary"
                    onClick={() => setEstateOpen(true)}
                  >
                    Add Estate
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="specialized-hub-scroll-panel specialized-hub-scroll-panel--estates scrollbar-thin">
              <div className="specialized-estate-grid">
                {estates.map((estate) => (
                  <EstateCard
                    key={estate.id}
                    estate={estate}
                    canEdit={canEstateUpdate}
                    onOpen={() => openEstate(estate.id)}
                    onEdit={() => setEditingEstate(estate)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="specialized-hub-inventory-stack">
          <section className="specialized-card specialized-card--panel">
            <header className="specialized-card-header">
              <div>
                <div className="specialized-card-title">Standalone Properties</div>
                <div className="specialized-card-subtitle">Inventory not linked to any estate.</div>
              </div>
            </header>
            {!canPropertyList ? (
              <EmptyState
                title="Property access required"
                description="You need property list access before standalone inventory can be reviewed."
              />
            ) : standaloneQuery.isError ? (
              <ErrorState
                title="Standalone properties could not be loaded"
                description={presentError(standaloneQuery.error, 'section-load').message}
                onRetry={() => void standaloneQuery.refetch()}
              />
            ) : !standaloneProperties.length ? (
              <EmptyState
                title="No standalone properties"
                description="Add a property without linking it to an estate."
                action={
                  canPropertyCreate ? (
                    <button
                      type="button"
                      className="commercial-btn commercial-btn-primary"
                      onClick={() => setPropertyOpen(true)}
                    >
                      Add Property
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="specialized-hub-scroll-panel scrollbar-thin">
                <table className="commercial-table specialized-hub-inventory-table specialized-hub-inventory-table--properties">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Type</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {standaloneProperties.map((property) => (
                      <tr
                        key={property.id}
                        className={
                          editingProperty?.id === property.id ? 'is-highlighted' : undefined
                        }
                      >
                        <td>
                          <div className="specialized-inventory-name">
                            <span
                              className={`specialized-status-dot ${statusClass(property.status)}`}
                            />
                            <span className="specialized-inventory-name-text">
                              {property.propertyName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <PropertyTypeBadge property={property} />
                        </td>
                        <td className="specialized-hub-cell-nowrap">
                          {formatCurrency(property.price)}
                        </td>
                        <td>
                          <span
                            className={`specialized-pill specialized-pill--property-${property.status}`}
                          >
                            {statusLabel(property.status, property.statusDisplay)}
                          </span>
                        </td>
                        <td className="specialized-hub-cell-actions">
                          {canPropertyUpdate ? (
                            <button
                              type="button"
                              className="specialized-btn specialized-btn-small"
                              onClick={() => setEditingProperty(property)}
                            >
                              <IconEdit size={13} />
                              Edit
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="specialized-card specialized-card--panel">
            <header className="specialized-card-header">
              <div>
                <div className="specialized-card-title">Unlinked Brokerage Listings</div>
                <div className="specialized-card-subtitle">
                  {brokerageStatsQuery.data?.total ?? 0} total brokerage ·{' '}
                  {unlinkedBrokerage.length} without estate link
                </div>
              </div>
            </header>
            {!canBrokerageList ? (
              <EmptyState
                title="Brokerage access required"
                description="You need brokerage list access before third-party listings can be reviewed."
              />
            ) : brokerageQuery.isError ? (
              <ErrorState
                title="Brokerage listings could not be loaded"
                description={presentError(brokerageQuery.error, 'section-load').message}
                onRetry={() => void brokerageQuery.refetch()}
              />
            ) : !unlinkedBrokerage.length ? (
              <EmptyState
                title="No unlinked brokerage listings"
                description="Brokerage listings linked to an estate appear on that estate's inventory page."
                action={
                  canBrokerageCreate ? (
                    <button
                      type="button"
                      className="commercial-btn commercial-btn-primary"
                      onClick={() => setBrokerageOpen(true)}
                    >
                      Add Brokerage Listing
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="specialized-hub-scroll-panel scrollbar-thin">
                <table className="commercial-table specialized-hub-inventory-table specialized-hub-inventory-table--brokerage">
                  <thead>
                    <tr>
                      <th>Listing</th>
                      <th>Location</th>
                      <th>Price</th>
                      <th>Verification</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {unlinkedBrokerage.map((listing) => (
                      <BrokerageTableRow
                        key={listing.id}
                        listing={listing}
                        highlighted={highlightedBrokerageId === listing.id}
                        canVerify={canBrokerageUpdate}
                        canDelete={canBrokerageDelete}
                        onVerify={() =>
                          verifyMutation.mutate({ id: listing.id, status: 'verified' })
                        }
                        onDelete={() => deleteBrokerageMutation.mutate(listing.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {estateOpen ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <CreateEstateLiveWorkspace
            saving={createEstateMutation.isPending}
            onClose={() => setEstateOpen(false)}
            onSubmit={(input) => createEstateMutation.mutate(input)}
          />
        </Suspense>
      ) : null}
      {editingEstate ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <CreateEstateLiveWorkspace
            key={editingEstate.id}
            estate={editingEstate}
            saving={updateEstateMutation.isPending}
            onClose={() => setEditingEstate(null)}
            onSubmit={(input) => updateEstateMutation.mutate({ id: editingEstate.id, input })}
          />
        </Suspense>
      ) : null}
      {propertyOpen ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <CreatePropertyLiveWorkspace
            estates={estates}
            saving={createPropertyMutation.isPending}
            onClose={() => setPropertyOpen(false)}
            onSubmit={(input) => createPropertyMutation.mutate(input)}
          />
        </Suspense>
      ) : null}
      {activeEditingProperty ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <EditPropertyLiveWorkspace
            property={activeEditingProperty}
            saving={updatePropertyMutation.isPending}
            onClose={() => {
              setEditingProperty(null)
              if (recordSearch.standaloneProperty) {
                setSearchValue('standaloneProperty', null)
              }
            }}
            onSubmit={(input) =>
              updatePropertyMutation.mutate({ property: activeEditingProperty, input })
            }
          />
        </Suspense>
      ) : null}
      {brokerageOpen ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <CreateBrokerageLiveWorkspace
            estates={estates}
            saving={createBrokerageMutation.isPending}
            onClose={() => setBrokerageOpen(false)}
            onSubmit={(input) => createBrokerageMutation.mutate(input)}
          />
        </Suspense>
      ) : null}
    </ModulePageFrame>
  )
}
