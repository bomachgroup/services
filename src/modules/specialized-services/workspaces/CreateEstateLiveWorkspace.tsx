import { useCallback, useEffect, useRef, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { useForm, type ReactFormExtendedApi } from '@tanstack/react-form'

import { DropdownSelect } from '@/shared/ui/dropdown-select'
import { GroupedNumberInput } from '@/shared/ui/grouped-number-input'
import { NigeriaLocationFields } from '@/shared/ui/nigeria-location-fields'
import { formatPlotSizesFieldValue } from '@/shared/lib/number-input'

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
import {
  firstEstateFieldError,
  validateEstateFields,
  type EstateFieldErrors,
  type EstateFieldKey,
} from '../real-estate/real-estate.validation'
import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'
import { AdditionalFeesEditor } from '../real-estate/AdditionalFeesEditor'
import { BoundaryEditor } from '../real-estate/BoundaryEditor'
import { NamedDocumentsEditor } from '../real-estate/NamedDocumentsEditor'
import { realEstateApi } from '../real-estate/real-estate.api'

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

function isBoundaryError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('boundary') ||
    normalized.includes('latitude') ||
    normalized.includes('longitude') ||
    normalized.includes('corner')
  )
}

const submitFieldKeyMap: Record<string, EstateFieldKey> = {
  estate_name: 'estateName',
  estateName: 'estateName',
  estate_code: 'estateCode',
  estateCode: 'estateCode',
  developer_company_name: 'developerCompanyName',
  developerCompanyName: 'developerCompanyName',
  estate_description: 'estateDescription',
  estateDescription: 'estateDescription',
  state: 'state',
  city_town: 'cityTown',
  cityTown: 'cityTown',
  selected_lga: 'selectedLga',
  selectedLga: 'selectedLga',
  lga: 'selectedLga',
  precise_address: 'preciseAddress',
  preciseAddress: 'preciseAddress',
  price_per_sqm: 'pricePerSqm',
  pricePerSqm: 'pricePerSqm',
  min_price_other_properties: 'minPriceOtherProperties',
  minPriceOtherProperties: 'minPriceOtherProperties',
  max_price_other_properties: 'minPriceOtherProperties',
  maxPriceOtherProperties: 'minPriceOtherProperties',
  reservation_percent: 'reservationPercent',
  reservationPercent: 'reservationPercent',
  reservation_duration_hours: 'reservationDurationHours',
  reservationDurationHours: 'reservationDurationHours',
  request_claim_hold_hours: 'requestClaimHoldHours',
  requestClaimHoldHours: 'requestClaimHoldHours',
  reservation_retention_percent: 'reservationRetentionPercent',
  reservationRetentionPercent: 'reservationRetentionPercent',
  installment_down_payment_percent: 'installmentDownPaymentPercent',
  installmentDownPaymentPercent: 'installmentDownPaymentPercent',
  installment_months: 'installmentMonths',
  installmentMonths: 'installmentMonths',
  boundary: 'boundary',
  additional_fees: 'additionalFees',
  additionalFees: 'additionalFees',
  documents: 'documents',
}

