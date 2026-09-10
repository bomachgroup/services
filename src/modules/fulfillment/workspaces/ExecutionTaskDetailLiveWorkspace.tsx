import { IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useEffect, useState } from 'react'

import { DatePicker } from '@/shared/ui/date-picker'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'

import type {
  ExecutionTask,
  UpdateExecutionTaskInput,
} from '../execution-tasks/execution-task.types'
import { executionTaskPriorities } from '../execution-tasks/execution-task.types'
import { validateExecutionTaskUpdate } from '../execution-tasks/execution-task.validation'
import type { EmployeeOption, ServiceOrder } from '../service-orders/service-order.types'
import { TaskModalShell } from './TaskModalShell'

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusClass(status: ExecutionTask['status']) {
  if (status === 'done') return 'commercial-pill-green'
  if (status === 'review') return 'commercial-pill-yellow'
  if (status === 'in_progress') return 'commercial-pill-blue'
  if (status === 'cancelled') return 'commercial-pill-gray'
  return 'commercial-pill-blue'
}

function priorityClass(priority: ExecutionTask['priority']) {
  if (priority === 'critical') return 'commercial-pill-red'
  if (priority === 'high') return 'commercial-pill-yellow'
  return 'commercial-pill-gray'
}

function lifecycleLabel(status: ExecutionTask['status']) {
  if (status === 'to_do') return 'Start task'
  if (status === 'in_progress') return 'Submit for review'
  if (status === 'review') return 'Complete task'
  return ''
}

function assigneeLabel(employee: EmployeeOption) {
  return `${employee.name}${employee.designation ? ` · ${employee.designation}` : ''}`
}

function emptyText(value: string) {
  return value.trim() ? value : '—'
}

