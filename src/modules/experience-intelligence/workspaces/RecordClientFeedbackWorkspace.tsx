import { IconX } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { serviceOrderQueries } from '@/modules/fulfillment/service-orders/service-order.queries'
import { DashboardSkeleton, ErrorState } from '@/shared/ui'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'
import { presentError } from '@/shared/errors'

import {
  feedbackStatusOptions,
  feedbackTypeOptions,
  type CreateClientFeedbackInput,
  type FeedbackStatus,
  type FeedbackType,
} from '../feedback/feedback.types'

type RecordClientFeedbackFormValues = {
  orderId: number
  feedbackType: FeedbackType
  rating: 1 | 2 | 3 | 4 | 5
  status: FeedbackStatus
  comment: string
  internalNote: string
}

export function RecordClientFeedbackWorkspace({
  initialOrderId,
  saving,
  onClose,
  onSubmit,
}: {
  initialOrderId?: number | null
  saving: boolean
  onClose: () => void
  onSubmit: (input: CreateClientFeedbackInput) => void
}) {
  const [error, setError] = useState('')

  const ordersQuery = useQuery(
    serviceOrderQueries.list({
      page: 1,
      limit: 100,
    }),
  )

  const orders = useMemo(() => ordersQuery.data?.items ?? [], [ordersQuery.data?.items])
  const firstOrderId = initialOrderId ?? orders[0]?.id ?? 0
  const defaultValues: RecordClientFeedbackFormValues = {
    orderId: firstOrderId,
    feedbackType: 'completion',
    rating: 5,
    status: 'open',
    comment: '',
    internalNote: '',
  }

  const form = useForm({
    defaultValues,
  })

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === form.state.values.orderId) ?? null,
    [form.state.values.orderId, orders],
  )
  const orderSummary = selectedOrder
    ? `${selectedOrder.orderNumber} · ${selectedOrder.serviceName}`
    : 'Select a Service Order'
  const orderProgress = selectedOrder
    ? `${selectedOrder.stage || selectedOrder.orderStatus.replaceAll('_', ' ')} · ${selectedOrder.progress}% complete`
    : 'Choose the Service Order this feedback belongs to.'

  if (ordersQuery.isPending) {
    return (
      <div className="experience-modal-backdrop" onMouseDown={onClose}>
        <section className="experience-modal" onMouseDown={(event) => event.stopPropagation()}>
          <header className="experience-modal-header">
            <h2>Record Client Feedback</h2>
            <button type="button" onClick={onClose} aria-label="Close">
              <IconX size={16} />
            </button>
          </header>
          <div className="experience-modal-body">
            <DashboardSkeleton />
          </div>
        </section>
      </div>
    )
  }

  if (ordersQuery.isError) {
    const presented = presentError(ordersQuery.error, 'section-load')
    return (
      <div className="experience-modal-backdrop" onMouseDown={onClose}>
        <section className="experience-modal" onMouseDown={(event) => event.stopPropagation()}>
          <header className="experience-modal-header">
            <h2>Record Client Feedback</h2>
            <button type="button" onClick={onClose} aria-label="Close">
              <IconX size={16} />
            </button>
          </header>
          <div className="experience-modal-body">
            <ErrorState
              title={presented.title}
              description={presented.message}
              onRetry={() => void ordersQuery.refetch()}
            />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="experience-modal-backdrop" onMouseDown={onClose}>
      <form
        className="experience-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const values = form.state.values

          if (!values.orderId) {
            setError('Select the Service Order the client feedback relates to.')
            return
          }
          if (!values.comment.trim()) {
            setError('Enter the feedback exactly as reported by the client.')
            return
          }

          setError('')
          onSubmit({
            orderId: values.orderId,
            feedbackType: values.feedbackType,
            rating: values.rating,
            status: values.status,
            comment: values.comment.trim(),
            internalNote: values.internalNote.trim(),
          })
        }}
      >
        <header className="experience-modal-header">
          <div>
            <h2>Record Client Feedback</h2>
            <div className="experience-card-subtitle">
              Capture feedback received for a completed or in-progress Service Order.
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </header>

        <div className="experience-modal-body">
          {error ? <div className="experience-notice experience-notice-red">{error}</div> : null}

          <section className="experience-quality-section">
            <header>
              <b>Client Feedback</b>
              <span>Record the client's rating and comment.</span>
            </header>

            <div className="experience-feedback-order-summary">
              <div>
                <b>{orderSummary}</b>
                <span>{orderProgress}</span>
              </div>
            </div>

            <div className="experience-form-grid">
              <form.Field name="orderId">
                {(field) => (
                  <DropdownSelect
                    label="Service Order"
                    required
                    fullWidth
                    fieldClassName="experience-field experience-field-full"
                    placeholder="Select an Order"
                    helpText={selectedOrder ? orderProgress : undefined}
                    options={[
                      { value: '', label: 'Select an Order' },
                      ...mapDropdownOptions(
                        orders.map((order) => ({
                          value: String(order.id),
                          label: `${order.orderNumber} — ${order.serviceName}`,
                        })),
                      ),
                    ]}
                    value={field.state.value ? String(field.state.value) : ''}
                    onChange={(value) => field.handleChange(Number(value))}
                  />
                )}
              </form.Field>

              <form.Field name="feedbackType">
                {(field) => (
                  <DropdownSelect
                    label="Feedback type"
                    required
                    fullWidth
                    fieldClassName="experience-field"
                    options={mapDropdownOptions(feedbackTypeOptions)}
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value as FeedbackType)}
                  />
                )}
              </form.Field>

              <form.Field name="rating">
                {(field) => (
                  <DropdownSelect
                    label="Client rating"
                    required
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
                    onChange={(value) => field.handleChange(Number(value) as 1 | 2 | 3 | 4 | 5)}
                  />
                )}
              </form.Field>

              <form.Field name="comment">
                {(field) => (
                  <label className="experience-field experience-field-full">
                    <span>Client comment *</span>
                    <textarea
                      value={field.state.value}
                      placeholder="Enter the client's comment."
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </label>
                )}
              </form.Field>
            </div>
          </section>

          <section className="experience-quality-section">
            <header>
              <b>Quality Follow-up</b>
              <span>Track the internal response or corrective action.</span>
            </header>

            <div className="experience-form-grid">
              <form.Field name="status">
                {(field) => (
                  <DropdownSelect
                    label="Quality status"
                    fullWidth
                    fieldClassName="experience-field"
                    options={mapDropdownOptions(feedbackStatusOptions)}
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value as FeedbackStatus)}
                  />
                )}
              </form.Field>

              <form.Field name="internalNote">
                {(field) => (
                  <label className="experience-field experience-field-full">
                    <span>Corrective action / internal note</span>
                    <textarea
                      value={field.state.value}
                      placeholder="Optional internal note or corrective action."
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </label>
                )}
              </form.Field>
            </div>
          </section>
        </div>

        <footer className="experience-modal-footer">
          <button type="button" className="experience-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="experience-btn experience-btn-primary"
            disabled={saving || orders.length === 0}
          >
            {saving ? 'Saving...' : 'Save Client Feedback'}
          </button>
        </footer>
      </form>
    </div>
  )
}
