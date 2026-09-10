import { IconPlus, IconTrash } from '@tabler/icons-react'

import { formatCurrency } from '@/shared/lib/formatters'
import {
  formatGroupedNumberFieldValue,
  formatNumberFieldValue,
  parseGroupedNumberFieldValue,
  parseNumberFieldValue,
} from '@/shared/lib/number-input'
import { DropdownSelect } from '@/shared/ui/dropdown-select'

import {
  ensureSinglePrimary,
  quotationPaymentTimingLabels,
} from '../quotation/quotation-item.utils'
import type { QuotationItem, QuotationPaymentTiming } from '../quotation/quotation.types'

const paymentTimingOptions = (
  Object.entries(quotationPaymentTimingLabels) as [QuotationPaymentTiming, string][]
).map(([value, label]) => ({ value, label }))

function normalizeItem(item: QuotationItem): QuotationItem {
  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unitPrice) || 0
  const kind = item.kind === 'primary' ? 'primary' : 'additional_charge'
  const paymentTiming: QuotationPaymentTiming =
    kind === 'primary' ? 'deposit_based' : item.paymentTiming || 'upfront'
  return {
    ...item,
    kind,
    kindDisplay: kind === 'primary' ? 'Primary Item' : 'Additional Charge',
    paymentTiming,
    paymentTimingDisplay: quotationPaymentTimingLabels[paymentTiming],
    total: Math.round(quantity * unitPrice * 100) / 100,
  }
}

export function QuotationItemsEditor({
  items,
  error,
  onChange,
  onClearError,
}: {
  items: QuotationItem[]
  error?: string | undefined
  onChange: (items: QuotationItem[]) => void
  onClearError: () => void
}) {
  const commit = (nextItems: QuotationItem[]) => {
    onClearError()
    onChange(ensureSinglePrimary(nextItems))
  }

  const updateItem = (index: number, patch: Partial<QuotationItem>) => {
    commit(
      items.map((item, itemIndex) =>
        itemIndex === index ? normalizeItem({ ...item, ...patch, kind: item.kind }) : item,
      ),
    )
  }

  const addItem = () => {
    commit([
      ...items,
      normalizeItem({
        description: '',
        kind: 'additional_charge',
        kindDisplay: 'Additional Charge',
        paymentTiming: 'upfront',
        paymentTimingDisplay: quotationPaymentTimingLabels.upfront,
        quantity: 1,
        unitPrice: 0,
        total: 0,
        sourceContext: {},
        sortOrder: items.length * 10,
      }),
    ])
  }

  const removeItem = (index: number) => {
    if (items[index]?.kind === 'primary') return
    commit(items.filter((_item, itemIndex) => itemIndex !== index))
  }

  return (
    <div className="commercial-line-editor" data-invalid={Boolean(error)}>
      <div className="commercial-line-editor-toolbar">
        <button type="button" className="commercial-btn commercial-btn-sm" onClick={addItem}>
          <IconPlus size={14} />
          Add charge
        </button>
      </div>

      <div className="commercial-line-editor-table commercial-line-editor-table--sheet">
        <div className="commercial-line-editor-row commercial-line-editor-row--head">
          <span>Description</span>
          <span>Payment</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span>Total</span>
          <span />
        </div>
        {items.map((item, index) => {
          const isPrimary = item.kind === 'primary'
          return (
            <div className="commercial-line-editor-row" key={`${item.id ?? 'new'}-${index}`}>
              <input
                value={item.description}
                placeholder={isPrimary ? 'Service / item' : 'Additional charge'}
                onChange={(event) => updateItem(index, { description: event.target.value })}
              />
              {isPrimary ? (
                <span className="commercial-line-editor-cell">Deposit based</span>
              ) : (
                <DropdownSelect
                  compact
                  options={paymentTimingOptions}
                  value={item.paymentTiming}
                  placeholder="Payment"
                  fieldClassName="commercial-line-editor-dropdown"
                  onChange={(value) =>
                    updateItem(index, {
                      paymentTiming: value as QuotationPaymentTiming,
                    })
                  }
                />
              )}
              <input
                className="commercial-line-editor-num"
                type="number"
                min="0.01"
                step="0.01"
                value={formatNumberFieldValue(item.quantity)}
                onChange={(event) =>
                  updateItem(index, { quantity: parseNumberFieldValue(event.target.value) })
                }
              />
              <input
                className="commercial-line-editor-num"
                type="text"
                inputMode="decimal"
                value={formatGroupedNumberFieldValue(item.unitPrice)}
                onChange={(event) =>
                  updateItem(index, {
                    unitPrice: parseGroupedNumberFieldValue(event.target.value),
                  })
                }
              />
              <b className="commercial-line-editor-total">{formatCurrency(item.total)}</b>
              <div className="commercial-line-editor-actions">
                <button
                  type="button"
                  className="commercial-icon-button"
                  disabled={isPrimary}
                  onClick={() => removeItem(index)}
                  aria-label="Remove item"
                  title={isPrimary ? 'Primary item cannot be removed' : 'Remove charge'}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {error ? <small className="commercial-field-error">{error}</small> : null}
    </div>
  )
}
