import { useState } from 'react'
import { IconBuilding, IconHome, IconMap2, IconX } from '@tabler/icons-react'

import { commercialEmptyLabel } from '@/modules/commercial/lib/commercial-source-context'
import {
  DocumentPreviewModal,
  FileDocumentRow,
  type PreviewDocument,
} from '@/modules/commercial/request-intake/DocumentPreviewModal'
import { formatCurrency } from '@/shared/lib/formatters'

import type {
  AdditionalFee,
  EffectivePricingFee,
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

function displayValue(value: string | number | null | undefined, empty = '—') {
  if (value == null || value === '') return empty
  return String(value)
}

export function PropertyDetailLiveWorkspace({
  property,
  estateName,
  estatePricePerSqm = null,
  canPropertyUpdate,
  onClose,
  onEdit,
}: {
  property: Property
  estateName: string
  estatePricePerSqm?: number | null
  canPropertyUpdate: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null)
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
                {estateName} · {typeLabel}
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
          <div className="commercial-quote-detail-layout">
            <div className="commercial-quote-detail-main">
              {property.propertyType === 'plot' ? (
                <section className="commercial-form-section">
                  <h3>Plot details</h3>
                  <div className="commercial-info-grid">
                    <div>
                      <div className="commercial-kl">Plot use</div>
                      <b>{property.plotUseDisplay || property.plotUse || '—'}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Plot size</div>
                      <b>
                        {property.plotSize != null
                          ? `${property.plotSize.toLocaleString()} ${property.plotSizeUnit || 'sqm'}`
                          : '—'}
                      </b>
                    </div>
                    <div className="commercial-info-full">
                      <div className="commercial-kl">Description</div>
                      <p>
                        {commercialEmptyLabel(property.description, 'No description recorded')}
                      </p>
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
                          '—'}
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
                          : '—'}
                      </b>
                    </div>
                    <div className="commercial-info-full">
                      <div className="commercial-kl">Description</div>
                      <p>
                        {commercialEmptyLabel(property.description, 'No description recorded')}
                      </p>
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
                          '—'}
                      </b>
                    </div>
                    <div>
                      <div className="commercial-kl">Total area</div>
                      <b>
                        {property.totalAreaCommercial != null
                          ? `${property.totalAreaCommercial.toLocaleString()} sqm`
                          : '—'}
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
                      <p>
                        {commercialEmptyLabel(property.description, 'No description recorded')}
                      </p>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="commercial-form-section">
                <h3>Documents</h3>
                {property.documents.length ? (
                  <div className="commercial-intake-file-list">
                    {property.documents.map((document) =>
                      document.file ? (
                        <FileDocumentRow
                          key={document.id}
                          fileUrl={document.file}
                          fileName={document.name || 'Document'}
                          title={document.name || 'Document'}
                          subtitle="Property document"
                          onOpen={() =>
                            setPreviewDocument({
                              fileUrl: document.file,
                              fileName: document.name || 'Document',
                              label: document.name || 'Document',
                            })
                          }
                        />
                      ) : (
                        <div key={document.id} className="commercial-attachment-row is-disabled">
                          <div className="commercial-attachment-meta">
                            <div className="commercial-attachment-name">
                              {document.name || 'Document'}
                            </div>
                            <div className="commercial-attachment-sub">File unavailable</div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="commercial-form-note">No documents attached.</p>
                )}
              </section>

              {priceHistory.length ? (
                <section className="commercial-form-section">
                  <h3>Price history</h3>
                  <div className="specialized-property-history-list">
                    {priceHistory.map((event, index) => (
                      <div key={`${event.at}-${index}`} className="specialized-property-history-row">
                        <div>
                          <strong>{historyEventTitle(event)}</strong>
                          <small>
                            {historyEventDetail(event)}
                            {' · '}
                            {historyChangedByLabel(event.changedBy, event.reason)}
                          </small>
                        </div>
                        <time dateTime={event.at || undefined}>
                          {event.at ? new Date(event.at).toLocaleString() : '—'}
                        </time>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="commercial-quote-detail-side">
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
                    <div className="commercial-kl">Estate</div>
                    <b>{estateName}</b>
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
            </aside>
          </div>
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
      </section>

      {previewDocument ? (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      ) : null}
    </div>
  )
}
