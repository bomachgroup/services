/** Display helpers for quote/invoice line `source_context` payloads. */

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function commercialSourceContextLabel(
  sourceContext: Record<string, unknown> | null | undefined,
  options?: { fromQuoteItem?: boolean },
): string {
  if (!sourceContext || typeof sourceContext !== 'object') {
    return options?.fromQuoteItem ? 'From quotation item' : ''
  }

  const domain = asText(sourceContext.domain)
  const role = asText(sourceContext.role)
  const assetName = asText(sourceContext.asset_name) || asText(sourceContext.assetName)
  const requestAssetId = sourceContext.request_asset_id ?? sourceContext.requestAssetId
  const requestAssetLabel =
    typeof requestAssetId === 'number' || typeof requestAssetId === 'string'
      ? String(requestAssetId)
      : ''

  if (domain === 'real_estate' && role === 'asset') {
    if (assetName) return `Real estate asset · ${assetName}`
    if (requestAssetLabel) return `Real estate asset · #${requestAssetLabel}`
    return 'Real estate asset'
  }

  if (domain === 'real_estate') return 'Real estate linked item'
  if (options?.fromQuoteItem) return 'From quotation item'
  return ''
}

export function commercialEmptyLabel(value: string | null | undefined, empty: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : empty
}
