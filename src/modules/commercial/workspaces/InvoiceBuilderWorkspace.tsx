import { IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useMemo, useState } from 'react'

import { formatNumberFieldValue, parseNumberFieldValue } from '@/shared/lib/number-input'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'
import { DatePicker } from '@/shared/ui/date-picker'

import {
  commercialMoney,
  defaultPaymentInstructions,
  invoicePaymentSchedules,
} from '../commercial.ui'
import type {
  CommercialInvoice,
  CommercialQuotation,
  CreateInvoiceInput,
} from '../types/commercial.types'
import { getInvoiceEligibleQuotations, validateInvoiceInput } from './commercial-finance.rules'

function defaultDueDate() {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

export function InvoiceBuilderWorkspace({
  quotations,
  invoices,
  initialQuotationId,
  saving,
  onClose,
  onSubmit,
}: {
  quotations: CommercialQuotation[]
  invoices: CommercialInvoice[]
  initialQuotationId?: string
  saving: boolean
  onClose: () => void
  onSubmit: (input: CreateInvoiceInput) => void
}) {
  const eligible = useMemo(
    () => getInvoiceEligibleQuotations(quotations, invoices),
    [invoices, quotations],
  )
  const initial = eligible.find((quotation) => quotation.id === initialQuotationId) ?? eligible[0]
  const [errors, setErrors] = useState<Partial<Record<keyof CreateInvoiceInput, string>>>({})

  const defaultValues: CreateInvoiceInput = {
    quotationId: initial?.id ?? '',
    dueAt: defaultDueDate(),
    amount: initial?.total ?? 0,
    schedule: invoicePaymentSchedules[0],
    paymentInstructions: defaultPaymentInstructions,
    issueNow: true,
  }

  const form = useForm({ defaultValues })

  const applyQuotation = (quotationId: string) => {
    const next = eligible.find((item) => item.id === quotationId)
    form.setFieldValue('quotationId', quotationId)
    form.setFieldValue('amount', next?.total ?? 0)
  }

  const submit = () => {
    const value = form.state.values
    const nextErrors = validateInvoiceInput(value)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onSubmit(value)
  }

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal commercial-modal--xl"
        aria-label="Create Invoice / Payment Schedule"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Create Invoice / Payment Schedule</h2>
            <p>Generate billing from an accepted quotation</p>
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
          {eligible.length === 0 ? (
            <div className="commercial-empty">No accepted, uninvoiced quotation is available.</div>
          ) : (
            <>
              <section className="commercial-form-section">
                <h3>Source quotation</h3>
                <div className="commercial-form-grid">
                  <form.Field name="quotationId">
                    {(field) => (
                      <DropdownSelect
                        label="Quotation"
                        required
                        fullWidth
                        fieldClassName="commercial-field"
                        options={mapDropdownOptions(
                          eligible.map((quotation) => ({
                            value: quotation.id,
                            label: `${quotation.id} — ${quotation.client} — ${commercialMoney.format(quotation.total)}`,
                          })),
                        )}
                        value={field.state.value}
                        invalid={Boolean(errors.quotationId)}
                        error={errors.quotationId}
                        onChange={applyQuotation}
                      />
                    )}
                  </form.Field>

                  <form.Field name="dueAt">
                    {(field) => (
                      <DatePicker
                    label="Due date"
                    required
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    fieldClassName="commercial-field"
                    invalid={Boolean(errors.dueAt)}
                    error={errors.dueAt}
                  />
                    )}
                  </form.Field>
                </div>
              </section>

              <section className="commercial-form-section">
                <h3>Amount and schedule</h3>
                <div className="commercial-form-grid">
                  <form.Field name="amount">
                    {(field) => (
                      <label className="commercial-field">
                        <span>Invoice amount *</span>
                        <input
                          type="number"
                          min="0"
                          value={formatNumberFieldValue(field.state.value)}
                          onChange={(event) =>
                            field.handleChange(parseNumberFieldValue(event.target.value))
                          }
                        />
                        {errors.amount ? <em>{errors.amount}</em> : null}
                      </label>
                    )}
                  </form.Field>

                  <form.Field name="schedule">
                    {(field) => (
                      <DropdownSelect
                        label="Payment schedule"
                        required
                        fullWidth
                        fieldClassName="commercial-field"
                        options={mapDropdownOptions(
                          invoicePaymentSchedules.map((schedule) => ({
                            value: schedule,
                            label: schedule,
                          })),
                        )}
                        value={field.state.value}
                        invalid={Boolean(errors.schedule)}
                        error={errors.schedule}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="paymentInstructions">
                    {(field) => (
                      <label className="commercial-field commercial-field--full">
                        <span>Payment instructions</span>
                        <textarea
                          rows={3}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                        {errors.paymentInstructions ? <em>{errors.paymentInstructions}</em> : null}
                      </label>
                    )}
                  </form.Field>
                </div>
              </section>

              <form.Subscribe selector={(state) => state.values.amount}>
                {(amount) => (
                  <section className="commercial-form-section commercial-quote-preview-section">
                    <div className="commercial-form-section-heading">
                      <div>
                        <h3>Invoice total</h3>
                        <p>Amount that will be issued to the client</p>
                      </div>
                      <div className="commercial-quote-total-chip commercial-quote-total-chip--lg">
                        <span>Billable value</span>
                        <b>{commercialMoney.format(Number(amount) || 0)}</b>
                      </div>
                    </div>
                  </section>
                )}
              </form.Subscribe>
            </>
          )}
        </div>

        <footer className="commercial-modal-footer">
          <div className="commercial-modal-footer-start">
            <button type="button" className="commercial-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
          <div className="commercial-modal-footer-actions">
            <button
              type="submit"
              className="commercial-btn commercial-btn-primary"
              disabled={saving || eligible.length === 0}
            >
              {saving ? 'Issuing...' : 'Issue Invoice'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}
