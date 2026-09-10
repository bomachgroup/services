import {
  IconFilePlus,
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
import { DropdownSelect } from '@/shared/ui/dropdown-select'
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

function statusLabel(status: PropertyStatus, display?: string) {
  return display || status.replaceAll('_', ' ')
}

function normalizeInventoryType(value: string) {
  return value === 'plot' ? 'land' : value
}

function matchesInventoryType(value: string, filter: string) {
  if (!filter) return true
  return normalizeInventoryType(value) === filter
}

function matchesInventorySearch(haystack: string, search: string) {
  const token = search.trim().toLowerCase()
  if (!token) return true
  return haystack.toLowerCase().includes(token)
}

type PortfolioStatusFilter = 'available' | 'under_offer' | 'reserved' | 'sold'

function estateStatusBucket(status: Estate['estateStatus']): PortfolioStatusFilter | 'other' {
  if (status === 'available') return 'available'
  if (status === 'sold_out') return 'sold'
  if (status === 'under_development') return 'reserved'
  return 'other'
}

function propertyStatusBucket(status: PropertyStatus): PortfolioStatusFilter | 'other' {
  if (
    status === 'available' ||
    status === 'under_offer' ||
    status === 'reserved' ||
    status === 'sold'
  ) {
    return status
  }
  return 'other'
}

function brokerageStatusBucket(
  status: BrokerageListing['status'],
): PortfolioStatusFilter | 'other' {
  if (status === 'available' || status === 'sold') return status
  return 'other'
}

function matchesPortfolioStatus(
  bucket: PortfolioStatusFilter | 'other',
  filter: PortfolioStatusFilter | '',
) {
  if (!filter) return true
  return bucket === filter
}

function portfolioKpiTone(key: string) {
  if (key === 'sold') return 'sd'
  if (key === 'reserved') return 'rs'
  if (key === 'under_offer') return 'uo'
  if (key === 'available') return 'av'
  return 'nt'
}

function InventoryKindBadge({ kind }: { kind: 'estate' | 'owned' | 'third_party' }) {
  const label = kind === 'estate' ? 'Estate' : kind === 'owned' ? 'Owned' : 'Third-party'
  return (
    <span className={`specialized-inventory-badge specialized-inventory-badge--${kind}`}>
      {label}
    </span>
  )
}

function estateStatusPillClass(status: Estate['estateStatus']) {
  if (status === 'available') return 'commercial-pill-green'
  if (status === 'sold_out') return 'commercial-pill-red'
  if (status === 'under_development') return 'commercial-pill-yellow'
  return 'commercial-pill-gray'
}

function propertyStatusPillClass(status: PropertyStatus) {
  if (status === 'available') return 'commercial-pill-green'
  if (status === 'sold') return 'commercial-pill-red'
  if (status === 'under_offer') return 'specialized-pill--property-under_offer'
  if (status === 'reserved') return 'commercial-pill-yellow'
  return 'commercial-pill-gray'
}

function brokerageVerificationPillClass(status: BrokerageListing['verificationStatus']) {
  if (status === 'verified') return 'commercial-pill-green'
  if (status === 'pending') return 'commercial-pill-yellow'
  return 'commercial-pill-gray'
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
  const statusLabelText = estate.estateStatusDisplay || estate.estateStatus.replaceAll('_', ' ')
  const location = [estate.cityTown, estate.state].filter(Boolean).join(', ')

  return (
    <article className={`specialized-estate-card specialized-estate-card--${estate.estateStatus}`}>
      <div className="specialized-estate-card-main">
        <div className="specialized-estate-card-top">
          <div className="specialized-estate-card-identity">
            <b>{estate.estateName}</b>
            <small>
              {estate.estateCode}
              {location ? ` · ${location}` : ''}
            </small>
          </div>
          <InventoryKindBadge kind="estate" />
        </div>
        <div className="specialized-estate-card-row">
          <span className={`commercial-pill ${estateStatusPillClass(estate.estateStatus)}`}>
            {statusLabelText}
          </span>
          {estate.pricePerSqm ? (
            <b className="specialized-estate-card-price">
              {formatCurrency(estate.pricePerSqm)}
              <small>/ sqm</small>
            </b>
          ) : (
            <span className="specialized-estate-card-price-empty">No rate set</span>
          )}
        </div>
        {estate.estateTypeDisplay || estate.estateType ? (
          <p className="specialized-estate-card-meta">
            {estate.estateTypeDisplay || estate.estateType.replaceAll('_', ' ')}
          </p>
        ) : null}
      </div>
      <div className="specialized-estate-card-actions">
        <button
          type="button"
          className="commercial-btn commercial-btn-small commercial-btn-primary"
          onClick={onOpen}
        >
          Open
        </button>
        {canEdit ? (
          <button type="button" className="commercial-btn commercial-btn-small" onClick={onEdit}>
            Edit
          </button>
        ) : null}
      </div>
    </article>
  )
}

function StandalonePropertyCard({
  property,
  highlighted,
  canEdit,
  onEdit,
}: {
  property: Property
  highlighted: boolean
  canEdit: boolean
  onEdit: () => void
}) {
  return (
    <article
      className={
        highlighted
          ? 'specialized-estate-card specialized-estate-card--standalone is-highlighted'
          : 'specialized-estate-card specialized-estate-card--standalone'
      }
    >
      <div className="specialized-estate-card-main">
        <div className="specialized-estate-card-top">
          <div className="specialized-estate-card-identity">
            <b>{property.propertyName}</b>
            <small>
              {property.propertyTypeDisplay || property.propertyType}
              {' · '}
              Standalone owned
            </small>
          </div>
          <InventoryKindBadge kind="owned" />
        </div>
        <div className="specialized-estate-card-row">
          <span className={`commercial-pill ${propertyStatusPillClass(property.status)}`}>
            {statusLabel(property.status, property.statusDisplay)}
          </span>
          <b className="specialized-estate-card-price">{formatCurrency(property.price)}</b>
        </div>
      </div>
      <div className="specialized-estate-card-actions">
        {canEdit ? (
          <button type="button" className="commercial-btn commercial-btn-small" onClick={onEdit}>
            Edit
          </button>
        ) : null}
      </div>
    </article>
  )
}

function BrokerageCard({
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
    <article
      id={highlighted ? `brokerage-row-${listing.id}` : undefined}
      className={
        highlighted
          ? 'specialized-estate-card specialized-estate-card--brokerage is-highlighted'
          : 'specialized-estate-card specialized-estate-card--brokerage'
      }
    >
      <div className="specialized-estate-card-main">
        <div className="specialized-estate-card-top">
          <div className="specialized-estate-card-identity">
            <b>{listing.title}</b>
            <small>
              {listing.propertyType}
              {listing.location ? ` · ${listing.location}` : ''}
            </small>
          </div>
          <InventoryKindBadge kind="third_party" />
        </div>
        <div className="specialized-estate-card-row">
          <span
            className={`commercial-pill ${brokerageVerificationPillClass(listing.verificationStatus)}`}
          >
            {listing.verificationStatus.replaceAll('_', ' ')}
          </span>
          <b className="specialized-estate-card-price">{formatCurrency(listing.price)}</b>
        </div>
      </div>
      <div className="specialized-estate-card-actions">
        {canVerify && listing.verificationStatus !== 'verified' ? (
          <button type="button" className="commercial-btn commercial-btn-small" onClick={onVerify}>
            Verify
          </button>
        ) : null}
        {canDelete ? (
          <button type="button" className="commercial-btn commercial-btn-small" onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </article>
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
  const [typeFilter, setTypeFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'' | 'estates' | 'owned' | 'third_party'>('')
  const [statusFilter, setStatusFilter] = useState<PortfolioStatusFilter | ''>('')

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
  const canViewInventory = canEstateList || canPropertyList || canBrokerageList

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

  const searchToken = recordSearch.search ?? ''
  const estates = useMemo(() => estatesQuery.data?.items ?? [], [estatesQuery.data?.items])
  const standaloneProperties = useMemo(
    () => standaloneQuery.data?.items ?? [],
    [standaloneQuery.data?.items],
  )
  const unlinkedBrokerage = useMemo(
    () => (brokerageQuery.data?.items ?? []).filter((listing) => listing.estateId == null),
    [brokerageQuery.data?.items],
  )

  const filteredEstates = useMemo(() => {
    if (!canEstateList || (sourceFilter && sourceFilter !== 'estates')) return []
    return estates
      .filter((estate) => matchesInventoryType(estate.estateType, typeFilter))
      .filter((estate) =>
        matchesInventorySearch(
          `${estate.estateName} ${estate.estateCode} ${estate.cityTown} ${estate.state}`,
          searchToken,
        ),
      )
      .filter((estate) =>
        matchesPortfolioStatus(estateStatusBucket(estate.estateStatus), statusFilter),
      )
      .sort((left, right) => left.estateName.localeCompare(right.estateName))
  }, [canEstateList, estates, searchToken, sourceFilter, statusFilter, typeFilter])

  const filteredStandalone = useMemo(() => {
    if (!canPropertyList || (sourceFilter && sourceFilter !== 'owned')) return []
    return standaloneProperties
      .filter((property) => matchesInventoryType(property.propertyType, typeFilter))
      .filter((property) =>
        matchesInventorySearch(
          `${property.propertyName} ${property.propertyType} ${property.propertyTypeDisplay ?? ''}`,
          searchToken,
        ),
      )
      .filter((property) =>
        matchesPortfolioStatus(propertyStatusBucket(property.status), statusFilter),
      )
      .sort((left, right) => left.propertyName.localeCompare(right.propertyName))
  }, [canPropertyList, searchToken, sourceFilter, standaloneProperties, statusFilter, typeFilter])

  const filteredBrokerage = useMemo(() => {
    if (!canBrokerageList || (sourceFilter && sourceFilter !== 'third_party')) return []
    return unlinkedBrokerage
      .filter((listing) => matchesInventoryType(listing.propertyType, typeFilter))
      .filter((listing) =>
        matchesInventorySearch(
          `${listing.title} ${listing.location} ${listing.propertyType}`,
          searchToken,
        ),
      )
      .filter((listing) =>
        matchesPortfolioStatus(brokerageStatusBucket(listing.status), statusFilter),
      )
      .sort((left, right) => left.title.localeCompare(right.title))
  }, [canBrokerageList, searchToken, sourceFilter, statusFilter, typeFilter, unlinkedBrokerage])

  const portfolioStatusStats = useMemo(() => {
    const counts = { total: 0, available: 0, under_offer: 0, reserved: 0, sold: 0 }
    if (canEstateList) {
      for (const estate of estates) {
        counts.total += 1
        const bucket = estateStatusBucket(estate.estateStatus)
        if (bucket !== 'other') counts[bucket] += 1
      }
    }
    if (canPropertyList) {
      for (const property of standaloneProperties) {
        counts.total += 1
        const bucket = propertyStatusBucket(property.status)
        if (bucket !== 'other') counts[bucket] += 1
      }
    }
    if (canBrokerageList) {
      for (const listing of unlinkedBrokerage) {
        counts.total += 1
        const bucket = brokerageStatusBucket(listing.status)
        if (bucket !== 'other') counts[bucket] += 1
      }
    }
    return counts
  }, [
    canBrokerageList,
    canEstateList,
    canPropertyList,
    estates,
    standaloneProperties,
    unlinkedBrokerage,
  ])

  const selectStatusFilter = useCallback((next: PortfolioStatusFilter | '') => {
    setStatusFilter((current) => (current === next ? '' : next))
  }, [])

  const inventoryCount =
    filteredEstates.length + filteredStandalone.length + filteredBrokerage.length
  const hasAnyInventory =
    estates.length > 0 || standaloneProperties.length > 0 || unlinkedBrokerage.length > 0
  const inventoryQueryError =
    (canEstateList && estatesQuery.isError) ||
    (canPropertyList && standaloneQuery.isError) ||
    (canBrokerageList && brokerageQuery.isError)

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
    onError: (error) => {
      const presented = presentError(error, 'form-submit')
      if (presented.fieldErrors && Object.keys(presented.fieldErrors).length > 0) return
      toast.error('Estate could not be created', {
        description: presented.message,
      })
    },
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
    onError: (error) => {
      const presented = presentError(error, 'form-submit')
      if (presented.fieldErrors && Object.keys(presented.fieldErrors).length > 0) return
      toast.error('Estate could not be updated', {
        description: presented.message,
      })
    },
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
    (canBrokerageList && brokerageQuery.isPending)

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
                Browse estates, owned standalone properties and third-party brokerage listings in one
                portfolio. Brokerage requests stay in Service Requests.
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
                placeholder="Search properties"
              />
            </label>
          </div>
        </section>

        <div className="specialized-kpi-grid">
          {(
            [
              ['total', 'Total', portfolioStatusStats.total],
              ['available', 'Available', portfolioStatusStats.available],
              ['under_offer', 'Under offer', portfolioStatusStats.under_offer],
              ['reserved', 'Reserved', portfolioStatusStats.reserved],
              ['sold', 'Sold', portfolioStatusStats.sold],
            ] as const
          ).map(([key, label, value]) => {
            const active =
              key === 'total' ? statusFilter === '' : statusFilter === key
            return (
              <button
                key={key}
                type="button"
                className={
                  active
                    ? `specialized-kpi-card specialized-kpi-card--action specialized-kpi-card--${portfolioKpiTone(key)} is-active`
                    : `specialized-kpi-card specialized-kpi-card--action specialized-kpi-card--${portfolioKpiTone(key)}`
                }
                aria-pressed={active}
                onClick={() => selectStatusFilter(key === 'total' ? '' : key)}
              >
                <div>{label}</div>
                <strong>{value}</strong>
              </button>
            )
          })}
        </div>

        <section className="specialized-card">
          <header className="specialized-card-header">
            <div>
              <div className="specialized-card-title">Properties</div>
              <div className="specialized-card-subtitle">
                Estates, owned standalone inventory and third-party brokerage listings together.
                Tap a status card to filter the board.
              </div>
            </div>
            <div className="specialized-estate-sort-row">
              <DropdownSelect
                compact
                placeholder="All types"
                options={[
                  { value: '', label: 'All types' },
                  { value: 'land', label: 'Land' },
                  { value: 'residential', label: 'Residential' },
                  { value: 'commercial', label: 'Commercial' },
                  { value: 'industrial', label: 'Industrial' },
                  { value: 'mixed_use', label: 'Mixed use' },
                ]}
                value={typeFilter}
                onChange={setTypeFilter}
              />
              <DropdownSelect
                compact
                placeholder="All sources"
                options={[
                  { value: '', label: 'All sources' },
                  { value: 'estates', label: 'Estates' },
                  { value: 'owned', label: 'Owned standalone' },
                  { value: 'third_party', label: 'Third-party' },
                ]}
                value={sourceFilter}
                onChange={(value) =>
                  setSourceFilter(value as '' | 'estates' | 'owned' | 'third_party')
                }
              />
            </div>
          </header>
          {!canViewInventory ? (
            <EmptyState
              title="Inventory access required"
              description="You need estate, property or brokerage list access before inventory can be reviewed here."
            />
          ) : inventoryQueryError ? (
            <ErrorState
              title="Properties could not be loaded"
              description="One or more inventory sources failed to load. Retry to refresh the portfolio."
              onRetry={() => {
                void Promise.all([
                  estatesQuery.refetch(),
                  standaloneQuery.refetch(),
                  brokerageQuery.refetch(),
                ])
              }}
            />
          ) : searchToken && !inventoryCount ? (
            <EmptyState
              title="No properties match this search"
              description="Change the search or clear it to review other inventory records."
            />
          ) : !inventoryCount ? (
            <EmptyState
              title={hasAnyInventory ? 'No properties match these filters' : 'No properties yet'}
              description={
                hasAnyInventory
                  ? 'Adjust the type or source filters to bring matching inventory back into view.'
                  : 'Add an estate, standalone property or third-party brokerage listing to start the portfolio.'
              }
              action={
                hasAnyInventory ? (
                  <button
                    type="button"
                    className="commercial-btn"
                    onClick={() => {
                      setTypeFilter('')
                      setSourceFilter('')
                      setStatusFilter('')
                    }}
                  >
                    Clear filters
                  </button>
                ) : canEstateCreate ? (
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
                {filteredEstates.map((estate) => (
                  <EstateCard
                    key={`estate-${estate.id}`}
                    estate={estate}
                    canEdit={canEstateUpdate}
                    onOpen={() => openEstate(estate.id)}
                    onEdit={() => setEditingEstate(estate)}
                  />
                ))}
                {filteredStandalone.map((property) => (
                  <StandalonePropertyCard
                    key={`property-${property.id}`}
                    property={property}
                    highlighted={editingProperty?.id === property.id}
                    canEdit={canPropertyUpdate}
                    onEdit={() => setEditingProperty(property)}
                  />
                ))}
                {filteredBrokerage.map((listing) => (
                  <BrokerageCard
                    key={`brokerage-${listing.id}`}
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
              </div>
            </div>
          )}
        </section>
      </main>

      {estateOpen ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <CreateEstateLiveWorkspace
            saving={createEstateMutation.isPending}
            submitError={
              createEstateMutation.error
                ? presentError(createEstateMutation.error, 'form-submit').message
                : ''
            }
            submitFieldErrors={
              createEstateMutation.error
                ? presentError(createEstateMutation.error, 'form-submit').fieldErrors
                : undefined
            }
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
            submitError={
              updateEstateMutation.error
                ? presentError(updateEstateMutation.error, 'form-submit').message
                : ''
            }
            submitFieldErrors={
              updateEstateMutation.error
                ? presentError(updateEstateMutation.error, 'form-submit').fieldErrors
                : undefined
            }
            onClose={() => setEditingEstate(null)}
            onSubmit={(input) => updateEstateMutation.mutate({ id: editingEstate.id, input })}
          />
        </Suspense>
      ) : null}
      {propertyOpen ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <CreatePropertyLiveWorkspace
            standaloneOnly
            saving={createPropertyMutation.isPending}
            submitError={
              createPropertyMutation.error
                ? presentError(createPropertyMutation.error, 'form-submit').message
                : ''
            }
            submitFieldErrors={
              createPropertyMutation.error
                ? presentError(createPropertyMutation.error, 'form-submit').fieldErrors
                : undefined
            }
            onClose={() => setPropertyOpen(false)}
            onSubmit={(input) => createPropertyMutation.mutate({ ...input, estateId: null })}
          />
        </Suspense>
      ) : null}
      {activeEditingProperty ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <EditPropertyLiveWorkspace
            property={activeEditingProperty}
            saving={updatePropertyMutation.isPending}
            submitError={
              updatePropertyMutation.error
                ? presentError(updatePropertyMutation.error, 'form-submit').message
                : ''
            }
            submitFieldErrors={
              updatePropertyMutation.error
                ? presentError(updatePropertyMutation.error, 'form-submit').fieldErrors
                : undefined
            }
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
