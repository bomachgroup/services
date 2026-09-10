import { IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'

import { DropdownSelect } from '@/shared/ui/dropdown-select'

import type { ServiceOrder } from '@/modules/fulfillment/types/fulfillment.types'

import type { CreateFeedbackInput } from '../types/experience-intelligence.types'

export function RecordFeedbackWorkspace({
  orders,
  initialOrderId = '',
  saving,
  onClose,
  onSubmit,
}: {
  orders: ServiceOrder[]
  initialOrderId?: string
  saving: boolean
  onClose: () => void
  onSubmit: (input: CreateFeedbackInput) => void
}) {
  const [error, setError] = useState('')
  const form = useForm({
    defaultValues: {
      orderId: initialOrderId || orders[0]?.id || '',
      type: 'Completion' as const,
      rating: 5 as const,
      status: 'Closed' as const,
      comment: '',
      correctiveAction: '',
    },
  })

  return (
    <div className="experience-modal-backdrop" onMouseDown={onClose}>
      <form
        className="experience-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const value = form.state.values

          if (!value.orderId || !value.comment.trim()) {
            setError('Select an order and enter the client comment.')
            return
          }

          setError('')
          onSubmit(value)
        }}
      >
        <header className="experience-modal-header">
          <h2>Record Client Feedback</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </header>

        <div className="experience-modal-body">
          {error ? <div className="experience-notice experience-notice-red">{error}</div> : null}

          <div className="experience-form-grid">
            <form.Field name="orderId">
              {(field) => (
                <DropdownSelect
                  label="Order"
                  fullWidth
                  fieldClassName="experience-field"
                  options={orders.map((order) => ({
                    value: order.id,
                    label: `${order.id} — ${order.client}`,
                  }))}
                  value={field.state.value}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>

            <form.Field name="type">
              {(field) => (
                <DropdownSelect
                  label="Type"
                  fullWidth
                  fieldClassName="experience-field"
                  options={[
                    'Completion',
                    'Milestone',
                    'Complaint',
                    'Defect / Rework',
                    'Testimonial',
                    'Referral',
                  ].map((type) => ({ value: type, label: type }))}
                  value={field.state.value}
                  onChange={(value) => field.handleChange(value as typeof field.state.value)}
                />
              )}
            </form.Field>

            <form.Field name="rating">
              {(field) => (
                <DropdownSelect
                  label="Rating"
                  fullWidth
                  fieldClassName="experience-field"
                  options={[
                    { value: '5', label: '5 — Excellent' },
                    { value: '4', label: '4 — Good' },
                    { value: '3', label: '3 — Satisfactory' },
                    { value: '2', label: '2 — Poor' },
                    { value: '1', label: '1 — Very poor' },
                  ]}
                  value={String(field.state.value)}
                  onChange={(value) =>
                    field.handleChange(Number(value) as typeof field.state.value)
                  }
                />
              )}
            </form.Field>

            <form.Field name="status">
              {(field) => (
                <DropdownSelect
                  label="Status"
                  fullWidth
                  fieldClassName="experience-field"
                  options={['Closed', 'Open', 'Action Required'].map((status) => ({
                    value: status,
                    label: status,
                  }))}
                  value={field.state.value}
                  onChange={(value) => field.handleChange(value as typeof field.state.value)}
                />
              )}
            </form.Field>

            <form.Field name="comment">
              {(field) => (
                <label className="experience-field experience-field-full">
                  <span>Client comment</span>
                  <textarea
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </label>
              )}
            </form.Field>

            <form.Field name="correctiveAction">
              {(field) => (
                <label className="experience-field experience-field-full">
                  <span>Corrective action / internal note</span>
                  <textarea
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </label>
              )}
            </form.Field>
          </div>
        </div>

        <footer className="experience-modal-footer">
          <button type="button" className="experience-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="experience-btn experience-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Feedback'}
          </button>
        </footer>
      </form>
    </div>
  )
}
