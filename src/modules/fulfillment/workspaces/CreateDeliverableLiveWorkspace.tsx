import { IconRefresh, IconTrash, IconUpload, IconX } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useEffect, useRef, useState } from 'react'

import { presentError } from '@/shared/errors'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'
import { serviceRequestsApi } from '@/modules/commercial/api/service-requests.api'
import { FileTypeIcon } from '@/modules/commercial/request-intake/file-presentation'
import { formatBytes } from '@/modules/commercial/request-intake/file-presentation.utils'

import type { EmployeeOption, ServiceOrder } from '../service-orders/service-order.types'
import { serviceOrderQueries } from '../service-orders/service-order.queries'
import { executionTaskQueries } from '../execution-tasks/execution-task.queries'
import {
  deliverableApprovalModes,
  deliverableTypes,
  type CreateDeliverableInput,
  type DeliverableApprovalMode,
  type DeliverableType,
} from '../deliverables/deliverable.types'
import {
  validateDeliverableCreate,
  type DeliverableCreateField,
} from '../deliverables/deliverable.validation'

type FormValues = {
  milestoneId: number
  taskId: number
  title: string
  deliverableType: DeliverableType
  version: string
  fileUrl: string
  fileName: string
  contentType: string
  fileSizeBytes: number
  description: string
  clientVisible: boolean
  approvalMode: DeliverableApprovalMode
  ownerId: number
}

