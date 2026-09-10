import { IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'

import { DropdownSelect } from '@/shared/ui/dropdown-select'

import type { CreateDeliverableInput } from '../types/fulfillment.types'

export function CreateDeliverableWorkspace({
  initialOrderId = '',
  saving,
  onClose,
  onSubmit,
}: {
  initialOrderId?: string
  saving: boolean
  onClose: () => void
  onSubmit: (input: CreateDeliverableInput) => void
}) {
  const [error, setError] = useState('')
  const form = useForm({
    defaultValues: {
      orderId: initialOrderId,
      title: '',
      type: 'Report' as const,
      version: 'v1',
      clientVisible: true,
      approvalMode: 'Supervisor approval' as const,
      fileName: '',
    },
  })

  return (
    <div className="fulfillment-modal-backdrop" onMouseDown={onClose}>
      <form
        className="fulfillment-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          const value = form.state.values
          if (!value.orderId.trim() || !value.title.trim() || !value.version.trim()) {
            setError('Complete the order, title and version.')
            return
          }
          setError('')
          onSubmit(value)
        }}
      >
        <header className="fulfillment-modal-header">
          <h2>Add Deliverable / Document</h2>
          <button
            type="button"
            className="fulfillment-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </header>
        <div className="fulfillment-modal-body">
          {error ? <div className="fulfillment-notice fulfillment-notice-red">{error}</div> : null}
          <div className="fulfillment-form-grid">
            <form.Field name="orderId">
              {(f) => (
                <label className="fulfillment-field">
                  <span>Order</span>
                  <input value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
                </label>
              )}
            </form.Field>
            <form.Field name="title">
              {(f) => (
                <label className="fulfillment-field">
                  <span>Title</span>
                  <input value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
                </label>
              )}
            </form.Field>
            <form.Field name="type">
              {(f) => (
                <DropdownSelect
                  label="Type"
                  fullWidth
                  fieldClassName="fulfillment-field"
                  options={[
                    'Report',
                    'Drawing',
                    'Survey Plan',
                    'Certificate',
                    'Legal Document',
                    'Progress Evidence',
                    'Handover File',
                  ].map((type) => ({ value: type, label: type }))}
                  value={f.state.value}
                  onChange={(value) => f.handleChange(value as typeof f.state.value)}
                />
              )}
            </form.Field>
            <form.Field name="version">
              {(f) => (
                <label className="fulfillment-field">
                  <span>Version</span>
                  <input value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
                </label>
              )}
            </form.Field>
            <form.Field name="clientVisible">
              {(f) => (
                <DropdownSelect
                  label="Client visibility"
                  fullWidth
                  fieldClassName="fulfillment-field"
                  options={[
                    { value: 'Visible to client', label: 'Visible to client' },
                    { value: 'Internal only', label: 'Internal only' },
                  ]}
                  value={f.state.value ? 'Visible to client' : 'Internal only'}
                  onChange={(value) => f.handleChange(value === 'Visible to client')}
                />
              )}
            </form.Field>
            <form.Field name="approvalMode">
              {(f) => (
                <DropdownSelect
                  label="Approval"
                  fullWidth
                  fieldClassName="fulfillment-field"
                  options={[
                    { value: 'Supervisor approval', label: 'Supervisor approval' },
                    { value: 'Client approval', label: 'Client approval' },
                    { value: 'No approval', label: 'No approval' },
                  ]}
                  value={f.state.value}
                  onChange={(value) => f.handleChange(value as typeof f.state.value)}
                />
              )}
            </form.Field>
            <form.Field name="fileName">
              {(f) => (
                <label className="fulfillment-field fulfillment-field-full">
                  <span>Upload file</span>
                  <input
                    value={f.state.value}
                    placeholder="File name or document reference"
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                </label>
              )}
            </form.Field>
          </div>
        </div>
        <footer className="fulfillment-modal-footer">
          <button type="button" className="fulfillment-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="fulfillment-btn fulfillment-btn-primary"
            disabled={saving}
          >
            {saving ? 'Adding...' : 'Add Deliverable'}
          </button>
        </footer>
      </form>
    </div>
  )
}
