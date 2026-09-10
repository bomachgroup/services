import { useMemo, useState } from 'react'
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconLoader2,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'

import { ApiError } from '@/shared/api/api-error'
import { presentError } from '@/shared/errors'

import type { BoundaryPoint } from './real-estate.types'

function shown(value: number | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) return ''
  return String(value)
}

function sanitizeCoordinateInput(raw: string) {
  let result = ''
  let hasDecimal = false

  for (const char of raw) {
    if (char === ' ' || char === '\t') continue
    if (char === '-' && result.length === 0) {
      result += char
      continue
    }
    if (char >= '0' && char <= '9') {
      result += char
      continue
    }
    if (char === '.' && !hasDecimal) {
      hasDecimal = true
      result += char
    }
  }

  return result
}

function isIncompleteCoordinate(value: string) {
  return value === '' || value === '-' || value === '.' || value === '-.'
}

function parseCoordinate(value: string) {
  const sanitized = sanitizeCoordinateInput(value)
  if (isIncompleteCoordinate(sanitized)) return 0
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : null
}

function draftKey(index: number, key: keyof BoundaryPoint) {
  return `${index}.${key}`
}

function isPointFieldKey(key: string) {
  return /^\d+\.(lat|lng)$/.test(key)
}

function pickPointFieldErrors(source?: Record<string, string> | null) {
  if (!source) return {}
  return Object.fromEntries(Object.entries(source).filter(([key]) => isPointFieldKey(key)))
}

function mapBoundaryMessageToFieldErrors(message: string, points: BoundaryPoint[]) {
  const normalized = message.toLowerCase()
  const nextErrors: Record<string, string> = {}

  if (!message.trim() || points.length === 0) return nextErrors

  const markAll = (text: string) => {
    points.forEach((_, index) => {
      nextErrors[`${index}.lat`] = text
      nextErrors[`${index}.lng`] = text
    })
  }

  if (normalized.includes('duplicate')) {
    markAll('Duplicate point.')
    return nextErrors
  }

  if (normalized.includes('latitude')) {
    points.forEach((point, index) => {
      if (!Number.isFinite(point.lat) || point.lat === 0 || point.lat < -90 || point.lat > 90) {
        nextErrors[`${index}.lat`] = message
      }
    })
  }

  if (normalized.includes('longitude')) {
    points.forEach((point, index) => {
      if (!Number.isFinite(point.lng) || point.lng === 0 || point.lng < -180 || point.lng > 180) {
        nextErrors[`${index}.lng`] = message
      }
    })
  }

  if (
    normalized.includes('cross') ||
    normalized.includes('inside') ||
    normalized.includes('overlap') ||
    normalized.includes('include') ||
    normalized.includes('corner')
  ) {
    markAll(message)
  }

  if (Object.keys(nextErrors).length === 0) {
    markAll(message)
  }

  return nextErrors
}

function extractBoundaryFieldErrors(error: unknown, points: BoundaryPoint[]) {
  if (error instanceof ApiError) {
    const presented = presentError(error, 'form-submit')
    const fromDetails = pickPointFieldErrors(presented.fieldErrors)
    if (Object.keys(fromDetails).length > 0) {
      return {
        message: presented.message,
        fieldErrors: fromDetails,
      }
    }
    return {
      message: presented.message,
      fieldErrors: mapBoundaryMessageToFieldErrors(presented.message, points),
    }
  }

  const message = error instanceof Error ? error.message : 'Boundary could not be validated.'
  return {
    message,
    fieldErrors: mapBoundaryMessageToFieldErrors(message, points),
  }
}

