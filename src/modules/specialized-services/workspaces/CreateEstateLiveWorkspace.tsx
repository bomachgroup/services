import { getAllStates, getCities, getLocalGovernments } from '@eh1z/nigerian-locations'
import { useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { useForm, type ReactFormExtendedApi } from '@tanstack/react-form'

import { DropdownSelect } from '@/shared/ui/dropdown-select'

import {
  estateLegalApprovalInfrastructureOptions,
  estateStatuses,
  estateTypes,
  type CreateEstateInput,
  type Estate,
} from '../real-estate/real-estate.types'
import {
  createDefaultEstateFormValues,
  mapEstateToFormValues,
  parseEstateLocation,
  type EstateFormValues,
} from '../real-estate/real-estate.form-utils'
import { validateEstate } from '../real-estate/real-estate.validation'
import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'

type EstateFormApi = ReactFormExtendedApi<
  EstateFormValues,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  unknown
>

function EstateLegalApprovalInfrastructureMultiselect({ form }: { form: EstateFormApi }) {
  return (
    <form.Subscribe
      selector={(state: { values: EstateFormValues }) =>
        estateLegalApprovalInfrastructureOptions
          .filter((option) => Boolean(state.values[option.value]))
          .map((option) => option.value)
      }
    >
      {(selected: string[]) => (
        <DropdownSelect
          mode="multiple"
          placeholder="Select documents, approvals and utilities"
          options={[...estateLegalApprovalInfrastructureOptions]}
          value={selected}
          searchable
          fullWidth
          fieldClassName="commercial-field commercial-field--full specialized-estate-features-dropdown"
          onChange={(nextSelected) => {
            const selectedSet = new Set(nextSelected)
            for (const option of estateLegalApprovalInfrastructureOptions) {
              form.setFieldValue(option.value, selectedSet.has(option.value))
            }
          }}
        />
      )}
    </form.Subscribe>
  )
}

function parseNonNegativeNumber(value: string) {
  if (value.trim() === '') return 0

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function numberInputValue(value: number | null | undefined) {
  return !value ? '' : String(value)
}

export function CreateEstateLiveWorkspace({
  estate = null,
  saving,
  onClose,
  onSubmit,
}: {
  estate?: Estate | null
  saving: boolean
  onClose: () => void
  onSubmit: (i: CreateEstateInput) => void
}) {
  const isEdit = Boolean(estate)
  const initialLocation = estate ? parseEstateLocation(estate.cityTown) : { city: '', lga: '' }
  const [error, setError] = useState('')
  const [selectedLga, setSelectedLga] = useState(initialLocation.lga)
  const [fallbackCityTown, setFallbackCityTown] = useState(initialLocation.city)
  const stateOptions = getAllStates()
  const form = useForm({
    defaultValues: estate ? mapEstateToFormValues(estate) : createDefaultEstateFormValues(),
    onSubmit: ({ value }) => {
      const cityTownValue = value.cityTown.trim() || fallbackCityTown.trim()
      const input: CreateEstateInput = {
        ...value,
        country: 'Nigeria',
        countryCode: 'NGA',
        cityTown: cityTownValue ? `${cityTownValue}, ${selectedLga}` : selectedLga,
        minPriceOtherProperties: value.minPriceOtherProperties || null,
        maxPriceOtherProperties: value.maxPriceOtherProperties || null,
        totalArea: value.totalArea || null,
        legalFee: value.legalFee || null,
        developmentFee: value.developmentFee || null,
        receiptFee: value.receiptFee || null,
        tags: value.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }
      const nextError = validateEstate(input)
      setError(nextError)
      if (!selectedLga.trim()) {
        setError('Local Government Area is required.')
        return
      }
      if (!cityTownValue.trim()) {
        setError('City / town is required.')
        return
      }
      if (!nextError) onSubmit(input)
    },
  })

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal commercial-modal--xl specialized-real-estate-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit Estate' : 'Add Estate'}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>{isEdit ? 'Edit Estate' : 'Add Estate'}</h2>
            <p>
              {isEdit
                ? 'Update estate details, pricing, location and infrastructure markers.'
                : 'Create the estate record first, then add its property inventory in a second step.'}
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
                <h3>Estate identity</h3>
                <p>Name, code, estate category and commercial positioning.</p>
              </div>
            </div>

            <div className="commercial-form-grid">
              <form.Field name="estateName">
                {(field) => (
                  <label className="commercial-field">
                    <span>
                      Estate name <em>*</em>
                    </span>
                    <input
                      autoFocus
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="estateCode">
                {(field) => (
                  <label className="commercial-field">
                    <span>
                      Estate code <em>*</em>
                    </span>
                    <input
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="EST-001"
                      disabled={isEdit}
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="estateType">
                {(field) => (
                  <RealEstateFormDropdown
                    label="Estate type"
                    options={estateTypes}
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value as typeof field.state.value)}
                  />
                )}
              </form.Field>
              <form.Field name="estateStatus">
                {(field) => (
                  <RealEstateFormDropdown
                    label="Status"
                    options={estateStatuses}
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value as typeof field.state.value)}
                  />
                )}
              </form.Field>
              <form.Field name="developerCompanyName">
                {(field) => (
                  <label className="commercial-field">
                    <span>
                      Developer / company <em>*</em>
                    </span>
                    <input
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="pricePerSqm">
                {(field) => (
                  <label className="commercial-field">
                    <span>
                      Price per sqm <em>*</em>
                    </span>
                    <input
                      className="commercial-number-input"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={numberInputValue(field.state.value)}
                      onChange={(event) =>
                        field.handleChange(parseNonNegativeNumber(event.target.value))
                      }
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="estateDescription">
                {(field) => (
                  <label className="commercial-field commercial-form-span">
                    <span>
                      Description <em>*</em>
                    </span>
                    <textarea
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </label>
                )}
              </form.Field>
            </div>
          </section>

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Location and inventory setup</h3>
                <p>Core location, plot sizing and estate-level pricing inputs.</p>
              </div>
            </div>

            <div className="commercial-form-grid">
              <form.Field name="state">
                {(field) => {
                  const lgaOptions = field.state.value ? getLocalGovernments(field.state.value) : []
                  const cityOptions =
                    field.state.value && selectedLga
                      ? getCities(field.state.value, selectedLga)
                      : []
                  const citySelectionDisabled = !field.state.value || !selectedLga
                  const useCityFallback = !citySelectionDisabled && cityOptions.length === 0

                  return (
                    <>
                      <RealEstateFormDropdown
                        label="State"
                        required
                        searchable
                        placeholder="Select state"
                        options={[
                          { value: '', label: 'Select state' },
                          ...stateOptions.map((state) => ({ value: state, label: state })),
                        ]}
                        value={field.state.value}
                        onChange={(value) => {
                          field.handleChange(value)
                          setSelectedLga('')
                          setFallbackCityTown('')
                          form.setFieldValue('cityTown', '')
                        }}
                      />

                      <RealEstateFormDropdown
                        label="LGA"
                        required
                        searchable
                        placeholder="Select LGA"
                        disabled={!field.state.value}
                        options={[
                          { value: '', label: 'Select LGA' },
                          ...lgaOptions.map((lga) => ({ value: lga, label: lga })),
                        ]}
                        value={selectedLga}
                        onChange={(value) => {
                          setSelectedLga(value)
                          setFallbackCityTown('')
                          form.setFieldValue('cityTown', '')
                        }}
                      />

                      <form.Field name="cityTown">
                        {(cityField) =>
                          useCityFallback ? (
                            <label className="commercial-field">
                              <span>
                                City / town <em>*</em>
                              </span>
                              <input
                                value={fallbackCityTown}
                                disabled={citySelectionDisabled}
                                onChange={(event) => {
                                  const nextValue = event.target.value
                                  setFallbackCityTown(nextValue)
                                  cityField.handleChange(nextValue)
                                }}
                                placeholder="Enter city or town"
                              />
                            </label>
                          ) : (
                            <RealEstateFormDropdown
                              label="City / town"
                              required
                              searchable
                              placeholder="Select city / town"
                              disabled={citySelectionDisabled}
                              options={[
                                { value: '', label: 'Select city / town' },
                                ...cityOptions.map((city) => ({ value: city, label: city })),
                              ]}
                              value={cityField.state.value}
                              onChange={(value) => cityField.handleChange(value)}
                            />
                          )
                        }
                      </form.Field>
                    </>
                  )
                }}
              </form.Field>
              <form.Field name="preciseAddress">
                {(field) => (
                  <label className="commercial-field">
                    <span>
                      Precise address <em>*</em>
                    </span>
                    <input
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="availablePlotSizes">
                {(field) => (
                  <label className="commercial-field">
                    <span>Available plot sizes</span>
                    <input
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="500, 600, 1000"
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="totalArea">
                {(field) => (
                  <label className="commercial-field">
                    <span>Total area</span>
                    <input
                      className="commercial-number-input"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={numberInputValue(field.state.value)}
                      onChange={(event) =>
                        field.handleChange(parseNonNegativeNumber(event.target.value))
                      }
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="tags">
                {(field) => (
                  <label className="commercial-field commercial-form-span">
                    <span>Tags</span>
                    <input
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="premium, gated, phase-1"
                    />
                  </label>
                )}
              </form.Field>
            </div>
          </section>

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Legal, approvals and infrastructure</h3>
                <p>Mark the documents, approvals and site utilities already available.</p>
              </div>
            </div>

            <EstateLegalApprovalInfrastructureMultiselect form={form as EstateFormApi} />
          </section>
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="commercial-btn commercial-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Estate' : 'Create Estate'}
          </button>
        </footer>
      </form>
    </div>
  )
}
