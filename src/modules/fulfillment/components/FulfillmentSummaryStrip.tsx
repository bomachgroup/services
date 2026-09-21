import type { ReactNode } from 'react'

type FulfillmentSummaryTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red'

export interface FulfillmentSummaryItem {
  label: string
  value: ReactNode
  note: string
  tone?: FulfillmentSummaryTone
}

export function FulfillmentSummaryStrip({
  items,
  label = 'Fulfillment summary',
}: {
  items: FulfillmentSummaryItem[]
  label?: string
}) {
  return (
    <section className="fulfillment-summary-strip" aria-label={label}>
      {items.map((item) => (
        <article
          className={`fulfillment-summary-item fulfillment-summary-item--${item.tone ?? 'neutral'}`}
          key={item.label}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.note}</small>
        </article>
      ))}
    </section>
  )
}
