import {
  IconApps,
  IconCalculator,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconFlask,
  IconLinkPlus,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { AccessLockIcon } from '@/shared/ui/module-controls'
import { DropdownSelect } from '@/shared/ui/dropdown-select'
import {
  RequestFormBuilderPanel,
  RequestFormBuilderSaveButton,
} from '../components/RequestFormBuilderPanel'
import { SERVICE_CATALOGUE_STATUS_FILTER_OPTIONS } from '../components/service-admin-dropdown-options'
import type {
  PricingCalculator,
  RequestFieldTypeOption,
  RequestFormField,
  ServiceCatalogueItem,
  ServiceParentOption,
  SaveRequestFormInput,
  ServiceRequestForm,
} from '../types/service-administration.types'
import { formatNumberFieldValue, parseNumberFieldValue } from '@/shared/lib/number-input'
import { formatCurrency } from '@/shared/lib/formatters'
import { serviceRequestsApi } from '@/modules/commercial/api/service-requests.api'
import type {
  EngineeringCategoryInput,
  EngineeringCategoryOption,
} from '@/modules/commercial/api/calculator-estimate.types'

const parentClassNames: Record<string, string> = {
  'Real Estate': 'service-admin-service-icon--real-estate',
  'Real Estate Development & Brokerage': 'service-admin-service-icon--real-estate',
  Engineering: 'service-admin-service-icon--engineering',
  'Engineering & Construction': 'service-admin-service-icon--engineering',
  Survey: 'service-admin-service-icon--survey',
  'Land Surveying & Geospatial': 'service-admin-service-icon--survey',
  ICT: 'service-admin-service-icon--ict',
  'Information Technology': 'service-admin-service-icon--ict',
  'Courier, Logistics & E-commerce': 'service-admin-service-icon--logistics',
  'Agriculture & Food Processing': 'service-admin-service-icon--agriculture',
  'Legal Services': 'service-admin-service-icon--legal',
}

type ServiceParentGroup = {
  key: string
  parentId: number | null
  parentName: string
  services: ServiceCatalogueItem[]
}

function parentGroupKey(parentId: number | null | undefined, parentName?: string) {
  if (parentId != null) return `parent-${parentId}`
  return `parent-name-${parentName?.trim() || 'none'}`
}

const EXPANDED_PARENT_GROUPS_KEY = 'bomach.service-catalogue.expanded-parent-groups'

function readExpandedParentGroups(): Set<string> {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(EXPANDED_PARENT_GROUPS_KEY)
    if (!raw) return new Set()

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function writeExpandedParentGroups(expanded: Set<string>) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(EXPANDED_PARENT_GROUPS_KEY, JSON.stringify([...expanded]))
}

function parentIconClass(parentName?: string) {
  return parentClassNames[parentName ?? ''] ?? 'service-admin-service-icon--default'
}

const EXPANDED_CALCULATOR_CARDS_KEY = 'bomach.calculator-library.expanded-cards'

function readExpandedCalculatorCards(): Set<string> {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(EXPANDED_CALCULATOR_CARDS_KEY)
    if (!raw) return new Set()

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function writeExpandedCalculatorCards(expanded: Set<string>) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(EXPANDED_CALCULATOR_CARDS_KEY, JSON.stringify([...expanded]))
}

function calculatorIconClass(code: string) {
  if (code === 'BOUNDARY-SURVEY' || code === 'RESTABLISHMENT-SURVEY')
    return 'service-admin-service-icon--survey'
  return 'service-admin-service-icon--engineering'
}

function groupServicesByParent(
  services: ServiceCatalogueItem[],
  parents: ServiceParentOption[],
): ServiceParentGroup[] {
  const grouped = new Map<string, ServiceParentGroup>()

  for (const service of services) {
    const key = parentGroupKey(service.parentId, service.parentName)
    const existing = grouped.get(key)
    if (existing) {
      existing.services.push(service)
      continue
    }

    grouped.set(key, {
      key,
      parentId: service.parentId ?? null,
      parentName: service.parentName?.trim() || 'Unassigned',
      services: [service],
    })
  }

  const orderIndex = new Map(parents.map((parent, index) => [parent.id, index]))

  return [...grouped.values()].sort((left, right) => {
    const leftOrder =
      left.parentId != null && orderIndex.has(left.parentId)
        ? orderIndex.get(left.parentId)!
        : Number.MAX_SAFE_INTEGER
    const rightOrder =
      right.parentId != null && orderIndex.has(right.parentId)
        ? orderIndex.get(right.parentId)!
        : Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return left.parentName.localeCompare(right.parentName)
  })
}

function ServiceCatalogueCard({
  service,
  onConfigure,
  configureLabel,
  onDuplicate,
  showParentMeta = false,
}: {
  service: ServiceCatalogueItem
  onConfigure?: ((service: ServiceCatalogueItem) => void) | undefined
  configureLabel?: 'Configure' | 'View'
  onDuplicate?: ((service: ServiceCatalogueItem) => void) | undefined
  showParentMeta?: boolean
}) {
  const parentClassName = parentIconClass(service.parentName)

  return (
    <article className="service-admin-service-card">
      <div className={`service-admin-service-icon ${parentClassName}`}>
        <IconApps size={18} />
      </div>
      <div className="service-admin-service-name">{service.name}</div>
      <p className="service-admin-service-description">{service.description}</p>
      <div className="service-admin-row-subtitle service-admin-service-meta">
        {service.code}
        {showParentMeta ? ` · ${service.parentName ?? 'No parent'}` : null}
        {service.slaDays != null ? ` · ${service.slaDays}d SLA` : null}
      </div>
      <div className="service-admin-service-footer">
        <span className={`service-admin-pill ${statusClass(service.status)}`}>
          {service.status}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className="service-admin-button service-admin-button-small"
            disabled={!onConfigure}
            title={!onConfigure ? 'You do not have permission to view this service' : undefined}
            onClick={() => onConfigure?.(service)}
          >
            <AccessLockIcon show={!onConfigure} size={11} />
            {configureLabel}
          </button>
          {onDuplicate ? (
            <button
              type="button"
              className="service-admin-button service-admin-button-small"
              aria-label="Duplicate service"
              onClick={() => onDuplicate(service)}
            >
              <IconCopy size={13} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function statusClass(status: string) {
  if (status.toLowerCase() === 'active') return 'service-admin-pill-green'
  if (status.toLowerCase() === 'draft') return 'service-admin-pill-yellow'
  return 'service-admin-pill-gray'
}

export function ServiceCatalogueScreen({
  services,
  totalCount,
  query,
  status,
  parentId,
  parents,
  page,
  pageSize,
  onFiltersChange,
  onPageChange,
  onConfigure,
  configureLabel = 'Configure',
  onCreate,
  createDisabled = false,
  onBranchAvailability,
  branchAvailabilityDisabled = false,
  onDuplicate,
}: {
  services: ServiceCatalogueItem[]
  totalCount: number
  query: string
  status: string
  parentId: number | null
  parents: ServiceParentOption[]
  page: number
  pageSize: number
  onFiltersChange: (filters: { query: string; status: string; parentId?: number }) => void
  onPageChange: (page: number) => void
  onConfigure?: ((service: ServiceCatalogueItem) => void) | undefined
  configureLabel?: 'Configure' | 'View'
  onCreate?: (() => void) | undefined
  createDisabled?: boolean
  onBranchAvailability?: (() => void) | undefined
  branchAvailabilityDisabled?: boolean
  onDuplicate?: ((service: ServiceCatalogueItem) => void) | undefined
}) {
  const hasActiveFilters = query.trim().length > 0 || status.length > 0 || parentId != null
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const [searchDraft, setSearchDraft] = useState(query)
  const [syncedQuery, setSyncedQuery] = useState(query)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(readExpandedParentGroups)
  const onFiltersChangeRef = useRef(onFiltersChange)
  const statusRef = useRef(status)
  const parentIdRef = useRef(parentId)
  const groupedServices = useMemo(
    () => groupServicesByParent(services, parents),
    [parents, services],
  )

  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setSearchDraft(query)
  }

  useEffect(() => {
    onFiltersChangeRef.current = onFiltersChange
  }, [onFiltersChange])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    parentIdRef.current = parentId
  }, [parentId])

  useEffect(() => {
    if (searchDraft === query) return

    const timeoutId = window.setTimeout(() => {
      onFiltersChangeRef.current({
        query: searchDraft,
        status: statusRef.current,
        ...(parentIdRef.current ? { parentId: parentIdRef.current } : {}),
      })
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [searchDraft, query])

  const recordCountLabel = `${totalCount} service${totalCount === 1 ? '' : 's'}`
  const showGroupedLayout = parentId == null

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      writeExpandedParentGroups(next)
      return next
    })
  }

  const applyFilters = (next: { query?: string; status?: string; parentId?: number | null }) => {
    const resolvedParentId =
      next.parentId === null ? undefined : (next.parentId ?? parentId ?? undefined)

    onFiltersChange({
      query: next.query ?? searchDraft,
      status: next.status ?? status,
      ...(resolvedParentId ? { parentId: resolvedParentId } : {}),
    })
  }

  return (
    <div className="service-admin-page service-admin-content">
      <div className="service-admin-card service-admin-catalog-shell">
        <div className="service-admin-filter-group service-admin-catalog-filter">
          <input
            className="service-admin-grow"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (searchDraft === query) return
              applyFilters({ query: searchDraft })
            }}
            placeholder="Search services..."
          />
          <DropdownSelect
            compact
            placeholder="All statuses"
            options={SERVICE_CATALOGUE_STATUS_FILTER_OPTIONS}
            value={status}
            onChange={(value) => applyFilters({ status: value })}
          />
          {parents.length > 0 ? (
            <DropdownSelect
              compact
              className="ui-dropdown--parent-filter"
              placeholder="All parent services"
              options={[
                { value: '', label: 'All parent services' },
                ...parents.map((parent) => ({
                  value: String(parent.id),
                  label: parent.name,
                })),
              ]}
              value={parentId != null ? String(parentId) : ''}
              onChange={(value) => {
                applyFilters({
                  parentId: value ? Number(value) : null,
                })
              }}
            />
          ) : null}
          <span className="service-admin-grow" />
          <button
            type="button"
            className="service-admin-button"
            disabled={branchAvailabilityDisabled || !onBranchAvailability}
            title={
              branchAvailabilityDisabled
                ? 'You do not have permission to view branch availability'
                : undefined
            }
            onClick={() => onBranchAvailability?.()}
          >
            <AccessLockIcon show={branchAvailabilityDisabled} />
            Branch Availability
          </button>
          <button
            type="button"
            className="service-admin-button service-admin-button-primary"
            disabled={createDisabled || !onCreate}
            title={createDisabled ? 'You do not have permission to create services' : undefined}
            onClick={() => onCreate?.()}
          >
            <AccessLockIcon show={createDisabled} />
            Create Service
          </button>
        </div>

        {services.length === 0 ? (
          <section className="service-admin-card col-span-full border-dashed p-6 sm:p-8">
            <div className="mx-auto max-w-xl text-center">
              <div className="service-admin-card-title">
                {hasActiveFilters
                  ? 'No services match the current filters'
                  : 'No services in the catalogue yet'}
              </div>
              <div className="service-admin-card-subtitle mt-1">
                {hasActiveFilters
                  ? 'Try clearing or adjusting the search and filter settings to see more services.'
                  : 'Service cards will appear here after the first Service is created. You can still search, filter, review branch availability, and start the setup flow from this page.'}
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    className="service-admin-button service-admin-button-primary"
                    onClick={() => applyFilters({ query: '', status: '', parentId: null })}
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    className="service-admin-button service-admin-button-primary"
                    disabled={createDisabled || !onCreate}
                    title={
                      createDisabled ? 'You do not have permission to create services' : undefined
                    }
                    onClick={() => onCreate?.()}
                  >
                    <AccessLockIcon show={createDisabled} />
                    Create first Service
                  </button>
                )}
                <button
                  type="button"
                  className="service-admin-button"
                  disabled={branchAvailabilityDisabled || !onBranchAvailability}
                  title={
                    branchAvailabilityDisabled
                      ? 'You do not have permission to view branch availability'
                      : undefined
                  }
                  onClick={() => onBranchAvailability?.()}
                >
                  <AccessLockIcon show={branchAvailabilityDisabled} />
                  Branch Availability
                </button>
              </div>
            </div>
          </section>
        ) : showGroupedLayout ? (
          <div className="service-admin-parent-groups">
            {groupedServices.map((group) => {
              const collapsed = !expandedGroups.has(group.key)
              const activeCount = group.services.filter(
                (service) => service.status === 'active',
              ).length
              const draftCount = group.services.filter(
                (service) => service.status === 'draft',
              ).length

              return (
                <section key={group.key} className="service-admin-parent-group">
                  <button
                    type="button"
                    className="service-admin-parent-group-header"
                    aria-expanded={!collapsed}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className="service-admin-parent-group-chevron" aria-hidden="true">
                      {collapsed ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
                    </span>
                    <span
                      className={`service-admin-service-icon service-admin-parent-group-icon ${parentIconClass(group.parentName)}`}
                    >
                      <IconApps size={16} />
                    </span>
                    <span className="service-admin-parent-group-copy">
                      <span className="service-admin-parent-group-name">{group.parentName}</span>
                      <span className="service-admin-parent-group-meta">
                        {group.services.length} service{group.services.length === 1 ? '' : 's'}
                        {activeCount > 0 ? ` · ${activeCount} active` : ''}
                        {draftCount > 0 ? ` · ${draftCount} draft` : ''}
                      </span>
                    </span>
                  </button>

                  {!collapsed ? (
                    <div className="service-admin-service-grid service-admin-parent-group-body">
                      {group.services.map((service) => (
                        <ServiceCatalogueCard
                          key={service.id}
                          service={service}
                          onConfigure={onConfigure}
                          configureLabel={configureLabel}
                          onDuplicate={onDuplicate}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="service-admin-service-grid">
            {services.map((service) => (
              <ServiceCatalogueCard
                key={service.id}
                service={service}
                onConfigure={onConfigure}
                configureLabel={configureLabel}
                onDuplicate={onDuplicate}
                showParentMeta
              />
            ))}
          </div>
        )}

        <div className="service-admin-table-pagination">
          <div className="service-admin-table-pagination-summary">
            <span className="service-admin-table-pagination-count">{recordCountLabel}</span>
            {showGroupedLayout ? (
              <>
                <span className="service-admin-table-pagination-divider" aria-hidden="true" />
                <span>
                  {groupedServices.length} parent group{groupedServices.length === 1 ? '' : 's'}
                </span>
              </>
            ) : null}
            <span className="service-admin-table-pagination-divider" aria-hidden="true" />
            <span>
              Page <b>{page}</b> of <b>{pageCount}</b>
            </span>
          </div>
          <div className="service-admin-table-pagination-actions">
            <button
              type="button"
              className="service-admin-button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="service-admin-button"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function calculatorRule(code: string): { detail: string; inputs: string[] } {
  switch (code) {
    case 'BOUNDARY-SURVEY':
      return {
        detail:
          'Finds the land-size band in the fee table, halves it without boundary registration, then adds ₦100,000 per extra plot on a single plan.',
        inputs: ['Area', 'Unit', 'Customer type', 'Boundary registration', 'Plots', 'Single plan'],
      }
    case 'RESTABLISHMENT-SURVEY':
      return {
        detail: 'Multiplies the number of beacons by the system-wide unit price below.',
        inputs: ['Number of beacons'],
      }
    case 'ARCHITECTURAL-DRAWING':
      return {
        detail:
          'Starts at the category base price, then adds fees only for bedrooms and floors above the free limits.',
        inputs: ['Category', 'Bedrooms', 'Floors'],
      }
    case 'BUILDING-CONSTRUCTION':
      return {
        detail:
          'Starts at the category base price, then adds bedroom, floor, area and timeline extras above the free limits.',
        inputs: ['Category', 'Bedrooms', 'Floors', 'Area (sqm)', 'Timeline (days)'],
      }
    default:
      return {
        detail: 'Price is computed on the server at estimate time.',
        inputs: [],
      }
  }
}

function isEngineeringCode(code: string) {
  return code === 'ARCHITECTURAL-DRAWING' || code === 'BUILDING-CONSTRUCTION'
}

function LibraryModal({
  title,
  onClose,
  footer,
  children,
}: {
  title: string
  onClose: () => void
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <div className="service-admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="service-admin-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="service-admin-modal-header">
          <h2 className="service-admin-modal-title">{title}</h2>
          <button
            type="button"
            className="service-admin-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <IconX size={16} />
          </button>
        </header>
        <div className="service-admin-modal-body">{children}</div>
        <footer className="service-admin-modal-footer">{footer}</footer>
      </section>
    </div>
  )
}

interface EstimateBreakdown {
  total: number
  lines: Array<{ label: string; value: string }>
}

function breakdownFromRaw(code: string, raw: Record<string, unknown>): EstimateBreakdown {
  const money = (value: unknown) => formatCurrency(Number(value ?? 0))
  if (code === 'BOUNDARY-SURVEY') {
    return {
      total: Number(raw.total ?? 0),
      lines: [
        { label: 'Area', value: `${Number(raw.area_sqm ?? 0)} sqm` },
        {
          label: 'Tier',
          value: `${Number(raw.tier_min_sqm ?? 0)}–${Number(raw.tier_max_sqm ?? 0)} sqm`,
        },
        { label: 'Base price', value: money(raw.base_price) },
        {
          label: 'Registration adjustment',
          value: `−${money(raw.boundary_registration_discount)}`,
        },
        { label: 'Extra plot fee', value: money(raw.extra_plot_fee) },
      ],
    }
  }
  if (code === 'RESTABLISHMENT-SURVEY') {
    return {
      total: Number(raw.total ?? 0),
      lines: [
        { label: 'Beacons', value: String(Number(raw.number_of_beacons ?? 0)) },
        { label: 'Unit price', value: money(raw.unit_price) },
      ],
    }
  }
  const lines = [
    { label: 'Category', value: typeof raw.category_name === 'string' ? raw.category_name : '—' },
    { label: 'Unit price', value: money(raw.unit_price) },
    { label: 'Bedrooms', value: String(Number(raw.number_of_bedrooms ?? 0)) },
    { label: 'Floors', value: String(Number(raw.number_of_floors ?? 0)) },
    { label: 'Extra bedroom fee', value: money(raw.extra_bedroom_fee) },
    { label: 'Extra floor fee', value: money(raw.extra_floor_fee) },
  ]
  if (raw.area_sqm != null && raw.area_sqm !== '') {
    lines.push({ label: 'Area', value: `${Number(raw.area_sqm)} sqm` })
    lines.push({ label: 'Area fee', value: money(raw.area_fee) })
  }
  if (raw.timeline_days != null && raw.timeline_days !== '') {
    lines.push({ label: 'Timeline', value: `${Number(raw.timeline_days)} days` })
    lines.push({ label: 'Timeline fee', value: money(raw.timeline_fee) })
  }
  return { total: Number(raw.total ?? 0), lines }
}

interface CategoryFormState {
  name: string
  categoryType: string
  unitPrice: number
  maxBedrooms: number
  maxFloors: number
  extraBedroomFee: number
  extraFloorFee: number
  maxArea: number | null
  areaFee: number | null
  timelineDays: number | null
  timelineFee: number | null
}

const emptyCategoryForm: CategoryFormState = {
  name: '',
  categoryType: '',
  unitPrice: 0,
  maxBedrooms: 0,
  maxFloors: 0,
  extraBedroomFee: 0,
  extraFloorFee: 0,
  maxArea: null,
  areaFee: null,
  timelineDays: null,
  timelineFee: null,
}

function categoryFormFromOption(category: EngineeringCategoryOption): CategoryFormState {
  return {
    name: category.name,
    categoryType: category.categoryType,
    unitPrice: category.unitPrice,
    maxBedrooms: category.maxBedrooms,
    maxFloors: category.maxFloors,
    extraBedroomFee: category.extraBedroomFee,
    extraFloorFee: category.extraFloorFee,
    maxArea: category.maxArea,
    areaFee: category.areaFee,
    timelineDays: category.timelineDays,
    timelineFee: category.timelineFee,
  }
}

export function CalculatorLibraryScreen({
  calculators,
  services,
  hasServices = true,
  canAttach = false,
  attachingServiceId = null,
  detachingServiceId = null,
  onAttach,
  onDetach,
  categories,
  categoriesLoading = false,
  unitPrice,
  unitPriceLoading = false,
  canEditPricing = false,
  canCreateCategory = false,
  canDeactivateCategory = false,
  savingPricing = false,
  onSaveUnitPrice,
  onSaveCategory,
  onDeactivateCategory,
  deactivatingCategoryId = null,
  onReactivateCategory,
  reactivatingCategoryId = null,
}: {
  calculators: PricingCalculator[]
  services: ServiceCatalogueItem[]
  hasServices?: boolean
  canAttach?: boolean
  attachingServiceId?: number | null
  detachingServiceId?: number | null
  onAttach?: ((serviceId: number, calculatorCode: string) => void) | undefined
  onDetach?: ((serviceId: number) => void) | undefined
  categories: EngineeringCategoryOption[]
  categoriesLoading?: boolean
  unitPrice: number | null
  unitPriceLoading?: boolean
  canEditPricing?: boolean
  canCreateCategory?: boolean
  canDeactivateCategory?: boolean
  savingPricing?: boolean
  onSaveUnitPrice?: ((unitPrice: number) => void) | undefined
  onSaveCategory?:
    ((categoryId: number | null, input: EngineeringCategoryInput) => void) | undefined
  onDeactivateCategory?: ((categoryId: number) => void) | undefined
  deactivatingCategoryId?: number | null
  onReactivateCategory?: ((category: EngineeringCategoryOption) => void) | undefined
  reactivatingCategoryId?: number | null
}) {
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(readExpandedCalculatorCards)
  const toggleCalculatorCard = (code: string) => {
    setExpandedCodes((current) => {
      const next = new Set(current)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      writeExpandedCalculatorCards(next)
      return next
    })
  }

  const servicesByCalculator = useMemo(() => {
    const grouped = new Map<string, ServiceCatalogueItem[]>()
    for (const service of services) {
      const code = service.activeCalculator?.code
      if (!code) continue
      const existing = grouped.get(code)
      if (existing) {
        existing.push(service)
      } else {
        grouped.set(code, [service])
      }
    }
    return grouped
  }, [services])

  const parentGroups = useMemo(() => {
    const groups = new Map<string, string>()
    for (const service of services) {
      const key =
        service.parentId != null
          ? `parent-${service.parentId}`
          : `name-${service.parentName?.trim() || 'none'}`
      if (!groups.has(key)) groups.set(key, service.parentName?.trim() || 'Other services')
    }
    return [...groups.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [services])

  const [attachFor, setAttachFor] = useState<string | null>(null)
  const [attachParent, setAttachParent] = useState('')
  const [attachServiceId, setAttachServiceId] = useState('')
  const [confirmingReplace, setConfirmingReplace] = useState(false)
  const [testFor, setTestFor] = useState<string | null>(null)
  const [testServiceId, setTestServiceId] = useState('')
  const [testLocked, setTestLocked] = useState(false)
  const testableServices = testFor ? (servicesByCalculator.get(testFor) ?? []) : []
  const testService = testableServices.find((service) => service.id === testServiceId) ?? null
  const testCalculator = calculators.find((calculator) => calculator.code === testFor)
  const attachCalculator = calculators.find((calculator) => calculator.code === attachFor)

  const [boundary, setBoundary] = useState({
    area: 0,
    unit: 'sqm',
    customerType: 'individual',
    plots: 1,
    singlePlan: '',
  })
  const [beacons, setBeacons] = useState(0)
  const [engineering, setEngineering] = useState({ category: '', bedrooms: 0, floors: 0 })
  const [testResult, setTestResult] = useState<EstimateBreakdown | null>(null)
  const [testError, setTestError] = useState('')
  const [estimating, setEstimating] = useState(false)

  const [unitPriceDraft, setUnitPriceDraft] = useState<number | null>(null)
  const [unitPriceOpen, setUnitPriceOpen] = useState(false)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm)
  const [categoryExtrasOn, setCategoryExtrasOn] = useState(false)
  const [categoryError, setCategoryError] = useState('')
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<number | null>(null)
  const [showInactiveCategories, setShowInactiveCategories] = useState(false)
  const activeCategories = categories.filter((category) => category.active)
  const inactiveCategories = categories.filter((category) => !category.active)
  const visibleCategories = showInactiveCategories ? categories : activeCategories
  const attachedServiceCount = services.filter((service) => service.activeCalculator != null).length
  const unassignedServiceCount = services.length - attachedServiceCount
  const hasEngineeringCalculators = calculators.some((calculator) =>
    isEngineeringCode(calculator.code),
  )

  const openAttachFor = (code: string) => {
    setAttachFor(code)
    setAttachParent('')
    setAttachServiceId('')
    setConfirmingReplace(false)
  }

  const closeAttach = () => {
    setAttachFor(null)
    setAttachServiceId('')
    setConfirmingReplace(false)
  }

  const openTestFor = (code: string, serviceId: string | null) => {
    setTestFor(code)
    setTestServiceId(serviceId ?? '')
    setTestLocked(serviceId != null && serviceId !== '')
    setBoundary({ area: 0, unit: 'sqm', customerType: 'individual', plots: 1, singlePlan: '' })
    setBeacons(0)
    setEngineering({ category: '', bedrooms: 0, floors: 0 })
    setTestResult(null)
    setTestError('')
  }

  const closeTest = () => {
    setTestFor(null)
    setTestServiceId('')
    setTestLocked(false)
    setTestResult(null)
    setTestError('')
  }

  const attachableServices = attachFor
    ? services.filter((service) => {
        if (service.activeCalculator?.code === attachFor) return false
        if (!attachParent) return true
        const key =
          service.parentId != null
            ? `parent-${service.parentId}`
            : `name-${service.parentName?.trim() || 'none'}`
        return key === attachParent
      })
    : []
  const attachTarget = attachableServices.find((service) => service.id === attachServiceId) ?? null
  const attachTargetCode = attachTarget?.activeCalculator?.code ?? ''
  const attachReplaces =
    attachFor != null && attachTargetCode !== '' && attachTargetCode !== attachFor

  const runTest = async () => {
    if (!testService || !testFor) return
    const serviceId = Number(testService.id)
    if (!Number.isFinite(serviceId) || serviceId <= 0) {
      setTestError('Select a valid attached service first.')
      return
    }
    setEstimating(true)
    setTestError('')
    setTestResult(null)
    try {
      if (testFor === 'BOUNDARY-SURVEY') {
        if (!(boundary.area > 0)) throw new Error('Enter the land area before estimating.')
        const plots = Math.max(1, Math.floor(boundary.plots))
        if (plots > 1 && boundary.singlePlan === '')
          throw new Error('Choose whether the plots share a single plan.')
        const result = await serviceRequestsApi.estimateBoundary(serviceId, {
          area: boundary.area,
          unit: boundary.unit === 'ha' ? 'ha' : 'sqm',
          customer_type: boundary.customerType === 'corporate' ? 'corporate' : 'individual',
          boundary_registration: true,
          plots,
          single_plan: plots > 1 ? boundary.singlePlan === 'yes' : null,
          state: '',
          lga: '',
          country: '',
        })
        setTestResult(breakdownFromRaw(testFor, result.raw))
      } else if (testFor === 'RESTABLISHMENT-SURVEY') {
        if (!(beacons >= 1)) throw new Error('Enter the number of beacons (at least 1).')
        const result = await serviceRequestsApi.estimateRestablishment(serviceId, {
          number_of_beacons: Math.floor(beacons),
        })
        setTestResult(breakdownFromRaw(testFor, result.raw))
      } else if (isEngineeringCode(testFor)) {
        if (!engineering.category.trim()) throw new Error('Select an engineering category.')
        const result = await serviceRequestsApi.estimateEngineering(serviceId, {
          category_name: engineering.category,
          number_of_bedrooms: Math.max(0, Math.floor(engineering.bedrooms)),
          number_of_floors: Math.max(0, Math.floor(engineering.floors)),
        })
        setTestResult(breakdownFromRaw(testFor, result.raw))
      }
    } catch (error) {
      setTestResult(null)
      setTestError(error instanceof Error ? error.message : 'Estimate could not be computed.')
    } finally {
      setEstimating(false)
    }
  }

  const openCategoryForm = (category: EngineeringCategoryOption | null) => {
    setCategoryForm(category ? categoryFormFromOption(category) : emptyCategoryForm)
    setCategoryExtrasOn(
      category != null &&
        (category.maxArea != null ||
          category.areaFee != null ||
          category.timelineDays != null ||
          category.timelineFee != null),
    )
    setEditingCategoryId(category?.id ?? null)
    setCategoryError('')
    setCategoryFormOpen(true)
  }

  const saveCategoryForm = () => {
    if (!onSaveCategory) return
    if (!categoryForm.name.trim()) {
      setCategoryError('Category name is required.')
      return
    }
    if (!categoryForm.categoryType.trim()) {
      setCategoryError('Category type is required.')
      return
    }
    if (!(categoryForm.unitPrice > 0)) {
      setCategoryError('Unit price must be greater than zero.')
      return
    }
    if (categoryForm.extraBedroomFee < 0 || categoryForm.extraFloorFee < 0) {
      setCategoryError('Extra fees cannot be negative.')
      return
    }
    if (
      categoryExtrasOn &&
      ((categoryForm.maxArea == null) !== (categoryForm.areaFee == null) ||
        (categoryForm.timelineDays == null) !== (categoryForm.timelineFee == null))
    ) {
      setCategoryError('Area and timeline extras must be supplied as pairs, or neither.')
      return
    }
    setCategoryError('')
    onSaveCategory(editingCategoryId, {
      name: categoryForm.name.trim(),
      category_type: categoryForm.categoryType.trim(),
      unit_price: categoryForm.unitPrice,
      max_bedrooms_default: Math.max(0, Math.floor(categoryForm.maxBedrooms)),
      max_floors_default: Math.max(0, Math.floor(categoryForm.maxFloors)),
      extra_bedroom_fee: categoryForm.extraBedroomFee,
      extra_floor_fee: categoryForm.extraFloorFee,
      max_area_default: categoryExtrasOn ? categoryForm.maxArea : null,
      area_fee: categoryExtrasOn ? categoryForm.areaFee : null,
      timeline_days_default: categoryExtrasOn ? categoryForm.timelineDays : null,
      timeline_fee: categoryExtrasOn ? categoryForm.timelineFee : null,
    })
    setCategoryFormOpen(false)
  }

  const showPricingAdmin = canEditPricing || canCreateCategory || canDeactivateCategory

  return (
    <div className="service-admin-page service-admin-content">
      <section className="service-admin-card service-admin-calculator-intro">
        <div className="service-admin-calculator-intro-copy">
          <div className="service-admin-eyebrow">Pricing operations</div>
          <div className="service-admin-card-title">Service Calculator Library</div>
          <div className="service-admin-card-subtitle">
            Assign a server-managed calculator to a service. Open an assigned service to run a real
            estimate.
          </div>
        </div>
        <div className="service-admin-calculator-metrics" aria-label="Calculator library summary">
          <div className="service-admin-calculator-metric">
            <strong>{calculators.length}</strong>
            <span>Calculators</span>
          </div>
          <div className="service-admin-calculator-metric">
            <strong>{attachedServiceCount}</strong>
            <span>Assigned services</span>
          </div>
          <div className="service-admin-calculator-metric">
            <strong>{unassignedServiceCount}</strong>
            <span>Unassigned</span>
          </div>
        </div>
      </section>

      {calculators.length === 0 ? (
        <section className="service-admin-card service-admin-calculator-empty">
          <div className="service-admin-card-title">No calculators configured</div>
          <div className="service-admin-card-subtitle">
            {!hasServices
              ? 'Create a service in the catalogue first.'
              : 'Active calculators appear here once seeded on the server.'}
          </div>
        </section>
      ) : (
        <div className="service-admin-calculator-grid">
          {calculators.map((calculator) => {
            const rule = calculatorRule(calculator.code)
            const attached = servicesByCalculator.get(calculator.code) ?? []
            const expanded = expandedCodes.has(calculator.code)
            const isRestablishment = calculator.code === 'RESTABLISHMENT-SURVEY'

            return (
              <article
                key={calculator.id}
                className={`service-admin-card service-admin-calculator-card${expanded ? 'service-admin-calculator-card--expanded' : ''}`}
              >
                <div className="service-admin-calculator-top">
                  <div
                    className={`service-admin-service-icon ${calculatorIconClass(calculator.code)}`}
                  >
                    <IconCalculator size={18} />
                  </div>
                  <div className="service-admin-calculator-identity">
                    <div className="service-admin-eyebrow">Calculator</div>
                    <div className="service-admin-card-title">{calculator.name}</div>
                    <div className="service-admin-card-subtitle">{calculator.code}</div>
                  </div>
                  <span
                    className={`service-admin-state-pill service-admin-state-pill--${
                      calculator.status === 'active' ? 'success' : 'skipped'
                    }`}
                  >
                    {calculator.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="service-admin-calculator-rule">
                  <span className="service-admin-calculator-section-label">How it prices</span>
                  <p>{rule.detail}</p>
                  <div className="service-admin-calculator-inputs">
                    {rule.inputs.length > 0 ? (
                      rule.inputs.map((input) => (
                        <span key={input} className="service-admin-calculator-input">
                          {input}
                        </span>
                      ))
                    ) : (
                      <span className="service-admin-calculator-input">Server-managed rules</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="service-admin-calculator-toggle"
                  aria-expanded={expanded}
                  onClick={() => toggleCalculatorCard(calculator.code)}
                >
                  <span className="service-admin-calculator-toggle-copy">
                    <span className="service-admin-calculator-toggle-icon" aria-hidden="true">
                      {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    </span>
                    <span>
                      <strong>Assigned services</strong>
                      <small>
                        {attached.length === 0
                          ? 'No services assigned yet'
                          : `${attached.length} service${attached.length === 1 ? '' : 's'} ready for estimates`}
                      </small>
                    </span>
                  </span>
                  <span className="service-admin-calculator-count">{attached.length}</span>
                </button>

                {expanded ? (
                  <div className="service-admin-calculator-services">
                    {attached.length === 0 ? (
                      <div className="service-admin-calculator-empty-state">
                        <strong>No services assigned</strong>
                        <span>
                          Attach this calculator to a catalogue service to enable estimates.
                        </span>
                      </div>
                    ) : (
                      attached.map((service) => {
                        const numericId = Number(service.id)
                        const detaching = detachingServiceId === numericId
                        return (
                          <div key={service.id} className="service-admin-calculator-service-row">
                            <div className="service-admin-calculator-service-copy">
                              <strong>{service.name}</strong>
                              <span>{service.parentName || 'Catalogue service'}</span>
                            </div>
                            <div className="service-admin-calculator-service-actions">
                              <button
                                type="button"
                                className="service-admin-button service-admin-button-small service-admin-button-primary"
                                title={`Run an estimate for ${service.name}`}
                                onClick={() => openTestFor(calculator.code, service.id)}
                              >
                                <IconFlask size={13} />
                                Estimate
                              </button>
                              {canAttach && onDetach ? (
                                <button
                                  type="button"
                                  className="service-admin-button service-admin-button-small"
                                  disabled={detaching}
                                  onClick={() => onDetach(numericId)}
                                >
                                  {detaching ? 'Detaching…' : 'Detach'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                ) : null}

                {isRestablishment ? (
                  <div className="service-admin-calculator-config">
                    <div>
                      <span className="service-admin-calculator-section-label">
                        Pricing configuration
                      </span>
                      <strong>
                        {unitPriceLoading
                          ? 'Loading unit price…'
                          : unitPrice == null
                            ? 'Unit price not set'
                            : `${formatCurrency(unitPrice)} per beacon`}
                      </strong>
                    </div>
                    {canEditPricing && onSaveUnitPrice ? (
                      <button
                        type="button"
                        className="service-admin-button service-admin-button-small"
                        onClick={() => {
                          setUnitPriceDraft(unitPrice ?? null)
                          setUnitPriceOpen(true)
                        }}
                      >
                        Edit rate
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {canAttach && onAttach ? (
                  <div className="service-admin-calculator-actions">
                    <button
                      type="button"
                      className="service-admin-button service-admin-button-primary"
                      onClick={() => openAttachFor(calculator.code)}
                    >
                      <IconLinkPlus size={14} />
                      Attach service
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {testFor ? (
        <LibraryModal
          title={`Estimate ${testService?.name ?? testCalculator?.name ?? testFor}`}
          onClose={closeTest}
          footer={
            <>
              <button type="button" className="service-admin-button" onClick={closeTest}>
                Close
              </button>
              <button
                type="button"
                className="service-admin-button service-admin-button-primary"
                disabled={estimating || !testService}
                onClick={() => void runTest()}
              >
                {estimating ? 'Estimating…' : 'Run estimate'}
              </button>
            </>
          }
        >
          <div className="service-admin-form-grid">
            <div className="f full">
              <label>Service</label>
              {testLocked && testService ? (
                <div className="service-admin-notice service-admin-notice-blue">
                  <b>{testService.name}</b>
                  {testService.parentName ? ` · ${testService.parentName}` : ''}
                </div>
              ) : (
                <DropdownSelect
                  placeholder="Select an attached service"
                  options={testableServices.map((service) => ({
                    value: service.id,
                    label: service.name,
                  }))}
                  value={testServiceId}
                  onChange={(value) => {
                    setTestServiceId(value)
                    setTestResult(null)
                    setTestError('')
                  }}
                />
              )}
            </div>

            {testFor === 'BOUNDARY-SURVEY' ? (
              <>
                <div className="f">
                  <label>Area</label>
                  <input
                    type="number"
                    min="0"
                    value={formatNumberFieldValue(boundary.area)}
                    onChange={(event) =>
                      setBoundary({
                        ...boundary,
                        area: parseNumberFieldValue(event.target.value),
                      })
                    }
                  />
                </div>
                <div className="f">
                  <label>Unit</label>
                  <DropdownSelect
                    options={[
                      { value: 'sqm', label: 'sqm' },
                      { value: 'ha', label: 'ha' },
                    ]}
                    value={boundary.unit}
                    onChange={(value) =>
                      setBoundary({ ...boundary, unit: value === 'ha' ? 'ha' : 'sqm' })
                    }
                  />
                </div>
                <div className="f">
                  <label>Customer type</label>
                  <DropdownSelect
                    options={[
                      { value: 'individual', label: 'Individual' },
                      { value: 'corporate', label: 'Corporate' },
                    ]}
                    value={boundary.customerType}
                    onChange={(value) =>
                      setBoundary({
                        ...boundary,
                        customerType: value === 'corporate' ? 'corporate' : 'individual',
                      })
                    }
                  />
                </div>
                <div className="f">
                  <label>Plots</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formatNumberFieldValue(boundary.plots)}
                    onChange={(event) =>
                      setBoundary({
                        ...boundary,
                        plots: Math.max(
                          1,
                          Math.floor(parseNumberFieldValue(event.target.value) || 1),
                        ),
                      })
                    }
                  />
                </div>
                {boundary.plots > 1 ? (
                  <div className="f full">
                    <label>Single plan for all plots</label>
                    <DropdownSelect
                      placeholder="Select…"
                      options={[
                        { value: 'yes', label: 'Yes — one plan' },
                        { value: 'no', label: 'No — separate plans' },
                      ]}
                      value={boundary.singlePlan}
                      onChange={(value) => setBoundary({ ...boundary, singlePlan: value })}
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {testFor === 'RESTABLISHMENT-SURVEY' ? (
              <div className="f">
                <label>Number of beacons</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formatNumberFieldValue(beacons)}
                  onChange={(event) =>
                    setBeacons(
                      Math.max(0, Math.floor(parseNumberFieldValue(event.target.value) || 0)),
                    )
                  }
                />
              </div>
            ) : null}

            {testFor != null && isEngineeringCode(testFor) ? (
              <>
                <div className="f">
                  <label>Category</label>
                  <DropdownSelect
                    placeholder={categoriesLoading ? 'Loading…' : 'Select category'}
                    options={categories.map((category) => ({
                      value: category.name,
                      label: `${category.name} · ${formatCurrency(category.unitPrice)}`,
                    }))}
                    value={engineering.category}
                    onChange={(value) => setEngineering({ ...engineering, category: value })}
                  />
                </div>
                <div className="f">
                  <label>Bedrooms</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formatNumberFieldValue(engineering.bedrooms)}
                    onChange={(event) =>
                      setEngineering({
                        ...engineering,
                        bedrooms: Math.max(
                          0,
                          Math.floor(parseNumberFieldValue(event.target.value) || 0),
                        ),
                      })
                    }
                  />
                </div>
                <div className="f">
                  <label>Floors</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formatNumberFieldValue(engineering.floors)}
                    onChange={(event) =>
                      setEngineering({
                        ...engineering,
                        floors: Math.max(
                          0,
                          Math.floor(parseNumberFieldValue(event.target.value) || 0),
                        ),
                      })
                    }
                  />
                </div>
              </>
            ) : null}
          </div>

          {testError ? (
            <div className="service-admin-notice service-admin-notice-red">{testError}</div>
          ) : null}

          {testResult ? (
            <>
              <div className="service-admin-table-wrap mt-2">
                <table className="service-admin-table">
                  <tbody>
                    {testResult.lines.map((line) => (
                      <tr key={line.label}>
                        <td>{line.label}</td>
                        <td>{line.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="service-admin-kpi service-admin-kpi-blue">
                <div className="service-admin-kpi-label">Estimated price</div>
                <div className="service-admin-kpi-value">{formatCurrency(testResult.total)}</div>
              </div>
            </>
          ) : null}
        </LibraryModal>
      ) : null}

      {hasEngineeringCalculators ? (
        <section className="service-admin-card service-admin-shared-pricing-card">
          <div className="service-admin-shared-pricing-copy">
            <div className="service-admin-eyebrow">Shared configuration</div>
            <div className="service-admin-card-title">Engineering price book</div>
            <div className="service-admin-card-subtitle">
              One category catalogue powers both Architectural Drawing and Building Construction.
            </div>
          </div>
          <div className="service-admin-shared-pricing-summary">
            <strong>{categoriesLoading ? 'Loading…' : activeCategories.length}</strong>
            <span>active categories</span>
          </div>
          {showPricingAdmin ? (
            <button
              type="button"
              className="service-admin-button service-admin-button-small"
              onClick={() => setCategoryManagerOpen(true)}
            >
              Manage categories
            </button>
          ) : null}
        </section>
      ) : null}

      {categoryManagerOpen && showPricingAdmin ? (
        <LibraryModal
          title="Engineering price book"
          onClose={() => setCategoryManagerOpen(false)}
          footer={
            <button
              type="button"
              className="service-admin-button"
              onClick={() => setCategoryManagerOpen(false)}
            >
              Close
            </button>
          }
        >
          <div className="service-admin-card-header">
            <div>
              <div className="service-admin-card-title">Categories</div>
              <div className="service-admin-card-subtitle">
                {categoriesLoading
                  ? 'Loading…'
                  : `Shared price book for Architectural Drawing and Building Construction · ${activeCategories.length} active${inactiveCategories.length > 0 ? ` · ${inactiveCategories.length} inactive` : ''}`}
              </div>
            </div>
            <div className="flex gap-1">
              {inactiveCategories.length > 0 ? (
                <button
                  type="button"
                  className="service-admin-button service-admin-button-small"
                  aria-pressed={showInactiveCategories}
                  onClick={() => setShowInactiveCategories((current) => !current)}
                >
                  {showInactiveCategories
                    ? 'Hide inactive'
                    : `Show inactive (${inactiveCategories.length})`}
                </button>
              ) : null}
              {canCreateCategory ? (
                <button
                  type="button"
                  className="service-admin-button service-admin-button-small"
                  onClick={() => openCategoryForm(null)}
                >
                  New category
                </button>
              ) : null}
            </div>
          </div>
          <div className="service-admin-table-wrap">
            <table className="service-admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Unit price</th>
                  <th>Max B/F</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleCategories.map((category) => {
                  const hasExtras =
                    category.maxArea != null ||
                    category.areaFee != null ||
                    category.timelineDays != null ||
                    category.timelineFee != null
                  const reactivating = reactivatingCategoryId === category.id
                  return (
                    <tr
                      key={category.id}
                      className={category.active ? undefined : 'service-admin-table-row--inactive'}
                    >
                      <td>
                        <b>{category.name}</b>
                        <div className="service-admin-row-subtitle">
                          {category.categoryType}
                          {hasExtras ? ' · Construction extras' : ''}
                        </div>
                      </td>
                      <td>{formatCurrency(category.unitPrice)}</td>
                      <td>
                        {category.maxBedrooms} / {category.maxFloors}
                      </td>
                      <td>
                        {!category.active ? (
                          <span className="service-admin-state-pill service-admin-state-pill--skipped">
                            Inactive
                          </span>
                        ) : null}
                        {category.active && canEditPricing ? (
                          <button
                            type="button"
                            className="service-admin-button service-admin-button-small"
                            onClick={() => openCategoryForm(category)}
                          >
                            Edit
                          </button>
                        ) : null}
                        {!category.active && canEditPricing && onReactivateCategory ? (
                          <button
                            type="button"
                            className="service-admin-button service-admin-button-small"
                            disabled={reactivating}
                            onClick={() => onReactivateCategory(category)}
                          >
                            {reactivating ? 'Reactivating…' : 'Reactivate'}
                          </button>
                        ) : null}
                        {category.active && canDeactivateCategory && onDeactivateCategory ? (
                          confirmingDeactivateId === category.id ? (
                            <>
                              <button
                                type="button"
                                className="service-admin-button service-admin-button-small"
                                disabled={deactivatingCategoryId === category.id}
                                onClick={() => {
                                  onDeactivateCategory(category.id)
                                  setConfirmingDeactivateId(null)
                                }}
                              >
                                {deactivatingCategoryId === category.id ? 'Removing…' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                className="service-admin-button service-admin-button-small"
                                onClick={() => setConfirmingDeactivateId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="service-admin-button service-admin-button-small"
                              onClick={() => setConfirmingDeactivateId(category.id)}
                            >
                              Deactivate
                            </button>
                          )
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </LibraryModal>
      ) : null}

      {attachFor ? (
        <LibraryModal
          title={`Attach a service to ${attachCalculator?.name ?? attachFor}`}
          onClose={closeAttach}
          footer={
            <>
              <button type="button" className="service-admin-button" onClick={closeAttach}>
                Cancel
              </button>
              <button
                type="button"
                className="service-admin-button service-admin-button-primary"
                disabled={!attachServiceId || !attachFor || attachingServiceId != null}
                onClick={() => {
                  const serviceId = Number(attachServiceId)
                  if (!Number.isFinite(serviceId) || serviceId <= 0 || !attachFor) return
                  if (attachReplaces && !confirmingReplace) {
                    setConfirmingReplace(true)
                    return
                  }
                  onAttach?.(serviceId, attachFor)
                  closeAttach()
                }}
              >
                {attachingServiceId != null
                  ? 'Attaching…'
                  : attachReplaces && !confirmingReplace
                    ? 'Replace calculator'
                    : confirmingReplace
                      ? 'Confirm replace'
                      : 'Attach'}
              </button>
            </>
          }
        >
          <div className="service-admin-form-grid">
            <div className="f">
              <label>Parent service</label>
              <DropdownSelect
                placeholder="All parents"
                options={parentGroups.map((group) => ({
                  value: group.key,
                  label: group.name,
                }))}
                value={attachParent}
                onChange={(value) => {
                  setAttachParent(value)
                  setAttachServiceId('')
                  setConfirmingReplace(false)
                }}
              />
            </div>
            <div className="f">
              <label>Service</label>
              <DropdownSelect
                placeholder={
                  attachableServices.length === 0 ? 'No services here' : 'Select a service'
                }
                options={attachableServices.map((service) => ({
                  value: service.id,
                  label: service.activeCalculator
                    ? `${service.name} (${service.activeCalculator.code})`
                    : service.name,
                }))}
                value={attachServiceId}
                onChange={(value) => {
                  setAttachServiceId(value)
                  setConfirmingReplace(false)
                }}
              />
            </div>
          </div>
          {attachReplaces && attachTarget && attachFor ? (
            <div className="service-admin-notice service-admin-notice-yellow">
              <b>{attachTarget.name}</b> is attached to <b>{attachTargetCode}</b>.
              <div className="service-admin-attach-map">
                <span>{attachTargetCode}</span>
                <span className="service-admin-attach-map-arrow" aria-hidden="true">
                  →
                </span>
                <span>{attachFor}</span>
              </div>
            </div>
          ) : null}
        </LibraryModal>
      ) : null}

      {unitPriceOpen && canEditPricing && onSaveUnitPrice ? (
        <LibraryModal
          title="Edit unit price"
          onClose={() => setUnitPriceOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="service-admin-button"
                onClick={() => setUnitPriceOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="service-admin-button service-admin-button-primary"
                disabled={savingPricing || (unitPriceDraft ?? unitPrice ?? 0) <= 0}
                onClick={() => {
                  const next = unitPriceDraft ?? unitPrice ?? 0
                  if (next <= 0) return
                  onSaveUnitPrice(next)
                  setUnitPriceDraft(null)
                  setUnitPriceOpen(false)
                }}
              >
                {savingPricing ? 'Saving…' : 'Save unit price'}
              </button>
            </>
          }
        >
          <div className="service-admin-card-subtitle">
            Current: {unitPrice == null ? 'Not set' : formatCurrency(unitPrice)}
          </div>
          <div className="service-admin-form-grid">
            <div className="f full">
              <label>New unit price (₦)</label>
              <input
                type="number"
                min="0"
                value={formatNumberFieldValue(unitPriceDraft ?? unitPrice ?? 0)}
                onChange={(event) => setUnitPriceDraft(parseNumberFieldValue(event.target.value))}
              />
            </div>
          </div>
        </LibraryModal>
      ) : null}

      {categoryFormOpen && (canCreateCategory || canEditPricing) && onSaveCategory ? (
        <LibraryModal
          title={editingCategoryId == null ? 'New category' : 'Edit category'}
          onClose={() => setCategoryFormOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="service-admin-button"
                onClick={() => setCategoryFormOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="service-admin-button service-admin-button-primary"
                disabled={savingPricing}
                onClick={() => {
                  saveCategoryForm()
                }}
              >
                {savingPricing ? 'Saving…' : editingCategoryId == null ? 'Create' : 'Save'}
              </button>
            </>
          }
        >
          {categoryError ? (
            <div className="service-admin-notice service-admin-notice-red">{categoryError}</div>
          ) : null}
          <div className="service-admin-form-grid">
            <div className="f">
              <label>Name</label>
              <input
                value={categoryForm.name}
                disabled={editingCategoryId != null}
                title={
                  editingCategoryId != null
                    ? 'Name is locked — estimates reference this category by name'
                    : undefined
                }
                onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
              />
            </div>
            <div className="f">
              <label>Type</label>
              <input
                value={categoryForm.categoryType}
                placeholder="bungalow, duplex, terrace…"
                onChange={(event) =>
                  setCategoryForm({ ...categoryForm, categoryType: event.target.value })
                }
              />
            </div>
            <div className="f">
              <label>Unit price (₦)</label>
              <input
                type="number"
                min="0"
                value={formatNumberFieldValue(categoryForm.unitPrice)}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    unitPrice: parseNumberFieldValue(event.target.value),
                  })
                }
              />
            </div>
            <div className="f">
              <label>Max bedrooms included</label>
              <input
                type="number"
                min="0"
                step="1"
                value={formatNumberFieldValue(categoryForm.maxBedrooms)}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    maxBedrooms: Math.max(
                      0,
                      Math.floor(parseNumberFieldValue(event.target.value) || 0),
                    ),
                  })
                }
              />
            </div>
            <div className="f">
              <label>Max floors included</label>
              <input
                type="number"
                min="0"
                step="1"
                value={formatNumberFieldValue(categoryForm.maxFloors)}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    maxFloors: Math.max(
                      0,
                      Math.floor(parseNumberFieldValue(event.target.value) || 0),
                    ),
                  })
                }
              />
            </div>
            <div className="f">
              <label>Extra bedroom fee (₦)</label>
              <input
                type="number"
                min="0"
                value={formatNumberFieldValue(categoryForm.extraBedroomFee)}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    extraBedroomFee: parseNumberFieldValue(event.target.value),
                  })
                }
              />
            </div>
            <div className="f">
              <label>Extra floor fee (₦)</label>
              <input
                type="number"
                min="0"
                value={formatNumberFieldValue(categoryForm.extraFloorFee)}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    extraFloorFee: parseNumberFieldValue(event.target.value),
                  })
                }
              />
            </div>
            <div className="f full">
              <label
                className={`service-admin-toggle-row${categoryExtrasOn ? 'service-admin-toggle-row--on' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={categoryExtrasOn}
                  onChange={(event) => setCategoryExtrasOn(event.target.checked)}
                />
                <span>
                  <b>Construction extras</b>
                  <small>
                    Area and timeline fees — only used by Building Construction estimates.
                  </small>
                </span>
              </label>
            </div>
          </div>
          {categoryExtrasOn ? (
            <div className="service-admin-form-grid">
              <div className="f">
                <label>Max area (sqm)</label>
                <input
                  type="number"
                  min="0"
                  value={formatNumberFieldValue(categoryForm.maxArea ?? 0)}
                  onChange={(event) =>
                    setCategoryForm({
                      ...categoryForm,
                      maxArea: parseNumberFieldValue(event.target.value) || null,
                    })
                  }
                />
              </div>
              <div className="f">
                <label>Area fee (₦)</label>
                <input
                  type="number"
                  min="0"
                  value={formatNumberFieldValue(categoryForm.areaFee ?? 0)}
                  onChange={(event) =>
                    setCategoryForm({
                      ...categoryForm,
                      areaFee: parseNumberFieldValue(event.target.value) || null,
                    })
                  }
                />
              </div>
              <div className="f">
                <label>Timeline days</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formatNumberFieldValue(categoryForm.timelineDays ?? 0)}
                  onChange={(event) =>
                    setCategoryForm({
                      ...categoryForm,
                      timelineDays:
                        Math.floor(parseNumberFieldValue(event.target.value) || 0) || null,
                    })
                  }
                />
              </div>
              <div className="f">
                <label>Timeline fee (₦)</label>
                <input
                  type="number"
                  min="0"
                  value={formatNumberFieldValue(categoryForm.timelineFee ?? 0)}
                  onChange={(event) =>
                    setCategoryForm({
                      ...categoryForm,
                      timelineFee: parseNumberFieldValue(event.target.value) || null,
                    })
                  }
                />
              </div>
            </div>
          ) : null}
        </LibraryModal>
      ) : null}
    </div>
  )
}

export function RequestFormBuilderScreen({
  services,
  selectedServiceId,
  onSelectedServiceChange,
  form,
  fieldTypes,
  saving = false,
  onSave,
}: {
  services: ServiceCatalogueItem[]
  selectedServiceId: string
  onSelectedServiceChange: (serviceId: string) => void
  form: ServiceRequestForm | null
  fieldTypes: RequestFieldTypeOption[]
  saving?: boolean
  onSave?: (input: SaveRequestFormInput) => void
}) {
  const canEdit = Boolean(onSave)
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? services[0] ?? null
  const formSourceKey = `${selectedService?.id ?? ''}:${form?.id ?? 'new'}:${form?.updatedAt ?? ''}`

  const [draftKey, setDraftKey] = useState(formSourceKey)
  const [formStatus, setFormStatus] = useState<ServiceRequestForm['status']>(
    form?.status ?? 'draft',
  )
  const [fields, setFields] = useState<RequestFormField[]>(form?.fields ?? [])

  if (formSourceKey !== draftKey) {
    setDraftKey(formSourceKey)
    setFormStatus(form?.status ?? 'draft')
    setFields(form?.fields ?? [])
  }

  const saveDisabled = !canEdit || !selectedService || saving

  const saveForm = () => {
    if (!selectedService || !onSave) return

    onSave({
      ...(form?.id ? { id: form.id } : {}),
      name: form?.name ?? `${selectedService.name} Request Form`,
      serviceId: selectedService.id,
      status: formStatus,
      fields,
    })
  }

  return (
    <div className="service-admin-page service-admin-content">
      <RequestFormBuilderPanel
        fieldTypes={fieldTypes}
        fields={fields}
        onFieldsChange={setFields}
        formStatus={formStatus}
        onFormStatusChange={setFormStatus}
        canEdit={canEdit && Boolean(selectedService)}
        emptyTitle={selectedService ? 'No fields on this form yet' : 'No service selected'}
        emptyDescription={
          selectedService
            ? 'Add fields from the palette to define what clients must provide for this service.'
            : 'Choose a service to start designing its request form.'
        }
        headerAction={
          <DropdownSelect
            label="Service"
            compact
            className="service-admin-request-service-dropdown"
            placeholder={services.length === 0 ? 'Create a service first' : 'Select a service'}
            disabled={services.length === 0}
            options={services.map((service) => ({
              value: String(service.id),
              label: service.name,
            }))}
            value={selectedService?.id != null ? String(selectedService.id) : ''}
            onChange={(value) => onSelectedServiceChange(value)}
          />
        }
        paletteFooter={
          <RequestFormBuilderSaveButton
            canEdit={canEdit}
            disabled={saveDisabled}
            saving={saving}
            onClick={saveForm}
          />
        }
      />
    </div>
  )
}
