import { useForm } from '@tanstack/react-form'
import { useEffect, useState } from 'react'

import { DatePicker } from '@/shared/ui/date-picker'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'

import type { EmployeeOption, ServiceOrder } from '../service-orders/service-order.types'
import type {
  CreateExecutionTaskInput,
  ExecutionTaskPriority,
} from '../execution-tasks/execution-task.types'
import { executionTaskPriorities } from '../execution-tasks/execution-task.types'
import { validateExecutionTaskCreate } from '../execution-tasks/execution-task.validation'
import { TaskModalShell } from './TaskModalShell'

type CreateExecutionTaskFormValues = {
  milestoneId: number
  title: string
  description: string
  instructions: string
  acceptanceCriteria: string
  ownerId: number
  assigneeIds: number[]
  dueDate: string
  priority: ExecutionTaskPriority
  evidenceRequired: boolean
}

function getDefaultMilestoneId(order: ServiceOrder | null) {
  if (!order) return 0
  const activeMilestones = order.milestones.filter((milestone) => milestone.status === 'active')
  return activeMilestones.length === 1 ? (activeMilestones[0]?.id ?? 0) : 0
}

function assigneeLabel(employee: EmployeeOption) {
  return `${employee.name}${employee.designation ? ` · ${employee.designation}` : ''}`
}

function statusLabel(value: string) {
  return value.replaceAll('_', ' ')
}

export function CreateExecutionTaskLiveWorkspace({
  order,
  orders,
  employees,
  saving,
  onClose,
  onSubmit,
}: {
  order: ServiceOrder | null
  orders: ServiceOrder[]
  employees: EmployeeOption[]
  saving: boolean
  onClose: () => void
  onSubmit: (orderId: number, input: CreateExecutionTaskInput) => void
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(order?.id ?? 0)
  const [pendingAssigneeId, setPendingAssigneeId] = useState(0)
  const [error, setError] = useState('')
  const activeOrder = order ?? orders.find((item) => item.id === selectedOrderId) ?? null

  const defaultMilestoneId = getDefaultMilestoneId(activeOrder)

  const defaultValues: CreateExecutionTaskFormValues = {
    milestoneId: defaultMilestoneId,
    title: '',
    description: '',
    instructions: '',
    acceptanceCriteria: '',
    ownerId: 0,
    assigneeIds: [],
    dueDate: '',
    priority: 'normal',
    evidenceRequired: false,
  }

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      if (!activeOrder) {
        setError('Select a service order before creating a task.')
        return
      }

      const input: CreateExecutionTaskInput = {
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

      const validationError = validateExecutionTaskCreate(input)
      setError(validationError)
      if (validationError) return

      onSubmit(activeOrder.id, input)
    },
  })

  useEffect(() => {
    if (!activeOrder) return
    form.setFieldValue('milestoneId', getDefaultMilestoneId(activeOrder))
  }, [activeOrder, form])

  const selectedAssigneeIds = form.state.values.assigneeIds
  const availableAssignees = employees.filter(
    (employee) => !selectedAssigneeIds.includes(employee.id),
  )

  return (
    <TaskModalShell
      as="form"
      ariaLabel="Create Execution Task"
      title="Create task"
      subtitle={
        activeOrder
          ? `${activeOrder.orderNumber} · ${activeOrder.serviceName}`
          : 'Select a service order to continue'
      }
      className="commercial-task-create-modal"
      bodyClassName="commercial-task-create-body"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      footer={
        <>
          <button type="button" className="commercial-btn" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="commercial-btn commercial-btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create task'}
          </button>
        </>
      }
    >
      <section className="commercial-form-section">
        <h3>Service order</h3>
        {!order ? (
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
                  .map((item) => ({
                    value: String(item.id),
                    label: `${item.orderNumber} · ${item.serviceName}`,
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
              <b>{statusLabel(activeOrder.orderStatus)}</b>
            </div>
          </div>
        ) : null}
      </section>

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
                  placeholder="Short title for the work"
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
                onChange={(value) => field.handleChange(value as typeof field.state.value)}
              />
            )}
          </form.Field>

          <form.Field name="dueDate">
            {(field) => (
              <DatePicker
                label="Due date"
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
                disabled={!activeOrder}
                placeholder="Optional"
                options={[
                  { value: '0', label: 'No milestone' },
                  ...mapDropdownOptions(
                    [...(activeOrder?.milestones ?? [])]
                      .sort((left, right) => left.sortOrder - right.sortOrder)
                      .map((milestone) => ({
                        value: String(milestone.id),
                        label: `${milestone.name} · ${statusLabel(milestone.status)}`,
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
                                  field.state.value.filter((value) => value !== employee.id),
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
              <label className="commercial-field">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="What work does this task cover?"
                />
              </label>
            )}
          </form.Field>

          <form.Field name="instructions">
            {(field) => (
              <label className="commercial-field">
                <span>Instructions</span>
                <textarea
                  rows={4}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="How should the team execute it?"
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
                  placeholder="What must be true before the task can be accepted?"
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
                  <small>Require proof of completion before this task can be closed.</small>
                </span>
              </label>
            )}
          </form.Field>
        </div>
      </section>
    </TaskModalShell>
  )
}