type PendingDocumentUpload = {
  file: File
  fileName: string
  fileSizeBytes: number
  contentType: string
  fileUrl: string
  status: 'uploading' | 'uploaded' | 'error'
  error: string
}

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function CreateDeliverableLiveWorkspace({
  initialOrder,
  orders,
  employees,
  saving,
  onClose,
  onSubmit,
}: {
  initialOrder: ServiceOrder | null
  orders: ServiceOrder[]
  employees: EmployeeOption[]
  saving: boolean
  onClose: () => void
  onSubmit: (orderId: number, input: CreateDeliverableInput) => void
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrder?.id ?? 0)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DeliverableCreateField, string>>>(
    {},
  )
  const [documentUpload, setDocumentUpload] = useState<PendingDocumentUpload | null>(null)
  const uploadControllerRef = useRef<AbortController | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const versionInputRef = useRef<HTMLInputElement | null>(null)
  const documentFieldRef = useRef<HTMLDivElement | null>(null)
  const documentDropzoneRef = useRef<HTMLLabelElement | null>(null)
  const clientVisibleRef = useRef<HTMLInputElement | null>(null)

  const clearFieldError = (field: DeliverableCreateField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const focusField = (field: DeliverableCreateField) => {
    if (field === 'fileUrl' || field === 'fileSizeBytes') {
      documentFieldRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      window.requestAnimationFrame(() => {
        documentDropzoneRef.current?.focus()
      })
      return
    }

    const target =
      field === 'title'
        ? titleInputRef.current
        : field === 'version'
          ? versionInputRef.current
          : clientVisibleRef.current

    window.requestAnimationFrame(() => {
      target?.focus()
    })
  }

  const selectedOrderQuery = useQuery({
    ...serviceOrderQueries.detail(selectedOrderId || 0),
    enabled: Boolean(selectedOrderId) && initialOrder?.id !== selectedOrderId,
  })

  const activeOrder =
    initialOrder?.id === selectedOrderId ? initialOrder : (selectedOrderQuery.data ?? null)

  const tasksQuery = useQuery({
    ...executionTaskQueries.list(activeOrder?.id ?? 0, { page: 1, limit: 100 }),
    enabled: Boolean(activeOrder),
  })

  const defaultValues: FormValues = {
    milestoneId: 0,
    taskId: 0,
    title: '',
    deliverableType: 'report',
    version: 'v1',
    fileUrl: '',
    fileName: '',
    contentType: '',
    fileSizeBytes: 0,
    description: '',
    clientVisible: true,
    approvalMode: 'supervisor',
    ownerId: 0,
  }

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      if (!activeOrder) {
        setFieldErrors({})
        setError('Select a service order before adding a deliverable.')
        return
      }

      const input: CreateDeliverableInput = {
        milestoneId: value.milestoneId || null,
        taskId: value.taskId || null,
        title: value.title.trim(),
        deliverableType: value.deliverableType,
        version: value.version.trim(),
        fileUrl: value.fileUrl.trim(),
        fileName: value.fileName.trim(),
        contentType: value.contentType.trim(),
        fileSizeBytes: Number(value.fileSizeBytes) || 0,
        description: value.description.trim(),
        clientVisible: value.clientVisible,
        approvalMode: value.approvalMode,
        ownerId: value.ownerId || null,
      }

      const validationError = validateDeliverableCreate(input)
      if (validationError) {
        setError('')
        setFieldErrors({ [validationError.field]: validationError.message })
        focusField(validationError.field)
        return
      }

      setError('')
      setFieldErrors({})
      onSubmit(activeOrder.id, input)
    },
  })

  useEffect(() => {
    form.setFieldValue('milestoneId', 0)
    form.setFieldValue('taskId', 0)
  }, [selectedOrderId, form])

  const resetDocumentUpload = () => {
    uploadControllerRef.current?.abort()
    uploadControllerRef.current = null
    setDocumentUpload(null)
    form.setFieldValue('fileUrl', '')
    form.setFieldValue('fileName', '')
    form.setFieldValue('contentType', '')
    form.setFieldValue('fileSizeBytes', 0)
    clearFieldError('fileUrl')
  }

  const uploadDocumentFile = async (file: File) => {
    uploadControllerRef.current?.abort()
    const controller = new AbortController()
    uploadControllerRef.current = controller

    clearFieldError('fileUrl')
    setError('')
    setDocumentUpload({
      file,
      fileName: file.name,
      fileSizeBytes: file.size,
      contentType: file.type,
      fileUrl: '',
      status: 'uploading',
      error: '',
    })

    form.setFieldValue('fileName', file.name)
    form.setFieldValue('contentType', file.type)
    form.setFieldValue('fileSizeBytes', file.size)

    try {
      const fileUrl = await serviceRequestsApi.uploadFile(file, controller.signal)
      setDocumentUpload({
        file,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type,
        fileUrl,
        status: 'uploaded',
        error: '',
      })
      form.setFieldValue('fileUrl', fileUrl)
      clearFieldError('fileUrl')
    } catch (uploadError) {
      if (controller.signal.aborted) return
      const message = presentError(uploadError, 'background-action').message
      setDocumentUpload({
        file,
        fileName: file.name,
        fileSizeBytes: file.size,
        contentType: file.type,
        fileUrl: '',
        status: 'error',
        error: message,
      })
      form.setFieldValue('fileUrl', '')
      setFieldErrors((current) => ({ ...current, fileUrl: message }))
    } finally {
      if (uploadControllerRef.current === controller) {
        uploadControllerRef.current = null
      }
    }
  }

  const retryDocumentUpload = () => {
    if (!documentUpload) return
    void uploadDocumentFile(documentUpload.file)
  }

  const tasks = tasksQuery.data?.items ?? []

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal commercial-modal--xl fulfillment-deliverable-modal commercial-deliverable-create-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Deliverable"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Add deliverable</h2>
            <p>
              {activeOrder
                ? `${activeOrder.orderNumber} · ${activeOrder.serviceName}`
                : 'Select a service order to continue'}
            </p>
          </div>
          <div className="commercial-modal-header-meta">
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
          <section className="commercial-form-section">
            <h3>Service order</h3>
            {!initialOrder ? (
              <div className="commercial-form-grid">
                <DropdownSelect
                  label="Service order"
                  required
                  fullWidth
                  fieldClassName="commercial-field commercial-field--full"
                  placeholder="Select a service order"
                  options={mapDropdownOptions(
                    [...orders]
                      .sort((left, right) => left.orderNumber.localeCompare(right.orderNumber))
                      .map((order) => ({
                        value: String(order.id),
                        label: `${order.orderNumber} · ${order.serviceName}`,
                      })),
                  )}
                  value={selectedOrderId ? String(selectedOrderId) : ''}
                  onChange={(value) => setSelectedOrderId(Number(value))}
                />
              </div>
            ) : null}

            {activeOrder ? (
              <div className="commercial-info-grid">
                <div>
                  <div className="commercial-kl">Order</div>
                  <b>{activeOrder.orderNumber}</b>
                </div>
                <div>
                  <div className="commercial-kl">Service</div>
                  <b>{activeOrder.serviceName}</b>
                </div>
                <div>
                  <div className="commercial-kl">Stage</div>
                  <b>{activeOrder.stage || '—'}</b>
                </div>
                <div>
                  <div className="commercial-kl">Status</div>
                  <b>{label(activeOrder.orderStatus)}</b>
                </div>
              </div>
            ) : null}
          </section>

          {error ? <div className="commercial-notice commercial-notice-red">{error}</div> : null}

          <section className="commercial-form-section">
            <h3>Linkage</h3>
            <div className="commercial-form-grid">
              <form.Field name="milestoneId">
                {(field) => (
                  <DropdownSelect
                    label="Milestone"
                    fieldClassName="commercial-field"
                    disabled={!activeOrder}
                    placeholder="Optional"
                    options={[
                      { value: '0', label: 'No milestone' },
                      ...mapDropdownOptions(
                        [...(activeOrder?.milestones ?? [])]
                          .sort(
                            (left, right) => left.sortOrder - right.sortOrder || left.id - right.id,
                          )
                          .map((milestone) => ({
                            value: String(milestone.id),
                            label: `${milestone.name} · ${label(milestone.status)}`,
                          })),
                      ),
                    ]}
                    value={String(field.state.value)}
                    onChange={(value) => field.handleChange(Number(value))}
                  />
                )}
              </form.Field>

              <form.Field name="taskId">
                {(field) => (
                  <DropdownSelect
                    label="Execution task"
                    fieldClassName="commercial-field"
                    disabled={!activeOrder || tasksQuery.isPending}
                    placeholder={tasksQuery.isPending ? 'Loading tasks…' : 'Optional'}
                    options={[
                      {
                        value: '0',
                        label: tasksQuery.isPending ? 'Loading tasks…' : 'No task link',
                      },
                      ...mapDropdownOptions(
                        tasks.map((task) => ({
                          value: String(task.id),
                          label: `${task.taskNumber} · ${task.title}`,
                        })),
                      ),
                    ]}
                    value={String(field.state.value)}
                    onChange={(value) => field.handleChange(Number(value))}
                  />
                )}
              </form.Field>

              <form.Field name="ownerId">
                {(field) => (
                  <DropdownSelect
                    label="Owner"
                    fieldClassName="commercial-field"
                    placeholder="Unassigned"
                    options={[
                      { value: '0', label: 'Unassigned' },
                      ...mapDropdownOptions(
                        employees.map((employee) => ({
                          value: String(employee.id),
                          label: `${employee.name}${employee.designation ? ` · ${employee.designation}` : ''}`,
                        })),
                      ),
                    ]}
                    value={String(field.state.value)}
                    onChange={(value) => field.handleChange(Number(value))}
                  />
                )}
              </form.Field>

              <form.Field name="approvalMode">
                {(field) => (
                  <DropdownSelect
                    label="Approval mode"
                    fieldClassName="commercial-field"
                    options={mapDropdownOptions(deliverableApprovalModes)}
                    value={field.state.value}
                    onChange={(value) => {
                      const next = value as DeliverableApprovalMode
                      field.handleChange(next)
                      if (next === 'client') form.setFieldValue('clientVisible', true)
                    }}
                  />
                )}
              </form.Field>
            </div>
          </section>

          <section className="commercial-form-section">
            <h3>Deliverable</h3>
            <div className="commercial-form-grid">
              <form.Field name="title">
                {(field) => (
                  <label className="commercial-field commercial-field--full">
                    <span>
                      Title <em>*</em>
                    </span>
                    <input
                      ref={titleInputRef}
                      autoFocus={Boolean(initialOrder)}
                      required
                      value={field.state.value}
                      onChange={(event) => {
                        clearFieldError('title')
                        field.handleChange(event.target.value)
                      }}
                      placeholder="e.g. Final survey report"
                      aria-invalid={Boolean(fieldErrors.title)}
                    />
                    {fieldErrors.title ? (
                      <small className="commercial-field-error">{fieldErrors.title}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>

              <form.Field name="deliverableType">
                {(field) => (
                  <DropdownSelect
                    label="Type"
                    fieldClassName="commercial-field"
                    options={mapDropdownOptions(deliverableTypes)}
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value as DeliverableType)}
                  />
                )}
              </form.Field>

              <form.Field name="version">
                {(field) => (
                  <label className="commercial-field">
                    <span>
                      Version <em>*</em>
                    </span>
                    <input
                      ref={versionInputRef}
                      required
                      value={field.state.value}
                      onChange={(event) => {
                        clearFieldError('version')
                        field.handleChange(event.target.value)
                      }}
                      placeholder="v1"
                      aria-invalid={Boolean(fieldErrors.version)}
                    />
                    {fieldErrors.version ? (
                      <small className="commercial-field-error">{fieldErrors.version}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>

              <form.Field name="description">
                {(field) => (
                  <label className="commercial-field commercial-field--full">
                    <span>Description</span>
                    <textarea
                      rows={3}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Brief description of the output"
                    />
                  </label>
                )}
              </form.Field>

              <form.Field name="clientVisible">
                {(field) => (
                  <label className="commercial-check commercial-field--full">
                    <input
                      ref={clientVisibleRef}
                      type="checkbox"
                      checked={field.state.value}
                      disabled={form.state.values.approvalMode === 'client'}
                      onChange={(event) => {
                        clearFieldError('clientVisible')
                        field.handleChange(event.target.checked)
                      }}
                      aria-invalid={Boolean(fieldErrors.clientVisible)}
                    />
                    <span>
                      <b>Visible to client</b>
                      <small>
                        {form.state.values.approvalMode === 'client'
                          ? 'Required for client approval mode.'
                          : 'Show this deliverable on the client-facing record.'}
                      </small>
                      {fieldErrors.clientVisible ? (
                        <small className="commercial-field-error">{fieldErrors.clientVisible}</small>
                      ) : null}
                    </span>
                  </label>
                )}
              </form.Field>
            </div>
          </section>

          <section className="commercial-form-section">
            <h3>Document</h3>
            <div
              ref={documentFieldRef}
              className={`commercial-field commercial-field--full commercial-upload-field${
                fieldErrors.fileUrl ? ' commercial-upload-field--error' : ''
              }`}
            >
              <span>
                File <em>*</em>
              </span>
              <label
                ref={documentDropzoneRef}
                className="commercial-upload-dropzone"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    documentDropzoneRef.current?.querySelector('input')?.click()
                  }
                }}
              >
                <div className="commercial-upload-dropzone-icon">
                  <IconUpload size={18} />
                </div>
                <div>
                  <strong>Select document</strong>
                  <small>Upload now; the file reference is stored with the deliverable.</small>
                </div>
                <input
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void uploadDocumentFile(file)
                    event.target.value = ''
                  }}
                  aria-invalid={Boolean(fieldErrors.fileUrl)}
                />
              </label>

              {documentUpload ? (
                <div className="commercial-upload-list">
                  <article
                    className={`commercial-upload-item commercial-upload-item--${documentUpload.status}`}
                  >
                    <div className="commercial-upload-item-icon">
                      <FileTypeIcon
                        fileName={documentUpload.fileName}
                        contentType={documentUpload.contentType}
                      />
                    </div>
                    <div className="commercial-upload-item-body">
                      <div className="commercial-upload-item-top">
                        <strong>{documentUpload.fileName}</strong>
                        <span>{formatBytes(documentUpload.fileSizeBytes)}</span>
                      </div>
                      {documentUpload.status === 'uploading' ? (
                        <div className="commercial-upload-progress">
                          <div className="commercial-upload-progress-bar" />
                        </div>
                      ) : null}
                      {documentUpload.status === 'uploaded' ? (
                        <small>Ready to save</small>
                      ) : null}
                      {documentUpload.status === 'error' ? (
                        <small>{documentUpload.error}</small>
                      ) : null}
                    </div>
                    <div className="commercial-upload-actions">
                      {documentUpload.status === 'error' ? (
                        <button
                          type="button"
                          className="commercial-upload-remove"
                          onClick={retryDocumentUpload}
                          aria-label={`Retry ${documentUpload.fileName}`}
                        >
                          <IconRefresh size={14} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="commercial-upload-remove"
                        onClick={resetDocumentUpload}
                        aria-label={`Remove ${documentUpload.fileName}`}
                      >
                        {documentUpload.status === 'uploading' ? (
                          <IconX size={16} />
                        ) : (
                          <IconTrash size={14} />
                        )}
                      </button>
                    </div>
                  </article>
                </div>
              ) : null}

              {fieldErrors.fileUrl ? (
                <small className="commercial-field-error">{fieldErrors.fileUrl}</small>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <div className="commercial-modal-footer-actions">
            <button
              type="submit"
              className="commercial-btn commercial-btn-primary"
              disabled={saving || !activeOrder || documentUpload?.status === 'uploading'}
            >
              {saving ? 'Adding...' : 'Add deliverable'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}
