import type { ReactNode } from 'react'

import type { ClientOption, ServiceOption } from '@/modules/commercial/api/service-requests.types'

export interface SpecializedRequestFormValues {
  contactName: string
  contactPhone: string
  contactEmail: string
  customerType: string
  source: string
  sourceReference: string
  priority: string
  branchId: number
  crmLeadId: number | null
}

export interface SpecializedRequestHandoff {
  domain: string
  serviceId: number
  clientId?: number
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  branchId?: number | null
  crmLeadId?: number | null
  context: Record<string, unknown>
  navigation: {
    section: string
    search: Record<string, string | undefined>
  }
}

export interface SpecializedRequestContextFieldsProps<TContext> {
  value: TContext
  onChange: (next: TContext) => void
  service: ServiceOption
  error?: string
}

export interface SpecializedRequestPlugin<TContext = unknown> {
  domain: string
  label: string
  matchesService: (service: ServiceOption) => boolean
  skipIntakeForm: boolean
  flowTitle: string
  flowDescription: string
  sectionTitle: string
  sectionDescription: string
  submitLabel: string
  initialContext: () => TContext
  validateContext: (context: TContext) => string | null
  buildHandoff: (input: {
    service: ServiceOption
    context: TContext
    client: ClientOption | null
    formValues: SpecializedRequestFormValues
  }) => SpecializedRequestHandoff
  ContextFields: (props: SpecializedRequestContextFieldsProps<TContext>) => ReactNode
}