function inferFieldFromMessage(message: string): EstateFieldKey | null {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('object has no attribute') ||
    normalized.includes('traceback') ||
    normalized.includes('schema')
  ) {
    return null
  }
  if (
    normalized.includes('document') ||
    normalized.includes('file_url') ||
    normalized.includes('file url')
  ) {
    return 'documents'
  }
  if (normalized.includes('boundary') || normalized.includes('latitude') || normalized.includes('longitude')) {
    return 'boundary'
  }
  if (normalized.includes('estate code') || normalized.includes('estate_code')) return 'estateCode'
  if (normalized.includes('estate name') || normalized.includes('estate_name')) return 'estateName'
  if (normalized.includes('developer') || normalized.includes('company')) {
    return 'developerCompanyName'
  }
  if (normalized.includes('description')) return 'estateDescription'
  if (normalized.includes('price per') || normalized.includes('price_per_sqm')) return 'pricePerSqm'
  if (normalized.includes('precise address') || normalized.includes('address')) {
    return 'preciseAddress'
  }
  if (normalized.includes('city') || normalized.includes('town')) return 'cityTown'
  if (normalized.includes('state')) return 'state'
  if (normalized.includes('lga') || normalized.includes('local government')) return 'selectedLga'
  if (normalized.includes('reservation') && normalized.includes('retention')) {
    return 'reservationRetentionPercent'
  }
  if (normalized.includes('reservation') && normalized.includes('duration')) {
    return 'reservationDurationHours'
  }
  if (normalized.includes('claim hold') || normalized.includes('request_claim_hold')) {
    return 'requestClaimHoldHours'
  }
  if (normalized.includes('reservation') || normalized.includes('deposit')) {
    return 'reservationPercent'
  }
  if (normalized.includes('installment') && normalized.includes('month')) {
    return 'installmentMonths'
  }
  if (normalized.includes('installment') || normalized.includes('down payment')) {
    return 'installmentDownPaymentPercent'
  }
  if (normalized.includes('fee')) return 'additionalFees'
  return null
}

function sanitizeFieldMessage(message: string): string {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('object has no attribute') ||
    normalized.includes('traceback') ||
    normalized.includes('attributeerror') ||
    normalized.includes('typeerror')
  ) {
    return 'This section could not be saved. Check the details and try again.'
  }
  return message.trim()
}

function mapSubmitFieldErrors(
  submitFieldErrors?: Record<string, string>,
  submitError = '',
): EstateFieldErrors {
  const mapped: EstateFieldErrors = {}
  for (const [key, message] of Object.entries(submitFieldErrors ?? {})) {
    if (!message) continue
    if (/^\d+\.(lat|lng)$/.test(key)) continue
    const safeMessage = sanitizeFieldMessage(message)
    if (key === 'documents' || key.startsWith('documents.')) {
      mapped.documents = safeMessage
      continue
    }
    if (key === 'additional_fees' || key.startsWith('additional_fees.')) {
      mapped.additionalFees = safeMessage
      continue
    }
    if (key === 'boundary' || key.startsWith('boundary.')) {
      mapped.boundary = safeMessage
      continue
    }
    const fieldKey = submitFieldKeyMap[key]
    if (fieldKey) mapped[fieldKey] = safeMessage
  }

  if (!Object.keys(mapped).length && submitError.trim()) {
    const safeMessage = sanitizeFieldMessage(submitError)
    const inferred = inferFieldFromMessage(safeMessage)
    if (inferred) mapped[inferred] = safeMessage
  }

  return mapped
}

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
          multipleDisplay="below"
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

