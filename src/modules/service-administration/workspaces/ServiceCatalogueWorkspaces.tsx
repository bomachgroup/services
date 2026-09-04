import { IconX } from '@tabler/icons-react'
import { useRef, useState, useId, type MutableRefObject } from 'react'

import {
  formatNumberFieldValue,
  parseNumberFieldValue,
  parseOptionalNumberFieldValue,
} from '@/shared/lib/number-input'
import { DropdownSelect } from '@/shared/ui/dropdown-select'

import type {
  ConfigureServiceInput,
  WorkflowOwnerRoleOption,
  ServiceSetupStageProgress,
  ServiceSetupStageId,
  CreateServiceStageAccess,
  CreateServiceWizardInput,
  PricingCalculator,
  RequestFieldTypeOption,
  RequestFormField,
  ServiceParentOption,
  ServiceCatalogueItem,
  ServiceRequestForm,
  ServiceWorkflow,
  WorkflowStage,
} from '../types/service-administration.types'
import { RequestFormBuilderPanel } from '../components/RequestFormBuilderPanel'
import { WorkflowDesignerPanel } from '../components/WorkflowDesignerPanel'
import {
  CLIENT_VISIBILITY_OPTIONS_LABEL,
  CLIENT_VISIBILITY_OPTIONS_VALUE,
  FULFILLMENT_MODE_OPTIONS,
  PRICING_METHOD_OPTIONS_CONFIGURE,
  PRICING_METHOD_OPTIONS_CREATE,
  SERVICE_STATUS_OPTIONS,
  SERVICE_STATUS_OPTIONS_WITH_PUBLISH,
} from '../components/service-admin-dropdown-options'
import {
  buildStagesForService,
  cloneStages,
} from '../components/workflow-designer-panel.utils'
import {
  SPECIALIZED_DOMAIN_OPTIONS,
  readSpecializedRequestContext,
} from '../api/specialized-service.utils'

function labelsToRequestFields(labels: string[]): RequestFormField[] {
  return labels.map((label, index) => ({
    id: `field-${index}`,
    label,
    key: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, ''),
    type: 'text',
    required: true,
  }))
}

function registerFieldRef(
  fieldRefs: MutableRefObject<Record<string, HTMLElement | null>>,
  field: string,
  node: HTMLElement | null,
) {
  fieldRefs.current[field] = node
}

const configureWizardSteps = ['Basic', 'Pricing', 'Request Form', 'Workflow', 'Branches', 'Publish']

type ServiceWizardFieldName =
  | 'name'
  | 'code'
  | 'parentId'
  | 'description'
  | 'slaDays'
  | 'fulfilmentMode'
  | 'specializedDomain'
  | 'specializedRequestContext'
  | 'pricingMethod'
  | 'rate'
  | 'depositPercent'
  | 'taxPercent'
  | 'discountApprovalPercent'
  | 'requestFields'
  | 'workflow'
  | 'branches'
  | 'status'
  | 'clientVisibility'

type ServiceWizardFieldErrors = Partial<Record<ServiceWizardFieldName, string>>

function focusField(
  fieldRefs: React.MutableRefObject<Record<string, HTMLElement | null>>,
  fieldName: string,
) {
  window.requestAnimationFrame(() => {
    const node = fieldRefs.current[fieldName]
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement ||
      node instanceof HTMLButtonElement
    ) {
      node.focus()
    }
  })
}

function focusNotice(ref: React.RefObject<HTMLElement | null>) {
  window.requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ref.current?.focus()
  })
}

function ModalShell({
  title,
  wide = false,
  variant = 'default',
  children,
  footer,
  onClose,
}: {
  title: string
  wide?: boolean
  variant?: 'default' | 'wizard'
  children: React.ReactNode
  footer: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="service-admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          'service-admin-modal',
          wide ? 'service-admin-modal--wide' : '',
          variant === 'wizard' ? 'service-admin-modal--wizard' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="service-admin-modal-header">
          <h2 className="service-admin-modal-title">{title}</h2>
          <button
            type="button"
            className="service-admin-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <IconX size={16} />
          </button>
        </header>
        <div className="service-admin-modal-body">{children}</div>
        <footer className="service-admin-modal-footer">{footer}</footer>
      </section>
    </div>
  )
}

function Field({
  label,
  children,
  full = false,
  required = false,
  error,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
  required?: boolean
  error?: string | undefined
}) {
  const labelId = useId()

  return (
    <div
      className={`service-admin-config-field${full ? ' service-admin-config-field--full' : ''}`}
      role="group"
      aria-labelledby={labelId}
    >
      <span id={labelId}>
        {label}
        {required ? <em className="service-admin-required">*</em> : null}
      </span>
      {children}
      {error ? <small className="service-admin-field-error">{error}</small> : null}
    </div>
  )
}

