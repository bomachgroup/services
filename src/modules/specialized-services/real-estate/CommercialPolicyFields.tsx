import type { ChangeEvent } from 'react'

export interface CommercialPolicyFormValue {
  allowReservation?: boolean
  reservationPercent?: number | null
  reservationDurationHours?: number | null
  requestClaimHoldHours?: number | null
  reservationRefundable?: boolean
  reservationRetentionPercent?: number | null
  allowInstallment?: boolean
  installmentDownPaymentPercent?: number | null
  installmentMonths?: number | null
  installmentGracePeriodDays?: number | null
}

function numberValue(value: number | null | undefined) {
  return value == null ? '' : String(value)
}

function numberValueWithDefault(value: number | null | undefined, fallback: number) {
  return numberValue(value === undefined ? fallback : value)
}

export function CommercialPolicyFields({
  value,
  onChange,
  title = 'Commercial policy',
  errors = {},
}: {
  value: CommercialPolicyFormValue
  onChange: <K extends keyof CommercialPolicyFormValue>(
    key: K,
    value: CommercialPolicyFormValue[K],
  ) => void
  title?: string
  errors?: Partial<Record<keyof CommercialPolicyFormValue, string | undefined>>
}) {
  const setNumber = (
    key: keyof CommercialPolicyFormValue,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const raw = event.target.value
    onChange(key, raw === '' ? null : Number(raw))
  }

  return (
    <section className="commercial-form-section specialized-commercial-policy">
      <div className="commercial-form-section-heading">
        <div>
          <h3>{title}</h3>
          <p>Set the ways this asset may be held and paid for.</p>
        </div>
      </div>

      <div className="specialized-policy-basics">
        <div className="specialized-policy-basics-copy">
          <span>CLAIM PROTECTION</span>
          <strong>Staff preparation window</strong>
          <small>
            Keep this asset temporarily protected while staff prepares a quote or invoice.
          </small>
        </div>
        <label
          className={`commercial-field specialized-policy-basics-field${errors.requestClaimHoldHours ? 'commercial-field--invalid' : ''}`}
        >
          <span>Request claim hold</span>
          <div className="specialized-policy-input-with-suffix">
            <input
              type="number"
              min={1}
              value={numberValueWithDefault(value.requestClaimHoldHours, 48)}
              onChange={(event) => setNumber('requestClaimHoldHours', event)}
              aria-invalid={Boolean(errors.requestClaimHoldHours)}
            />
            <span>hours</span>
          </div>
          {errors.requestClaimHoldHours ? (
            <small className="commercial-field-error">{errors.requestClaimHoldHours}</small>
          ) : null}
        </label>
      </div>

      <div className="specialized-policy-options">
        <article className={`commercial-policy-card${value.allowReservation ? 'is-enabled' : ''}`}>
          <label className="commercial-policy-card-header specialized-policy-card-header">
            <input
              type="checkbox"
              className="commercial-policy-checkbox"
              checked={Boolean(value.allowReservation)}
              onChange={(event) => onChange('allowReservation', event.target.checked)}
            />
            <span className="commercial-policy-card-copy">
              <b>Reservation</b>
              <small>Accept a deposit and hold the asset for a defined period.</small>
            </span>
            <span className="specialized-policy-state">
              {value.allowReservation ? 'Enabled' : 'Off'}
            </span>
          </label>
          {value.allowReservation ? (
            <div className="commercial-policy-card-body">
              <div className="specialized-policy-fields">
                <label
                  className={`commercial-field${errors.reservationPercent ? 'commercial-field--invalid' : ''}`}
                >
                  <span>Deposit percentage</span>
                  <div className="specialized-policy-input-with-suffix">
                    <input
                      type="number"
                      min={0.01}
                      max={100}
                      step="0.01"
                      value={numberValue(value.reservationPercent)}
                      onChange={(event) => setNumber('reservationPercent', event)}
                      aria-invalid={Boolean(errors.reservationPercent)}
                    />
                    <span>%</span>
                  </div>
                  {errors.reservationPercent ? (
                    <small className="commercial-field-error">{errors.reservationPercent}</small>
                  ) : null}
                </label>
                <label
                  className={`commercial-field${errors.reservationDurationHours ? 'commercial-field--invalid' : ''}`}
                >
                  <span>Reservation duration</span>
                  <div className="specialized-policy-input-with-suffix">
                    <input
                      type="number"
                      min={1}
                      value={numberValue(value.reservationDurationHours)}
                      onChange={(event) => setNumber('reservationDurationHours', event)}
                      aria-invalid={Boolean(errors.reservationDurationHours)}
                    />
                    <span>hours</span>
                  </div>
                  {errors.reservationDurationHours ? (
                    <small className="commercial-field-error">
                      {errors.reservationDurationHours}
                    </small>
                  ) : null}
                </label>
              </div>
              <label className="commercial-policy-option specialized-policy-option">
                <input
                  type="checkbox"
                  className="commercial-policy-checkbox"
                  checked={value.reservationRefundable !== false}
                  onChange={(event) => onChange('reservationRefundable', event.target.checked)}
                />
                <span>Refund the reservation payment if cancelled</span>
              </label>
              {!value.reservationRefundable ? (
                <label
                  className={`commercial-field${errors.reservationRetentionPercent ? 'commercial-field--invalid' : ''}`}
                >
                  <span>Retention percentage on cancellation</span>
                  <div className="specialized-policy-input-with-suffix">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={numberValueWithDefault(value.reservationRetentionPercent, 0)}
                      onChange={(event) => setNumber('reservationRetentionPercent', event)}
                      aria-invalid={Boolean(errors.reservationRetentionPercent)}
                    />
                    <span>%</span>
                  </div>
                  {errors.reservationRetentionPercent ? (
                    <small className="commercial-field-error">
                      {errors.reservationRetentionPercent}
                    </small>
                  ) : null}
                </label>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className={`commercial-policy-card${value.allowInstallment ? 'is-enabled' : ''}`}>
          <label className="commercial-policy-card-header specialized-policy-card-header">
            <input
              type="checkbox"
              className="commercial-policy-checkbox"
              checked={Boolean(value.allowInstallment)}
              onChange={(event) => onChange('allowInstallment', event.target.checked)}
            />
            <span className="commercial-policy-card-copy">
              <b>Installment plan</b>
              <small>Collect a down payment and manage the balance over time.</small>
            </span>
            <span className="specialized-policy-state">
              {value.allowInstallment ? 'Enabled' : 'Off'}
            </span>
          </label>
          {value.allowInstallment ? (
            <div className="commercial-policy-card-body">
              <div className="specialized-policy-fields specialized-policy-fields--three">
                <label
                  className={`commercial-field${errors.installmentDownPaymentPercent ? 'commercial-field--invalid' : ''}`}
                >
                  <span>Down payment</span>
                  <div className="specialized-policy-input-with-suffix">
                    <input
                      type="number"
                      min={0.01}
                      max={100}
                      step="0.01"
                      value={numberValue(value.installmentDownPaymentPercent)}
                      onChange={(event) => setNumber('installmentDownPaymentPercent', event)}
                      aria-invalid={Boolean(errors.installmentDownPaymentPercent)}
                    />
                    <span>%</span>
                  </div>
                  {errors.installmentDownPaymentPercent ? (
                    <small className="commercial-field-error">
                      {errors.installmentDownPaymentPercent}
                    </small>
                  ) : null}
                </label>
                <label
                  className={`commercial-field${errors.installmentMonths ? 'commercial-field--invalid' : ''}`}
                >
                  <span>Payment term</span>
                  <div className="specialized-policy-input-with-suffix">
                    <input
                      type="number"
                      min={1}
                      value={numberValue(value.installmentMonths)}
                      onChange={(event) => setNumber('installmentMonths', event)}
                      aria-invalid={Boolean(errors.installmentMonths)}
                    />
                    <span>months</span>
                  </div>
                  {errors.installmentMonths ? (
                    <small className="commercial-field-error">{errors.installmentMonths}</small>
                  ) : null}
                </label>
                <label
                  className={`commercial-field${errors.installmentGracePeriodDays ? 'commercial-field--invalid' : ''}`}
                >
                  <span>Grace period</span>
                  <div className="specialized-policy-input-with-suffix">
                    <input
                      type="number"
                      min={0}
                      value={numberValueWithDefault(value.installmentGracePeriodDays, 7)}
                      onChange={(event) => setNumber('installmentGracePeriodDays', event)}
                      aria-invalid={Boolean(errors.installmentGracePeriodDays)}
                    />
                    <span>days</span>
                  </div>
                  {errors.installmentGracePeriodDays ? (
                    <small className="commercial-field-error">
                      {errors.installmentGracePeriodDays}
                    </small>
                  ) : null}
                </label>
              </div>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  )
}
