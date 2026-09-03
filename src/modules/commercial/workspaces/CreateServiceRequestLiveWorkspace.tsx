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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/app/auth'
import { hasPermission, PERMISSIONS } from '@/app/permissions'

import { presentError } from '@/shared/errors'
import { ApiError } from '@/shared/api/api-error'
import { formatCurrency } from '@/shared/lib/formatters'
import { parseNumberFieldValue } from '@/shared/lib/number-input'
import { Button } from '@/shared/ui/button'
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

type ServiceOptionGroup = {
  parentName: string
  services: ServiceOption[]
}

type NewClientField = 'firstName' | 'lastName' | 'email' | 'phoneNumber'

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

function groupServiceOptions(services: ServiceOption[]): ServiceOptionGroup[] {
  const grouped = new Map<string, ServiceOption[]>()

  for (const service of services) {
    const parentName = service.parentName.trim() || 'Other services'
    const current = grouped.get(parentName) ?? []
    current.push(service)
    grouped.set(parentName, current)
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([parentName, groupServices]) => ({
      parentName,
      services: groupServices.sort((left, right) => left.name.localeCompare(right.name)),
    }))
}

function ClientResultsTable({
  loading,
  emptyMessage,
  clients: clientRows,
  selectedClientId = 0,
  onSelect,
  interactive = true,
  compact = false,
}: {
  loading?: boolean
  emptyMessage?: string
  clients: ClientOption[]
  selectedClientId?: number
  onSelect?: (client: ClientOption) => void
  interactive?: boolean
  compact?: boolean
}) {
  const wrapClassName = compact
    ? 'commercial-table-wrap commercial-client-table-wrap commercial-client-table-wrap--compact'
    : 'commercial-table-wrap commercial-client-table-wrap'

  if (loading) {
    return (
      <div className={wrapClassName}>
        <div className="commercial-client-results-empty">Searching clients...</div>
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
    <div className={wrapClassName}>
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
  onClose,
  onSubmit,
}: {
  clients: ClientOption[]
  services: ServiceOption[]
  choices: ServiceRequestChoices
  saving: boolean
  onClose: () => void
  onSubmit: (
    input: CreateServiceRequestInput,
    attachments: CreateServiceRequestAttachmentInput[],
  ) => Promise<unknown> | void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canSearchClients = hasPermission(user, PERMISSIONS.clientsList)
  const canCreateClient = hasPermission(user, PERMISSIONS.clientsCreate)
  const activeClients = clients.filter((item) => item.active)
  const groupedServices = useMemo(() => groupServiceOptions(services), [services])
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
  const [newClientFirstName, setNewClientFirstName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [uploadsByField, setUploadsByField] = useState<Record<string, PendingUpload[]>>({})
  const [answerValues, setAnswerValues] = useState<Record<string, unknown>>({})
  const controllersRef = useRef<Record<string, AbortController>>({})
  const uploadIdRef = useRef(0)
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const newClientFieldRefs = useRef<Partial<Record<NewClientField, HTMLInputElement | null>>>({})
  const pickedClientRef = useRef<ClientOption | null>(null)

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

  const intakeQuery = useQuery({
    ...serviceRequestQueries.intake(serviceId),
    enabled: serviceId > 0,
  })
  const pricingConfigQuery = useQuery({
    ...serviceRequestQueries.pricingConfig(serviceId),
    enabled: serviceId > 0,
  })
  const clientSearchQuery = useQuery({
    ...serviceRequestQueries.clientSearch(clientSearch),
    enabled: canSearchClients && clientSearch.trim().length >= 2,
  })

  useEffect(() => {
    if (clientSearchDraft === clientSearch) return

    const timeoutId = window.setTimeout(() => {
      setClientSearch(clientSearchDraft.trim())
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [clientSearchDraft, clientSearch])

  const selectedService = services.find((item) => item.id === serviceId) ?? null
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

      if (!serviceId) {
        setError('Select a service.')
        return
      }

      if (branches.length > 0 && !value.branchId) {
        setError('Select a fulfilling branch.')
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
          },
          attachments,
        )
      } catch (submitError) {
        setError(presentError(submitError, 'form-submit').message)
      }
    },
  })

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

  const clearClientSelection = useCallback(() => {
    pickedClientRef.current = null
    setPickedClient(null)
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
  }, [
    clearClientSelection,
    setClientSearch,
    setClientSearchDraft,
    setCreateClientFormError,
    setNewClientFieldErrors,
    setShowCreateClient,
  ])

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

  const chooseService = (nextServiceId: number) => {
    const service = services.find((item) => item.id === nextServiceId)
    clearUploads()
    setServiceId(nextServiceId)
    form.setFieldValue('branchId', service?.activeBranches[0]?.id ?? 0)
    form.setFieldValue('estimatedValue', 0)
    form.setFieldValue('answers', {})
    setAnswerValues({})
    setFieldErrors({})
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
  const clientSearchResults = (clientSearchQuery.data ?? []).filter((item) => item.active)
  const suggestedClients = activeClients.slice(0, 8)
  const selectedClient = pickedClient
  const clientPickerMode = showCreateClient ? 'create' : pickedClient ? 'selected' : 'browse'
  const browseClients =
    canSearchClients && clientSearch.trim().length >= 2 ? clientSearchResults : suggestedClients
  const browseEmptyMessage =
    canSearchClients && clientSearch.trim().length >= 2
      ? 'No clients match that search.'
      : 'Search for a client or create a new one to continue.'
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
            <h2>Create Service Request</h2>
            <p>Create a commercial request using the selected service intake form.</p>
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
                        ? 'Add a new client record for this request.'
                        : clientPickerMode === 'selected'
                          ? 'Review the selected client or change your choice.'
                          : 'Search the client directory or create a new client.'}
                    </p>
                  </div>
                </div>

                <div className="commercial-client-picker">
                  <div className="commercial-client-toolbar">
                    {clientPickerMode === 'browse' ? (
                      <>
                        {canSearchClients ? (
                          <label className="commercial-field commercial-client-search-field">
                            <span>Search client</span>
                            <div className="commercial-client-search">
                              <IconSearch size={15} aria-hidden="true" />
                              <input
                                value={clientSearchDraft}
                                onChange={(event) => setClientSearchDraft(event.target.value)}
                                placeholder="Search by name or email..."
                              />
                            </div>
                          </label>
                        ) : (
                          <div className="commercial-client-toolbar-copy">
                            <strong>Browse clients</strong>
                            <span>Select a client from the directory below.</span>
                          </div>
                        )}
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
                      </>
                    ) : null}

                    {clientPickerMode === 'selected' ? (
                      <>
                        <div className="commercial-client-toolbar-copy">
                          <strong>Client selected</strong>
                          <span>{selectedClient?.name}</span>
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
                          <strong>New client</strong>
                          <span>Invitation email will be sent after creation.</span>
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
                    {clientPickerMode === 'browse' ? (
                      <ClientResultsTable
                        loading={canSearchClients && clientSearch.trim().length >= 2 && clientSearchQuery.isFetching}
                        emptyMessage={browseEmptyMessage}
                        clients={browseClients}
                        selectedClientId={0}
                        onSelect={chooseClient}
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
                        <label className="commercial-field commercial-field--full">
                          <span>Client / organization *</span>
                          <select
                            value={field.state.value}
                            onChange={(event) => chooseClientById(Number(event.target.value))}
                          >
                            <option value={0}>Select a client</option>
                            {activeClients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name} — {client.email}
                              </option>
                            ))}
                          </select>
                        </label>
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
                  <label className="commercial-field commercial-field--full">
                    <span>Service *</span>
                    <select
                      value={serviceId}
                      onChange={(event) => chooseService(Number(event.target.value))}
                    >
                      <option value={0}>Select a service</option>
                      {groupedServices.map((group) => (
                        <optgroup key={group.parentName} label={group.parentName}>
                          {group.services.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                              {service.code ? ` (${service.code})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

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
                          <label className="commercial-field commercial-field--full">
                            <span>Fulfilling branch *</span>
                            <select
                              value={field.state.value}
                              onChange={(event) => field.handleChange(Number(event.target.value))}
                            >
                              {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                  {branch.name}
                                </option>
                              ))}
                            </select>
                            <small>Which office will handle and deliver this request.</small>
                          </label>
                        )}
                      </form.Field>
                    )
                  ) : null}
                </div>
              </section>

              {!selectedService ? (
                <EmptyState
                  title="Select a service"
                  description="Choose the service you want to request before the intake form can be loaded."
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
                            <label className="commercial-field">
                              <span>Priority</span>
                              <select
                                value={field.state.value}
                                onChange={(event) => {
                                  const nextValue = event.target.value
                                  if (isPriorityValue(nextValue)) field.handleChange(nextValue)
                                }}
                              >
                                {choices.priorities.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </label>
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
              intakeQuery.isPending ||
              intakeQuery.isError ||
              hasUploadingFiles
            }
          >
            {saving ? 'Creating...' : 'Create Request'}
          </button>
        </footer>
      </form>
    </div>
  )
}
