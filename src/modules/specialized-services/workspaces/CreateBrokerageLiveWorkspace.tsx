import { IconX } from '@tabler/icons-react'
import { useState } from 'react'

import { RealEstateFormDropdown } from '../components/RealEstateFormDropdown'
import {
  brokeragePropertyTypes,
  brokerageStatuses,
  brokerageVerificationStatuses,
  type CreateBrokerageInput,
  type Estate,
} from '../real-estate/real-estate.types'
import { validateBrokerage } from '../real-estate/real-estate.validation'

function parseNonNegativeNumber(value: string, fallback = 0) {
  if (value.trim() === '') return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parsePercentageNumber(value: string, fallback = 0) {
  if (value.trim() === '') return fallback

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(0, parsed))
}

function numberInputValue(value: number | null | undefined) {
  return !value ? '' : String(value)
}

export function CreateBrokerageLiveWorkspace({
  estates,
  defaultEstateId = null,
  saving,
  onClose,
  onSubmit,
}: {
  estates: Estate[]
  defaultEstateId?: number | null
  saving: boolean
  onClose: () => void
  onSubmit: (i: CreateBrokerageInput) => void
}) {
  const [value, setValue] = useState<CreateBrokerageInput>({
    title: '',
    description: '',
    location: '',
    price: 0,
    propertyType: 'land',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    commissionRate: 5,
    verificationStatus: 'pending',
    status: 'available',
    estateId: defaultEstateId,
    tags: [],
  })
  const [tags, setTags] = useState('')
  const [error, setError] = useState('')

  const setField = <K extends keyof CreateBrokerageInput>(
    key: K,
    nextValue: CreateBrokerageInput[K],
  ) => setValue((current) => ({ ...current, [key]: nextValue }))

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="commercial-modal specialized-real-estate-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Brokerage Property"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const input = {
            ...value,
            tags: tags
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          }
          const validationError = validateBrokerage(input)
          setError(validationError)
          if (!validationError) onSubmit(input)
        }}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>Add Brokerage Listing</h2>
            <p>Third-party property offered on commission, with verification and estate linking.</p>
          </div>
          <button
            type="button"
            className="commercial-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </header>

        <div className="commercial-modal-body">
          {error ? <div className="commercial-notice commercial-notice-red">{error}</div> : null}

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Listing profile</h3>
                <p>Market-facing listing information, pricing and brokerage positioning.</p>
              </div>
            </div>

            <div className="commercial-form-grid">
              <label className="commercial-field">
                <span>
                  Property title <em>*</em>
                </span>
                <input
                  autoFocus
                  value={value.title}
                  onChange={(event) => setField('title', event.target.value)}
                />
              </label>

              <RealEstateFormDropdown
                label="Property type"
                options={brokeragePropertyTypes}
                value={value.propertyType}
                onChange={(nextValue) =>
                  setField('propertyType', nextValue as typeof value.propertyType)
                }
              />

              <label className="commercial-field commercial-form-span">
                <span>
                  Location <em>*</em>
                </span>
                <input
                  value={value.location}
                  onChange={(event) => setField('location', event.target.value)}
                />
              </label>

              <label className="commercial-field">
                <span>
                  Asking price <em>*</em>
                </span>
                <input
                  className="commercial-number-input"
                  type="number"
                  min={1}
                  step="any"
                  inputMode="decimal"
                  value={numberInputValue(value.price)}
                  onChange={(event) =>
                    setField('price', parseNonNegativeNumber(event.target.value))
                  }
                />
              </label>

              <label className="commercial-field">
                <span>Commission rate (%)</span>
                <input
                  className="commercial-number-input"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  inputMode="decimal"
                  value={numberInputValue(value.commissionRate)}
                  onChange={(event) =>
                    setField('commissionRate', parsePercentageNumber(event.target.value))
                  }
                />
              </label>

              <RealEstateFormDropdown
                label="Verification"
                options={brokerageVerificationStatuses}
                value={value.verificationStatus}
                onChange={(nextValue) =>
                  setField(
                    'verificationStatus',
                    nextValue as typeof value.verificationStatus,
                  )
                }
              />

              <RealEstateFormDropdown
                label="Market status"
                options={brokerageStatuses}
                value={value.status}
                onChange={(nextValue) =>
                  setField('status', nextValue as typeof value.status)
                }
              />

              <label className="commercial-field commercial-form-span">
                <span>Description</span>
                <textarea
                  value={value.description}
                  onChange={(event) => setField('description', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="commercial-form-section">
            <div className="commercial-form-section-heading">
              <div>
                <h3>Ownership and linkage</h3>
                <p>Mandate giver details, contact data and optional estate relationship.</p>
              </div>
            </div>

            <div className="commercial-form-grid">
              <label className="commercial-field">
                <span>
                  Owner / mandate giver <em>*</em>
                </span>
                <input
                  value={value.ownerName}
                  onChange={(event) => setField('ownerName', event.target.value)}
                />
              </label>

              <label className="commercial-field">
                <span>Owner phone</span>
                <input
                  value={value.ownerPhone}
                  onChange={(event) => setField('ownerPhone', event.target.value)}
                />
              </label>

              <label className="commercial-field">
                <span>Owner email</span>
                <input
                  type="email"
                  value={value.ownerEmail}
                  onChange={(event) => setField('ownerEmail', event.target.value)}
                />
              </label>

              <RealEstateFormDropdown
                label="Related estate"
                searchable
                placeholder="No estate link"
                options={[
                  { value: '0', label: 'No estate link' },
                  ...estates.map((estate) => ({
                    value: String(estate.id),
                    label: `${estate.estateCode} · ${estate.estateName}`,
                  })),
                ]}
                value={value.estateId ? String(value.estateId) : '0'}
                onChange={(nextValue) =>
                  setField('estateId', Number(nextValue) || null)
                }
              />

              <label className="commercial-field commercial-form-span">
                <span>Tags</span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="brokerage, exclusive, urgent"
                />
              </label>
            </div>
          </section>
        </div>

        <footer className="commercial-modal-footer">
          <button type="button" className="commercial-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="commercial-btn commercial-btn-primary" disabled={saving}>
            {saving ? 'Adding...' : 'Add Listing'}
          </button>
        </footer>
      </form>
    </div>
  )
}
