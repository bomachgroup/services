import {
  IconArrowLeft,
  IconArrowUpRight,
  IconBuildingStore,
  IconChevronDown,
  IconFilePlus,
  IconFileText,
  IconFiles,
  IconHistory,
  IconHome,
  IconMap2,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '@/app/auth'
import { SectionLoadingState } from '@/app/loading/SectionLoadingState'
import { canPerformAction, hasPermission, PERMISSIONS } from '@/app/permissions'
import type { AppSectionSearch } from '@/routes/app/$section'
import { presentError } from '@/shared/errors'
import { formatCurrency } from '@/shared/lib/formatters'
import { withoutSearchKeys } from '@/shared/navigation/search-state'
import { ErrorState, useToast } from '@/shared/ui'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { DropdownSelect } from '@/shared/ui/dropdown-select'
import { EmptyState } from '@/shared/ui/empty-state'
import {
  CompactActionButton,
  CompactPageToolbar,
  ModulePageFrame,
} from '@/shared/ui/module-controls'

import { EstateLocationMap } from '../real-estate/EstateLocationMap'
import { NamedDocumentsPanel } from '../real-estate/NamedDocumentsPanel'
import { hasViewableDocuments } from '../real-estate/named-documents.utils'
import { isValidBoundary } from '../real-estate/real-estate-map.utils'
import { realEstateApi } from '../real-estate/real-estate.api'
import { realEstateKeys } from '../real-estate/real-estate.keys'
import { realEstateQueries } from '../real-estate/real-estate.queries'
import { PropertyPriceField } from '../components/PropertyPriceField'
import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'
import {
  propertyStatuses,
  type BrokerageVerificationStatus,
  type CreateBrokerageInput,
  type CreatePropertyInput,
  type PricingMode,
  type Property,
  type PropertyStatus,
  type QuickUpdatePlotInput,
} from '../real-estate/real-estate.types'
import { validateQuickPlotUpdate } from '../real-estate/real-estate.validation'

const BatchCreatePropertiesWorkspace = lazy(() =>
  import('../workspaces/BatchCreatePropertiesWorkspace').then((module) => ({
    default: module.BatchCreatePropertiesWorkspace,
  })),
)

const CreateBrokerageLiveWorkspace = lazy(() =>
  import('../workspaces/CreateBrokerageLiveWorkspace').then((module) => ({
    default: module.CreateBrokerageLiveWorkspace,
  })),
)

const EditPropertyLiveWorkspace = lazy(() =>
  import('../workspaces/EditPropertyLiveWorkspace').then((module) => ({
    default: module.EditPropertyLiveWorkspace,
  })),
)

const PropertyDetailLiveWorkspace = lazy(() =>
  import('../workspaces/PropertyDetailLiveWorkspace').then((module) => ({
    default: module.PropertyDetailLiveWorkspace,
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

import '../../commercial/styles/commercial.css'
import '../styles/specialized-services.css'

function statusClass(status: PropertyStatus) {
  if (status === 'available') return 'av'
  if (status === 'under_offer') return 'uo'
  if (status === 'reserved') return 'rs'
  if (status === 'sold') return 'sd'
  return 'hd'
}

function kpiTone(label: string) {
  if (label === 'Sold') return 'sd'
  if (label === 'Reserved') return 'rs'
  if (label === 'Under offer') return 'uo'
  if (label === 'Available') return 'av'
  return 'nt'
}
function TypeIcon({ property }: { property: Property }) {
  if (property.propertyType === 'plot') return <IconMap2 size={16} stroke={1.75} />
  if (property.propertyType === 'residential') return <IconHome size={16} stroke={1.75} />
  return <IconBuildingStore size={16} stroke={1.75} />
}

/**
 * Side-by-side accordion: two headers in a row, single-open, content spans
 * full width underneath. Opening one closes the other.
 */
function LocationDocumentsAccordion({
  locationSummary,
  documentsSummary,
  locationContent,
  documentsContent,
  showLocation,
  showDocuments,
}: {
  locationSummary?: string | undefined
  documentsSummary?: string | undefined
  locationContent: ReactNode
  documentsContent: ReactNode
  showLocation: boolean
  showDocuments: boolean
}) {
  const [openSection, setOpenSection] = useState<'location' | 'documents' | null>(null)

  // If a section disappears (e.g. no boundary), close it.
  const effectiveOpen =
    (openSection === 'location' && !showLocation) || (openSection === 'documents' && !showDocuments)
      ? null
      : openSection

  const toggle = (section: 'location' | 'documents') => {
    setOpenSection((current) => (current === section ? null : section))
  }

  if (!showLocation && !showDocuments) return null

  const renderHeader = (
    key: 'location' | 'documents',
    title: string,
    subtitle: string,
    summary?: string,
  ) => {
    const expanded = effectiveOpen === key
    const Icon = key === 'location' ? IconMap2 : IconFiles
    return (
      <button
        key={key}
        type="button"
        className={`specialized-card specialized-accordion-header specialized-accordion-header--${key}${expanded ? 'is-expanded' : 'is-collapsed'}`}
        aria-expanded={expanded}
        onClick={() => toggle(key)}
      >
        <span
          className={`specialized-accordion-icon specialized-accordion-icon--${key}`}
          aria-hidden="true"
        >
          <Icon size={18} stroke={1.9} />
        </span>
        <span className="specialized-accordion-text">
          <span className="specialized-accordion-title-row">
            <span className="specialized-card-title">{title}</span>
            {summary ? <span className="specialized-accordion-count">{summary}</span> : null}
          </span>
          <span className="specialized-card-subtitle">{subtitle}</span>
        </span>
        <span className="specialized-foldable-toggle-icon" aria-hidden="true">
          <IconChevronDown size={16} stroke={2} />
        </span>
      </button>
    )
  }

  return (
    <div className="specialized-location-documents-accordion">
      <div className="specialized-location-documents-row">
        {showLocation
          ? renderHeader(
              'location',
              'Estate Location',
              'Boundary shown on the map. Hover a property outline for its status.',
              locationSummary,
            )
          : null}
        {showDocuments
          ? renderHeader(
              'documents',
              'Estate Documents',
              'Estate documents. Select one to preview it.',
              documentsSummary,
            )
          : null}
      </div>
      {effectiveOpen ? (
        <section className="specialized-card specialized-foldable-card is-expanded specialized-accordion-body">
          <div className="specialized-foldable-body">
            {effectiveOpen === 'location' ? locationContent : documentsContent}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function estateBoardLabel(property: Property) {
  if (property.plotNumber != null) return `Plot ${property.plotNumber}`
  const match = property.propertyName.match(/^plot\s*0*(\d+)$/i)
  if (match) return `Plot ${Number(match[1])}`
  return property.propertyName
}
function secondary(property: Property) {
  if (property.propertyType === 'plot')
    return `${property.plotSize ?? '-'} ${property.plotSizeUnit || 'sqm'}`
  if (property.propertyType === 'residential')
    return `${property.buildingTypeResidentialDisplay || property.buildingTypeResidential || 'Residential'} · ${property.bedrooms ?? '-'} bed · ${property.bathrooms ?? '-'} bath`
  return `${property.buildingTypeCommercialDisplay || property.buildingTypeCommercial || 'Commercial'} · ${property.numberOfFloors ?? '-'} floor(s) · ${property.unitsOffices ?? '-'} unit(s)`
}

function historyPriceLabel(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return formatCurrency(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? formatCurrency(parsed) : null
  }
  return null
}

function historyEventTitle(event: {
  event: string
  reason: string
  data: Record<string, unknown>
}) {
  const oldPrice = historyPriceLabel(event.data.old_price ?? event.data.oldPrice)
  const newPrice = historyPriceLabel(event.data.new_price ?? event.data.newPrice)
  const setPrice = historyPriceLabel(event.data.price)

  if (oldPrice && newPrice) return `From ${oldPrice} to ${newPrice}`
  if (newPrice) return newPrice
  if (setPrice) return setPrice
  if (oldPrice) return oldPrice
  return 'Price updated'
}

function historyEventDetail(event: {
  event: string
  reason: string
  data: Record<string, unknown>
}) {
  const parts: string[] = []
  const mode = event.data.pricing_mode ?? event.data.pricingMode
  if (typeof mode === 'string' && mode.trim()) {
    parts.push(mode.replace(/_/g, ' '))
  }
  if (event.reason?.trim()) {
    parts.push(event.reason.trim())
  } else if (event.event?.trim()) {
    parts.push(event.event.replace(/_/g, ' '))
  }
  return parts.join(' · ')
}

function historyChangedByLabel(changedBy: number | null, reason: string) {
  if (changedBy != null) return `User #${changedBy}`
  if (/migration/i.test(reason)) return 'System migration'
  return 'System'
}

function propertyAreaSqm(property: Property) {
  if (property.effectivePricing?.areaSqm != null) return property.effectivePricing.areaSqm
  if (property.propertyType === 'plot') return property.plotSize
  if (property.propertyType === 'residential') return property.totalAreaResidential
  return property.totalAreaCommercial
}

/**
 * Status-aware next action. Available starts a request.
 * Sold opens the closing invoice. Reserved opens the invoice or request.
 * Under offer opens the active request. Hold and not-for-sale are hidden by the caller.
 */
function PropertyNextStep({
  status,
  statusDisplay,
  clientName,
  canCreateServiceRequest,
  historyLoading,
  requestId,
  requestNumber,
  quoteNumber,
  invoiceNumber,
  onCreateRequest,
}: {
  status: Property['status']
  statusDisplay: string
  clientName: string
  canCreateServiceRequest: boolean
  historyLoading: boolean
  requestId: number | null
  requestNumber: string
  quoteNumber: string
  invoiceNumber: string
  onCreateRequest: () => void
}) {
  const navigate = useNavigate()

  const goRequest = () =>
    requestId
      ? void navigate({
          to: '/app/$section',
          params: { section: 'service-requests' },
          search: { request: String(requestId) },
        })
      : undefined
  const goInvoice = () =>
    invoiceNumber.trim()
      ? void navigate({
          to: '/app/$section',
          params: { section: 'invoices-payments' },
          search: { search: invoiceNumber.trim() },
        })
      : undefined
  const goQuote = () =>
    quoteNumber.trim()
      ? void navigate({
          to: '/app/$section',
          params: { section: 'quotations' },
          search: { search: quoteNumber.trim() },
        })
      : undefined

  if (status === 'available') {
    const allowed = canCreateServiceRequest
    return (
      <div className={`specialized-property-next-step${allowed ? '' : 'is-muted'}`}>
        <div className="specialized-property-next-step-copy">
          <span>Recommended action</span>
          <strong>Sell this property</strong>
          <small>
            {allowed
              ? 'Start the property sale with this asset already selected.'
              : 'You do not have permission to start a property sale.'}
          </small>
        </div>
        <button
          type="button"
          className="commercial-btn commercial-btn-primary"
          disabled={!allowed}
          onClick={onCreateRequest}
        >
          Sell property
        </button>
      </div>
    )
  }

  if (status === 'sold') {
    return (
      <div className="specialized-property-next-step">
        <div className="specialized-property-next-step-copy">
          <span>Recommended action</span>
          <strong>Sale completed. Review the closing invoice</strong>
          <small>
            {clientName?.trim()
              ? `This property was sold to ${clientName.trim()}. `
              : 'This property has been sold. '}
            New requests are unavailable to prevent a duplicate sale.
            {historyLoading
              ? ' Loading records…'
              : invoiceNumber.trim()
                ? ` Closing invoice ${invoiceNumber.trim()} is available.`
                : ''}
          </small>
        </div>
        <div className="specialized-property-next-step-actions">
          <button
            type="button"
            className="commercial-btn commercial-btn-primary"
            disabled={!invoiceNumber.trim()}
            onClick={goInvoice}
          >
            <IconReceipt size={14} />
            Open closing invoice
          </button>
          {requestId ? (
            <button type="button" className="commercial-btn" onClick={goRequest}>
              <IconFileText size={14} />
              Open service request
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  if (status === 'reserved') {
    return (
      <div className="specialized-property-next-step">
        <div className="specialized-property-next-step-copy">
          <span>Recommended action</span>
          <strong>Reservation in progress. Review the hold</strong>
          <small>
            {clientName?.trim() ? `Reserved for ${clientName.trim()}. ` : ''}
            {historyLoading
              ? 'Loading records…'
              : invoiceNumber.trim()
                ? `Reservation invoice ${invoiceNumber.trim()} is available.`
                : requestNumber.trim()
                  ? `Service request ${requestNumber.trim()} is associated with this hold.`
                  : 'Review the reservation details before releasing the property.'}
          </small>
        </div>
        <div className="specialized-property-next-step-actions">
          {invoiceNumber.trim() ? (
            <button
              type="button"
              className="commercial-btn commercial-btn-primary"
              onClick={goInvoice}
            >
              <IconReceipt size={14} />
              Open reservation invoice
            </button>
          ) : requestId ? (
            <button
              type="button"
              className="commercial-btn commercial-btn-primary"
              onClick={goRequest}
            >
              <IconFileText size={14} />
              Open service request
            </button>
          ) : null}
          {invoiceNumber.trim() && requestId ? (
            <button type="button" className="commercial-btn" onClick={goRequest}>
              <IconFileText size={14} />
              Open service request
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  if (status === 'under_offer') {
    return (
      <div className="specialized-property-next-step">
        <div className="specialized-property-next-step-copy">
          <span>Recommended action</span>
          <strong>Offer in progress. Follow the active request</strong>
          <small>
            {requestNumber.trim()
              ? `This property is linked to service request ${requestNumber.trim()}.`
              : 'This property is linked to another active service request.'}
          </small>
        </div>
        <div className="specialized-property-next-step-actions">
          <button
            type="button"
            className="commercial-btn commercial-btn-primary"
            disabled={!requestId}
            onClick={goRequest}
          >
            <IconFileText size={14} />
            Open service request
          </button>
          {quoteNumber.trim() ? (
            <button type="button" className="commercial-btn" onClick={goQuote}>
              Open quotation
              <IconArrowUpRight size={13} />
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="specialized-property-next-step is-muted">
      <div className="specialized-property-next-step-copy">
        <span>Current status</span>
        <strong>{statusDisplay}</strong>
        <small>
          This status does not allow a new service request. Review the property details for next
          steps.
        </small>
      </div>
    </div>
  )
}

function SelectedPropertyForm({
  selectedEstateName,
  estatePricePerSqm,
  selectedProperty,
  canPropertyUpdate,
  canPropertyDelete,
  canCreateServiceRequest,
  updatePending,
  formError,
  setFormError,
  onSubmit,
  onCreateRequest,
  onDelete,
  onViewDetails,
  onClose,
}: {
  selectedEstateName: string
  estatePricePerSqm: number | null
  selectedProperty: Property
  canPropertyUpdate: boolean
  canPropertyDelete: boolean
  canCreateServiceRequest: boolean
  updatePending: boolean
  formError: string
  setFormError: (value: string) => void
  onSubmit: (input: QuickUpdatePlotInput) => void
  onCreateRequest: () => void
  onDelete: () => void
  onViewDetails: () => void
  onClose: () => void
}) {
  const [propertyStatusDraft, setPropertyStatusDraft] = useState<PropertyStatus>(
    selectedProperty.status,
  )
  const [pricingMode, setPricingMode] = useState<PricingMode>(selectedProperty.pricingMode)
  const [price, setPrice] = useState<number | null>(selectedProperty.price)
  const needsHistory =
    selectedProperty.status === 'sold' ||
    selectedProperty.status === 'reserved' ||
    selectedProperty.status === 'under_offer'
  const historyQuery = useQuery({
    ...realEstateQueries.propertyCommercialHistory(selectedProperty.id),
    enabled: needsHistory,
    retry: false,
  })
  // The backend marks the current commercial transaction explicitly. Do not
  // infer it from dates, request status, or invoice presence.
  const bestHistory = (historyQuery.data ?? []).find((item) => item.isCurrent) ?? null
  const statusLocked =
    selectedProperty.status === 'under_offer' ||
    selectedProperty.status === 'reserved' ||
    selectedProperty.status === 'sold'
  const editableStatuses = propertyStatuses.filter(
    (option) =>
      option.value !== 'under_offer' && option.value !== 'reserved' && option.value !== 'sold',
  )
  const priceHistory = selectedProperty.pricingHistory.slice().reverse()
  const areaSqm = propertyAreaSqm(selectedProperty)
  const estateRate = estatePricePerSqm ?? selectedProperty.effectivePricing?.estateRate ?? null
  const computedEstatePrice =
    estateRate != null && areaSqm != null && areaSqm > 0 ? estateRate * areaSqm : null

  return (
    <form
      className="specialized-selected-property-form"
      onSubmit={(event) => {
        event.preventDefault()
        const d = new FormData(event.currentTarget)
        const clientValue = d.get('clientName')
        const input: QuickUpdatePlotInput = {
          ...(statusLocked ? {} : { status: propertyStatusDraft }),
          clientName:
            typeof clientValue === 'string' ? clientValue.trim() : selectedProperty.clientName,
          pricingMode,
          price: pricingMode === 'manual_override' ? price : null,
        }
        const validationError = validateQuickPlotUpdate(input)
        setFormError(validationError)
        if (!validationError) onSubmit(input)
      }}
    >
      <div className="commercial-modal-body">
        <section className="commercial-form-section">
          <div className="commercial-form-section-heading">
            <div>
              <h3>Overview</h3>
              <p>Identity and current inventory state for this estate unit.</p>
            </div>
          </div>
          <div className="specialized-selected-property">
            <div className="specialized-selected-property-icon">
              <TypeIcon property={selectedProperty} />
            </div>
            <div>
              <strong>{selectedProperty.propertyName}</strong>
              <span>{selectedProperty.propertyTypeDisplay || selectedProperty.propertyType}</span>
              <small>{secondary(selectedProperty)}</small>
            </div>
          </div>
          <div className="commercial-info-grid">
            <div>
              <div className="commercial-kl">Status</div>
              <b>{selectedProperty.statusDisplay || selectedProperty.status}</b>
            </div>
            <div>
              <div className="commercial-kl">Estate</div>
              <b>{selectedEstateName}</b>
            </div>
            <div>
              <div className="commercial-kl">Pricing</div>
              <b>{pricingMode === 'estate_rate' ? 'Estate rate' : 'Manual override'}</b>
            </div>
            <div>
              <div className="commercial-kl">Current price</div>
              <b>
                {formatCurrency(
                  pricingMode === 'estate_rate'
                    ? (computedEstatePrice ?? selectedProperty.price)
                    : (price ?? selectedProperty.price),
                )}
              </b>
            </div>
          </div>
        </section>

        {selectedProperty.status === 'hold' || selectedProperty.status === 'not-for-sale' ? null : (
          <PropertyNextStep
            status={selectedProperty.status}
            statusDisplay={selectedProperty.statusDisplay || selectedProperty.status}
            clientName={selectedProperty.clientName}
            canCreateServiceRequest={canCreateServiceRequest}
            historyLoading={historyQuery.isLoading}
            requestId={bestHistory?.requestId ?? null}
            requestNumber={bestHistory?.requestNumber ?? ''}
            quoteNumber={bestHistory?.quoteNumber ?? ''}
            invoiceNumber={bestHistory?.invoiceNumber ?? ''}
            onCreateRequest={onCreateRequest}
          />
        )}

        <section className="commercial-form-section">
          <div className="commercial-form-section-heading">
            <div>
              <h3>Inventory</h3>
              <p>Quick updates for status and property pricing.</p>
            </div>
          </div>

          <div className="commercial-form-grid">
            {statusLocked ? (
              <label className="commercial-field">
                <span>Status</span>
                <input value={selectedProperty.statusDisplay || selectedProperty.status} disabled />
              </label>
            ) : (
              <RealEstateFormDropdown
                label="Status"
                fieldClassName="commercial-field"
                options={editableStatuses}
                value={propertyStatusDraft}
                disabled={!canPropertyUpdate}
                fullWidth={false}
                onChange={(value) => setPropertyStatusDraft(value as PropertyStatus)}
              />
            )}

            <PropertyPriceField
              hasEstate
              pricingMode={pricingMode}
              price={price}
              computedEstatePrice={computedEstatePrice}
              estateRatePerSqm={estateRate}
              areaSqm={areaSqm}
              disabled={!canPropertyUpdate}
              onPricingModeChange={(mode) => {
                setPricingMode(mode)
                if (mode === 'estate_rate') setPrice(null)
                else if ((price == null || price <= 0) && computedEstatePrice)
                  setPrice(computedEstatePrice)
              }}
              onPriceChange={setPrice}
            />

            {selectedProperty.clientName ? (
              <label className="commercial-field commercial-field--full">
                <span>Client / reservation holder</span>
                <input name="clientName" defaultValue={selectedProperty.clientName} disabled />
              </label>
            ) : null}
          </div>

          {formError ? (
            <div className="commercial-notice commercial-notice-red">{formError}</div>
          ) : null}
        </section>

        {priceHistory.length ? (
          <details className="specialized-price-history-panel">
            <summary className="specialized-price-history-summary">
              <IconHistory size={14} stroke={1.75} />
              <span>Price history</span>
              <span className="specialized-price-history-count">{priceHistory.length}</span>
            </summary>
            <div className="specialized-price-history">
              {priceHistory.map((event, index) => (
                <div key={`${event.at}-${index}`} className="specialized-price-history-row">
                  <div className="specialized-price-history-row-main">
                    <strong>{historyEventTitle(event)}</strong>
                    <span className="specialized-price-history-meta">
                      {historyEventDetail(event)}
                      {' · '}
                      {historyChangedByLabel(event.changedBy, event.reason)}
                    </span>
                  </div>
                  <time dateTime={event.at || undefined}>
                    {event.at ? new Date(event.at).toLocaleString() : 'Date unavailable'}
                  </time>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <footer className="commercial-modal-footer">
        <div className="commercial-modal-footer-start">
          {canPropertyDelete ? (
            <button
              type="button"
              className="commercial-btn specialized-selected-delete"
              onClick={onDelete}
            >
              <IconTrash size={14} />
              Delete
            </button>
          ) : null}
        </div>
        <div className="commercial-modal-footer-actions">
          <button type="button" className="commercial-btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="commercial-btn" onClick={onViewDetails}>
            View Details
          </button>
          <button
            type="submit"
            className="commercial-btn commercial-btn-primary"
            disabled={!canPropertyUpdate || updatePending}
          >
            Save Inventory
          </button>
        </div>
      </footer>
    </form>
  )
}

export function RealEstateInventoryLivePage({ recordSearch }: { recordSearch: AppSectionSearch }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const estateId = recordSearch.estate ? Number(recordSearch.estate) : null
  const propertyId = recordSearch.property ? Number(recordSearch.property) : null

  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [brokerageOpen, setBrokerageOpen] = useState(false)
  const [propertyViewOpen, setPropertyViewOpen] = useState(false)
  const [propertyEditOpen, setPropertyEditOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [propertyFilters, setPropertyFilters] = useState<{
    estateId: number | null
    status: PropertyStatus | ''
    type: Property['propertyType'] | ''
  }>({ estateId: null, status: '', type: '' })

  const canEstateList = hasPermission(user, PERMISSIONS.estatesList)
  const canEstateView = hasPermission(user, PERMISSIONS.estatesView)
  const canPropertyList = hasPermission(user, PERMISSIONS.propertiesList)
  const canPropertyCreate = hasPermission(user, PERMISSIONS.propertiesCreate)
  const canPropertyUpdate = hasPermission(user, PERMISSIONS.propertiesUpdate)
  const canPropertyDelete = hasPermission(user, PERMISSIONS.propertiesDelete)
  const canBrokerageList = hasPermission(user, PERMISSIONS.brokerageList)
  const canBrokerageCreate = hasPermission(user, PERMISSIONS.brokerageCreate)
  const canBrokerageUpdate = hasPermission(user, PERMISSIONS.brokerageUpdate)
  const canBrokerageDelete = hasPermission(user, PERMISSIONS.brokerageDelete)
  const canServiceRequestUpdate = hasPermission(user, PERMISSIONS.serviceRequestsUpdate)
  const canCreateServiceRequest = canPerformAction(user, 'requestCreate')
  const canCreateService = canPerformAction(user, 'serviceCreate')

  const estatesQuery = useQuery({
    ...realEstateQueries.estates({ page: 1, limit: 100 }),
    enabled: canEstateList,
  })
  const detailQuery = useQuery({
    ...realEstateQueries.detail(estateId ?? 0),
    enabled: Boolean(estateId) && canEstateView,
  })
  const statsQuery = useQuery({
    ...realEstateQueries.stats(estateId ?? 0),
    enabled: Boolean(estateId) && canEstateView,
  })
  const propertiesQuery = useQuery({
    ...realEstateQueries.properties(estateId ?? 0, { page: 1, limit: 250 }),
    enabled: Boolean(estateId) && canPropertyList,
  })
  const propertyDetailQuery = useQuery({
    ...realEstateQueries.propertyDetail(estateId ?? 0, propertyId ?? 0),
    enabled: Boolean(estateId && propertyId && propertyViewOpen && canPropertyList),
  })
  const propertyCommercialHistoryQuery = useQuery({
    ...realEstateQueries.propertyCommercialHistory(propertyId ?? 0),
    enabled: Boolean(propertyId && propertyViewOpen && canPropertyList),
    retry: false,
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
  const selectedEstate =
    detailQuery.data ?? estates.find((estate) => estate.id === estateId) ?? null
  const properties = useMemo(() => propertiesQuery.data?.items ?? [], [propertiesQuery.data?.items])
  const statusFilter = propertyFilters.estateId === estateId ? propertyFilters.status : ''
  const typeFilter = propertyFilters.estateId === estateId ? propertyFilters.type : ''
  const filteredProperties = useMemo(() => {
    return properties
      .filter((property) => {
        if (statusFilter && property.status !== statusFilter) return false
        if (typeFilter && property.propertyType !== typeFilter) return false
        return true
      })
      .slice()
      .sort((left, right) => {
        const leftNumber = left.plotNumber ?? Number.POSITIVE_INFINITY
        const rightNumber = right.plotNumber ?? Number.POSITIVE_INFINITY
        if (leftNumber !== rightNumber) return leftNumber - rightNumber
        return left.propertyName.localeCompare(right.propertyName)
      })
  }, [properties, statusFilter, typeFilter])
  const selectedProperty = properties.find((property) => property.id === propertyId) ?? null
  const propertyForView = propertyDetailQuery.data ?? selectedProperty
  const expiredReservationHistory =
    propertyCommercialHistoryQuery.data?.find(
      (item) => item.isCurrent && item.commercialState === 'reservation_expired',
    ) ?? null

  useEffect(() => {
    queueMicrotask(() => {
      setPropertyViewOpen(false)
      setPropertyEditOpen(false)
      setFormError('')
    })
  }, [propertyId])

  const estateBrokerage = useMemo(
    () => (brokerageQuery.data?.items ?? []).filter((listing) => listing.estateId === estateId),
    [brokerageQuery.data?.items, estateId],
  )

  const selectStatusFilter = useCallback(
    (next: PropertyStatus | '') => {
      setPropertyFilters((current) => ({
        estateId,
        status: current.estateId === estateId && current.status === next ? '' : next,
        type: current.estateId === estateId ? current.type : '',
      }))
    },
    [estateId],
  )

  const selectTypeFilter = useCallback(
    (next: Property['propertyType'] | '') => {
      setPropertyFilters((current) => ({
        estateId,
        status: current.estateId === estateId ? current.status : '',
        type: next,
      }))
    },
    [estateId],
  )

  const clearPropertyFilters = useCallback(() => {
    setPropertyFilters({ estateId, status: '', type: '' })
  }, [estateId])

  const goToHub = useCallback(() => {
    void navigate({
      to: '/app/$section',
      params: { section: 'real-estate-inventory' },
      search: (previous) => withoutSearchKeys(previous, ['estate', 'property']),
      replace: true,
    })
  }, [navigate])

  const invalidateEstate = async (id: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: realEstateKeys.estates() }),
      queryClient.invalidateQueries({ queryKey: realEstateKeys.estateDetail(id) }),
      queryClient.invalidateQueries({ queryKey: realEstateKeys.estateStats(id) }),
      queryClient.invalidateQueries({ queryKey: realEstateKeys.properties(id) }),
      queryClient.invalidateQueries({ queryKey: realEstateKeys.portfolioStats() }),
    ])
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: QuickUpdatePlotInput }) =>
      realEstateApi.quickUpdatePropertyInventory(estateId!, id, input),
    onSuccess: async () => {
      await invalidateEstate(estateId!)
      toast.success('Property inventory updated')
    },
    onError: (error) =>
      toast.error('Property could not be updated', {
        description: presentError(error, 'form-submit').message,
      }),
  })
  const updatePropertyMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: CreatePropertyInput }) => {
      if (!selectedProperty) {
        return Promise.reject(new Error('Property not found'))
      }
      return realEstateApi.updatePropertyRecord({ id, estateId: selectedProperty.estateId }, input)
    },
    onSuccess: async () => {
      await invalidateEstate(estateId!)
      setPropertyEditOpen(false)
      setPropertyViewOpen(true)
      toast.success('Property details updated')
    },
    onError: (error) => {
      const presented = presentError(error, 'form-submit')
      if (presented.fieldErrors && Object.keys(presented.fieldErrors).length > 0) return
      toast.error('Property could not be updated', {
        description: presented.message,
      })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => realEstateApi.deleteProperty(estateId!, id),
    onSuccess: async () => {
      setDeleteId(null)
      await invalidateEstate(estateId!)
      toast.success('Property deleted')
      if (propertyId === deleteId)
        await navigate({
          to: '/app/$section',
          params: { section: 'real-estate-inventory' },
          search: (previous) => withoutSearchKeys(previous, ['property']),
          replace: true,
        })
    },
    onError: (error) =>
      toast.error('Property could not be deleted', {
        description: presentError(error, 'background-action').message,
      }),
  })
  const releaseExpiredReservationMutation = useMutation({
    mutationFn: (requestId: number) => realEstateApi.releaseExpiredReservation(requestId),
    onSuccess: async () => {
      await Promise.all([invalidateEstate(estateId!), propertyCommercialHistoryQuery.refetch()])
      toast.success('Expired reservation released', {
        description: 'The property is available for a new commercial request.',
      })
    },
    onError: (error) => {
      toast.error('Reservation could not be released', {
        description: presentError(error, 'background-action').message,
      })
    },
  })
  const createBrokerageMutation = useMutation({
    mutationFn: (input: CreateBrokerageInput) => realEstateApi.createBrokerage(input),
    onSuccess: async () => {
      setBrokerageOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: realEstateKeys.brokerage() }),
        queryClient.invalidateQueries({ queryKey: realEstateKeys.brokerageStats() }),
      ])
      toast.success('Brokerage listing added')
    },
  })
  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: BrokerageVerificationStatus }) =>
      realEstateApi.verifyBrokerage(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: realEstateKeys.brokerage() }),
        queryClient.invalidateQueries({ queryKey: realEstateKeys.brokerageStats() }),
      ])
      toast.success('Brokerage verification updated')
    },
  })
  const deleteBrokerageMutation = useMutation({
    mutationFn: (id: number) => realEstateApi.deleteBrokerage(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: realEstateKeys.brokerage() }),
        queryClient.invalidateQueries({ queryKey: realEstateKeys.brokerageStats() }),
      ])
      toast.success('Brokerage listing deleted')
    },
  })

  const initialInventoryLoading =
    Boolean(estateId) &&
    ((canEstateView && (detailQuery.isPending || statsQuery.isPending)) ||
      (canPropertyList && propertiesQuery.isPending))

  if (initialInventoryLoading) {
    return <SectionLoadingState section="real-estate-inventory" />
  }

  if (!selectedEstate && estateId) {
    return (
      <ModulePageFrame
        header={
          <CompactPageToolbar
            title="Real Estate Inventory"
            breadcrumb="Specialized Services / Real Estate"
          />
        }
      >
        <main className="specialized-content">
          <ErrorState
            title="Estate not found"
            description="This estate record could not be loaded or may have been removed."
            onRetry={() => void detailQuery.refetch()}
          />
          <div className="specialized-action-row" style={{ marginTop: '1rem' }}>
            <button type="button" className="specialized-btn" onClick={goToHub}>
              <IconArrowLeft size={14} />
              All estates
            </button>
          </div>
        </main>
      </ModulePageFrame>
    )
  }

  const brokerageList = !canBrokerageList ? (
    <div className="specialized-empty">Brokerage access not granted.</div>
  ) : estateBrokerage.length ? (
    estateBrokerage.map((listing) => (
      <div key={listing.id} className="specialized-row">
        <div className="specialized-row-main">
          <div className="specialized-row-name">{listing.title}</div>
          <div className="specialized-row-sub">
            {listing.location} · {formatCurrency(listing.price)} ·{' '}
            {listing.verificationStatus.replaceAll('_', ' ')}
          </div>
        </div>
        {canBrokerageUpdate && listing.verificationStatus !== 'verified' ? (
          <button
            type="button"
            className="specialized-btn specialized-btn-small"
            onClick={() => verifyMutation.mutate({ id: listing.id, status: 'verified' })}
          >
            Verify
          </button>
        ) : null}
        {canBrokerageDelete ? (
          <button
            type="button"
            className="specialized-btn specialized-btn-small"
            onClick={() => deleteBrokerageMutation.mutate(listing.id)}
          >
            ×
          </button>
        ) : null}
      </div>
    ))
  ) : (
    <div className="specialized-empty">No brokerage listings linked to this estate.</div>
  )

  return (
    <ModulePageFrame
      header={
        <CompactPageToolbar
          title="Real Estate Inventory"
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
        <div className="specialized-kpi-grid specialized-kpi-grid--compact">
          {(
            [
              ['total', 'Total Properties', statsQuery.data?.total, '' as const],
              ['sold', 'Sold', statsQuery.data?.sold, 'sold' as const],
              ['reserved', 'Reserved', statsQuery.data?.reserved, 'reserved' as const],
              ['under_offer', 'Under offer', statsQuery.data?.underOffer, 'under_offer' as const],
              ['available', 'Available', statsQuery.data?.available, 'available' as const],
            ] as const
          ).map(([key, label, value, filterValue]) => {
            const active = filterValue === '' ? statusFilter === '' : statusFilter === filterValue
            return (
              <button
                key={key}
                type="button"
                className={
                  active
                    ? `specialized-kpi-card specialized-kpi-card--action specialized-kpi-card--${kpiTone(label)} is-active`
                    : `specialized-kpi-card specialized-kpi-card--action specialized-kpi-card--${kpiTone(label)}`
                }
                aria-pressed={active}
                onClick={() => selectStatusFilter(filterValue)}
              >
                <div>{label}</div>
                <strong>{value ?? '-'}</strong>
              </button>
            )
          })}
        </div>

        <section className="specialized-card">
          <header className="specialized-card-header specialized-card-header-utility">
            <div>
              <div className="specialized-card-title">
                {selectedEstate!.estateCode} · {selectedEstate!.estateName}
              </div>
              <div className="specialized-card-subtitle">
                {selectedEstate!.cityTown}, {selectedEstate!.state} ·{' '}
                {selectedEstate!.estateTypeDisplay || selectedEstate!.estateType}
              </div>
            </div>
            <div className="specialized-action-row">
              <button type="button" className="specialized-btn" onClick={goToHub}>
                <IconArrowLeft size={14} />
                All estates
              </button>
              <button
                type="button"
                className="specialized-btn"
                onClick={() => {
                  void Promise.all([
                    detailQuery.refetch(),
                    statsQuery.refetch(),
                    propertiesQuery.refetch(),
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
                className="specialized-btn specialized-btn-primary"
                disabled={!canPropertyCreate}
                onClick={() => setPropertiesOpen(true)}
              >
                <IconPlus size={14} />
                Add Estate Properties
              </button>
            </div>
          </header>
        </section>

        <LocationDocumentsAccordion
          showLocation={isValidBoundary(selectedEstate!.boundary)}
          showDocuments={hasViewableDocuments(selectedEstate!.documents)}
          locationSummary={properties.length ? `${properties.length} properties` : undefined}
          documentsSummary={`${selectedEstate!.documents.length} documents`}
          locationContent={
            <EstateLocationMap
              estateBoundary={selectedEstate!.boundary}
              properties={properties}
              estateName={selectedEstate!.estateName}
            />
          }
          documentsContent={<NamedDocumentsPanel documents={selectedEstate!.documents} />}
        />

        <div className="specialized-grid-1">
          <section className="specialized-card">
            <header className="specialized-card-header">
              <div>
                <div className="specialized-card-title">Property Inventory</div>
                <div className="specialized-card-subtitle">
                  Estate units are named Plot 1, Plot 2, and so on. Icon shows type; color shows
                  status.
                </div>
              </div>
              <div className="specialized-inventory-legend">
                <DropdownSelect
                  compact
                  placeholder="All types"
                  options={[
                    { value: '', label: 'All types' },
                    { value: 'plot', label: 'Plot of land' },
                    { value: 'residential', label: 'Residential' },
                    { value: 'commercial', label: 'Commercial' },
                  ]}
                  value={typeFilter}
                  onChange={(value) => selectTypeFilter(value as Property['propertyType'] | '')}
                />
                <div className="specialized-legend">
                  <span>
                    <i className="av" />
                    Available
                  </span>
                  <span>
                    <i className="rs" />
                    Reserved
                  </span>
                  <span>
                    <i className="sd" />
                    Sold
                  </span>
                  <span>
                    <i className="hd" />
                    Hold / NFS
                  </span>
                </div>
                <div className="specialized-type-legend">
                  <span>
                    <IconMap2 size={13} />
                    Plot
                  </span>
                  <span>
                    <IconHome size={13} />
                    Residential
                  </span>
                  <span>
                    <IconBuildingStore size={13} />
                    Commercial
                  </span>
                </div>
              </div>
            </header>
            {propertiesQuery.isError ? (
              <ErrorState
                title="Property Inventory unavailable"
                description={presentError(propertiesQuery.error, 'section-load').message}
                onRetry={() => void propertiesQuery.refetch()}
              />
            ) : filteredProperties.length ? (
              <div className="specialized-property-board-wrap scrollbar-thin">
                <div className="specialized-property-board">
                  {filteredProperties.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      className={
                        property.id === propertyId
                          ? `specialized-property-tile ${statusClass(property.status)} is-selected`
                          : `specialized-property-tile ${statusClass(property.status)}`
                      }
                      onClick={() =>
                        void navigate({
                          to: '/app/$section',
                          params: { section: 'real-estate-inventory' },
                          search: (previous) => ({
                            ...previous,
                            estate: String(selectedEstate!.id),
                            property: String(property.id),
                          }),
                        })
                      }
                    >
                      <span className="specialized-property-tile-icon">
                        <TypeIcon property={property} />
                      </span>
                      <span className="specialized-property-tile-name">
                        {estateBoardLabel(property)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : properties.length ? (
              <EmptyState
                title="No properties match these filters"
                description="Clear the status or type filter to bring matching plots back onto the board."
                action={
                  <button type="button" className="commercial-btn" onClick={clearPropertyFilters}>
                    Clear filters
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="No Property inventory"
                description="Use Add Estate Properties to add Plots, Residential Buildings or Commercial Buildings."
              />
            )}
          </section>
          {estateBrokerage.length ? (
            <section className="specialized-card">
              <header className="specialized-card-header">
                <div>
                  <div className="specialized-card-title">Brokerage Listings</div>
                  <div className="specialized-card-subtitle">
                    {estateBrokerage.length} linked to this estate ·{' '}
                    {brokerageStatsQuery.data?.verified ?? 0} verified overall
                  </div>
                </div>
              </header>
              {brokerageList}
            </section>
          ) : null}
        </div>
      </main>

      {selectedProperty && !propertyViewOpen && !propertyEditOpen ? (
        <div className="commercial-modal-backdrop" role="presentation">
          <section
            className="commercial-modal specialized-real-estate-modal specialized-selected-property-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="selected-property-title"
          >
            <header className="commercial-modal-header">
              <div>
                <h2 id="selected-property-title">{selectedProperty.propertyName}</h2>
                <p>
                  {selectedEstate!.estateName} ·{' '}
                  {selectedProperty.propertyTypeDisplay || selectedProperty.propertyType}
                </p>
              </div>
              <button
                type="button"
                className="commercial-modal-close"
                aria-label="Close selected property"
                onClick={() =>
                  void navigate({
                    to: '/app/$section',
                    params: { section: 'real-estate-inventory' },
                    search: (previous) => withoutSearchKeys(previous, ['property']),
                    replace: true,
                  })
                }
              >
                <IconX size={16} />
              </button>
            </header>
            <SelectedPropertyForm
              key={`${selectedProperty.id}-${selectedProperty.status}-${selectedProperty.pricingMode}-${selectedProperty.price}`}
              selectedEstateName={selectedEstate!.estateName}
              estatePricePerSqm={selectedEstate!.pricePerSqm}
              selectedProperty={selectedProperty}
              canPropertyUpdate={canPropertyUpdate}
              canPropertyDelete={canPropertyDelete}
              canCreateServiceRequest={canCreateServiceRequest}
              updatePending={updateMutation.isPending}
              formError={formError}
              setFormError={setFormError}
              onSubmit={(input) => updateMutation.mutate({ id: selectedProperty.id, input })}
              onCreateRequest={() =>
                void navigate({
                  to: '/app/$section',
                  params: { section: 'service-requests' },
                  search: {
                    create: 'request',
                    estate: String(selectedEstate!.id),
                    property: String(selectedProperty.id),
                  },
                })
              }
              onViewDetails={() => setPropertyViewOpen(true)}
              onDelete={() => setDeleteId(selectedProperty.id)}
              onClose={() =>
                void navigate({
                  to: '/app/$section',
                  params: { section: 'real-estate-inventory' },
                  search: (previous) => withoutSearchKeys(previous, ['property']),
                  replace: true,
                })
              }
            />
          </section>
        </div>
      ) : null}

      {propertyForView && propertyViewOpen && !propertyEditOpen ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <PropertyDetailLiveWorkspace
            property={propertyForView}
            estateName={selectedEstate!.estateName}
            estateBoundary={selectedEstate!.boundary}
            estatePricePerSqm={selectedEstate?.pricePerSqm ?? null}
            canPropertyUpdate={canPropertyUpdate}
            canManageCommercialRelease={canServiceRequestUpdate}
            releaseSaving={releaseExpiredReservationMutation.isPending}
            expiredReservationState={expiredReservationHistory}
            onClose={() => setPropertyViewOpen(false)}
            onEdit={() => setPropertyEditOpen(true)}
            onReleaseExpiredReservation={() => {
              if (!expiredReservationHistory) return
              releaseExpiredReservationMutation.mutate(expiredReservationHistory.requestId)
            }}
          />
        </Suspense>
      ) : null}

      {propertiesOpen && selectedEstate ? (
        <BatchCreatePropertiesWorkspace
          estateId={selectedEstate.id}
          estateName={selectedEstate.estateName}
          estatePricePerSqm={selectedEstate.pricePerSqm}
          occupiedPlotNumbers={properties
            .map((property) => property.plotNumber)
            .filter((value): value is number => typeof value === 'number' && value > 0)}
          onClose={() => setPropertiesOpen(false)}
          onChanged={async () => {
            await invalidateEstate(selectedEstate.id)
          }}
        />
      ) : null}
      {brokerageOpen ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <CreateBrokerageLiveWorkspace
            estates={estates}
            defaultEstateId={selectedEstate?.id ?? null}
            saving={createBrokerageMutation.isPending}
            onClose={() => setBrokerageOpen(false)}
            onSubmit={(input) => createBrokerageMutation.mutate(input)}
          />
        </Suspense>
      ) : null}
      {propertyEditOpen && selectedProperty ? (
        <Suspense fallback={<RealEstateWorkspaceFallback />}>
          <EditPropertyLiveWorkspace
            property={selectedProperty}
            estatePricePerSqm={selectedEstate?.pricePerSqm ?? null}
            occupiedPlotNumbers={properties
              .map((property) => property.plotNumber)
              .filter((value): value is number => typeof value === 'number' && value > 0)}
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
              setPropertyEditOpen(false)
              setPropertyViewOpen(true)
            }}
            onSubmit={(input) => updatePropertyMutation.mutate({ id: selectedProperty.id, input })}
          />
        </Suspense>
      ) : null}
      <ConfirmDialog
        open={deleteId != null}
        title="Delete Property?"
        description="This permanently removes the Property inventory record."
        confirmLabel="Delete Property"
        tone="danger"
        isConfirming={deleteMutation.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId != null) void deleteMutation.mutateAsync(deleteId)
        }}
      />
    </ModulePageFrame>
  )
}
