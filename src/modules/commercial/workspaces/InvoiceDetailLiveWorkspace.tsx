import { IconRefresh, IconTrash, IconUpload, IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useRef, useState } from 'react'

import { presentError } from '@/shared/errors'
import { formatNumberFieldValue, parseNumberFieldValue } from '@/shared/lib/number-input'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'

import { serviceRequestsApi } from '../api/service-requests.api'
import { getInvoiceCapabilities } from '../billing/invoice-capabilities'
import {
  paymentMethodOptions,
  type CreatePaymentSubmissionInput,
  type FinanceAccount,
  type Invoice,
  type Payment,
  type PaymentSubmission,
  type ReviewPaymentSubmissionInput,
  type UpdateInvoiceInput,
} from '../billing/billing.types'
import { validateInvoiceDates } from '../billing/payment.validation'
import { PendingPaymentSubmissionCard } from '../components/PendingPaymentSubmissionCard'
import { ConfirmedPaymentCard } from '../components/ConfirmedPaymentCard'
import { FileTypeIcon } from '../request-intake/file-presentation'
import { formatBytes } from '../request-intake/file-presentation.utils'

type ProofUploadState = {
  file: File
  fileName: string
  fileSizeBytes: number
  contentType: string
  fileUrl: string
  status: 'uploading' | 'uploaded' | 'error'
  error: string
} | null

type InvoiceConfirmAction = 'send' | 'cancel' | 'create-order' | null

function formatPreciseCurrency(value: number) {
  const amount = Number(value) || 0
  const hasFraction = Math.abs(amount % 1) > 0.000001

  return `₦${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)}`
}

function statusClass(status: Invoice['status']) {
  if (status === 'paid') return 'commercial-pill-green'
  if (status === 'overdue' || status === 'cancelled') {
    return 'commercial-pill-gray'
  }
  if (status === 'partially_paid') return 'commercial-pill-yellow'
  return 'commercial-pill-blue'
}

