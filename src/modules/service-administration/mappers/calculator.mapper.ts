import type { CalculatorDto } from '../api/service-administration.contracts'
import type { PricingCalculator } from '../types/service-administration.types'

function pricingStatus(status: string): PricingCalculator['status'] {
  return status === 'active' || status === 'draft' ? status : 'inactive'
}

/** Map a live PricingCalculator API row into the admin library shape. */
export function mapCalculatorDto(
  dto: CalculatorDto,
  service?: { id?: number | string; name?: string },
): PricingCalculator {
  const kindLabel = dto.calculator_kind === 'formula' ? 'formula' : 'fixed'
  return {
    id: String(dto.id),
    name: dto.name,
    code: dto.code,
    serviceId: service?.id != null ? String(service.id) : '',
    serviceName: service?.name ?? 'Attach via service catalogue',
    description: dto.description?.trim() || `${dto.calculator_kind} calculator`,
    pricingType: kindLabel,
    status: pricingStatus(dto.status),
    version: 1,
    variables: [],
    charges: [
      {
        id: `kind-${dto.id}`,
        label: dto.calculator_kind === 'hardcoded' ? 'Hardcoded fee table' : 'Formula',
        kind: dto.calculator_kind === 'formula' ? 'formula' : 'fixed',
        value:
          dto.calculator_kind === 'hardcoded'
            ? 'Server-managed price table (estimate at quote time)'
            : dto.code,
      },
    ],
    sampleTotal: 0,
    updatedAt: new Date(0).toISOString(),
  }
}
