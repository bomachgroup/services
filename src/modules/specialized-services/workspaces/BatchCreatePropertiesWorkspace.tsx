import { IconBuildingStore, IconHome, IconMap2, IconX } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import { presentError } from '@/shared/errors'
import { GroupedNumberInput } from '@/shared/ui/grouped-number-input'

import { PropertyPriceField } from '../components/PropertyPriceField'
import { PropertyTypePicker } from '../components/PropertyTypePicker'
import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'
import { realEstateApi } from '../real-estate/real-estate.api'
import { buildPropertyBatch, estatePlotName, nextEstatePlotNumber } from '../real-estate/property-batch'
import {
  commercialBuildingTypes,
  propertyStatuses,
  residentialBuildingTypes,
  type CreatePropertyInput,
  type PricingMode,
  type PropertyBatchItem,
  type PropertyType,
} from '../real-estate/real-estate.types'
import { validateProperty } from '../real-estate/real-estate.validation'

function parsePositiveInteger(value: string, fallback = 0) {
  if (value.trim() === '') return fallback

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.trunc(parsed))
}

function numberInputValue(value: number | null | undefined) {
  return !value ? '' : String(value)
}

function statusLabel(status: PropertyBatchItem['status']) {
  if (status === 'created') return 'Created'
  if (status === 'failed') return 'Failed'
  if (status === 'creating') return 'Creating'
  return 'Queued'
}

