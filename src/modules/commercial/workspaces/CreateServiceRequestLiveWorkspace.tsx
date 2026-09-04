import {
  IconAlertCircle,
  IconArrowLeft,
  IconCalculator,
  IconChevronDown,
  IconLoader2,
  IconSearch,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/app/auth'
import { hasPermission, PERMISSIONS } from '@/app/permissions'

import { presentError } from '@/shared/errors'
import { ApiError } from '@/shared/api/api-error'
import { formatCurrency } from '@/shared/lib/formatters'
import { parseNumberFieldValue } from '@/shared/lib/number-input'
import { Button } from '@/shared/ui/button'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'
import { EmptyState } from '@/shared/ui/empty-state'
import { useToast } from '@/shared/ui/toast/useToast'

import { serviceRequestsApi } from '../api/service-requests.api'
import { serviceRequestKeys } from '../api/service-requests.keys'
import { serviceRequestQueries } from '../api/service-requests.queries'
import type {
  ClientOption,
  CreateServiceRequestAttachmentInput,
  CreateServiceRequestInput,
  IntakeField,
  ServiceOption,
  ServiceRequestChoices,
} from '../api/service-requests.types'
import type { MarketingLeadOption } from '../api/marketing-leads.types'

import {
  resolveSpecializedRequestPlugin,
  SpecializedRequestContextPanel,
  type SpecializedRequestHandoff,
} from '@/modules/specialized-services/request-plugins'

import { RequestIntakeFields } from '../request-intake/RequestIntakeFields'
import type { PendingUpload } from '../request-intake/request-intake.types'
import {
  calculateEstimateTotal,
  firstScopeValue,
  isBudgetField,
  isPreferredDateField,
  isPriorityValue,
  isScopeField,
  normalizeAnswers,
  nonNegativeNumber,
  resolveAutoAnswer,
  shouldHideAutoField,
  validateAnswerFields,
  validateAnswers,
} from '../request-intake/request-intake.utils'

type NewClientField = 'firstName' | 'lastName' | 'email' | 'phoneNumber'
type ClientDirectoryTab = 'clients' | 'leads'

const OTHERS_PARENT_KEY = '__others__'
const OTHERS_PARENT_LABEL = 'Others'

function serviceParentKey(service: ServiceOption): string {
  return service.parentName.trim() ? service.parentName.trim() : OTHERS_PARENT_KEY
}

function buildParentServiceOptions(services: ServiceOption[]) {
  const parentNames = new Set<string>()
  let hasOthers = false

  for (const service of services) {
    const parentName = service.parentName.trim()
    if (parentName) parentNames.add(parentName)
    else hasOthers = true
  }

  const options = [...parentNames]
    .sort((left, right) => left.localeCompare(right))
    .map((parentName) => ({ key: parentName, label: parentName }))

  if (hasOthers) {
    options.push({ key: OTHERS_PARENT_KEY, label: OTHERS_PARENT_LABEL })
  }

  return options
}

function servicesForParent(services: ServiceOption[], parentKey: string) {
  return services
    .filter((service) => serviceParentKey(service) === parentKey)
    .sort((left, right) => left.name.localeCompare(right.name))
}

const NEW_CLIENT_FIELD_ORDER: NewClientField[] = ['firstName', 'lastName', 'email', 'phoneNumber']

function validateNewClientInput(input: {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
}): Partial<Record<NewClientField, string>> {
  const errors: Partial<Record<NewClientField, string>> = {}

  if (!input.firstName.trim()) errors.firstName = 'First name is required.'
  if (!input.lastName.trim()) errors.lastName = 'Last name is required.'

  if (!input.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (!input.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required.'

  return errors
}

function mapCreateClientApiErrors(error: unknown): {
  fieldErrors: Partial<Record<NewClientField, string>>
  formError: string
} {
  const presented = presentError(error, 'form-submit')
  const fieldErrors: Partial<Record<NewClientField, string>> = {}

  if (presented.fieldErrors) {
    for (const [key, message] of Object.entries(presented.fieldErrors)) {
      if (key === 'first_name' || key === 'firstName') fieldErrors.firstName = message
      if (key === 'last_name' || key === 'lastName') fieldErrors.lastName = message
      if (key === 'email') fieldErrors.email = message
      if (key === 'phone_number' || key === 'phoneNumber') fieldErrors.phoneNumber = message
    }
  }

  let detailMessage = presented.message
  if (error instanceof ApiError && error.details && typeof error.details === 'object') {
    const detail = (error.details as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) detailMessage = detail.trim()
  }

  const lower = detailMessage.toLowerCase()
  if (lower.includes('email') && !fieldErrors.email) fieldErrors.email = detailMessage
  if (lower.includes('phone') && !fieldErrors.phoneNumber) fieldErrors.phoneNumber = detailMessage

  return {
    fieldErrors,
    formError: Object.keys(fieldErrors).length > 0 ? '' : detailMessage,
  }
}

function firstNewClientFieldWithError(
  errors: Partial<Record<NewClientField, string>>,
): NewClientField | null {
  return NEW_CLIENT_FIELD_ORDER.find((field) => errors[field]) ?? null
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: '', lastName: '' }

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }

  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function useDirectoryScrollLoadMore({
  enabled,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  itemCount,
}: {
  enabled: boolean
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  onLoadMore?: () => void
  itemCount: number
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (!enabled || !hasMore || isLoading || isLoadingMore || !onLoadMore) return

    const root = scrollRef.current
    const target = sentinelRef.current
    if (!root || !target) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { root, rootMargin: '48px' },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [enabled, hasMore, isLoading, isLoadingMore, itemCount, onLoadMore])

  return { scrollRef, sentinelRef }
}

function ClientResultsTable({
  loading,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  emptyMessage,
  clients: clientRows,
  selectedClientId = 0,
  onSelect,
  interactive = true,
  compact = false,
}: {
  loading?: boolean
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  emptyMessage?: string
  clients: ClientOption[]
  selectedClientId?: number
  onSelect?: (client: ClientOption) => void
  interactive?: boolean
  compact?: boolean
}) {
  const { scrollRef, sentinelRef } = useDirectoryScrollLoadMore({
    enabled: interactive && Boolean(onLoadMore),
    hasMore,
    isLoading: Boolean(loading),
    isLoadingMore: loadingMore,
    onLoadMore,
    itemCount: clientRows.length,
  })
  const wrapClassName = compact
    ? 'commercial-table-wrap commercial-client-table-wrap commercial-client-table-wrap--compact'
    : 'commercial-table-wrap commercial-client-table-wrap'

  if (loading && clientRows.length === 0) {
    return (
      <div className={wrapClassName}>
        <div className="commercial-client-results-empty">Loading clients...</div>
      </div>
    )
  }

  if (clientRows.length === 0) {
    return (
      <div className={wrapClassName}>
        <div className="commercial-client-results-empty">
          {emptyMessage ?? 'No clients to show.'}
        </div>
      </div>
    )
  }

  return (
    <div className={wrapClassName} ref={scrollRef}>
      <table className="commercial-table commercial-table--fit commercial-client-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Company</th>
          </tr>
        </thead>
        <tbody>
          {clientRows.map((client) => {
            const selected = selectedClientId === client.id
            const rowClassName = selected ? 'commercial-table-row--selected' : undefined

            if (!interactive || !onSelect) {
              return (
                <tr key={client.id} className={rowClassName}>
                  <td>
                    <b>{client.name}</b>
                  </td>
                  <td>{client.phone || '—'}</td>
                  <td>{client.email || '—'}</td>
                  <td>{client.companyName || '—'}</td>
                </tr>
              )
            }

            return (
              <tr
                key={client.id}
                className={rowClassName}
                tabIndex={0}
                role="button"
                aria-selected={selected}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  event.preventDefault()
                  onSelect(client)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onSelect(client)
                }}
              >
                <td>
                  <b>{client.name}</b>
                </td>
                <td>{client.phone || '—'}</td>
                <td>{client.email || '—'}</td>
                <td>{client.companyName || '—'}</td>
              </tr>
            )
          })}
          {hasMore ? (
            <tr ref={sentinelRef} className="commercial-directory-load-row">
              <td colSpan={4}>
                {loadingMore ? (
                  <span className="commercial-directory-load-copy">Loading more clients...</span>
                ) : (
                  <span className="commercial-directory-load-copy commercial-directory-load-copy--hint">
                    Scroll for more
                  </span>
                )}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

function LeadResultsTable({
  loading,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  emptyMessage,
  leads: leadRows,
  selectedLeadId = 0,
  onSelect,
}: {
  loading?: boolean
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  emptyMessage?: string
  leads: MarketingLeadOption[]
  selectedLeadId?: number
  onSelect?: (lead: MarketingLeadOption) => void
}) {
  const { scrollRef, sentinelRef } = useDirectoryScrollLoadMore({
    enabled: Boolean(onSelect),
    hasMore,
    isLoading: Boolean(loading),
    isLoadingMore: loadingMore,
    onLoadMore,
    itemCount: leadRows.length,
  })
  const wrapClassName = 'commercial-table-wrap commercial-client-table-wrap'

  if (loading && leadRows.length === 0) {
    return (
      <div className={wrapClassName}>
        <div className="commercial-client-results-empty">Loading marketing leads...</div>
      </div>
    )
  }

  if (leadRows.length === 0) {
    return (
      <div className={wrapClassName}>
        <div className="commercial-client-results-empty">
          {emptyMessage ?? 'No marketing leads to show.'}
        </div>
      </div>
    )
  }

  return (
    <div className={wrapClassName} ref={scrollRef}>
      <table className="commercial-table commercial-table--fit commercial-client-table commercial-lead-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Status</th>
            <th>Client</th>
          </tr>
        </thead>
        <tbody>
          {leadRows.map((lead) => {
            const selected = selectedLeadId === lead.id
            const rowClassName = selected ? 'commercial-table-row--selected' : undefined

            return (
              <tr
                key={lead.id}
                className={rowClassName}
                tabIndex={0}
                role="button"
                aria-selected={selected}
                onPointerDown={(event) => {
                  if (event.button !== 0 || !onSelect) return
                  event.preventDefault()
                  onSelect(lead)
                }}
                onKeyDown={(event) => {
                  if (!onSelect) return
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onSelect(lead)
                }}
              >
                <td>
                  <b>{lead.fullName}</b>
                </td>
                <td>{lead.phone || '—'}</td>
                <td>{lead.email || '—'}</td>
                <td>{lead.statusDisplay || lead.status || '—'}</td>
                <td>{lead.linkedClientName ?? 'Create client'}</td>
              </tr>
            )
          })}
          {hasMore ? (
            <tr ref={sentinelRef} className="commercial-directory-load-row">
              <td colSpan={5}>
                {loadingMore ? (
                  <span className="commercial-directory-load-copy">Loading more leads...</span>
                ) : (
                  <span className="commercial-directory-load-copy commercial-directory-load-copy--hint">
                    Scroll for more
                  </span>
                )}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

export function CreateServiceRequestLiveWorkspace({
  clients,
  services,
  choices,
  saving,
  initialServiceId = 0,
  onClose,
  onSubmit,
  onContinueSpecialized,
}: {
  clients: ClientOption[]
  services: ServiceOption[]
  choices: ServiceRequestChoices
  saving: boolean
  initialServiceId?: number
  onClose: () => void
  onSubmit: (
    input: CreateServiceRequestInput,
    attachments: CreateServiceRequestAttachmentInput[],
  ) => Promise<unknown> | void
  onContinueSpecialized?: (handoff: SpecializedRequestHandoff) => Promise<unknown> | void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canSearchClients = hasPermission(user, PERMISSIONS.clientsList)
  const canCreateClient = hasPermission(user, PERMISSIONS.clientsCreate)
  const canSearchLeads = hasPermission(user, PERMISSIONS.leadsList)
  const activeClients = clients.filter((item) => item.active)
  const parentServiceOptions = useMemo(() => buildParentServiceOptions(services), [services])
  const [parentServiceKey, setParentServiceKey] = useState('')
  const [serviceId, setServiceId] = useState(0)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showInternalDetails, setShowInternalDetails] = useState(false)
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [pickedClient, setPickedClient] = useState<ClientOption | null>(null)
  const [newClientFieldErrors, setNewClientFieldErrors] = useState<
    Partial<Record<NewClientField, string>>
  >({})
  const [createClientFormError, setCreateClientFormError] = useState('')
  const [clientSearchDraft, setClientSearchDraft] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientDirectoryTab, setClientDirectoryTab] = useState<ClientDirectoryTab>('clients')
  const [leadSearchDraft, setLeadSearchDraft] = useState('')
  const [leadSearch, setLeadSearch] = useState('')
  const [selectedMarketingLead, setSelectedMarketingLead] = useState<MarketingLeadOption | null>(
    null,
  )
  const [newClientFirstName, setNewClientFirstName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [uploadsByField, setUploadsByField] = useState<Record<string, PendingUpload[]>>({})
  const [answerValues, setAnswerValues] = useState<Record<string, unknown>>({})
  const [specializedContextDraft, setSpecializedContextDraft] = useState<unknown | null>(null)
  const [specializedContextError, setSpecializedContextError] = useState('')
  const controllersRef = useRef<Record<string, AbortController>>({})
  const uploadIdRef = useRef(0)
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const newClientFieldRefs = useRef<Partial<Record<NewClientField, HTMLInputElement | null>>>({})
  const pickedClientRef = useRef<ClientOption | null>(null)
  const crmLeadIdRef = useRef<number | null>(null)

  const focusNewClientField = useCallback((field: NewClientField) => {
    window.requestAnimationFrame(() => {
      const node = newClientFieldRefs.current[field]
      node?.focus()
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const clearNewClientFieldError = useCallback((field: NewClientField) => {
    setNewClientFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }, [])

  const selectedService = services.find((item) => item.id === serviceId) ?? null
  const activeSpecializedPlugin = useMemo(
    () => resolveSpecializedRequestPlugin(selectedService),
    [selectedService],
  )
  const usesSpecializedFlow = Boolean(activeSpecializedPlugin?.skipIntakeForm)
  const specializedContext = useMemo(() => {
    if (!activeSpecializedPlugin) return null
    if (specializedContextDraft !== null) return specializedContextDraft
    return activeSpecializedPlugin.initialContext()
  }, [activeSpecializedPlugin, specializedContextDraft])

  const intakeQuery = useQuery({
    ...serviceRequestQueries.intake(serviceId),
    enabled: serviceId > 0 && !usesSpecializedFlow,
  })
  const pricingConfigQuery = useQuery({
    ...serviceRequestQueries.pricingConfig(serviceId),
    enabled: serviceId > 0 && !usesSpecializedFlow,
  })
  const isBrowsingDirectory = !showCreateClient && !pickedClient
  const clientDirectoryQuery = useInfiniteQuery({
    ...serviceRequestQueries.clientDirectory(clientSearch),
    enabled: canSearchClients && isBrowsingDirectory && clientDirectoryTab === 'clients',
  })
  const leadDirectoryQuery = useInfiniteQuery({
    ...serviceRequestQueries.marketingLeadDirectory(leadSearch),
    enabled: canSearchLeads && isBrowsingDirectory && clientDirectoryTab === 'leads',
  })

  useEffect(() => {
    if (clientSearchDraft === clientSearch) return

    const timeoutId = window.setTimeout(() => {
      setClientSearch(clientSearchDraft.trim())
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [clientSearchDraft, clientSearch])

  useEffect(() => {
    if (leadSearchDraft === leadSearch) return

    const timeoutId = window.setTimeout(() => {
      setLeadSearch(leadSearchDraft.trim())
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [leadSearchDraft, leadSearch])

  const childServices = useMemo(
    () => (parentServiceKey ? servicesForParent(services, parentServiceKey) : []),
    [parentServiceKey, services],
  )
  const branches = selectedService?.activeBranches ?? []
  const fields = intakeQuery.data?.form.fields ?? []
  const hasBudgetField = fields.some(isBudgetField)
  const hasPreferredDateField = fields.some(isPreferredDateField)
  const hasScopeSummaryField = fields.some(isScopeField)
  const flattenedUploads = Object.values(uploadsByField).flat()
  const hasUploadingFiles = flattenedUploads.some((upload) => upload.status === 'uploading')
  const hasUploadErrors = flattenedUploads.some((upload) => upload.status === 'error')
  const initialAnswers: Record<string, unknown> = {}
  const activePricingConfig = pricingConfigQuery.data

  const form = useForm({
    defaultValues: {
      clientId: 0,
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      customerType: choices.customerTypes[0]?.value ?? 'individual',
      source:
        choices.sources.find((item) => item.value === 'sales_crm')?.value ??
        choices.sources[0]?.value ??
        'sales_crm',
      sourceReference: '',
      priority: (choices.priorities[0]?.value ?? 'normal') as 'normal' | 'high' | 'critical',
      branchId: 0,
      budget: 0,
      estimatedValue: 0,
      preferredDate: '',
      dueDate: '',
      nextAction: '',
      scopeSummary: '',
      answers: initialAnswers,
    },
    onSubmit: async ({ value }) => {
      if (!value.clientId && !pickedClientRef.current) {
        setError('Select a client.')
        return
      }

      if (!parentServiceKey) {
        setError('Select a parent service.')
        return
      }

      if (!serviceId) {
        setError('Select a service.')
        return
      }

      if (branches.length > 0 && !value.branchId) {
        setError('Select a fulfilling branch.')
        return
      }

      if (activeSpecializedPlugin && usesSpecializedFlow) {
        const contextError = activeSpecializedPlugin.validateContext(specializedContext)
        if (contextError) {
          setSpecializedContextError(contextError)
          setError(contextError)
          return
        }

        if (!onContinueSpecialized || !selectedService) {
          setError('This specialized service flow is not available.')
          return
        }

        setError('')
        setSpecializedContextError('')

        try {
          const handoff = activeSpecializedPlugin.buildHandoff({
            service: selectedService,
            context: specializedContext,
            client: pickedClientRef.current,
            formValues: {
              contactName: value.contactName.trim(),
              contactPhone: value.contactPhone.trim(),
              contactEmail: value.contactEmail.trim(),
              customerType: value.customerType,
              source: value.source,
              sourceReference: value.sourceReference.trim(),
              priority: value.priority,
              branchId: value.branchId,
              crmLeadId: crmLeadIdRef.current,
            },
          })
          await onContinueSpecialized(handoff)
        } catch (continueError) {
          setError(presentError(continueError, 'form-submit').message)
        }
        return
      }

      if (hasUploadingFiles) {
        setError('Wait for document uploads to finish before submitting.')
        return
      }

      if (hasUploadErrors) {
        setError('Remove failed document uploads or upload them again before submitting.')
        return
      }

      const resolvedAnswers = Object.fromEntries(
        fields.map((field) => [
          field.key,
          field.fieldType === 'file'
            ? resolveAutoAnswer(field, {
                contactName: value.contactName.trim(),
                contactPhone: value.contactPhone.trim(),
                contactEmail: value.contactEmail.trim(),
                customerType: value.customerType,
                budget: value.budget,
                preferredDate: value.preferredDate,
                uploads: flattenedUploads,
              })
            : shouldHideAutoField(field, {
                  contactName: value.contactName.trim(),
                  contactPhone: value.contactPhone.trim(),
                  contactEmail: value.contactEmail.trim(),
                  customerType: value.customerType,
                  budget: value.budget,
                  preferredDate: value.preferredDate,
                  uploads: flattenedUploads,
                })
              ? resolveAutoAnswer(field, {
                  contactName: value.contactName.trim(),
                  contactPhone: value.contactPhone.trim(),
                  contactEmail: value.contactEmail.trim(),
                  customerType: value.customerType,
                  budget: value.budget,
                  preferredDate: value.preferredDate,
                  uploads: flattenedUploads,
                })
              : value.answers[field.key],
        ]),
      )

      const answerErrors = validateAnswerFields(fields, resolvedAnswers)
      if (Object.keys(answerErrors).length > 0) {
        setFieldErrors(answerErrors)
        setError('')
        const firstErrorKey = visibleFields.find((field) => answerErrors[field.key])?.key
        if (firstErrorKey) {
          window.requestAnimationFrame(() => {
            const node = fieldRefs.current[firstErrorKey]
            node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            if (
              node instanceof HTMLInputElement ||
              node instanceof HTMLTextAreaElement ||
              node instanceof HTMLSelectElement
            ) {
              node.focus()
            }
          })
        }
        return
      }

      const validationError = validateAnswers(fields, resolvedAnswers)
      if (validationError) {
        setError(validationError)
        return
      }

      const normalizedAnswers = normalizeAnswers(fields, resolvedAnswers)
      const derivedBudget =
        value.budget > 0
          ? value.budget
          : (() => {
              const budgetField = fields.find(isBudgetField)
              if (!budgetField) return 0
              const rawBudget = normalizedAnswers[budgetField.key]
              return parseNumberFieldValue(
                typeof rawBudget === 'string' || typeof rawBudget === 'number'
                  ? String(rawBudget)
                  : '',
              )
            })()
      const derivedScopeSummary =
        value.scopeSummary.trim() || firstScopeValue(fields, normalizedAnswers) || ''
      const attachments = flattenedUploads
        .filter((upload) => upload.status === 'uploaded')
        .map((upload) => ({
          fieldKey: upload.fieldKey,
          label: upload.label,
          fileName: upload.fileName,
          fileUrl: upload.fileUrl,
          contentType: upload.contentType,
          fileSizeBytes: upload.fileSizeBytes,
        }))

      setError('')
      setFieldErrors({})

      try {
        await onSubmit(
          {
            clientId: value.clientId || pickedClientRef.current?.id || 0,
            serviceId,
            ...(value.branchId ? { branchId: value.branchId } : {}),
            contactName: value.contactName.trim(),
            contactPhone: value.contactPhone.trim(),
            contactEmail: value.contactEmail.trim(),
            customerType: value.customerType,
            source: value.source,
            sourceReference: value.sourceReference.trim(),
            priority: value.priority,
            ...(derivedBudget > 0 ? { budget: derivedBudget } : {}),
            estimatedValue: Number(value.estimatedValue || derivedBudget || 0),
            ...(value.preferredDate ? { preferredDate: value.preferredDate } : {}),
            ...(value.dueDate ? { dueDate: value.dueDate } : {}),
            nextAction: value.nextAction.trim(),
            scopeSummary: derivedScopeSummary,
            answers: normalizedAnswers,
            ...(crmLeadIdRef.current ? { crmLeadId: crmLeadIdRef.current } : {}),
          },
          attachments,
        )
      } catch (submitError) {
        setError(presentError(submitError, 'form-submit').message)
      }
    },
  })

  useEffect(() => {
    if (!serviceId) return
    const service = services.find((item) => item.id === serviceId)
    if (!service) return
    const nextParentKey = serviceParentKey(service)
    setParentServiceKey((current) => (current === nextParentKey ? current : nextParentKey))
  }, [serviceId, services])

  useEffect(() => {
    if (!initialServiceId || initialServiceId <= 0 || services.length === 0) return
    const service = services.find((item) => item.id === initialServiceId)
    if (!service || serviceId === service.id) return
    setParentServiceKey(serviceParentKey(service))
    setServiceId(service.id)
    form.setFieldValue('branchId', service.activeBranches[0]?.id ?? 0)
  }, [form, initialServiceId, serviceId, services])

  useEffect(() => {
    setSpecializedContextDraft(null)
    setSpecializedContextError('')
  }, [serviceId, activeSpecializedPlugin?.domain])

  const updateUploadsForField = (
    fieldKey: string,
    updater: (current: PendingUpload[]) => PendingUpload[],
  ) => {
    setUploadsByField((current) => ({
      ...current,
      [fieldKey]: updater(current[fieldKey] ?? []),
    }))
  }

  const clearUploads = () => {
    Object.values(controllersRef.current).forEach((controller) => controller.abort())
    controllersRef.current = {}
    setUploadsByField({})
  }

  const chooseClient = useCallback(
    (client: ClientOption) => {
      pickedClientRef.current = client
      setPickedClient(client)
      setShowCreateClient(false)
      setCreateClientFormError('')
      setNewClientFieldErrors({})
      form.setFieldValue('clientId', client.id)
      form.setFieldValue('contactName', client.name)
      form.setFieldValue('contactPhone', client.phone ?? '')
      form.setFieldValue('contactEmail', client.email ?? '')
      setError('')
    },
    [form],
  )

  const openCreateClientFromLead = useCallback(
    (lead: MarketingLeadOption) => {
      const { firstName, lastName } = splitFullName(lead.fullName)
      pickedClientRef.current = null
      setPickedClient(null)
      setSelectedMarketingLead(lead)
      crmLeadIdRef.current = lead.id
      form.setFieldValue('clientId', 0)
      form.setFieldValue('contactName', lead.fullName)
      form.setFieldValue('contactPhone', lead.phone ?? '')
      form.setFieldValue('contactEmail', lead.email ?? '')
      form.setFieldValue('sourceReference', `LEAD-${lead.id}`)
      setNewClientFirstName(firstName)
      setNewClientLastName(lastName)
      setNewClientEmail(lead.email)
      setNewClientPhone(lead.phone)
      setShowCreateClient(true)
      setCreateClientFormError('')
      setNewClientFieldErrors({})
      setClientSearchDraft('')
      setClientSearch('')
      setLeadSearchDraft('')
      setLeadSearch('')
      setError('')
    },
    [form],
  )

  const chooseLead = useCallback(
    (lead: MarketingLeadOption) => {
      setSelectedMarketingLead(lead)
      crmLeadIdRef.current = lead.id
      form.setFieldValue('sourceReference', `LEAD-${lead.id}`)

      if (lead.linkedClientId) {
        chooseClient({
          id: lead.linkedClientId,
          name: lead.linkedClientName || lead.fullName,
          email: lead.email,
          phone: lead.phone,
          companyName: '',
          active: true,
        })
        return
      }

      openCreateClientFromLead(lead)
    },
    [chooseClient, form, openCreateClientFromLead],
  )

  const clearClientSelection = useCallback(() => {
    pickedClientRef.current = null
    setPickedClient(null)
    setSelectedMarketingLead(null)
    crmLeadIdRef.current = null
    form.setFieldValue('clientId', 0)
    form.setFieldValue('contactName', '')
    form.setFieldValue('contactPhone', '')
    form.setFieldValue('contactEmail', '')
    setError('')
  }, [form])

  const openCreateClient = useCallback(() => {
    clearClientSelection()
    setShowCreateClient(true)
    setCreateClientFormError('')
    setNewClientFieldErrors({})
    setClientSearchDraft('')
    setClientSearch('')
    setLeadSearchDraft('')
    setLeadSearch('')
  }, [clearClientSelection])

  const closeCreateClient = useCallback(() => {
    setShowCreateClient(false)
    setCreateClientFormError('')
    setNewClientFieldErrors({})
  }, [setCreateClientFormError, setNewClientFieldErrors, setShowCreateClient])

  const chooseClientById = (clientId: number) => {
    const client = clients.find((item) => item.id === clientId)
    if (client) chooseClient(client)
  }

  const submitNewClient = () => {
    const validationErrors = validateNewClientInput({
      firstName: newClientFirstName,
      lastName: newClientLastName,
      email: newClientEmail,
      phoneNumber: newClientPhone,
    })

    if (Object.keys(validationErrors).length > 0) {
      setNewClientFieldErrors(validationErrors)
      setCreateClientFormError('')
      const firstInvalidField = firstNewClientFieldWithError(validationErrors)
      if (firstInvalidField) focusNewClientField(firstInvalidField)
      return
    }

    setNewClientFieldErrors({})
    setCreateClientFormError('')

    createClientMutation.mutate({
      firstName: newClientFirstName.trim(),
      lastName: newClientLastName.trim(),
      email: newClientEmail.trim(),
      phoneNumber: newClientPhone.trim(),
    })
  }

  const createClientMutation = useMutation({
    mutationFn: (input: {
      firstName: string
      lastName: string
      email: string
      phoneNumber: string
    }) =>
      serviceRequestsApi.createClient({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phoneNumber: input.phoneNumber,
      }),
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: serviceRequestKeys.clients() })
      pickedClientRef.current = client
      setPickedClient(client)
      form.setFieldValue('clientId', client.id)
      form.setFieldValue('contactName', client.name)
      form.setFieldValue('contactPhone', client.phone ?? '')
      form.setFieldValue('contactEmail', client.email ?? '')
      setShowCreateClient(false)
      setNewClientFirstName('')
      setNewClientLastName('')
      setNewClientEmail('')
      setNewClientPhone('')
      setNewClientFieldErrors({})
      setCreateClientFormError('')
      setError('')
      toast.success('Client created', {
        description: 'An invitation email with password setup instructions was sent.',
      })
    },
    onError: (createError) => {
      const { fieldErrors, formError } = mapCreateClientApiErrors(createError)
      if (Object.keys(fieldErrors).length > 0) {
        setNewClientFieldErrors(fieldErrors)
        setCreateClientFormError('')
        const firstInvalidField = firstNewClientFieldWithError(fieldErrors)
        if (firstInvalidField) focusNewClientField(firstInvalidField)
        return
      }

      setCreateClientFormError(formError)
      toast.error('Client could not be created', { description: formError })
    },
  })

  const chooseParentService = (nextParentKey: string) => {
    clearUploads()
    setParentServiceKey(nextParentKey)
    setServiceId(0)
    form.setFieldValue('branchId', 0)
    form.setFieldValue('estimatedValue', 0)
    form.setFieldValue('answers', {})
    setAnswerValues({})
    setFieldErrors({})
    setSpecializedContextDraft(null)
    setSpecializedContextError('')
    setError('')
  }

  const chooseService = (nextServiceId: number) => {
    const service = services.find((item) => item.id === nextServiceId)
    clearUploads()
    setServiceId(nextServiceId)
    form.setFieldValue('branchId', service?.activeBranches[0]?.id ?? 0)
    form.setFieldValue('estimatedValue', 0)
    form.setFieldValue('answers', {})
    setAnswerValues({})
    setFieldErrors({})
    setSpecializedContextDraft(null)
    setSpecializedContextError('')
    setError('')
  }

  const removeUpload = (fieldKey: string, uploadId: string) => {
    const controller = controllersRef.current[uploadId]
    if (controller) {
      controller.abort()
      delete controllersRef.current[uploadId]
    }
    updateUploadsForField(fieldKey, (current) => current.filter((upload) => upload.id !== uploadId))
  }

  const uploadFile = async (field: IntakeField, file: File, uploadId?: string) => {
    const nextUploadId = uploadId ?? `${field.key}-${++uploadIdRef.current}`
    const controller = new AbortController()
    controllersRef.current[nextUploadId] = controller

    updateUploadsForField(field.key, (current) => {
      const nextItem: PendingUpload = {
        id: nextUploadId,
        fieldKey: field.key,
        label: field.label,
        file,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type,
        fileUrl: '',
        status: 'uploading',
        error: '',
      }

      if (uploadId) {
        return current.map((upload) => (upload.id === nextUploadId ? nextItem : upload))
      }

      return [...current, nextItem]
    })

    try {
      const fileUrl = await serviceRequestsApi.uploadFile(file, controller.signal)
      updateUploadsForField(field.key, (current) =>
        current.map((upload) =>
          upload.id === nextUploadId
            ? {
                ...upload,
                fileUrl,
                status: 'uploaded',
              }
            : upload,
        ),
      )
    } catch (uploadError) {
      if (!controller.signal.aborted) {
        const message = presentError(uploadError, 'background-action').message
        updateUploadsForField(field.key, (current) =>
          current.map((upload) =>
            upload.id === nextUploadId
              ? {
                  ...upload,
                  status: 'error',
                  error: message,
                }
              : upload,
          ),
        )
        toast.error('Document upload failed', { description: message })
      }
    } finally {
      delete controllersRef.current[nextUploadId]
    }
  }

  const retryUpload = (upload: PendingUpload) => {
    void uploadFile(
      {
        id: 0,
        key: upload.fieldKey,
        label: upload.label,
        fieldType: 'file',
        required: false,
        options: [],
        validation: {},
        helpText: '',
        placeholder: '',
        sortOrder: 0,
      },
      upload.file,
      upload.id,
    )
  }

  const handleFileSelection = async (field: IntakeField, files: FileList | null) => {
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      await uploadFile(field, file)
    }
  }

  const setAnswerValue = (fieldKey: string, next: unknown) => {
    const nextAnswers = {
      ...answerValues,
      [fieldKey]: next,
    }
    setAnswerValues(nextAnswers)
    form.setFieldValue('answers', {
      ...nextAnswers,
    })
    setFieldErrors((current) => {
      if (!current[fieldKey]) return current
      const nextErrors = { ...current }
      delete nextErrors[fieldKey]
      return nextErrors
    })
  }

  const ready = services.length > 0
  const selectedClient = pickedClient
  const clientPickerMode = showCreateClient ? 'create' : pickedClient ? 'selected' : 'browse'
  const browseClients = useMemo(() => {
    if (!canSearchClients) return activeClients
    return (clientDirectoryQuery.data?.pages.flatMap((page) => page.items) ?? []).filter(
      (item) => item.active,
    )
  }, [activeClients, canSearchClients, clientDirectoryQuery.data])
  const browseLeads = useMemo(
    () => leadDirectoryQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [leadDirectoryQuery.data],
  )
  const isFilteringClients = clientSearch.trim().length > 0
  const isFilteringLeads = leadSearch.trim().length > 0
  const browseEmptyMessage =
    clientDirectoryTab === 'leads'
      ? isFilteringLeads
        ? 'No marketing leads match that search.'
        : 'No marketing leads found.'
      : canSearchClients
        ? isFilteringClients
          ? 'No clients match that search.'
          : 'No clients found.'
        : 'Select a client from the directory below.'
  const intakeErrorMessage = intakeQuery.isError
    ? presentError(intakeQuery.error, 'section-load').message
    : ''
  const autoAnswerContext = {
    contactName: form.state.values.contactName.trim(),
    contactPhone: form.state.values.contactPhone.trim(),
    contactEmail: form.state.values.contactEmail.trim(),
    customerType: form.state.values.customerType,
    budget: form.state.values.budget,
    preferredDate: form.state.values.preferredDate,
    uploads: flattenedUploads,
  }
  const visibleFields = fields.filter((field) => !shouldHideAutoField(field, autoAnswerContext))
  const estimatePreview =
    activePricingConfig && !pricingConfigQuery.isError
      ? calculateEstimateTotal(activePricingConfig, fields, answerValues, autoAnswerContext)
      : null

  const calculateEstimate = () => {
    if (pricingConfigQuery.isPending) {
      toast.error('Pricing is still loading.')
      return
    }

    if (!activePricingConfig || pricingConfigQuery.isError) {
      toast.error('No active pricing setup is available for this service.')
      return
    }

    const result = calculateEstimateTotal(
      activePricingConfig,
      fields,
      answerValues,
      autoAnswerContext,
    )
    if (!result.supported) {
      toast.error('Estimate cannot be calculated yet.', {
        description: result.reason,
      })
      return
    }

    form.setFieldValue('estimatedValue', result.total)
    toast.success(`Estimate calculated: ${formatCurrency(result.total)}`)
  }

  const retryIntakeForm = () => {
    void intakeQuery.refetch()
  }

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal commercial-modal--xl"
        aria-label="Create Service Request"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>
              {usesSpecializedFlow && activeSpecializedPlugin
                ? activeSpecializedPlugin.flowTitle
                : 'Create Service Request'}
            </h2>
            <p>
              {usesSpecializedFlow && activeSpecializedPlugin
                ? activeSpecializedPlugin.flowDescription
                : 'Create a commercial request using the selected service intake form.'}
            </p>
          </div>
          <button
            type="button"
            className="commercial-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </header>

        <div className="commercial-modal-body">
          {!ready ? (
            <EmptyState
              title="Request cannot be created yet"
              description="There are no active services available for request intake right now."
            />
          ) : (
            <>
              {error ? (
                <div className="service-admin-notice service-admin-notice-red">{error}</div>
              ) : null}

              <section className="commercial-form-section">
                <div className="commercial-form-section-heading">
                  <div>
                    <h3>Client</h3>
                    <p>
                      {clientPickerMode === 'create'
                        ? selectedMarketingLead
                          ? `Create a client record from marketing lead ${selectedMarketingLead.fullName}.`
                          : 'Add a new client record for this request.'
                        : clientPickerMode === 'selected'
                          ? selectedMarketingLead
                            ? 'Review the selected client and linked marketing lead, or change your choice.'
                            : 'Review the selected client or change your choice.'
                          : clientDirectoryTab === 'leads'
                            ? 'Search marketing leads and continue with an existing client or create one from the lead.'
                            : 'Search the client directory or create a new client.'}
                    </p>
                  </div>
                </div>

                <div className="commercial-client-picker">
                  <div className="commercial-client-toolbar">
                    {clientPickerMode === 'browse' ? (
                      <>
                        <div className="commercial-client-directory-tabs" role="tablist" aria-label="Client directory">
                          <button
                            type="button"
                            role="tab"
                            aria-selected={clientDirectoryTab === 'clients'}
                            className={
                              clientDirectoryTab === 'clients'
                                ? 'commercial-client-directory-tab commercial-client-directory-tab--active'
                                : 'commercial-client-directory-tab'
                            }
                            onClick={() => {
                              setClientDirectoryTab('clients')
                              setLeadSearchDraft('')
                              setLeadSearch('')
                            }}
                          >
                            Clients
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={clientDirectoryTab === 'leads'}
                            className={
                              clientDirectoryTab === 'leads'
                                ? 'commercial-client-directory-tab commercial-client-directory-tab--active'
                                : 'commercial-client-directory-tab'
                            }
                            disabled={!canSearchLeads}
                            title={
                              !canSearchLeads
                                ? 'You do not have permission to search marketing leads'
                                : undefined
                            }
                            onClick={() => {
                              setClientDirectoryTab('leads')
                              setClientSearchDraft('')
                              setClientSearch('')
                            }}
                          >
                            Leads
                          </button>
                        </div>
                        {clientDirectoryTab === 'clients' ? (
                          canSearchClients ? (
                            <div className="commercial-field commercial-client-search-field commercial-client-search-field--bare">
                              <div className="commercial-client-search">
                                <IconSearch size={15} aria-hidden="true" />
                                <input
                                  value={clientSearchDraft}
                                  onChange={(event) => setClientSearchDraft(event.target.value)}
                                  placeholder="Search by name or email..."
                                  aria-label="Search clients"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="commercial-client-toolbar-copy">
                              <strong>Browse clients</strong>
                              <span>Select a client from the directory below.</span>
                            </div>
                          )
                        ) : canSearchLeads ? (
                          <div className="commercial-field commercial-client-search-field commercial-client-search-field--bare">
                            <div className="commercial-client-search">
                              <IconSearch size={15} aria-hidden="true" />
                              <input
                                value={leadSearchDraft}
                                onChange={(event) => setLeadSearchDraft(event.target.value)}
                                placeholder="Search by name, phone, or email..."
                                aria-label="Search marketing leads"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="commercial-client-toolbar-copy">
                            <strong>Marketing leads unavailable</strong>
                            <span>You do not have permission to search marketing leads.</span>
                          </div>
                        )}
                        {clientDirectoryTab === 'clients' ? (
                          <button
                            type="button"
                            className="commercial-btn commercial-btn-small commercial-client-add-btn"
                            disabled={!canCreateClient}
                            title={
                              !canCreateClient
                                ? 'You do not have permission to create clients'
                                : undefined
                            }
                            onClick={openCreateClient}
                          >
                            <IconUserPlus size={14} />
                            New client
                          </button>
                        ) : null}
                      </>
                    ) : null}

                    {clientPickerMode === 'selected' ? (
                      <>
                        <div className="commercial-client-toolbar-copy">
                          <strong>Client selected</strong>
                          <span>
                            {selectedClient?.name}
                            {selectedMarketingLead
                              ? ` · Marketing lead ${selectedMarketingLead.fullName}`
                              : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="commercial-btn commercial-btn-small commercial-client-add-btn"
                          onClick={clearClientSelection}
                        >
                          <IconX size={14} />
                          Clear selection
                        </button>
                      </>
                    ) : null}

                    {clientPickerMode === 'create' ? (
                      <>
                        <div className="commercial-client-toolbar-copy">
                          <strong>
                            {selectedMarketingLead ? 'New client from lead' : 'New client'}
                          </strong>
                          <span>
                            {selectedMarketingLead
                              ? `${selectedMarketingLead.fullName} · invitation email will be sent after creation.`
                              : 'Invitation email will be sent after creation.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="commercial-btn commercial-btn-small commercial-client-add-btn"
                          onClick={closeCreateClient}
                        >
                          <IconArrowLeft size={14} />
                          Back to search
                        </button>
                      </>
                    ) : null}
                  </div>

                  <div className="commercial-client-workspace">
                    {clientPickerMode === 'browse' && clientDirectoryTab === 'clients' ? (
                      <ClientResultsTable
                        loading={canSearchClients && clientDirectoryQuery.isPending}
                        loadingMore={clientDirectoryQuery.isFetchingNextPage}
                        hasMore={Boolean(clientDirectoryQuery.hasNextPage)}
                        onLoadMore={() => {
                          void clientDirectoryQuery.fetchNextPage()
                        }}
                        emptyMessage={browseEmptyMessage}
                        clients={browseClients}
                        selectedClientId={0}
                        onSelect={chooseClient}
                      />
                    ) : null}

                    {clientPickerMode === 'browse' && clientDirectoryTab === 'leads' ? (
                      <LeadResultsTable
                        loading={canSearchLeads && leadDirectoryQuery.isPending}
                        loadingMore={leadDirectoryQuery.isFetchingNextPage}
                        hasMore={Boolean(leadDirectoryQuery.hasNextPage)}
                        onLoadMore={() => {
                          void leadDirectoryQuery.fetchNextPage()
                        }}
                        emptyMessage={browseEmptyMessage}
                        leads={browseLeads}
                        selectedLeadId={0}
                        onSelect={chooseLead}
                      />
                    ) : null}

                    {clientPickerMode === 'selected' && selectedClient ? (
                      <ClientResultsTable
                        clients={[selectedClient]}
                        selectedClientId={selectedClient.id}
                        interactive={false}
                        compact
                      />
                    ) : null}

                    {clientPickerMode === 'create' ? (
                      <div className="commercial-client-create-panel commercial-client-create-panel--full">
                        {createClientFormError ? (
                          <div className="service-admin-notice service-admin-notice-red">
                            {createClientFormError}
                          </div>
                        ) : null}
                        <div className="commercial-form-grid">
                          <label
                            className={`commercial-field${newClientFieldErrors.firstName ? ' commercial-field--invalid' : ''}`}
                          >
                            <span>First name *</span>
                            <input
                              ref={(node) => {
                                newClientFieldRefs.current.firstName = node
                              }}
                              value={newClientFirstName}
                              aria-invalid={Boolean(newClientFieldErrors.firstName)}
                              onChange={(event) => {
                                setNewClientFirstName(event.target.value)
                                clearNewClientFieldError('firstName')
                                setCreateClientFormError('')
                              }}
                              placeholder="Given name"
                            />
                            {newClientFieldErrors.firstName ? (
                              <small className="commercial-field-error">
                                {newClientFieldErrors.firstName}
                              </small>
                            ) : null}
                          </label>
                          <label
                            className={`commercial-field${newClientFieldErrors.lastName ? ' commercial-field--invalid' : ''}`}
                          >
                            <span>Last name *</span>
                            <input
                              ref={(node) => {
                                newClientFieldRefs.current.lastName = node
                              }}
                              value={newClientLastName}
                              aria-invalid={Boolean(newClientFieldErrors.lastName)}
                              onChange={(event) => {
                                setNewClientLastName(event.target.value)
                                clearNewClientFieldError('lastName')
                                setCreateClientFormError('')
                              }}
                              placeholder="Family name"
                            />
                            {newClientFieldErrors.lastName ? (
                              <small className="commercial-field-error">
                                {newClientFieldErrors.lastName}
                              </small>
                            ) : null}
                          </label>
                          <label
                            className={`commercial-field${newClientFieldErrors.email ? ' commercial-field--invalid' : ''}`}
                          >
                            <span>Email *</span>
                            <input
                              ref={(node) => {
                                newClientFieldRefs.current.email = node
                              }}
                              type="email"
                              value={newClientEmail}
                              aria-invalid={Boolean(newClientFieldErrors.email)}
                              onChange={(event) => {
                                setNewClientEmail(event.target.value)
                                clearNewClientFieldError('email')
                                setCreateClientFormError('')
                              }}
                              placeholder="client@example.com"
                            />
                            {newClientFieldErrors.email ? (
                              <small className="commercial-field-error">
                                {newClientFieldErrors.email}
                              </small>
                            ) : null}
                          </label>
                          <label
                            className={`commercial-field${newClientFieldErrors.phoneNumber ? ' commercial-field--invalid' : ''}`}
                          >
                            <span>Phone *</span>
                            <input
                              ref={(node) => {
                                newClientFieldRefs.current.phoneNumber = node
                              }}
                              value={newClientPhone}
                              aria-invalid={Boolean(newClientFieldErrors.phoneNumber)}
                              onChange={(event) => {
                                setNewClientPhone(event.target.value)
                                clearNewClientFieldError('phoneNumber')
                                setCreateClientFormError('')
                              }}
                              placeholder="+234..."
                            />
                            {newClientFieldErrors.phoneNumber ? (
                              <small className="commercial-field-error">
                                {newClientFieldErrors.phoneNumber}
                              </small>
                            ) : null}
                          </label>
                        </div>
                        <p className="commercial-form-note">
                          A welcome email with a password setup link will be sent to the client.
                        </p>
                        <div className="commercial-client-create-actions">
                          <button type="button" className="commercial-btn" onClick={closeCreateClient}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="commercial-btn commercial-btn-primary"
                            disabled={!canCreateClient || createClientMutation.isPending}
                            onClick={submitNewClient}
                          >
                            {createClientMutation.isPending
                              ? 'Creating client...'
                              : 'Create & select client'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <form.Field name="clientId">
                    {(field) =>
                      canSearchClients ? null : (
                        <DropdownSelect
                          label="Client / organization"
                          required
                          fullWidth
                          searchable
                          placeholder="Select a client"
                          options={mapDropdownOptions(
                            activeClients.map((client) => ({
                              value: client.id,
                              label: client.name,
                              description: client.email,
                            })),
                          )}
                          value={String(field.state.value || 0)}
                          onChange={(nextValue) => chooseClientById(Number(nextValue))}
                        />
                      )
                    }
                  </form.Field>
                </div>
              </section>

              <section className="commercial-form-section">
                <div className="commercial-form-section-heading">
                  <div>
                    <h3>Service</h3>
                    <p>Only routing choices that matter for this request stay editable.</p>
                  </div>
                </div>
                <div className="commercial-form-grid">
                  <DropdownSelect
                    label="Parent service"
                    required
                    placeholder="Select a parent service"
                    options={mapDropdownOptions(
                      parentServiceOptions.map((parent) => ({
                        value: parent.key,
                        label: parent.label,
                      })),
                    )}
                    value={parentServiceKey}
                    onChange={chooseParentService}
                  />

                  <DropdownSelect
                    label="Service"
                    required
                    disabled={!parentServiceKey}
                    placeholder={
                      parentServiceKey ? 'Select a service' : 'Choose a parent service first'
                    }
                    searchable
                    options={mapDropdownOptions(
                      childServices.map((service) => ({
                        value: service.id,
                        label: service.code ? `${service.name} (${service.code})` : service.name,
                        ...(service.specializedDomain
                          ? {
                              description:
                                service.specializedDomain === 'real_estate'
                                  ? 'Specialized service · Estate sales flow'
                                  : `Specialized service · ${service.specializedDomain.replace(/_/g, ' ')}`,
                            }
                          : {}),
                      })),
                    )}
                    value={String(serviceId || 0)}
                    onChange={(nextValue) => chooseService(Number(nextValue))}
                  />

                  {selectedService ? (
                    branches.length === 0 ? (
                      <div className="commercial-field commercial-field--full">
                        <span>Fulfilling branch</span>
                        <p className="commercial-form-note commercial-form-note-warning">
                          No branch is activated for this service yet. You can still create the
                          request, but configure branch availability in Service Administration for
                          proper routing.
                        </p>
                      </div>
                    ) : branches.length === 1 ? (
                      <div className="commercial-field commercial-field--full">
                        <span>Fulfilling branch</span>
                        <p className="commercial-form-note">
                          This request will be handled by <strong>{branches[0]?.name}</strong>.
                        </p>
                      </div>
                    ) : (
                      <form.Field name="branchId">
                        {(field) => (
                          <DropdownSelect
                            label="Fulfilling branch"
                            required
                            fullWidth
                            helpText="Which office will handle and deliver this request."
                            options={mapDropdownOptions(
                              branches.map((branch) => ({
                                value: branch.id,
                                label: branch.name,
                              })),
                            )}
                            value={String(field.state.value || 0)}
                            onChange={(nextValue) => field.handleChange(Number(nextValue))}
                          />
                        )}
                      </form.Field>
                    )
                  ) : null}
                </div>
              </section>

              {!selectedService ? (
                <EmptyState
                  title="Select a service"
                  description="Choose the service you want to request before continuing."
                />
              ) : usesSpecializedFlow && activeSpecializedPlugin ? (
                <SpecializedRequestContextPanel
                  plugin={activeSpecializedPlugin}
                  service={selectedService}
                  value={specializedContext}
                  error={specializedContextError}
                  onChange={setSpecializedContextDraft}
                />
              ) : intakeQuery.isPending ? (
                <div className="commercial-empty">Loading request form...</div>
              ) : intakeQuery.isError ? (
                <EmptyState
                  title="Request form unavailable"
                  description={
                    intakeErrorMessage ||
                    'This service is not ready for request intake yet. Publish its request form and try again.'
                  }
                  action={
                    <Button variant="outline" size="sm" onClick={retryIntakeForm}>
                      Retry
                    </Button>
                  }
                />
              ) : (
                <>
                  <section className="commercial-form-section">
                    <div className="commercial-form-section-heading">
                      <div>
                        <h3>{intakeQuery.data?.form.name ?? 'Request details'}</h3>
                        <p>
                          These questions are specific to this service and become part of the
                          request record.
                        </p>
                      </div>
                    </div>
                    <div className="commercial-form-grid">
                      <RequestIntakeFields
                        fields={visibleFields}
                        answerValues={answerValues}
                        fieldErrors={fieldErrors}
                        uploadsByField={uploadsByField}
                        fieldRefs={fieldRefs}
                        onValueChange={setAnswerValue}
                        onFileSelection={handleFileSelection}
                        onRetryUpload={retryUpload}
                        onRemoveUpload={removeUpload}
                      />
                    </div>
                  </section>

                  <section className="commercial-form-section">
                    <button
                      type="button"
                      className="commercial-inline-toggle"
                      onClick={() => setShowInternalDetails((current) => !current)}
                    >
                      <span>Optional internal details</span>
                      <IconChevronDown
                        size={16}
                        className={showInternalDetails ? 'commercial-inline-toggle-icon-open' : ''}
                      />
                    </button>
                    {showInternalDetails ? (
                      <div className="commercial-form-grid commercial-form-grid-top">
                        <form.Field name="priority">
                          {(field) => (
                            <DropdownSelect
                              label="Priority"
                              options={mapDropdownOptions(choices.priorities)}
                              value={field.state.value}
                              onChange={(nextValue) => {
                                if (isPriorityValue(nextValue)) field.handleChange(nextValue)
                              }}
                            />
                          )}
                        </form.Field>

                        <form.Field name="sourceReference">
                          {(field) => (
                            <label className="commercial-field">
                              <span>Lead / campaign reference</span>
                              <input
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                              />
                            </label>
                          )}
                        </form.Field>

                        {!hasBudgetField ? (
                          <form.Field name="budget">
                            {(field) => (
                              <label className="commercial-field">
                                <span>Budget</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={field.state.value}
                                  onChange={(event) =>
                                    field.handleChange(nonNegativeNumber(event.target.value))
                                  }
                                />
                              </label>
                            )}
                          </form.Field>
                        ) : null}

                        <form.Field name="estimatedValue">
                          {(field) => (
                            <label className="commercial-field commercial-field--full">
                              <span>Estimated value</span>
                              <div className="commercial-estimate-row">
                                <input
                                  type="number"
                                  min="0"
                                  value={field.state.value}
                                  onChange={(event) =>
                                    field.handleChange(nonNegativeNumber(event.target.value))
                                  }
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="commercial-estimate-button"
                                  onClick={calculateEstimate}
                                  disabled={pricingConfigQuery.isPending}
                                >
                                  <IconCalculator size={14} />
                                  {pricingConfigQuery.isPending
                                    ? 'Loading pricing...'
                                    : 'Calculate estimate'}
                                </Button>
                              </div>
                              {estimatePreview?.supported ? (
                                <small>
                                  Current calculator result: {formatCurrency(estimatePreview.total)}
                                </small>
                              ) : activePricingConfig ? (
                                <small>
                                  Use the button when the pricing inputs for this service are
                                  filled.
                                </small>
                              ) : null}
                            </label>
                          )}
                        </form.Field>

                        {!hasPreferredDateField ? (
                          <form.Field name="preferredDate">
                            {(field) => (
                              <label className="commercial-field">
                                <span>Preferred date</span>
                                <input
                                  type="date"
                                  value={field.state.value}
                                  onChange={(event) => field.handleChange(event.target.value)}
                                />
                              </label>
                            )}
                          </form.Field>
                        ) : null}

                        <form.Field name="dueDate">
                          {(field) => (
                            <label className="commercial-field">
                              <span>Due date</span>
                              <input
                                type="date"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                              />
                            </label>
                          )}
                        </form.Field>

                        {!hasScopeSummaryField ? (
                          <form.Field name="scopeSummary">
                            {(field) => (
                              <label className="commercial-field commercial-field--full">
                                <span>Scope summary</span>
                                <textarea
                                  rows={4}
                                  value={field.state.value}
                                  onChange={(event) => field.handleChange(event.target.value)}
                                />
                              </label>
                            )}
                          </form.Field>
                        ) : null}

                        <form.Field name="nextAction">
                          {(field) => (
                            <label className="commercial-field commercial-field--full">
                              <span>Next action</span>
                              <input
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                              />
                            </label>
                          )}
                        </form.Field>
                      </div>
                    ) : null}
                  </section>

                  {hasUploadingFiles ? (
                    <div className="commercial-form-alert">
                      <IconLoader2 size={16} className="commercial-spin" />
                      <span>
                        Document uploads are still in progress. Submit will unlock when they finish.
                      </span>
                    </div>
                  ) : null}

                  {hasUploadErrors ? (
                    <div className="commercial-form-alert commercial-form-alert-danger">
                      <IconAlertCircle size={16} />
                      <span>
                        One or more documents failed to upload. Remove or upload them again before
                        submitting.
                      </span>
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="commercial-btn commercial-btn-primary"
            disabled={
              saving ||
              !ready ||
              !selectedService ||
              (!usesSpecializedFlow && (intakeQuery.isPending || intakeQuery.isError)) ||
              hasUploadingFiles ||
              (usesSpecializedFlow && !onContinueSpecialized)
            }
          >
            {saving
              ? usesSpecializedFlow
                ? 'Continuing...'
                : 'Creating...'
              : usesSpecializedFlow && activeSpecializedPlugin
                ? activeSpecializedPlugin.submitLabel
                : 'Create Request'}
          </button>
        </footer>
      </form>
    </div>
  )
}
