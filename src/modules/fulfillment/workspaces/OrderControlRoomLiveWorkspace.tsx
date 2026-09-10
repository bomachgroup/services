import { IconX } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useEffect, useRef, useState } from 'react'

import { formatCurrency } from '@/shared/lib/formatters'
import { DatePicker } from '@/shared/ui/date-picker'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'

import { deliverableQueries } from '../deliverables/deliverable.queries'
import type { Deliverable } from '../deliverables/deliverable.types'
import { executionTaskQueries } from '../execution-tasks/execution-task.queries'
import type { ExecutionTask } from '../execution-tasks/execution-task.types'
import type {
  AddOrderActivityInput,
  AddOrderMilestoneInput,
  EmployeeOption,
  ServiceOrder,
  UpdateServiceOrderInput,
} from '../service-orders/service-order.types'
import {
  validateOrderActivity,
  validateOrderMilestone,
} from '../service-orders/service-order.validation'

function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function visibilityLabel(visibility: string) {
  if (visibility === 'internal_client') return 'Internal and client'
  if (visibility === 'management') return 'Management only'
  return 'Internal only'
}

function statusClass(status: ServiceOrder['orderStatus']) {
  if (status === 'completed') return 'commercial-pill-green'
  if (status === 'cancelled' || status === 'on_hold') return 'commercial-pill-gray'
  if (status === 'quality_review' || status === 'awaiting_client') return 'commercial-pill-yellow'
  return 'commercial-pill-blue'
}

function taskStatusClass(status: ExecutionTask['status']) {
  if (status === 'done') return 'commercial-pill-green'
  if (status === 'review') return 'commercial-pill-yellow'
  if (status === 'in_progress') return 'commercial-pill-blue'
  if (status === 'cancelled') return 'commercial-pill-gray'
  return 'commercial-pill-blue'
}

function deliverableStatusClass(status: Deliverable['status']) {
  if (status === 'approved') return 'commercial-pill-green'
  if (status === 'under_review') return 'commercial-pill-yellow'
  if (status === 'rejected') return 'commercial-pill-red'
  return 'commercial-pill-gray'
}

const activityTypes = [
  ['progress_update', 'Progress update'],
  ['client_communication', 'Client communication'],
  ['delay_blocker', 'Delay / blocker'],
  ['inspection', 'Inspection'],
  ['decision', 'Decision'],
] as const

