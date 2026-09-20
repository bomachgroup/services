import {
  IconBuilding,
  IconChevronDown,
  IconFiles,
  IconHistory,
  IconHome,
  IconMap2,
  IconPhoto,
  IconX,
} from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'

import { commercialEmptyLabel } from '@/modules/commercial/lib/commercial-source-context'
import { formatCurrency } from '@/shared/lib/formatters'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'

import { NamedDocumentsPanel } from '../real-estate/NamedDocumentsPanel'
import { hasViewableDocuments, isFileReference } from '../real-estate/named-documents.utils'
import { PropertyLocationMap } from '../real-estate/PropertyLocationMap'
import { isValidBoundary } from '../real-estate/real-estate-map.utils'
import type {
  AdditionalFee,
  EffectivePricingFee,
  BoundaryPoint,
  Property,
  PropertyStatus,
} from '../real-estate/real-estate.types'

function propertyTypeIcon(property: Property) {
  if (property.propertyType === 'plot') return <IconMap2 size={16} stroke={1.75} />
  if (property.propertyType === 'residential') return <IconHome size={16} stroke={1.75} />
  return <IconBuilding size={16} stroke={1.75} />
}

function statusPillClass(status: PropertyStatus) {
  if (status === 'available') return 'commercial-pill commercial-pill-green'
  if (status === 'under_offer') return 'commercial-pill specialized-pill--property-under_offer'
  if (status === 'reserved') return 'commercial-pill commercial-pill-yellow'
  if (status === 'sold') return 'commercial-pill commercial-pill-gray'
  if (status === 'hold' || status === 'not-for-sale') return 'commercial-pill commercial-pill-blue'
  return 'commercial-pill commercial-pill-gray'
}

function feeSourceLabel(source: EffectivePricingFee['source']) {
  if (source === 'estate') return 'Estate fee'
  if (source === 'property_override') return 'Estate fee override'
  return 'Property fee'
}

function feeTimingLabel(timing: AdditionalFee['paymentTiming']) {
  return timing === 'deferred' ? 'Deferred' : 'Upfront'
}