export function CreateServiceWizard({
  open,
  pending,
  parents,
  branches: branchOptions = [],
  ownerRoles = [],
  fieldTypes = [],
  stageAccess,
  progress = [],
  setupServiceId = null,
  onClose,
  onSubmit,
  onRetryFailed,
}: {
  open: boolean
  pending: boolean
  parents: ServiceParentOption[]
  branches?: Array<{ id: number; name: string; code: string }>
  ownerRoles?: WorkflowOwnerRoleOption[]
  fieldTypes?: RequestFieldTypeOption[]
  stageAccess?: CreateServiceStageAccess
  progress?: ServiceSetupStageProgress[]
  setupServiceId?: number | null
  onClose: () => void
  onSubmit: (input: CreateServiceWizardInput) => void
  onRetryFailed?: () => void
}) {
  const access: CreateServiceStageAccess = stageAccess ?? {
    pricing: true,
    requestForm: true,
    workflow: true,
    branches: true,
    publish: true,
    ownerRoles: true,
  }

  const [step, setStep] = useState(0)
  const [maxReachedStep, setMaxReachedStep] = useState(0)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [parentId, setParentId] = useState<number>(0)
  const [description, setDescription] = useState('')
  const [slaDays, setSlaDays] = useState(5)
  const [fulfilmentMode, setFulfilmentMode] = useState('Quick service order')
  const [specializedDomain, setSpecializedDomain] = useState('')
  const [specializedRequestContext, setSpecializedRequestContext] = useState('')
  const [pricingMethod, setPricingMethod] = useState('')
  const [rate, setRate] = useState<number | null>(null)
  const [depositPercent, setDepositPercent] = useState<number | null>(null)
  const [taxPercent, setTaxPercent] = useState<number | null>(null)
  const [discountApprovalPercent, setDiscountApprovalPercent] = useState<number | null>(null)
  const [requestFields, setRequestFields] = useState<RequestFormField[]>([])
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>([])
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([])
  const [status, setStatus] = useState<'active' | 'draft' | 'inactive'>('draft')
  const [clientVisibility, setClientVisibility] = useState<'visible' | 'internal' | 'hidden'>(
    'visible',
  )
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ServiceWizardFieldErrors>({})
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const errorNoticeRef = useRef<HTMLDivElement | null>(null)

  if (!open) return null

  type WizardStage =
    'basic' | 'pricing' | 'request-form' | 'workflow' | 'branches' | 'review'
  const steps: Array<{ id: WizardStage; label: string }> = [
    { id: 'basic', label: 'Basic' },
    ...(access.pricing ? [{ id: 'pricing' as const, label: 'Pricing' }] : []),
    ...(access.requestForm ? [{ id: 'request-form' as const, label: 'Request Form' }] : []),
    ...(access.workflow ? [{ id: 'workflow' as const, label: 'Workflow' }] : []),
    ...(access.branches ? [{ id: 'branches' as const, label: 'Branches' }] : []),
    { id: 'review', label: access.publish ? 'Review & Publish' : 'Review' },
  ]
  const currentStage = steps[Math.min(step, steps.length - 1)]?.id ?? 'basic'
  const effectiveSelectedBranchIds = selectedBranchIds
  const canPublishActive =
    access.publish &&
    access.pricing &&
    access.requestForm &&
    access.branches &&
    effectiveSelectedBranchIds.length > 0

  const clearFieldError = (field: ServiceWizardFieldName) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const failValidation = (message: string, field?: ServiceWizardFieldName) => {
    setError(message)
    setFieldErrors(field ? { [field]: message } : {})
    if (field) {
      focusField(fieldRefs, field)
      return
    }
    focusNotice(errorNoticeRef)
  }

  const validateStage = (
    stage: WizardStage,
  ): { message: string; field?: ServiceWizardFieldName } | null => {
    if (stage === 'basic') {
      if (!name.trim()) return { message: 'Service name is required.', field: 'name' }
      if (!code.trim()) return { message: 'Service code is required.', field: 'code' }
      if (!description.trim()) return { message: 'Description is required.', field: 'description' }
      if (!Number.isFinite(slaDays) || slaDays < 1) {
        return { message: 'SLA must be at least 1 day.', field: 'slaDays' }
      }
      if (!fulfilmentMode.trim()) {
        return { message: 'Fulfillment mode is required.', field: 'fulfilmentMode' }
      }
    }
    if (stage === 'pricing') {
      if (!pricingMethod.trim()) {
        return { message: 'Pricing method is required.', field: 'pricingMethod' }
      }
      if (rate === null || !Number.isFinite(rate) || rate < 0) {
        return { message: 'Base / unit price is required.', field: 'rate' }
      }
      if (
        depositPercent === null ||
        !Number.isFinite(depositPercent) ||
        depositPercent < 0 ||
        depositPercent > 100
      ) {
        return { message: 'Deposit (%) must be between 0 and 100.', field: 'depositPercent' }
      }
      if (taxPercent === null || !Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
        return { message: 'Tax (%) must be between 0 and 100.', field: 'taxPercent' }
      }
      if (
        discountApprovalPercent === null ||
        !Number.isFinite(discountApprovalPercent) ||
        discountApprovalPercent < 0 ||
        discountApprovalPercent > 100
      )
        return {
          message: 'Discount approval (%) must be between 0 and 100.',
          field: 'discountApprovalPercent',
        }
    }
    if (stage === 'request-form' && requestFields.length === 0) {
      return {
        message: 'Select at least one request form field.',
        field: 'requestFields',
      }
    }
    if (stage === 'workflow' && workflowStages.length === 0) {
      return { message: 'Add at least one workflow stage.', field: 'workflow' }
    }
    if (stage === 'branches' && status === 'active' && effectiveSelectedBranchIds.length === 0) {
      return {
        message: 'Select at least one active branch before publishing.',
        field: 'branches',
      }
    }
    return null
  }

  const submit = () => {
    for (const stage of steps) {
      if (stage.id === 'review') continue
      const problem = validateStage(stage.id)
      if (problem) {
        setStep(steps.findIndex((item) => item.id === stage.id))
        failValidation(problem.message, problem.field)
        return
      }
    }

    const enabledStages: ServiceSetupStageId[] = [
      ...(access.pricing ? ['pricing' as const] : []),
      ...(access.requestForm ? ['request-form' as const] : []),
      ...(access.workflow ? ['workflow' as const] : []),
      ...(access.branches && effectiveSelectedBranchIds.length > 0 ? ['branches' as const] : []),
      ...(status !== 'draft' && access.publish ? ['publish' as const] : []),
    ]
    const selectedBranches = branchOptions.filter((branch) =>
      effectiveSelectedBranchIds.includes(branch.id),
    )

    setError('')
    setFieldErrors({})
    onSubmit({
      name: name.trim(),
      parentId: parentId || null,
      code: code.trim(),
      description: description.trim(),
      owner: '',
      slaDays,
      fulfilmentMode,
      status,
      clientVisibility,
      branchNames: selectedBranches.map((branch) => branch.name),
      branchIds: effectiveSelectedBranchIds,
      specializedDomain: specializedDomain || null,
      specializedConfig: specializedDomain
        ? { ...(specializedRequestContext.trim() ? { request_context: specializedRequestContext.trim() } : {}) }
        : {},
      pricing: {
        method: pricingMethod,
        rate: rate as number,
        depositPercent: depositPercent as number,
        taxPercent: taxPercent as number,
        discountApprovalPercent: discountApprovalPercent as number,
      },
      requestFields,
      workflowStages: workflowStages.map((stage, index) => ({ ...stage, order: index + 1 })),
      enabledStages,
    })
  }

  const next = () => {
    const problem = validateStage(currentStage)
    if (problem) {
      failValidation(problem.message, problem.field)
      return
    }
    setError('')
    setFieldErrors({})
    if (currentStage === 'review') {
      submit()
      return
    }
    const following = Math.min(steps.length - 1, step + 1)
    setMaxReachedStep((current) => Math.max(current, following))
    setStep(following)
  }

  const retryable = progress.filter((item) => item.state === 'failed' || item.state === 'skipped')
  const successful = progress.filter((item) => item.state === 'success').length
  const progressPercent = progress.length ? Math.round((successful / progress.length) * 100) : 0
  const symbol = (state: ServiceSetupStageProgress['state']) => {
    if (state === 'success') return '✓'
    if (state === 'failed') return '✕'
    if (state === 'running') return '→'
    if (state === 'skipped') return '○'
    return '·'
  }

  return (
    <>
      <ModalShell
        title="Create & Activate Service"
        wide
        variant="wizard"
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              className="service-admin-button service-admin-wizard-nav-btn"
              disabled={step === 0 || pending || Boolean(setupServiceId)}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Previous
            </button>
            {setupServiceId ? (
              <button
                type="button"
                className="service-admin-button service-admin-wizard-nav-btn"
                disabled={pending}
                onClick={onClose}
              >
                Finish for now
              </button>
            ) : (
              <button
                type="button"
                className="service-admin-button service-admin-button-primary service-admin-wizard-nav-btn service-admin-wizard-nav-btn--primary"
                disabled={pending}
                onClick={next}
              >
                {pending ? 'Setting up…' : currentStage === 'review' ? 'Create Service' : 'Next'}
              </button>
            )}
          </>
        }
      >
        <div
          className="service-admin-wizard-steps"
          role="tablist"
          aria-label="Create service steps"
        >
          {steps.map((item, index) => {
            const reached = index <= maxReachedStep
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === step}
                aria-disabled={!reached}
                disabled={!reached || pending || Boolean(setupServiceId)}
                className={[
                  'service-admin-wizard-step',
                  index === step ? 'service-admin-wizard-step--active' : '',
                  index < step ? 'service-admin-wizard-step--complete' : '',
                  reached ? 'service-admin-wizard-step--reachable' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  if (!reached) return
                  setError('')
                  setStep(index)
                }}
              >
                {index + 1}. {item.label}
              </button>
            )
          })}
        </div>

        {error ? (
          <div
            ref={errorNoticeRef}
            tabIndex={-1}
            className="service-admin-notice service-admin-notice-red"
          >
            {error}
          </div>
        ) : null}

        {currentStage === 'basic' ? (
          <>
            <div className="service-admin-form-grid">
              <Field label="Service name" required error={fieldErrors.name}>
                <input
                  ref={(node) => {
                    fieldRefs.current.name = node
                  }}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  value={name}
                  onChange={(event) => {
                    clearFieldError('name')
                    setName(event.target.value)
                  }}
                />
              </Field>
              <Field label="Service code" required error={fieldErrors.code}>
                <input
                  ref={(node) => {
                    fieldRefs.current.code = node
                  }}
                  aria-invalid={fieldErrors.code ? true : undefined}
                  value={code}
                  onChange={(event) => {
                    clearFieldError('code')
                    setCode(event.target.value)
                  }}
                />
              </Field>
              <Field label="Service parent" error={fieldErrors.parentId}>
                <DropdownSelect
                  placeholder="Select a parent (optional)"
                  options={[
                    { value: '', label: 'Select a parent (optional)' },
                    ...parents.map((item) => ({
                      value: String(item.id),
                      label: item.name,
                    })),
                  ]}
                  value={parentId ? String(parentId) : ''}
                  invalid={Boolean(fieldErrors.parentId)}
                  containerRef={(node) => {
                    fieldRefs.current.parentId = node
                  }}
                  onChange={(value) => {
                    clearFieldError('parentId')
                    setParentId(value ? Number(value) : 0)
                  }}
                />
              </Field>
              <Field label="SLA (days)" required error={fieldErrors.slaDays}>
                <input
                  ref={(node) => {
                    fieldRefs.current.slaDays = node
                  }}
                  aria-invalid={fieldErrors.slaDays ? true : undefined}
                  type="number"
                  min={1}
                  value={formatNumberFieldValue(slaDays)}
                  onChange={(event) => {
                    clearFieldError('slaDays')
                    setSlaDays(parseNumberFieldValue(event.target.value))
                  }}
                />
              </Field>
            </div>
            <Field label="Description" required error={fieldErrors.description}>
              <textarea
                ref={(node) => {
                  fieldRefs.current.description = node
                }}
                aria-invalid={fieldErrors.description ? true : undefined}
                className="service-admin-description-textarea"
                value={description}
                rows={4}
                placeholder="Describe what this service covers, who it is for, the expected delivery outcome, and any important scope notes."
                onChange={(event) => {
                  clearFieldError('description')
                  setDescription(event.target.value)
                }}
              />
            </Field>
            <div className="service-admin-form-grid">
              <Field label="Fulfillment mode" required error={fieldErrors.fulfilmentMode}>
                <DropdownSelect
                  options={FULFILLMENT_MODE_OPTIONS}
                  value={fulfilmentMode}
                  invalid={Boolean(fieldErrors.fulfilmentMode)}
                  containerRef={(node) => {
                    fieldRefs.current.fulfilmentMode = node
                  }}
                  onChange={(value) => {
                    clearFieldError('fulfilmentMode')
                    setFulfilmentMode(value)
                  }}
                />
              </Field>
              <Field label="Specialized domain" error={fieldErrors.specializedDomain}>
                <DropdownSelect
                  options={[...SPECIALIZED_DOMAIN_OPTIONS]}
                  value={specializedDomain}
                  invalid={Boolean(fieldErrors.specializedDomain)}
                  containerRef={(node) => {
                    registerFieldRef(fieldRefs, 'specializedDomain', node)
                  }}
                  onChange={(value) => {
                    clearFieldError('specializedDomain')
                    setSpecializedDomain(value)
                    if (!value) setSpecializedRequestContext('')
                  }}
                />
              </Field>
            </div>
            {specializedDomain ? (
              <Field
                label="Request context"
                full
                error={fieldErrors.specializedRequestContext}
              >
                <input
                  ref={(node) => {
                    registerFieldRef(fieldRefs, 'specializedRequestContext', node)
                  }}
                  value={specializedRequestContext}
                  placeholder="e.g. property_sale, estate_management"
                  onChange={(event) => {
                    clearFieldError('specializedRequestContext')
                    setSpecializedRequestContext(event.target.value)
                  }}
                />
              </Field>
            ) : null}
          </>
        ) : null}

        {currentStage === 'pricing' ? (
          <div className="service-admin-form-grid">
            <Field label="Pricing method" required error={fieldErrors.pricingMethod}>
              <DropdownSelect
                placeholder="Select pricing method"
                options={PRICING_METHOD_OPTIONS_CREATE}
                value={pricingMethod}
                invalid={Boolean(fieldErrors.pricingMethod)}
                containerRef={(node) => {
                  fieldRefs.current.pricingMethod = node
                }}
                onChange={(value) => {
                  clearFieldError('pricingMethod')
                  setPricingMethod(value)
                }}
              />
            </Field>
            <Field label="Base / unit price" required error={fieldErrors.rate}>
              <input
                ref={(node) => {
                  fieldRefs.current.rate = node
                }}
                aria-invalid={fieldErrors.rate ? true : undefined}
                type="number"
                min={0}
                placeholder="e.g. 100000"
                value={formatNumberFieldValue(rate)}
                onChange={(event) => {
                  clearFieldError('rate')
                  setRate(parseOptionalNumberFieldValue(event.target.value))
                }}
              />
            </Field>
            <Field label="Deposit (%)" required error={fieldErrors.depositPercent}>
              <input
                ref={(node) => {
                  fieldRefs.current.depositPercent = node
                }}
                aria-invalid={fieldErrors.depositPercent ? true : undefined}
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 70"
                value={formatNumberFieldValue(depositPercent)}
                onChange={(event) => {
                  clearFieldError('depositPercent')
                  setDepositPercent(parseOptionalNumberFieldValue(event.target.value))
                }}
              />
            </Field>
            <Field label="Tax (%)" required error={fieldErrors.taxPercent}>
              <input
                ref={(node) => {
                  fieldRefs.current.taxPercent = node
                }}
                aria-invalid={fieldErrors.taxPercent ? true : undefined}
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 7.5"
                value={formatNumberFieldValue(taxPercent)}
                onChange={(event) => {
                  clearFieldError('taxPercent')
                  setTaxPercent(parseOptionalNumberFieldValue(event.target.value))
                }}
              />
            </Field>
            <Field
              label="Discount approval above (%)"
              required
              error={fieldErrors.discountApprovalPercent}
            >
              <input
                ref={(node) => {
                  fieldRefs.current.discountApprovalPercent = node
                }}
                aria-invalid={fieldErrors.discountApprovalPercent ? true : undefined}
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 5"
                value={formatNumberFieldValue(discountApprovalPercent)}
                onChange={(event) => {
                  clearFieldError('discountApprovalPercent')
                  setDiscountApprovalPercent(parseOptionalNumberFieldValue(event.target.value))
                }}
              />
            </Field>
          </div>
        ) : null}

        {currentStage === 'request-form' ? (
          <div
            ref={(node) => {
              fieldRefs.current.requestFields = node
            }}
            tabIndex={-1}
          >
            <RequestFormBuilderPanel
              variant="embedded"
              fieldTypes={fieldTypes}
              fields={requestFields}
              onFieldsChange={(fields) => {
                clearFieldError('requestFields')
                setRequestFields(fields)
              }}
              showFormStatus={false}
              canEdit
            />
            {fieldErrors.requestFields ? (
              <small className="service-admin-field-error">{fieldErrors.requestFields}</small>
            ) : null}
          </div>
        ) : null}

        {currentStage === 'workflow' ? (
          <div
            ref={(node) => {
              fieldRefs.current.workflow = node
            }}
            tabIndex={-1}
          >
            <WorkflowDesignerPanel
              variant="embedded"
              stages={workflowStages}
              onStagesChange={(stages) => {
                clearFieldError('workflow')
                setWorkflowStages(stages)
              }}
              ownerRoles={ownerRoles}
              canEdit
            />
            {fieldErrors.workflow ? (
              <small className="service-admin-field-error">{fieldErrors.workflow}</small>
            ) : null}
          </div>
        ) : null}

        {currentStage === 'branches' ? (
          <Field
            label="Active branches"
            full
            required={status === 'active'}
            error={fieldErrors.branches}
          >
            {branchOptions.length > 0 ? (
              <div
                ref={(node) => {
                  fieldRefs.current.branches = node
                }}
                tabIndex={-1}
                className="service-admin-check-grid service-admin-check-grid--branches"
              >
                {branchOptions.map((branch) => (
                  <label key={branch.id} className="service-admin-check-option">
                    <input
                      type="checkbox"
                      checked={effectiveSelectedBranchIds.includes(branch.id)}
                      onChange={(event) => {
                        clearFieldError('branches')
                        setSelectedBranchIds((current) =>
                          event.target.checked
                            ? [...current, branch.id]
                            : current.filter((item) => item !== branch.id),
                        )
                      }}
                    />
                    {branch.name}
                  </label>
                ))}
              </div>
            ) : (
              <div className="service-admin-notice service-admin-notice-blue">
                No active branches are available yet. You can save this service as a draft and add
                branches before publishing. Publishing requires at least one active branch.
              </div>
            )}

            {branchOptions.length > 0 && effectiveSelectedBranchIds.length === 0 ? (
              <div className="service-admin-notice service-admin-notice-blue">
                No branch selected. This is allowed for Draft or Paused services. Select at least
                one branch before choosing Active / Publish.
              </div>
            ) : null}
          </Field>
        ) : null}

        {currentStage === 'review' ? (
          <>
            <div className="service-admin-form-grid service-admin-publish-grid">
              {access.publish ? (
                <Field label="Status" required error={fieldErrors.status}>
                  <DropdownSelect
                    options={
                      canPublishActive
                        ? SERVICE_STATUS_OPTIONS_WITH_PUBLISH
                        : SERVICE_STATUS_OPTIONS.filter((option) => option.value !== 'active')
                    }
                    value={status}
                    invalid={Boolean(fieldErrors.status)}
                    containerRef={(node) => {
                      fieldRefs.current.status = node
                    }}
                    onChange={(value) => {
                      clearFieldError('status')
                      setStatus(value as typeof status)
                    }}
                  />
                </Field>
              ) : null}
              <Field label="Client visibility" required error={fieldErrors.clientVisibility}>
                <DropdownSelect
                  options={CLIENT_VISIBILITY_OPTIONS_VALUE}
                  value={clientVisibility}
                  invalid={Boolean(fieldErrors.clientVisibility)}
                  containerRef={(node) => {
                    fieldRefs.current.clientVisibility = node
                  }}
                  onChange={(value) => {
                    clearFieldError('clientVisibility')
                    setClientVisibility(value as typeof clientVisibility)
                  }}
                />
              </Field>
            </div>
            <div className="service-admin-notice service-admin-notice-green">
              <b>Ready to create.</b> This setup will submit the sections available for your role.
            </div>

            {progress.length > 0 ? (
              <div className="service-admin-card">
                <div className="service-admin-card-header">
                  <div>
                    <div className="service-admin-card-title">Setup progress</div>
                    <div className="service-admin-card-subtitle">
                      {setupServiceId ? `Service #${setupServiceId}` : 'Creating Service'}
                    </div>
                  </div>
                  <strong>{progressPercent}%</strong>
                </div>
                <progress max={100} value={progressPercent} style={{ width: '100%' }} />
                <div className="service-admin-stack">
                  {progress.map((item) => (
                    <div key={item.id} className="service-admin-row">
                      <div>
                        <b>
                          {symbol(item.state)} {item.label}
                        </b>
                        {item.error ? (
                          <div className="service-admin-row-subtitle">{item.error}</div>
                        ) : null}
                      </div>
                      <span>{item.state}</span>
                    </div>
                  ))}
                </div>
                {retryable.length > 0 && onRetryFailed ? (
                  <button
                    type="button"
                    className="service-admin-button service-admin-button-primary"
                    disabled={pending}
                    onClick={onRetryFailed}
                  >
                    {pending ? 'Retrying…' : 'Retry failed setup'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </ModalShell>
    </>
  )
}

export function ConfigureServiceWorkspace({
  service,
  calculator,
  requestForm,
  workflow,
  branches: branchOptions = [],
  ownerRoles = [],
  fieldTypes = [],
  pending,
  onClose,
  onSave,
  readOnly = false,
}: {
  service: ServiceCatalogueItem
  calculator?: PricingCalculator
  requestForm?: ServiceRequestForm
  workflow?: ServiceWorkflow
  branches?: Array<{ id: number; name: string; code: string }>
  ownerRoles?: WorkflowOwnerRoleOption[]
  fieldTypes?: RequestFieldTypeOption[]
  pending: boolean
  onClose: () => void
  onSave?: (input: ConfigureServiceInput) => void
  readOnly?: boolean
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(service.name)
  const [code, setCode] = useState(service.code)
  const [description, setDescription] = useState(service.description)
  const [slaDays, setSlaDays] = useState(service.slaDays ?? 5)
  const [fulfilmentMode, setFulfilmentMode] = useState(
    service.fulfilmentMode ?? 'Quick service order',
  )
  const [specializedDomain, setSpecializedDomain] = useState(service.specializedDomain ?? '')
  const [specializedRequestContext, setSpecializedRequestContext] = useState(() =>
    readSpecializedRequestContext(service.specializedConfig),
  )
  const [pricingMethod, setPricingMethod] = useState(
    calculator?.charges.some((charge) => charge.kind === 'formula') ? 'Custom formula' : 'Fixed',
  )
  const [rate, setRate] = useState(
    typeof calculator?.charges.find((charge) => charge.kind === 'fixed')?.value === 'number'
      ? Number(calculator?.charges.find((charge) => charge.kind === 'fixed')?.value)
      : Math.max(0, calculator?.sampleTotal ?? 100000),
  )
  const [depositPercent, setDepositPercent] = useState(() => {
    const value = calculator?.charges.find((charge) =>
      charge.label.toLowerCase().includes('deposit'),
    )?.value
    return typeof value === 'number' ? value : 70
  })
  const [taxPercent, setTaxPercent] = useState(() => {
    const value = calculator?.charges.find((charge) =>
      charge.label.toLowerCase().includes('tax'),
    )?.value
    return typeof value === 'number' ? value : 0
  })
  const [discountApprovalPercent, setDiscountApprovalPercent] = useState(() => {
    const value = calculator?.charges.find((charge) =>
      charge.label.toLowerCase().includes('discount'),
    )?.value
    return typeof value === 'number' ? value : 5
  })
  const [requestFields, setRequestFields] = useState<RequestFormField[]>(() =>
    requestForm?.fields.length
      ? requestForm.fields.map((field) => ({ ...field }))
      : labelsToRequestFields(service.requestFields ?? []),
  )
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>(() =>
    workflow?.stages.length
      ? cloneStages(workflow.stages)
      : buildStagesForService(service, workflow, ownerRoles),
  )
  const [selectedBranches, setSelectedBranches] = useState<string[]>(
    service.branchNames.length
      ? [...service.branchNames]
      : branchOptions.map((branch) => branch.name),
  )
  const [status, setStatus] = useState(service.status)
  const [clientVisibility, setClientVisibility] = useState('Visible in catalogue')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ServiceWizardFieldErrors>({})
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const errorNoticeRef = useRef<HTMLDivElement | null>(null)

  const buildPayload = (): ConfigureServiceInput => ({
    id: service.id,
    name: name.trim(),
    code: code.trim(),
    owner: service.owner,
    description: description.trim(),
    slaDays,
    fulfilmentMode,
    status,
    branchNames: selectedBranches,
    specializedDomain: specializedDomain || null,
    specializedConfig: specializedDomain
      ? { ...(specializedRequestContext.trim() ? { request_context: specializedRequestContext.trim() } : {}) }
      : {},
    pricing: {
      method: pricingMethod,
      rate,
      depositPercent,
      taxPercent,
      discountApprovalPercent,
    },
    requestFields,
    workflowStages: workflowStages.map((stage, index) => ({ ...stage, order: index + 1 })),
  })

  const clearFieldError = (field: ServiceWizardFieldName) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const failValidation = (message: string, field?: ServiceWizardFieldName) => {
    setError(message)
    setFieldErrors(field ? { [field]: message } : {})
    if (field) {
      focusField(fieldRefs, field)
      return
    }
    focusNotice(errorNoticeRef)
  }

  const validateStep = (
    index: number,
  ): { message: string; field?: ServiceWizardFieldName } | null => {
    if (index === 0) {
      if (!name.trim()) return { message: 'Service name is required.', field: 'name' }
      if (!code.trim()) return { message: 'Service code is required.', field: 'code' }
      if (!description.trim()) return { message: 'Description is required.', field: 'description' }
      if (!Number.isFinite(slaDays) || slaDays < 1) {
        return { message: 'SLA must be at least 1 day.', field: 'slaDays' }
      }
      if (!fulfilmentMode.trim()) {
        return { message: 'Fulfillment mode is required.', field: 'fulfilmentMode' }
      }
      return null
    }
    if (index === 1) {
      if (!pricingMethod.trim()) {
        return { message: 'Pricing method is required.', field: 'pricingMethod' }
      }
      if (!Number.isFinite(rate) || rate < 0) {
        return { message: 'Base / unit price is required.', field: 'rate' }
      }
      if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) {
        return { message: 'Deposit (%) must be between 0 and 100.', field: 'depositPercent' }
      }
      if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
        return { message: 'Tax (%) must be between 0 and 100.', field: 'taxPercent' }
      }
      if (
        !Number.isFinite(discountApprovalPercent) ||
        discountApprovalPercent < 0 ||
        discountApprovalPercent > 100
      ) {
        return {
          message: 'Discount approval (%) must be between 0 and 100.',
          field: 'discountApprovalPercent',
        }
      }
      return null
    }
    if (index === 2 && requestFields.length === 0) {
      return { message: 'Select at least one request form field.', field: 'requestFields' }
    }
    if (index === 3 && workflowStages.length === 0) {
      return { message: 'Add at least one workflow stage.', field: 'workflow' }
    }
    if (index === 4 && selectedBranches.length === 0) {
      return { message: 'Select at least one active branch.', field: 'branches' }
    }
    return null
  }

  const save = () => {
    for (let index = 0; index < configureWizardSteps.length; index += 1) {
      const validationError = validateStep(index)
      if (validationError) {
        setStep(index)
        failValidation(validationError.message, validationError.field)
        return
      }
    }
    setError('')
    setFieldErrors({})
    if (!onSave) return
    onSave(buildPayload())
  }

  const next = () => {
    const validationError = validateStep(step)
    if (validationError) {
      failValidation(validationError.message, validationError.field)
      return
    }
    setError('')
    setFieldErrors({})
    if (step === configureWizardSteps.length - 1) {
      save()
      return
    }
    setStep((current) => Math.min(configureWizardSteps.length - 1, current + 1))
  }

  return (
    <>
      <ModalShell
        title={readOnly ? service.name : `Configure ${service.name}`}
        wide
        variant="wizard"
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              className="service-admin-button service-admin-wizard-nav-btn"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="service-admin-button service-admin-wizard-nav-btn"
              disabled={step === 0 || pending}
              onClick={() => {
                setError('')
                setStep((current) => Math.max(0, current - 1))
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="service-admin-button service-admin-wizard-nav-btn"
              disabled={step === configureWizardSteps.length - 1 || pending}
              onClick={next}
            >
              Next
            </button>
            {!readOnly ? (
              <button
                type="button"
                className="service-admin-button service-admin-button-primary service-admin-wizard-nav-btn service-admin-wizard-nav-btn--primary"
                disabled={pending}
                onClick={save}
              >
                {pending ? 'Saving…' : 'Save Configuration'}
              </button>
            ) : null}
          </>
        }
      >
        <div
          className="service-admin-wizard-steps"
          role="tablist"
          aria-label="Configure service steps"
        >
          {configureWizardSteps.map((item, index) => {
            const isActive = index === step
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={pending}
                className={[
                  'service-admin-wizard-step',
                  'service-admin-wizard-step--reachable',
                  isActive
                    ? 'service-admin-wizard-step--active'
                    : 'service-admin-wizard-step--complete',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setError('')
                  setStep(index)
                }}
              >
                {index + 1}. {item}
              </button>
            )
          })}
        </div>

        {error ? (
          <div
            ref={errorNoticeRef}
            tabIndex={-1}
            className="service-admin-notice service-admin-notice-red"
          >
            {error}
          </div>
        ) : null}

        {readOnly ? (
          <div className="service-admin-notice service-admin-notice-blue">
            This service view is currently read-only. Use the dedicated setup screens to update its
            configuration, pricing, workflow, request form, or branch activation.
          </div>
        ) : null}

        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {step === 0 ? (
            <>
              <div className="service-admin-form-grid">
                <Field label="Service name" required error={fieldErrors.name}>
                  <input
                    ref={(node) => {
                      fieldRefs.current.name = node
                    }}
                    aria-invalid={fieldErrors.name ? true : undefined}
                    value={name}
                    required
                    onChange={(event) => {
                      clearFieldError('name')
                      setName(event.target.value)
                    }}
                  />
                </Field>
                <Field label="Service code" required error={fieldErrors.code}>
                  <input
                    ref={(node) => {
                      fieldRefs.current.code = node
                    }}
                    aria-invalid={fieldErrors.code ? true : undefined}
                    value={code}
                    required
                    onChange={(event) => {
                      clearFieldError('code')
                      setCode(event.target.value)
                    }}
                  />
                </Field>
                <Field label="SLA (days)" required error={fieldErrors.slaDays}>
                  <input
                    ref={(node) => {
                      fieldRefs.current.slaDays = node
                    }}
                    aria-invalid={fieldErrors.slaDays ? true : undefined}
                    type="number"
                    min={1}
                    required
                    value={formatNumberFieldValue(slaDays)}
                    onChange={(event) => {
                      clearFieldError('slaDays')
                      setSlaDays(parseNumberFieldValue(event.target.value))
                    }}
                  />
                </Field>
              </div>
              <Field label="Description" required error={fieldErrors.description}>
                <textarea
                  ref={(node) => {
                    fieldRefs.current.description = node
                  }}
                  aria-invalid={fieldErrors.description ? true : undefined}
                  className="service-admin-description-textarea"
                  value={description}
                  required
                  rows={4}
                  placeholder="Describe what this service covers, who it is for, the expected delivery outcome, and any important scope notes."
                  onChange={(event) => {
                    clearFieldError('description')
                    setDescription(event.target.value)
                  }}
                />
              </Field>
              <div className="service-admin-form-grid">
                <Field label="Fulfillment mode" required error={fieldErrors.fulfilmentMode}>
                  <DropdownSelect
                    options={FULFILLMENT_MODE_OPTIONS}
                    value={fulfilmentMode}
                    invalid={Boolean(fieldErrors.fulfilmentMode)}
                    containerRef={(node) => {
                      fieldRefs.current.fulfilmentMode = node
                    }}
                    onChange={(value) => {
                      clearFieldError('fulfilmentMode')
                      setFulfilmentMode(value)
                    }}
                  />
                </Field>
                <Field label="Specialized domain" error={fieldErrors.specializedDomain}>
                  <DropdownSelect
                    options={[...SPECIALIZED_DOMAIN_OPTIONS]}
                    value={specializedDomain}
                    invalid={Boolean(fieldErrors.specializedDomain)}
                    containerRef={(node) => {
                      registerFieldRef(fieldRefs, 'specializedDomain', node)
                    }}
                    onChange={(value) => {
                      clearFieldError('specializedDomain')
                      setSpecializedDomain(value)
                      if (!value) setSpecializedRequestContext('')
                    }}
                  />
                </Field>
              </div>
              {specializedDomain ? (
                <Field
                  label="Request context"
                  full
                  error={fieldErrors.specializedRequestContext}
                >
                  <input
                    ref={(node) => {
                      registerFieldRef(fieldRefs, 'specializedRequestContext', node)
                    }}
                    value={specializedRequestContext}
                    placeholder="e.g. property_sale, estate_management"
                    onChange={(event) => {
                      clearFieldError('specializedRequestContext')
                      setSpecializedRequestContext(event.target.value)
                    }}
                  />
                </Field>
              ) : null}
            </>
          ) : null}

          {step === 1 ? (
            <div className="service-admin-form-grid">
              <Field label="Pricing method" required error={fieldErrors.pricingMethod}>
                <DropdownSelect
                  options={PRICING_METHOD_OPTIONS_CONFIGURE}
                  value={pricingMethod}
                  invalid={Boolean(fieldErrors.pricingMethod)}
                  containerRef={(node) => {
                    fieldRefs.current.pricingMethod = node
                  }}
                  onChange={(value) => {
                    clearFieldError('pricingMethod')
                    setPricingMethod(value)
                  }}
                />
              </Field>
              <Field label="Base / unit price" required error={fieldErrors.rate}>
                <input
                  ref={(node) => {
                    fieldRefs.current.rate = node
                  }}
                  aria-invalid={fieldErrors.rate ? true : undefined}
                  type="number"
                  min={0}
                  required
                  value={formatNumberFieldValue(rate)}
                  onChange={(event) => {
                    clearFieldError('rate')
                    setRate(parseNumberFieldValue(event.target.value))
                  }}
                />
              </Field>
              <Field label="Deposit (%)" required error={fieldErrors.depositPercent}>
                <input
                  ref={(node) => {
                    fieldRefs.current.depositPercent = node
                  }}
                  aria-invalid={fieldErrors.depositPercent ? true : undefined}
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={formatNumberFieldValue(depositPercent)}
                  onChange={(event) => {
                    clearFieldError('depositPercent')
                    setDepositPercent(parseNumberFieldValue(event.target.value))
                  }}
                />
              </Field>
              <Field label="Tax (%)" required error={fieldErrors.taxPercent}>
                <input
                  ref={(node) => {
                    fieldRefs.current.taxPercent = node
                  }}
                  aria-invalid={fieldErrors.taxPercent ? true : undefined}
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={formatNumberFieldValue(taxPercent)}
                  onChange={(event) => {
                    clearFieldError('taxPercent')
                    setTaxPercent(parseNumberFieldValue(event.target.value))
                  }}
                />
              </Field>
              <Field
                label="Discount approval above (%)"
                required
                error={fieldErrors.discountApprovalPercent}
              >
                <input
                  ref={(node) => {
                    fieldRefs.current.discountApprovalPercent = node
                  }}
                  aria-invalid={fieldErrors.discountApprovalPercent ? true : undefined}
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={formatNumberFieldValue(discountApprovalPercent)}
                  onChange={(event) => {
                    clearFieldError('discountApprovalPercent')
                    setDiscountApprovalPercent(parseNumberFieldValue(event.target.value))
                  }}
                />
              </Field>
            </div>
          ) : null}

          {step === 2 ? (
            <div
              ref={(node) => {
                fieldRefs.current.requestFields = node
              }}
              tabIndex={-1}
            >
              <RequestFormBuilderPanel
                variant="embedded"
                fieldTypes={fieldTypes}
                fields={requestFields}
                onFieldsChange={(fields) => {
                  clearFieldError('requestFields')
                  setRequestFields(fields)
                }}
                showFormStatus={false}
                canEdit={!readOnly}
              />
              {fieldErrors.requestFields ? (
                <small className="service-admin-field-error">{fieldErrors.requestFields}</small>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div
              ref={(node) => {
                fieldRefs.current.workflow = node
              }}
              tabIndex={-1}
            >
              <WorkflowDesignerPanel
                variant="embedded"
                stages={workflowStages}
                onStagesChange={(stages) => {
                  clearFieldError('workflow')
                  setWorkflowStages(stages)
                }}
                ownerRoles={ownerRoles}
                canEdit={!readOnly}
              />
              {fieldErrors.workflow ? (
                <small className="service-admin-field-error">{fieldErrors.workflow}</small>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <Field label="Active branches" full required error={fieldErrors.branches}>
              <div
                ref={(node) => {
                  fieldRefs.current.branches = node
                }}
                tabIndex={-1}
                className="service-admin-check-grid service-admin-check-grid--branches"
              >
                {branchOptions.map((branch) => (
                  <label key={branch.id} className="service-admin-check-option">
                    <input
                      type="checkbox"
                      checked={selectedBranches.includes(branch.name)}
                      onChange={(event) => {
                        clearFieldError('branches')
                        setSelectedBranches((current) =>
                          event.target.checked
                            ? [...current, branch.name]
                            : current.filter((item) => item !== branch.name),
                        )
                      }}
                    />
                    {branch.name}
                  </label>
                ))}
              </div>
            </Field>
          ) : null}

          {step === 5 ? (
            <div className="service-admin-form-grid service-admin-publish-grid">
              <Field label="Status" required error={fieldErrors.status}>
                <DropdownSelect
                  options={SERVICE_STATUS_OPTIONS}
                  value={status}
                  invalid={Boolean(fieldErrors.status)}
                  containerRef={(node) => {
                    fieldRefs.current.status = node
                  }}
                  onChange={(value) => {
                    clearFieldError('status')
                    setStatus(value as typeof status)
                  }}
                />
              </Field>
              <Field label="Client visibility" required error={fieldErrors.clientVisibility}>
                <DropdownSelect
                  options={CLIENT_VISIBILITY_OPTIONS_LABEL}
                  value={clientVisibility}
                  invalid={Boolean(fieldErrors.clientVisibility)}
                  containerRef={(node) => {
                    fieldRefs.current.clientVisibility = node
                  }}
                  onChange={(value) => {
                    clearFieldError('clientVisibility')
                    setClientVisibility(value)
                  }}
                />
              </Field>
            </div>
          ) : null}
        </fieldset>
      </ModalShell>
    </>
  )
}
