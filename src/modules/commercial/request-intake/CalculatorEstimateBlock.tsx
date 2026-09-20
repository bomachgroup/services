import { useEffect, useMemo, useState } from 'react'

import { formatCurrency } from '@/shared/lib/formatters'
import {
  formatGroupedNumberFieldValue,
  parseGroupedNumberFieldValue,
  sanitizeGroupedNumberInput,
} from '@/shared/lib/number-input'
import { DropdownSelect } from '@/shared/ui/dropdown-select'

import type {
  BoundarySurveyEstimateInput,
  EngineeringCategoryOption,
  EngineeringEstimateInput,
  RestablishmentSurveyEstimateInput,
} from '../api/calculator-estimate.types'
import {
  autofillBoundaryInputs,
  autofillEngineeringInputs,
  autofillRestablishmentInputs,
  mergeSavedCalculatorInputs,
} from '../api/calculator-estimate.types'

interface AnswerRow {
  fieldKey: string
  label: string
  value: unknown
}

interface CalculatorEstimateBlockProps {
  calculatorCode: string
  customerType: string
  answersSnapshot: Record<string, unknown>
  answers: AnswerRow[]
  savedInputs: Record<string, unknown>
  estimatedValue: number
  estimating: boolean
  estimateError: string
  categories: EngineeringCategoryOption[]
  categoriesLoading: boolean
  unitPrice: number | null
  onEstimate: (inputs: Record<string, unknown>) => Promise<void>
  onStaleChange: (stale: boolean, inputs: Record<string, unknown>) => void
}

function isConstruction(code: string) {
  return code === 'BUILDING-CONSTRUCTION'
}

function StepperNumberInput({
  label,
  required = false,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  integer = false,
  disabled = false,
  placeholder,
}: {
  label: string
  required?: boolean
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  integer?: boolean
  disabled?: boolean
  placeholder?: string
}) {
  const clampStep = (next: number) => {
    let resolved = integer ? Math.floor(next) : next
    if (!Number.isFinite(resolved)) resolved = min
    resolved = Math.max(min, resolved)
    if (max !== undefined) resolved = Math.min(max, resolved)
    return resolved
  }

  const commitTypedValue = (raw: string) => {
    const sanitized = sanitizeGroupedNumberInput(raw)
    if (sanitized === '' || sanitized === '.') {
      onChange(0)
      return
    }
    const parsed = parseGroupedNumberFieldValue(sanitized)
    onChange(integer ? Math.floor(parsed) : parsed)
  }

  return (
    <label className="commercial-field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <div className="commercial-stepper">
        <button
          type="button"
          className="commercial-stepper-btn"
          disabled={disabled || value <= min}
          onClick={() => onChange(clampStep(value - step))}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          className="commercial-number-input commercial-stepper-input"
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          disabled={disabled}
          value={formatGroupedNumberFieldValue(value)}
          onChange={(event) => commitTypedValue(event.target.value)}
        />
        <button
          type="button"
          className="commercial-stepper-btn"
          disabled={disabled || (max !== undefined && value >= max)}
          onClick={() => onChange(clampStep(value + step))}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
        {value !== 0 ? (
          <button
            type="button"
            className="commercial-stepper-clear"
            disabled={disabled}
            onClick={() => onChange(0)}
            aria-label={`Clear ${label}`}
            title={`Clear ${label}`}
          >
            ×
          </button>
        ) : null}
      </div>
    </label>
  )
}

