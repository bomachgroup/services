export interface BoundarySurveyEstimateInput {
  area: number
  unit: 'sqm' | 'ha'
  customer_type: 'individual' | 'corporate'
  boundary_registration: boolean
  plots: number
  single_plan: boolean | null
  state: string
  lga: string
  country: string
}

export interface RestablishmentSurveyEstimateInput {
  number_of_beacons: number
}

export interface EngineeringEstimateInput {
  category_name: string
  number_of_bedrooms: number
  number_of_floors: number
  area_sqm?: number | null
  timeline_days?: number | null
}

export interface CalculatorEstimateResult {
  total: number
  calculatorCode: string
  raw: Record<string, unknown>
}

export interface EngineeringCategoryInput {
  name: string
  category_type: string
  unit_price: number
  max_bedrooms_default: number
  max_floors_default: number
  extra_bedroom_fee: number
  extra_floor_fee: number
  max_area_default?: number | null
  area_fee?: number | null
  timeline_days_default?: number | null
  timeline_fee?: number | null
  is_active?: boolean
}

export interface EngineeringCategoryOption {
  id: number
  name: string
  categoryType: string
  unitPrice: number
  maxBedrooms: number
  maxFloors: number
  extraBedroomFee: number
  extraFloorFee: number
  maxArea: number | null
  areaFee: number | null
  timelineDays: number | null
  timelineFee: number | null
  active: boolean
}

export type EstimateStatus = 'idle' | 'ready' | 'stale' | 'missing'

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function lookupAnswer(
  answersSnapshot: Record<string, unknown>,
  answers: Array<{ fieldKey: string; label: string; value: unknown }>,
  keys: string[],
): unknown {
  const lowered = new Map<string, unknown>()
  for (const [key, value] of Object.entries(answersSnapshot)) {
    lowered.set(key.trim().toLowerCase(), value)
  }
  for (const answer of answers) {
    if (answer.fieldKey.trim()) lowered.set(answer.fieldKey.trim().toLowerCase(), answer.value)
    if (answer.label.trim()) {
      const labelKey = answer.label.trim().toLowerCase()
      if (!lowered.has(labelKey)) lowered.set(labelKey, answer.value)
    }
  }
  for (const key of keys) {
    const hit = lowered.get(key.toLowerCase())
    if (hit !== undefined && hit !== null && hit !== '') return hit
  }
  return undefined
}

export function autofillBoundaryInputs(
  answersSnapshot: Record<string, unknown>,
  answers: Array<{ fieldKey: string; label: string; value: unknown }>,
  customerType: string,
): BoundarySurveyEstimateInput {
  const area = num(
    lookupAnswer(answersSnapshot, answers, ['area', 'land_area', 'plot_area', 'area_sqm']),
    0,
  )
  const unitRaw = text(
    lookupAnswer(answersSnapshot, answers, ['unit', 'area_unit', 'plot_size_unit']),
    'sqm',
  ).toLowerCase()
  const plots = Math.max(
    1,
    Math.floor(num(lookupAnswer(answersSnapshot, answers, ['plots', 'number_of_plots']), 1)),
  )
  const singleRaw = lookupAnswer(answersSnapshot, answers, ['single_plan'])
  return {
    area: area > 0 ? area : 0,
    unit: unitRaw === 'ha' ? 'ha' : 'sqm',
    customer_type: customerType === 'company' ? 'corporate' : 'individual',
    boundary_registration: (() => {
      const raw = lookupAnswer(answersSnapshot, answers, ['boundary_registration'])
      return raw === undefined ? true : raw === true || raw === 'true' || raw === 'yes' || raw === 1
    })(),
    plots,
    single_plan: typeof singleRaw === 'boolean' ? singleRaw : null,
    state: text(lookupAnswer(answersSnapshot, answers, ['state']), ''),
    lga: text(lookupAnswer(answersSnapshot, answers, ['lga']), ''),
    country: text(lookupAnswer(answersSnapshot, answers, ['country']), ''),
  }
}

export function autofillRestablishmentInputs(
  answersSnapshot: Record<string, unknown>,
  answers: Array<{ fieldKey: string; label: string; value: unknown }>,
): RestablishmentSurveyEstimateInput {
  return {
    number_of_beacons: Math.max(
      0,
      Math.floor(num(lookupAnswer(answersSnapshot, answers, ['number_of_beacons', 'beacons']), 0)),
    ),
  }
}

export function autofillEngineeringInputs(
  answersSnapshot: Record<string, unknown>,
  answers: Array<{ fieldKey: string; label: string; value: unknown }>,
): EngineeringEstimateInput {
  return {
    category_name: text(
      lookupAnswer(answersSnapshot, answers, ['category_name', 'category', 'building_type']),
      '',
    ),
    number_of_bedrooms: Math.max(
      0,
      Math.floor(
        num(lookupAnswer(answersSnapshot, answers, ['number_of_bedrooms', 'bedrooms']), 0),
      ),
    ),
    number_of_floors: Math.max(
      0,
      Math.floor(num(lookupAnswer(answersSnapshot, answers, ['number_of_floors', 'floors']), 0)),
    ),
    area_sqm: (() => {
      const raw = lookupAnswer(answersSnapshot, answers, ['area_sqm', 'area', 'floor_area'])
      if (raw === undefined || raw === null || raw === '') return null
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : null
    })(),
    timeline_days: (() => {
      const raw = lookupAnswer(answersSnapshot, answers, [
        'timeline_days',
        'timeline',
        'duration_days',
      ])
      if (raw === undefined || raw === null || raw === '') return null
      const parsed = Math.floor(Number(raw))
      return Number.isFinite(parsed) ? parsed : null
    })(),
  }
}

export function mergeSavedCalculatorInputs<T extends object>(
  autofilled: T,
  saved: Record<string, unknown>,
): T {
  const next = { ...autofilled }
  for (const [key, value] of Object.entries(saved)) {
    if (key in next && value !== undefined && value !== null && value !== '') {
      ;(next as Record<string, unknown>)[key] = value
    }
  }
  return next
}
