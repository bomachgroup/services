import { IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useEffect, useMemo, useState, useCallback } from 'react'

import { formatCurrency } from '@/shared/lib/formatters'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'
import { DatePicker } from '@/shared/ui/date-picker'

import type { FinanceAccount } from '../billing/billing.types'
import {
  formatFinanceAccountOptionLabel,
  formatFinanceAccountPaymentInstructions,
} from '../billing/finance-account.utils'
import type { Quotation } from '../quotation/quotation.types'
import type { CreateInvoiceFromQuoteInput } from '../billing/billing.types'
import { validateInvoiceDates } from '../billing/payment.validation'

function defaultDueDate() {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

function defaultReceivingAccountId(accounts: FinanceAccount[]) {
  const bankAccount = accounts.find((account) => account.accountType === 'bank')
  return bankAccount?.id ?? accounts[0]?.id ?? 0
}

function defaultPaymentSchedule(quotation: Quotation) {
  if (quotation.realEstateSettlementMode === 'reservation') {
    return 'Reservation payment'
  }
  if (quotation.realEstateSettlementMode === 'installment') {
    return 'Installment down payment'
  }
  if (quotation.realEstateSettlementMode === 'full_payment') {
    return 'Full payment'
  }
  return quotation.depositPercent >= 100 ? 'Full payment' : 'Initial payment'
}

export function InvoiceBuilderLiveWorkspace({
  quotation,
  eligibleQuotations,
  quotationSelectionLocked,
  quotationSelectionLoading,
  financeAccounts,
  financeAccountsLoading,
  saving,
  onSelectQuotation,
  onClose,
  onSubmit,
}: {
  quotation: Quotation
  eligibleQuotations: Quotation[]
  quotationSelectionLocked: boolean
  quotationSelectionLoading: boolean
  financeAccounts: FinanceAccount[]
  financeAccountsLoading: boolean
  saving: boolean
  onSelectQuotation: (quotationId: number) => void
  onClose: () => void
  onSubmit: (input: CreateInvoiceFromQuoteInput) => void
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const initialReceivingAccountId = useMemo(
    () => defaultReceivingAccountId(financeAccounts),
    [financeAccounts],
  )

  const initialPaymentInstructions = useMemo(() => {
    const account = financeAccounts.find((item) => item.id === initialReceivingAccountId)
    return account
      ? formatFinanceAccountPaymentInstructions(account)
      : 'Select a receiving account to generate payment instructions.'
  }, [financeAccounts, initialReceivingAccountId])

  const form = useForm({
    defaultValues: {
      dueDate: defaultDueDate(),
      paymentSchedule: defaultPaymentSchedule(quotation),
      financeAccountId: initialReceivingAccountId,
      paymentInstructions: initialPaymentInstructions,
      notes: quotation.terms || '',
    },
    onSubmit: ({ value }) => {
      const nextErrors: Record<string, string> = {}
      const dueDateError = validateInvoiceDates(value.dueDate)
      if (dueDateError) nextErrors.dueDate = dueDateError
      if (!value.paymentSchedule.trim()) {
        nextErrors.paymentSchedule = 'Payment schedule is required.'
      }
      if (!value.financeAccountId) {
        nextErrors.financeAccountId = 'Select the receiving account for client payments.'
      }
      if (!value.paymentInstructions.trim()) {
        nextErrors.paymentInstructions = 'Payment instructions are required.'
      }
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) return

      onSubmit({
        quoteId: quotation.id,
        dueDate: value.dueDate,
        paymentSchedule: value.paymentSchedule.trim(),
        paymentInstructions: value.paymentInstructions.trim(),
        notes: value.notes.trim(),
      })
    },
  })

  const applyReceivingAccount = useCallback(
    (accountId: number) => {
      const account = financeAccounts.find((item) => item.id === accountId)
      if (!account) return
      form.setFieldValue('financeAccountId', accountId)
      form.setFieldValue('paymentInstructions', formatFinanceAccountPaymentInstructions(account))
      setErrors((current) => ({
        ...current,
        financeAccountId: '',
        paymentInstructions: '',
      }))
    },
    [financeAccounts, form],
  )

  useEffect(() => {
    if (!financeAccounts.length) return
    const currentAccountId = form.state.values.financeAccountId
    if (currentAccountId) return
    queueMicrotask(() => {
      applyReceivingAccount(defaultReceivingAccountId(financeAccounts))
    })
  }, [financeAccounts, form, applyReceivingAccount])

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal commercial-modal--xl"
        aria-label="Create Invoice / Payment Schedule"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Create Invoice / Payment Schedule</h2>
            <p>
              Draft invoice for {quotation.quoteNumber}. Email is sent only after you issue the
              invoice from invoice detail.
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
          <section className="commercial-form-section">
            {!quotationSelectionLocked ? (
              <div className="commercial-form-grid">
                <DropdownSelect
                  label="Accepted quotation"
                  required
                  fullWidth
                  fieldClassName="commercial-field commercial-field--full"
                  placeholder="Select accepted quotation"
                  disabled={quotationSelectionLoading || saving}
                  options={mapDropdownOptions(
                    eligibleQuotations.map((item) => ({
                      value: item.id,
                      label: `${item.quoteNumber} · ${item.clientName} · ${formatCurrency(item.amount)}`,
                    })),
                  )}
                  value={String(quotation.id)}
                  onChange={(value) => onSelectQuotation(Number(value))}
                />
              </div>
            ) : null}

            <div className="commercial-form-grid commercial-form-grid--3">
              <form.Field name="dueDate">
                {(field) => (
                  <DatePicker
                    label="Due date"
                    required
                    value={field.state.value}
                    invalid={Boolean(errors.dueDate)}
                    error={errors.dueDate || undefined}
                    fieldClassName="commercial-field"
                    onChange={(value) => {
                      if (errors.dueDate) {
                        setErrors((current) => ({ ...current, dueDate: '' }))
                      }
                      field.handleChange(value)
                    }}
                  />
                )}
              </form.Field>

              <form.Field name="paymentSchedule">
                {(field) => (
                  <label className="commercial-field">
                    <span>
                      Payment schedule
                      <em className="commercial-required">*</em>
                    </span>
                    <input
                      value={field.state.value}
                      onChange={(event) => {
                        if (errors.paymentSchedule) {
                          setErrors((current) => ({
                            ...current,
                            paymentSchedule: '',
                          }))
                        }
                        field.handleChange(event.target.value)
                      }}
                    />
                    {errors.paymentSchedule ? (
                      <small className="commercial-field-error">{errors.paymentSchedule}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>

              <form.Field name="financeAccountId">
                {(field) => (
                  <DropdownSelect
                    label="Receiving account"
                    required
                    fieldClassName="commercial-field"
                    placeholder={
                      financeAccountsLoading ? 'Loading accounts...' : 'Select receiving account'
                    }
                    disabled={financeAccountsLoading || saving}
                    loading={financeAccountsLoading}
                    invalid={Boolean(errors.financeAccountId)}
                    options={mapDropdownOptions(
                      financeAccounts.map((account) => ({
                        value: account.id,
                        label: formatFinanceAccountOptionLabel(account),
                      })),
                    )}
                    value={field.state.value ? String(field.state.value) : ''}
                    helpText={
                      errors.financeAccountId
                        ? undefined
                        : 'Shown in client payment instructions and used when recording payment proof.'
                    }
                    error={errors.financeAccountId}
                    onChange={(value) => applyReceivingAccount(Number(value))}
                  />
                )}
              </form.Field>
            </div>

            <div className="commercial-form-grid">
              <form.Field name="paymentInstructions">
                {(field) => (
                  <label className="commercial-field">
                    <span>
                      Payment instructions
                      <em className="commercial-required">*</em>
                    </span>
                    <textarea
                      rows={3}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    {errors.paymentInstructions ? (
                      <small className="commercial-field-error">{errors.paymentInstructions}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>

              <form.Field name="notes">
                {(field) => (
                  <label className="commercial-field">
                    <span>Notes</span>
                    <textarea
                      rows={3}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </label>
                )}
              </form.Field>
            </div>
          </section>

          <section className="commercial-form-section commercial-quote-preview-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Invoice total</h3>
              </div>
              <div className="commercial-quote-total-chip commercial-quote-total-chip--lg">
                <span>Quotation total</span>
                <b>{formatCurrency(quotation.amount)}</b>
              </div>
            </div>
          </section>
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="commercial-btn commercial-btn-primary"
            disabled={saving || quotationSelectionLoading || financeAccountsLoading}
          >
            {saving ? 'Creating...' : 'Create Draft Invoice'}
          </button>
        </footer>
      </form>
    </div>
  )
}