export function BoundaryEditor({
  label = 'Boundary coordinates',
  value,
  onChange,
  onValidate,
  error,
  fieldErrors: submitFieldErrors,
}: {
  label?: string
  value: BoundaryPoint[]
  onChange: (value: BoundaryPoint[]) => void
  onValidate?: ((value: BoundaryPoint[]) => Promise<string>) | undefined
  error?: string | undefined
  fieldErrors?: Record<string, string> | undefined
}) {
  const [validationState, setValidationState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>(
    'idle',
  )
  const [validationMessage, setValidationMessage] = useState('')
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [suppressedSubmitKey, setSuppressedSubmitKey] = useState<string | null>(null)

  const submitKey = `${error ?? ''}|${JSON.stringify(submitFieldErrors ?? {})}`
  const derivedSubmitErrors = useMemo(() => {
    const fromSubmit = pickPointFieldErrors(submitFieldErrors)
    if (Object.keys(fromSubmit).length > 0) return fromSubmit
    if (error) return mapBoundaryMessageToFieldErrors(error, value)
    return {}
  }, [error, submitFieldErrors, value])

  const showSubmitErrors =
    Boolean(error || Object.keys(derivedSubmitErrors).length > 0) &&
    suppressedSubmitKey !== submitKey

  const resetValidation = () => {
    setValidationState('idle')
    setValidationMessage('')
    setLocalFieldErrors({})
    if (showSubmitErrors) setSuppressedSubmitKey(submitKey)
  }

  const clearDrafts = () => setDrafts({})

  const displayCoordinate = (index: number, key: keyof BoundaryPoint, numeric: number) => {
    const keyName = draftKey(index, key)
    if (Object.prototype.hasOwnProperty.call(drafts, keyName)) {
      return drafts[keyName] ?? ''
    }
    return shown(numeric)
  }

  const updateCoordinate = (index: number, key: keyof BoundaryPoint, nextValue: string) => {
    const sanitized = sanitizeCoordinateInput(nextValue)
    const keyName = draftKey(index, key)
    resetValidation()
    setDrafts((current) => ({ ...current, [keyName]: sanitized }))

    const parsed = parseCoordinate(sanitized)
    if (parsed === null) return

    onChange(
      value.map((point, pointIndex) =>
        pointIndex === index ? { ...point, [key]: parsed } : point,
      ),
    )
  }

  const commitCoordinate = (index: number, key: keyof BoundaryPoint) => {
    const keyName = draftKey(index, key)
    const draft = drafts[keyName]
    if (draft === undefined) return

    const parsed = parseCoordinate(draft)
    if (parsed !== null) {
      onChange(
        value.map((point, pointIndex) =>
          pointIndex === index ? { ...point, [key]: parsed } : point,
        ),
      )
    }

    setDrafts((current) => {
      const next = { ...current }
      delete next[keyName]
      return next
    })
  }

  const validateLocalBoundary = () => {
    const nextErrors: Record<string, string> = {}
    let nextMessage = ''

    if (value.length > 0 && value.length < 3) {
      nextMessage = 'Add at least three points to validate this boundary.'
    }

    value.forEach((point, index) => {
      if (!Number.isFinite(point.lat) || point.lat === 0) {
        nextErrors[`${index}.lat`] = 'Enter latitude.'
      } else if (point.lat < -90 || point.lat > 90) {
        nextErrors[`${index}.lat`] = 'Latitude must be between -90 and 90.'
      }

      if (!Number.isFinite(point.lng) || point.lng === 0) {
        nextErrors[`${index}.lng`] = 'Enter longitude.'
      } else if (point.lng < -180 || point.lng > 180) {
        nextErrors[`${index}.lng`] = 'Longitude must be between -180 and 180.'
      }
    })

    const seen = new Map<string, number>()
    value.forEach((point, index) => {
      const key = `${point.lat.toFixed(9)}:${point.lng.toFixed(9)}`
      const existingIndex = seen.get(key)
      if (existingIndex !== undefined) {
        nextErrors[`${index}.lat`] = 'Duplicate point.'
        nextErrors[`${index}.lng`] = 'Duplicate point.'
        nextErrors[`${existingIndex}.lat`] = 'Duplicate point.'
        nextErrors[`${existingIndex}.lng`] = 'Duplicate point.'
        nextMessage = 'Boundary points must not use the same coordinates.'
      }
      seen.set(key, index)
    })

    if (Object.keys(nextErrors).length > 0 || nextMessage) {
      setLocalFieldErrors(nextErrors)
      setValidationState('invalid')
      setValidationMessage(nextMessage || 'Fix the highlighted boundary coordinates.')
      return false
    }

    setLocalFieldErrors({})
    return true
  }

  const move = (index: number, direction: -1 | 1) => {
    const next = [...value]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const current = next[index]
    const swap = next[target]
    if (!current || !swap) return
    next[index] = swap
    next[target] = current
    resetValidation()
    clearDrafts()
    onChange(next)
  }

  const validate = async () => {
    if (!onValidate) return
    if (!validateLocalBoundary()) return
    setValidationState('checking')
    setValidationMessage('')
    try {
      const message = await onValidate(value)
      setLocalFieldErrors({})
      setValidationState('valid')
      setValidationMessage(message)
    } catch (caught) {
      const mapped = extractBoundaryFieldErrors(caught, value)
      setLocalFieldErrors(mapped.fieldErrors)
      setValidationState('invalid')
      setValidationMessage(mapped.message)
    }
  }

  const activeFieldErrors =
    Object.keys(localFieldErrors).length > 0
      ? localFieldErrors
      : showSubmitErrors
        ? derivedSubmitErrors
        : {}
  const submitNotice =
    showSubmitErrors && Object.keys(localFieldErrors).length === 0
      ? error || 'Fix the highlighted boundary coordinates.'
      : ''
  const noticeMessage = validationMessage || submitNotice
  const noticeValid = validationState === 'valid' && Boolean(validationMessage)

  return (
    <section className="commercial-form-section specialized-inline-editor">
      <div className="commercial-form-section-heading">
        <div>
          <h3>{label}</h3>
          <p>Add ordered latitude and longitude points. The polygon closes automatically.</p>
        </div>
        <div className="specialized-boundary-heading-actions">
          <button
            type="button"
            className="commercial-btn"
            onClick={() => {
              resetValidation()
              clearDrafts()
              onChange([...value, { lat: 0, lng: 0 }])
            }}
          >
            <IconPlus size={15} /> Add point
          </button>
          {onValidate ? (
            <button
              type="button"
              className="commercial-btn commercial-btn-soft"
              disabled={validationState === 'checking' || value.length === 0}
              onClick={() => void validate()}
            >
              {validationState === 'checking' ? (
                <IconLoader2 size={15} className="commercial-spin" />
              ) : (
                <IconCheck size={15} />
              )}
              Validate boundary
            </button>
          ) : null}
        </div>
      </div>
      {noticeMessage ? (
        <div
          className={
            noticeValid
              ? 'commercial-notice commercial-notice-green'
              : 'commercial-notice commercial-notice-red'
          }
        >
          {noticeMessage}
        </div>
      ) : null}
      <div className="specialized-boundary-editor">
        {value.length ? (
          value.map((point, index) => {
            const latError = activeFieldErrors[`${index}.lat`]
            const lngError = activeFieldErrors[`${index}.lng`]

            return (
              <div className="specialized-boundary-row" key={index}>
                <div className="specialized-boundary-index">{index + 1}</div>
                <label className={`commercial-field${latError ? ' commercial-field--invalid' : ''}`}>
                  <span>Latitude</span>
                  <input
                    className="commercial-number-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="6.5244"
                    value={displayCoordinate(index, 'lat', point.lat)}
                    onChange={(event) => updateCoordinate(index, 'lat', event.target.value)}
                    onBlur={() => commitCoordinate(index, 'lat')}
                  />
                  {latError ? <small className="commercial-field-error">{latError}</small> : null}
                </label>
                <label className={`commercial-field${lngError ? ' commercial-field--invalid' : ''}`}>
                  <span>Longitude</span>
                  <input
                    className="commercial-number-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="3.3792"
                    value={displayCoordinate(index, 'lng', point.lng)}
                    onChange={(event) => updateCoordinate(index, 'lng', event.target.value)}
                    onBlur={() => commitCoordinate(index, 'lng')}
                  />
                  {lngError ? <small className="commercial-field-error">{lngError}</small> : null}
                </label>
                <div className="specialized-boundary-actions">
                  <button
                    type="button"
                    className="commercial-icon-btn"
                    aria-label="Move point up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <IconArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="commercial-icon-btn"
                    aria-label="Move point down"
                    disabled={index === value.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <IconArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    className="commercial-icon-btn"
                    aria-label="Remove point"
                    onClick={() => {
                      resetValidation()
                      clearDrafts()
                      onChange(value.filter((_, pointIndex) => pointIndex !== index))
                    }}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="commercial-empty">No boundary points added.</div>
        )}
      </div>
    </section>
  )
}