export function CreateEstateLiveWorkspace({
  estate = null,
  saving,
  submitError = '',
  submitFieldErrors,
  onClose,
  onSubmit,
}: {
  estate?: Estate | null
  saving: boolean
  submitError?: string
  submitFieldErrors?: Record<string, string> | undefined
  onClose: () => void
  onSubmit: (i: CreateEstateInput) => void
}) {
  const isEdit = Boolean(estate)
  const initialLocation = estate ? parseEstateLocation(estate.cityTown) : { city: '', lga: '' }
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<EstateFieldErrors>({})
  const [selectedLga, setSelectedLga] = useState(initialLocation.lga)
  const [fallbackCityTown, setFallbackCityTown] = useState(initialLocation.city)
  const fieldRefs = useRef<Partial<Record<EstateFieldKey, HTMLElement | null>>>({})
  const boundarySubmitError = isBoundaryError(submitError) ? submitError : ''
  const boundaryFieldErrors = Object.fromEntries(
    Object.entries(submitFieldErrors ?? {}).filter(([key]) => /^\d+\.(lat|lng)$/.test(key)),
  )
  const mappedSubmitFieldErrors = mapSubmitFieldErrors(submitFieldErrors, submitError)
  const hasMappedFieldErrors = Object.keys(mappedSubmitFieldErrors).length > 0
  const bannerError =
    formError || (!boundarySubmitError && !hasMappedFieldErrors ? submitError : '')

  const focusField = useCallback((key: EstateFieldKey) => {
    window.requestAnimationFrame(() => {
      const node = fieldRefs.current[key]
      if (!node) return
      const focusable =
        node instanceof HTMLInputElement ||
        node instanceof HTMLTextAreaElement ||
        node instanceof HTMLSelectElement
          ? node
          : node.querySelector<HTMLElement>('input, textarea, select, button')
      focusable?.focus({ preventScroll: true })
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const clearFieldError = useCallback((key: EstateFieldKey) => {
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setFormError('')
  }, [])

  const applyFieldErrors = useCallback(
    (nextErrors: EstateFieldErrors) => {
      setFieldErrors(nextErrors)
      const firstKey = firstEstateFieldError(nextErrors)
      if (firstKey) focusField(firstKey)
    },
    [focusField],
  )

  const submitFieldsSignature = JSON.stringify(submitFieldErrors ?? {})

  useEffect(() => {
    const mapped = mapSubmitFieldErrors(submitFieldErrors, submitError)
    if (!Object.keys(mapped).length) return
    queueMicrotask(() => {
      setFieldErrors((current) => ({ ...current, ...mapped }))
      const firstKey = firstEstateFieldError(mapped)
      if (firstKey) focusField(firstKey)
    })
  }, [focusField, submitError, submitFieldErrors, submitFieldsSignature])

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
        documents: value.documents ?? [],
        additionalFees: value.additionalFees ?? [],
        tags: value.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }
      const nextErrors = validateEstateFields({
        ...input,
        cityTown: cityTownValue,
      })
      if (!selectedLga.trim()) {
        nextErrors.selectedLga = 'Local Government Area is required.'
      }
      if (!cityTownValue.trim()) {
        nextErrors.cityTown = 'City / town is required.'
      }

      if (Object.keys(nextErrors).length > 0) {
        setFormError('')
        applyFieldErrors(nextErrors)
        return
      }

      setFieldErrors({})
      setFormError('')
      onSubmit(input)
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
          {bannerError ? (
            <div className="commercial-notice commercial-notice-red">{bannerError}</div>
          ) : null}

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
                  <label
                    className={`commercial-field${fieldErrors.estateName ? ' commercial-field--invalid' : ''}`}
                  >
                    <span>
                      Estate name <em>*</em>
                    </span>
                    <input
                      ref={(node) => {
                        fieldRefs.current.estateName = node
                      }}
                      autoFocus
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.estateName)}
                      onChange={(event) => {
                        field.handleChange(event.target.value)
                        clearFieldError('estateName')
                      }}
                    />
                    {fieldErrors.estateName ? (
                      <small className="commercial-field-error">{fieldErrors.estateName}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>
              <form.Field name="estateCode">
                {(field) => (
                  <label
                    className={`commercial-field${fieldErrors.estateCode ? ' commercial-field--invalid' : ''}`}
                  >
                    <span>
                      Estate code <em>*</em>
                    </span>
                    <input
                      ref={(node) => {
                        fieldRefs.current.estateCode = node
                      }}
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.estateCode)}
                      onChange={(event) => {
                        field.handleChange(event.target.value)
                        clearFieldError('estateCode')
                      }}
                      placeholder="EST-001"
                      disabled={isEdit}
                    />
                    {fieldErrors.estateCode ? (
                      <small className="commercial-field-error">{fieldErrors.estateCode}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>
              <div className="commercial-form-grid-pair">
                <form.Field name="estateType">
                  {(field) => (
                    <RealEstateFormDropdown
                      label="Estate type"
                      fullWidth={false}
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
                      fullWidth={false}
                      options={estateStatuses}
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value as typeof field.state.value)}
                    />
                  )}
                </form.Field>
              </div>
              <form.Field name="developerCompanyName">
                {(field) => (
                  <label
                    className={`commercial-field${fieldErrors.developerCompanyName ? ' commercial-field--invalid' : ''}`}
                  >
                    <span>
                      Developer / company <em>*</em>
                    </span>
                    <input
                      ref={(node) => {
                        fieldRefs.current.developerCompanyName = node
                      }}
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.developerCompanyName)}
                      onChange={(event) => {
                        field.handleChange(event.target.value)
                        clearFieldError('developerCompanyName')
                      }}
                    />
                    {fieldErrors.developerCompanyName ? (
                      <small className="commercial-field-error">
                        {fieldErrors.developerCompanyName}
                      </small>
                    ) : null}
                  </label>
                )}
              </form.Field>
              <form.Field name="pricePerSqm">
                {(field) => (
                  <label
                    ref={(node) => {
                      fieldRefs.current.pricePerSqm = node
                    }}
                    className={`commercial-field${fieldErrors.pricePerSqm ? ' commercial-field--invalid' : ''}`}
                  >
                    <span>
                      Price per sqm <em>*</em>
                    </span>
                    <GroupedNumberInput
                      value={field.state.value}
                      onChange={(value) => {
                        field.handleChange(value)
                        clearFieldError('pricePerSqm')
                      }}
                    />
                    {fieldErrors.pricePerSqm ? (
                      <small className="commercial-field-error">{fieldErrors.pricePerSqm}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>
              <form.Field name="estateDescription">
                {(field) => (
                  <label
                    className={`commercial-field commercial-form-span${fieldErrors.estateDescription ? ' commercial-field--invalid' : ''}`}
                  >
                    <span>
                      Description <em>*</em>
                    </span>
                    <textarea
                      ref={(node) => {
                        fieldRefs.current.estateDescription = node
                      }}
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.estateDescription)}
                      onChange={(event) => {
                        field.handleChange(event.target.value)
                        clearFieldError('estateDescription')
                      }}
                    />
                    {fieldErrors.estateDescription ? (
                      <small className="commercial-field-error">
                        {fieldErrors.estateDescription}
                      </small>
                    ) : null}
                  </label>
                )}
              </form.Field>
            </div>
          </section>

          <form.Field name="boundary">
            {(field) => (
              <div
                ref={(node) => {
                  fieldRefs.current.boundary = node
                }}
              >
                <BoundaryEditor
                  value={field.state.value ?? []}
                  onChange={(nextValue) => {
                    field.handleChange(nextValue)
                    clearFieldError('boundary')
                  }}
                  onValidate={async (nextValue) => {
                    const result = await realEstateApi.validateEstateBoundary(nextValue, estate?.id)
                    return result.detail
                  }}
                  error={boundarySubmitError || fieldErrors.boundary || ''}
                  fieldErrors={boundaryFieldErrors}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="additionalFees">
            {(field) => (
              <div
                ref={(node) => {
                  fieldRefs.current.additionalFees = node
                }}
              >
                <AdditionalFeesEditor
                  value={field.state.value ?? []}
                  onChange={(nextValue) => {
                    field.handleChange(nextValue)
                    clearFieldError('additionalFees')
                  }}
                />
                {fieldErrors.additionalFees ? (
                  <small className="commercial-field-error">{fieldErrors.additionalFees}</small>
                ) : null}
              </div>
            )}
          </form.Field>

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Payment terms</h3>
              </div>
            </div>

            <div className="commercial-policy-stack">
              <div className="commercial-form-grid" style={{ marginBottom: '0.85rem' }}>
                <form.Field name="requestClaimHoldHours">
                  {(field) => (
                    <label
                      className={`commercial-field${fieldErrors.requestClaimHoldHours ? ' commercial-field--invalid' : ''}`}
                    >
                      <span>Request claim hold (hours) *</span>
                      <input
                        ref={(node) => {
                          fieldRefs.current.requestClaimHoldHours = node
                        }}
                        type="number"
                        min="1"
                        step="1"
                        value={field.state.value ?? ''}
                        aria-invalid={Boolean(fieldErrors.requestClaimHoldHours)}
                        onChange={(event) => {
                          field.handleChange(
                            event.target.value === '' ? null : Number(event.target.value),
                          )
                          clearFieldError('requestClaimHoldHours')
                        }}
                      />
                      {fieldErrors.requestClaimHoldHours ? (
                        <small className="commercial-field-error">
                          {fieldErrors.requestClaimHoldHours}
                        </small>
                      ) : (
                        <small>
                          Soft hold after a service request claims a property (default 48).
                        </small>
                      )}
                    </label>
                  )}
                </form.Field>
              </div>
              <form.Subscribe selector={(state) => state.values.allowReservation}>
                {(allowReservation) => (
                  <div
                    className={
                      allowReservation
                        ? 'commercial-policy-card is-enabled'
                        : 'commercial-policy-card'
                    }
                  >
                    <form.Field name="allowReservation">
                      {(field) => (
                        <label className="commercial-policy-card-header">
                          <input
                            type="checkbox"
                            className="commercial-policy-checkbox"
                            checked={Boolean(field.state.value)}
                            onChange={(event) => {
                              field.handleChange(event.target.checked)
                              clearFieldError('reservationPercent')
                              clearFieldError('reservationDurationHours')
                              clearFieldError('reservationRetentionPercent')
                            }}
                          />
                          <div className="commercial-policy-card-copy">
                            <b>Reservation</b>
                            <small>
                              Hold a unit with a deposit for a fixed duration before full payment.
                            </small>
                          </div>
                        </label>
                      )}
                    </form.Field>

                    {allowReservation ? (
                      <div className="commercial-policy-card-body">
                        <div className="commercial-form-grid">
                          <form.Field name="reservationPercent">
                            {(field) => (
                              <label
                                className={`commercial-field${fieldErrors.reservationPercent ? ' commercial-field--invalid' : ''}`}
                              >
                                <span>Deposit (%) *</span>
                                <input
                                  ref={(node) => {
                                    fieldRefs.current.reservationPercent = node
                                  }}
                                  type="number"
                                  min="0.01"
                                  max="100"
                                  step="0.01"
                                  value={field.state.value ?? ''}
                                  aria-invalid={Boolean(fieldErrors.reservationPercent)}
                                  onChange={(event) => {
                                    field.handleChange(
                                      event.target.value === '' ? null : Number(event.target.value),
                                    )
                                    clearFieldError('reservationPercent')
                                  }}
                                />
                                {fieldErrors.reservationPercent ? (
                                  <small className="commercial-field-error">
                                    {fieldErrors.reservationPercent}
                                  </small>
                                ) : null}
                              </label>
                            )}
                          </form.Field>
                          <form.Field name="reservationDurationHours">
                            {(field) => (
                              <label
                                className={`commercial-field${fieldErrors.reservationDurationHours ? ' commercial-field--invalid' : ''}`}
                              >
                                <span>Hold duration (hours) *</span>
                                <input
                                  ref={(node) => {
                                    fieldRefs.current.reservationDurationHours = node
                                  }}
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={field.state.value ?? ''}
                                  aria-invalid={Boolean(fieldErrors.reservationDurationHours)}
                                  onChange={(event) => {
                                    field.handleChange(
                                      event.target.value === '' ? null : Number(event.target.value),
                                    )
                                    clearFieldError('reservationDurationHours')
                                  }}
                                />
                                {fieldErrors.reservationDurationHours ? (
                                  <small className="commercial-field-error">
                                    {fieldErrors.reservationDurationHours}
                                  </small>
                                ) : null}
                              </label>
                            )}
                          </form.Field>
                        </div>

                        <form.Field name="reservationRefundable">
                          {(field) => (
                            <label className="commercial-policy-option">
                              <input
                                type="checkbox"
                                className="commercial-policy-checkbox"
                                checked={field.state.value !== false}
                                onChange={(event) => {
                                  field.handleChange(event.target.checked)
                                  clearFieldError('reservationRetentionPercent')
                                }}
                              />
                              <span>Refundable if cancelled</span>
                            </label>
                          )}
                        </form.Field>

                        <form.Subscribe selector={(state) => state.values.reservationRefundable}>
                          {(refundable) =>
                            refundable === false ? (
                              <form.Field name="reservationRetentionPercent">
                                {(field) => (
                                  <label
                                    className={`commercial-field${fieldErrors.reservationRetentionPercent ? ' commercial-field--invalid' : ''}`}
                                  >
                                    <span>Retention on cancellation (%) *</span>
                                    <input
                                      ref={(node) => {
                                        fieldRefs.current.reservationRetentionPercent = node
                                      }}
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      value={field.state.value ?? 0}
                                      aria-invalid={Boolean(
                                        fieldErrors.reservationRetentionPercent,
                                      )}
                                      onChange={(event) => {
                                        field.handleChange(Number(event.target.value) || 0)
                                        clearFieldError('reservationRetentionPercent')
                                      }}
                                    />
                                    {fieldErrors.reservationRetentionPercent ? (
                                      <small className="commercial-field-error">
                                        {fieldErrors.reservationRetentionPercent}
                                      </small>
                                    ) : null}
                                  </label>
                                )}
                              </form.Field>
                            ) : null
                          }
                        </form.Subscribe>
                      </div>
                    ) : null}
                  </div>
                )}
              </form.Subscribe>

              <form.Subscribe selector={(state) => state.values.allowInstallment}>
                {(allowInstallment) => (
                  <div
                    className={
                      allowInstallment
                        ? 'commercial-policy-card is-enabled'
                        : 'commercial-policy-card'
                    }
                  >
                    <form.Field name="allowInstallment">
                      {(field) => (
                        <label className="commercial-policy-card-header">
                          <input
                            type="checkbox"
                            className="commercial-policy-checkbox"
                            checked={Boolean(field.state.value)}
                            onChange={(event) => {
                              field.handleChange(event.target.checked)
                              clearFieldError('installmentDownPaymentPercent')
                              clearFieldError('installmentMonths')
                            }}
                          />
                          <div className="commercial-policy-card-copy">
                            <b>Installment plan</b>
                            <small>Allow staged payments after an initial down payment.</small>
                          </div>
                        </label>
                      )}
                    </form.Field>

                    {allowInstallment ? (
                      <div className="commercial-policy-card-body">
                        <div className="commercial-form-grid">
                          <form.Field name="installmentDownPaymentPercent">
                            {(field) => (
                              <label
                                className={`commercial-field${fieldErrors.installmentDownPaymentPercent ? ' commercial-field--invalid' : ''}`}
                              >
                                <span>Down payment (%) *</span>
                                <input
                                  ref={(node) => {
                                    fieldRefs.current.installmentDownPaymentPercent = node
                                  }}
                                  type="number"
                                  min="0.01"
                                  max="100"
                                  step="0.01"
                                  value={field.state.value ?? ''}
                                  aria-invalid={Boolean(fieldErrors.installmentDownPaymentPercent)}
                                  onChange={(event) => {
                                    field.handleChange(
                                      event.target.value === '' ? null : Number(event.target.value),
                                    )
                                    clearFieldError('installmentDownPaymentPercent')
                                  }}
                                />
                                {fieldErrors.installmentDownPaymentPercent ? (
                                  <small className="commercial-field-error">
                                    {fieldErrors.installmentDownPaymentPercent}
                                  </small>
                                ) : null}
                              </label>
                            )}
                          </form.Field>
                          <form.Field name="installmentMonths">
                            {(field) => (
                              <label
                                className={`commercial-field${fieldErrors.installmentMonths ? ' commercial-field--invalid' : ''}`}
                              >
                                <span>Term (months) *</span>
                                <input
                                  ref={(node) => {
                                    fieldRefs.current.installmentMonths = node
                                  }}
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={field.state.value ?? ''}
                                  aria-invalid={Boolean(fieldErrors.installmentMonths)}
                                  onChange={(event) => {
                                    field.handleChange(
                                      event.target.value === '' ? null : Number(event.target.value),
                                    )
                                    clearFieldError('installmentMonths')
                                  }}
                                />
                                {fieldErrors.installmentMonths ? (
                                  <small className="commercial-field-error">
                                    {fieldErrors.installmentMonths}
                                  </small>
                                ) : null}
                              </label>
                            )}
                          </form.Field>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </form.Subscribe>
            </div>
          </section>

          <form.Field name="documents">
            {(field) => (
              <div
                ref={(node) => {
                  fieldRefs.current.documents = node
                }}
              >
                <NamedDocumentsEditor
                  value={field.state.value ?? []}
                  {...(fieldErrors.documents ? { error: fieldErrors.documents } : {})}
                  onChange={(nextValue) => {
                    clearFieldError('documents')
                    field.handleChange(nextValue)
                  }}
                />
              </div>
            )}
          </form.Field>

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Location and inventory setup</h3>
                <p>Core location, plot sizing and estate-level pricing inputs.</p>
              </div>
            </div>

            <div className="commercial-form-grid">
              <form.Field name="cityTown">
                {(cityField) => (
                  <form.Field name="state">
                    {(field) => (
                      <div
                        ref={(node) => {
                          fieldRefs.current.state = node
                          fieldRefs.current.selectedLga = node
                          fieldRefs.current.cityTown = node
                        }}
                        className={
                          fieldErrors.state || fieldErrors.selectedLga || fieldErrors.cityTown
                            ? 'commercial-field commercial-field--full commercial-field--invalid'
                            : 'commercial-field commercial-field--full'
                        }
                      >
                        <NigeriaLocationFields
                          state={field.state.value}
                          lga={selectedLga}
                          cityTown={cityField.state.value}
                          fallbackCityTown={fallbackCityTown}
                          onStateChange={(value) => {
                            field.handleChange(value)
                            setSelectedLga('')
                            setFallbackCityTown('')
                            cityField.handleChange('')
                            clearFieldError('state')
                            clearFieldError('selectedLga')
                            clearFieldError('cityTown')
                          }}
                          onLgaChange={(value) => {
                            setSelectedLga(value)
                            setFallbackCityTown('')
                            cityField.handleChange('')
                            clearFieldError('selectedLga')
                            clearFieldError('cityTown')
                          }}
                          onCityTownChange={(value) => {
                            cityField.handleChange(value)
                            clearFieldError('cityTown')
                          }}
                          onFallbackCityTownChange={(value) => {
                            setFallbackCityTown(value)
                            cityField.handleChange(value)
                            clearFieldError('cityTown')
                          }}
                        />
                        {fieldErrors.state || fieldErrors.selectedLga || fieldErrors.cityTown ? (
                          <small className="commercial-field-error">
                            {fieldErrors.state || fieldErrors.selectedLga || fieldErrors.cityTown}
                          </small>
                        ) : null}
                      </div>
                    )}
                  </form.Field>
                )}
              </form.Field>
              <form.Field name="preciseAddress">
                {(field) => (
                  <label
                    className={`commercial-field${fieldErrors.preciseAddress ? ' commercial-field--invalid' : ''}`}
                  >
                    <span>
                      Precise address <em>*</em>
                    </span>
                    <input
                      ref={(node) => {
                        fieldRefs.current.preciseAddress = node
                      }}
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.preciseAddress)}
                      onChange={(event) => {
                        field.handleChange(event.target.value)
                        clearFieldError('preciseAddress')
                      }}
                    />
                    {fieldErrors.preciseAddress ? (
                      <small className="commercial-field-error">{fieldErrors.preciseAddress}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>
              <form.Field name="availablePlotSizes">
                {(field) => (
                  <label className="commercial-field">
                    <span>Available plot sizes</span>
                    <input
                      className="commercial-number-input"
                      type="text"
                      inputMode="numeric"
                      value={field.state.value}
                      placeholder="500, 600, 1,000"
                      onChange={(event) => {
                        field.handleChange(formatPlotSizesFieldValue(event.target.value))
                      }}
                      onBlur={() => {
                        field.handleChange(formatPlotSizesFieldValue(field.state.value ?? ''))
                      }}
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="totalArea">
                {(field) => (
                  <label className="commercial-field">
                    <span>Total area</span>
                    <GroupedNumberInput
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
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
