import { IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { GroupedNumberInput } from '@/shared/ui/grouped-number-input'

import { PropertyPriceField } from '../components/PropertyPriceField'
import { PropertyWorkspaceBanner } from '../components/PropertyWorkspaceBanner'
import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'
import { AdditionalFeesEditor } from '../real-estate/AdditionalFeesEditor'
import { BoundaryEditor } from '../real-estate/BoundaryEditor'
import { NamedDocumentsEditor } from '../real-estate/NamedDocumentsEditor'
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
import { validateProperty } from '../real-estate/real-estate.validation'

const residentialTypeOptions = [...residentialBuildingTypes]
const commercialTypeOptions = [...commercialBuildingTypes]

type PropertyFieldErrors = Partial<Record<'plotNumber' | 'propertyName' | 'plotSize' | 'price', string>>

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

function mapValidationMessageToFields(message: string): PropertyFieldErrors {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('plot number') ||
    (normalized.includes('plot') && normalized.includes('already exists')) ||
    (normalized.includes('plot') && normalized.includes('unique'))
  ) {
    return { plotNumber: message }
  }
  if (normalized.includes('property name')) return { propertyName: message }
  if (normalized.includes('plot size')) return { plotSize: message }
  if (normalized.includes('price')) return { price: message }
  return {}
}

function mapSubmitFieldErrors(submitFieldErrors?: Record<string, string>): PropertyFieldErrors {
  const mapped: PropertyFieldErrors = {}
  for (const [key, message] of Object.entries(submitFieldErrors ?? {})) {
    if (!message) continue
    if (key === 'plot_number' || key === 'plotNumber') mapped.plotNumber = message
    if (key === 'property_name' || key === 'propertyName') mapped.propertyName = message
    if (key === 'plot_size' || key === 'plotSize') mapped.plotSize = message
    if (key === 'price') mapped.price = message
  }
  return mapped
}

function mapPropertyToInput(property: Property): CreatePropertyInput {
  return {
    isOurProperty: property.isOurProperty,
    propertyType: property.propertyType,
    propertyName: property.propertyName,
    price: property.price,
    plotUse: property.plotUse,
    boundary: property.boundary,
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
  const boundarySubmitError = isBoundaryError(submitError) ? submitError : ''
  const boundaryFieldErrors = Object.fromEntries(
    Object.entries(submitFieldErrors ?? {}).filter(([key]) => /^\d+\.(lat|lng)$/.test(key)),
  )

  useEffect(() => {
    const fromApi = mapSubmitFieldErrors(submitFieldErrors)
    if (submitError.trim() && !isBoundaryError(submitError)) {
      Object.assign(fromApi, mapValidationMessageToFields(submitError))
    }
    if (Object.keys(fromApi).length) {
      queueMicrotask(() => {
        setFieldErrors(fromApi)
        setError('')
        if (fromApi.plotNumber) {
          requestAnimationFrame(() => {
            document
              .querySelector<HTMLInputElement>('[data-property-field="plotNumber"]')
              ?.focus()
          })
        }
      })
      return
    }
    if (submitError.trim() && !isBoundaryError(submitError)) {
      queueMicrotask(() => {
        setError(submitError)
      })
    }
  }, [submitError, submitFieldErrors])

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
      className={`commercial-field${fieldErrors.plotNumber ? ' commercial-field--invalid' : ''}`}
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
            propertyName:
              nextNumber && hasEstate ? `Plot ${nextNumber}` : current.propertyName,
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
          const validationError = validateProperty(value, {
            requirePlotNumber: hasEstate,
            takenPlotNumbers: occupiedPlotNumbers,
            excludePlotNumber: property.plotNumber,
          })
          if (validationError) {
            const mapped = mapValidationMessageToFields(validationError)
            setFieldErrors(mapped)
            setError(Object.keys(mapped).length ? '' : validationError)
            if (mapped.plotNumber) {
              requestAnimationFrame(() => {
                document
                  .querySelector<HTMLInputElement>('[data-property-field="plotNumber"]')
                  ?.focus()
              })
            }
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
                <label className="commercial-field">
                  <span>
                    Property name <em>*</em>
                  </span>
                  <input
                    autoFocus={!hasEstate}
                    value={value.propertyName}
                    disabled={hasEstate}
                    onChange={(event) => setField('propertyName', event.target.value)}
                  />
                  {hasEstate ? (
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
                    onChange={(nextValue) =>
                      setField('plotUse', nextValue as CreatePropertyInput['plotUse'])
                    }
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
                <label className="commercial-field">
                  <span>
                    Plot size (sqm) <em>*</em>
                  </span>
                  <GroupedNumberInput
                    value={value.plotSize}
                    onChange={(nextValue) => {
                      setField('plotSize', nextValue > 0 ? nextValue : null)
                      setField('plotSizeUnit', 'sqm')
                    }}
                  />
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
                  onChange={(nextValue) => setField('buildingTypeResidential', nextValue)}
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
                    onChange={(event) =>
                      setField('bedrooms', parsePositiveInteger(event.target.value))
                    }
                  />
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
                    onChange={(event) =>
                      setField('bathrooms', parsePositiveInteger(event.target.value))
                    }
                  />
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
                    value={value.totalAreaResidential}
                    onChange={(nextValue) =>
                      setField('totalAreaResidential', nextValue > 0 ? nextValue : null)
                    }
                  />
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
                  onChange={(nextValue) => setField('buildingTypeCommercial', nextValue)}
                />

                <label className="commercial-field">
                  <span>
                    Total area (sqm) <em>*</em>
                  </span>
                  <GroupedNumberInput
                    value={value.totalAreaCommercial}
                    onChange={(nextValue) =>
                      setField('totalAreaCommercial', nextValue > 0 ? nextValue : null)
                    }
                  />
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

          <BoundaryEditor
            label="Property boundary"
            value={value.boundary ?? []}
            onChange={(nextBoundary) => setField('boundary', nextBoundary)}
            onValidate={
              estateId
                ? async (nextBoundary) => {
                    const result = await realEstateApi.validatePropertyBoundary(
                      estateId,
                      nextBoundary,
                      property.id,
                    )
                    return result.detail
                  }
                : undefined
            }
            error={boundarySubmitError}
            fieldErrors={boundaryFieldErrors}
          />

          <AdditionalFeesEditor
            title="Property-specific fees"
            value={value.feeConfig?.additionalFees ?? []}
            onChange={(nextFees) =>
              setField('feeConfig', {
                inheritEstateFees: value.feeConfig?.inheritEstateFees ?? true,
                overrides: value.feeConfig?.overrides ?? [],
                additionalFees: nextFees,
              })
            }
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
            {saving ? 'Saving...' : 'Save Property'}
          </button>
        </footer>
      </form>
    </div>
  )
}