export function InvoiceDetailLiveWorkspace({
  invoice,
  payments,
  paymentsLoading,
  paymentsError,
  canViewPayments,
  onRetryPayments,
  saving,
  financeAccounts,
  financeAccountsLoading,
  pendingSubmissions,
  pendingSubmissionsLoading,
  canUpdate,
  canRecordPayment,
  canReviewSubmissions,
  canCreateServiceOrder,
  canViewServiceOrder,
  onClose,
  onCreateServiceOrder,
  onOpenServiceOrder,
  onUpdate,
  onSend,
  onCancel,
  onSubmitPaymentProof,
  onReviewPaymentSubmission,
}: {
  invoice: Invoice
  payments: Payment[]
  paymentsLoading: boolean
  paymentsError: string
  canViewPayments: boolean
  onRetryPayments: () => void
  saving: boolean
  financeAccounts: FinanceAccount[]
  financeAccountsLoading: boolean
  pendingSubmissions: PaymentSubmission[]
  pendingSubmissionsLoading: boolean
  canUpdate: boolean
  canRecordPayment: boolean
  canReviewSubmissions: boolean
  canCreateServiceOrder: boolean
  canViewServiceOrder: boolean
  onClose: () => void
  onCreateServiceOrder: () => void
  onOpenServiceOrder: () => void
  onUpdate: (input: UpdateInvoiceInput) => void
  onSend: () => void
  onCancel: () => void
  onSubmitPaymentProof: (input: CreatePaymentSubmissionInput) => void | Promise<unknown>
  onReviewPaymentSubmission: (
    submission: PaymentSubmission,
    input: ReviewPaymentSubmissionInput,
  ) => void
}) {
  const capabilities = getInvoiceCapabilities(invoice)
  const [editing, setEditing] = useState(false)
  const [proofModalOpen, setProofModalOpen] = useState(false)
  const [paymentProofErrors, setPaymentProofErrors] = useState<Record<string, string>>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [paymentProof, setPaymentProof] = useState<ProofUploadState>(null)
  const [confirmAction, setConfirmAction] = useState<InvoiceConfirmAction>(null)
  const uploadControllerRef = useRef<AbortController | null>(null)

  const editForm = useForm({
    defaultValues: {
      dueDate: invoice.dueDate,
      paymentSchedule: invoice.paymentSchedule,
      paymentInstructions: invoice.paymentInstructions,
      notes: invoice.notes,
    },
    onSubmit: ({ value }) => {
      const nextErrors: Record<string, string> = {}
      const dueDateError = validateInvoiceDates(value.dueDate)
      if (dueDateError) nextErrors.dueDate = dueDateError
      if (!value.paymentSchedule.trim()) {
        nextErrors.paymentSchedule = 'Payment schedule is required.'
      }
      setEditErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) return

      onUpdate({
        dueDate: value.dueDate,
        paymentSchedule: value.paymentSchedule.trim(),
        paymentInstructions: value.paymentInstructions.trim(),
        notes: value.notes.trim(),
      })
    },
  })

  const paymentProofForm = useForm({
    defaultValues: {
      invoiceId: invoice.id,
      amount: invoice.balance,
      paymentMethod: 'bank_transfer' as const,
      paymentDate: new Date().toISOString().slice(0, 10),
      transactionReference: '',
      financeAccountId: 0,
      proofOfPayment: '',
      notes: '',
    },
    onSubmit: async ({ value }) => {
      const nextErrors: Record<string, string> = {}
      if (pendingSubmissions.length > 0) {
        nextErrors.amount = 'A payment proof is already waiting for review.'
      }
      if (!Number.isFinite(value.amount) || value.amount <= 0) {
        nextErrors.amount = 'Payment amount must be greater than zero.'
      } else if (value.amount > invoice.balance) {
        nextErrors.amount = 'Payment cannot exceed the outstanding balance.'
      }
      if (!value.financeAccountId) {
        nextErrors.financeAccountId = 'Select the receiving account.'
      }
      if (!value.paymentMethod) {
        nextErrors.paymentMethod = 'Select a payment method.'
      }
      if (!value.paymentDate) {
        nextErrors.paymentDate = 'Payment date is required.'
      }
      if (!value.transactionReference.trim()) {
        nextErrors.transactionReference = 'Transaction reference is required.'
      }
      if (paymentProof?.status === 'uploading') {
        nextErrors.proofOfPayment = 'Wait for the upload to finish before submitting.'
      } else if (!value.proofOfPayment.trim()) {
        nextErrors.proofOfPayment = 'Upload payment proof before submitting.'
      }
      setPaymentProofErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) return

      try {
        await Promise.resolve(
          onSubmitPaymentProof({
            ...value,
            proofOfPayment: value.proofOfPayment.trim(),
            transactionReference: value.transactionReference.trim(),
            notes: value.notes.trim(),
          }),
        )
        setProofModalOpen(false)
        resetPaymentProofUpload()
        setPaymentProofErrors({})
      } catch {
        // Parent mutation handles error toast.
      }
    },
  })

  const resetPaymentProofUpload = () => {
    uploadControllerRef.current?.abort()
    uploadControllerRef.current = null
    setPaymentProof(null)
    paymentProofForm.setFieldValue('proofOfPayment', '')
  }

  const uploadPaymentProofFile = async (file: File) => {
    uploadControllerRef.current?.abort()
    const controller = new AbortController()
    uploadControllerRef.current = controller
    setPaymentProofErrors((errors) => ({ ...errors, proofOfPayment: '' }))
    setPaymentProof({
      file,
      fileName: file.name,
      fileSizeBytes: file.size,
      contentType: file.type,
      fileUrl: '',
      status: 'uploading',
      error: '',
    })

    try {
      const fileUrl = await serviceRequestsApi.uploadFile(file, controller.signal)
      setPaymentProof({
        file,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type,
        fileUrl,
        status: 'uploaded',
        error: '',
      })
      paymentProofForm.setFieldValue('proofOfPayment', fileUrl)
    } catch (uploadError) {
      if (controller.signal.aborted) return
      const message = presentError(uploadError, 'background-action').message
      setPaymentProof({
        file,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type,
        fileUrl: '',
        status: 'error',
        error: message,
      })
      paymentProofForm.setFieldValue('proofOfPayment', '')
      setPaymentProofErrors((errors) => ({ ...errors, proofOfPayment: message }))
    } finally {
      if (uploadControllerRef.current === controller) {
        uploadControllerRef.current = null
      }
    }
  }

  const retryPaymentProofUpload = () => {
    if (!paymentProof?.file) return
    void uploadPaymentProofFile(paymentProof.file)
  }

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="commercial-modal commercial-modal--xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Invoice ${invoice.invoiceNumber}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Invoice {invoice.invoiceNumber}</h2>
            <p>
              {invoice.serviceName} · {invoice.paymentSchedule || 'Payment schedule'}
            </p>
          </div>
          <div className="commercial-modal-header-meta">
            <span className={`commercial-pill ${statusClass(invoice.status)}`}>
              {invoice.statusDisplay || invoice.status.replaceAll('_', ' ')}
            </span>
            <button
              type="button"
              className="commercial-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX size={16} />
            </button>
          </div>
        </header>

        <div className="commercial-modal-body">
          <section className="commercial-form-section">
            <h3>Billing summary</h3>
            <div className="commercial-quote-pricing-layout">
              <div className="commercial-info-grid">
                <div>
                  <div className="commercial-kl">Client</div>
                  <b>{invoice.clientName || `Client #${invoice.clientId}`}</b>
                </div>
                <div>
                  <div className="commercial-kl">Service</div>
                  <b>{invoice.serviceName}</b>
                </div>
                <div>
                  <div className="commercial-kl">Quote</div>
                  <b>{invoice.quoteNumber || 'No quote linked'}</b>
                </div>
                <div>
                  <div className="commercial-kl">Request</div>
                  <b>{invoice.serviceRequestNumber || 'No request linked'}</b>
                </div>
                <div>
                  <div className="commercial-kl">Issue date</div>
                  <b>{invoice.issueDate}</b>
                </div>
                <div>
                  <div className="commercial-kl">Due date</div>
                  <b>{invoice.dueDate}</b>
                </div>
                <div>
                  <div className="commercial-kl">Payment threshold</div>
                  <b>
                    {invoice.activationThresholdAmount > 0
                      ? formatPreciseCurrency(invoice.activationThresholdAmount)
                      : 'No payment threshold set'}
                  </b>
                </div>
                <div className="commercial-info-full">
                  <div className="commercial-kl">Payment instructions</div>
                  <p>{invoice.paymentInstructions || 'No payment instructions recorded'}</p>
                </div>
              </div>

              <article className="commercial-quote-value-card">
                <div className="commercial-kpi-label">Outstanding balance</div>
                <div className="commercial-kpi-value">{formatPreciseCurrency(invoice.balance)}</div>
                <div className="commercial-kpi-note">
                  Paid {formatPreciseCurrency(invoice.amountPaid)} of{' '}
                  {formatPreciseCurrency(invoice.totalAmount)}
                </div>
              </article>
            </div>
          </section>

          <section className="commercial-form-section">
            <h3>Pricing breakdown</h3>
            <div className="commercial-quote-breakdown">
              <div>
                <span>Subtotal</span>
                <b>{formatPreciseCurrency(invoice.subtotal)}</b>
              </div>
              <div>
                <span>Tax ({invoice.taxRate}%)</span>
                <b>{formatPreciseCurrency(invoice.taxAmount)}</b>
              </div>
              <div className="commercial-quote-breakdown-total">
                <span>Total</span>
                <b>{formatPreciseCurrency(invoice.totalAmount)}</b>
              </div>
              <div>
                <span>Paid</span>
                <b>{formatPreciseCurrency(invoice.amountPaid)}</b>
              </div>
              <div>
                <span>Balance</span>
                <b>{formatPreciseCurrency(invoice.balance)}</b>
              </div>
            </div>
          </section>

          {invoice.activationThresholdMetAt ? (
            <section className="commercial-form-section">
              <div className="commercial-notice commercial-notice-blue">
                Required mobilisation/payment threshold was met on{' '}
                {new Date(invoice.activationThresholdMetAt).toLocaleString('en-GB')}. This invoice
                is ready for the Service Order stage.
              </div>
            </section>
          ) : null}

          {editing ? (
            <form
              className="commercial-form-section"
              onSubmit={(event) => {
                event.preventDefault()
                void editForm.handleSubmit()
              }}
            >
              <h3>Edit invoice controls</h3>
              <p className="commercial-form-note">
                Accepted Quote pricing is kept read-only. Only billing controls are editable.
              </p>
              <div className="commercial-form-grid">
                <editForm.Field name="dueDate">
                  {(field) => (
                    <label className="commercial-field">
                      <span>Due date *</span>
                      <input
                        type="date"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      {editErrors.dueDate ? (
                        <small className="commercial-field-error">{editErrors.dueDate}</small>
                      ) : null}
                    </label>
                  )}
                </editForm.Field>

                <editForm.Field name="paymentSchedule">
                  {(field) => (
                    <label className="commercial-field">
                      <span>Payment schedule *</span>
                      <input
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      {editErrors.paymentSchedule ? (
                        <small className="commercial-field-error">
                          {editErrors.paymentSchedule}
                        </small>
                      ) : null}
                    </label>
                  )}
                </editForm.Field>

                <editForm.Field name="paymentInstructions">
                  {(field) => (
                    <label className="commercial-field commercial-field--full">
                      <span>Payment instructions</span>
                      <textarea
                        rows={3}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </label>
                  )}
                </editForm.Field>

                <editForm.Field name="notes">
                  {(field) => (
                    <label className="commercial-field commercial-field--full">
                      <span>Notes</span>
                      <textarea
                        rows={3}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </label>
                  )}
                </editForm.Field>
              </div>
              <div className="commercial-modal-footer-actions">
                <button
                  type="button"
                  className="commercial-btn"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                >
                  Cancel edit
                </button>
                <button
                  type="submit"
                  className="commercial-btn commercial-btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : null}

          {capabilities.recordPayment && canRecordPayment ? (
            <section className="commercial-form-section">
              <div className="commercial-payment-proof-cta">
                <div>
                  <h3>Submit payment proof</h3>
                  {pendingSubmissions.length > 0 ? (
                    <p className="commercial-notice commercial-notice-blue">
                      A payment proof is already waiting for review. Confirm or reject it before
                      submitting another.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="commercial-btn commercial-btn-primary"
                  disabled={saving || invoice.balance <= 0 || pendingSubmissions.length > 0}
                  onClick={() => setProofModalOpen(true)}
                >
                  Submit Proof
                </button>
              </div>
            </section>
          ) : null}

          <section className="commercial-form-section">
            <h3>Pending payment confirmations</h3>
            {pendingSubmissionsLoading ? (
              <div className="commercial-empty">Loading payment confirmations...</div>
            ) : pendingSubmissions.length === 0 ? (
              <div className="commercial-empty">No payment proof is waiting for review.</div>
            ) : (
              <div className="commercial-payment-proof-list">
                {pendingSubmissions.map((submission) => (
                  <PendingPaymentSubmissionCard
                    key={submission.id}
                    submission={submission}
                    saving={saving}
                    canReview={canReviewSubmissions}
                    onReview={(input) => onReviewPaymentSubmission(submission, input)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="commercial-form-section">
            <h3>Payment history</h3>
            {!canViewPayments ? (
              <div className="commercial-empty">
                You do not have permission to view payment history.
              </div>
            ) : paymentsLoading ? (
              <div className="commercial-empty">Loading payments...</div>
            ) : paymentsError ? (
              <div className="commercial-empty">
                <p>{paymentsError}</p>
                <button
                  type="button"
                  className="commercial-btn commercial-btn-small"
                  onClick={onRetryPayments}
                >
                  Retry
                </button>
              </div>
            ) : payments.length === 0 ? (
              <div className="commercial-empty">No confirmed payment has been recorded.</div>
            ) : (
              <div className="commercial-payment-proof-list">
                {payments.map((payment) => (
                  <ConfirmedPaymentCard key={payment.id} payment={payment} />
                ))}
              </div>
            )}
          </section>

          {invoice.items.length > 0 ? (
            <section className="commercial-form-section">
              <h3>Invoice items</h3>
              <div className="commercial-table-wrap commercial-table-wrap--fit">
                <table className="commercial-table commercial-table--fit">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>Unit price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{formatPreciseCurrency(item.unitPrice)}</td>
                        <td>{formatPreciseCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" onClick={onClose}>
            Close
          </button>
          <div className="commercial-modal-footer-actions">
            {invoice.activationThresholdMetAt && !invoice.orderId && canCreateServiceOrder ? (
              <button
                type="button"
                className="commercial-btn commercial-btn-green"
                disabled={saving}
                onClick={() => setConfirmAction('create-order')}
              >
                Create Service Order
              </button>
            ) : null}

            {invoice.orderId && canViewServiceOrder ? (
              <button
                type="button"
                className="commercial-btn commercial-btn-primary"
                disabled={saving}
                onClick={onOpenServiceOrder}
              >
                Open Service Order
              </button>
            ) : null}

            {capabilities.edit && canUpdate && !editing ? (
              <button
                type="button"
                className="commercial-btn"
                disabled={saving}
                onClick={() => setEditing(true)}
              >
                Edit Invoice
              </button>
            ) : null}

            {capabilities.cancel && canUpdate ? (
              <button
                type="button"
                className="commercial-btn"
                disabled={saving}
                onClick={() => setConfirmAction('cancel')}
              >
                Cancel Invoice
              </button>
            ) : null}

            {capabilities.send && canUpdate ? (
              <button
                type="button"
                className="commercial-btn commercial-btn-primary"
                disabled={saving}
                onClick={() => setConfirmAction('send')}
              >
                {invoice.status === 'sent' ? 'Resend Invoice' : 'Send Invoice'}
              </button>
            ) : null}
          </div>
        </footer>
      </section>

      <ConfirmDialog
        open={confirmAction === 'send'}
        tone="info"
        title={invoice.status === 'sent' ? 'Resend invoice to client?' : 'Issue invoice to client?'}
        description={
          invoice.status === 'sent'
            ? 'A fresh invoice email will be sent to the client with current totals and payment instructions.'
            : 'The invoice will be marked as sent and emailed to the client with payment instructions and an online view link.'
        }
        impact="The client can use the email to review the invoice and submit payment proof."
        detailsTitle="Invoice summary"
        detailRows={[
          { label: 'Invoice', value: invoice.invoiceNumber, highlight: true },
          { label: 'Client', value: invoice.clientName || '—' },
          { label: 'Service', value: invoice.serviceName || '—' },
          {
            label: 'Total amount',
            value: formatPreciseCurrency(invoice.totalAmount),
            highlight: true,
          },
          { label: 'Outstanding', value: formatPreciseCurrency(invoice.balance) },
          { label: 'Due date', value: invoice.dueDate || '—' },
        ]}
        confirmLabel={invoice.status === 'sent' ? 'Resend email' : 'Issue invoice'}
        cancelLabel="Not yet"
        isConfirming={saving}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          onSend()
          setConfirmAction(null)
        }}
      />

      <ConfirmDialog
        open={confirmAction === 'cancel'}
        tone="danger"
        title="Cancel this invoice?"
        description="This invoice will be withdrawn from active billing and will no longer accept client payments."
        impact="Use this only if the invoice was created in error or the commercial arrangement changed."
        detailsTitle="Invoice summary"
        detailRows={[
          { label: 'Invoice', value: invoice.invoiceNumber, highlight: true },
          { label: 'Client', value: invoice.clientName || '—' },
          { label: 'Total amount', value: formatPreciseCurrency(invoice.totalAmount) },
          { label: 'Amount paid', value: formatPreciseCurrency(invoice.amountPaid) },
          { label: 'Current status', value: invoice.statusDisplay || invoice.status },
        ]}
        confirmLabel="Cancel invoice"
        cancelLabel="Keep invoice"
        isConfirming={saving}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          onCancel()
          setConfirmAction(null)
        }}
      />

      <ConfirmDialog
        open={confirmAction === 'create-order'}
        tone="success"
        title="Create service order?"
        description="This opens operational delivery for the paid invoice and prepares the request for fulfillment."
        impact="The service request will move forward into execution once the order is created."
        detailsTitle="Handoff summary"
        detailRows={[
          { label: 'Invoice', value: invoice.invoiceNumber, highlight: true },
          { label: 'Client', value: invoice.clientName || '—' },
          { label: 'Service', value: invoice.serviceName || '—' },
          {
            label: 'Amount received',
            value: formatPreciseCurrency(invoice.amountPaid),
            highlight: true,
          },
          { label: 'Request', value: invoice.serviceRequestNumber || '—' },
        ]}
        confirmLabel="Create service order"
        cancelLabel="Not yet"
        isConfirming={saving}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          onCreateServiceOrder()
          setConfirmAction(null)
        }}
      />

      {proofModalOpen ? (
        <div
          className="commercial-modal-backdrop commercial-modal-backdrop--nested"
          role="presentation"
          onMouseDown={(event) => {
            event.stopPropagation()
            setProofModalOpen(false)
          }}
        >
          <form
            className="commercial-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Submit payment proof"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void paymentProofForm.handleSubmit()
            }}
          >
            <header className="commercial-modal-header">
              <div>
                <h2>Submit Payment Proof</h2>
                <p>
                  Invoice {invoice.invoiceNumber} · Balance {formatPreciseCurrency(invoice.balance)}
                </p>
              </div>
              <button
                type="button"
                className="commercial-modal-close"
                onClick={() => setProofModalOpen(false)}
                aria-label="Close payment proof form"
              >
                <IconX size={16} />
              </button>
            </header>

            <div className="commercial-modal-body">
              <section className="commercial-form-section commercial-form-section--compact">
                <h3>Pricing breakdown</h3>
                <div className="commercial-quote-breakdown commercial-quote-breakdown--compact">
                  <div>
                    <span>Subtotal</span>
                    <b>{formatPreciseCurrency(invoice.subtotal)}</b>
                  </div>
                  <div>
                    <span>Tax ({invoice.taxRate}%)</span>
                    <b>{formatPreciseCurrency(invoice.taxAmount)}</b>
                  </div>
                  <div className="commercial-quote-breakdown-total">
                    <span>Total</span>
                    <b>{formatPreciseCurrency(invoice.totalAmount)}</b>
                  </div>
                  <div>
                    <span>Paid</span>
                    <b>{formatPreciseCurrency(invoice.amountPaid)}</b>
                  </div>
                  <div>
                    <span>Balance</span>
                    <b>{formatPreciseCurrency(invoice.balance)}</b>
                  </div>
                </div>
              </section>

              <section className="commercial-form-section">
                <div className="commercial-form-grid">
                  <paymentProofForm.Field name="amount">
                    {(field) => (
                      <label className="commercial-field">
                        <span>Payment amount *</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={invoice.balance}
                          value={formatNumberFieldValue(field.state.value)}
                          onChange={(event) =>
                            field.handleChange(parseNumberFieldValue(event.target.value))
                          }
                        />
                        {paymentProofErrors.amount ? (
                          <small className="commercial-field-error">
                            {paymentProofErrors.amount}
                          </small>
                        ) : null}
                      </label>
                    )}
                  </paymentProofForm.Field>

                  <paymentProofForm.Field name="financeAccountId">
                    {(field) => (
                      <label className="commercial-field">
                        <span>Receiving account *</span>
                        <select
                          value={field.state.value}
                          disabled={financeAccountsLoading}
                          onChange={(event) => field.handleChange(Number(event.target.value))}
                        >
                          <option value={0}>
                            {financeAccountsLoading ? 'Loading accounts...' : 'Select account'}
                          </option>
                          {financeAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.displayName}
                              {account.branchName ? ` · ${account.branchName}` : ''}
                            </option>
                          ))}
                        </select>
                        {paymentProofErrors.financeAccountId ? (
                          <small className="commercial-field-error">
                            {paymentProofErrors.financeAccountId}
                          </small>
                        ) : null}
                      </label>
                    )}
                  </paymentProofForm.Field>

                  <paymentProofForm.Field name="paymentMethod">
                    {(field) => (
                      <label className="commercial-field">
                        <span>Payment method *</span>
                        <select
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value as typeof field.state.value)
                          }
                        >
                          {paymentMethodOptions.map((method) => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))}
                        </select>
                        {paymentProofErrors.paymentMethod ? (
                          <small className="commercial-field-error">
                            {paymentProofErrors.paymentMethod}
                          </small>
                        ) : null}
                      </label>
                    )}
                  </paymentProofForm.Field>

                  <paymentProofForm.Field name="paymentDate">
                    {(field) => (
                      <label className="commercial-field">
                        <span>Payment date *</span>
                        <input
                          type="date"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                        {paymentProofErrors.paymentDate ? (
                          <small className="commercial-field-error">
                            {paymentProofErrors.paymentDate}
                          </small>
                        ) : null}
                      </label>
                    )}
                  </paymentProofForm.Field>

                  <paymentProofForm.Field name="transactionReference">
                    {(field) => (
                      <label className="commercial-field commercial-field--full">
                        <span>Transaction reference *</span>
                        <input
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder="Bank, gateway, POS, or receipt reference"
                        />
                        {paymentProofErrors.transactionReference ? (
                          <small className="commercial-field-error">
                            {paymentProofErrors.transactionReference}
                          </small>
                        ) : null}
                      </label>
                    )}
                  </paymentProofForm.Field>

                  <div className="commercial-field commercial-field--full">
                    <span>Payment proof *</span>
                    <label className="commercial-upload-dropzone">
                      <span className="commercial-upload-dropzone-icon">
                        <IconUpload size={18} />
                      </span>
                      <div>
                        <strong>Add proof of payment</strong>
                        <small>Upload a receipt, bank alert, POS slip, or transfer evidence.</small>
                      </div>
                      <input
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void uploadPaymentProofFile(file)
                          event.target.value = ''
                        }}
                      />
                    </label>

                    {paymentProof ? (
                      <div className="commercial-upload-list">
                        <article
                          className={`commercial-upload-item commercial-upload-item--${paymentProof.status}`}
                        >
                          <div className="commercial-upload-item-icon">
                            <FileTypeIcon
                              fileName={paymentProof.fileName}
                              contentType={paymentProof.contentType}
                            />
                          </div>
                          <div className="commercial-upload-item-body">
                            <div className="commercial-upload-item-top">
                              <strong>{paymentProof.fileName}</strong>
                              <span>{formatBytes(paymentProof.fileSizeBytes)}</span>
                            </div>
                            {paymentProof.status === 'uploading' ? (
                              <div className="commercial-upload-progress">
                                <div className="commercial-upload-progress-bar" />
                              </div>
                            ) : null}
                            {paymentProof.status === 'uploaded' ? (
                              <small>Ready for payment review</small>
                            ) : null}
                            {paymentProof.status === 'error' ? (
                              <small>{paymentProof.error}</small>
                            ) : null}
                          </div>
                          <div className="commercial-upload-actions">
                            {paymentProof.status === 'error' ? (
                              <button
                                type="button"
                                className="commercial-upload-remove"
                                onClick={retryPaymentProofUpload}
                                aria-label={`Retry ${paymentProof.fileName}`}
                              >
                                <IconRefresh size={14} />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="commercial-upload-remove"
                              onClick={resetPaymentProofUpload}
                              aria-label={`Remove ${paymentProof.fileName}`}
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </article>
                      </div>
                    ) : null}

                    {paymentProofErrors.proofOfPayment ? (
                      <small className="commercial-field-error">
                        {paymentProofErrors.proofOfPayment}
                      </small>
                    ) : null}
                  </div>

                  <paymentProofForm.Field name="notes">
                    {(field) => (
                      <label className="commercial-field commercial-field--full">
                        <span>Notes</span>
                        <textarea
                          rows={3}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </label>
                    )}
                  </paymentProofForm.Field>
                </div>
              </section>
            </div>

            <footer className="commercial-modal-footer">
              <button
                type="button"
                className="commercial-btn"
                disabled={saving}
                onClick={() => setProofModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="commercial-btn commercial-btn-primary"
                disabled={saving || paymentProof?.status === 'uploading'}
              >
                {saving ? 'Submitting...' : 'Submit for Review'}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  )
}
