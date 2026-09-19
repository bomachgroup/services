import { IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'

import { GroupedNumberInput } from '@/shared/ui/grouped-number-input'

import { PropertyPriceField } from '../components/PropertyPriceField'
import { PropertyTypePicker } from '../components/PropertyTypePicker'
import { PropertyWorkspaceBanner } from '../components/PropertyWorkspaceBanner'
import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'
import { AdditionalFeesEditor } from '../real-estate/AdditionalFeesEditor'
import { BoundaryEditor } from '../real-estate/BoundaryEditor'
import { CommercialPolicyFields } from '../real-estate/CommercialPolicyFields'
import { NamedDocumentsEditor } from '../real-estate/NamedDocumentsEditor'
import { PropertyImagesEditor } from '../real-estate/PropertyImagesEditor'
import { realEstateApi } from '../real-estate/real-estate.api'
import {
  commercialBuildingTypes,
  plotUses,
  propertyStatuses,
  residentialBuildingTypes,
  type CreatePropertyInput,
  type Estate,
  type PricingMode,
} from '../real-estate/real-estate.types'
import {
  firstPropertyFieldError,
  mapPropertySubmitFieldErrors,
  mapPropertyValidationMessage,
  type PropertyFieldErrors,
  type PropertyFieldKey,
  validatePropertyFields,
} from '../real-estate/real-estate.validation'

const residentialTypeOptions = [...residentialBuildingTypes]
const commercialTypeOptions = [...commercialBuildingTypes]

function parsePositiveInteger(value: string, fallback: number | null = null) {
  if (value.trim() === '') return fallback

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.trunc(parsed))
}

function numberInputValue(value: number | null | undefined) {
  return value == null || value === 0 ? '' : String(value)
}

function isBoundaryError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('boundary') ||
    normalized.includes('latitude') ||
    normalized.includes('longitude') ||
    normalized.includes('corner')
  )
}

function defaultPropertyInput(): CreatePropertyInput {
  return {
    isOurProperty: true,
    propertyType: 'plot',
    propertyName: '',
    price: null,
    description: '',
    status: 'available',
    plotUse: 'residential',
    plotSizeUnit: 'sqm',
    boundary: [],
    images: [],
    pricingMode: 'manual_override',
    feeConfig: {
      inheritEstateFees: true,
      overrides: [],
      additionalFees: [],
    },
    documents: [],
    allowReservation: false,
    requestClaimHoldHours: 48,
    reservationRefundable: true,
    reservationRetentionPercent: 0,
    allowInstallment: false,
    installmentGracePeriodDays: 7,
    buildingTypeResidential: '',
    buildingTypeCommercial: '',
  }
}

