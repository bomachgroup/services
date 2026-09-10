import { IconBuilding, IconHome, IconMap2 } from '@tabler/icons-react'

import type { PropertyType } from '../real-estate/real-estate.types'

const propertyTypeOptions = [
  {
    value: 'plot' as const,
    label: 'Plot of Land',
    description: 'Land plots with number, size, price and inventory status.',
    Icon: IconMap2,
  },
  {
    value: 'residential' as const,
    label: 'Residential Building',
    description: 'Houses, villas, apartments, duplexes, bungalows and related units.',
    Icon: IconHome,
  },
  {
    value: 'commercial' as const,
    label: 'Commercial Building',
    description: 'Offices, retail spaces, warehouses, hotels, malls and mixed-use assets.',
    Icon: IconBuilding,
  },
]

export function PropertyTypePicker({
  value,
  onChange,
  title = 'Property type',
  description = 'Choose the asset class for this inventory record.',
}: {
  value: PropertyType
  onChange: (value: PropertyType) => void
  title?: string
  description?: string
}) {
  return (
    <section className="commercial-form-section">
      <div className="commercial-form-section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <section className="specialized-property-type-picker">
        {propertyTypeOptions.map(({ value: optionValue, label, description: optionDescription, Icon }) => (
          <button
            key={optionValue}
            type="button"
            className={
              value === optionValue
                ? 'specialized-property-type-option is-active'
                : 'specialized-property-type-option'
            }
            onClick={() => onChange(optionValue)}
          >
            <span className="specialized-property-type-icon">
              <Icon size={20} />
            </span>
            <span>
              <b>{label}</b>
              <small>{optionDescription}</small>
            </span>
          </button>
        ))}
      </section>
    </section>
  )
}
