import { IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { useAuth } from '@/app/auth'
import { hasPermission, PERMISSIONS } from '@/app/permissions'
import type { Invoice } from '@/modules/commercial/billing/billing.types'
import { presentError } from '@/shared/errors'
import { formatCurrency } from '@/shared/lib/formatters'
import { DatePicker } from '@/shared/ui/date-picker'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'

import { serviceOrderQueries } from '../service-orders/service-order.queries'
import { validateOrderCreation } from '../service-orders/service-order.validation'
import type {
  CreateServiceOrderFromInvoiceInput,
  EmployeeOption,
} from '../service-orders/service-order.types'

function statusLabel(value: string) {
  return value.replaceAll('_', ' ')
}

export function CreateServiceOrderLiveWorkspace({
  invoice,
  eligibleInvoices,
  employees,
  invoiceSelectionLocked,
  invoiceSelectionLoading,
  saving,
  onSelectInvoice,
  onClose,
  onSubmit,
}: {
  invoice: Invoice
  eligibleInvoices: Invoice[]
  employees: EmployeeOption[]
  invoiceSelectionLocked: boolean
  invoiceSelectionLoading: boolean
  saving: boolean
  onSelectInvoice: (invoiceId: number) => void
  onClose: () => void
  onSubmit: (input: CreateServiceOrderFromInvoiceInput) => void
}) {
  const [nextActionError, setNextActionError] = useState('')
  const [attachToProject, setAttachToProject] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectSelectionError, setProjectSelectionError] = useState('')
  const { user } = useAuth()
  const canListProjects = hasPermission(user, PERMISSIONS.projectsList)
  const projectsQuery = useQuery({
    ...serviceOrderQueries.projects(invoice.clientId),
    enabled: attachToProject && canListProjects && invoice.clientId > 0,
    retry: false,
  })
  const projects = projectsQuery.data ?? []
  const form = useForm({
    defaultValues: {
      assignedToId: 0,
      dueDate: invoice.dueDate || '',
      description: '',
      nextAction: 'Confirm team and mobilisation',
    },
    onSubmit: ({ value }) => {
      const error = validateOrderCreation(value)
      setNextActionError(error)
      if (error) return
      if (attachToProject && !selectedProjectId) {
        setProjectSelectionError('Choose a project or turn off project linking.')
        return
      }
      onSubmit({
        invoiceId: invoice.id,
        ...(attachToProject ? { projectId: Number(selectedProjectId) } : {}),
        assignedToId: value.assignedToId || null,
        dueDate: value.dueDate,
        description: value.description.trim(),
        nextAction: value.nextAction.trim(),
      })
    },
  })

  useEffect(() => {
    form.setFieldValue('dueDate', invoice.dueDate || '')
  }, [form, invoice.dueDate, invoice.id])

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal commercial-modal--xl commercial-order-create-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create Service Order"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <header className="commercial-modal-header">
          <div className="fulfillment-modal-heading">
            <span className="fulfillment-modal-kicker">Fulfillment setup</span>
            <h2>Create service order</h2>
            <p>
              {invoice.invoiceNumber
                ? `${invoice.invoiceNumber} · ${invoice.serviceName}`
                : 'Mobilise an eligible invoice into fulfillment'}
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
            <h3>Invoice</h3>
            {!invoiceSelectionLocked ? (
              <div className="commercial-form-grid">
                <DropdownSelect
                  label="Invoice"
                  required
                  fullWidth
                  fieldClassName="commercial-field commercial-field--full"
                  disabled={invoiceSelectionLoading}
                  helpText={invoiceSelectionLoading ? 'Loading invoice…' : undefined}
                  options={mapDropdownOptions(
                    eligibleInvoices.map((item) => ({
                      value: String(item.id),
                      label: `${item.invoiceNumber} - ${item.serviceName} - ${formatCurrency(item.totalAmount)}`,
                    })),
                  )}
                  value={String(invoice.id)}
                  onChange={(value) => onSelectInvoice(Number(value))}
                />
              </div>
            ) : null}

            <div className="commercial-info-grid">
              <div>
                <div className="commercial-kl">Invoice</div>
                <b>{invoice.invoiceNumber}</b>
              </div>
              <div>
                <div className="commercial-kl">Client</div>
                <b>{invoice.clientName || `Client #${invoice.clientId}`}</b>
              </div>
              <div>
                <div className="commercial-kl">Service</div>
                <b>{invoice.serviceName}</b>
              </div>
              <div>
                <div className="commercial-kl">Quote</div>
                <b>{invoice.quoteNumber || '-'}</b>
              </div>
              <div>
                <div className="commercial-kl">Order value</div>
                <b>{formatCurrency(invoice.totalAmount)}</b>
              </div>
              <div>
                <div className="commercial-kl">Paid</div>
                <b>{formatCurrency(invoice.amountPaid)}</b>
              </div>
              <div>
                <div className="commercial-kl">Payment status</div>
                <b>{statusLabel(invoice.status)}</b>
              </div>
              <div>
                <div className="commercial-kl">Threshold</div>
                <b>{invoice.activationThresholdMetAt ? 'Met' : 'Pending'}</b>
              </div>
            </div>
          </section>

          <section className="commercial-form-section">
            <h3>Project link</h3>
            <p className="fulfillment-order-project-intro">
              Optionally associate this order with an existing project for the same client.
            </p>
            <label className="fulfillment-order-project-toggle">
              <input
                type="checkbox"
                checked={attachToProject}
                disabled={!canListProjects}
                onChange={(event) => {
                  const checked = event.target.checked
                  setAttachToProject(checked)
                  setProjectSelectionError('')
                  if (!checked) setSelectedProjectId('')
                }}
              />
              <span>
                <b>Attach this order to a project</b>
                <small>
                  {canListProjects
                    ? 'The project will be linked to this Service Order, not the invoice.'
                    : 'Project linking is unavailable because your account cannot list projects.'}
                </small>
              </span>
            </label>

            {attachToProject ? (
              <div className="fulfillment-order-project-picker">
                <DropdownSelect
                  label="Project"
                  required
                  fullWidth
                  searchable
                  fieldClassName="commercial-field commercial-field--full"
                  placeholder="Choose a project"
                  helpText="Only projects belonging to this invoice client are shown."
                  error={projectSelectionError}
                  invalid={Boolean(projectSelectionError)}
                  loading={projectsQuery.isPending}
                  loadingMessage="Loading client projects..."
                  disabled={
                    projectsQuery.isPending || projectsQuery.isError || projects.length === 0
                  }
                  emptyMessage="This client has no projects available."
                  options={mapDropdownOptions(
                    projects.map((project) => ({
                      value: project.id,
                      label: `${project.name}${project.shortCode ? ` (${project.shortCode})` : ''}`,
                      description: project.status.replaceAll('_', ' '),
                    })),
                  )}
                  value={selectedProjectId}
                  onChange={(value) => {
                    setSelectedProjectId(value)
                    setProjectSelectionError('')
                  }}
                />
                {projectsQuery.isError ? (
                  <div className="fulfillment-order-project-message" role="alert">
                    <span>{presentError(projectsQuery.error, 'section-load').message}</span>
                    <button
                      type="button"
                      className="commercial-btn commercial-btn-small"
                      onClick={() => void projectsQuery.refetch()}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                {projectsQuery.isSuccess && projects.length === 0 ? (
                  <p className="fulfillment-order-project-message" role="status">
                    No projects are available for this client. Turn off project linking to continue
                    without one.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="commercial-form-section">
            <h3>Mobilisation</h3>
            <div className="commercial-form-grid">
              <form.Field name="assignedToId">
                {(field) => (
                  <DropdownSelect
                    label="Assigned employee"
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

              <form.Field name="dueDate">
                {(field) => (
                  <DatePicker
                    label="Due date"
                    clearable
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    fieldClassName="commercial-field"
                  />
                )}
              </form.Field>

              <form.Field name="nextAction">
                {(field) => (
                  <label className="commercial-field commercial-field--full">
                    <span>
                      Next action <em>*</em>
                    </span>
                    <input
                      value={field.state.value}
                      onChange={(event) => {
                        if (nextActionError) setNextActionError('')
                        field.handleChange(event.target.value)
                      }}
                      placeholder="What should the team do first?"
                    />
                    {nextActionError ? (
                      <small className="commercial-field-error">{nextActionError}</small>
                    ) : null}
                  </label>
                )}
              </form.Field>

              <form.Field name="description">
                {(field) => (
                  <label className="commercial-field commercial-field--full">
                    <span>Fulfillment description</span>
                    <textarea
                      rows={3}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Operational context for the delivery team"
                    />
                  </label>
                )}
              </form.Field>
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
              disabled={saving || invoiceSelectionLoading}
            >
              {saving ? 'Creating…' : 'Create service order'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}
