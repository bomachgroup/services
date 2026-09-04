import { useState } from 'react'

import { ConfirmDialog } from '@/shared/ui/confirm-dialog'

import {
  DocumentPreviewModal,
  FileDocumentRow,
  type PreviewDocument,
} from '../request-intake/DocumentPreviewModal'
import { fileNameFromUrl, fileTypeLabel } from '../request-intake/file-presentation.utils'
import {
  paymentMethodOptions,
  type PaymentSubmission,
  type ReviewPaymentSubmissionInput,
} from '../billing/billing.types'

function paymentMethodLabel(method: string) {
  return paymentMethodOptions.find((item) => item.value === method)?.label ?? method
}

function submittedByLabel(submission: PaymentSubmission) {
  if (submission.submittedByType === 'staff') return 'Staff upload'
  if (submission.submittedByType === 'client') return 'Client upload'
  return submission.submittedByType || 'Unknown source'
}

function formatPreciseCurrency(value: number) {
  const amount = Number(value) || 0
  const hasFraction = Math.abs(amount % 1) > 0.000001

  return `₦${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)}`
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-GB')
}

export function PendingPaymentSubmissionCard({
  submission,
  saving,
  canReview,
  onReview,
}: {
  submission: PaymentSubmission
  saving: boolean
  canReview: boolean
  onReview: (input: ReviewPaymentSubmissionInput) => void
}) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null)

  const proofFileName = submission.proofOfPayment
    ? fileNameFromUrl(submission.proofOfPayment)
    : ''
  const proofTypeLabel = proofFileName ? fileTypeLabel(proofFileName) : 'Document'

  return (
    <>
      <article className="commercial-payment-proof-card">
        <div className="commercial-payment-proof-header">
          <div>
            <div className="commercial-payment-proof-reference">{submission.reference}</div>
            <div className="commercial-payment-proof-meta">
              {submission.clientName || 'Client'} · Submitted {formatDateTime(submission.createdAt)}
            </div>
          </div>
          <div className="commercial-payment-proof-header-side">
            <span className="commercial-pill commercial-pill-yellow">
              {submission.statusDisplay || 'Pending review'}
            </span>
            <strong>{formatPreciseCurrency(submission.amount)}</strong>
          </div>
        </div>

        <div className="commercial-payment-proof-details">
          <div>
            <div className="commercial-kl">Payment method</div>
            <b>{paymentMethodLabel(submission.paymentMethod)}</b>
          </div>
          <div>
            <div className="commercial-kl">Payment date</div>
            <b>{submission.paymentDate || '—'}</b>
          </div>
          <div>
            <div className="commercial-kl">Transaction reference</div>
            <b>{submission.transactionReference || '—'}</b>
          </div>
          <div>
            <div className="commercial-kl">Receiving account</div>
            <b>{submission.financeAccountName || '—'}</b>
          </div>
          <div>
            <div className="commercial-kl">Submitted by</div>
            <b>{submittedByLabel(submission)}</b>
          </div>
          <div>
            <div className="commercial-kl">Invoice</div>
            <b>{submission.invoiceNumber || '—'}</b>
          </div>
        </div>

        {submission.proofOfPayment ? (
          <div className="commercial-payment-proof-document">
            <div className="commercial-kl">Payment proof</div>
            <FileDocumentRow
              fileUrl={submission.proofOfPayment}
              fileName={proofFileName}
              title={proofFileName}
              subtitle={`${proofTypeLabel} · Click to preview`}
              onOpen={() =>
                setPreviewDocument({
                  fileUrl: submission.proofOfPayment,
                  fileName: proofFileName,
                  label: 'Payment proof',
                })
              }
            />
          </div>
        ) : (
          <div className="commercial-payment-proof-document commercial-payment-proof-document--empty">
            <div className="commercial-kl">Payment proof</div>
            <p>No proof file attached to this submission.</p>
          </div>
        )}

        {canReview ? (
          <div className="commercial-payment-proof-actions">
            <button
              type="button"
              className="commercial-btn commercial-btn-small"
              disabled={saving}
              onClick={() => {
                setRejectOpen(true)
                setRejectionReason('')
              }}
            >
              Reject
            </button>
            <button
              type="button"
              className="commercial-btn commercial-btn-small commercial-btn-green"
              disabled={saving}
              onClick={() => setConfirmOpen(true)}
            >
              Confirm payment
            </button>
          </div>
        ) : null}

        {rejectOpen ? (
          <div className="commercial-payment-proof-rejection">
            <label className="commercial-field">
              <span>Rejection reason *</span>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain why this proof cannot be accepted."
              />
            </label>
            <div className="commercial-modal-footer-actions">
              <button
                type="button"
                className="commercial-btn commercial-btn-small"
                disabled={saving}
                onClick={() => {
                  setRejectOpen(false)
                  setRejectionReason('')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="commercial-btn commercial-btn-small commercial-btn-primary"
                disabled={saving || !rejectionReason.trim()}
                onClick={() => {
                  onReview({
                    status: 'rejected',
                    rejectionReason: rejectionReason.trim(),
                  })
                  setRejectOpen(false)
                  setRejectionReason('')
                }}
              >
                Submit rejection
              </button>
            </div>
          </div>
        ) : null}
      </article>

      {previewDocument ? (
        <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        tone="success"
        title="Record this payment?"
        description="This confirms the submitted proof, posts the receipt against the invoice, and updates the outstanding balance."
        impact="This action cannot be reversed from this screen once recorded."
        detailsTitle="Payment summary"
        detailRows={[
          { label: 'Submission', value: submission.reference, highlight: true },
          { label: 'Invoice', value: submission.invoiceNumber || '—' },
          { label: 'Client', value: submission.clientName || '—' },
          {
            label: 'Amount',
            value: formatPreciseCurrency(submission.amount),
            highlight: true,
          },
          { label: 'Method', value: paymentMethodLabel(submission.paymentMethod) },
          { label: 'Payment date', value: submission.paymentDate || '—' },
          ...(submission.transactionReference
            ? [{ label: 'Transaction ref', value: submission.transactionReference }]
            : []),
          ...(submission.financeAccountName
            ? [{ label: 'Receiving account', value: submission.financeAccountName }]
            : []),
        ]}
        confirmLabel="Record payment"
        cancelLabel="Review again"
        isConfirming={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          onReview({
            status: 'confirmed',
            ...(submission.financeAccountId
              ? { financeAccountId: submission.financeAccountId }
              : {}),
          })
          setConfirmOpen(false)
        }}
      />
    </>
  )
}
