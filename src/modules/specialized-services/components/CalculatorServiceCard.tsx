import { IconCalculator, IconFilePlus, IconSettings } from '@tabler/icons-react'

import type { ServiceCatalogueItem } from '@/modules/service-administration/types/service-administration.types'

interface CalculatorServiceCardProps {
  service: ServiceCatalogueItem
  selected: boolean
  canCreateRequest: boolean
  onViewDetails: () => void
  onCreateRequest: () => void
}

export function CalculatorServiceCard({
  service,
  selected,
  canCreateRequest,
  onViewDetails,
  onCreateRequest,
}: CalculatorServiceCardProps) {
  const calculatorName = service.calculatorName || service.activeCalculator?.name || 'Attached'
  const requestFormName = service.requestFormName || service.activeRequestForm?.name

  return (
    <article
      className={
        selected ? 'specialized-calculator-card is-selected' : 'specialized-calculator-card'
      }
    >
      <div className="specialized-calculator-card-header">
        <span className="specialized-calculator-card-icon" aria-hidden="true">
          <IconCalculator size={18} stroke={1.8} />
        </span>
        <div className="specialized-calculator-card-identity">
          <span className="specialized-calculator-card-label">Calculator service</span>
          <h3>{service.name}</h3>
          <small>{service.code || 'No service code'}</small>
        </div>
        <span className="specialized-calculator-card-readiness">{service.readiness}% ready</span>
      </div>

      <p className="specialized-calculator-card-description">
        {service.description || 'No service description configured.'}
      </p>

      <div
        className="specialized-calculator-card-progress"
        aria-label={`${service.readiness}% ready`}
      >
        <span style={{ width: `${Math.min(Math.max(service.readiness, 0), 100)}%` }} />
      </div>

      <dl className="specialized-calculator-card-facts">
        <div>
          <dt>Calculator</dt>
          <dd>{calculatorName}</dd>
        </div>
        <div>
          <dt>Request form</dt>
          <dd>{requestFormName || 'Not configured'}</dd>
        </div>
        <div>
          <dt>Service level</dt>
          <dd>{service.slaDays ?? 0} days</dd>
        </div>
        <div>
          <dt>Branches</dt>
          <dd>{service.branchNames.length}</dd>
        </div>
      </dl>

      <div className="specialized-calculator-card-actions">
        <button
          type="button"
          className="specialized-btn specialized-btn-small"
          onClick={onViewDetails}
        >
          <IconSettings size={13} />
          View details
        </button>
        <button
          type="button"
          className="specialized-btn specialized-btn-small specialized-btn-primary"
          disabled={!canCreateRequest}
          onClick={onCreateRequest}
        >
          <IconFilePlus size={13} />
          Create Request
        </button>
      </div>
    </article>
  )
}