export function CreatePropertyLiveWorkspace({
  estates = [],
  initialEstateId = null,
  standaloneOnly = false,
  saving,
  submitError = '',
  submitFieldErrors,
  onClose,
  onSubmit,
}: {
  estates?: Estate[]
  initialEstateId?: number | null
  standaloneOnly?: boolean
  saving: boolean
  submitError?: string
  submitFieldErrors?: Record<string, string> | undefined
  onClose: () => void
  onSubmit: (input: { estateId: number | null; property: CreatePropertyInput }) => void
}) {
  const [estateId, setEstateId] = useState<number | null>(standaloneOnly ? null : initialEstateId)
  const [value, setValue] = useState<CreatePropertyInput>(defaultPropertyInput)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<PropertyFieldErrors>({})
  const mappedSubmitFieldErrors = mapPropertySubmitFieldErrors(submitFieldErrors)
  const boundarySubmitError = isBoundaryError(submitError)
    ? submitError
    : (mappedSubmitFieldErrors.boundary ?? '')
  const boundaryFieldErrors = Object.fromEntries(
    Object.entries(submitFieldErrors ?? {}).filter(([key]) => /^\d+\.(lat|lng)$/.test(key)),
  )
  const submitFieldsSignature = JSON.stringify(submitFieldErrors ?? {})

  const focusField = useCallback((key: PropertyFieldKey) => {
    window.requestAnimationFrame(() => {
      const node =
        document.querySelector<HTMLElement>(`[data-property-field="${key}"]`) ??
        document.querySelector<HTMLElement>(`#property-${key}`)
      const boundary = document.querySelector<HTMLElement>('[data-property-section="boundary"]')
      const target = node ?? (key === 'boundary' ? boundary : null)
      if (!target) return
      const focusable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.getAttribute('role') === 'combobox'
          ? target
          : target.querySelector<HTMLElement>('input, textarea, select, [role="combobox"], button')
      focusable?.focus({ preventScroll: true })
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const applyFieldErrors = useCallback(
    (nextErrors: PropertyFieldErrors) => {
      setFieldErrors(nextErrors)
      const firstKey = firstPropertyFieldError(nextErrors)
      if (firstKey) focusField(firstKey)
    },
    [focusField],
  )

  useEffect(() => {
    const nextErrors = { ...mappedSubmitFieldErrors }
    if (!Object.keys(nextErrors).length && submitError.trim()) {
      Object.assign(nextErrors, mapPropertyValidationMessage(submitError, value.propertyType))
    }
    queueMicrotask(() => {
      setFieldErrors(nextErrors)
      setError(Object.keys(nextErrors).length ? '' : submitError)
      const firstKey = firstPropertyFieldError(nextErrors)
      if (firstKey) focusField(firstKey)
    })
    // The signature prevents server-error handling from rerunning while the user edits fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitError, submitFieldsSignature, focusField])

  const setField = <K extends keyof CreatePropertyInput>(
    key: K,
    nextValue: CreatePropertyInput[K],
  ) => setValue((current) => ({ ...current, [key]: nextValue }))

  const propertyType = value.propertyType
  const selectedEstate =
    standaloneOnly || !estateId ? undefined : estates.find((estate) => estate.id === estateId)
  const pricingMode: PricingMode = selectedEstate
    ? (value.pricingMode ?? 'estate_rate')
    : 'manual_override'
  const areaSqm =
    propertyType === 'plot'
      ? (value.plotSize ?? null)
      : propertyType === 'residential'
        ? (value.totalAreaResidential ?? null)
        : (value.totalAreaCommercial ?? null)
  const estateRatePreview =
    selectedEstate && pricingMode === 'estate_rate' && areaSqm
      ? selectedEstate.pricePerSqm * areaSqm
      : null
  const displayPrice = estateRatePreview ?? value.price ?? 0

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal commercial-modal--xl specialized-real-estate-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Property"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const validationErrors = validatePropertyFields(value, {
            requirePlotNumber: Boolean(selectedEstate),
          })
          if (Object.keys(validationErrors).length) {
            applyFieldErrors(validationErrors)
            setError('')
            return
          }
          setFieldErrors({})
          setError('')
          onSubmit({ estateId, property: value })
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>{standaloneOnly ? 'Add Standalone Property' : 'Add Property'}</h2>
            <p>
              {standaloneOnly
                ? 'Create a plot, residential or commercial inventory record that is not linked to an estate.'
                : 'Create a property inventory record. Link it to an estate or keep it standalone for direct sale inventory.'}
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

          <PropertyWorkspaceBanner
            eyebrow="New property record"
            propertyName={value.propertyName || 'Untitled property'}
            propertyType={value.propertyType}
            typeLabel={
              value.propertyType === 'plot'
                ? 'Plot of land'
                : value.propertyType === 'residential'
                  ? 'Residential building'
                  : 'Commercial building'
            }
            statusLabel={value.status.replaceAll('_', ' ')}
            price={displayPrice}
          />

          <PropertyTypePicker
            value={value.propertyType}
            onChange={(nextValue) =>
              setValue((current) => ({
                ...current,
                propertyType: nextValue,
                plotUse: nextValue === 'plot' ? current.plotUse || 'residential' : '',
              }))
            }
            description="Choose plot, residential building or commercial building."
          />

          {!standaloneOnly ? (
            <section className="commercial-form-section">
              <div className="commercial-form-section-heading">
                <div>
                  <h3>Inventory placement</h3>
                  <p>Choose whether this property belongs to an estate or stands alone.</p>
                </div>
              </div>
              <div className="commercial-form-grid commercial-form-grid--property">
                <RealEstateFormDropdown
                  label="Linked estate"
                  fieldClassName="commercial-field commercial-field--full"
                  searchable
                  placeholder="No estate link (standalone)"
                  options={[
                    { value: '0', label: 'No estate link (standalone)' },
                    ...estates.map((estate) => ({
                      value: String(estate.id),
                      label: `${estate.estateCode} · ${estate.estateName}`,
                    })),
                  ]}
                  value={estateId ? String(estateId) : '0'}
                  onChange={(nextValue) => {
                    const nextEstateId = Number(nextValue) || null
                    setEstateId(nextEstateId)
                    setField('pricingMode', nextEstateId ? 'estate_rate' : 'manual_override')
                  }}
                />
              </div>
            </section>
          ) : null}

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Property identity</h3>
                <p>Name, status and base commercial information.</p>
              </div>
            </div>

            <div className="commercial-form-grid commercial-form-grid--property">
              <div className="commercial-form-grid-pair">
                <label
                  className={`commercial-field${fieldErrors.propertyName ? 'commercial-field--invalid' : ''}`}
                >
                  <span>
                    Property name <em>*</em>
                  </span>
                  <input
                    autoFocus={!selectedEstate}
                    value={value.propertyName}
                    data-property-field="propertyName"
                    aria-invalid={Boolean(fieldErrors.propertyName)}
                    disabled={Boolean(selectedEstate)}
                    onChange={(event) => {
                      setField('propertyName', event.target.value)
                      setFieldErrors((current) => ({ ...current, propertyName: undefined }))
                    }}
                  />
                  {fieldErrors.propertyName ? (
                    <small className="commercial-field-error">{fieldErrors.propertyName}</small>
                  ) : selectedEstate ? (
                    <small>Estate units are named automatically from the plot number.</small>
                  ) : null}
                </label>

                <RealEstateFormDropdown
                  label="Status"
                  fullWidth={false}
                  options={propertyStatuses}
                  value={value.status}
                  onChange={(nextValue) =>
                    setField('status', nextValue as CreatePropertyInput['status'])
                  }
                />
              </div>

              {propertyType === 'plot' ? (
                <RealEstateFormDropdown
                  label="Plot use"
                  required
                  fullWidth={false}
                  options={plotUses}
                  value={value.plotUse || 'residential'}
                  id="property-plotUse"
                  error={fieldErrors.plotUse}
                  onChange={(nextValue) => {
                    setField('plotUse', nextValue as CreatePropertyInput['plotUse'])
                    setFieldErrors((current) => ({ ...current, plotUse: undefined }))
                  }}
                />
              ) : null}

              <div className="commercial-form-grid-pair">
                <label className="commercial-field">
                  <span>Plot number {selectedEstate ? <em>*</em> : null}</span>
                  <input
                    className="commercial-number-input"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={numberInputValue(value.plotNumber)}
                    data-property-field="plotNumber"
                    aria-invalid={Boolean(fieldErrors.plotNumber)}
                    onChange={(event) => {
                      const nextNumber = parsePositiveInteger(event.target.value)
                      setValue((current) => ({
                        ...current,
                        plotNumber: nextNumber,
                        propertyName:
                          nextNumber && selectedEstate
                            ? `Plot ${nextNumber}`
                            : current.propertyName,
                      }))
                      setFieldErrors((current) => ({ ...current, plotNumber: undefined }))
                    }}
                  />
                  {fieldErrors.plotNumber ? (
                    <small className="commercial-field-error">{fieldErrors.plotNumber}</small>
                  ) : selectedEstate ? (
                    <small>
                      Must be unique in this estate. Name stays Plot {value.plotNumber || 'N'}.
                    </small>
                  ) : null}
                </label>

                <label className="commercial-field">
                  <span>Client / holder</span>
                  <input
                    value={value.clientName ?? ''}
                    onChange={(event) => setField('clientName', event.target.value)}
                  />
                </label>
              </div>

              <label className="commercial-field commercial-field--full">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={value.description ?? ''}
                  onChange={(event) => setField('description', event.target.value)}
                />
              </label>
            </div>
          </section>

          {propertyType === 'plot' ? (
            <section className="commercial-form-section">
              <div className="commercial-form-section-heading">
                <div>
                  <h3>Plot details</h3>
                  <p>Land size and measurement settings for the plot record.</p>
                </div>
              </div>

              <div className="commercial-form-grid commercial-form-grid--property">
                <label className="commercial-field">
                  <span>
                    Plot size (sqm) <em>*</em>
                  </span>
                  <GroupedNumberInput
                    id="property-plotSize"
                    invalid={Boolean(fieldErrors.plotSize)}
                    value={value.plotSize}
                    onChange={(nextValue) => {
                      setField('plotSize', nextValue > 0 ? nextValue : null)
                      setField('plotSizeUnit', 'sqm')
                    }}
                  />
                  {fieldErrors.plotSize ? (
                    <small className="commercial-field-error">{fieldErrors.plotSize}</small>
                  ) : null}
                </label>

                <PropertyPriceField
                  hasEstate={Boolean(selectedEstate)}
                  pricingMode={pricingMode}
                  price={value.price}
                  computedEstatePrice={estateRatePreview}
                  estateRatePerSqm={selectedEstate?.pricePerSqm}
                  areaSqm={areaSqm}
                  onPricingModeChange={(mode) => {
                    setField('pricingMode', mode)
                    if (mode === 'estate_rate') setField('plotSizeUnit', 'sqm')
                  }}
                  onPriceChange={(nextPrice) => setField('price', nextPrice)}
                  error={fieldErrors.price}
                  inputId="property-price"
                />
              </div>
            </section>
          ) : null}

          {propertyType === 'residential' ? (
            <section className="commercial-form-section">
              <div className="commercial-form-section-heading">
                <div>
                  <h3>Residential details</h3>
                  <p>Home classification, room counts and floor area.</p>
                </div>
              </div>

              <div className="commercial-form-grid commercial-form-grid--property">
                <RealEstateFormDropdown
                  label="Residential type"
                  required
                  placeholder="Select residential type"
                  options={[
                    { value: '', label: 'Select residential type' },
                    ...residentialTypeOptions,
                  ]}
                  value={value.buildingTypeResidential ?? ''}
                  id="property-buildingTypeResidential"
                  error={fieldErrors.buildingTypeResidential}
                  onChange={(nextValue) => {
                    setField('buildingTypeResidential', nextValue)
                    setFieldErrors((current) => ({
                      ...current,
                      buildingTypeResidential: undefined,
                    }))
                  }}
                />

                <label className="commercial-field">
                  <span>
                    Bedrooms <em>*</em>
                  </span>
                  <input
                    className="commercial-number-input"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={numberInputValue(value.bedrooms)}
                    data-property-field="bedrooms"
                    aria-invalid={Boolean(fieldErrors.bedrooms)}
                    onChange={(event) => {
                      setField('bedrooms', parsePositiveInteger(event.target.value))
                      setFieldErrors((current) => ({ ...current, bedrooms: undefined }))
                    }}
                  />
                  {fieldErrors.bedrooms ? (
                    <small className="commercial-field-error">{fieldErrors.bedrooms}</small>
                  ) : null}
                </label>

                <label className="commercial-field">
                  <span>
                    Bathrooms <em>*</em>
                  </span>
                  <input
                    className="commercial-number-input"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={numberInputValue(value.bathrooms)}
                    data-property-field="bathrooms"
                    aria-invalid={Boolean(fieldErrors.bathrooms)}
                    onChange={(event) => {
                      setField('bathrooms', parsePositiveInteger(event.target.value))
                      setFieldErrors((current) => ({ ...current, bathrooms: undefined }))
                    }}
                  />
                  {fieldErrors.bathrooms ? (
                    <small className="commercial-field-error">{fieldErrors.bathrooms}</small>
                  ) : null}
                </label>

                <label className="commercial-field">
                  <span>Floors</span>
                  <input
                    className="commercial-number-input"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={numberInputValue(value.floorsResidential)}
                    onChange={(event) =>
                      setField('floorsResidential', parsePositiveInteger(event.target.value))
                    }
                  />
                </label>

                <label className="commercial-field">
                  <span>
                    Total area (sqm) <em>*</em>
                  </span>
                  <GroupedNumberInput
                    id="property-totalAreaResidential"
                    invalid={Boolean(fieldErrors.totalAreaResidential)}
                    value={value.totalAreaResidential}
                    onChange={(nextValue) =>
                      setField('totalAreaResidential', nextValue > 0 ? nextValue : null)
                    }
                  />
                  {fieldErrors.totalAreaResidential ? (
                    <small className="commercial-field-error">
                      {fieldErrors.totalAreaResidential}
                    </small>
                  ) : null}
                </label>

                <PropertyPriceField
                  hasEstate={Boolean(selectedEstate)}
                  pricingMode={pricingMode}
                  price={value.price}
                  computedEstatePrice={estateRatePreview}
                  estateRatePerSqm={selectedEstate?.pricePerSqm}
                  areaSqm={areaSqm}
                  onPricingModeChange={(mode) => {
                    setField('pricingMode', mode)
                    if (mode === 'estate_rate') setField('plotSizeUnit', 'sqm')
                  }}
                  onPriceChange={(nextPrice) => setField('price', nextPrice)}
                  error={fieldErrors.price}
                  inputId="property-price"
                />
              </div>
            </section>
          ) : null}

          {propertyType === 'commercial' ? (
            <section className="commercial-form-section">
              <div className="commercial-form-section-heading">
                <div>
                  <h3>Commercial details</h3>
                  <p>Commercial classification, total area, floors and unit count.</p>
                </div>
              </div>

              <div className="commercial-form-grid commercial-form-grid--property">
                <RealEstateFormDropdown
                  label="Commercial type"
                  required
                  placeholder="Select commercial type"
                  options={[
                    { value: '', label: 'Select commercial type' },
                    ...commercialTypeOptions,
                  ]}
                  value={value.buildingTypeCommercial ?? ''}
                  id="property-buildingTypeCommercial"
                  error={fieldErrors.buildingTypeCommercial}
                  onChange={(nextValue) => {
                    setField('buildingTypeCommercial', nextValue)
                    setFieldErrors((current) => ({ ...current, buildingTypeCommercial: undefined }))
                  }}
                />

                <label className="commercial-field">
                  <span>
                    Total area (sqm) <em>*</em>
                  </span>
                  <GroupedNumberInput
                    id="property-totalAreaCommercial"
                    invalid={Boolean(fieldErrors.totalAreaCommercial)}
                    value={value.totalAreaCommercial}
                    onChange={(nextValue) =>
                      setField('totalAreaCommercial', nextValue > 0 ? nextValue : null)
                    }
                  />
                  {fieldErrors.totalAreaCommercial ? (
                    <small className="commercial-field-error">
                      {fieldErrors.totalAreaCommercial}
                    </small>
                  ) : null}
                </label>

                <PropertyPriceField
                  hasEstate={Boolean(selectedEstate)}
                  pricingMode={pricingMode}
                  price={value.price}
                  computedEstatePrice={estateRatePreview}
                  estateRatePerSqm={selectedEstate?.pricePerSqm}
                  areaSqm={areaSqm}
                  onPricingModeChange={(mode) => {
                    setField('pricingMode', mode)
                    if (mode === 'estate_rate') setField('plotSizeUnit', 'sqm')
                  }}
                  onPriceChange={(nextPrice) => setField('price', nextPrice)}
                  error={fieldErrors.price}
                  inputId="property-price"
                />

                <label className="commercial-field">
                  <span>
                    Number of floors <em>*</em>
                  </span>
                  <input
                    className="commercial-number-input"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={numberInputValue(value.numberOfFloors)}
                    data-property-field="numberOfFloors"
                    aria-invalid={Boolean(fieldErrors.numberOfFloors)}
                    onChange={(event) => {
                      setField('numberOfFloors', parsePositiveInteger(event.target.value))
                      setFieldErrors((current) => ({ ...current, numberOfFloors: undefined }))
                    }}
                  />
                  {fieldErrors.numberOfFloors ? (
                    <small className="commercial-field-error">{fieldErrors.numberOfFloors}</small>
                  ) : null}
                </label>

                <label className="commercial-field">
                  <span>Units / offices</span>
                  <input
                    className="commercial-number-input"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={numberInputValue(value.unitsOffices)}
                    onChange={(event) =>
                      setField('unitsOffices', parsePositiveInteger(event.target.value))
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}

          <CommercialPolicyFields
            value={value}
            errors={fieldErrors}
            onChange={(key, nextValue) => {
              setValue((current) => ({ ...current, [key]: nextValue }))
              setFieldErrors((current) => ({ ...current, [key]: undefined }))
            }}
          />

          <BoundaryEditor
            label="Property boundary"
            value={value.boundary ?? []}
            onChange={(nextBoundary) => {
              setField('boundary', nextBoundary)
              setFieldErrors((current) => ({ ...current, boundary: undefined }))
            }}
            onValidate={async (nextBoundary) => {
              const result = estateId
                ? await realEstateApi.validatePropertyBoundary(estateId, nextBoundary)
                : await realEstateApi.validateStandalonePropertyBoundary(nextBoundary)
              return result.detail
            }}
            error={boundarySubmitError || fieldErrors.boundary || ''}
            fieldErrors={boundaryFieldErrors}
            dataField="boundary"
          />

          <AdditionalFeesEditor
            title="Property-specific fees"
            value={value.feeConfig?.additionalFees ?? []}
            error={fieldErrors.additionalFees}
            onChange={(nextFees) => {
              setField('feeConfig', {
                inheritEstateFees: value.feeConfig?.inheritEstateFees ?? true,
                overrides: value.feeConfig?.overrides ?? [],
                additionalFees: nextFees,
              })
              setFieldErrors((current) => ({ ...current, additionalFees: undefined }))
            }}
          />

          <NamedDocumentsEditor
            value={value.documents ?? []}
            onChange={(nextDocuments) => setField('documents', nextDocuments)}
          />

          <PropertyImagesEditor
            value={value.images ?? []}
            onChange={(nextImages) => setField('images', nextImages)}
          />
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="commercial-btn commercial-btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Property'}
          </button>
        </footer>
      </form>
    </div>
  )
}
