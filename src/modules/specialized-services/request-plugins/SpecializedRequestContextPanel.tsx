import type { ServiceOption } from '@/modules/commercial/api/service-requests.types'

import type { SpecializedRequestPlugin } from './types'

export function SpecializedRequestContextPanel({
  plugin,
  service,
  value,
  error,
  onChange,
}: {
  plugin: SpecializedRequestPlugin
  service: ServiceOption
  value: unknown
  error?: string
  onChange: (next: unknown) => void
}) {
  const ContextFields = plugin.ContextFields

  return (
    <section className="commercial-form-section">
      <div className="commercial-form-section-heading">
        <div>
          <h3>{plugin.sectionTitle}</h3>
          <p>{plugin.sectionDescription}</p>
        </div>
      </div>
      <div className="commercial-form-grid">
        <ContextFields
          service={service}
          value={value}
          onChange={(next) => onChange(next)}
          {...(error ? { error } : {})}
        />
      </div>
    </section>
  )
}
