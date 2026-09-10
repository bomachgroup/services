/** Render numeric inputs empty instead of showing a leading 0 while editing. */
export function formatNumberFieldValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
    return ''
  }

  return String(value)
}

/** Strip thousand separators before parsing numeric input text. */
export function stripGroupedNumberInput(raw: string): string {
  return raw.replace(/,/g, '').trim()
}

/** Keep only digits and a single decimal separator for grouped numeric inputs. */
export function sanitizeGroupedNumberInput(raw: string): string {
  let result = ''
  let hasDecimal = false

  for (const char of raw.replace(/,/g, '')) {
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

/** Format numeric values with thousand separators for display-only inputs. */
export function formatGroupedNumberFieldValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
    return ''
  }

  const [wholePart = '', fractionPart] = stripGroupedNumberInput(String(value)).split('.')
  const formattedWhole = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fractionPart !== undefined && fractionPart !== ''
    ? `${formattedWhole}.${fractionPart}`
    : formattedWhole
}

/** Parse grouped numeric input text; blank input becomes 0 in form state. */
export function parseGroupedNumberFieldValue(raw: string): number {
  const normalized = sanitizeGroupedNumberInput(raw)
  if (normalized === '' || normalized === '.') return 0

  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

/**
 * Live-format available plot sizes like GroupedNumberInput.
 * Thousand separators are display-only; list items are separated by ", ".
 */
export function formatPlotSizesFieldValue(value: string): string {
  if (!value.trim()) return ''

  const keepTrailingComma = /,\s*$/.test(value)
  const body = value.replace(/,\s*$/, '')

  // Preserve list separators (", "), strip thousand-separator commas, keep digits.
  const normalized = body
    .replace(/,\s+/g, '§')
    .replace(/,/g, '')
    .replace(/[^\d§]/g, '')

  const parts = normalized
    .split('§')
    .map((part) => part.replace(/\D/g, ''))
    .filter(Boolean)

  const formatted = parts
    .map((digits) => {
      const parsed = Number(digits)
      if (!Number.isFinite(parsed) || parsed === 0) return ''
      return formatGroupedNumberFieldValue(parsed)
    })
    .filter(Boolean)
    .join(', ')

  if (!formatted) return ''
  return keepTrailingComma ? `${formatted}, ` : formatted
}

/** @deprecated Prefer formatPlotSizesFieldValue; kept for call sites that only sanitize. */
export function sanitizePlotSizesInput(raw: string): string {
  return raw.replace(/[^\d,\s]/g, '')
}

/** Extract plain digit tokens from a plot-sizes field value. */
export function parsePlotSizeTokens(value: string): string[] {
  if (!value.trim()) return []

  return value
    .replace(/,\s+/g, '§')
    .replace(/,/g, '')
    .split('§')
    .map((part) => part.replace(/\D/g, ''))
    .filter(Boolean)
}

/** Parse numeric input text; blank input becomes 0 in form state. */
export function parseNumberFieldValue(raw: string): number {
  return parseGroupedNumberFieldValue(raw)
}

/** Parse numeric input text; blank input stays unset (null). */
export function parseOptionalNumberFieldValue(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/** For string-backed dynamic numeric fields (intake forms, calculators). */
export function formatNumericStringFieldValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''

  const text = String(value).trim()
  if (text === '' || text === '0') return ''

  return text
}

export function parseNumericStringFieldValue(raw: string): string {
  return raw.trim()
}
