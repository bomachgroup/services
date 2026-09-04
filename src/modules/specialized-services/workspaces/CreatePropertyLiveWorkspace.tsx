import { IconX } from '@tabler/icons-react'
import { useState } from 'react'

import { PropertyWorkspaceBanner } from '../components/PropertyWorkspaceBanner'
import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'
import {
  commercialBuildingTypes,
  propertyStatuses,
  propertyTypes,
  residentialBuildingTypes,
  type CreatePropertyInput,
  type Estate,
} from '../real-estate/real-estate.types'
import { validateProperty } from '../real-estate/real-estate.validation'

const residentialTypeOptions = [...residentialBuildingTypes]
const commercialTypeOptions = [...commercialBuildingTypes]

function parsePositiveInteger(value: string, fallback: number | null = null) {
  if (value.trim() === '') return fallback

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.trunc(parsed))
}

function parseNonNegativeNumber(value: string, fallback: number | null = null) {
  if (value.trim() === '') return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function numberInputValue(value: number | null | undefined) {
  return value == null || value === 0 ? '' : String(value)
}

function defaultPropertyInput(): CreatePropertyInput {
  return {
    isOurProperty: true,
    propertyType: 'plot',
    propertyName: '',
    price: 0,
    description: '',
    status: 'available',
    plotSizeUnit: 'sqm',
    buildingTypeResidential: '',
    buildingTypeCommercial: '',
  }
}

export function CreatePropertyLiveWorkspace({
  estates,
  initialEstateId = null,
  saving,
  onClose,
  onSubmit,
}: {
  estates: Estate[]
  initialEstateId?: number | null
  saving: boolean
  onClose: () => void
  onSubmit: (input: { estateId: number | null; property: CreatePropertyInput }) => void
}) {
  const [estateId, setEstateId] = useState<number | null>(initialEstateId)
  const [value, setValue] = useState<CreatePropertyInput>(defaultPropertyInput)
  const [error, setError] = useState('')

  const setField = <K extends keyof CreatePropertyInput>(
    key: K,
    nextValue: CreatePropertyInput[K],
  ) => setValue((current) => ({ ...current, [key]: nextValue }))

  const propertyType = value.propertyType

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
          const validationError = validateProperty(value)
          setError(validationError)
          if (!validationError) onSubmit({ estateId, property: value })
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Add Property</h2>
            <p>
              Create a property inventory record. Link it to an estate or keep it standalone for
              direct sale inventory.
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
            price={value.price}
          />

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
                onChange={(nextValue) => setEstateId(Number(nextValue) || null)}
              />
            </div>
          </section>

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Property identity</h3>
                <p>Name, type, status and base commercial information.</p>
              </div>
            </div>

            <div className="commercial-form-grid commercial-form-grid--property">
              <label className="commercial-field commercial-field--full">
                <span>
                  Property name <em>*</em>
                </span>
                <input
                  autoFocus
                  value={value.propertyName}
                  onChange={(event) => setField('propertyName', event.target.value)}
                />
              </label>

              <RealEstateFormDropdown
                label="Property type"
                options={propertyTypes}
                value={value.propertyType}
                onChange={(nextValue) =>
                  setField(
                    'propertyType',
                    nextValue as CreatePropertyInput['propertyType'],
                  )
                }
              />

              <RealEstateFormDropdown
                label="Status"
                options={propertyStatuses}
                value={value.status}
                onChange={(nextValue) =>
                  setField('status', nextValue as CreatePropertyInput['status'])
                }
              />

              <label className="commercial-field">
                <span>
                  Price <em>*</em>
                </span>
                <input
                  className="commercial-number-input"
                  type="number"
                  min={1}
                  step="any"
                  inputMode="decimal"
                  value={numberInputValue(value.price)}
                  onChange={(event) =>
                    setField('price', parseNonNegativeNumber(event.target.value, 0) ?? 0)
                  }
                />
              </label>

              <label className="commercial-field">
                <span>Plot number</span>
                <input
                  className="commercial-number-input"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={numberInputValue(value.plotNumber)}
                  onChange={(event) =>
                    setField('plotNumber', parsePositiveInteger(event.target.value))
                  }
                />
              </label>

              <label className="commercial-field">
                <span>Client / holder</span>
                <input
                  value={value.clientName ?? ''}
                  onChange={(event) => setField('clientName', event.target.value)}
                />
              </label>

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
                  <input
                    className="commercial-number-input"
                    type="number"
                    min={1}
                    step="any"
                    inputMode="decimal"
                    value={numberInputValue(value.plotSize)}
                    onChange={(event) =>
                      setField('plotSize', parseNonNegativeNumber(event.target.value))
                    }
                  />
                </label>

                <label className="commercial-field">
                  <span>Plot size unit</span>
                  <input
                    value={value.plotSizeUnit ?? 'sqm'}
                    onChange={(event) => setField('plotSizeUnit', event.target.value)}
                  />
                </label>
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
                    Total area <em>*</em>
                  </span>
                  <input
                    className="commercial-number-input"
                    type="number"
                    min={1}
                    step="any"
                    inputMode="decimal"
                    value={numberInputValue(value.totalAreaResidential)}
                    onChange={(event) =>
                      setField('totalAreaResidential', parseNonNegativeNumber(event.target.value))
                    }
                  />
                </label>
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
                    Total area <em>*</em>
                  </span>
                  <input
                    className="commercial-number-input"
                    type="number"
                    min={1}
                    step="any"
                    inputMode="decimal"
                    value={numberInputValue(value.totalAreaCommercial)}
                    onChange={(event) =>
                      setField('totalAreaCommercial', parseNonNegativeNumber(event.target.value))
                    }
                  />
                </label>

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
