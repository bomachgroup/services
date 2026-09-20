import { IconX } from '@tabler/icons-react'
import { useCallback, useState } from 'react'

import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'
import { AdditionalFeesEditor } from '../real-estate/AdditionalFeesEditor'
import { BoundaryEditor } from '../real-estate/BoundaryEditor'
import { CommercialPolicyFields } from '../real-estate/CommercialPolicyFields'
import { NamedDocumentsEditor } from '../real-estate/NamedDocumentsEditor'
import {
  brokeragePropertyTypes,
  brokerageStatuses,
  brokerageVerificationStatuses,
  type BrokerageListing,
  type CreateBrokerageInput,
  type Estate,
} from '../real-estate/real-estate.types'
import {
  firstBrokerageFieldError,
  mapBrokerageValidationMessage,
  type BrokerageFieldErrors,
  type BrokerageFieldKey,
  validateBrokerage,
} from '../real-estate/real-estate.validation'

function parseNonNegativeNumber(value: string, fallback = 0) {
  if (value.trim() === '') return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parsePercentageNumber(value: string, fallback = 0) {
  if (value.trim() === '') return fallback

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(0, parsed))
}

function numberInputValue(value: number | null | undefined) {
  return !value ? '' : String(value)
}

export function CreateBrokerageLiveWorkspace({
  estates,
  listing = null,
  mode = 'create',
  defaultEstateId = null,
  saving,
  onClose,
  onSubmit,
}: {
  estates: Estate[]
  listing?: BrokerageListing | null
  mode?: 'create' | 'edit'
  defaultEstateId?: number | null
  saving: boolean
  onClose: () => void
  onSubmit: (i: CreateBrokerageInput) => void
}) {
  const [value, setValue] = useState<CreateBrokerageInput>(() =>
    listing
      ? {
          title: listing.title,
          description: listing.description,
          location: listing.location,
          price: listing.price,
          propertyType: listing.propertyType,
          ownerName: listing.ownerName,
          ownerPhone: listing.ownerPhone,
          ownerEmail: listing.ownerEmail,
          commissionRate: listing.commissionRate,
          verificationStatus: listing.verificationStatus,
          status: listing.status,
          estateId: listing.estateId,
          tags: listing.tags,
          boundary: listing.boundary,
          additionalFees: listing.additionalFees,
          images: listing.images.map((image) => image.image),
          documents: listing.documents,
          allowReservation: listing.allowReservation,
          reservationPercent: listing.reservationPercent,
          reservationDurationHours: listing.reservationDurationHours,
          requestClaimHoldHours: listing.requestClaimHoldHours,
          reservationRefundable: listing.reservationRefundable,
          reservationRetentionPercent: listing.reservationRetentionPercent,
          allowInstallment: listing.allowInstallment,
          installmentDownPaymentPercent: listing.installmentDownPaymentPercent,
          installmentMonths: listing.installmentMonths,
          installmentGracePeriodDays: listing.installmentGracePeriodDays,
        }
      : {
          title: '',
          description: '',
          location: '',
          price: 0,
          propertyType: 'land',
          ownerName: '',
          ownerPhone: '',
          ownerEmail: '',
          commissionRate: 5,
          verificationStatus: 'pending',
          status: 'available',
          estateId: defaultEstateId,
          tags: [],
          boundary: [],
          additionalFees: [],
          documents: [],
          allowReservation: false,
          requestClaimHoldHours: 48,
          reservationRefundable: true,
          reservationRetentionPercent: 0,
          allowInstallment: false,
          installmentGracePeriodDays: 7,
        },
  )
  const [tags, setTags] = useState(() => listing?.tags.join(', ') ?? '')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<BrokerageFieldErrors>({})

  const setField = <K extends keyof CreateBrokerageInput>(
    key: K,
    nextValue: CreateBrokerageInput[K],
  ) => setValue((current) => ({ ...current, [key]: nextValue }))

  const clearFieldError = (key: BrokerageFieldKey) => {
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setError('')
  }

  const focusField = useCallback((key: BrokerageFieldKey) => {
    window.requestAnimationFrame(() => {
      const node =
        document.querySelector<HTMLElement>(`[data-brokerage-field="${key}"]`) ??
        document.querySelector<HTMLElement>(`#brokerage-${key}`)
      const target =
        node ??
        (key === 'boundary'
          ? document.querySelector<HTMLElement>('[data-property-section="brokerage-boundary"]')
          : null)
      if (!target) return
      const focusable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.getAttribute('role') === 'combobox'
          ? target
          : target.querySelector<HTMLElement>('input, textarea, [role="combobox"], button')
      focusable?.focus({ preventScroll: true })
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal specialized-real-estate-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'edit' ? 'Edit Brokerage Listing' : 'Add Brokerage Property'}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const input = {
            ...value,
            tags: tags
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          }
          const validationError = validateBrokerage(input)
          if (validationError) {
            const mapped = mapBrokerageValidationMessage(validationError)
            setFieldErrors(mapped)
            setError(Object.keys(mapped).length ? '' : validationError)
            const firstKey = firstBrokerageFieldError(mapped)
            if (firstKey) focusField(firstKey)
            return
          }
          setFieldErrors({})
          setError('')
          onSubmit(input)
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>{mode === 'edit' ? 'Edit Brokerage Listing' : 'Add Brokerage Listing'}</h2>
            <p>
              {mode === 'edit'
                ? 'Update listing, ownership, pricing and estate relationship details.'
                : 'Third-party property offered on commission, with verification and estate linking.'}
            </p>
          </div>
          <button
            type="button"
            className="commercial-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </header>

        <div className="commercial-modal-body">
          {error ? <div className="commercial-notice commercial-notice-red">{error}</div> : null}

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Listing profile</h3>
                <p>Market-facing listing information, pricing and brokerage positioning.</p>
              </div>
            </div>

            <div className="commercial-form-grid">
              <label
                className={`commercial-field${fieldErrors.title ? 'commercial-field--invalid' : ''}`}
              >
                <span>
                  Property title <em>*</em>
                </span>
                <input
                  autoFocus
                  value={value.title}
                  data-brokerage-field="title"
                  aria-invalid={Boolean(fieldErrors.title)}
                  onChange={(event) => {
                    setField('title', event.target.value)
                    clearFieldError('title')
                  }}
                />
                {fieldErrors.title ? (
                  <small className="commercial-field-error">{fieldErrors.title}</small>
                ) : null}
              </label>

              <RealEstateFormDropdown
                label="Property type"
                id="brokerage-propertyType"
                options={brokeragePropertyTypes}
                value={value.propertyType}
                onChange={(nextValue) =>
                  setField('propertyType', nextValue as typeof value.propertyType)
                }
              />

              <label
                className={`commercial-field commercial-form-span${fieldErrors.location ? 'commercial-field--invalid' : ''}`}
              >
                <span>
                  Location <em>*</em>
                </span>
                <input
                  value={value.location}
                  data-brokerage-field="location"
                  aria-invalid={Boolean(fieldErrors.location)}
                  onChange={(event) => {
                    setField('location', event.target.value)
                    clearFieldError('location')
                  }}
                />
                {fieldErrors.location ? (
                  <small className="commercial-field-error">{fieldErrors.location}</small>
                ) : null}
              </label>

              <label
                className={`commercial-field${fieldErrors.price ? 'commercial-field--invalid' : ''}`}
              >
                <span>
                  Asking price <em>*</em>
                </span>
                <input
                  className="commercial-number-input"
                  type="number"
                  min={1}
                  step="any"
                  inputMode="decimal"
                  value={numberInputValue(value.price)}
                  data-brokerage-field="price"
                  aria-invalid={Boolean(fieldErrors.price)}
                  onChange={(event) => {
                    setField('price', parseNonNegativeNumber(event.target.value))
                    clearFieldError('price')
                  }}
                />
                {fieldErrors.price ? (
                  <small className="commercial-field-error">{fieldErrors.price}</small>
                ) : null}
              </label>

              <label
                className={`commercial-field${fieldErrors.commissionRate ? 'commercial-field--invalid' : ''}`}
              >
                <span>Commission rate (%)</span>
                <input
                  className="commercial-number-input"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  inputMode="decimal"
                  value={numberInputValue(value.commissionRate)}
                  data-brokerage-field="commissionRate"
                  aria-invalid={Boolean(fieldErrors.commissionRate)}
                  onChange={(event) => {
                    setField('commissionRate', parsePercentageNumber(event.target.value))
                    clearFieldError('commissionRate')
                  }}
                />
                {fieldErrors.commissionRate ? (
                  <small className="commercial-field-error">{fieldErrors.commissionRate}</small>
                ) : null}
              </label>

              {mode === 'create' ? (
                <>
                  <RealEstateFormDropdown
                    label="Verification"
                    options={brokerageVerificationStatuses}
                    value={value.verificationStatus}
                    onChange={(nextValue) =>
                      setField('verificationStatus', nextValue as typeof value.verificationStatus)
                    }
                  />

                  <RealEstateFormDropdown
                    label="Market status"
                    options={brokerageStatuses}
                    value={value.status}
                    onChange={(nextValue) => setField('status', nextValue as typeof value.status)}
                  />
                </>
              ) : null}

              <label className="commercial-field commercial-form-span">
                <span>Description</span>
                <textarea
                  value={value.description}
                  onChange={(event) => setField('description', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Ownership and linkage</h3>
                <p>Mandate giver details, contact data and optional estate relationship.</p>
              </div>
            </div>

            <div className="commercial-form-grid">
              <label
                className={`commercial-field${fieldErrors.ownerName ? 'commercial-field--invalid' : ''}`}
              >
                <span>
                  Owner / mandate giver <em>*</em>
                </span>
                <input
                  value={value.ownerName}
                  data-brokerage-field="ownerName"
                  aria-invalid={Boolean(fieldErrors.ownerName)}
                  onChange={(event) => {
                    setField('ownerName', event.target.value)
                    clearFieldError('ownerName')
                  }}
                />
                {fieldErrors.ownerName ? (
                  <small className="commercial-field-error">{fieldErrors.ownerName}</small>
                ) : null}
              </label>

              <label className="commercial-field">
                <span>Owner phone</span>
                <input
                  value={value.ownerPhone}
                  onChange={(event) => setField('ownerPhone', event.target.value)}
                />
              </label>

              <label className="commercial-field">
                <span>Owner email</span>
                <input
                  type="email"
                  value={value.ownerEmail}
                  onChange={(event) => setField('ownerEmail', event.target.value)}
                />
              </label>

              <RealEstateFormDropdown
                label="Related estate"
                searchable
                placeholder="No estate link"
                options={[
                  { value: '0', label: 'No estate link' },
                  ...estates.map((estate) => ({
                    value: String(estate.id),
                    label: `${estate.estateCode} · ${estate.estateName}`,
                  })),
                ]}
                value={value.estateId ? String(value.estateId) : '0'}
                onChange={(nextValue) => setField('estateId', Number(nextValue) || null)}
              />

              <label className="commercial-field commercial-form-span">
                <span>Tags</span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="brokerage, exclusive, urgent"
                />
              </label>
            </div>
          </section>

          <CommercialPolicyFields
            value={value}
            errors={fieldErrors}
            onChange={(key, nextValue) => {
              setValue((current) => ({ ...current, [key]: nextValue }))
              clearFieldError(key as BrokerageFieldKey)
            }}
          />

          <BoundaryEditor
            label="Listing boundary"
            value={value.boundary ?? []}
            onChange={(nextBoundary) => {
              setField('boundary', nextBoundary)
              clearFieldError('boundary')
            }}
            error={fieldErrors.boundary}
            dataField="brokerage-boundary"
          />

          <AdditionalFeesEditor
            title="Listing fees"
            value={value.additionalFees ?? []}
            error={fieldErrors.additionalFees}
            onChange={(nextFees) => {
              setField('additionalFees', nextFees)
              clearFieldError('additionalFees')
            }}
          />

          <NamedDocumentsEditor
            value={value.documents ?? []}
            onChange={(nextDocuments) => setField('documents', nextDocuments)}
          />
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="commercial-btn commercial-btn-primary" disabled={saving}>
            {saving
              ? mode === 'edit'
                ? 'Saving...'
                : 'Adding...'
              : mode === 'edit'
                ? 'Save changes'
                : 'Add Listing'}
          </button>
        </footer>
      </form>
    </div>
  )
}