export function CalculatorEstimateBlock(props: CalculatorEstimateBlockProps) {
  const {
    calculatorCode,
    customerType,
    answersSnapshot,
    answers,
    savedInputs,
    estimatedValue,
    estimating,
    estimateError,
    categories,
    categoriesLoading,
    unitPrice,
    onEstimate,
    onStaleChange,
  } = props

  // Parent remounts this block per request+calculator via `key`, so lazy
  // initial state is sufficient - no reset effect needed.
  const [boundary, setBoundary] = useState<BoundarySurveyEstimateInput>(() =>
    mergeSavedCalculatorInputs(
      autofillBoundaryInputs(answersSnapshot, answers, customerType),
      savedInputs,
    ),
  )
  const [restablishment, setRestablishment] = useState<RestablishmentSurveyEstimateInput>(() =>
    mergeSavedCalculatorInputs(autofillRestablishmentInputs(answersSnapshot, answers), savedInputs),
  )
  const [engineering, setEngineering] = useState<EngineeringEstimateInput>(() =>
    mergeSavedCalculatorInputs(autofillEngineeringInputs(answersSnapshot, answers), savedInputs),
  )
  const [localError, setLocalError] = useState('')
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(
      calculatorCode === 'BOUNDARY-SURVEY'
        ? mergeSavedCalculatorInputs(
            autofillBoundaryInputs(answersSnapshot, answers, customerType),
            savedInputs,
          )
        : calculatorCode === 'RESTABLISHMENT-SURVEY'
          ? mergeSavedCalculatorInputs(
              autofillRestablishmentInputs(answersSnapshot, answers),
              savedInputs,
            )
          : mergeSavedCalculatorInputs(
              autofillEngineeringInputs(answersSnapshot, answers),
              savedInputs,
            ),
    ),
  )

  const currentInputs = useMemo(() => {
    if (calculatorCode === 'BOUNDARY-SURVEY') return boundary
    if (calculatorCode === 'RESTABLISHMENT-SURVEY') return restablishment
    return engineering
  }, [calculatorCode, boundary, restablishment, engineering])

  const stale = estimatedValue > 0 && JSON.stringify(currentInputs) !== baseline

  // Notify the parent (external system) when staleness flips. Comparing the
  // serialized payload keeps this effect tied to real input changes only.
  const staleKey = `${stale}:${JSON.stringify(currentInputs)}`
  useEffect(() => {
    onStaleChange(stale, currentInputs as unknown as Record<string, unknown>)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleKey])

  const markBaseline = (inputs: Record<string, unknown>) => {
    setBaseline(JSON.stringify(inputs))
  }

  const validate = (): string => {
    if (calculatorCode === 'BOUNDARY-SURVEY') {
      if (!(boundary.area > 0)) return 'Enter the land area before estimating.'
      if (!(boundary.plots >= 1)) return 'Plots must be at least 1.'
      if (boundary.plots > 1 && boundary.single_plan === null)
        return 'Choose whether the plots share a single plan.'
      return ''
    }
    if (calculatorCode === 'RESTABLISHMENT-SURVEY') {
      if (!(restablishment.number_of_beacons >= 1))
        return 'Enter the number of beacons (at least 1).'
      return ''
    }
    if (!engineering.category_name.trim()) return 'Select an engineering category.'
    if (!(engineering.number_of_bedrooms >= 0 && Number.isInteger(engineering.number_of_bedrooms)))
      return 'Bedrooms must be a whole number.'
    if (!(engineering.number_of_floors >= 0 && Number.isInteger(engineering.number_of_floors)))
      return 'Floors must be a whole number.'
    return ''
  }

  const handleEstimate = async () => {
    const message = validate()
    setLocalError(message)
    if (message) return
    const payload = { ...(currentInputs as unknown as Record<string, unknown>) }
    try {
      await onEstimate(payload)
      // Only accept the inputs as the new baseline after the server saved the
      // matching estimate. A failed calculation must remain stale.
      markBaseline(payload)
    } catch {
      // The parent owns the user-facing error and toast.
    }
  }

  const readyToEstimate = (() => {
    if (calculatorCode === 'BOUNDARY-SURVEY') {
      if (!(boundary.area > 0)) return false
      if (!(boundary.plots >= 1)) return false
      if (boundary.plots > 1 && boundary.single_plan === null) return false
      return true
    }
    if (calculatorCode === 'RESTABLISHMENT-SURVEY') {
      return restablishment.number_of_beacons >= 1
    }
    return engineering.category_name.trim() !== ''
  })()

  const statusLine =
    stale && estimatedValue > 0 ? (
      <div className="commercial-notice commercial-notice-yellow">
        Inputs changed since the last estimate. Re-run the estimate - the old{' '}
        {formatCurrency(estimatedValue)} must not be quoted.
      </div>
    ) : null

  return (
    <section className="commercial-form-section commercial-calculator-card">
      <div className="commercial-form-section-heading">
        <div>
          <h3>Calculator pricing · {calculatorCode}</h3>
        </div>
        {estimatedValue > 0 && !stale ? (
          <span className="commercial-pill commercial-pill-green">
            {formatCurrency(estimatedValue)}
          </span>
        ) : null}
      </div>

      {statusLine}
      {localError ? (
        <div className="commercial-notice commercial-notice-red">{localError}</div>
      ) : null}
      {estimateError ? (
        <div className="commercial-notice commercial-notice-red">{estimateError}</div>
      ) : null}

      {calculatorCode === 'BOUNDARY-SURVEY' ? (
        <div className="commercial-form-grid">
          <StepperNumberInput
            label="Area"
            required
            value={boundary.area}
            onChange={(value) => setBoundary({ ...boundary, area: value })}
            min={0}
            step={boundary.unit === 'ha' ? 1 : 10}
            placeholder="e.g. 1,200"
          />
          <DropdownSelect
            label="Unit"
            fieldClassName="commercial-field"
            options={[
              { value: 'sqm', label: 'sqm' },
              { value: 'ha', label: 'ha' },
            ]}
            value={boundary.unit}
            onChange={(value) => setBoundary({ ...boundary, unit: value === 'ha' ? 'ha' : 'sqm' })}
          />
          <DropdownSelect
            label="Customer type"
            fieldClassName="commercial-field"
            options={[
              { value: 'individual', label: 'Individual' },
              { value: 'corporate', label: 'Corporate' },
            ]}
            value={boundary.customer_type}
            onChange={(value) =>
              setBoundary({
                ...boundary,
                customer_type: value === 'corporate' ? 'corporate' : 'individual',
              })
            }
          />
          <label className="commercial-check">
            <input
              type="checkbox"
              checked={boundary.boundary_registration}
              onChange={(event) =>
                setBoundary({ ...boundary, boundary_registration: event.target.checked })
              }
            />
            <span>
              <b>Boundary registration</b>
              <small>Off halves the tier price. Surtax and deposit are set at quotation.</small>
            </span>
          </label>
          <StepperNumberInput
            label="Plots"
            required
            value={boundary.plots}
            onChange={(value) =>
              setBoundary({ ...boundary, plots: Math.max(0, Math.floor(value || 0)) })
            }
            min={1}
            step={1}
            integer
            placeholder="e.g. 3"
          />
          {boundary.plots > 1 ? (
            <DropdownSelect
              label="Single plan for all plots *"
              fieldClassName="commercial-field"
              options={[
                { value: '', label: 'Select…' },
                { value: 'yes', label: 'Yes - one plan' },
                { value: 'no', label: 'No - separate plans' },
              ]}
              value={boundary.single_plan === null ? '' : boundary.single_plan ? 'yes' : 'no'}
              onChange={(value) =>
                setBoundary({
                  ...boundary,
                  single_plan: value === '' ? null : value === 'yes',
                })
              }
            />
          ) : null}
        </div>
      ) : null}

      {calculatorCode === 'RESTABLISHMENT-SURVEY' ? (
        <div className="commercial-form-grid">
          <StepperNumberInput
            label="Number of beacons"
            required
            value={restablishment.number_of_beacons}
            onChange={(value) => setRestablishment({ number_of_beacons: Math.max(0, value || 0) })}
            min={0}
            step={1}
            integer
            placeholder="e.g. 4"
          />
          <div className="commercial-field">
            <span>System unit price</span>
            <b>{unitPrice == null ? 'Not set' : formatCurrency(unitPrice)}</b>
          </div>
        </div>
      ) : null}

      {calculatorCode === 'ARCHITECTURAL-DRAWING' || isConstruction(calculatorCode) ? (
        <div className="commercial-form-grid">
          <DropdownSelect
            label="Category *"
            fieldClassName="commercial-field"
            options={[
              {
                value: '',
                label: categoriesLoading
                  ? 'Loading…'
                  : categories.length > 0
                    ? 'Select category…'
                    : 'No categories available',
              },
              ...categories.map((category) => ({
                value: category.name,
                label: `${category.name} · ${formatCurrency(category.unitPrice)}`,
              })),
            ]}
            value={engineering.category_name}
            onChange={(value) => setEngineering({ ...engineering, category_name: value })}
          />
          <StepperNumberInput
            label="Bedrooms"
            required
            value={engineering.number_of_bedrooms}
            onChange={(value) =>
              setEngineering({ ...engineering, number_of_bedrooms: Math.max(0, value || 0) })
            }
            min={0}
            step={1}
            integer
            placeholder="e.g. 4"
          />
          <StepperNumberInput
            label="Floors"
            required
            value={engineering.number_of_floors}
            onChange={(value) =>
              setEngineering({ ...engineering, number_of_floors: Math.max(0, value || 0) })
            }
            min={0}
            step={1}
            integer
            placeholder="e.g. 2"
          />
          {isConstruction(calculatorCode) ? (
            <>
              <StepperNumberInput
                label="Area (sqm)"
                value={engineering.area_sqm ?? 0}
                onChange={(value) =>
                  setEngineering({ ...engineering, area_sqm: value > 0 ? value : null })
                }
                min={0}
                step={10}
                placeholder="Optional"
              />
              <StepperNumberInput
                label="Timeline (days)"
                value={engineering.timeline_days ?? 0}
                onChange={(value) =>
                  setEngineering({
                    ...engineering,
                    timeline_days: value > 0 ? Math.floor(value) : null,
                  })
                }
                min={0}
                step={1}
                integer
                placeholder="Optional"
              />
            </>
          ) : null}
        </div>
      ) : null}

      <div className="commercial-estimate-actions commercial-estimate-actions--split">
        <button
          type="button"
          className="commercial-btn commercial-btn-primary"
          disabled={estimating || !readyToEstimate}
          title={readyToEstimate ? undefined : 'Fill the required inputs before estimating.'}
          onClick={handleEstimate}
        >
          {estimating ? 'Estimating…' : 'Estimate value'}
        </button>
        <div className="commercial-quote-total-chip">
          <span>Estimated total{stale && estimatedValue > 0 ? ' · stale' : ''}</span>
          <b>{estimatedValue > 0 ? formatCurrency(estimatedValue) : '-'}</b>
        </div>
      </div>
    </section>
  )
}
