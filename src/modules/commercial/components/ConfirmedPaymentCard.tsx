import { IconChevronDown } from '@tabler/icons-react'
import { useState } from 'react'

import {
  DocumentPreviewModal,
  FileDocumentRow,
  type PreviewDocument,
} from '../request-intake/DocumentPreviewModal'
import { fileNameFromUrl, fileTypeLabel } from '../request-intake/file-presentation.utils'
import { paymentMethodOptions, type Payment } from '../billing/billing.types'

function paymentMethodLabel(method: string) {
  return paymentMethodOptions.find((item) => item.value === method)?.label ?? method
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

function sourceSubmissionReference(notes: string) {
  const match = notes.match(/Confirmed from submission (SUB-[A-Z0-9]+)/i)
  return match?.[1] ?? ''
}

function displayNotes(notes: string) {
  const trimmed = notes.trim()
  if (!trimmed) return '—'
  return trimmed.replace(/^Confirmed from submission SUB-[A-Z0-9]+\.\s*/i, '').trim() || '—'
}

export function ConfirmedPaymentCard({ payment }: { payment: Payment }) {
  const [expanded, setExpanded] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null)

  const proofFileName = payment.proofOfPayment ? fileNameFromUrl(payment.proofOfPayment) : ''
  const proofTypeLabel = proofFileName ? fileTypeLabel(proofFileName) : 'Document'
  const submissionReference = sourceSubmissionReference(payment.notes)
  const noteText = displayNotes(payment.notes)

  return (
    <>
      <article
        className={`commercial-payment-proof-card commercial-payment-proof-card--confirmed commercial-payment-proof-card--foldable${
          expanded ? ' is-expanded' : ' is-collapsed'
        }`}
      >
        <button
          type="button"
          className="commercial-payment-proof-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <div className="commercial-payment-proof-header">
            <div>
              <div className="commercial-payment-proof-reference">{payment.paymentReference}</div>
              <div className="commercial-payment-proof-meta">
                {paymentMethodLabel(payment.paymentMethod)} · {payment.paymentDate || '—'}
                {payment.createdByName ? ` · ${payment.createdByName}` : ''}
              </div>
            </div>
            <div className="commercial-payment-proof-header-side">
              <span className="commercial-pill commercial-pill-green">Confirmed</span>
              <strong>{formatPreciseCurrency(payment.amount)}</strong>
            </div>
          </div>
          <span className="commercial-payment-proof-toggle-icon" aria-hidden="true">
            <IconChevronDown size={16} stroke={2} />
          </span>
        </button>

        {expanded ? (
          <div className="commercial-payment-proof-body">
            <div className="commercial-payment-proof-details">
              <div>
                <div className="commercial-kl">Payment method</div>
                <b>{paymentMethodLabel(payment.paymentMethod)}</b>
              </div>
              <div>
                <div className="commercial-kl">Payment date</div>
                <b>{payment.paymentDate || '—'}</b>
              </div>
              <div>
                <div className="commercial-kl">Recorded on</div>
                <b>{formatDateTime(payment.createdAt)}</b>
              </div>
              <div>
                <div className="commercial-kl">Transaction reference</div>
                <b>{payment.transactionReference || '—'}</b>
              </div>
              <div>
                <div className="commercial-kl">Receiving account</div>
                <b>{payment.financeAccountName || '—'}</b>
              </div>
              {submissionReference ? (
                <div>
                  <div className="commercial-kl">Source submission</div>
                  <b>{submissionReference}</b>
                </div>
              ) : null}
              <div className={submissionReference ? undefined : 'commercial-info-full'}>
                <div className="commercial-kl">Notes</div>
                <b>{noteText}</b>
              </div>
            </div>

            {payment.proofOfPayment ? (
              <div className="commercial-payment-proof-document">
                <div className="commercial-kl">Payment proof</div>
                <FileDocumentRow
                  fileUrl={payment.proofOfPayment}
                  fileName={proofFileName}
                  title={proofFileName}
                  subtitle={`${proofTypeLabel} · Click to preview`}
                  onOpen={() =>
                    setPreviewDocument({
                      fileUrl: payment.proofOfPayment,
                      fileName: proofFileName,
                      label: 'Payment proof',
                    })
                  }
                />
              </div>
            ) : (
              <div className="commercial-payment-proof-document commercial-payment-proof-document--empty">
                <div className="commercial-kl">Payment proof</div>
                <p>No proof file attached to this payment.</p>
              </div>
            )}
          </div>
        ) : null}
      </article>

      {previewDocument ? (
        <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />
      ) : null}
    </>
  )
}
