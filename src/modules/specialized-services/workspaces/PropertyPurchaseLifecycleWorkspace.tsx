import { IconExternalLink, IconRefresh, IconX } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import { presentError } from '@/shared/errors'
import { formatCurrency, formatDateTime } from '@/shared/lib/formatters'

import { propertyPurchaseApi } from '../real-estate/property-purchase.api'
import { buildPurchaseLifecycleViewModel } from '../real-estate/property-purchase-lifecycle.view'
import type {
  PropertyPurchase,
  PropertyPurchasePaymentRequest,
} from '../real-estate/real-estate.types'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function titleCaseStatus(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function paymentAccount(request: PropertyPurchasePaymentRequest | null) {
  const dynamicInvoice = asRecord(request?.providerMetadata.dynamic_invoice)
  return {
    accountNumber: text(dynamicInvoice.accountNumber ?? dynamicInvoice.account_number),
    bankName: text(dynamicInvoice.bankName ?? dynamicInvoice.bank_name),
    accountName: text(dynamicInvoice.accountName ?? dynamicInvoice.account_name),
  }
}

export function PropertyPurchaseLifecycleWorkspace({
  purchase,
  canManage,
  onClose,
  onChanged,
}: {
  purchase: PropertyPurchase
  canManage: boolean
  onClose: () => void
  onChanged: (purchase: PropertyPurchase) => Promise<void> | void
}) {
  const [current, setCurrent] = useState(purchase)
  const [payment, setPayment] = useState<PropertyPurchasePaymentRequest | null>(null)
  const [staffAssistedOpen, setStaffAssistedOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const outstanding = Math.max(0, current.agreedPrice - current.amountPaid)
  const account = paymentAccount(payment)
  const lifecycle = useMemo(
    () => buildPurchaseLifecycleViewModel(current, formatDateTime),
    [current],
  )
  const statusLabel = titleCaseStatus(current.status)
  const hasLivePaymentRequest = current.hasLivePaymentRequest || payment != null

  // Backend services are authoritative for expiry/default timing.
  // Keeping actions available for their lifecycle states avoids render-time
  // clock reads; premature actions simply return the precise API validation.
  // Backend services are authoritative for expiry/default timing.
  // Keeping actions available for their lifecycle states avoids render-time
  // clock reads; premature actions simply return the precise API validation.
  const expireReady = current.status === 'awaiting_payment'
  const defaultReady = current.status === 'installment_active'

  const updatePurchase = async (next: PropertyPurchase) => {
    setCurrent(next)
    await onChanged(next)
  }

  const runPurchaseAction = async (action: string, operation: () => Promise<PropertyPurchase>) => {
    setBusy(action)
    setError('')
    setMessage('')
    try {
      await updatePurchase(await operation())
      setPayment(null)
    } catch (reason) {
      setError(presentError(reason, 'form-submit').message)
    } finally {
      setBusy('')
    }
  }

  const refresh = async () => {
    setBusy('refresh')
    setError('')
    setMessage('')
    try {
      await updatePurchase(await propertyPurchaseApi.getPurchase(current.id))
    } catch (reason) {
      setError(presentError(reason, 'background-action').message)
    } finally {
      setBusy('')
    }
  }

  const createPayment = async () => {
    setBusy('payment')
    setError('')
    setMessage('')
    try {
      setPayment(await propertyPurchaseApi.createPaymentRequest(current.id))
      setStaffAssistedOpen(true)
    } catch (reason) {
      setError(presentError(reason, 'form-submit').message)
    } finally {
      setBusy('')
    }
  }

  const resendInvoice = async () => {
    if (!current.invoiceId) return
    setBusy('resend')
    setError('')
    setMessage('')
    try {
      const nextPayment = await propertyPurchaseApi.resendInvoiceEmail(current.id)
      setPayment(nextPayment)
      setMessage('Invoice sent again successfully.')
    } catch (reason) {
      setError(presentError(reason, 'form-submit').message)
    } finally {
      setBusy('')
    }
  }

  const openStaffAssistedPayment = async () => {
    setStaffAssistedOpen(true)
    if (payment) return
    await createPayment()
  }

  return (
    <div
      className="commercial-modal-backdrop commercial-modal-backdrop--nested"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="commercial-modal commercial-modal--xl specialized-real-estate-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Manage property purchase"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div className="specialized-purchase-header">
            <div>
              <h2>Property Purchase</h2>
              <p>
                {current.propertyName} · {current.clientName}
              </p>
            </div>
            <div className="specialized-purchase-header-pills">
              <span
                className={`specialized-status-pill specialized-status-pill--${current.status}`}
              >
                {statusLabel}
              </span>
              <span className="specialized-status-pill specialized-status-pill--mode">
                {lifecycle.modeLabel}
              </span>
            </div>
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
          {message ? (
            <div className="commercial-notice commercial-notice-blue">{message}</div>
          ) : null}

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Purchase status</h3>
                <p>{lifecycle.sectionSubtitle}</p>
              </div>
            </div>

            <div className="specialized-purchase-kpis">
              <article className="specialized-kpi-card specialized-kpi-card--nt">
                <span>Status</span>
                <strong>{statusLabel}</strong>
              </article>
              <article className="specialized-kpi-card specialized-kpi-card--nt">
                <span>Agreed price</span>
                <strong>{formatCurrency(current.agreedPrice)}</strong>
              </article>
              <article className="specialized-kpi-card specialized-kpi-card--av">
                <span>Verified paid</span>
                <strong>{formatCurrency(current.amountPaid)}</strong>
              </article>
              <article className="specialized-kpi-card specialized-kpi-card--rs">
                <span>{lifecycle.outstandingLabel}</span>
                <strong>{formatCurrency(outstanding)}</strong>
              </article>
            </div>

            <div className="specialized-purchase-progress-card">
              <div className="specialized-purchase-progress-card__header">
                <div>
                  <strong>{lifecycle.progress.title}</strong>
                  <small>{lifecycle.progress.subtitle}</small>
                </div>
                <span>{lifecycle.progress.percent}%</span>
              </div>
              <div className="specialized-progress">
                <i style={{ width: `${lifecycle.progress.percent}%` }} />
              </div>
            </div>

            {lifecycle.deadlines.length > 0 ? (
              <div className="specialized-purchase-meta-grid">
                {lifecycle.deadlines.map((deadline) => (
                  <article key={deadline.key}>
                    <span>{deadline.label}</span>
                    <strong>{deadline.value}</strong>
                    {deadline.note ? <small>{deadline.note}</small> : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          {['awaiting_payment', 'reserved', 'installment_active'].includes(current.status) ? (
            <section className="commercial-form-section">
              <div className="commercial-form-section-heading">
                <div>
                  <h3>Staff-assisted payment</h3>
                  <p>View the payment details for an assisted settlement.</p>
                </div>
                <button
                  type="button"
                  className="commercial-btn"
                  disabled={!canManage || Boolean(busy)}
                  onClick={() => {
                    if (staffAssistedOpen) {
                      setStaffAssistedOpen(false)
                      return
                    }
                    void openStaffAssistedPayment()
                  }}
                >
                  {busy === 'payment'
                    ? 'Preparing…'
                    : staffAssistedOpen
                      ? 'Hide assisted payment'
                      : 'Open assisted payment'}
                </button>
              </div>

              {staffAssistedOpen ? (
                payment ? (
                  <div className="specialized-assisted-payment-panel">
                    <div className="specialized-assisted-payment-summary">
                      <article>
                        <span>Amount due</span>
                        <strong>{formatCurrency(payment.amount)}</strong>
                        <small>{payment.currency}</small>
                      </article>
                      <article>
                        <span>Reference</span>
                        <strong>{payment.providerReference || payment.attemptReference}</strong>
                        <small>Use this for support and reconciliation.</small>
                      </article>
                    </div>

                    {account.accountNumber ? (
                      <div className="specialized-assisted-payment-account">
                        <article>
                          <span>Bank</span>
                          <strong>{account.bankName || 'Bank transfer account'}</strong>
                        </article>
                        <article>
                          <span>Account number</span>
                          <strong>{account.accountNumber}</strong>
                        </article>
                        {account.accountName ? (
                          <article>
                            <span>Account name</span>
                            <strong>{account.accountName}</strong>
                          </article>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="specialized-assisted-payment-actions">
                      {payment.checkoutUrl ? (
                        <a
                          className="specialized-btn specialized-btn-primary"
                          href={payment.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open checkout
                          <IconExternalLink size={13} />
                        </a>
                      ) : (
                        <div className="commercial-notice">
                          Payment instructions are being prepared. Refresh and try again shortly.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="commercial-notice">Preparing assisted payment details…</div>
                )
              ) : null}
            </section>
          ) : null}

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Actions</h3>
                <p>Use the next available action to keep the purchase moving.</p>
              </div>
            </div>

            <div className="specialized-purchase-actions">
              <button
                type="button"
                className="commercial-btn"
                disabled={Boolean(busy)}
                onClick={() => void refresh()}
              >
                <IconRefresh size={13} />
                Refresh status
              </button>

              {current.status === 'awaiting_approval' ? (
                <button
                  type="button"
                  className="commercial-btn commercial-btn-primary"
                  disabled={!canManage || Boolean(busy)}
                  onClick={() =>
                    void runPurchaseAction('approve', () =>
                      propertyPurchaseApi.approvePurchase(current.id),
                    )
                  }
                >
                  {busy === 'approve' ? 'Approving…' : 'Approve for payment'}
                </button>
              ) : null}

              {['awaiting_payment', 'reserved', 'installment_active'].includes(current.status) ? (
                <>
                  {current.invoiceId ? (
                    <button
                      type="button"
                      className="commercial-btn"
                      disabled={!canManage || Boolean(busy)}
                      onClick={() => void resendInvoice()}
                    >
                      {busy === 'resend' ? 'Resending…' : 'Resend invoice'}
                    </button>
                  ) : null}
                </>
              ) : null}

              {current.status === 'awaiting_approval' ||
              (current.status === 'awaiting_payment' && current.amountPaid === 0) ? (
                <button
                  type="button"
                  className="commercial-btn"
                  disabled={!canManage || Boolean(busy) || hasLivePaymentRequest}
                  onClick={() =>
                    void runPurchaseAction('cancel', () =>
                      propertyPurchaseApi.cancelPurchase(current.id),
                    )
                  }
                >
                  {busy === 'cancel' ? 'Cancelling…' : 'Cancel unpaid purchase'}
                </button>
              ) : null}

              {expireReady ? (
                <button
                  type="button"
                  className="commercial-btn"
                  disabled={!canManage || Boolean(busy) || hasLivePaymentRequest}
                  onClick={() =>
                    void runPurchaseAction('expire', () =>
                      propertyPurchaseApi.expirePurchase(current.id),
                    )
                  }
                >
                  {busy === 'expire' ? 'Expiring…' : lifecycle.expireLabel}
                </button>
              ) : null}

              {defaultReady ? (
                <button
                  type="button"
                  className="commercial-btn"
                  disabled={!canManage || Boolean(busy)}
                  onClick={() =>
                    void runPurchaseAction('default', () =>
                      propertyPurchaseApi.defaultPurchase(current.id),
                    )
                  }
                >
                  {busy === 'default' ? 'Updating…' : lifecycle.defaultLabel}
                </button>
              ) : null}
            </div>

            {current.amountPaid > 0 && current.status !== 'fully_paid' ? (
              <div className="commercial-notice">
                Cancellation is disabled after verified money. Refund/reconciliation must be
                completed before commercial release.
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  )
}
