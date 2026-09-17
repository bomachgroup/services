const dateFormatter = new Intl.DateTimeFormat('en-NG', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/**
 * Formats any number or numeric string with standard commas.
 * E.g. 1000000 -> "1,000,000", 1234.56 -> "1,234.56"
 */
export function formatNumber(value: number | string | undefined | null, decimals?: number): string {
  if (value === undefined || value === null || value === '') return '0'
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : Number(value)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString(
    'en-NG',
    decimals !== undefined
      ? {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }
      : {
          maximumFractionDigits: 2,
        },
  )
}

/**
 * Formats an integer count with commas (e.g. 1500 -> "1,500").
 */
export function formatCount(value: number | string | undefined | null): string {
  return formatNumber(value, 0)
}

/**
 * Naira display:
 * Formatted with commas (e.g. ₦3,200,000 or ₦11,300,000).
 * If `options?.compact` is true, abbreviates large numbers (₦11.3M / ₦1.5B).
 */
export function formatCurrency(
  value: number | string | undefined | null,
  options?: { compact?: boolean; decimals?: number },
): string {
  if (value === undefined || value === null || value === '') return '₦0'
  const amount = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : Number(value)
  if (!Number.isFinite(amount)) return '₦0'

  if (options?.compact) {
    if (amount >= 1_000_000_000) {
      return `₦${(amount / 1_000_000_000).toFixed(1)}B`
    }
    if (amount >= 1_000_000) {
      const millions = amount / 1_000_000
      return `₦${millions.toFixed(amount % 1_000_000 ? 1 : 0)}M`
    }
  }

  const decimals = options?.decimals ?? (amount % 1 !== 0 ? 2 : 0)
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function formatDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date'
  }

  return dateFormatter.format(date)
}
