import { IconRefresh, IconTrash, IconUpload, IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { presentError } from '@/shared/errors'
import { formatCurrency } from '@/shared/lib/formatters'
import { formatNumberFieldValue, parseNumberFieldValue } from '@/shared/lib/number-input'
import { useToast } from '@/shared/ui/toast/useToast'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'
import { realEstateQueries } from '@/modules/specialized-services/real-estate/real-estate.queries'

import { serviceRequestsApi } from '../api/service-requests.api'
import { getServiceRequestCapabilities } from '../api/service-request-capabilities'
import type {
  CreateServiceRequestActivityInput,
  CreateServiceRequestAttachmentInput,
  EmployeeOption,
  ServiceRequestChoices,
  ServiceRequestDetail,
  UpdateServiceRequestInput,
} from '../api/service-requests.types'

import { FileTypeIcon } from '../request-intake/file-presentation'
import {
  DocumentPreviewModal,
  FileDocumentRow,
  type PreviewDocument,
} from '../request-intake/DocumentPreviewModal'
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

export function ServiceRequestDetailWorkspace({
  request,
  choices,
  employees,
  saving,
  activitySaving,
  attachmentSaving,
  onClose,
  onUpdate,
  onActivity,
  onAttachment,
  onPrepareQuotation,
}: {
  request: ServiceRequestDetail
  choices: ServiceRequestChoices
  employees: EmployeeOption[]
  saving: boolean
  activitySaving: boolean
  attachmentSaving: boolean
  onClose: () => void
  onUpdate: (input: UpdateServiceRequestInput) => void
  onActivity: (input: CreateServiceRequestActivityInput) => void
  onAttachment: (input: CreateServiceRequestAttachmentInput) => void
  onPrepareQuotation: () => void
}) {
  const toast = useToast()
  const [activityOpen, setActivityOpen] = useState(false)
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachmentUpload | null>(null)
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null)
  const uploadControllerRef = useRef<AbortController | null>(null)
  const realEstateContextQuery = useQuery(realEstateQueries.commercialContext(request.id))
  const realEstateContext = realEstateContextQuery.data
  const hasRealEstateAssets = Boolean(realEstateContext?.assets.length)

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
    onSubmit: ({ value }) =>
      onUpdate({
        status: value.status,
        priority: value.priority,
        ownerId: value.ownerId || null,
        budget: Number(value.budget || 0),
        dueDate: value.dueDate || null,
        nextAction: value.nextAction.trim(),
        estimatedValue: Number(value.estimatedValue || 0),
        scopeSummary: value.scopeSummary.trim(),
      }),
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
  const statusOptions = capabilities.allowedStatuses
    ? choices.statuses.filter(
        (item) =>
          capabilities.allowedStatuses?.includes(item.value as typeof request.status) ||
          item.value === request.status,
      )
    : choices.statuses
  const controlPanelReadOnly =
    !capabilities.canEditControlPanel ||
    (capabilities.controlPanelLocked && !capabilities.mobilisationReady)
  const statusPriorityReadOnly =
    !capabilities.canEditControlPanel || capabilities.controlPanelLocked
  const canSaveControlPanel = capabilities.canEditControlPanel && !controlPanelReadOnly

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
            <div className="commercial-quote-detail-layout">
              <div className="commercial-quote-detail-main">
                <section className="commercial-form-section">
                  <div className="commercial-form-section-heading">
                    <div>
                      <h3>Request overview</h3>
                      <p>Contact, ownership, and commercial snapshot · form v{request.requestFormVersion}</p>
                    </div>
                  </div>
                  <div className="commercial-info-grid">
                    <div>
                      <div className="commercial-kl">Contact</div>
                      <b>{commercialEmptyLabel(request.contactName, '—')}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Phone</div>
                      <b>{commercialEmptyLabel(request.contactPhone, '—')}</b>
                    </div>
                    <div>
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
                      <div className="commercial-kl">Owner</div>
                      <b>{commercialEmptyLabel(request.ownerName, 'Unassigned')}</b>
                    </div>
                    <div>
                      <div className="commercial-kl">Priority</div>
                      <b>
                        {choices.priorities.find((item) => item.value === request.priority)?.label ||
                          request.priority}
                      </b>
                    </div>
                    <div>
                      <div className="commercial-kl">Linked quote</div>
                      <b>{commercialEmptyLabel(request.quoteNumber, 'No quote linked')}</b>
                    </div>
                    {!hasRealEstateAssets ? (
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

                {hasRealEstateAssets && realEstateContext ? (
                  <section className="commercial-form-section">
                    <div className="commercial-form-section-heading">
                      <div>
                        <h3>Sale package</h3>
                        <p>
                          Property price, additional fees, and how this request will be settled
                        </p>
                      </div>
                    </div>
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
                  </section>
                ) : null}

                <section className="commercial-form-section">
                  <div className="commercial-form-section-heading">
                    <div>
                      <h3>Intake responses</h3>
                      <p>Answers stored against the request snapshot</p>
                    </div>
                  </div>
                  {request.answers.length === 0 ? (
                    <p className="commercial-form-note">No intake answers recorded.</p>
                  ) : (
                    <div className="commercial-info-grid">
                      {[...request.answers]
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((answer) => {
                          const fileUrls = collectFileAnswerUrls(answer.value, answer.fieldType)
                          const isFileAnswer = fileUrls.length > 0

                          return (
                            <div
                              key={answer.id}
                              className={isFileAnswer ? 'commercial-info-full' : undefined}
                            >
                              <div className="commercial-kl">{answer.label}</div>
                              {renderAnswerContent(answer)}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </section>
              </div>

              <aside className="commercial-quote-detail-side">
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

                  <div className="commercial-form-grid">
                    <controlForm.Field name="status">
                      {(field) => (
                        <DropdownSelect
                          label="Status"
                          fieldClassName="commercial-field"
                          disabled={statusPriorityReadOnly}
                          options={mapDropdownOptions(statusOptions)}
                          value={field.state.value}
                          onChange={(value) => field.handleChange(value as typeof field.state.value)}
                        />
                      )}
                    </controlForm.Field>

                    <controlForm.Field name="priority">
                      {(field) => (
                        <DropdownSelect
                          label="Priority"
                          fieldClassName="commercial-field"
                          disabled={statusPriorityReadOnly}
                          options={mapDropdownOptions(choices.priorities)}
                          value={field.state.value}
                          onChange={(value) => field.handleChange(value as typeof field.state.value)}
                        />
                      )}
                    </controlForm.Field>
                  </div>

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

                  {!hasRealEstateAssets ? (
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
                            <span>Estimated value</span>
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

              <div className="commercial-quote-detail-meta-row">
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
                            new Date(right.createdAt).getTime() -
                            new Date(left.createdAt).getTime(),
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

                <section className="commercial-form-section commercial-form-section--compact">
                  <div className="commercial-form-section-heading">
                    <div>
                      <h3>Attachments</h3>
                      <p>Request documents and references</p>
                    </div>
                    <button
                      type="button"
                      className="commercial-btn"
                      onClick={() => setAttachmentOpen(true)}
                    >
                      Add Attachment
                    </button>
                  </div>
                  {request.attachments.length === 0 ? (
                    <p className="commercial-form-note">No attachments recorded.</p>
                  ) : (
                    <div className="commercial-attachment-list">
                      {request.attachments.map((attachment) => {
                        const title =
                          attachment.label?.trim() || attachment.fileName?.trim() || 'Attachment'
                        const subtitle =
                          normalizeAttachmentText(attachment.fileName) ===
                          normalizeAttachmentText(attachment.label)
                            ? attachment.contentType || 'View document'
                            : attachment.fileName || attachment.contentType || 'View document'

                        return (
                          <FileDocumentRow
                            key={attachment.id}
                            fileUrl={attachment.fileUrl}
                            fileName={attachment.fileName || attachment.label || attachment.fileUrl}
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
            </div>
          </div>

          <footer className="commercial-modal-footer">
            <button type="button" className="commercial-btn" onClick={onClose}>
              Close
            </button>
            <div className="commercial-modal-footer-actions">
              {capabilities.canScheduleAssessment &&
              !capabilities.canPrepareQuotation &&
              request.status !== 'site_assessment' ? (
                <button
                  type="button"
                  className="commercial-btn"
                  disabled={saving}
                  onClick={() =>
                    onUpdate({
                      status: 'site_assessment',
                      nextAction: 'Attend assessment and record findings',
                    })
                  }
                >
                  Schedule Assessment
                </button>
              ) : null}
              <button
                type="submit"
                form="request-360-control-form"
                className="commercial-btn"
                disabled={saving || !canSaveControlPanel}
              >
                {saving ? 'Saving...' : 'Save Update'}
              </button>
              {capabilities.canPrepareQuotation ? (
                <button
                  type="button"
                  className="commercial-btn commercial-btn-primary"
                  onClick={onPrepareQuotation}
                >
                  Prepare Quotation
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
