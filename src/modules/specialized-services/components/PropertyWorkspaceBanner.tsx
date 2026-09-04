import { IconBuilding, IconHome, IconMap2 } from '@tabler/icons-react'

import { formatCurrency } from '@/shared/lib/formatters'

import type { PropertyType } from '../real-estate/real-estate.types'

function propertyTypeIcon(propertyType: PropertyType) {
  if (propertyType === 'plot') return <IconMap2 size={18} />
  if (propertyType === 'residential') return <IconHome size={18} />
  return <IconBuilding size={18} />
}

export function PropertyWorkspaceBanner({
  eyebrow,
  propertyName,
  propertyType,
  typeLabel,
  statusLabel,
  price,
}: {
  eyebrow: string
  propertyName: string
  propertyType: PropertyType
  typeLabel: string
  statusLabel: string
  price: number
}) {
  return (
    <div className="specialized-property-context-banner">
      <div className="specialized-property-context-banner-icon">
        {propertyTypeIcon(propertyType)}
      </div>
      <div className="specialized-property-context-banner-main">
        <span className="specialized-property-context-banner-eyebrow">{eyebrow}</span>
        <strong>{propertyName}</strong>
        <span>
          {typeLabel} · {statusLabel}
        </span>
      </div>
      <div className="specialized-property-context-banner-meta">
        <span>List price</span>
        <strong>{formatCurrency(price)}</strong>
      </div>
    </div>
  )
}
