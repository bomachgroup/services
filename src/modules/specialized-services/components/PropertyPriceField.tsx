import { formatCurrency } from '@/shared/lib/formatters'
import { GroupedNumberInput } from '@/shared/ui/grouped-number-input'

import type { PricingMode } from '../real-estate/real-estate.types'

export function PropertyPriceField({
  hasEstate,
  pricingMode,
  price,
  computedEstatePrice,
  estateRatePerSqm,
  areaSqm,
  disabled = false,
  onPricingModeChange,
  onPriceChange,
}: {
  hasEstate: boolean
  pricingMode: PricingMode
  price: number | null | undefined
  computedEstatePrice: number | null
  estateRatePerSqm: number | null | undefined
  areaSqm: number | null | undefined
  disabled?: boolean
  onPricingModeChange: (mode: PricingMode) => void
  onPriceChange: (price: number | null) => void
}) {
  const isManual = !hasEstate || pricingMode === 'manual_override'
  const displayPrice = isManual ? (price ?? null) : computedEstatePrice
  const rateHint =
    estateRatePerSqm != null && areaSqm
      ? `${areaSqm.toLocaleString()} sqm × ${formatCurrency(estateRatePerSqm)}/sqm`
      : null

  return (
    <div
      className={
        isManual
          ? 'commercial-field specialized-property-price-field'
          : 'commercial-field specialized-property-price-field is-locked'
      }
    >
      <div className="specialized-property-price-heading">
        <span>
          Property price {isManual ? <em>*</em> : null}
        </span>
        {hasEstate ? (
          <label
            className={
              disabled
                ? 'specialized-property-price-toggle is-disabled'
                : 'specialized-property-price-toggle'
            }
          >
            <input
              type="checkbox"
              checked={pricingMode === 'manual_override'}
              disabled={disabled}
              onChange={(event) => {
                const nextMode = event.target.checked ? 'manual_override' : 'estate_rate'
                onPricingModeChange(nextMode)
                if (event.target.checked && (price == null || price <= 0) && computedEstatePrice) {
                  onPriceChange(computedEstatePrice)
                }
              }}
            />
            <span className="specialized-property-price-toggle-ui" aria-hidden="true" />
            <span className="specialized-property-price-toggle-label">Override</span>
          </label>
        ) : null}
      </div>

      <div className="specialized-property-price-control">
        <span className="specialized-property-price-currency" aria-hidden="true">
          ₦
        </span>
        <GroupedNumberInput
          className="specialized-property-price-input"
          value={displayPrice}
          disabled={disabled || !isManual}
          placeholder="0"
          onChange={(nextValue) => onPriceChange(nextValue > 0 ? nextValue : null)}
        />
      </div>

      {hasEstate && !isManual ? (
        <small className="specialized-property-price-hint">
          {rateHint ?? 'Enter size to price from estate rate'}
        </small>
      ) : hasEstate && isManual ? (
        <small className="specialized-property-price-hint">Manual override of the estate rate.</small>
      ) : null}
    </div>
  )
}
