import { IconPlus, IconTrash } from '@tabler/icons-react'

import { DropdownSelect } from '@/shared/ui/dropdown-select'
import { GroupedNumberInput } from '@/shared/ui/grouped-number-input'

import { feePaymentTimings, type AdditionalFee } from './real-estate.types'

export function AdditionalFeesEditor({
  title = 'Additional fees',
  value,
  onChange,
}: {
  title?: string
  value: AdditionalFee[]
  onChange: (value: AdditionalFee[]) => void
}) {
  const update = (index: number, patch: Partial<AdditionalFee>) => {
    onChange(value.map((fee, feeIndex) => (feeIndex === index ? { ...fee, ...patch } : fee)))
  }

  return (
    <section className="commercial-form-section specialized-inline-editor">
      <div className="commercial-form-section-heading">
        <div>
          <h3>{title}</h3>
          <p>Define named fees that belong to this record.</p>
        </div>
        <button
          type="button"
          className="commercial-btn"
          onClick={() =>
            onChange([...value, { name: '', amount: 0, paymentTiming: 'upfront', active: true }])
          }
        >
          <IconPlus size={15} /> Add fee
        </button>
      </div>
      <div className="specialized-fee-editor">
        {value.length ? (
          value.map((fee, index) => (
            <div className="specialized-fee-row" key={fee.id ?? index}>
              <label className="commercial-field">
                <span>Fee name</span>
                <input
                  value={fee.name}
                  placeholder="Legal fee"
                  onChange={(event) => update(index, { name: event.target.value })}
                />
              </label>
              <label className="commercial-field">
                <span>Amount</span>
                <GroupedNumberInput
                  value={fee.amount}
                  onChange={(amount) => update(index, { amount })}
                />
              </label>
              <DropdownSelect
                label="Timing"
                fullWidth={false}
                fieldClassName="commercial-field specialized-fee-timing-field"
                options={feePaymentTimings.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                value={fee.paymentTiming}
                onChange={(nextValue) =>
                  update(index, {
                    paymentTiming: nextValue as AdditionalFee['paymentTiming'],
                  })
                }
              />
              <label className="specialized-fee-toggle">
                <input
                  type="checkbox"
                  checked={fee.active}
                  onChange={(event) => update(index, { active: event.target.checked })}
                />
                <span>Active</span>
              </label>
              <button
                type="button"
                className="commercial-icon-btn specialized-fee-remove"
                aria-label="Remove fee"
                onClick={() => onChange(value.filter((_, feeIndex) => feeIndex !== index))}
              >
                <IconTrash size={15} />
              </button>
            </div>
          ))
        ) : (
          <div className="commercial-empty">No additional fees added.</div>
        )}
      </div>
    </section>
  )
}