export function BatchCreatePropertiesWorkspace({
  estateId,
  estateName,
  estatePricePerSqm = null,
  occupiedPlotNumbers = [],
  onClose,
  onChanged,
}: {
  estateId: number
  estateName: string
  estatePricePerSqm?: number | null
  occupiedPlotNumbers?: number[]
  onClose: () => void
  onChanged: () => Promise<void> | void
}) {
  const [propertyType, setPropertyType] = useState<PropertyType>('plot')
  const [count, setCount] = useState(10)
  const [start, setStart] = useState(() =>
    nextEstatePlotNumber(occupiedPlotNumbers.map((plotNumber) => ({ plotNumber }))),
  )
  const [pricingMode, setPricingMode] = useState<PricingMode>('estate_rate')
  const [price, setPrice] = useState<number | null>(null)
  const [status, setStatus] = useState<CreatePropertyInput['status']>('available')
  const [description, setDescription] = useState('')
  const [plotSize, setPlotSize] = useState(500)
  const [residentialType, setResidentialType] = useState('duplex')
  const [bedrooms, setBedrooms] = useState(4)
  const [bathrooms, setBathrooms] = useState(4)
  const [residentialFloors, setResidentialFloors] = useState(2)
  const [residentialArea, setResidentialArea] = useState(300)
  const [commercialType, setCommercialType] = useState('office')
  const [commercialArea, setCommercialArea] = useState(500)
  const [commercialFloors, setCommercialFloors] = useState(1)
  const [commercialUnits, setCommercialUnits] = useState(1)
  const [items, setItems] = useState<PropertyBatchItem[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const areaSqm =
    propertyType === 'plot'
      ? plotSize
      : propertyType === 'residential'
        ? residentialArea
        : commercialArea
  const computedEstatePrice =
    estatePricePerSqm != null && areaSqm > 0 ? estatePricePerSqm * areaSqm : null

  const summary = useMemo(
    () => ({
      created: items.filter((item) => item.status === 'created').length,
      failed: items.filter((item) => item.status === 'failed').length,
      pending: items.filter((item) => item.status === 'queued' || item.status === 'creating')
        .length,
    }),
    [items],
  )

  const completed = summary.created + summary.failed
  const progress = items.length ? Math.round((completed / items.length) * 100) : 0
  const batchStarted = items.length > 0

  const template = (): CreatePropertyInput => ({
    isOurProperty: true,
    propertyType,
    propertyName: estatePlotName(start),
    price: pricingMode === 'manual_override' ? price : null,
    plotUse: propertyType === 'plot' ? 'residential' : '',
    pricingMode,
    boundary: [],
    feeConfig: {
      inheritEstateFees: true,
      overrides: [],
      additionalFees: [],
    },
    documents: [],
    description,
    status,
    ...(propertyType === 'plot' ? { plotSize, plotSizeUnit: 'sqm' } : {}),
    ...(propertyType === 'residential'
      ? {
          buildingTypeResidential: residentialType,
          bedrooms,
          bathrooms,
          floorsResidential: residentialFloors,
          totalAreaResidential: residentialArea,
        }
      : {}),
    ...(propertyType === 'commercial'
      ? {
          buildingTypeCommercial: commercialType,
          totalAreaCommercial: commercialArea,
          numberOfFloors: commercialFloors,
          unitsOffices: commercialUnits,
        }
      : {}),
  })

  const createItemsSequentially = async (rows: PropertyBatchItem[]) => {
    setRunning(true)
    setError('')
    setNotice('')

    const nextItems = rows.map((item) => ({ ...item }))
    setItems(nextItems.map((item) => ({ ...item })))

    for (let index = 0; index < nextItems.length; index += 1) {
      const item = nextItems[index]
      if (!item || item.status === 'created') continue

      nextItems[index] = { ...item, status: 'creating', error: '' }
      setItems(nextItems.map((item) => ({ ...item })))

      try {
        const created = await realEstateApi.createProperty(estateId, item.input)
        nextItems[index] = {
          ...item,
          status: 'created',
          propertyId: created.id,
          error: '',
        }
      } catch (createError) {
        nextItems[index] = {
          ...item,
          status: 'failed',
          error: presentError(createError, 'form-submit').message,
        }
      }

      setItems(nextItems.map((item) => ({ ...item })))
    }

    const createdCount = nextItems.filter((item) => item.status === 'created').length
    const failedCount = nextItems.filter((item) => item.status === 'failed').length

    if (failedCount === 0) {
      setNotice(
        createdCount === 1
          ? '1 property created successfully.'
          : `${createdCount.toLocaleString()} properties created successfully.`,
      )
    } else if (createdCount === 0) {
      setError(
        failedCount === 1
          ? 'Property creation failed.'
          : `All ${failedCount.toLocaleString()} properties failed. Review errors below and retry.`,
      )
    } else {
      setNotice(
        `${createdCount.toLocaleString()} created · ${failedCount.toLocaleString()} failed. Retry failed items to continue.`,
      )
    }

    setRunning(false)
    await onChanged()
  }

  const runBatch = async () => {
    const base = template()
    const validationError = validateProperty(base)
    if (validationError) return setError(validationError)
    if (!Number.isInteger(count) || count < 1 || count > 1000)
      return setError('Batch size must be between 1 and 1,000 properties.')
    if (!Number.isInteger(start) || start < 1)
      return setError('Starting number must be a positive whole number.')

    const occupied = new Set(occupiedPlotNumbers)
    for (let sequence = start; sequence < start + count; sequence += 1) {
      if (occupied.has(sequence)) {
        return setError(
          `Plot ${sequence} already exists in this estate. Choose a starting number that keeps every plot unique.`,
        )
      }
    }

    await createItemsSequentially(buildPropertyBatch(base, count, start))
  }

  const retryFailed = async () => {
    if (running) return
    const failed = items.filter((item) => item.status === 'failed')
    if (!failed.length) return

    const nextItems = items.map((item) =>
      item.status === 'failed' ? { ...item, status: 'queued' as const, error: '' } : item,
    )
    await createItemsSequentially(nextItems)
  }

  return (
    <div
      className="commercial-modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!running) onClose()
      }}
    >
      <section
        className="commercial-modal commercial-modal--xl specialized-real-estate-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Estate Properties"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Add Estate Properties</h2>
            <p>
              {estateName} · Create one property or a batch of up to 1,000.
            </p>
          </div>
          <button
            type="button"
            className="commercial-modal-close"
            disabled={running}
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </header>

        <div className="commercial-modal-body">
          {error ? <div className="commercial-notice commercial-notice-red">{error}</div> : null}
          {notice && !error ? (
            <div className="commercial-notice commercial-notice-green">{notice}</div>
          ) : null}

          {!batchStarted ? (
            <>
              <PropertyTypePicker
                value={propertyType}
                onChange={setPropertyType}
                description="Choose the asset class you want to create for this estate."
              />

              <section className="commercial-form-section">
                <div className="commercial-form-section-heading">
                  <div>
                    <h3>Batch setup</h3>
                    <p>
                      Configure volume and defaults. Units are named Plot 1, Plot 2, and so on —
                      type is shown by icon on the estate board.
                    </p>
                  </div>
                </div>

                <div className="commercial-form-grid commercial-form-grid--3">
                  <label className="commercial-field">
                    <span>
                      How many properties? <em>*</em>
                    </span>
                    <input
                      className="commercial-number-input"
                      type="number"
                      min={1}
                      max={1000}
                      inputMode="numeric"
                      value={numberInputValue(count)}
                      onChange={(event) => setCount(parsePositiveInteger(event.target.value))}
                    />
                  </label>
                  <label className="commercial-field">
                    <span>
                      Starting number <em>*</em>
                    </span>
                    <input
                      className="commercial-number-input"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={numberInputValue(start)}
                      onChange={(event) => setStart(parsePositiveInteger(event.target.value))}
                    />
                  </label>
                  <RealEstateFormDropdown
                    label="Initial status"
                    options={propertyStatuses}
                    value={status}
                    fullWidth={false}
                    fieldClassName="commercial-field"
                    onChange={(nextValue) => setStatus(nextValue as CreatePropertyInput['status'])}
                  />
                </div>
                <p className="specialized-batch-setup-note">
                  Use 1 for a single property. Names will run {estatePlotName(start)}
                  {count > 1 ? ` … ${estatePlotName(start + Math.max(count, 1) - 1)}` : ''}. Each
                  plot number must be unique in this estate.
                </p>

                <div className="commercial-form-grid">
                  {propertyType === 'plot' ? (
                    <label className="commercial-field">
                      <span>
                        Plot size(s) (sqm) <em>*</em>
                      </span>
                      <GroupedNumberInput
                        value={plotSize}
                        onChange={(nextValue) => setPlotSize(nextValue > 0 ? nextValue : 0)}
                      />
                    </label>
                  ) : null}

                  <PropertyPriceField
                    hasEstate
                    pricingMode={pricingMode}
                    price={price}
                    computedEstatePrice={computedEstatePrice}
                    estateRatePerSqm={estatePricePerSqm}
                    areaSqm={areaSqm > 0 ? areaSqm : null}
                    onPricingModeChange={(mode) => {
                      setPricingMode(mode)
                      if (mode === 'estate_rate') setPrice(null)
                    }}
                    onPriceChange={setPrice}
                  />

                  {propertyType === 'residential' ? (
                    <>
                      <div className="commercial-form-grid commercial-form-grid--3 commercial-field--full">
                        <label className="commercial-field">
                          <span>
                            Bedrooms <em>*</em>
                          </span>
                          <input
                            className="commercial-number-input"
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={numberInputValue(bedrooms)}
                            onChange={(event) =>
                              setBedrooms(parsePositiveInteger(event.target.value))
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
                            value={numberInputValue(bathrooms)}
                            onChange={(event) =>
                              setBathrooms(parsePositiveInteger(event.target.value))
                            }
                          />
                        </label>
                        <label className="commercial-field">
                          <span>
                            Total area <em>*</em>
                          </span>
                          <GroupedNumberInput
                            value={residentialArea}
                            onChange={(nextValue) =>
                              setResidentialArea(nextValue > 0 ? nextValue : 0)
                            }
                          />
                        </label>
                      </div>
                      <div className="commercial-form-grid commercial-field--full">
                        <RealEstateFormDropdown
                          label="Residential type"
                          required
                          options={residentialBuildingTypes}
                          value={residentialType}
                          fullWidth={false}
                          fieldClassName="commercial-field"
                          onChange={setResidentialType}
                        />
                        <label className="commercial-field">
                          <span>Floors</span>
                          <input
                            className="commercial-number-input"
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={numberInputValue(residentialFloors)}
                            onChange={(event) =>
                              setResidentialFloors(parsePositiveInteger(event.target.value))
                            }
                          />
                        </label>
                      </div>
                    </>
                  ) : null}

                  {propertyType === 'commercial' ? (
                    <>
                      <div className="commercial-form-grid commercial-field--full">
                        <RealEstateFormDropdown
                          label="Commercial type"
                          required
                          options={commercialBuildingTypes}
                          value={commercialType}
                          fullWidth={false}
                          fieldClassName="commercial-field"
                          onChange={setCommercialType}
                        />
                        <label className="commercial-field">
                          <span>Units / offices</span>
                          <input
                            className="commercial-number-input"
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={numberInputValue(commercialUnits)}
                            onChange={(event) =>
                              setCommercialUnits(parsePositiveInteger(event.target.value))
                            }
                          />
                        </label>
                      </div>
                      <div className="commercial-form-grid commercial-field--full">
                        <label className="commercial-field">
                          <span>
                            Total area <em>*</em>
                          </span>
                          <GroupedNumberInput
                            value={commercialArea}
                            onChange={(nextValue) =>
                              setCommercialArea(nextValue > 0 ? nextValue : 0)
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
                            value={numberInputValue(commercialFloors)}
                            onChange={(event) =>
                              setCommercialFloors(parsePositiveInteger(event.target.value))
                            }
                          />
                        </label>
                      </div>
                    </>
                  ) : null}

                  <label className="commercial-field commercial-form-span">
                    <span>Description</span>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>
                </div>
              </section>
            </>
          ) : (
            <section className="commercial-form-section">
              <div className="commercial-form-section-heading">
                <div>
                  <h3>{running ? 'Creating properties' : 'Batch complete'}</h3>
                  <p>
                    {running
                      ? 'Properties are created one at a time. Failures do not stop the rest of the batch.'
                      : 'Review results below. Failed items can be retried without re-entering the form.'}
                  </p>
                </div>
              </div>

              <div className="specialized-batch-metrics" aria-label="Batch summary">
                <div className="specialized-batch-metric specialized-batch-metric--green">
                  <b>{summary.created}</b>
                  <span>Created</span>
                </div>
                <div className="specialized-batch-metric specialized-batch-metric--red">
                  <b>{summary.failed}</b>
                  <span>Failed</span>
                </div>
                <div className="specialized-batch-metric specialized-batch-metric--blue">
                  <b>{summary.pending}</b>
                  <span>Remaining</span>
                </div>
                <div className="specialized-batch-metric">
                  <b>{progress}%</b>
                  <span>Progress</span>
                </div>
              </div>

              <div className="specialized-batch-progress" aria-hidden={!items.length}>
                <div className="specialized-batch-progress-track">
                  <div
                    className="specialized-batch-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <small>
                  {completed} of {items.length} processed
                </small>
              </div>

              <div className="specialized-batch-list" role="list">
                {items.map((item) => {
                  const Icon =
                    item.input.propertyType === 'plot'
                      ? IconMap2
                      : item.input.propertyType === 'residential'
                        ? IconHome
                        : IconBuildingStore

                  return (
                    <article
                      key={item.key}
                      role="listitem"
                      className={`specialized-batch-row specialized-batch-row--${item.status}`}
                    >
                      <div className="specialized-batch-row-icon">
                        <Icon size={15} stroke={1.75} />
                      </div>
                      <div className="specialized-batch-row-main">
                        <div className="specialized-batch-row-title">
                          <b>{item.input.propertyName}</b>
                          <span
                            className={`specialized-batch-status specialized-batch-status--${item.status}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>
                        <small>
                          Plot #{item.sequence}
                          {item.propertyId ? ` · ID ${item.propertyId}` : ''}
                        </small>
                        {item.error ? <p>{item.error}</p> : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" disabled={running} onClick={onClose}>
            {batchStarted ? 'Close' : 'Cancel'}
          </button>
          {!batchStarted ? (
            <button
              type="button"
              className="commercial-btn commercial-btn-primary"
              disabled={running}
              onClick={() => void runBatch()}
            >
              Create {count} {count === 1 ? 'Property' : 'Properties'}
            </button>
          ) : summary.failed > 0 ? (
            <button
              type="button"
              className="commercial-btn commercial-btn-primary"
              disabled={running}
              onClick={() => void retryFailed()}
            >
              Retry {summary.failed} failed
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
