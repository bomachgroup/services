import {
  IconChevronRight,
  IconEyeCheck,
  IconMapPin,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { presentError } from '@/shared/errors'
import { formatCurrency } from '@/shared/lib/formatters'
import { formatNumberFieldValue, parseNumberFieldValue } from '@/shared/lib/number-input'
import { DatePicker } from '@/shared/ui/date-picker'
import { GroupedNumberInput } from '@/shared/ui/grouped-number-input'
import { useToast } from '@/shared/ui/toast/useToast'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'
import { realEstateQueries } from '@/modules/specialized-services/real-estate/real-estate.queries'

import { serviceRequestsApi } from '../api/service-requests.api'
import { getServiceRequestCapabilities } from '../api/service-request-capabilities'
import type {
  CreateDirectInvoiceInput,
  CreateServiceRequestActivityInput,
  CreateServiceRequestAttachmentInput,
  EmployeeOption,
  ServiceRequestChoices,
  ServiceRequestDetail,
  ServiceRequestStatus,
  UpdateServiceRequestInput,
} from '../api/service-requests.types'

import { FileTypeIcon } from '../request-intake/file-presentation'
import {
  DocumentPreviewModal,
  FileDocumentRow,
  type PreviewDocument,
} from '../request-intake/DocumentPreviewModal'
import { CalculatorEstimateBlock } from '../request-intake/CalculatorEstimateBlock'
import { QuotationItemsEditor } from '../components/QuotationItemsEditor'
import type { QuotationItem, QuotationPaymentTiming } from '../quotation/quotation.types'
import { quotationPaymentTimingLabels } from '../quotation/quotation-item.utils'
import type { EngineeringCategoryOption } from '../api/calculator-estimate.types'
import {
  collectFileAnswerUrls,
  fileNameFromUrl,
  formatBytes,
} from '../request-intake/file-presentation.utils'
import { IntakeMultiselectAnswer } from '../request-intake/IntakeAnswerDisplay'
import { commercialEmptyLabel } from '../lib/commercial-source-context'

function statusClass(status: string) {
  if (status === 'rejected') return 'commercial-pill-gray'
  if (status === 'quoted' || status === 'converted') return 'commercial-pill-green'
  if (status === 'awaiting_client' || status === 'site_assessment') {
    return 'commercial-pill-yellow'
  }
  return 'commercial-pill-blue'
}

type AttachmentUploadStatus = 'uploading' | 'uploaded' | 'error'

interface PendingAttachmentUpload {
  file: File
  fileName: string
  fileSizeBytes: number
  contentType: string
  fileUrl: string
  status: AttachmentUploadStatus
  error: string
}

function renderAnswerValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return value || '—'
  if (typeof value === 'number') return String(value)
  return '—'
}

function normalizeAttachmentText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function normalizeIntakeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isMirrorAnswer(answer: { fieldKey: string; label: string }) {
  const token = normalizeIntakeToken(`${answer.fieldKey} ${answer.label}`)
  if (!token) return false
  if (token.includes('client identity') || token.includes('client name')) return true
  if (token.includes('phone') || token.includes('email')) return true
  if (token.includes('customer type')) return true
  if (token === 'budget' || token.endsWith(' budget')) return true
  if (token.includes('preferred date')) return true
  if (
    token.includes('scope message') ||
    token.includes('scope details') ||
    token.includes('scope summary') ||
    token === 'scope' ||
    token.includes('request details') ||
    token === 'message' ||
    token.includes('scope or message')
  ) {
    return true
  }
  return false
}

function settlementModeLabel(mode: string) {
  if (mode === 'reservation') return 'Reservation'
  if (mode === 'installment') return 'Installment plan'
  if (mode === 'full_payment') return 'Full payment'
  return mode.replaceAll('_', ' ') || 'Full payment'
}

function feeTimingLabel(timing: string) {
  if (timing === 'upfront') return 'Due upfront'
  if (timing === 'deferred') return 'Deferred'
  if (timing === 'deposit_based') return 'Deposit based'
  return timing.replaceAll('_', ' ')
}

function assetTypeLabel(assetType: string) {
  if (assetType === 'brokerage_listing') return 'Brokerage listing'
  if (assetType === 'property') return 'Property'
  return assetType.replaceAll('_', ' ')
}

function describeReservationHold(iso: string | null): { when: string; expired: boolean } | null {
  if (!iso) return null
  const at = new Date(iso)
  if (!Number.isFinite(at.getTime())) return null
  return { when: at.toLocaleString('en-GB'), expired: at.getTime() < Date.now() }
}

interface TriageAction {
  status: ServiceRequestStatus
  label: string
  hint?: string
  nextAction: string
  quiet?: boolean
}

const TRIAGE_ACTION_ICONS: Record<string, typeof IconX> = {
  under_review: IconEyeCheck,
  site_assessment: IconMapPin,
}

const TRIAGE_ACTIONS: Record<string, TriageAction[]> = {
  new: [
    {
      status: 'under_review',
      label: 'Mark Under Review',
      hint: 'Acknowledge this request and start triage',
      nextAction: 'Review intake and confirm service scope',
    },
    {
      status: 'site_assessment',
      label: 'Schedule Assessment',
      hint: 'Book a site visit before quoting',
      nextAction: 'Attend assessment and record findings',
    },
  ],
  under_review: [
    {
      status: 'site_assessment',
      label: 'Schedule Assessment',
      hint: 'Book a site visit before quoting',
      nextAction: 'Attend assessment and record findings',
    },
    { status: 'new', label: 'Move Back to New', nextAction: 'Awaiting triage', quiet: true },
  ],
  site_assessment: [
    {
      status: 'under_review',
      label: 'Assessment Complete',
      hint: 'Record findings and continue to estimate',
      nextAction: 'Record assessment findings and estimate',
    },
  ],
  // Escape hatch for records stranded in awaiting_client from when it was
  // hand-pickable. Awaiting client is never offered as a forward destination:
  // the quotation send owns that signal via the quoted state.
  awaiting_client: [
    {
      status: 'under_review',
      label: 'Return to Under Review',
      nextAction: 'Returned to review from awaiting client',
    },
  ],
}

