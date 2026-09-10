import type { CreatePropertyInput, PropertyBatchItem } from './real-estate.types'

/** Estate inventory units are always named Plot 1, Plot 2, … regardless of property type. */
export function estatePlotName(sequence: number) {
  return `Plot ${sequence}`
}

export function nextEstatePlotNumber(
  existing: Array<{ plotNumber: number | null | undefined }>,
) {
  const used = existing
    .map((item) => item.plotNumber)
    .filter((value): value is number => typeof value === 'number' && value > 0)
  return used.length ? Math.max(...used) + 1 : 1
}

export function isEstatePlotNumberTaken(
  plotNumber: number,
  existing: Array<{ id?: number; plotNumber: number | null | undefined }>,
  excludeId?: number | null,
) {
  return existing.some(
    (item) =>
      item.plotNumber === plotNumber && (excludeId == null || item.id !== excludeId),
  )
}

export function buildPropertyBatch(
  template: CreatePropertyInput,
  count: number,
  startNumber: number,
): PropertyBatchItem[] {
  return Array.from({ length: count }, (_, index) => {
    const sequence = startNumber + index
    return {
      key: `${Date.now()}-${sequence}-${index}`,
      sequence,
      input: {
        ...template,
        propertyName: estatePlotName(sequence),
        plotNumber: sequence,
      },
      status: 'queued' as const,
      propertyId: null,
      error: '',
    }
  })
}
