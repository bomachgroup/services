import { apiClient } from '@/shared/api/api-client'

import { mapMarketingLeadsPage } from './marketing-leads.mapper'
import type { MarketingLeadOption } from './marketing-leads.types'
import type { PaginatedResult } from './service-requests.types'

export const marketingLeadsApi = {
  async search(search: string, limit = 20): Promise<MarketingLeadOption[]> {
    const page = await this.list(search, limit, 0)
    return page.items
  },

  async list(
    search: string,
    limit = 20,
    offset = 0,
  ): Promise<PaginatedResult<MarketingLeadOption>> {
    const query = new URLSearchParams()
    query.set('limit', String(limit))
    query.set('offset', String(offset))
    if (search.trim()) query.set('search', search.trim())
    return mapMarketingLeadsPage(await apiClient.get<unknown>(`/leads?${query.toString()}`))
  },
}