export function ServiceRequestDetailWorkspace({
  request,
  choices,
  employees,
  saving,
  activitySaving,
  attachmentSaving,
  estimating = false,
  estimateError = '',
  categories = [],
  categoriesLoading = false,
  unitPrice = null,
  onClose,
  onUpdate,
  onActivity,
  onAttachment,
  onPrepareQuotation,
  onCreateInvoice,
  onEstimate,
  onEstimateStale,
}: {
  request: ServiceRequestDetail
  choices: ServiceRequestChoices
  employees: EmployeeOption[]
  saving: boolean
  activitySaving: boolean
  attachmentSaving: boolean
  estimating?: boolean
  estimateError?: string
  categories?: EngineeringCategoryOption[]
  categoriesLoading?: boolean
  unitPrice?: number | null
  onClose: () => void
  onUpdate: (input: UpdateServiceRequestInput) => void
  onActivity: (input: CreateServiceRequestActivityInput) => void
  onAttachment: (input: CreateServiceRequestAttachmentInput) => void
  onPrepareQuotation: () => void
  onCreateInvoice: (input: CreateDirectInvoiceInput) => void
  onEstimate?: (inputs: Record<string, unknown>) => Promise<void>
  onEstimateStale?: (stale: boolean, inputs: Record<string, unknown>) => void
}) {
  const toast = useToast()
  const [activityOpen, setActivityOpen] = useState(false)
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const [estimateStale, setEstimateStale] = useState(false)
  const [rejectArmed, setRejectArmed] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachmentUpload | null>(null)
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null)
  const [planSaving, setPlanSaving] = useState<'full_payment' | 'installment' | null>(null)
  // Direct-invoice billing draft. Null extras = pristine from the request;
  // numbers reset whenever the server record changes.
  const [billingExtras, setBillingExtras] = useState<QuotationItem[] | null>(null)
  const [billingDiscount, setBillingDiscount] = useState(request.directDiscount)
  const [billingTaxRate, setBillingTaxRate] = useState(request.directTaxRate)
  const [billingThreshold, setBillingThreshold] = useState(request.directThreshold)
  const [billingDueDate, setBillingDueDate] = useState(() => {
    const at = new Date()
    at.setDate(at.getDate() + 14)
    return at.toISOString().slice(0, 10)
  })
  const [billingInstructions, setBillingInstructions] = useState('')
  // Reset the billing draft whenever a new server record arrives.
  const billingSyncKey = `${request.id}:${request.updatedAt}:${request.directDiscount}:${request.directTaxRate}:${request.directThreshold}:${JSON.stringify(request.directExtraCharges)}`
  const [lastBillingSyncKey, setLastBillingSyncKey] = useState(billingSyncKey)
  if (lastBillingSyncKey !== billingSyncKey) {
    setLastBillingSyncKey(billingSyncKey)
    setBillingExtras(null)
    setBillingDiscount(request.directDiscount)
    setBillingTaxRate(request.directTaxRate)
    setBillingThreshold(request.directThreshold)
  }
  const uploadControllerRef = useRef<AbortController | null>(null)
  const realEstateContextQuery = useQuery(realEstateQueries.commercialContext(request.id))
  const realEstateContext = realEstateContextQuery.data
  const hasRealEstateAssets = Boolean(realEstateContext?.assets.length)

  const handleBalancePlan = async (mode: 'full_payment' | 'installment') => {
    setPlanSaving(mode)
    try {
      await serviceRequestsApi.setBalancePlan(request.id, mode)
      await realEstateContextQuery.refetch()
      toast.success(
        mode === 'installment'
          ? 'Balance plan set to installment.'
          : 'Balance plan set to full payment.',
      )
    } catch (error) {
      toast.error('Could not set balance plan.', {
        description: presentError(error, 'background-action').message,
      })
    } finally {
      setPlanSaving(null)
    }
  }

  const controlForm = useForm({
    defaultValues: {
      status: request.status,
      priority: request.priority,
      ownerId: request.ownerId ?? 0,
      budget: request.budget ?? 0,
      dueDate: request.dueDate ?? '',
      nextAction: request.nextAction,
      estimatedValue: request.estimatedValue,
      scopeSummary: request.scopeSummary,
    },
    onSubmit: ({ value }) => {
      // Flush any uncommitted direct-billing edits first (separate fields, no overlap).
      commitDirectBilling()
      onUpdate({
        status: value.status,
        priority: value.priority,
        ownerId: value.ownerId || null,
        budget: Number(value.budget || 0),
        dueDate: value.dueDate || null,
        nextAction: value.nextAction.trim(),
        estimatedValue: Number(value.estimatedValue || 0),
        scopeSummary: value.scopeSummary.trim(),
      })
    },
  })

  const activityForm = useForm({
    defaultValues: {
      activityType: choices.activityTypes[0]?.value ?? 'internal_note',
      outcome: choices.activityOutcomes[0]?.value ?? 'not_applicable',
      note: '',
      nextAction: '',
      nextFollowUpAt: '',
    },
    onSubmit: ({ value }) => {
      if (!value.note.trim()) return
      onActivity({
        activityType: value.activityType,
        outcome: value.outcome,
        note: value.note.trim(),
        nextAction: value.nextAction.trim(),
        nextFollowUpAt: value.nextFollowUpAt || null,
      })
      setActivityOpen(false)
    },
  })

  const attachmentForm = useForm({
    defaultValues: {
      label: '',
      fileName: '',
      fileUrl: '',
      contentType: '',
    },
    onSubmit: ({ value }) => {
      if (!value.fileUrl.trim()) {
        setAttachmentError('Upload a file before adding this attachment.')
        return
      }
      onAttachment({
        label: value.label.trim(),
        fileName: value.fileName.trim(),
        fileUrl: value.fileUrl.trim(),
        contentType: value.contentType.trim(),
      })
      setAttachmentError('')
      setPendingAttachment(null)
      setAttachmentOpen(false)
    },
  })

  const resetAttachmentUpload = () => {
    uploadControllerRef.current?.abort()
    uploadControllerRef.current = null
    setPendingAttachment(null)
    setAttachmentError('')
    attachmentForm.setFieldValue('fileName', '')
    attachmentForm.setFieldValue('fileUrl', '')
    attachmentForm.setFieldValue('contentType', '')
  }

  const uploadAttachmentFile = async (file: File) => {
    uploadControllerRef.current?.abort()
    const controller = new AbortController()
    uploadControllerRef.current = controller
    setAttachmentError('')

    setPendingAttachment({
      file,
      fileName: file.name,
      fileSizeBytes: file.size,
      contentType: file.type,
      fileUrl: '',
      status: 'uploading',
      error: '',
    })

    attachmentForm.setFieldValue('fileName', file.name)
    attachmentForm.setFieldValue('contentType', file.type)

    if (!attachmentForm.state.values.label.trim()) {
      const baseName = file.name.replace(/\.[^.]+$/, '')
      attachmentForm.setFieldValue('label', baseName)
    }

    try {
      const fileUrl = await serviceRequestsApi.uploadFile(file, controller.signal)
      setPendingAttachment({
        file,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type,
        fileUrl,
        status: 'uploaded',
        error: '',
      })
      attachmentForm.setFieldValue('fileUrl', fileUrl)
    } catch (uploadError) {
      if (controller.signal.aborted) return
      const message = presentError(uploadError, 'background-action').message
      setPendingAttachment({
        file,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type,
        fileUrl: '',
        status: 'error',
        error: message,
      })
      attachmentForm.setFieldValue('fileUrl', '')
      setAttachmentError(message)
      toast.error('Document upload failed', { description: message })
    } finally {
      if (uploadControllerRef.current === controller) {
        uploadControllerRef.current = null
      }
    }
  }

  const retryAttachmentUpload = () => {
    if (!pendingAttachment) return
    void uploadAttachmentFile(pendingAttachment.file)
  }

  const capabilities = getServiceRequestCapabilities(request)
  const showCalculatorBlock =
    request.pricingMode === 'calculator' && request.calculatorCode.trim() !== ''
  const canPrepareQuotation = capabilities.canPrepareQuotation && !estimateStale
  const canCreateInvoice = capabilities.canCreateInvoiceDirect && !estimateStale
  const isDirectPath = request.commercialPath === 'direct_invoice'
  const directBillingEditable =
    isDirectPath &&
    showCalculatorBlock &&
    request.quoteId == null &&
    (request.status === 'new' ||
      request.status === 'under_review' ||
      request.status === 'awaiting_client' ||
      request.status === 'site_assessment')

  const toEditorItem = (
    row: {
      description: string
      quantity: number
      unitPrice: number
      paymentTiming: string
      sourceContext: Record<string, unknown>
      sortOrder: number
    },
    index: number,
  ): QuotationItem => {
    const timing = (['upfront', 'deferred', 'deposit_based'] as const).includes(
      row.paymentTiming as QuotationPaymentTiming,
    )
      ? (row.paymentTiming as QuotationPaymentTiming)
      : 'upfront'
    return {
      description: row.description,
      kind: 'additional_charge',
      kindDisplay: 'Additional Charge',
      paymentTiming: timing,
      paymentTimingDisplay: quotationPaymentTimingLabels[timing],
      quantity: row.quantity || 1,
      unitPrice: row.unitPrice,
      total: Math.round((row.quantity || 1) * row.unitPrice * 100) / 100,
      sourceContext: row.sourceContext ?? {},
      sortOrder: row.sortOrder ?? (index + 1) * 10,
    }
  }

  const billingPrimaryItem: QuotationItem = {
    description: request.serviceName,
    kind: 'primary',
    kindDisplay: 'Primary Item',
    paymentTiming: 'deposit_based',
    paymentTimingDisplay: quotationPaymentTimingLabels.deposit_based,
    quantity: 1,
    unitPrice: request.estimatedValue,
    total: request.estimatedValue,
    sourceContext: {},
    sortOrder: 0,
  }
  const billingItems: QuotationItem[] = [
    billingPrimaryItem,
    ...(billingExtras ?? request.directExtraCharges.map((row, index) => toEditorItem(row, index))),
  ]
  const billingExtrasTotal = billingItems
    .filter((item) => item.kind !== 'primary')
    .reduce((sum, item) => sum + item.total, 0)
  const billingSubtotal = request.estimatedValue + billingExtrasTotal
  const billingTaxable = Math.max(0, billingSubtotal - (Number(billingDiscount) || 0))
  const billingTax = Math.round(billingTaxable * (Number(billingTaxRate) || 0)) / 100
  const billingTotal = Math.round((billingTaxable + billingTax) * 100) / 100

  const commitDirectBilling = () => {
    const extras = billingItems
      .filter((item) => item.kind !== 'primary')
      .map((item, index) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        paymentTiming: item.paymentTiming,
        sourceContext: item.sourceContext ?? {},
        sortOrder: (index + 1) * 10,
      }))
    const snapshot = JSON.stringify({
      extras,
      discount: Number(billingDiscount) || 0,
      taxRate: Number(billingTaxRate) || 0,
      threshold: Number(billingThreshold) || 0,
    })
    const current = JSON.stringify({
      extras: request.directExtraCharges,
      discount: Number(request.directDiscount) || 0,
      taxRate: Number(request.directTaxRate) || 0,
      threshold: Number(request.directThreshold) || 0,
    })
    if (snapshot === current) return
    onUpdate({
      directExtraCharges: extras,
      directDiscount: Number(billingDiscount) || 0,
      directTaxRate: Number(billingTaxRate) || 0,
      directThreshold: Number(billingThreshold) || 0,
    })
  }

  const submitDirectInvoice = () => {
    if (!billingDueDate) {
      toast.error('Due date is required to create the invoice.')
      return
    }
    commitDirectBilling()
    onCreateInvoice({
      dueDate: billingDueDate,
      paymentInstructions: billingInstructions.trim(),
      billing: {
        extraCharges: billingItems
          .filter((item) => item.kind !== 'primary')
          .map((item) => ({
            description: item.description.trim(),
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            paymentTiming: item.paymentTiming,
          })),
        discount: Number(billingDiscount) || 0,
        taxRate: Number(billingTaxRate) || 0,
        threshold: Number(billingThreshold) || 0,
      },
    })
  }
  const showEstimateGateNotice =
    capabilities.canPrepareQuotation && showCalculatorBlock && estimateStale
  const controlPanelReadOnly =
    !capabilities.canEditControlPanel ||
    (capabilities.controlPanelLocked && !capabilities.mobilisationReady)
  const statusPriorityReadOnly =
    !capabilities.canEditControlPanel || capabilities.controlPanelLocked
  const canSaveControlPanel = capabilities.canEditControlPanel && !controlPanelReadOnly
  const isStatusTriage =
    capabilities.allowedStatuses == null &&
    request.status !== 'converted' &&
    request.status !== 'rejected'
  const triageActions = isStatusTriage ? (TRIAGE_ACTIONS[request.status] ?? []) : []
  const triageBusy = saving || !capabilities.canEditControlPanel
  // Post-quote records faked into quoted/awaiting_client before the manual
  // blackout have no quotation behind them — offer a single way back.
  const showUnstrandHatch =
    !isStatusTriage &&
    (request.status === 'quoted' || request.status === 'awaiting_client') &&
    request.quoteId == null

  const applyStatusAction = (next: ServiceRequestStatus, nextActionText: string) => {
    if (triageBusy) return
    // Keep the control form in sync so a later Save Update cannot push the old
    // status back over the action just taken.
    controlForm.setFieldValue('status', next)
    controlForm.setFieldValue('nextAction', nextActionText)
    setRejectArmed(false)
    onUpdate({ status: next, nextAction: nextActionText })
  }

  const openDocumentPreview = (document: PreviewDocument) => {
    setPreviewDocument(document)
  }

  const renderAnswerContent = (answer: ServiceRequestDetail['answers'][number]) => {
    const fileUrls = collectFileAnswerUrls(answer.value, answer.fieldType)
    if (fileUrls.length > 0) {
      return (
        <div className="commercial-intake-file-list">
          {fileUrls.map((fileUrl) => (
            <FileDocumentRow
              key={`${answer.id}-${fileUrl}`}
              fileUrl={fileUrl}
              title={fileNameFromUrl(fileUrl)}
              subtitle="Supporting document"
              onOpen={() =>
                openDocumentPreview({
                  fileUrl,
                  fileName: fileNameFromUrl(fileUrl),
                  label: answer.label,
                })
              }
            />
          ))}
        </div>
      )
    }

    if (answer.fieldType === 'multiselect') {
      return <IntakeMultiselectAnswer value={answer.value} />
    }

    return <b>{renderAnswerValue(answer.value)}</b>
  }

  const sortedAnswers = [...request.answers].sort((a, b) => a.sortOrder - b.sortOrder)
  const clientAnswers = sortedAnswers.filter((answer) => !isMirrorAnswer(answer))
  const textAnswers = clientAnswers.filter(
    (answer) => collectFileAnswerUrls(answer.value, answer.fieldType).length === 0,
  )
  const intakeFileDocs = clientAnswers.flatMap((answer) =>
    collectFileAnswerUrls(answer.value, answer.fieldType).map((fileUrl) => ({
      key: `intake-${answer.id}-${fileUrl}`,
      fileUrl,
      fileName: fileNameFromUrl(fileUrl),
      title: fileNameFromUrl(fileUrl),
      subtitle: `${answer.label} · Client file`,
      label: answer.label,
    })),
  )

  return (
    <>
      <div
        className="commercial-modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <section
          className="commercial-modal commercial-modal--xl commercial-request360"
          role="dialog"
          aria-modal="true"
          aria-label={`Request ${request.requestNumber}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="commercial-modal-header">
            <div>
              <h2>{request.requestNumber}</h2>
              <p>
                {request.clientName} · {request.serviceName}
                {request.branchName ? ` · ${request.branchName}` : ''} ·{' '}
                {new Date(request.createdAt).toLocaleString('en-GB')}
              </p>
            </div>
            <div className="commercial-modal-header-meta">
              <span className={`commercial-pill ${statusClass(request.status)}`}>
                {request.statusDisplay}
              </span>
              <button
                type="button"
                className="commercial-modal-close"
                onClick={onClose}
                aria-label="Close"
              >
                <IconX size={16} />
              </button>
            </div>
          </header>

          <div className="commercial-modal-body">
            <div className="commercial-request360-summary-strip" aria-label="Request summary">
              <div>
                <span>Client</span>
                <b>{commercialEmptyLabel(request.clientName, '—')}</b>
              </div>
              <div>
                <span>Service</span>
                <b>{commercialEmptyLabel(request.serviceName, '—')}</b>
              </div>
              <div>
                <span>Estimate</span>
                <b>
                  {formatCurrency(request.estimatedValue)}
                  {showCalculatorBlock && estimateStale ? ' · stale' : ''}
                </b>
              </div>
              <div>
                <span>Owner</span>
                <b>{commercialEmptyLabel(request.ownerName, 'Unassigned')}</b>
              </div>
            </div>

            <div className="commercial-quote-detail-layout commercial-request360-layout">
              <div className="commercial-quote-detail-main">
                {hasRealEstateAssets && realEstateContext ? (
                  <section className="commercial-form-section">
                    <div className="commercial-form-section-heading">
                      <div>
                        <h3>Sale package</h3>
                        <p>Property price, additional fees, and how this request will be settled</p>
                      </div>
                    </div>
                    {realEstateContext.invoice ? (
                      <div className="commercial-request360-invoice-strip">
                        <div className="commercial-request360-invoice-top">
                          <span>
                            Invoice <b>{realEstateContext.invoice.invoiceNumber}</b>
                          </span>
                          <span>
                            Paid <b>{formatCurrency(realEstateContext.invoice.amountPaid)}</b> of{' '}
                            <b>{formatCurrency(realEstateContext.invoice.totalAmount)}</b> · Balance{' '}
                            <b>{formatCurrency(realEstateContext.invoice.balance)}</b>
                          </span>
                        </div>
                        <div className="commercial-request360-invoice-top">
                          <span>
                            Hold money <b>{formatCurrency(realEstateContext.invoice.feePaid)}</b> ·
                            Property money{' '}
                            <b>{formatCurrency(realEstateContext.invoice.propertyPaid)}</b>
                          </span>
                        </div>
                        <span
                          className="commercial-schedule-progress"
                          role="progressbar"
                          aria-valuenow={
                            realEstateContext.invoice.totalAmount > 0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (realEstateContext.invoice.amountPaid /
                                      realEstateContext.invoice.totalAmount) *
                                      100,
                                  ),
                                )
                              : 0
                          }
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Invoice payment progress"
                        >
                          <span
                            style={{
                              width: `${
                                realEstateContext.invoice.totalAmount > 0
                                  ? Math.min(
                                      100,
                                      Math.round(
                                        (realEstateContext.invoice.amountPaid /
                                          realEstateContext.invoice.totalAmount) *
                                          100,
                                      ),
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </span>
                      </div>
                    ) : null}
                    <div className="commercial-request360-sale-stack">
                      {realEstateContext.assets.map((asset) => {
                        const quoteLines = realEstateContext.suggestedQuoteItems.filter(
                          (item) =>
                            item.assetId === asset.assetId && item.assetType === asset.assetType,
                        )
                        const propertyLine =
                          quoteLines.find((item) => item.kind === 'primary') ??
                          quoteLines.find((item) => item.sourceContext.role === 'asset')
                        const feeLines = quoteLines.filter(
                          (item) =>
                            item.sourceContext.role === 'fee' ||
                            (item.kind === 'additional_charge' && item !== propertyLine),
                        )
                        const agreedFromPlan = Number(asset.paymentPlan.agreed_price)
                        const propertyPrice =
                          propertyLine?.unitPrice ??
                          (Number.isFinite(agreedFromPlan) && agreedFromPlan > 0
                            ? agreedFromPlan
                            : asset.price)
                        const feesTotal = feeLines.reduce(
                          (sum, item) => sum + item.quantity * item.unitPrice,
                          0,
                        )
                        const packageTotal = propertyPrice + feesTotal
                        const settlement = settlementModeLabel(asset.settlementMode)
                        const holdInfo = describeReservationHold(asset.reservationExpiresAt)

                        return (
                          <div className="commercial-request360-sale-card" key={asset.id}>
                            <div className="commercial-request360-sale-header">
                              <div>
                                <b>{asset.assetName}</b>
                                <small>
                                  {assetTypeLabel(asset.assetType)} · {asset.assetStatus}
                                </small>
                              </div>
                              <span className="commercial-pill commercial-pill-blue">
                                {settlement}
                              </span>
                            </div>

                            <div className="commercial-quote-breakdown commercial-quote-breakdown--compact">
                              <div>
                                <span>Property price</span>
                                <b>{formatCurrency(propertyPrice)}</b>
                              </div>
                              {feeLines.length === 0 ? (
                                <div>
                                  <span>Additional fees</span>
                                  <b>None</b>
                                </div>
                              ) : (
                                feeLines.map((fee) => (
                                  <div key={`${fee.sortOrder}-${fee.description}`}>
                                    <span>
                                      {fee.description.includes('—')
                                        ? fee.description.split('—').slice(1).join('—').trim()
                                        : fee.description}
                                      <small className="commercial-request360-fee-timing">
                                        {feeTimingLabel(fee.paymentTiming)}
                                      </small>
                                    </span>
                                    <b>{formatCurrency(fee.quantity * fee.unitPrice)}</b>
                                  </div>
                                ))
                              )}
                              <div className="commercial-quote-breakdown-total">
                                <span>Package total</span>
                                <b>{formatCurrency(packageTotal)}</b>
                              </div>
                            </div>

                            {holdInfo ? (
                              <div
                                className={`commercial-notice ${
                                  holdInfo.expired
                                    ? 'commercial-notice-red'
                                    : 'commercial-notice-yellow'
                                }`}
                              >
                                {holdInfo.expired
                                  ? `Reservation hold expired ${holdInfo.when}${
                                      realEstateContext.invoice
                                        ? ` with ${formatCurrency(realEstateContext.invoice.balance)} still outstanding`
                                        : ''
                                    } — chase payment or reset the property in inventory.`
                                  : `Reservation hold expires ${holdInfo.when}${
                                      realEstateContext.invoice &&
                                      realEstateContext.invoice.balance > 0
                                        ? ` — ${formatCurrency(realEstateContext.invoice.balance)} is due before then or the hold lapses.`
                                        : ' — chase the balance before then.'
                                    }`}
                              </div>
                            ) : null}

                            <p className="commercial-form-note">
                              {asset.settlementMode === 'reservation'
                                ? 'Settlement mode: reservation hold. Estate reservation rules apply when payment starts.'
                                : asset.settlementMode === 'installment'
                                  ? 'Settlement mode: installment plan. Down payment and schedule follow estate policy at quotation.'
                                  : 'Settlement mode: full payment. Ownership transfers after confirmed settlement.'}
                              {asset.claimExpiresAt
                                ? ` Soft claim expires ${new Date(asset.claimExpiresAt).toLocaleString()}.`
                                : ''}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                    {realEstateContext.paymentPolicy.allowInstallment ? (
                      <div className="commercial-form-note">
                        <span>Balance plan: choose how the remaining balance settles.</span>
                        <div>
                          <button
                            type="button"
                            className="commercial-btn commercial-btn-small"
                            disabled={planSaving !== null}
                            onClick={() => void handleBalancePlan('full_payment')}
                          >
                            {planSaving === 'full_payment' ? 'Saving...' : 'Settle balance in full'}
                          </button>{' '}
                          <button
                            type="button"
                            className="commercial-btn commercial-btn-small commercial-btn-primary"
                            disabled={planSaving !== null}
                            onClick={() => void handleBalancePlan('installment')}
                          >
                            {planSaving === 'installment' ? 'Saving...' : 'Settle via installment'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="commercial-form-note">
                        Balance settles in full — this estate does not allow installment.
                      </p>
                    )}
                  </section>
                ) : null}

                <div className="commercial-double">
                  <section className="commercial-form-section">
                    <div className="commercial-form-section-heading">
                      <div>
                        <h3>Client submission</h3>
                      </div>
                      <span className="commercial-pill commercial-pill-blue">
                        {textAnswers.length} {textAnswers.length === 1 ? 'field' : 'fields'}
                      </span>
                    </div>
                    {textAnswers.length === 0 ? (
                      <p className="commercial-form-note">No additional client details recorded.</p>
                    ) : (
                      <div className="commercial-info-grid">
                        {textAnswers.map((answer) => (
                          <div key={answer.id}>
                            <div className="commercial-kl">{answer.label}</div>
                            {renderAnswerContent(answer)}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="commercial-form-section">
                    <div className="commercial-form-section-heading">
                      <div>
                        <h3>Documents</h3>
                      </div>
                      <button
                        type="button"
                        className="commercial-btn"
                        onClick={() => setAttachmentOpen(true)}
                      >
                        Add Attachment
                      </button>
                    </div>
                    {intakeFileDocs.length === 0 && request.attachments.length === 0 ? (
                      <p className="commercial-form-note">No documents yet.</p>
                    ) : (
                      <div className="commercial-attachment-list">
                        {intakeFileDocs.map((document) => (
                          <FileDocumentRow
                            key={document.key}
                            fileUrl={document.fileUrl}
                            title={document.title}
                            subtitle={document.subtitle}
                            onOpen={() =>
                              openDocumentPreview({
                                fileUrl: document.fileUrl,
                                fileName: document.fileName,
                                label: document.label,
                              })
                            }
                          />
                        ))}
                        {request.attachments.map((attachment) => {
                          const title =
                            attachment.label?.trim() || attachment.fileName?.trim() || 'Attachment'
                          const subtitle =
                            normalizeAttachmentText(attachment.fileName) ===
                            normalizeAttachmentText(attachment.label)
                              ? attachment.contentType || 'Staff document'
                              : attachment.fileName || attachment.contentType || 'Staff document'

                          return (
                            <FileDocumentRow
                              key={attachment.id}
                              fileUrl={attachment.fileUrl}
                              fileName={
                                attachment.fileName || attachment.label || attachment.fileUrl
                              }
                              contentType={attachment.contentType}
                              title={title}
                              subtitle={subtitle}
                              onOpen={() =>
                                openDocumentPreview({
                                  fileUrl: attachment.fileUrl,
                                  fileName: attachment.fileName || attachment.label,
                                  contentType: attachment.contentType,
                                  label: title,
                                })
                              }
                            />
                          )
                        })}
                      </div>
                    )}
                  </section>
                </div>

                {showCalculatorBlock && onEstimate ? (
                  <CalculatorEstimateBlock
                    key={`${request.id}-${request.calculatorCode}`}
                    calculatorCode={request.calculatorCode}
                    customerType={request.customerType}
                    answersSnapshot={request.answersSnapshot}
                    answers={request.answers}
                    savedInputs={request.calculatorInputs}
                    estimatedValue={request.estimatedValue}
                    estimating={estimating}
                    estimateError={estimateError}
                    categories={categories}
                    categoriesLoading={categoriesLoading}
                    unitPrice={unitPrice}
                    onEstimate={onEstimate}
                    onStaleChange={(stale, inputs) => {
                      setEstimateStale(stale)
                      onEstimateStale?.(stale, inputs)
                    }}
                  />
                ) : null}

                {directBillingEditable ? (
                  <section className="commercial-form-section" onBlur={commitDirectBilling}>
                    <div className="commercial-form-section-heading">
                      <div>
                        <h3>Direct billing</h3>
                        <p>
                          Package price plus charges below — invoiced with no quotation or
                          approvals.
                        </p>
                      </div>
                    </div>
                    <QuotationItemsEditor
                      items={billingItems}
                      primaryLocked
                      lockedPrimaryTotal={request.estimatedValue}
                      onChange={(items) =>
                        setBillingExtras(items.filter((item) => item.kind !== 'primary'))
                      }
                      onClearError={() => undefined}
                    />
                    <div className="commercial-form-grid">
                      <label className="commercial-field">
                        <span>Discount (₦)</span>
                        <GroupedNumberInput value={billingDiscount} onChange={setBillingDiscount} />
                      </label>
                      <label className="commercial-field">
                        <span>Tax rate (%)</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formatNumberFieldValue(billingTaxRate)}
                          onChange={(event) =>
                            setBillingTaxRate(parseNumberFieldValue(event.target.value))
                          }
                        />
                      </label>
                      <label className="commercial-field">
                        <span>Mobilisation threshold (₦)</span>
                        <GroupedNumberInput
                          value={billingThreshold}
                          onChange={setBillingThreshold}
                        />
                      </label>
                      <div className="commercial-field">
                        <span>Due date *</span>
                        <DatePicker value={billingDueDate} onChange={setBillingDueDate} />
                      </div>
                      <label className="commercial-field commercial-field--full">
                        <span>Payment instructions</span>
                        <textarea
                          rows={2}
                          value={billingInstructions}
                          onChange={(event) => setBillingInstructions(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="commercial-quote-breakdown commercial-quote-breakdown--compact">
                      <div>
                        <span>Package + charges</span>
                        <b>{formatCurrency(billingSubtotal)}</b>
                      </div>
                      <div>
                        <span>Discount</span>
                        <b>{formatCurrency(Number(billingDiscount) || 0)}</b>
                      </div>
                      <div>
                        <span>Tax</span>
                        <b>{formatCurrency(billingTax)}</b>
                      </div>
                      <div className="commercial-quote-breakdown-total">
                        <span>Invoice total</span>
                        <b>{formatCurrency(billingTotal)}</b>
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="commercial-quote-detail-side">
                <section className="commercial-form-section commercial-form-section--compact">
                  <div className="commercial-form-section-heading">
                    <div>
                      <h3>Request review</h3>
                      <p>
                        Contact, ownership, and commercial snapshot · form v
                        {request.requestFormVersion}
                      </p>
                    </div>
                  </div>
                  <div className="commercial-info-grid commercial-info-grid--side">
                    <div>
                      <div className="commercial-kl">Contact</div>
                      <b>{commercialEmptyLabel(request.contactName, '—')}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Phone</div>
                      <b>{commercialEmptyLabel(request.contactPhone, '—')}</b>
                    </div>
                    <div className="commercial-info-full">
                      <div className="commercial-kl">Email</div>
                      <b>{commercialEmptyLabel(request.contactEmail, '—')}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Customer type</div>
                      <b>{commercialEmptyLabel(request.customerType, '—')}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Source</div>
                      <b>
                        {commercialEmptyLabel(request.source, '—')}
                        {request.sourceReference ? ` · ${request.sourceReference}` : ''}
                      </b>
                    </div>
                    <div>
                      <div className="commercial-kl">Priority</div>
                      <b>
                        {choices.priorities.find((item) => item.value === request.priority)
                          ?.label || request.priority}
                      </b>
                    </div>
                    <div>
                      <div className="commercial-kl">Linked quote</div>
                      <b>{commercialEmptyLabel(request.quoteNumber, 'No quote linked')}</b>
                    </div>
                    {!hasRealEstateAssets || showCalculatorBlock ? (
                      <>
                        <div>
                          <div className="commercial-kl">Budget</div>
                          <b>{request.budget == null ? '—' : formatCurrency(request.budget)}</b>
                        </div>
                        <div>
                          <div className="commercial-kl">Estimate</div>
                          <b>{formatCurrency(request.estimatedValue)}</b>
                        </div>
                      </>
                    ) : null}
                    <div className="commercial-info-full">
                      <div className="commercial-kl">Scope</div>
                      <p>{commercialEmptyLabel(request.scopeSummary, 'No scope recorded')}</p>
                    </div>
                  </div>
                </section>

                <form
                  id="request-360-control-form"
                  className="commercial-form-section commercial-form-section--compact"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!canSaveControlPanel) return
                    void controlForm.handleSubmit()
                  }}
                >
                  <h3>Control panel</h3>

                  {capabilities.controlPanelNotice ? (
                    <div className="commercial-notice commercial-notice-blue">
                      {capabilities.controlPanelNotice}
                    </div>
                  ) : null}

                  {isStatusTriage ? (
                    <>
                      <div className="commercial-field commercial-field--full">
                        <span>Status</span>
                        <div className="commercial-status-card">
                          <div className="commercial-status-current">
                            <span className={`commercial-pill ${statusClass(request.status)}`}>
                              {request.statusDisplay}
                            </span>
                            {triageActions.some((action) => action.quiet) ? (
                              <span className="commercial-status-back">
                                {triageActions
                                  .filter((action) => action.quiet)
                                  .map((action) => (
                                    <button
                                      key={action.status}
                                      type="button"
                                      className="commercial-status-quiet"
                                      disabled={triageBusy}
                                      onClick={() =>
                                        applyStatusAction(action.status, action.nextAction)
                                      }
                                    >
                                      {action.label}
                                    </button>
                                  ))}
                              </span>
                            ) : null}
                          </div>
                          <div className="commercial-status-list">
                            {triageActions
                              .filter((action) => !action.quiet)
                              .map((action) => {
                                const LeadingIcon =
                                  TRIAGE_ACTION_ICONS[action.status] ?? IconChevronRight
                                return (
                                  <button
                                    key={action.status}
                                    type="button"
                                    className="commercial-status-option"
                                    disabled={triageBusy}
                                    onClick={() =>
                                      applyStatusAction(action.status, action.nextAction)
                                    }
                                  >
                                    <span
                                      className="commercial-status-option-icon"
                                      aria-hidden="true"
                                    >
                                      <LeadingIcon size={15} />
                                    </span>
                                    <span className="commercial-status-option-text">
                                      <b>{action.label}</b>
                                      {action.hint ? <small>{action.hint}</small> : null}
                                    </span>
                                    <IconChevronRight
                                      size={14}
                                      className="commercial-status-option-chevron"
                                      aria-hidden="true"
                                    />
                                  </button>
                                )
                              })}
                          </div>
                          <div className="commercial-status-danger-zone">
                            {!rejectArmed ? (
                              <button
                                type="button"
                                className="commercial-status-option commercial-status-option--danger"
                                disabled={triageBusy}
                                onClick={() => setRejectArmed(true)}
                              >
                                <span
                                  className="commercial-status-option-icon commercial-status-option-icon--danger"
                                  aria-hidden="true"
                                >
                                  <IconX size={15} />
                                </span>
                                <span className="commercial-status-option-text">
                                  <b>Reject request</b>
                                  <small>Ends triage — terminal, cannot be undone here</small>
                                </span>
                                <IconChevronRight
                                  size={14}
                                  className="commercial-status-option-chevron"
                                  aria-hidden="true"
                                />
                              </button>
                            ) : (
                              <div className="commercial-notice commercial-notice-red">
                                Reject this request? This ends triage for it.
                                <div className="commercial-status-confirm">
                                  <button
                                    type="button"
                                    className="commercial-btn commercial-btn-danger"
                                    disabled={triageBusy}
                                    onClick={() =>
                                      applyStatusAction(
                                        'rejected',
                                        'Request rejected — see journal',
                                      )
                                    }
                                  >
                                    {triageBusy ? 'Rejecting…' : 'Confirm Reject'}
                                  </button>
                                  <button
                                    type="button"
                                    className="commercial-btn"
                                    disabled={triageBusy}
                                    onClick={() => setRejectArmed(false)}
                                  >
                                    Keep
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <controlForm.Field name="priority">
                        {(field) => (
                          <DropdownSelect
                            label="Priority"
                            fullWidth
                            fieldClassName="commercial-field"
                            disabled={statusPriorityReadOnly}
                            options={mapDropdownOptions(choices.priorities)}
                            value={field.state.value}
                            onChange={(value) =>
                              field.handleChange(value as typeof field.state.value)
                            }
                          />
                        )}
                      </controlForm.Field>
                    </>
                  ) : (
                    <>
                      <div className="commercial-field commercial-field--full">
                        <span>Status</span>
                        <div className="commercial-status-actions">
                          <span className={`commercial-pill ${statusClass(request.status)}`}>
                            {request.statusDisplay}
                          </span>
                          {showUnstrandHatch ? (
                            <button
                              type="button"
                              className="commercial-status-quiet"
                              disabled={triageBusy}
                              onClick={() =>
                                applyStatusAction(
                                  'under_review',
                                  'Returned to review — no quotation linked',
                                )
                              }
                            >
                              Return to Under Review
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <controlForm.Field name="priority">
                        {(field) => (
                          <DropdownSelect
                            label="Priority"
                            fullWidth
                            fieldClassName="commercial-field"
                            disabled={statusPriorityReadOnly}
                            options={mapDropdownOptions(choices.priorities)}
                            value={field.state.value}
                            onChange={(value) =>
                              field.handleChange(value as typeof field.state.value)
                            }
                          />
                        )}
                      </controlForm.Field>
                    </>
                  )}

                  <controlForm.Field name="ownerId">
                    {(field) =>
                      employees.length === 0 ? (
                        <label className="commercial-field">
                          <span>Owner</span>
                          <input value={request.ownerName || 'Unassigned'} disabled />
                        </label>
                      ) : (
                        <DropdownSelect
                          label="Owner"
                          fullWidth
                          fieldClassName="commercial-field"
                          disabled={controlPanelReadOnly}
                          options={[
                            { value: '0', label: 'Unassigned' },
                            ...employees.map((employee) => ({
                              value: String(employee.id),
                              label: employee.name,
                            })),
                          ]}
                          value={String(field.state.value || 0)}
                          onChange={(value) => field.handleChange(Number(value))}
                        />
                      )
                    }
                  </controlForm.Field>

                  {!hasRealEstateAssets && !showCalculatorBlock ? (
                    <div className="commercial-form-grid">
                      <controlForm.Field name="budget">
                        {(field) => (
                          <label className="commercial-field">
                            <span>Budget</span>
                            <input
                              type="number"
                              min="0"
                              disabled={controlPanelReadOnly}
                              value={formatNumberFieldValue(field.state.value)}
                              onChange={(event) =>
                                field.handleChange(parseNumberFieldValue(event.target.value))
                              }
                            />
                          </label>
                        )}
                      </controlForm.Field>

                      <controlForm.Field name="estimatedValue">
                        {(field) => (
                          <label className="commercial-field">
                            <span>
                              Estimated value{showCalculatorBlock ? ' (from estimate)' : ''}
                            </span>
                            <input
                              type="number"
                              min="0"
                              disabled={controlPanelReadOnly || showCalculatorBlock}
                              value={formatNumberFieldValue(field.state.value)}
                              onChange={(event) =>
                                field.handleChange(parseNumberFieldValue(event.target.value))
                              }
                            />
                          </label>
                        )}
                      </controlForm.Field>
                    </div>
                  ) : null}

                  <controlForm.Field name="nextAction">
                    {(field) => (
                      <label className="commercial-field">
                        <span>Next action</span>
                        <input
                          disabled={controlPanelReadOnly}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </label>
                    )}
                  </controlForm.Field>

                  <controlForm.Field name="scopeSummary">
                    {(field) => (
                      <label className="commercial-field">
                        <span>Scope summary</span>
                        <textarea
                          rows={4}
                          disabled={controlPanelReadOnly}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </label>
                    )}
                  </controlForm.Field>
                </form>
              </aside>

              <section className="commercial-form-section commercial-form-section--compact commercial-request360-journal">
                <div className="commercial-form-section-heading">
                  <div>
                    <h3>Activity journal</h3>
                    <p>Communication and commercial history</p>
                  </div>
                  <button
                    type="button"
                    className="commercial-btn commercial-btn-primary"
                    onClick={() => setActivityOpen(true)}
                  >
                    Add Activity
                  </button>
                </div>
                {request.activities.length === 0 ? (
                  <p className="commercial-form-note">No activity recorded yet.</p>
                ) : (
                  <div className="commercial-timeline-list commercial-timeline-list--peek-4">
                    {[...request.activities]
                      .sort(
                        (left, right) =>
                          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
                      )
                      .map((activity) => (
                        <article key={activity.id} className="commercial-tl">
                          <b>{activity.activityTypeDisplay}</b>
                          <p>
                            {activity.outcomeDisplay}: {activity.note}
                            <br />
                            <strong>{activity.createdByName || 'System'}</strong>
                          </p>
                          <time>{new Date(activity.createdAt).toLocaleString('en-GB')}</time>
                        </article>
                      ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          <footer className="commercial-modal-footer">
            <button type="button" className="commercial-btn" onClick={onClose}>
              Close
            </button>
            <div className="commercial-modal-footer-actions">
              <button
                type="submit"
                form="request-360-control-form"
                className="commercial-btn"
                disabled={saving || !canSaveControlPanel}
              >
                {saving ? 'Saving...' : 'Save Update'}
              </button>
              {showEstimateGateNotice ? (
                <span className="commercial-form-note" role="note">
                  Re-run the estimate to unlock {isDirectPath ? 'invoicing' : 'quotation'}.
                </span>
              ) : null}
              {capabilities.canPrepareQuotation ? (
                <button
                  type="button"
                  className="commercial-btn commercial-btn-primary"
                  disabled={!canPrepareQuotation}
                  title={
                    estimateStale
                      ? 'Inputs changed — re-run the estimate before quoting.'
                      : undefined
                  }
                  onClick={onPrepareQuotation}
                >
                  Prepare Quotation
                </button>
              ) : null}
              {capabilities.canCreateInvoiceDirect ? (
                <button
                  type="button"
                  className="commercial-btn commercial-btn-primary"
                  disabled={!canCreateInvoice || saving}
                  title={
                    estimateStale
                      ? 'Inputs changed — re-run the estimate before invoicing.'
                      : 'Invoice package price plus charges below — no quotation.'
                  }
                  onClick={submitDirectInvoice}
                >
                  {saving ? 'Saving...' : 'Create Invoice'}
                </button>
              ) : null}
              {capabilities.canSwitchBillingPath ? (
                <button
                  type="button"
                  className="commercial-btn"
                  disabled={saving}
                  title={
                    isDirectPath
                      ? 'Route this request through quotation and approvals instead.'
                      : 'Bill package price plus charges with no quotation instead.'
                  }
                  onClick={() =>
                    onUpdate({
                      commercialPath: isDirectPath ? 'quotation' : 'direct_invoice',
                    })
                  }
                >
                  {isDirectPath ? 'Switch to quotation flow' : 'Switch to direct invoice flow'}
                </button>
              ) : null}
            </div>
          </footer>
        </section>
      </div>

      {activityOpen ? (
        <div
          className="commercial-modal-backdrop commercial-modal-backdrop--nested"
          role="presentation"
          onMouseDown={() => setActivityOpen(false)}
        >
          <form
            className="commercial-modal"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void activityForm.handleSubmit()
            }}
          >
            <header className="commercial-modal-header">
              <h2>Add Request Activity</h2>
              <button
                type="button"
                className="commercial-modal-close"
                onClick={() => setActivityOpen(false)}
              >
                <IconX size={16} />
              </button>
            </header>
            <div className="commercial-modal-body">
              <div className="commercial-form-grid">
                <activityForm.Field name="activityType">
                  {(field) => (
                    <DropdownSelect
                      label="Type"
                      fullWidth
                      fieldClassName="commercial-field"
                      options={mapDropdownOptions(choices.activityTypes)}
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                    />
                  )}
                </activityForm.Field>

                <activityForm.Field name="outcome">
                  {(field) => (
                    <DropdownSelect
                      label="Outcome"
                      fullWidth
                      fieldClassName="commercial-field"
                      options={mapDropdownOptions(choices.activityOutcomes)}
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                    />
                  )}
                </activityForm.Field>

                <activityForm.Field name="note">
                  {(field) => (
                    <label className="commercial-field commercial-field--full">
                      <span>Detailed note *</span>
                      <textarea
                        rows={4}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </label>
                  )}
                </activityForm.Field>

                <activityForm.Field name="nextAction">
                  {(field) => (
                    <label className="commercial-field">
                      <span>Next action</span>
                      <input
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </label>
                  )}
                </activityForm.Field>

                <activityForm.Field name="nextFollowUpAt">
                  {(field) => (
                    <label className="commercial-field">
                      <span>Next follow-up</span>
                      <input
                        type="datetime-local"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </label>
                  )}
                </activityForm.Field>
              </div>
            </div>
            <footer className="commercial-modal-footer">
              <button
                type="button"
                className="commercial-btn"
                onClick={() => setActivityOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="commercial-btn commercial-btn-primary"
                disabled={activitySaving}
              >
                {activitySaving ? 'Saving...' : 'Save Activity'}
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {attachmentOpen ? (
        <div
          className="commercial-modal-backdrop commercial-modal-backdrop--nested"
          role="presentation"
          onMouseDown={() => {
            resetAttachmentUpload()
            setAttachmentOpen(false)
          }}
        >
          <form
            className="commercial-modal"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void attachmentForm.handleSubmit()
            }}
          >
            <header className="commercial-modal-header">
              <h2>Add Request Attachment</h2>
              <button
                type="button"
                className="commercial-modal-close"
                onClick={() => {
                  resetAttachmentUpload()
                  setAttachmentOpen(false)
                }}
              >
                <IconX size={16} />
              </button>
            </header>
            <div className="commercial-modal-body">
              <div className="commercial-form-grid">
                <attachmentForm.Field name="label">
                  {(field) => (
                    <label className="commercial-field">
                      <span>Label</span>
                      <input
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </label>
                  )}
                </attachmentForm.Field>
                <div className="commercial-field commercial-field--full commercial-upload-field">
                  <span>File *</span>
                  <label className="commercial-upload-dropzone">
                    <div className="commercial-upload-dropzone-icon">
                      <IconUpload size={18} />
                    </div>
                    <div>
                      <strong>Add document</strong>
                      <small>Upload the file now and attach it to this request when ready.</small>
                    </div>
                    <input
                      type="file"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void uploadAttachmentFile(file)
                        event.target.value = ''
                      }}
                    />
                  </label>

                  {pendingAttachment ? (
                    <div className="commercial-upload-list">
                      <article
                        className={`commercial-upload-item commercial-upload-item--${pendingAttachment.status}`}
                      >
                        <div className="commercial-upload-item-icon">
                          <FileTypeIcon
                            fileName={pendingAttachment.fileName}
                            contentType={pendingAttachment.contentType}
                          />
                        </div>
                        <div className="commercial-upload-item-body">
                          <div className="commercial-upload-item-top">
                            <strong>{pendingAttachment.fileName}</strong>
                            <span>{formatBytes(pendingAttachment.fileSizeBytes)}</span>
                          </div>
                          {pendingAttachment.status === 'uploading' ? (
                            <div className="commercial-upload-progress">
                              <div className="commercial-upload-progress-bar" />
                            </div>
                          ) : null}
                          {pendingAttachment.status === 'uploaded' ? (
                            <small>Ready to attach to this request</small>
                          ) : null}
                          {pendingAttachment.status === 'error' ? (
                            <small>{pendingAttachment.error}</small>
                          ) : null}
                        </div>
                        <div className="commercial-upload-actions">
                          {pendingAttachment.status === 'error' ? (
                            <button
                              type="button"
                              className="commercial-upload-remove"
                              onClick={retryAttachmentUpload}
                              aria-label={`Retry ${pendingAttachment.fileName}`}
                            >
                              <IconRefresh size={14} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="commercial-upload-remove"
                            onClick={resetAttachmentUpload}
                            aria-label={`Remove ${pendingAttachment.fileName}`}
                          >
                            {pendingAttachment.status === 'uploading' ? (
                              <IconX size={14} />
                            ) : (
                              <IconTrash size={14} />
                            )}
                          </button>
                        </div>
                      </article>
                    </div>
                  ) : null}

                  {attachmentError ? (
                    <small className="commercial-field-error">{attachmentError}</small>
                  ) : null}
                </div>
              </div>
            </div>
            <footer className="commercial-modal-footer">
              <button
                type="button"
                className="commercial-btn"
                onClick={() => {
                  resetAttachmentUpload()
                  setAttachmentOpen(false)
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="commercial-btn commercial-btn-primary"
                disabled={attachmentSaving || pendingAttachment?.status === 'uploading'}
              >
                {attachmentSaving ? 'Saving...' : 'Add Attachment'}
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {previewDocument ? (
        <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />
      ) : null}
    </>
  )
}