function resolvePropertyFees(property: Property): {
  fees: Array<{
    key: string
    name: string
    amount: number
    paymentTiming: AdditionalFee['paymentTiming']
    sourceLabel: string
    active: boolean
  }>
  feesTotal: number
  pricingTotal: number | null
  inheritEstateFees: boolean
} {
  const effective = property.effectivePricing
  if (effective?.fees?.length) {
    return {
      fees: effective.fees.map((fee, index) => ({
        key: fee.id || `effective-${index}`,
        name: fee.name || 'Fee',
        amount: fee.amount,
        paymentTiming: fee.paymentTiming,
        sourceLabel: feeSourceLabel(fee.source),
        active: fee.active !== false,
      })),
      feesTotal: effective.feesTotal,
      pricingTotal: effective.total,
      inheritEstateFees: property.feeConfig?.inheritEstateFees !== false,
    }
  }

  const propertyFees = (property.feeConfig?.additionalFees ?? []).filter(
    (fee) => fee.active !== false,
  )
  const feesTotal = propertyFees.reduce((sum, fee) => sum + (fee.amount || 0), 0)
  return {
    fees: propertyFees.map((fee, index) => ({
      key: fee.id || `property-${index}`,
      name: fee.name || 'Fee',
      amount: fee.amount,
      paymentTiming: fee.paymentTiming,
      sourceLabel: 'Property fee',
      active: fee.active !== false,
    })),
    feesTotal,
    pricingTotal: null,
    inheritEstateFees: property.feeConfig?.inheritEstateFees !== false,
  }
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

  if (oldPrice && newPrice) return `${oldPrice} → ${newPrice}`
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

function historyDateLabel(value: string) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function displayValue(value: string | number | null | undefined, empty = '-') {
  if (value == null || value === '') return empty
  return String(value)
}

function PropertyImageGalleryItem({
  image,
  propertyName,
}: {
  image: Property['images'][number]
  propertyName: string
}) {
  const [failed, setFailed] = useState(false)
  const label = image.caption || propertyName

  return (
    <a
      className="specialized-property-image-gallery-item"
      href={failed ? undefined : image.image}
      target={failed ? undefined : '_blank'}
      rel={failed ? undefined : 'noreferrer'}
      aria-label={failed ? `${label} image unavailable` : `Open ${label} in a new tab`}
      aria-disabled={failed || undefined}
      onClick={failed ? (event) => event.preventDefault() : undefined}
    >
      {failed ? (
        <span className="specialized-property-image-gallery-fallback">
          <IconPhoto size={22} />
          <span>Image unavailable</span>
        </span>
      ) : (
        <img src={image.image} alt={label} loading="lazy" onError={() => setFailed(true)} />
      )}
    </a>
  )
}

function PropertyMediaAccordion({
  showImages,
  showLocation,
  showDocuments,
  imagesContent,
  locationContent,
  documentsContent,
  imagesCount,
  documentsCount,
}: {
  showImages: boolean
  showLocation: boolean
  showDocuments: boolean
  imagesContent: ReactNode
  locationContent: ReactNode
  documentsContent: ReactNode
  imagesCount: number
  documentsCount: number
}) {
  type MediaSection = 'images' | 'location' | 'documents'
  const [openSection, setOpenSection] = useState<MediaSection | null>(null)

  if (!showImages && !showLocation && !showDocuments) return null

  const visibleCount = [showImages, showLocation, showDocuments].filter(Boolean).length

  const toggle = (section: MediaSection) => {
    setOpenSection((current) => (current === section ? null : section))
  }

  const renderHeader = (
    section: MediaSection,
    title: string,
    subtitle: string,
    summary: string,
  ) => {
    const expanded = openSection === section
    const Icon = section === 'images' ? IconPhoto : section === 'location' ? IconMap2 : IconFiles
    return (
      <button
        type="button"
        className={`specialized-card specialized-accordion-header specialized-accordion-header--${section}${expanded ? 'is-expanded' : 'is-collapsed'}`}
        aria-expanded={expanded}
        onClick={() => toggle(section)}
      >
        <span
          className={`specialized-accordion-icon specialized-accordion-icon--${section}`}
          aria-hidden="true"
        >
          <Icon size={18} stroke={1.9} />
        </span>
        <span className="specialized-accordion-text">
          <span className="specialized-accordion-title-row">
            <span className="specialized-card-title">{title}</span>
            <span className="specialized-accordion-count">{summary}</span>
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
    <div
      className={`specialized-location-documents-accordion specialized-property-media-accordion specialized-property-media-accordion--${visibleCount}`}
    >
      <div className="specialized-location-documents-row">
        {showImages
          ? renderHeader(
              'images',
              'Property images',
              'Browse the property gallery.',
              `${imagesCount} image${imagesCount === 1 ? '' : 's'}`,
            )
          : null}
        {showLocation
          ? renderHeader('location', 'Property location', 'Boundary map and estate context.', 'Map')
          : null}
        {showDocuments
          ? renderHeader(
              'documents',
              'Property files',
              'Select a file to preview it.',
              `${documentsCount} file${documentsCount === 1 ? '' : 's'}`,
            )
          : null}
      </div>
      {openSection ? (
        <section className="specialized-card specialized-foldable-card is-expanded specialized-accordion-body">
          <div className="specialized-foldable-body">
            {openSection === 'images'
              ? imagesContent
              : openSection === 'location'
                ? locationContent
                : documentsContent}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function PropertyPricingHistoryAccordion({ events }: { events: Property['pricingHistory'] }) {
  const [open, setOpen] = useState(false)

  if (!events.length) return null

  const latestEvent = events[0]!

  return (
    <section className="specialized-property-pricing-history">
      <div
        className={`specialized-card specialized-pricing-history-card${open ? 'is-expanded' : ''}`}
      >
        <button
          type="button"
          className="specialized-pricing-history-trigger"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span
            className="specialized-accordion-icon specialized-accordion-icon--history"
            aria-hidden="true"
          >
            <IconHistory size={18} stroke={1.9} />
          </span>
          <span className="specialized-pricing-history-copy">
            <span className="specialized-pricing-history-title">
              Pricing history
              <span className="specialized-accordion-count">
                {events.length} change{events.length === 1 ? '' : 's'}
              </span>
            </span>
            <span className="specialized-pricing-history-meta">
              Latest update {historyDateLabel(latestEvent.at)} ·{' '}
              {historyChangedByLabel(latestEvent.changedBy, latestEvent.reason)}
            </span>
          </span>
          <span className="specialized-pricing-history-current">
            <small>Current price</small>
            <strong>{historyEventTitle(latestEvent)}</strong>
          </span>
          <span className="specialized-pricing-history-action">
            <span>{open ? 'Hide history' : 'View history'}</span>
            <span className="specialized-foldable-toggle-icon" aria-hidden="true">
              <IconChevronDown size={16} stroke={2} />
            </span>
          </span>
        </button>
        {open ? (
          <div className="specialized-pricing-history-body">
            <div className="specialized-pricing-history-list">
              {events.map((event, index) => (
                <div key={`${event.at}-${index}`} className="specialized-pricing-history-row">
                  <span className="specialized-pricing-history-marker" aria-hidden="true" />
                  <div className="specialized-pricing-history-event">
                    <div className="specialized-pricing-history-event-heading">
                      <strong>{historyEventTitle(event)}</strong>
                      <time dateTime={event.at || undefined}>{historyDateLabel(event.at)}</time>
                    </div>
                    <small>
                      {historyEventDetail(event) || 'Price recorded'} ·{' '}
                      {historyChangedByLabel(event.changedBy, event.reason)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function PropertyDetailLiveWorkspace({
  property,
  estateName,
  estateBoundary = [],
  estatePricePerSqm = null,
  canPropertyUpdate,
  canManageCommercialRelease = false,
  releaseSaving = false,
  expiredReservationState = null,
  onClose,
  onEdit,
  onReleaseExpiredReservation,
}: {
  property: Property
  estateName: string
  estateBoundary?: BoundaryPoint[]
  estatePricePerSqm?: number | null
  canPropertyUpdate: boolean
  canManageCommercialRelease?: boolean
  releaseSaving?: boolean
  expiredReservationState?: {
    requestId: number
    requestNumber: string
    reservationExpiresAt: string | null
  } | null
  onClose: () => void
  onEdit: () => void
  onReleaseExpiredReservation?: () => void
}) {
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false)
  const areaSqm =
    property.effectivePricing?.areaSqm ??
    (property.propertyType === 'plot'
      ? property.plotSize
      : property.propertyType === 'residential'
        ? property.totalAreaResidential
        : property.totalAreaCommercial)
  const estateRate = estatePricePerSqm ?? property.effectivePricing?.estateRate ?? null
  const computedEstatePrice =
    property.pricingMode === 'estate_rate' && estateRate != null && areaSqm != null && areaSqm > 0
      ? estateRate * areaSqm
      : null
  const displayPrice = computedEstatePrice ?? property.price
  const priceHistory = property.pricingHistory.slice().reverse()
  const statusLabel = property.statusDisplay || property.status
  const typeLabel = property.propertyTypeDisplay || property.propertyType
  const feeSummary = resolvePropertyFees(property)
  const propertyImages = property.images.filter((image) => Boolean(image.image))
  const showLocation = isValidBoundary(property.boundary)
  const showDocuments = hasViewableDocuments(property.documents)

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="commercial-modal commercial-modal--xl specialized-real-estate-modal specialized-property-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Property ${property.propertyName}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div className="specialized-property-detail-header-main">
            <span className="specialized-property-detail-header-icon" aria-hidden="true">
              {propertyTypeIcon(property)}
            </span>
            <div>
              <h2>{property.propertyName}</h2>
              <p>
                {property.estateId
                  ? estateName
                  : property.isOurProperty
                    ? 'Company-owned standalone property'
                    : 'Managed standalone property'}{' '}
                · {typeLabel}
                {property.plotNumber != null ? ` · Plot #${property.plotNumber}` : ''}
              </p>
            </div>
          </div>
          <div className="commercial-modal-header-meta">
            <span className={statusPillClass(property.status)}>{statusLabel}</span>
            <button
              type="button"
              className="commercial-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX size={16} />
            </button>
          </div>
        </header>

        <div className="commercial-modal-body">
          {expiredReservationState ? (
            <div className="commercial-notice commercial-notice-yellow">
              <div>
                <b>Reservation expired and awaiting staff release</b>
                <p>
                  The payment remains recorded, but this property stays protected until an
                  authorised staff member confirms release.
                </p>
              </div>
              {canManageCommercialRelease && onReleaseExpiredReservation ? (
                <button
                  type="button"
                  className="commercial-btn commercial-btn-primary commercial-btn-small"
                  disabled={releaseSaving}
                  onClick={() => setReleaseConfirmOpen(true)}
                >
                  Release property
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="commercial-quote-detail-layout specialized-property-detail-layout">
            <div className="commercial-quote-detail-main">
              {property.propertyType === 'plot' ? (
                <section className="commercial-form-section">
                  <h3>Plot details</h3>
                  <div className="commercial-info-grid">
                    <div>
                      <div className="commercial-kl">Plot use</div>
                      <b>{property.plotUseDisplay || property.plotUse || '-'}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Plot size</div>
                      <b>
                        {property.plotSize != null
                          ? `${property.plotSize.toLocaleString()} ${property.plotSizeUnit || 'sqm'}`
                          : '-'}
                      </b>
                    </div>
                    <div className="commercial-info-full">
                      <div className="commercial-kl">Description</div>
                      <p>{commercialEmptyLabel(property.description, 'No description recorded')}</p>
                    </div>
                  </div>
                </section>
              ) : null}

              {property.propertyType === 'residential' ? (
                <section className="commercial-form-section">
                  <h3>Residential details</h3>
                  <div className="commercial-info-grid">
                    <div>
                      <div className="commercial-kl">Residential type</div>
                      <b>
                        {property.buildingTypeResidentialDisplay ||
                          property.buildingTypeResidential ||
                          '-'}
                      </b>
                    </div>
                    <div>
                      <div className="commercial-kl">Bedrooms</div>
                      <b>{displayValue(property.bedrooms)}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Bathrooms</div>
                      <b>{displayValue(property.bathrooms)}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Floors</div>
                      <b>{displayValue(property.floorsResidential)}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Total area</div>
                      <b>
                        {property.totalAreaResidential != null
                          ? `${property.totalAreaResidential.toLocaleString()} sqm`
                          : '-'}
                      </b>
                    </div>
                    <div className="commercial-info-full">
                      <div className="commercial-kl">Description</div>
                      <p>{commercialEmptyLabel(property.description, 'No description recorded')}</p>
                    </div>
                  </div>
                </section>
              ) : null}

              {property.propertyType === 'commercial' ? (
                <section className="commercial-form-section">
                  <h3>Commercial details</h3>
                  <div className="commercial-info-grid">
                    <div>
                      <div className="commercial-kl">Commercial type</div>
                      <b>
                        {property.buildingTypeCommercialDisplay ||
                          property.buildingTypeCommercial ||
                          '-'}
                      </b>
                    </div>
                    <div>
                      <div className="commercial-kl">Total area</div>
                      <b>
                        {property.totalAreaCommercial != null
                          ? `${property.totalAreaCommercial.toLocaleString()} sqm`
                          : '-'}
                      </b>
                    </div>
                    <div>
                      <div className="commercial-kl">Number of floors</div>
                      <b>{displayValue(property.numberOfFloors)}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Units / offices</div>
                      <b>{displayValue(property.unitsOffices)}</b>
                    </div>
                    <div className="commercial-info-full">
                      <div className="commercial-kl">Description</div>
                      <p>{commercialEmptyLabel(property.description, 'No description recorded')}</p>
                    </div>
                  </div>
                </section>
              ) : null}

              <PropertyMediaAccordion
                showImages={propertyImages.length > 0}
                showLocation={showLocation}
                showDocuments={showDocuments}
                imagesCount={propertyImages.length}
                documentsCount={
                  property.documents.filter((document) => isFileReference(document.file)).length
                }
                imagesContent={
                  <div className="specialized-property-detail-media-section">
                    <div className="specialized-property-image-gallery">
                      {propertyImages.map((image) => (
                        <PropertyImageGalleryItem
                          key={image.id}
                          image={image}
                          propertyName={property.propertyName}
                        />
                      ))}
                    </div>
                  </div>
                }
                locationContent={
                  <div className="specialized-property-detail-media-section">
                    <PropertyLocationMap
                      propertyBoundary={property.boundary}
                      estateBoundary={estateBoundary}
                      propertyName={property.propertyName}
                      status={property.status}
                    />
                  </div>
                }
                documentsContent={
                  <div className="specialized-property-detail-media-section">
                    <NamedDocumentsPanel documents={property.documents} entityLabel="property" />
                  </div>
                }
              />
            </div>
          </div>

          <div className="specialized-property-commercial-grid">
            <section className="commercial-form-section commercial-form-section--compact">
              <h3>Commercial</h3>
              <div className="specialized-property-price-summary">
                <span>List price</span>
                <strong>{formatCurrency(displayPrice)}</strong>
                <small>
                  {property.pricingMode === 'estate_rate' ? 'Estate rate' : 'Manual override'}
                  {property.pricingMode === 'estate_rate' && estateRate != null && areaSqm
                    ? ` · ${areaSqm.toLocaleString()} sqm × ${formatCurrency(estateRate)}/sqm`
                    : ''}
                </small>
              </div>
              <div className="commercial-info-grid">
                <div>
                  <div className="commercial-kl">{property.estateId ? 'Estate' : 'Source'}</div>
                  <b>
                    {property.estateId
                      ? estateName
                      : property.isOurProperty
                        ? 'Company-owned inventory'
                        : 'Managed standalone inventory'}
                  </b>
                </div>
                <div>
                  <div className="commercial-kl">Type</div>
                  <b>{typeLabel}</b>
                </div>
                <div>
                  <div className="commercial-kl">Plot number</div>
                  <b>{displayValue(property.plotNumber)}</b>
                </div>
                <div>
                  <div className="commercial-kl">Status</div>
                  <b>{statusLabel}</b>
                </div>
                {property.clientName ? (
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Client / holder</div>
                    <b>{property.clientName}</b>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="commercial-form-section commercial-form-section--compact">
              <h3>Additional fees</h3>
              <p className="specialized-property-fee-note">
                {feeSummary.inheritEstateFees
                  ? 'Includes applicable estate fees when inherited.'
                  : 'Estate fee inheritance is off for this property.'}
              </p>
              {feeSummary.fees.length ? (
                <div className="specialized-property-fee-list">
                  {feeSummary.fees.map((fee) => (
                    <div key={fee.key} className="specialized-property-fee-row">
                      <div>
                        <strong>{fee.name}</strong>
                        <small>
                          {fee.sourceLabel} · {feeTimingLabel(fee.paymentTiming)}
                          {!fee.active ? ' · Inactive' : ''}
                        </small>
                      </div>
                      <b>{formatCurrency(fee.amount)}</b>
                    </div>
                  ))}
                  <div className="specialized-property-fee-row specialized-property-fee-row--total">
                    <div>
                      <strong>Fees total</strong>
                    </div>
                    <b>{formatCurrency(feeSummary.feesTotal)}</b>
                  </div>
                  <div className="specialized-property-fee-row specialized-property-fee-row--total">
                    <div>
                      <strong>Price + fees</strong>
                    </div>
                    <b>
                      {formatCurrency(
                        feeSummary.pricingTotal ?? displayPrice + feeSummary.feesTotal,
                      )}
                    </b>
                  </div>
                </div>
              ) : (
                <p className="commercial-form-note">No additional fees on this property.</p>
              )}
            </section>
          </div>
          <PropertyPricingHistoryAccordion events={priceHistory} />
        </div>

        <footer className="commercial-modal-footer">
          <div className="commercial-modal-footer-start" />
          <div className="commercial-modal-footer-actions">
            <button type="button" className="commercial-btn" onClick={onClose}>
              Close
            </button>
            {canPropertyUpdate ? (
              <button
                type="button"
                className="commercial-btn commercial-btn-primary"
                onClick={onEdit}
              >
                Edit Details
              </button>
            ) : null}
          </div>
        </footer>

        <ConfirmDialog
          open={releaseConfirmOpen}
          tone="danger"
          title="Release this expired reservation?"
          description="This confirms that the expired paid reservation no longer protects the property. The property will become available for a new request."
          impact="The payment and commercial history remain recorded. This action only releases the property hold."
          detailsTitle="Release summary"
          detailRows={[
            { label: 'Property', value: property.propertyName, highlight: true },
            { label: 'Request', value: expiredReservationState?.requestNumber || '-' },
            {
              label: 'Reservation expired',
              value: expiredReservationState?.reservationExpiresAt
                ? new Date(expiredReservationState.reservationExpiresAt).toLocaleString()
                : 'Expired',
            },
          ]}
          confirmLabel="Release property"
          cancelLabel="Keep protected"
          isConfirming={releaseSaving}
          onCancel={() => setReleaseConfirmOpen(false)}
          onConfirm={() => {
            onReleaseExpiredReservation?.()
            setReleaseConfirmOpen(false)
          }}
        />
      </section>
    </div>
  )
}
