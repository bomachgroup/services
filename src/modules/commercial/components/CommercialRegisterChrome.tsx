import type { ReactNode } from 'react'

interface CommercialSummaryItem {
  label: string
  value: ReactNode
  note?: ReactNode
  valueTitle?: string
  tone?: 'default' | 'positive' | 'warning' | 'danger'
  onClick?: () => void
}

interface CommercialSummaryGridProps {
  ariaLabel: string
  items: readonly CommercialSummaryItem[]
  loading?: boolean
  error?: boolean
  errorNote?: string
  columns?: 4 | 5
}

export function CommercialSummaryGrid({
  ariaLabel,
  items,
  loading = false,
  error = false,
  errorNote,
  columns = 4,
}: CommercialSummaryGridProps) {
  const gridClass = columns === 5 ? 'commercial-kgrid-5' : 'commercial-kgrid-4'

  return (
    <section className={`commercial-kgrid ${gridClass}`} aria-label={ariaLabel}>
      {loading ? (
        <article className="commercial-kpi">
          <div className="commercial-kpi-label">Loading summary...</div>
        </article>
      ) : error ? (
        <article className="commercial-kpi">
          <div className="commercial-kpi-label">Summary unavailable</div>
          {errorNote ? <div className="commercial-kpi-note">{errorNote}</div> : null}
        </article>
      ) : (
        items.map((item) => {
          const className = [
            'commercial-kpi',
            item.tone && item.tone !== 'default' ? `commercial-kpi--${item.tone}` : '',
            item.onClick ? 'commercial-kpi--interactive' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const primitiveValue =
            typeof item.value === 'string' || typeof item.value === 'number'
              ? String(item.value)
              : item.valueTitle
          const content = (
            <>
              <div className="commercial-kpi-label">{item.label}</div>
              <div className="commercial-kpi-value" title={item.valueTitle}>
                {item.value}
              </div>
              {item.note ? <div className="commercial-kpi-note">{item.note}</div> : null}
            </>
          )

          if (item.onClick) {
            return (
              <button
                type="button"
                className={className}
                key={item.label}
                onClick={item.onClick}
                aria-label={primitiveValue ? `${item.label}: ${primitiveValue}` : item.label}
              >
                {content}
              </button>
            )
          }

          return (
            <article className={className} key={item.label}>
              {content}
            </article>
          )
        })
      )}
    </section>
  )
}

interface CommercialRegisterHeaderProps {
  title: string
  description: string
  countLabel: string
  refreshing?: boolean
  action?: ReactNode
}

export function CommercialRegisterHeader({
  title,
  description,
  countLabel,
  refreshing = false,
  action,
}: CommercialRegisterHeaderProps) {
  return (
    <header className="commercial-card-header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="commercial-card-header-actions">
        <span className="commercial-count">{countLabel}</span>
        {refreshing ? <span className="commercial-count">Refreshing…</span> : null}
        {action}
      </div>
    </header>
  )
}
