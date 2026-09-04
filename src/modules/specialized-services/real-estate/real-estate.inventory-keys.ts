export type RealEstateInventoryKeyKind = 'brokerage' | 'standalone' | 'estate'

export interface ParsedRealEstateInventoryKey {
  kind: RealEstateInventoryKeyKind
  id: number
}

export function buildRealEstateInventoryKey(
  kind: RealEstateInventoryKeyKind,
  id: number,
): string {
  return `${kind}:${id}`
}

export function parseRealEstateInventoryKey(
  value: string | null | undefined,
): ParsedRealEstateInventoryKey | null {
  if (!value) return null

  const [kind, idValue] = value.split(':')
  const id = Number(idValue)
  if (!kind || !Number.isFinite(id) || id <= 0) return null
  if (kind !== 'brokerage' && kind !== 'standalone' && kind !== 'estate') return null

  return { kind, id }
}

export function inventoryKeyLabel(kind: RealEstateInventoryKeyKind) {
  if (kind === 'brokerage') return 'Brokerage'
  if (kind === 'standalone') return 'Standalone property'
  return 'Estate'
}
