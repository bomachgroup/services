import type { PaginatedResult } from './service-requests.types'
import type { MarketingLeadOption } from './marketing-leads.types'

type JsonRecord = Record<string, unknown>

const record = (value: unknown): JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonRecord) : {}

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const nullableNumber = (value: unknown) => (value == null || value === '' ? null : num(value))

const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

function paginatedRows(payload: unknown) {
  if (Array.isArray(payload)) return { count: payload.length, rows: payload }
  const root = record(payload)
  const rows = Array.isArray(root.items)
    ? root.items
    : Array.isArray(root.results)
      ? root.results
      : Array.isArray(root.data)
        ? root.data
        : []
  return { count: num(root.count, rows.length), rows }
}

export function mapMarketingLead(payload: unknown): MarketingLeadOption {
  const row = record(payload)
  return {
    id: num(row.id),
    fullName: text(row.full_name),
    phone: text(row.phone),
    email: text(row.email),
    division: text(row.division),
    divisionDisplay: text(row.division_display, text(row.division)),
    source: text(row.source),
    sourceDisplay: text(row.source_display, text(row.source)),
    status: text(row.status),
    statusDisplay: text(row.status_display, text(row.status)),
    linkedClientId: nullableNumber(row.linked_client_id),
    linkedClientName: text(row.linked_client_name) || null,
  }
}

export function mapMarketingLeads(payload: unknown): MarketingLeadOption[] {
  const { rows } = paginatedRows(payload)
  return rows.map(mapMarketingLead)
}

export function mapMarketingLeadsPage(payload: unknown): PaginatedResult<MarketingLeadOption> {
  const { count, rows } = paginatedRows(payload)
  return { count, items: rows.map(mapMarketingLead) }
}
