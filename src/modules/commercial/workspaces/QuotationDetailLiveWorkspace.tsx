import { IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { formatCurrency } from '@/shared/lib/formatters'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'

import type { Invoice } from '../billing/billing.types'
import {
  commercialEmptyLabel,
  commercialSourceContextLabel,
} from '../lib/commercial-source-context'
import { getQuotationCapabilities } from '../quotation/quotation-capabilities'
import type { Quotation } from '../quotation/quotation.types'
import { FileTypeIcon } from '../request-intake/file-presentation'
import { formatBytes } from '../request-intake/file-presentation.utils'

export function QuotationDetailLiveWorkspace({
  quotation,
  linkedInvoice,
  saving,
  canApprove,
  canAcceptForClient,
  canEdit,
  canRevise,
  onClose,
  onEdit,
  onApprove,
  onAcceptForClient,
  onRevise,
  onCreateInvoice,
  onViewInvoice,
}: {
  quotation: Quotation
  linkedInvoice?: Invoice | null
  saving: boolean
  canApprove: boolean
  canAcceptForClient: boolean
  canEdit: boolean
  canRevise: boolean
  onClose: () => void
  onEdit: () => void
  onApprove: () => void
  onAcceptForClient: () => void
  onRevise: () => void
  onCreateInvoice: () => void
  onViewInvoice: () => void
}) {
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [approveConfirmPending, setApproveConfirmPending] = useState(false)
  const [clientAcceptConfirmOpen, setClientAcceptConfirmOpen] = useState(false)
  const [clientAcceptConfirmPending, setClientAcceptConfirmPending] = useState(false)
  const capabilities = getQuotationCapabilities(quotation.status, {
    hasActiveInvoice: Boolean(linkedInvoice),
  })

  useEffect(() => {
    if (!approveConfirmPending || saving) return
    queueMicrotask(() => {
      setApproveConfirmPending(false)
      setApproveConfirmOpen(false)
    })
  }, [approveConfirmPending, saving])

  useEffect(() => {
    if (!clientAcceptConfirmPending || saving) return
    queueMicrotask(() => {
      setClientAcceptConfirmPending(false)
      setClientAcceptConfirmOpen(false)
    })
  }, [clientAcceptConfirmPending, saving])

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
            <h2>{quotation.quoteNumber}</h2>
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
                    <p>{commercialEmptyLabel(quotation.description, 'No description recorded')}</p>
                  </div>
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Scope</div>
                    <p>{commercialEmptyLabel(quotation.scopeSummary, 'No scope recorded')}</p>
                  </div>
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Commercial terms</div>
                    <p>{commercialEmptyLabel(quotation.terms, 'No commercial terms recorded')}</p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="commercial-quote-detail-side">
              <section className="commercial-form-section commercial-form-section--compact">
                <h3>Offer details</h3>
                <div className="commercial-info-grid">
                  <div>
                    <div className="commercial-kl">Request</div>
                    <b>
                      {commercialEmptyLabel(
                        quotation.serviceRequestNumber,
                        'No request linked',
                      )}
                    </b>
                  </div>
                  <div>
                    <div className="commercial-kl">Previous quote</div>
                    <b>
                      {commercialEmptyLabel(
                        quotation.previousQuoteNumber,
                        'No previous quote',
                      )}
                    </b>
                  </div>
                  <div>
                    <div className="commercial-kl">Client</div>
                    <b>{commercialEmptyLabel(quotation.clientName, 'No client linked')}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Service</div>
                    <b>{commercialEmptyLabel(quotation.serviceName, 'No service linked')}</b>
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
            </aside>

            <section className="commercial-form-section commercial-quote-detail-pricing">
              <h3>Pricing</h3>
              <div className="commercial-quote-pricing-stack">
                {quotation.items.length ? (
                  <div className="commercial-line-summary-table commercial-line-summary-table--detail">
                    <div className="commercial-line-summary-row commercial-line-summary-row--head">
                      <span>Item</span>
                      <span>Payment</span>
                      <span className="commercial-line-summary-num">Qty</span>
                      <span className="commercial-line-summary-num">Unit price</span>
                      <span className="commercial-line-summary-num">Total</span>
                    </div>
                    {quotation.items.map((item) => {
                      const sourceLabel = commercialSourceContextLabel(item.sourceContext)
                      return (
                        <div
                          className="commercial-line-summary-row"
                          key={item.id ?? item.sortOrder}
                        >
                          <span className="commercial-line-summary-item">
                            <b>{item.description}</b>
                            {sourceLabel ? <small>{sourceLabel}</small> : null}
                          </span>
                          <span>
                            <span className="commercial-pill commercial-pill-gray">
                              {item.paymentTimingDisplay}
                            </span>
                          </span>
                          <span className="commercial-line-summary-num">{item.quantity}</span>
                          <span className="commercial-line-summary-num">
                            {formatCurrency(item.unitPrice)}
                          </span>
                          <span className="commercial-line-summary-num commercial-line-summary-total">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="commercial-form-note">No line items on this quotation.</p>
                )}

                <div className="commercial-quote-breakdown commercial-quote-breakdown--foot">
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
                  <div>
                    <span>Initial payment</span>
                    <b>{formatCurrency(quotation.initialPaymentAmount)}</b>
                  </div>
                </div>
              </div>
            </section>

            {quotation.attachments.length ? (
              <section className="commercial-form-section commercial-quote-detail-docs">
                <h3>Supporting documents</h3>
                <div className="commercial-document-list">
                  {quotation.attachments.map((attachment) => (
                    <a
                      className="commercial-document-row"
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      key={attachment.id ?? attachment.fileUrl}
                    >
                      <FileTypeIcon
                        fileName={attachment.fileName}
                        contentType={attachment.contentType}
                      />
                      <div>
                        <b>{attachment.label || attachment.fileName}</b>
                        <span>
                          {attachment.fileName} · {formatBytes(attachment.fileSizeBytes)}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="commercial-quote-detail-meta-row">
              <section className="commercial-form-section commercial-form-section--compact">
                <h3>Approval</h3>
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
            </div>

            {capabilities.clientRespond ? (
              <section className="commercial-form-section commercial-quote-detail-client">
                <h3>Client response</h3>
                <div className="commercial-notice commercial-notice-blue">
                  Waiting for the customer to accept or reject this quotation.
                </div>
              </section>
            ) : null}
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
            {capabilities.clientRespond && canAcceptForClient ? (
              <button
                type="button"
                className="commercial-btn commercial-btn-primary"
                disabled={saving}
                onClick={() => setClientAcceptConfirmOpen(true)}
              >
                {saving ? 'Recording...' : 'Record Client Acceptance'}
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
        description="Approve this quotation and share the commercial offer with the customer."
        impact="The customer will receive the quoted amount, service scope, and commercial terms."
        detailsTitle="Quotation summary"
        detailRows={[
          { label: 'Reference', value: quotation.quoteNumber, highlight: true },
          { label: 'Client', value: quotation.clientName || '—' },
          { label: 'Service', value: quotation.serviceName || '—' },
          { label: 'Total amount', value: formatCurrency(quotation.amount), highlight: true },
          ...(quotation.validUntil ? [{ label: 'Valid until', value: quotation.validUntil }] : []),
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

      <ConfirmDialog
        open={clientAcceptConfirmOpen}
        tone="warning"
        title="Record client acceptance?"
        description="Confirm that the customer has accepted this quotation and is ready to proceed."
        impact="The request will move forward for invoice preparation."
        detailsTitle="Quotation summary"
        detailRows={[
          { label: 'Reference', value: quotation.quoteNumber, highlight: true },
          { label: 'Client', value: quotation.clientName || '—' },
          { label: 'Service', value: quotation.serviceName || '—' },
          { label: 'Total amount', value: formatCurrency(quotation.amount), highlight: true },
          ...(quotation.validUntil ? [{ label: 'Valid until', value: quotation.validUntil }] : []),
        ]}
        confirmLabel="Record acceptance"
        cancelLabel="Go back"
        isConfirming={saving}
        onCancel={() => setClientAcceptConfirmOpen(false)}
        onConfirm={() => {
          setClientAcceptConfirmPending(true)
          onAcceptForClient()
        }}
      />
    </div>
  )
}
