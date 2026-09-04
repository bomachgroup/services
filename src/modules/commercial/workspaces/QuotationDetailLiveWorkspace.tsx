import { IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { formatCurrency } from '@/shared/lib/formatters'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'

import { getQuotationCapabilities } from '../quotation/quotation-capabilities'
import type { Invoice } from '../billing/billing.types'
import type { Quotation } from '../quotation/quotation.types'

export function QuotationDetailLiveWorkspace({
  quotation,
  linkedInvoice,
  saving,
  canApprove,
  canEdit,
  canRevise,
  onClose,
  onEdit,
  onApprove,
  onRevise,
  onCreateInvoice,
  onViewInvoice,
}: {
  quotation: Quotation
  linkedInvoice?: Invoice | null
  saving: boolean
  canApprove: boolean
  canEdit: boolean
  canRevise: boolean
  onClose: () => void
  onEdit: () => void
  onApprove: () => void
  onRevise: () => void
  onCreateInvoice: () => void
  onViewInvoice: () => void
}) {
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [approveConfirmPending, setApproveConfirmPending] = useState(false)
  const capabilities = getQuotationCapabilities(quotation.status, {
    hasActiveInvoice: Boolean(linkedInvoice),
  })

  useEffect(() => {
    if (!approveConfirmPending || saving) return
    setApproveConfirmPending(false)
    setApproveConfirmOpen(false)
  }, [approveConfirmPending, saving])

  const lifecycle = [
    quotation.createdAt
      ? { label: 'Created', at: quotation.createdAt, actor: quotation.createdByName }
      : null,
    quotation.approvedAt
      ? { label: 'Approved', at: quotation.approvedAt, actor: quotation.approvedByName }
      : null,
    quotation.sentAt ? { label: 'Sent to client', at: quotation.sentAt, actor: '' } : null,
    quotation.clientRespondedAt && quotation.status === 'accepted'
      ? { label: 'Client accepted', at: quotation.clientRespondedAt, actor: quotation.clientName }
      : null,
    quotation.clientRespondedAt && quotation.status === 'rejected'
      ? { label: 'Client rejected', at: quotation.clientRespondedAt, actor: quotation.clientName }
      : null,
  ].filter(Boolean) as Array<{ label: string; at: string; actor: string }>

  return (
    <div
      className="commercial-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="commercial-modal commercial-modal--xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Quotation ${quotation.quoteNumber}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Quotation File — {quotation.quoteNumber}</h2>
            <p>
              {quotation.clientName} · {quotation.serviceName} · v{quotation.version}
            </p>
          </div>
          <div className="commercial-modal-header-meta">
            <span className="commercial-pill commercial-pill-blue">{quotation.statusDisplay}</span>
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
          <div className="commercial-quote-detail-layout">
            <div className="commercial-quote-detail-main">
              <section className="commercial-form-section">
                <h3>Scope and terms</h3>
                <div className="commercial-info-grid">
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Description</div>
                    <p>{quotation.description || '—'}</p>
                  </div>
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Scope</div>
                    <p>{quotation.scopeSummary || '—'}</p>
                  </div>
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Commercial terms</div>
                    <p>{quotation.terms || '—'}</p>
                  </div>
                </div>
              </section>

              <section className="commercial-form-section">
                <h3>Pricing breakdown</h3>
                <div className="commercial-quote-pricing-layout">
                  <div className="commercial-quote-breakdown">
                    <div>
                      <span>Service fee</span>
                      <b>{formatCurrency(quotation.serviceFee)}</b>
                    </div>
                    <div>
                      <span>Other charges</span>
                      <b>{formatCurrency(quotation.otherCharges)}</b>
                    </div>
                    <div>
                      <span>Subtotal</span>
                      <b>{formatCurrency(quotation.subtotal)}</b>
                    </div>
                    <div>
                      <span>Discount</span>
                      <b>-{formatCurrency(quotation.discount)}</b>
                    </div>
                    <div>
                      <span>Tax ({quotation.taxRate}%)</span>
                      <b>{formatCurrency(quotation.taxAmount)}</b>
                    </div>
                    <div className="commercial-quote-breakdown-total">
                      <span>Offer total</span>
                      <b>{formatCurrency(quotation.amount)}</b>
                    </div>
                    <div>
                      <span>Required deposit ({quotation.depositPercent}%)</span>
                      <b>{formatCurrency(quotation.depositAmount)}</b>
                    </div>
                  </div>
                </div>
              </section>

              {capabilities.clientRespond ? (
                <section className="commercial-form-section">
                  <h3>Client response</h3>
                  <div className="commercial-notice commercial-notice-blue">
                    Waiting for the customer to accept or reject this quotation.
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="commercial-quote-detail-side">
              <section className="commercial-form-section commercial-form-section--compact">
                <h3>Commercial offer</h3>
                <div className="commercial-info-grid">
                  <div>
                    <div className="commercial-kl">Request</div>
                    <b>{quotation.serviceRequestNumber || '—'}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Previous quote</div>
                    <b>{quotation.previousQuoteNumber || '—'}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Client</div>
                    <b>{quotation.clientName}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Service</div>
                    <b>{quotation.serviceName}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Valid until</div>
                    <b>{quotation.validUntil}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Approver</div>
                    <b>{quotation.requiredApproverRoleName || '—'}</b>
                  </div>
                </div>
              </section>

              <section className="commercial-form-section commercial-form-section--compact">
                <h3>Approval & client response</h3>
                <div className="commercial-info-grid">
                  <div>
                    <div className="commercial-kl">Approved by</div>
                    <b>{quotation.approvedByName || '—'}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Approved at</div>
                    <b>
                      {quotation.approvedAt
                        ? new Date(quotation.approvedAt).toLocaleString('en-GB')
                        : '—'}
                    </b>
                  </div>
                  <div>
                    <div className="commercial-kl">Sent at</div>
                    <b>
                      {quotation.sentAt ? new Date(quotation.sentAt).toLocaleString('en-GB') : '—'}
                    </b>
                  </div>
                  <div>
                    <div className="commercial-kl">Client responded</div>
                    <b>
                      {quotation.clientRespondedAt
                        ? new Date(quotation.clientRespondedAt).toLocaleString('en-GB')
                        : '—'}
                    </b>
                  </div>
                  {quotation.clientRejectionReason ? (
                    <div className="commercial-info-full">
                      <div className="commercial-kl">Rejection reason</div>
                      <p>{quotation.clientRejectionReason}</p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="commercial-form-section commercial-form-section--compact">
                <h3>Lifecycle</h3>
                <div className="commercial-timeline-list">
                  {lifecycle.map((item) => (
                    <article key={`${item.label}-${item.at}`} className="commercial-tl">
                      <b>{item.label}</b>
                      <p>{item.actor || 'System / client event'}</p>
                      <time>{new Date(item.at).toLocaleString('en-GB')}</time>
                    </article>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" onClick={onClose}>
            Close
          </button>
          <div className="commercial-modal-footer-actions">
            {capabilities.edit && canEdit ? (
              <button type="button" className="commercial-btn" disabled={saving} onClick={onEdit}>
                Edit Quote
              </button>
            ) : null}
            {capabilities.approve && canApprove ? (
              <button
                type="button"
                className="commercial-btn commercial-btn-primary"
                disabled={saving}
                onClick={() => setApproveConfirmOpen(true)}
              >
                {saving ? 'Approving...' : 'Approve Quote'}
              </button>
            ) : null}
            {capabilities.revise && canRevise ? (
              <button
                type="button"
                className="commercial-btn commercial-btn-primary"
                disabled={saving}
                onClick={onRevise}
              >
                Create Revision
              </button>
            ) : null}
            {capabilities.createInvoice ? (
              <button
                type="button"
                className="commercial-btn commercial-btn-primary"
                disabled={saving}
                onClick={onCreateInvoice}
              >
                Create Invoice
              </button>
            ) : null}
            {capabilities.viewInvoice && linkedInvoice ? (
              <button
                type="button"
                className="commercial-btn commercial-btn-primary"
                disabled={saving}
                onClick={onViewInvoice}
              >
                View Invoice
              </button>
            ) : null}
          </div>
        </footer>
      </section>

      <ConfirmDialog
        open={approveConfirmOpen}
        tone="warning"
        title="Approve and send quotation?"
        description="The quotation will be approved internally and delivered to the client for review and acceptance."
        impact="An email will be sent with the quoted amount, service scope, and commercial terms."
        detailsTitle="Quotation summary"
        detailRows={[
          { label: 'Reference', value: quotation.quoteNumber, highlight: true },
          { label: 'Client', value: quotation.clientName || '—' },
          { label: 'Service', value: quotation.serviceName || '—' },
          { label: 'Total amount', value: formatCurrency(quotation.amount), highlight: true },
          ...(quotation.validUntil
            ? [{ label: 'Valid until', value: quotation.validUntil }]
            : []),
        ]}
        confirmLabel="Approve & send"
        cancelLabel="Go back"
        isConfirming={saving}
        onCancel={() => setApproveConfirmOpen(false)}
        onConfirm={() => {
          setApproveConfirmPending(true)
          onApprove()
        }}
      />
    </div>
  )
}