export function ExecutionTaskDetailLiveWorkspace({
  task,
  order,
  employees,
  saving,
  canUpdate,
  onClose,
  onUpdate,
  onAdvance,
  onCancel,
  onDelete,
}: {
  task: ExecutionTask
  order: ServiceOrder
  employees: EmployeeOption[]
  saving: boolean
  canUpdate: boolean
  onClose: () => void
  onUpdate: (input: UpdateExecutionTaskInput) => void
  onAdvance: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [pendingAssigneeId, setPendingAssigneeId] = useState(0)
  const [error, setError] = useState('')
  const milestone = order.milestones.find((item) => item.id === task.milestoneId) ?? null
  const employeeNames = new Map(employees.map((employee) => [employee.id, employee.name]))
  const ownerName = task.ownerId
    ? (employeeNames.get(task.ownerId) ?? `Employee #${task.ownerId}`)
    : 'Unassigned'
  const assigneeNames = task.assigneeIds.map((id) => employeeNames.get(id) ?? `Employee #${id}`)
  const canEditTask = canUpdate && task.status !== 'done'
  const nextLifecycle = lifecycleLabel(task.status)

  const form = useForm({
    defaultValues: {
      milestoneId: task.milestoneId ?? 0,
      title: task.title,
      description: task.description,
      instructions: task.instructions,
      acceptanceCriteria: task.acceptanceCriteria,
      ownerId: task.ownerId ?? 0,
      assigneeIds: task.assigneeIds,
      dueDate: task.dueDate ?? '',
      priority: task.priority,
      evidenceRequired: task.evidenceRequired,
    },
    onSubmit: ({ value }) => {
      const input: UpdateExecutionTaskInput = {
        milestoneId: value.milestoneId || null,
        title: value.title.trim(),
        description: value.description.trim(),
        instructions: value.instructions.trim(),
        acceptanceCriteria: value.acceptanceCriteria.trim(),
        ownerId: value.ownerId || null,
        assigneeIds: value.assigneeIds,
        dueDate: value.dueDate || null,
        priority: value.priority,
        evidenceRequired: value.evidenceRequired,
      }

      const validationError = validateExecutionTaskUpdate(input)
      setError(validationError)
      if (validationError) return

      onUpdate(input)
      setEditing(false)
    },
  })

  useEffect(() => {
    form.setFieldValue('milestoneId', task.milestoneId ?? 0)
    form.setFieldValue('title', task.title)
    form.setFieldValue('description', task.description)
    form.setFieldValue('instructions', task.instructions)
    form.setFieldValue('acceptanceCriteria', task.acceptanceCriteria)
    form.setFieldValue('ownerId', task.ownerId ?? 0)
    form.setFieldValue('assigneeIds', task.assigneeIds)
    form.setFieldValue('dueDate', task.dueDate ?? '')
    form.setFieldValue('priority', task.priority)
    form.setFieldValue('evidenceRequired', task.evidenceRequired)
    queueMicrotask(() => {
      setError('')
    })
  }, [form, task])

  const selectedAssigneeIds = form.state.values.assigneeIds
  const availableAssignees = employees.filter(
    (employee) => !selectedAssigneeIds.includes(employee.id),
  )

  return (
    <>
      <TaskModalShell
        ariaLabel={`Execution Task ${task.taskNumber}`}
        title={task.taskNumber}
        subtitle={`${task.title} · ${order.orderNumber} · ${order.serviceName}`}
        headerMeta={
          <span className={`commercial-pill ${statusClass(task.status)}`}>
            {label(task.status)}
          </span>
        }
        onClose={onClose}
        footer={
          <>
            <button type="button" className="commercial-btn" onClick={onClose}>
              Close
            </button>
            <div className="commercial-modal-footer-actions">
              {canUpdate && nextLifecycle ? (
                <button
                  type="button"
                  className="commercial-btn commercial-btn-primary"
                  disabled={saving}
                  onClick={onAdvance}
                >
                  {saving ? 'Updating...' : nextLifecycle}
                </button>
              ) : null}
            </div>
          </>
        }
      >
        <div className="fulfillment-order-room-layout">
          <div className="fulfillment-order-room-main">
            <section className="commercial-form-section">
              <h3>Overview</h3>
              <div className="commercial-info-grid">
                <div>
                  <div className="commercial-kl">Order</div>
                  <b>{order.orderNumber}</b>
                </div>
                <div>
                  <div className="commercial-kl">Service</div>
                  <b>{order.serviceName}</b>
                </div>
                <div>
                  <div className="commercial-kl">Milestone</div>
                  <b>{milestone?.name ?? '—'}</b>
                </div>
                <div>
                  <div className="commercial-kl">Owner</div>
                  <b>{ownerName}</b>
                </div>
                <div>
                  <div className="commercial-kl">Due date</div>
                  <b>{task.dueDate || '—'}</b>
                </div>
                <div>
                  <div className="commercial-kl">Priority</div>
                  <b>
                    <span className={`commercial-pill ${priorityClass(task.priority)}`}>
                      {label(task.priority)}
                    </span>
                  </b>
                </div>
                <div>
                  <div className="commercial-kl">Evidence</div>
                  <b>{task.evidenceRequired ? 'Required' : 'Not required'}</b>
                </div>
                <div>
                  <div className="commercial-kl">Status</div>
                  <b>{label(task.status)}</b>
                </div>
              </div>
            </section>

            <section className="commercial-form-section">
              <h3>Scope</h3>
              <div className="commercial-info-grid">
                <div className="commercial-info-full">
                  <div className="commercial-kl">Description</div>
                  <p>{emptyText(task.description)}</p>
                </div>
                <div className="commercial-info-full">
                  <div className="commercial-kl">Instructions</div>
                  <p>{emptyText(task.instructions)}</p>
                </div>
                <div className="commercial-info-full">
                  <div className="commercial-kl">Acceptance criteria</div>
                  <p>{emptyText(task.acceptanceCriteria)}</p>
                </div>
              </div>
            </section>

            <section className="commercial-form-section">
              <h3>Assignment</h3>
              <div className="commercial-info-grid">
                <div>
                  <div className="commercial-kl">Owner</div>
                  <b>{ownerName}</b>
                </div>
                <div className="commercial-info-full">
                  <div className="commercial-kl">Assignees</div>
                  {assigneeNames.length ? (
                    <div className="fulfillment-status-badge-row">
                      {assigneeNames.map((name) => (
                        <span key={name} className="commercial-pill commercial-pill-gray">
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <b>—</b>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="fulfillment-order-room-aside">
            <section className="commercial-form-section commercial-form-section--compact">
              <h3>Lifecycle</h3>
              <div className="commercial-info-grid">
                <div className="commercial-info-full">
                  <div className="commercial-kl">Current status</div>
                  <b>{label(task.status)}</b>
                </div>
                <div className="commercial-info-full">
                  <div className="commercial-kl">Milestone</div>
                  <b>{milestone?.name ?? '—'}</b>
                </div>
              </div>

              {canUpdate ? (
                <div className="fulfillment-task-aside-actions">
                  {nextLifecycle ? (
                    <button
                      type="button"
                      className="commercial-btn commercial-btn-primary"
                      disabled={saving}
                      onClick={onAdvance}
                    >
                      {saving ? 'Updating...' : nextLifecycle}
                    </button>
                  ) : null}
                  {!['done', 'cancelled'].includes(task.status) ? (
                    <button
                      type="button"
                      className="commercial-btn"
                      disabled={saving}
                      onClick={onCancel}
                    >
                      Cancel task
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="commercial-form-section commercial-form-section--compact">
              <div className="commercial-form-section-heading">
                <h3>Task controls</h3>
              </div>
              {canUpdate ? (
                <div className="fulfillment-task-aside-actions">
                  <button
                    type="button"
                    className="commercial-btn"
                    disabled={saving || !canEditTask}
                    onClick={() => {
                      setError('')
                      setEditing(true)
                    }}
                  >
                    Edit task
                  </button>
                  <button
                    type="button"
                    className="commercial-btn"
                    disabled={saving}
                    onClick={onDelete}
                  >
                    Delete task
                  </button>
                </div>
              ) : (
                <div className="commercial-notice commercial-notice-blue">
                  You have read-only access to this task.
                </div>
              )}
            </section>
          </aside>
        </div>
      </TaskModalShell>

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
            aria-label="Edit execution task"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <header className="commercial-modal-header">
              <div>
                <h2>Edit task</h2>
                <p>{task.taskNumber}</p>
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
              {error ? <div className="commercial-notice commercial-notice-red">{error}</div> : null}

              <section className="commercial-form-section">
                <h3>Task details</h3>
                <div className="commercial-form-grid">
                  <form.Field name="title">
                    {(field) => (
                      <label className="commercial-field commercial-field--full">
                        <span>
                          Task title <em>*</em>
                        </span>
                        <input
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </label>
                    )}
                  </form.Field>

                  <form.Field name="priority">
                    {(field) => (
                      <DropdownSelect
                        label="Priority"
                        fieldClassName="commercial-field"
                        options={mapDropdownOptions(executionTaskPriorities)}
                        value={field.state.value}
                        onChange={(value) =>
                          field.handleChange(value as typeof field.state.value)
                        }
                      />
                    )}
                  </form.Field>

                  <form.Field name="dueDate">
                    {(field) => (
                      <DatePicker
                        label="Due date"
                        clearable
                        value={field.state.value}
                        fieldClassName="commercial-field"
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="milestoneId">
                    {(field) => (
                      <DropdownSelect
                        label="Milestone"
                        fieldClassName="commercial-field"
                        options={[
                          { value: '0', label: 'No milestone' },
                          ...mapDropdownOptions(
                            [...order.milestones]
                              .sort(
                                (left, right) =>
                                  left.sortOrder - right.sortOrder || left.id - right.id,
                              )
                              .map((item) => ({
                                value: String(item.id),
                                label: `${item.name} · ${label(item.status)}`,
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
                        options={[
                          { value: '0', label: 'Unassigned' },
                          ...mapDropdownOptions(
                            employees.map((employee) => ({
                              value: String(employee.id),
                              label: assigneeLabel(employee),
                            })),
                          ),
                        ]}
                        value={String(field.state.value)}
                        onChange={(value) => field.handleChange(Number(value))}
                      />
                    )}
                  </form.Field>

                  <form.Field name="assigneeIds">
                    {(field) => (
                      <div className="commercial-field commercial-field--full">
                        <span>Assignees</span>
                        <div className="commercial-assignee-picker">
                          <DropdownSelect
                            fullWidth
                            placeholder={
                              availableAssignees.length > 0
                                ? 'Add a team member'
                                : 'No more team members available'
                            }
                            disabled={availableAssignees.length === 0}
                            options={mapDropdownOptions(
                              availableAssignees.map((employee) => ({
                                value: String(employee.id),
                                label: assigneeLabel(employee),
                              })),
                            )}
                            value={pendingAssigneeId ? String(pendingAssigneeId) : ''}
                            onChange={(value) => {
                              const nextId = Number(value)
                              if (!nextId || field.state.value.includes(nextId)) return
                              field.handleChange([...field.state.value, nextId])
                              setPendingAssigneeId(0)
                            }}
                          />

                          {field.state.value.length > 0 ? (
                            <div className="commercial-assignee-chips">
                              {field.state.value.map((employeeId) => {
                                const employee = employees.find((item) => item.id === employeeId)
                                if (!employee) return null
                                return (
                                  <span key={employee.id} className="commercial-assignee-chip">
                                    <b>{employee.name}</b>
                                    <small>{employee.designation || 'Team member'}</small>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        field.handleChange(
                                          field.state.value.filter((id) => id !== employee.id),
                                        )
                                      }
                                      aria-label={`Remove ${employee.name}`}
                                    >
                                      ×
                                    </button>
                                  </span>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </form.Field>
                </div>
              </section>

              <section className="commercial-form-section">
                <h3>Scope</h3>
                <div className="commercial-form-grid">
                  <form.Field name="description">
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
                  </form.Field>

                  <form.Field name="instructions">
                    {(field) => (
                      <label className="commercial-field commercial-field--full">
                        <span>Instructions</span>
                        <textarea
                          rows={3}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </label>
                    )}
                  </form.Field>

                  <form.Field name="acceptanceCriteria">
                    {(field) => (
                      <label className="commercial-field commercial-field--full">
                        <span>Acceptance criteria</span>
                        <textarea
                          rows={3}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </label>
                    )}
                  </form.Field>

                  <form.Field name="evidenceRequired">
                    {(field) => (
                      <label className="commercial-check commercial-field--full">
                        <input
                          type="checkbox"
                          checked={field.state.value}
                          onChange={(event) => field.handleChange(event.target.checked)}
                        />
                        <span>
                          <b>Evidence required</b>
                          <small>Require proof of completion before closing this task.</small>
                        </span>
                      </label>
                    )}
                  </form.Field>
                </div>
              </section>
            </div>

            <footer className="commercial-modal-footer">
              <button
                type="button"
                className="commercial-btn"
                disabled={saving}
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
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}
    </>
  )
}
