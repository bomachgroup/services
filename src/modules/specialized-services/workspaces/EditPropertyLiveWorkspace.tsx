import { IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'

import { GroupedNumberInput } from '@/shared/ui/grouped-number-input'

import { PropertyPriceField } from '../components/PropertyPriceField'
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
  propertyTypes,
  residentialBuildingTypes,
  type CreatePropertyInput,
  type PricingMode,
  type Property,
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

function mapPropertyToInput(property: Property): CreatePropertyInput {
  return {
    isOurProperty: property.isOurProperty,
    propertyType: property.propertyType,
    propertyName: property.propertyName,
    price: property.price,
    // Keep the form state aligned with the dropdown's plot default.
    plotUse: property.propertyType === 'plot' ? property.plotUse || 'residential' : '',
    boundary: property.boundary,
    images: property.images.map((image) => image.image),
    pricingMode: property.pricingMode,
    feeConfig: property.feeConfig,
    documents: property.documents,
    description: property.description,
    status: property.status,
    plotNumber: property.plotNumber,
    clientName: property.clientName,
    plotSize: property.plotSize,
    plotSizeUnit: property.plotSizeUnit || 'sqm',
    buildingTypeResidential: property.buildingTypeResidential,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    floorsResidential: property.floorsResidential,
    totalAreaResidential: property.totalAreaResidential,
    buildingTypeCommercial: property.buildingTypeCommercial,
    totalAreaCommercial: property.totalAreaCommercial,
    numberOfFloors: property.numberOfFloors,
    unitsOffices: property.unitsOffices,
    allowReservation: property.allowReservation,
    reservationPercent: property.reservationPercent,
    reservationDurationHours: property.reservationDurationHours,
    requestClaimHoldHours: property.requestClaimHoldHours,
    reservationRefundable: property.reservationRefundable,
    reservationRetentionPercent: property.reservationRetentionPercent,
    allowInstallment: property.allowInstallment,
    installmentDownPaymentPercent: property.installmentDownPaymentPercent,
    installmentMonths: property.installmentMonths,
    installmentGracePeriodDays: property.installmentGracePeriodDays,
  }
}

function propertyTypeLabel(property: Property, value: CreatePropertyInput) {
  if (value.propertyType === 'plot') return 'Plot of land'
  if (value.propertyType === 'residential') {
    return (
      property.buildingTypeResidentialDisplay ||
      value.buildingTypeResidential ||
      'Residential building'
    )
  }
  return (
    property.buildingTypeCommercialDisplay || value.buildingTypeCommercial || 'Commercial building'
  )
}

function statusLabel(property: Property, value: CreatePropertyInput) {
  return property.statusDisplay || value.status.replaceAll('_', ' ')
}

export function EditPropertyLiveWorkspace({
  property,
  estatePricePerSqm = null,
  occupiedPlotNumbers = [],
  saving,
  submitError = '',
  submitFieldErrors,
  onClose,
  onSubmit,
}: {
  property: Property
  estatePricePerSqm?: number | null
  occupiedPlotNumbers?: number[]
  saving: boolean
  submitError?: string
  submitFieldErrors?: Record<string, string> | undefined
  onClose: () => void
  onSubmit: (input: CreatePropertyInput) => void
}) {
  const [value, setValue] = useState<CreatePropertyInput>(() => mapPropertyToInput(property))
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

  useEffect(() => {
    const fromApi = { ...mappedSubmitFieldErrors }
    if (submitError.trim()) {
      Object.assign(fromApi, mapPropertyValidationMessage(submitError, value.propertyType))
    }
    if (Object.keys(fromApi).length) {
      queueMicrotask(() => {
        setFieldErrors(fromApi)
        setError('')
        const firstKey = firstPropertyFieldError(fromApi)
        if (firstKey) focusField(firstKey)
      })
      return
    }
    if (submitError.trim() && !isBoundaryError(submitError)) {
      queueMicrotask(() => {
        setError(submitError)
      })
    }
    // The signature prevents server-error handling from rerunning while the user edits fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitError, submitFieldsSignature, focusField, value.propertyType])

  const setField = <K extends keyof CreatePropertyInput>(
    key: K,
    nextValue: CreatePropertyInput[K],
  ) => setValue((current) => ({ ...current, [key]: nextValue }))

  const clearFieldError = (key: keyof PropertyFieldErrors) => {
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setError('')
  }

  const propertyType = value.propertyType
  const hasEstate = property.estateId != null
  const estateId = property.estateId
  const pricingMode: PricingMode = hasEstate
    ? (value.pricingMode ?? property.pricingMode)
    : 'manual_override'
  const estateRate = estatePricePerSqm ?? property.effectivePricing?.estateRate ?? null
  const areaSqm =
    propertyType === 'plot'
      ? (value.plotSize ?? null)
      : propertyType === 'residential'
        ? (value.totalAreaResidential ?? null)
        : (value.totalAreaCommercial ?? null)
  const estateRatePreview =
    hasEstate && pricingMode === 'estate_rate' && estateRate != null && areaSqm
      ? estateRate * areaSqm
      : null
  const displayPrice = estateRatePreview ?? value.price ?? 0

  const setPricingMode = (mode: PricingMode) => {
    setField('pricingMode', mode)
    if (mode === 'estate_rate') setField('plotSizeUnit', 'sqm')
  }

  const plotNumberField = (
    <label
      className={`commercial-field${fieldErrors.plotNumber ? 'commercial-field--invalid' : ''}`}
    >
      <span>
        Plot number <em>*</em>
      </span>
      <input
        className="commercial-number-input"
        type="number"
        min={1}
        inputMode="numeric"
        data-property-field="plotNumber"
        aria-invalid={Boolean(fieldErrors.plotNumber)}
        value={numberInputValue(value.plotNumber)}
        onChange={(event) => {
          const nextNumber = parsePositiveInteger(event.target.value)
          clearFieldError('plotNumber')
          setError('')
          setValue((current) => ({
            ...current,
            plotNumber: nextNumber,
            propertyName: nextNumber && hasEstate ? `Plot ${nextNumber}` : current.propertyName,
          }))
        }}
      />
      {fieldErrors.plotNumber ? (
        <small className="commercial-field-error">{fieldErrors.plotNumber}</small>
      ) : hasEstate ? (
        <small>Must be unique in this estate. Name stays Plot {value.plotNumber || 'N'}.</small>
      ) : null}
    </label>
  )

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal commercial-modal--xl specialized-real-estate-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit Property"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const validationErrors = validatePropertyFields(value, {
            requirePlotNumber: hasEstate,
            takenPlotNumbers: occupiedPlotNumbers,
            excludePlotNumber: property.plotNumber,
          })
          if (Object.keys(validationErrors).length) {
            setFieldErrors(validationErrors)
            setError('')
            const firstKey = firstPropertyFieldError(validationErrors)
            if (firstKey) focusField(firstKey)
            return
          }
          setFieldErrors({})
          setError('')
          onSubmit(value)
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Edit Property</h2>
            <p>Update full property details, including plot size and other type-specific fields.</p>
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
            eyebrow="Editing property"
            propertyName={value.propertyName || property.propertyName}
            propertyType={value.propertyType}
            typeLabel={propertyTypeLabel(property, value)}
            statusLabel={statusLabel(property, value)}
            price={displayPrice}
          />

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Property identity</h3>
                <p>Name, type, status and base commercial information.</p>
              </div>
            </div>

            <div className="commercial-form-grid commercial-form-grid--property">
              <div className="commercial-form-grid-location">
                <label
                  className={`commercial-field${fieldErrors.propertyName ? 'commercial-field--invalid' : ''}`}
                >
                  <span>
                    Property name <em>*</em>
                  </span>
                  <input
                    autoFocus={!hasEstate}
                    value={value.propertyName}
                    data-property-field="propertyName"
                    aria-invalid={Boolean(fieldErrors.propertyName)}
                    disabled={hasEstate}
                    onChange={(event) => {
                      setField('propertyName', event.target.value)
                      clearFieldError('propertyName')
                    }}
                  />
                  {fieldErrors.propertyName ? (
                    <small className="commercial-field-error">{fieldErrors.propertyName}</small>
                  ) : hasEstate ? (
                    <small>Estate units are named automatically from the plot number.</small>
                  ) : null}
                </label>

                <RealEstateFormDropdown
                  label="Property type"
                  fullWidth={false}
                  options={propertyTypes}
                  value={value.propertyType}
                  onChange={(nextValue) =>
                    setValue((current) => ({
                      ...current,
                      propertyType: nextValue as CreatePropertyInput['propertyType'],
                      plotUse: nextValue === 'plot' ? current.plotUse || 'residential' : '',
                    }))
                  }
                />

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
                <div className="commercial-form-grid-pair">
                  <RealEstateFormDropdown
                    label="Plot use"
                    required
                    fullWidth={false}
                    fieldClassName="commercial-field"
                    options={plotUses}
                    value={value.plotUse || 'residential'}
                    id="property-plotUse"
                    error={fieldErrors.plotUse}
                    onChange={(nextValue) => {
                      setField('plotUse', nextValue as CreatePropertyInput['plotUse'])
                      clearFieldError('plotUse')
                    }}
                  />
                  {plotNumberField}
                </div>
              ) : (
                plotNumberField
              )}

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
                <label
                  className={`commercial-field${fieldErrors.plotSize ? 'commercial-field--invalid' : ''}`}
                >
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
                      clearFieldError('plotSize')
                    }}
                  />
                  {fieldErrors.plotSize ? (
                    <small className="commercial-field-error">{fieldErrors.plotSize}</small>
                  ) : null}
                </label>

                <PropertyPriceField
                  hasEstate={hasEstate}
                  pricingMode={pricingMode}
                  price={value.price}
                  computedEstatePrice={estateRatePreview}
                  estateRatePerSqm={estateRate}
                  areaSqm={areaSqm}
                  onPricingModeChange={setPricingMode}
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
                    clearFieldError('buildingTypeResidential')
                  }}
                />

                <label
                  className={`commercial-field${fieldErrors.bedrooms ? 'commercial-field--invalid' : ''}`}
                >
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
                      clearFieldError('bedrooms')
                    }}
                  />
                  {fieldErrors.bedrooms ? (
                    <small className="commercial-field-error">{fieldErrors.bedrooms}</small>
                  ) : null}
                </label>

                <label
                  className={`commercial-field${fieldErrors.bathrooms ? 'commercial-field--invalid' : ''}`}
                >
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
                      clearFieldError('bathrooms')
                    }}
                  />
                  {fieldErrors.bathrooms ? (
                    <small className="commercial-field-error">{fieldErrors.bathrooms}</small>
                  ) : null}
                </label>

                <label
                  className={`commercial-field${fieldErrors.totalAreaResidential ? 'commercial-field--invalid' : ''}`}
                >
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
                    onChange={(nextValue) => {
                      setField('totalAreaResidential', nextValue > 0 ? nextValue : null)
                      clearFieldError('totalAreaResidential')
                    }}
                  />
                  {fieldErrors.totalAreaResidential ? (
                    <small className="commercial-field-error">
                      {fieldErrors.totalAreaResidential}
                    </small>
                  ) : null}
                </label>

                <PropertyPriceField
                  hasEstate={hasEstate}
                  pricingMode={pricingMode}
                  price={value.price}
                  computedEstatePrice={estateRatePreview}
                  estateRatePerSqm={estateRate}
                  areaSqm={areaSqm}
                  onPricingModeChange={setPricingMode}
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
                    clearFieldError('buildingTypeCommercial')
                  }}
                />

                <label
                  className={`commercial-field${fieldErrors.totalAreaCommercial ? 'commercial-field--invalid' : ''}`}
                >
                  <span>
                    Total area (sqm) <em>*</em>
                  </span>
                  <GroupedNumberInput
                    id="property-totalAreaCommercial"
                    invalid={Boolean(fieldErrors.totalAreaCommercial)}
                    value={value.totalAreaCommercial}
                    onChange={(nextValue) => {
                      setField('totalAreaCommercial', nextValue > 0 ? nextValue : null)
                      clearFieldError('totalAreaCommercial')
                    }}
                  />
                  {fieldErrors.totalAreaCommercial ? (
                    <small className="commercial-field-error">
                      {fieldErrors.totalAreaCommercial}
                    </small>
                  ) : null}
                </label>

                <PropertyPriceField
                  hasEstate={hasEstate}
                  pricingMode={pricingMode}
                  price={value.price}
                  computedEstatePrice={estateRatePreview}
                  estateRatePerSqm={estateRate}
                  areaSqm={areaSqm}
                  onPricingModeChange={setPricingMode}
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
                    onChange={(event) =>
                      setField('numberOfFloors', parsePositiveInteger(event.target.value))
                    }
                  />
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
              clearFieldError(key as keyof PropertyFieldErrors)
            }}
          />

          <BoundaryEditor
            label="Property boundary"
            value={value.boundary ?? []}
            onChange={(nextBoundary) => {
              setField('boundary', nextBoundary)
              clearFieldError('boundary')
            }}
            onValidate={async (nextBoundary) => {
              const result = estateId
                ? await realEstateApi.validatePropertyBoundary(estateId, nextBoundary, property.id)
                : await realEstateApi.validateStandalonePropertyBoundary(nextBoundary, property.id)
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
              clearFieldError('additionalFees')
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
            {saving ? 'Saving...' : 'Save Property'}
          </button>
        </footer>
      </form>
    </div>
  )
}
