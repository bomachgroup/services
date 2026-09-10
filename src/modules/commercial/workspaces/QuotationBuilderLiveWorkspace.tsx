import { IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import { formatCurrency } from '@/shared/lib/formatters'
import { formatNumberFieldValue, parseNumberFieldValue } from '@/shared/lib/number-input'
import { Button } from '@/shared/ui/button'
import { DatePicker } from '@/shared/ui/date-picker'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'
import { EmptyState } from '@/shared/ui/empty-state'

import type { ServiceRequestDetail, ServiceRequestListItem } from '../api/service-requests.types'
import { CommercialDocumentsEditor } from '../components/CommercialDocumentsEditor'
import { QuotationItemsEditor } from '../components/QuotationItemsEditor'
import {
  buildDefaultQuoteItems,
  ensureSinglePrimary,
  quotationPaymentTimingLabels,
} from '../quotation/quotation-item.utils'
import { quotationQueries } from '../quotation/quotation.queries'
import { deriveRealEstateQuoteDeposit } from '../quotation/real-estate-quote-deposit'
import { realEstateQueries } from '@/modules/specialized-services/real-estate/real-estate.queries'
import {
  calculateQuotationPreview,
  validateQuotationPricing,
} from '../quotation/quotation-pricing.utils'
import type {
  CreateQuotationInput,
  Quotation,
  UpdateQuotationInput,
} from '../quotation/quotation.types'

function defaultValidUntil() {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

type QuotationBuilderFieldName =
  | 'requestId'
  | 'description'
  | 'scopeSummary'
  | 'terms'
  | 'items'
  | 'discount'
  | 'taxRate'
  | 'depositPercent'
  | 'validUntil'
  | 'requiredApproverRoleId'

function focusField(
  fieldRefs: React.MutableRefObject<Record<string, HTMLElement | null>>,
  fieldName: QuotationBuilderFieldName,
) {
  window.requestAnimationFrame(() => {
    const node = fieldRefs.current[fieldName]
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement
    ) {
      node.focus()
    }
  })
}

export function QuotationBuilderLiveWorkspace({
  mode,
  request,
  eligibleRequests,
  requestSelectionLocked = false,
  requestSelectionLoading = false,
  quote,
  saving,
  onClose,
  onRequestChange,
  onCreate,
  onUpdate,
}: {
  mode: 'create' | 'edit' | 'revision'
  request: ServiceRequestDetail
  eligibleRequests?: ServiceRequestListItem[]
  requestSelectionLocked?: boolean
  requestSelectionLoading?: boolean
  quote?: Quotation
  saving: boolean
  onClose: () => void
  onRequestChange?: (requestId: number) => void
  onCreate: (input: CreateQuotationInput) => void
  onUpdate: (input: UpdateQuotationInput) => void
}) {
  const rolesQuery = useQuery(quotationQueries.roles())
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<QuotationBuilderFieldName, string>>
  >({})
  const [quoteItems, setQuoteItems] = useState(() => (quote?.items.length ? quote.items : []))
  const [attachments, setAttachments] = useState(() => quote?.attachments ?? [])
  const [documentsBusy, setDocumentsBusy] = useState(false)
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const realEstateContextQuery = useQuery({
    ...realEstateQueries.commercialContext(request.id),
    enabled: request.id > 0,
  })
  const realEstateDeposit = useMemo(
    () => deriveRealEstateQuoteDeposit(realEstateContextQuery.data),
    [realEstateContextQuery.data],
  )
  const suggestedRealEstateItems = ensureSinglePrimary(
    realEstateContextQuery.data?.suggestedQuoteItems.map((item) => ({
      description: item.description,
      kind: item.kind === 'primary' ? 'primary' : 'additional_charge',
      kindDisplay: item.kind === 'primary' ? 'Primary Item' : 'Additional Charge',
      paymentTiming: item.paymentTiming,
      paymentTimingDisplay: quotationPaymentTimingLabels[item.paymentTiming],
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100,
      sourceContext: item.sourceContext,
      sortOrder: item.sortOrder,
    })) ?? [],
  )
  const activeQuoteItems =
    quoteItems.length > 0
      ? quoteItems
      : suggestedRealEstateItems.length > 0
        ? suggestedRealEstateItems
        : buildDefaultQuoteItems({
            description: request.scopeSummary || request.serviceName,
            serviceFee: quote?.serviceFee || request.estimatedValue || request.budget || 0,
            otherCharges: quote?.otherCharges,
          })

  const form = useForm({
    defaultValues: {
      description: quote?.description || `Quotation for ${request.serviceName}`,
      scopeSummary: quote?.scopeSummary || request.scopeSummary,
      terms:
        quote?.terms ||
        'Work begins after the required mobilisation payment and approved documents are received.',
      serviceFee: quote?.serviceFee || request.estimatedValue || request.budget || 0,
      otherCharges: quote?.otherCharges ?? 0,
      discount: quote?.discount ?? 0,
      taxRate: quote?.taxRate ?? 0,
      depositPercent: quote?.depositPercent ?? realEstateDeposit?.percent ?? 30,
      validUntil: quote?.validUntil || defaultValidUntil(),
      requiredApproverRoleId: quote?.requiredApproverRoleId ?? 0,
    },
    onSubmit: ({ value }) => {
      const depositPercent = realEstateDeposit
        ? realEstateDeposit.percent
        : Number(value.depositPercent)
      const nextErrors: Partial<Record<QuotationBuilderFieldName, string>> = {
        ...validateQuotationPricing({
          serviceFee: Number(value.serviceFee),
          otherCharges: Number(value.otherCharges),
          items: activeQuoteItems,
          discount: Number(value.discount),
          taxRate: Number(value.taxRate),
          depositPercent,
        }),
      }

      if (!value.description.trim()) {
        nextErrors.description = 'Description is required.'
      }
      if (!value.scopeSummary.trim()) {
        nextErrors.scopeSummary = 'Scope of work is required.'
      }
      if (!value.terms.trim()) {
        nextErrors.terms = 'Commercial terms are required.'
      }
      if (!value.validUntil) {
        nextErrors.validUntil = 'Validity date is required.'
      }
      if (!value.requiredApproverRoleId) {
        nextErrors.requiredApproverRoleId = 'Select the required approver role.'
      }
      if (documentsBusy) {
        nextErrors.items = 'Wait for document uploads to finish before submitting.'
      }

      const firstErrorField = (
        [
          'requestId',
          'description',
          'scopeSummary',
          'validUntil',
          'items',
          'discount',
          'taxRate',
          'depositPercent',
          'requiredApproverRoleId',
          'terms',
        ] as QuotationBuilderFieldName[]
      ).find((fieldName) => nextErrors[fieldName])

      if (firstErrorField) {
        setFieldErrors(nextErrors)
        focusField(fieldRefs, firstErrorField)
        return
      }

      setFieldErrors({})

      const payload = {
        description: value.description.trim(),
        scopeSummary: value.scopeSummary.trim(),
        terms: value.terms.trim(),
        serviceFee: Number(value.serviceFee),
        otherCharges: Number(value.otherCharges),
        items: activeQuoteItems.map((item, index) => ({
          ...item,
          description: item.description.trim(),
          sortOrder: item.sortOrder || index * 10,
        })),
        attachments,
        discount: Number(value.discount),
        taxRate: Number(value.taxRate),
        depositPercent,
        validUntil: value.validUntil,
        requiredApproverRoleId: value.requiredApproverRoleId,
      }

      if (mode === 'edit') {
        onUpdate(payload)
        return
      }

      onCreate({
        clientId: request.clientId,
        serviceId: request.serviceId,
        serviceRequestId: request.id,
        ...payload,
        ...(mode === 'revision' && quote ? { previousQuoteId: quote.id } : {}),
      })
    },
  })

  useEffect(() => {
    if (!realEstateDeposit) return
    form.setFieldValue('depositPercent', realEstateDeposit.percent)
  }, [form, realEstateDeposit])

  const canSelectRequest =
    mode === 'create' &&
    !requestSelectionLocked &&
    Boolean(onRequestChange) &&
    (eligibleRequests?.length ?? 0) > 1

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal commercial-modal--xl"
        aria-label="Build Quotation / Proposal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>
              {mode === 'revision'
                ? `Revise ${quote?.quoteNumber ?? 'Quotation'}`
                : mode === 'edit'
                  ? `Edit ${quote?.quoteNumber ?? 'Quotation'}`
                  : 'Build Quotation / Proposal'}
            </h2>
            <p>Scope, pricing, deposit and approval route</p>
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
          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Source request</h3>
                <p>
                  {canSelectRequest
                    ? 'Choose the request this quotation should be built from.'
                    : 'This quotation is linked to the selected request.'}
                </p>
              </div>
            </div>

            {canSelectRequest ? (
              <div className="commercial-form-grid">
                <DropdownSelect
                  label="Service request"
                  required
                  fullWidth
                  fieldClassName="commercial-field commercial-field--full"
                  placeholder="Select service request"
                  disabled={requestSelectionLoading}
                  invalid={Boolean(fieldErrors.requestId)}
                  error={fieldErrors.requestId}
                  containerRef={(node) => {
                    fieldRefs.current.requestId = node
                  }}
                  options={mapDropdownOptions(
                    (eligibleRequests ?? []).map((item) => ({
                      value: item.id,
                      label: `${item.requestNumber} — ${item.clientName} — ${item.serviceName}`,
                    })),
                  )}
                  value={String(request.id)}
                  onChange={(value) => {
                    setFieldErrors((current) => {
                      if (!current.requestId) return current
                      const next = { ...current }
                      delete next.requestId
                      return next
                    })
                    onRequestChange?.(Number(value))
                  }}
                />
              </div>
            ) : null}

            <div className="commercial-info-grid">
              <div>
                <div className="commercial-kl">Request</div>
                <b>{request.requestNumber}</b>
              </div>
              <div>
                <div className="commercial-kl">Client</div>
                <b>{request.clientName}</b>
              </div>
              <div>
                <div className="commercial-kl">Service</div>
                <b>{request.serviceName}</b>
              </div>
              <div>
                <div className="commercial-kl">Branch</div>
                <b>{request.branchName || '—'}</b>
              </div>
            </div>
          </section>

          <section className="commercial-form-section">
            <h3>Offer</h3>
            <div className="commercial-form-grid">
              <form.Field name="description">
                {(field) => (
                  <label className="commercial-field commercial-field--full">
                    <span>
                      Description <em>*</em>
                    </span>
                    <input
                      ref={(node) => {
                        fieldRefs.current.description = node
                      }}
                      value={field.state.value}
                      onChange={(event) => {
                        setFieldErrors((current) => {
                          if (!current.description) return current
                          const next = { ...current }
                          delete next.description
                          return next
                        })
                        field.handleChange(event.target.value)
                      }}
                    />
                    {fieldErrors.description ? (
                      <small className="commercial-field-error">{fieldErrors.description}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>

              <form.Field name="scopeSummary">
                {(field) => (
                  <label className="commercial-field commercial-field--full">
                    <span>
                      Scope of work <em>*</em>
                    </span>
                    <textarea
                      ref={(node) => {
                        fieldRefs.current.scopeSummary = node
                      }}
                      rows={4}
                      value={field.state.value}
                      onChange={(event) => {
                        setFieldErrors((current) => {
                          if (!current.scopeSummary) return current
                          const next = { ...current }
                          delete next.scopeSummary
                          return next
                        })
                        field.handleChange(event.target.value)
                      }}
                    />
                    {fieldErrors.scopeSummary ? (
                      <small className="commercial-field-error">{fieldErrors.scopeSummary}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>

              <form.Field name="validUntil">
                {(field) => (
                  <DatePicker
                    label="Valid until"
                    required
                    value={field.state.value}
                    invalid={Boolean(fieldErrors.validUntil)}
                    error={fieldErrors.validUntil}
                    containerRef={(node) => {
                      fieldRefs.current.validUntil = node
                    }}
                    onChange={(value) => {
                      setFieldErrors((current) => {
                        if (!current.validUntil) return current
                        const next = { ...current }
                        delete next.validUntil
                        return next
                      })
                      field.handleChange(value)
                    }}
                  />
                )}
              </form.Field>

              {rolesQuery.isPending ? (
                <label className="commercial-field">
                  <span>
                    Approver role <em>*</em>
                  </span>
                  <input value="Loading roles..." readOnly />
                </label>
              ) : rolesQuery.isError ? (
                <div className="commercial-field">
                  <span>
                    Approver role <em>*</em>
                  </span>
                  <EmptyState
                    title="Approver roles unavailable"
                    description="Quotation submission is unavailable until approver roles are loaded."
                    action={
                      <Button variant="outline" size="sm" onClick={() => void rolesQuery.refetch()}>
                        Retry
                      </Button>
                    }
                  />
                </div>
              ) : (
                <form.Field name="requiredApproverRoleId">
                  {(field) => (
                    <DropdownSelect
                      label="Approver role"
                      required
                      fieldClassName="commercial-field"
                      placeholder="Select role"
                      invalid={Boolean(fieldErrors.requiredApproverRoleId)}
                      error={fieldErrors.requiredApproverRoleId}
                      containerRef={(node) => {
                        fieldRefs.current.requiredApproverRoleId = node
                      }}
                      options={mapDropdownOptions(
                        rolesQuery.data.map((role) => ({
                          value: role.id,
                          label: role.name,
                        })),
                      )}
                      value={field.state.value ? String(field.state.value) : ''}
                      onChange={(value) => {
                        setFieldErrors((current) => {
                          if (!current.requiredApproverRoleId) return current
                          const next = { ...current }
                          delete next.requiredApproverRoleId
                          return next
                        })
                        field.handleChange(Number(value))
                      }}
                    />
                  )}
                </form.Field>
              )}
            </div>
          </section>

          <section
            className="commercial-form-section"
            ref={(node) => {
              fieldRefs.current.items = node
            }}
          >
            <div className="commercial-form-section-heading">
              <div>
                <h3>Pricing and approval</h3>
              </div>
            </div>
            <QuotationItemsEditor
              items={activeQuoteItems}
              error={fieldErrors.items}
              onChange={(items) => {
                const nextItems = ensureSinglePrimary(items)
                setQuoteItems(nextItems)
                form.setFieldValue(
                  'serviceFee',
                  nextItems.find((item) => item.kind === 'primary')?.total ?? 0,
                )
                form.setFieldValue(
                  'otherCharges',
                  nextItems
                    .filter((item) => item.kind !== 'primary')
                    .reduce((sum, item) => sum + item.total, 0),
                )
              }}
              onClearError={() =>
                setFieldErrors((current) => {
                  if (!current.items) return current
                  const next = { ...current }
                  delete next.items
                  return next
                })
              }
            />

            <div className="commercial-quote-meta-grid">
              <form.Field name="discount">
                {(field) => (
                  <label className="commercial-field">
                    <span>Discount</span>
                    <input
                      ref={(node) => {
                        fieldRefs.current.discount = node
                      }}
                      type="number"
                      min="0"
                      value={formatNumberFieldValue(field.state.value)}
                      onChange={(event) => {
                        setFieldErrors((current) => {
                          if (!current.discount) return current
                          const next = { ...current }
                          delete next.discount
                          return next
                        })
                        field.handleChange(parseNumberFieldValue(event.target.value))
                      }}
                    />
                    {fieldErrors.discount ? (
                      <small className="commercial-field-error">{fieldErrors.discount}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>

              <form.Field name="taxRate">
                {(field) => (
                  <label className="commercial-field">
                    <span>Tax (%)</span>
                    <input
                      ref={(node) => {
                        fieldRefs.current.taxRate = node
                      }}
                      type="number"
                      min="0"
                      max="100"
                      value={formatNumberFieldValue(field.state.value)}
                      onChange={(event) => {
                        setFieldErrors((current) => {
                          if (!current.taxRate) return current
                          const next = { ...current }
                          delete next.taxRate
                          return next
                        })
                        field.handleChange(parseNumberFieldValue(event.target.value))
                      }}
                    />
                    {fieldErrors.taxRate ? (
                      <small className="commercial-field-error">{fieldErrors.taxRate}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>

              {realEstateDeposit ? (
                <div
                  className="commercial-field"
                  ref={(node) => {
                    fieldRefs.current.depositPercent = node
                  }}
                >
                  <span>Required deposit</span>
                  <div className="commercial-quote-deposit-lock">
                    <span>{realEstateDeposit.title}</span>
                    <b>{realEstateDeposit.percent}%</b>
                    {realEstateDeposit.detail ? <small>{realEstateDeposit.detail}</small> : null}
                  </div>
                </div>
              ) : (
                <form.Field name="depositPercent">
                  {(field) => (
                    <label className="commercial-field">
                      <span>Required deposit (%)</span>
                      <input
                        ref={(node) => {
                          fieldRefs.current.depositPercent = node
                        }}
                        type="number"
                        min="0"
                        max="100"
                        value={formatNumberFieldValue(field.state.value)}
                        onChange={(event) => {
                          setFieldErrors((current) => {
                            if (!current.depositPercent) return current
                            const next = { ...current }
                            delete next.depositPercent
                            return next
                          })
                          field.handleChange(parseNumberFieldValue(event.target.value))
                        }}
                      />
                      {fieldErrors.depositPercent ? (
                        <small className="commercial-field-error">
                          {fieldErrors.depositPercent}
                        </small>
                      ) : null}
                    </label>
                  )}
                </form.Field>
              )}
            </div>
          </section>

          <section className="commercial-form-section">
            <CommercialDocumentsEditor
              attachments={attachments}
              onChange={setAttachments}
              onBusyChange={setDocumentsBusy}
              onClearError={() => undefined}
            />
          </section>

          <section className="commercial-form-section">
            <h3>Commercial terms</h3>
            <form.Field name="terms">
              {(field) => (
                <label className="commercial-field commercial-field--full">
                  <span>
                    Terms <em>*</em>
                  </span>
                  <textarea
                    ref={(node) => {
                      fieldRefs.current.terms = node
                    }}
                    rows={3}
                    value={field.state.value}
                    onChange={(event) => {
                      setFieldErrors((current) => {
                        if (!current.terms) return current
                        const next = { ...current }
                        delete next.terms
                        return next
                      })
                      field.handleChange(event.target.value)
                    }}
                  />
                  {fieldErrors.terms ? (
                    <small className="commercial-field-error">{fieldErrors.terms}</small>
                  ) : null}
                </label>
              )}
            </form.Field>
          </section>

          <form.Subscribe
            selector={(state) => ({
              serviceFee: state.values.serviceFee,
              otherCharges: state.values.otherCharges,
              items: activeQuoteItems,
              discount: state.values.discount,
              taxRate: state.values.taxRate,
              depositPercent: state.values.depositPercent,
            })}
          >
            {(value) => {
              const depositPercent = realEstateDeposit
                ? realEstateDeposit.percent
                : Number(value.depositPercent)
              const preview = calculateQuotationPreview({
                serviceFee: Number(value.serviceFee),
                otherCharges: Number(value.otherCharges),
                items: value.items,
                discount: Number(value.discount),
                taxRate: Number(value.taxRate),
                depositPercent,
              })
              return (
                <section className="commercial-form-section commercial-quote-preview-section">
                  <div className="commercial-form-section-heading">
                    <div>
                      <h3>Quote total</h3>
                      <p>
                        Subtotal {formatCurrency(preview.subtotal)} · Discount{' '}
                        {formatCurrency(Number(value.discount))} · Tax{' '}
                        {formatCurrency(preview.taxAmount)} · Deposit{' '}
                        {formatCurrency(preview.depositAmount)}
                        {realEstateDeposit ? ` (${depositPercent}%)` : ''} · Initial payment{' '}
                        {formatCurrency(preview.initialPaymentAmount)}
                      </p>
                    </div>
                    <div className="commercial-quote-total-chip commercial-quote-total-chip--lg">
                      <span>Client price</span>
                      <b>{formatCurrency(preview.amount)}</b>
                    </div>
                  </div>
                </section>
              )
            }}
          </form.Subscribe>
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="commercial-btn commercial-btn-primary"
            disabled={
              saving || rolesQuery.isPending || rolesQuery.isError || requestSelectionLoading
            }
          >
            {saving
              ? 'Saving...'
              : mode === 'edit'
                ? 'Save Changes'
                : mode === 'revision'
                  ? 'Submit Revision for Approval'
                  : 'Submit for Approval'}
          </button>
        </footer>
      </form>
    </div>
  )
}
