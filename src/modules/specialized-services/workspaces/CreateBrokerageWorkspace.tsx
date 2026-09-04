import { useForm } from '@tanstack/react-form'

import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'
import type { CreateBrokeragePropertyInput } from '../types/specialized-services.types'
export function CreateBrokerageWorkspace({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean
  onClose: () => void
  onSubmit: (input: CreateBrokeragePropertyInput) => void
}) {
  const form = useForm({
    defaultValues: {
      title: '',
      owner: '',
      location: '',
      price: 0,
      status: 'Pending Verification' as const,
      commissionRate: 5,
    },
  })
  return (
    <div className="specialized-modal-backdrop" onMouseDown={onClose}>
      <form
        className="specialized-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(form.state.values)
        }}
      >
        <header className="specialized-modal-header">
          <h2>Add Brokerage Property</h2>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="specialized-modal-body specialized-form-grid">
          <form.Field name="title">
            {(f) => (
              <label className="specialized-field">
                <span>Property title</span>
                <input value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
              </label>
            )}
          </form.Field>
          <form.Field name="owner">
            {(f) => (
              <label className="specialized-field">
                <span>Owner / mandate giver</span>
                <input value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
              </label>
            )}
          </form.Field>
          <form.Field name="location">
            {(f) => (
              <label className="specialized-field">
                <span>Location</span>
                <input value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
              </label>
            )}
          </form.Field>
          <form.Field name="price">
            {(f) => (
              <label className="specialized-field">
                <span>Asking price</span>
                <input
                  type="number"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(Number(e.target.value || 0))}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="status">
            {(f) => (
              <RealEstateFormDropdown
                label="Verification status"
                fieldClassName="specialized-field"
                options={[
                  { value: 'Pending Verification', label: 'Pending Verification' },
                  { value: 'Verified', label: 'Verified' },
                  { value: 'Inspection Due', label: 'Inspection Due' },
                ]}
                value={f.state.value}
                onChange={(value) => f.handleChange(value as typeof f.state.value)}
              />
            )}
          </form.Field>
          <form.Field name="commissionRate">
            {(f) => (
              <label className="specialized-field">
                <span>Commission rate (%)</span>
                <input
                  type="number"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(Number(e.target.value || 0))}
                />
              </label>
            )}
          </form.Field>
          <label className="specialized-field specialized-field-full">
            <span>Title documents and images</span>
            <input type="file" multiple />
          </label>
        </div>
        <footer className="specialized-modal-footer">
          <button type="button" className="specialized-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="specialized-btn specialized-btn-primary" disabled={saving}>
            Add Listing
          </button>
        </footer>
      </form>
    </div>
  )
}
