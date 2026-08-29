import { IconSearch, IconUserPlus, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { presentError } from '@/shared/errors'
import { formatCurrency } from '@/shared/lib/formatters'
import { propertyPurchaseApi } from '../real-estate/property-purchase.api'
import type {
  Estate,
  Property,
  PropertyPurchase,
  PurchaseClient,
  PurchaseMode,
} from '../real-estate/real-estate.types'

export function PropertyPurchaseWorkspace({
  estate,
  property,
  canCreateClient,
  onClose,
  onCreated,
}: {
  estate: Estate
  property: Property
  canCreateClient: boolean
  onClose: () => void
  onCreated: (purchase: PropertyPurchase) => void
}) {
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<PurchaseClient[]>([])
  const [selectedClient, setSelectedClient] = useState<PurchaseClient | null>(null)
  const [searching, setSearching] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [sendPortalInvite, setSendPortalInvite] = useState(false)
  const [clientFieldErrors, setClientFieldErrors] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<PurchaseMode>('full_payment')
  const [agreedPrice, setAgreedPrice] = useState(String(property.price))
  const [months, setMonths] = useState(
    estate.maxInstallmentMonths ? String(Math.min(estate.maxInstallmentMonths, 6)) : '6',
  )
  const clientFieldRefs = useRef<
    Record<string, HTMLInputElement | null>
  >({})

  const searchReady = search.trim().length >= 2
  useEffect(() => {
    if (!searchReady) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearching(true)
      void propertyPurchaseApi
        .searchClients(search)
        .then((results) => {
          if (!cancelled) setClients(results)
        })
        .catch((reason) => {
          if (!cancelled) setError(presentError(reason, 'background-action').message)
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search, searchReady])

  const visibleClients = useMemo(() => {
    if (!searchReady) return selectedClient ? [selectedClient] : []
    if (!selectedClient) return clients
    const match = clients.find((client) => client.id === selectedClient.id)
    return [match ?? selectedClient]
  }, [clients, searchReady, selectedClient])

  const price = Number(agreedPrice)
  const installmentMonths = Number(months)
  const reservationPercent =
    mode !== 'full_payment' && estate.reservationAllowed ? estate.reservationThresholdPercent : null
  const reservationAmount = useMemo(() => {
    if (reservationPercent == null || !Number.isFinite(price) || price <= 0) return null
    return (price * reservationPercent) / 100
  }, [price, reservationPercent])

  const focusClientField = (field: string) => {
    const node = clientFieldRefs.current[field]
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    window.setTimeout(() => node.focus(), 20)
  }

  const validateClientFields = () => {
    const next: Record<string, string> = {}
    if (!firstName.trim()) next.firstName = 'First name is required.'
    if (!lastName.trim()) next.lastName = 'Last name is required.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address.'
    }
    return next
  }

  const createClient = async () => {
    setError('')
    const nextFieldErrors = validateClientFields()
    setClientFieldErrors(nextFieldErrors)
    const firstErrorField = Object.keys(nextFieldErrors)[0]
    if (firstErrorField) {
      setError('Some information needs your attention before this can be submitted.')
      focusClientField(firstErrorField)
      return
    }
    setCreatingClient(true)
    try {
      const client = await propertyPurchaseApi.createClient({
        firstName,
        lastName,
        email,
        phoneNumber: phone,
        companyName: company,
        sendPortalInvite,
      })
      setSelectedClient(client)
      setManualOpen(false)
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setCompany('')
      setSendPortalInvite(false)
      setClientFieldErrors({})
    } catch (reason) {
      setError(presentError(reason, 'form-submit').message)
    } finally {
      setCreatingClient(false)
    }
  }

  const submit = async () => {
    setError('')
    if (!selectedClient) return setError('Select or create the purchaser first.')
    if (!Number.isFinite(price) || price <= 0)
      return setError('Agreed price must be greater than zero.')
    if (mode === 'installment' && (!Number.isInteger(installmentMonths) || installmentMonths < 1)) {
      return setError('Choose a positive installment duration.')
    }
    if (
      mode === 'installment' &&
      estate.maxInstallmentMonths != null &&
      installmentMonths > estate.maxInstallmentMonths
    )
      return setError(`This Estate allows at most ${estate.maxInstallmentMonths} months.`)

    setSaving(true)
    try {
      onCreated(
        await propertyPurchaseApi.createPurchase({
          propertyId: property.id,
          clientId: selectedClient.id,
          mode,
          agreedPrice: price,
          installmentMonths: mode === 'installment' ? installmentMonths : null,
        }),
      )
    } catch (reason) {
      setError(presentError(reason, 'form-submit').message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="commercial-modal commercial-modal--xl specialized-real-estate-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Start property purchase"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Start Property Purchase</h2>
            <p>
              {property.propertyName} · {estate.estateName}
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
          {error ? <div className="commercial-notice commercial-notice-red">{error}</div> : null}
          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Purchaser</h3>
                <p>Search existing CRM clients by name, email, phone or company.</p>
              </div>
            </div>
            <div className="specialized-client-search-row">
              <label className="commercial-search specialized-client-search-input">
                <IconSearch size={14} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search CRM clients"
                />
              </label>
              {canCreateClient ? (
                <button
                  type="button"
                  className="specialized-btn specialized-btn-primary"
                  onClick={() => setManualOpen(true)}
                >
                  <IconUserPlus size={14} />
                  Add New Client
                </button>
              ) : null}
            </div>
            <div className="specialized-table-wrap">
              <table className="specialized-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleClients.map((client) => {
                    const isSelected = selectedClient?.id === client.id
                    return (
                      <tr
                        key={client.id}
                        className={isSelected ? 'specialized-table-row-selected' : undefined}
                      >
                        <td>
                          <b>{client.fullName}</b>
                        </td>
                        <td>{client.phone || '—'}</td>
                        <td>{client.email || '—'}</td>
                        <td>
                          {isSelected ? (
                            <button
                              type="button"
                              className="specialized-btn specialized-btn-small"
                              onClick={() => setSelectedClient(null)}
                            >
                              Unselect
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="specialized-btn specialized-btn-small"
                              onClick={() => setSelectedClient(client)}
                            >
                              Select
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {searching && !selectedClient ? (
                <div className="commercial-notice">Searching clients…</div>
              ) : null}
              {searchReady && !searching && !selectedClient && clients.length === 0 ? (
                <div className="commercial-notice">No clients match this search yet.</div>
              ) : null}
              {selectedClient ? (
                <div className="commercial-notice">
                  Only the selected purchaser is shown. Unselect to see other search matches again.
                </div>
              ) : null}
            </div>
          </section>

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Purchase terms</h3>
                <p>
                  Agreement terms are recorded before approval; only verified payment changes
                  property state.
                </p>
              </div>
            </div>
            <div className="specialized-purchase-terms-grid">
              <label className="commercial-field">
                <span>Purchase mode</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as PurchaseMode)}>
                  <option value="full_payment">Full payment</option>
                  {estate.reservationAllowed ? (
                    <option value="reservation">Reservation</option>
                  ) : null}
                  {estate.installmentAllowed ? (
                    <option value="installment">Installment</option>
                  ) : null}
                </select>
              </label>
              <label className="commercial-field">
                <span>Agreed price</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={agreedPrice}
                  onChange={(e) => setAgreedPrice(e.target.value)}
                />
              </label>
              {mode === 'installment' ? (
                <label className="commercial-field specialized-purchase-terms-grid__full">
                  <span>Installment months</span>
                  <input
                    type="number"
                    min="1"
                    max={estate.maxInstallmentMonths ?? undefined}
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                  />
                </label>
              ) : null}
            </div>
            <div className="specialized-purchase-kpis">
              <article className="specialized-kpi-card specialized-kpi-card--nt">
                <span>Agreed price</span>
                <strong>{price > 0 ? formatCurrency(price) : '—'}</strong>
              </article>
              <article className="specialized-kpi-card specialized-kpi-card--nt">
                <span>Reservation threshold</span>
                <strong>{reservationPercent == null ? '—' : `${reservationPercent}%`}</strong>
              </article>
              <article className="specialized-kpi-card specialized-kpi-card--av">
                <span>Reservation amount</span>
                <strong>
                  {reservationAmount == null ? '—' : formatCurrency(reservationAmount)}
                </strong>
              </article>
              <article className="specialized-kpi-card specialized-kpi-card--rs">
                <span>Payment window</span>
                <strong>{estate.reservationPaymentWindowHours}h</strong>
              </article>
            </div>
          </section>
        </div>
        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="commercial-btn commercial-btn-primary"
            disabled={saving || !selectedClient}
            onClick={() => void submit()}
          >
            {saving ? 'Creating purchase…' : 'Create purchase'}
          </button>
        </footer>

        {manualOpen && canCreateClient ? (
          <div
            className="commercial-modal-backdrop commercial-modal-backdrop--nested"
            role="presentation"
            onMouseDown={() => setManualOpen(false)}
          >
            <section
              className="commercial-modal commercial-modal--xl specialized-real-estate-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Add CRM client"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="commercial-modal-header">
                <div>
                  <h2>Add New Client</h2>
                  <p>Create and select a purchaser for this property.</p>
                </div>
                <button
                  type="button"
                  className="commercial-modal-close"
                  onClick={() => setManualOpen(false)}
                  aria-label="Close"
                >
                  <IconX size={16} />
                </button>
              </header>

              <div className="commercial-modal-body">
                {manualOpen && error && Object.keys(clientFieldErrors).length ? (
                  <div className="commercial-notice commercial-notice-red">{error}</div>
                ) : null}
                <div className="commercial-form-grid">
                  <label className="commercial-field">
                    <span>
                      First name <em>*</em>
                    </span>
                    <input
                      ref={(node) => {
                        clientFieldRefs.current.firstName = node
                      }}
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value)
                        setClientFieldErrors((current) => {
                          if (!current.firstName) return current
                          const next = { ...current }
                          delete next.firstName
                          return next
                        })
                      }}
                    />
                    {clientFieldErrors.firstName ? (
                      <small className="commercial-field-error">
                        {clientFieldErrors.firstName}
                      </small>
                    ) : null}
                  </label>
                  <label className="commercial-field">
                    <span>
                      Last name <em>*</em>
                    </span>
                    <input
                      ref={(node) => {
                        clientFieldRefs.current.lastName = node
                      }}
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value)
                        setClientFieldErrors((current) => {
                          if (!current.lastName) return current
                          const next = { ...current }
                          delete next.lastName
                          return next
                        })
                      }}
                    />
                    {clientFieldErrors.lastName ? (
                      <small className="commercial-field-error">
                        {clientFieldErrors.lastName}
                      </small>
                    ) : null}
                  </label>
                  <label className="commercial-field">
                    <span>
                      Email <em>*</em>
                    </span>
                    <input
                      ref={(node) => {
                        clientFieldRefs.current.email = node
                      }}
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setClientFieldErrors((current) => {
                          if (!current.email) return current
                          const next = { ...current }
                          delete next.email
                          return next
                        })
                      }}
                    />
                    {clientFieldErrors.email ? (
                      <small className="commercial-field-error">{clientFieldErrors.email}</small>
                    ) : null}
                  </label>
                  <label className="commercial-field">
                    <span>Phone</span>
                    <input
                      ref={(node) => {
                        clientFieldRefs.current.phone = node
                      }}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                  <label className="commercial-field">
                    <span>Company</span>
                    <input
                      ref={(node) => {
                        clientFieldRefs.current.company = node
                      }}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </label>
                </div>
                <label className="commercial-checkbox-card">
                  <input
                    type="checkbox"
                    checked={sendPortalInvite}
                    onChange={(e) => setSendPortalInvite(e.target.checked)}
                  />
                  <span>
                    <strong>Send portal invite</strong>
                  </span>
                </label>
              </div>

              <footer className="commercial-modal-footer">
                <button
                  type="button"
                  className="commercial-btn"
                  disabled={creatingClient}
                  onClick={() => setManualOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="commercial-btn commercial-btn-primary"
                  disabled={creatingClient}
                  onClick={() => void createClient()}
                >
                  {creatingClient ? 'Creating client…' : 'Create and select client'}
                </button>
              </footer>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  )
}