export function OrderControlRoomLiveWorkspace({
  order,
  clientName,
  assignedEmployeeName,
  invoiceNumber,
  employees,
  saving,
  canUpdate,
  onClose,
  onUpdate,
  onCompleteMilestone,
  onAddActivity,
  onAddMilestone,
  onOpenTasks,
  onOpenDeliverables,
  onOpenTask,
  onOpenDeliverable,
}: {
  order: ServiceOrder
  clientName: string
  assignedEmployeeName: string
  invoiceNumber: string
  employees: EmployeeOption[]
  saving: boolean
  canUpdate: boolean
  onClose: () => void
  onUpdate: (input: UpdateServiceOrderInput) => void
  onCompleteMilestone: (milestoneId: number) => void
  onAddActivity: (input: AddOrderActivityInput) => void
  onAddMilestone: (input: AddOrderMilestoneInput) => void
  onOpenTasks: () => void
  onOpenDeliverables: () => void
  onOpenTask: (taskId: number) => void
  onOpenDeliverable: (deliverableId: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [addingUpdate, setAddingUpdate] = useState(false)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [activityError, setActivityError] = useState('')
  const [milestoneError, setMilestoneError] = useState('')
  const activeMilestoneRef = useRef<HTMLElement | null>(null)

  const tasksQuery = useQuery({
    ...executionTaskQueries.list(order.id, { page: 1, limit: 100 }),
  })
  const deliverablesQuery = useQuery({
    ...deliverableQueries.list(order.id, { page: 1, limit: 100 }),
  })
  const tasks = tasksQuery.data?.items ?? []
  const deliverables = deliverablesQuery.data?.items ?? []

  const editForm = useForm({
    defaultValues: {
      assignedToId: order.assignedToId ?? 0,
      dueDate: order.dueDate ?? '',
      description: order.description,
      nextAction: order.nextAction,
    },
    onSubmit: ({ value }) => {
      onUpdate({
        assignedToId: value.assignedToId || null,
        dueDate: value.dueDate || null,
        description: value.description.trim(),
        nextAction: value.nextAction.trim(),
      })
      setEditing(false)
    },
  })

  const activityForm = useForm({
    defaultValues: {
      activityType: 'progress_update',
      visibility: 'internal_client' as const,
      note: '',
      nextAction: '',
    },
    onSubmit: ({ value }) => {
      const input: AddOrderActivityInput = {
        activityType: value.activityType,
        visibility: value.visibility,
        note: value.note.trim(),
        nextAction: value.nextAction.trim(),
      }
      const error = validateOrderActivity(input)
      setActivityError(error)
      if (error) return
      onAddActivity(input)
      setAddingUpdate(false)
    },
  })

  const milestoneForm = useForm({
    defaultValues: {
      name: '',
      dueDate: '',
      clientVisible: true,
    },
    onSubmit: ({ value }) => {
      const nextSortOrder =
        Math.max(0, ...order.milestones.map((milestone) => milestone.sortOrder)) + 1
      const input: AddOrderMilestoneInput = {
        name: value.name.trim(),
        sortOrder: nextSortOrder,
        dueDate: value.dueDate || null,
        clientVisible: value.clientVisible,
      }
      const error = validateOrderMilestone(input)
      setMilestoneError(error)
      if (error) return
      onAddMilestone(input)
      setAddingMilestone(false)
    },
  })

  const orderedMilestones = [...order.milestones].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id - right.id,
  )
  const activeMilestones = orderedMilestones.filter((milestone) => milestone.status === 'active')
  const activeMilestone = activeMilestones.length === 1 ? activeMilestones[0] : null
  const canAddMilestone = canUpdate && !['completed', 'cancelled'].includes(order.orderStatus)
  const canShowAdvanceStage = canUpdate && !['completed', 'cancelled'].includes(order.orderStatus)
  const canAdvanceStage =
    canShowAdvanceStage && activeMilestones.length === 1 && order.orderStatus !== 'on_hold'
  const taskTotal = Object.values(order.taskCounts).reduce((sum, count) => sum + count, 0)
  const deliverableTotal = Object.values(order.deliverableCounts).reduce(
    (sum, count) => sum + count,
    0,
  )
  const dueSummary = order.dueDate ?? order.validUntil ?? '—'

  useEffect(() => {
    if (!activeMilestoneRef.current) return
    activeMilestoneRef.current.scrollIntoView({
      block: 'center',
      inline: 'nearest',
    })
    activeMilestoneRef.current.focus({ preventScroll: true })
  }, [activeMilestone?.id, order.id, order.updatedAt])

  useEffect(() => {
    editForm.setFieldValue('assignedToId', order.assignedToId ?? 0)
    editForm.setFieldValue('dueDate', order.dueDate ?? '')
    editForm.setFieldValue('description', order.description)
    editForm.setFieldValue('nextAction', order.nextAction)
  }, [editForm, order.assignedToId, order.description, order.dueDate, order.nextAction, order.id])

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="commercial-modal commercial-modal--xl fulfillment-order-room-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.orderNumber}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>{order.orderNumber}</h2>
            <p>
              {clientName} · {order.serviceName}
            </p>
          </div>
          <div className="commercial-modal-header-meta">
            <span className={`commercial-pill ${statusClass(order.orderStatus)}`}>
              {statusLabel(order.orderStatus)}
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
          <div className="fulfillment-order-room-layout">
            <div className="fulfillment-order-room-main">
              <section className="commercial-form-section">
                <h3>Overview</h3>
                <div className="commercial-info-grid">
                  <div>
                    <div className="commercial-kl">Client</div>
                    <b>{clientName || '—'}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Service</div>
                    <b>{order.serviceName}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Assigned to</div>
                    <b>{assignedEmployeeName}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Due date</div>
                    <b>{dueSummary}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Current stage</div>
                    <b>{order.stage || '—'}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Next action</div>
                    <b>{order.nextAction || '—'}</b>
                  </div>
                </div>
                <div className="fulfillment-order-progress-block">
                  <div className="fulfillment-order-progress-meta">
                    <span className="commercial-kl">Progress</span>
                    <b>{order.progress}%</b>
                  </div>
                  <div className="fulfillment-progress" aria-hidden="true">
                    <i style={{ width: `${order.progress}%` }} />
                  </div>
                </div>
                {order.description ? (
                  <p className="fulfillment-order-description">{order.description}</p>
                ) : null}
              </section>

              <section className="commercial-form-section">
                <div className="commercial-form-section-heading">
                  <h3>Milestones</h3>
                  {canAddMilestone ? (
                    <button
                      type="button"
                      className="commercial-btn commercial-btn-small"
                      onClick={() => setAddingMilestone(true)}
                    >
                      Add milestone
                    </button>
                  ) : null}
                </div>

                <div className="fulfillment-lifecycle">
                  {orderedMilestones.map((milestone, index) => (
                    <article
                      key={milestone.id}
                      ref={milestone.status === 'active' ? activeMilestoneRef : null}
                      tabIndex={milestone.status === 'active' ? -1 : undefined}
                      aria-current={milestone.status === 'active' ? 'step' : undefined}
                      className={`fulfillment-step ${
                        milestone.status === 'done'
                          ? 'fulfillment-step-done'
                          : milestone.status === 'active'
                            ? 'fulfillment-step-active'
                            : ''
                      }`}
                    >
                      <div className="fulfillment-step-head" aria-hidden="true">
                        <span className="fulfillment-step-badge">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="fulfillment-step-content">
                        <b>{milestone.name}</b>
                        <div className="fulfillment-step-meta">
                          <span>{statusLabel(milestone.status)}</span>
                          {milestone.dueDate ? <span>Due {milestone.dueDate}</span> : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="fulfillment-stage-controls">
                  {activeMilestones.length > 1 ? (
                    <div className="commercial-notice commercial-notice-blue">
                      Multiple milestones are active. Review the workflow before continuing.
                    </div>
                  ) : activeMilestones.length === 0 &&
                    !['completed', 'cancelled'].includes(order.orderStatus) ? (
                    <div className="commercial-notice commercial-notice-blue">
                      No active milestone is available for this order.
                    </div>
                  ) : activeMilestone ? (
                    <div className="fulfillment-stage-current">
                      <span className="commercial-kl">Current milestone</span>
                      <b>{activeMilestone.name}</b>
                    </div>
                  ) : null}

                  {canShowAdvanceStage ? (
                    <button
                      type="button"
                      className="commercial-btn commercial-btn-primary"
                      disabled={saving || !canAdvanceStage || !activeMilestone}
                      onClick={() => {
                        if (!activeMilestone || !canAdvanceStage) return
                        onCompleteMilestone(activeMilestone.id)
                      }}
                      title={
                        !activeMilestone
                          ? 'No active milestone is available for this order.'
                          : order.orderStatus === 'on_hold'
                            ? 'Stage advancement is unavailable while this order is on hold.'
                            : activeMilestones.length > 1
                              ? 'Multiple milestones are currently active.'
                              : undefined
                      }
                    >
                      {saving ? 'Advancing...' : 'Advance stage'}
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="commercial-form-section commercial-form-section--compact">
                <div className="commercial-form-section-heading">
                  <h3>Execution tasks</h3>
                  <button
                    type="button"
                    className="commercial-btn commercial-btn-small"
                    onClick={onOpenTasks}
                  >
                    New task
                  </button>
                </div>
                <div className="fulfillment-metric-strip" aria-label="Execution task counts">
                  <div className="fulfillment-metric">
                    <b>{taskTotal}</b>
                    <span className="fulfillment-metric-label">Total</span>
                  </div>
                  <div
                    className={`fulfillment-metric fulfillment-metric--blue${
                      (order.taskCounts.in_progress ?? 0) === 0 ? ' fulfillment-metric--muted' : ''
                    }`}
                  >
                    <b>{order.taskCounts.in_progress ?? 0}</b>
                    <span className="fulfillment-metric-label">In progress</span>
                  </div>
                  <div
                    className={`fulfillment-metric fulfillment-metric--yellow${
                      (order.taskCounts.review ?? 0) === 0 ? ' fulfillment-metric--muted' : ''
                    }`}
                  >
                    <b>{order.taskCounts.review ?? 0}</b>
                    <span className="fulfillment-metric-label">In review</span>
                  </div>
                  <div
                    className={`fulfillment-metric fulfillment-metric--green${
                      (order.taskCounts.done ?? order.taskCounts.completed ?? 0) === 0
                        ? ' fulfillment-metric--muted'
                        : ''
                    }`}
                  >
                    <b>{order.taskCounts.done ?? order.taskCounts.completed ?? 0}</b>
                    <span className="fulfillment-metric-label">Done</span>
                  </div>
                </div>

                {tasksQuery.isPending ? (
                  <div className="commercial-empty">Loading tasks…</div>
                ) : tasks.length === 0 ? (
                  <div className="commercial-empty">No execution tasks for this order yet.</div>
                ) : (
                  <div className="fulfillment-linked-list">
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className="fulfillment-linked-row"
                        onClick={() => onOpenTask(task.id)}
                      >
                        <div className="fulfillment-linked-row-main">
                          <b>{task.title}</b>
                          <span>
                            {task.taskNumber}
                            {task.dueDate ? ` · Due ${task.dueDate}` : ''}
                          </span>
                        </div>
                        <span className={`commercial-pill ${taskStatusClass(task.status)}`}>
                          {statusLabel(task.status)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="commercial-form-section commercial-form-section--compact">
                <div className="commercial-form-section-heading">
                  <h3>Deliverables</h3>
                  <button
                    type="button"
                    className="commercial-btn commercial-btn-small"
                    onClick={onOpenDeliverables}
                  >
                    Add deliverable
                  </button>
                </div>
                <div className="fulfillment-metric-strip" aria-label="Deliverable counts">
                  <div className="fulfillment-metric">
                    <b>{deliverableTotal}</b>
                    <span className="fulfillment-metric-label">Total</span>
                  </div>
                  <div
                    className={`fulfillment-metric fulfillment-metric--yellow${
                      (order.deliverableCounts.under_review ?? 0) === 0
                        ? ' fulfillment-metric--muted'
                        : ''
                    }`}
                  >
                    <b>{order.deliverableCounts.under_review ?? 0}</b>
                    <span className="fulfillment-metric-label">Under review</span>
                  </div>
                  <div
                    className={`fulfillment-metric fulfillment-metric--green${
                      (order.deliverableCounts.approved ?? 0) === 0
                        ? ' fulfillment-metric--muted'
                        : ''
                    }`}
                  >
                    <b>{order.deliverableCounts.approved ?? 0}</b>
                    <span className="fulfillment-metric-label">Approved</span>
                  </div>
                  <div
                    className={`fulfillment-metric fulfillment-metric--red${
                      (order.deliverableCounts.rejected ?? 0) === 0
                        ? ' fulfillment-metric--muted'
                        : ''
                    }`}
                  >
                    <b>{order.deliverableCounts.rejected ?? 0}</b>
                    <span className="fulfillment-metric-label">Rejected</span>
                  </div>
                </div>

                {deliverablesQuery.isPending ? (
                  <div className="commercial-empty">Loading deliverables…</div>
                ) : deliverables.length === 0 ? (
                  <div className="commercial-empty">No deliverables for this order yet.</div>
                ) : (
                  <div className="fulfillment-linked-list">
                    {deliverables.map((deliverable) => (
                      <button
                        key={deliverable.id}
                        type="button"
                        className="fulfillment-linked-row"
                        onClick={() => onOpenDeliverable(deliverable.id)}
                      >
                        <div className="fulfillment-linked-row-main">
                          <b>{deliverable.title}</b>
                          <span>
                            {deliverable.deliverableNumber} · {statusLabel(deliverable.deliverableType)}{' '}
                            · {deliverable.version}
                          </span>
                        </div>
                        <span
                          className={`commercial-pill ${deliverableStatusClass(deliverable.status)}`}
                        >
                          {statusLabel(deliverable.status)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="commercial-form-section">
                <div className="commercial-form-section-heading">
                  <h3>Activity</h3>
                  {canUpdate ? (
                    <button
                      type="button"
                      className="commercial-btn commercial-btn-small"
                      onClick={() => setAddingUpdate((value) => !value)}
                    >
                      {addingUpdate ? 'Close' : 'Add update'}
                    </button>
                  ) : null}
                </div>

                {addingUpdate ? (
                  <form
                    className="commercial-form-grid"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void activityForm.handleSubmit()
                    }}
                  >
                    <activityForm.Field name="activityType">
                      {(field) => (
                        <DropdownSelect
                          label="Update type"
                          fieldClassName="commercial-field"
                          options={mapDropdownOptions(
                            activityTypes.map(([value, label]) => ({ value, label })),
                          )}
                          value={field.state.value}
                          onChange={(value) => field.handleChange(value)}
                        />
                      )}
                    </activityForm.Field>
                    <activityForm.Field name="visibility">
                      {(field) => (
                        <DropdownSelect
                          label="Visibility"
                          fieldClassName="commercial-field"
                          options={[
                            { value: 'internal_client', label: 'Internal and client' },
                            { value: 'internal', label: 'Internal only' },
                            { value: 'management', label: 'Management only' },
                          ]}
                          value={field.state.value}
                          onChange={(value) =>
                            field.handleChange(value as typeof field.state.value)
                          }
                        />
                      )}
                    </activityForm.Field>
                    <activityForm.Field name="note">
                      {(field) => (
                        <label className="commercial-field commercial-field--full">
                          <span>
                            Update <em>*</em>
                          </span>
                          <textarea
                            rows={3}
                            value={field.state.value}
                            onChange={(event) => {
                              setActivityError('')
                              field.handleChange(event.target.value)
                            }}
                          />
                          {activityError ? (
                            <small className="commercial-field-error">{activityError}</small>
                          ) : null}
                        </label>
                      )}
                    </activityForm.Field>
                    <activityForm.Field name="nextAction">
                      {(field) => (
                        <label className="commercial-field commercial-field--full">
                          <span>Next action</span>
                          <input
                            value={field.state.value}
                            onChange={(event) => field.handleChange(event.target.value)}
                          />
                        </label>
                      )}
                    </activityForm.Field>
                    <div className="commercial-modal-footer-actions commercial-field--full">
                      <button
                        type="button"
                        className="commercial-btn"
                        onClick={() => setAddingUpdate(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="commercial-btn commercial-btn-primary"
                        disabled={saving}
                      >
                        Save update
                      </button>
                    </div>
                  </form>
                ) : null}

                {order.activities.length === 0 ? (
                  <div className="commercial-empty">No activity recorded yet.</div>
                ) : (
                  <div className="commercial-timeline-list fulfillment-order-activity-list">
                    {[...order.activities].reverse().map((activity) => (
                      <article className="commercial-tl" key={activity.id}>
                        <b>{statusLabel(activity.activityType)}</b>
                        <p>{activity.note}</p>
                        {activity.nextAction ? (
                          <p>
                            <strong>Next:</strong> {activity.nextAction}
                          </p>
                        ) : null}
                        <time>
                          {new Date(activity.createdAt).toLocaleString('en-GB')} ·{' '}
                          {visibilityLabel(activity.visibility)}
                        </time>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="fulfillment-order-room-aside">
              <section className="commercial-form-section commercial-form-section--compact">
                <div className="commercial-form-section-heading">
                  <h3>Order controls</h3>
                  {canUpdate ? (
                    <button
                      type="button"
                      className="commercial-btn commercial-btn-small"
                      disabled={saving}
                      onClick={() => setEditing(true)}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
                <div className="commercial-info-grid">
                  <div>
                    <div className="commercial-kl">Status</div>
                    <b>{statusLabel(order.orderStatus)}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Progress</div>
                    <b>{order.progress}%</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Stage</div>
                    <b>{order.stage || '—'}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Due</div>
                    <b>{dueSummary}</b>
                  </div>
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Assigned to</div>
                    <b>{assignedEmployeeName}</b>
                  </div>
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Next action</div>
                    <b>{order.nextAction || '—'}</b>
                  </div>
                </div>
              </section>

              <section className="commercial-form-section commercial-form-section--compact">
                <h3>Commercial</h3>
                <div className="commercial-info-grid">
                  <div>
                    <div className="commercial-kl">Order value</div>
                    <b>{formatCurrency(order.amount)}</b>
                  </div>
                  <div>
                    <div className="commercial-kl">Payment</div>
                    <b>{statusLabel(order.paymentStatus)}</b>
                  </div>
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Invoice</div>
                    <b>{invoiceNumber || (order.invoiceId ? `#${order.invoiceId}` : '—')}</b>
                  </div>
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Quote</div>
                    <b>{order.quoteNumber || (order.quoteId ? `#${order.quoteId}` : '—')}</b>
                  </div>
                  <div className="commercial-info-full">
                    <div className="commercial-kl">Service request</div>
                    <b>{order.serviceRequestId ? `#${order.serviceRequestId}` : '—'}</b>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" onClick={onClose}>
            Close
          </button>
          <div className="commercial-modal-footer-actions">
            <button type="button" className="commercial-btn" onClick={onOpenTasks}>
              Tasks
            </button>
            <button type="button" className="commercial-btn" onClick={onOpenDeliverables}>
              Deliverables
            </button>
          </div>
        </footer>
      </section>

      {editing ? (
        <div
          className="commercial-modal-backdrop commercial-modal-backdrop--nested"
          role="presentation"
          onMouseDown={() => setEditing(false)}
        >
          <form
            className="commercial-modal commercial-order-controls-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit order controls"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void editForm.handleSubmit()
            }}
          >
            <header className="commercial-modal-header">
              <div>
                <h2>Edit order controls</h2>
                <p>{order.orderNumber}</p>
              </div>
              <div className="commercial-modal-header-meta">
                <button
                  type="button"
                  className="commercial-modal-close"
                  onClick={() => setEditing(false)}
                  aria-label="Close"
                >
                  <IconX size={16} />
                </button>
              </div>
            </header>

            <div className="commercial-modal-body">
              <div className="commercial-form-grid">
                <editForm.Field name="assignedToId">
                  {(field) => (
                    <DropdownSelect
                      label="Assigned employee"
                      fieldClassName="commercial-field"
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
                </editForm.Field>
                <editForm.Field name="dueDate">
                  {(field) => (
                    <DatePicker
                      label="Due date"
                      clearable
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                      fieldClassName="commercial-field"
                    />
                  )}
                </editForm.Field>
                <editForm.Field name="nextAction">
                  {(field) => (
                    <label className="commercial-field commercial-field--full">
                      <span>Next action</span>
                      <input
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </label>
                  )}
                </editForm.Field>
                <editForm.Field name="description">
                  {(field) => (
                    <label className="commercial-field commercial-field--full">
                      <span>Description</span>
                      <textarea
                        rows={3}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </label>
                  )}
                </editForm.Field>
              </div>
            </div>

            <footer className="commercial-modal-footer">
              <button
                type="button"
                className="commercial-btn"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <div className="commercial-modal-footer-actions">
                <button
                  type="submit"
                  className="commercial-btn commercial-btn-primary"
                  disabled={saving}
                >
                  Save
                </button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}

      {addingMilestone ? (
        <div
          className="commercial-modal-backdrop commercial-modal-backdrop--nested"
          role="presentation"
          onMouseDown={() => setAddingMilestone(false)}
        >
          <form
            className="commercial-modal commercial-order-controls-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add milestone"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void milestoneForm.handleSubmit()
            }}
          >
            <header className="commercial-modal-header">
              <div>
                <h2>Add milestone</h2>
                <p>{order.orderNumber}</p>
              </div>
              <div className="commercial-modal-header-meta">
                <button
                  type="button"
                  className="commercial-modal-close"
                  onClick={() => setAddingMilestone(false)}
                  aria-label="Close"
                >
                  <IconX size={16} />
                </button>
              </div>
            </header>

            <div className="commercial-modal-body">
              <div className="commercial-form-grid">
                <milestoneForm.Field name="name">
                  {(field) => (
                    <label className="commercial-field commercial-field--full">
                      <span>
                        Milestone name <em>*</em>
                      </span>
                      <input
                        value={field.state.value}
                        onChange={(event) => {
                          setMilestoneError('')
                          field.handleChange(event.target.value)
                        }}
                      />
                      {milestoneError ? (
                        <small className="commercial-field-error">{milestoneError}</small>
                      ) : null}
                    </label>
                  )}
                </milestoneForm.Field>
                <milestoneForm.Field name="dueDate">
                  {(field) => (
                    <DatePicker
                      label="Due date"
                      clearable
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                      fieldClassName="commercial-field"
                    />
                  )}
                </milestoneForm.Field>
                <milestoneForm.Field name="clientVisible">
                  {(field) => (
                    <DropdownSelect
                      label="Visibility"
                      fieldClassName="commercial-field"
                      options={[
                        { value: 'client', label: 'Internal and client' },
                        { value: 'internal', label: 'Internal only' },
                      ]}
                      value={field.state.value ? 'client' : 'internal'}
                      onChange={(value) => field.handleChange(value === 'client')}
                    />
                  )}
                </milestoneForm.Field>
              </div>
            </div>

            <footer className="commercial-modal-footer">
              <button
                type="button"
                className="commercial-btn"
                onClick={() => setAddingMilestone(false)}
              >
                Cancel
              </button>
              <div className="commercial-modal-footer-actions">
                <button
                  type="submit"
                  className="commercial-btn commercial-btn-primary"
                  disabled={saving}
                >
                  Add milestone
                </button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  )
}
