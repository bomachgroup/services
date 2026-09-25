import { describe, expect, it } from 'vitest'

import { mapServiceOrder, mapServiceOrderProjects } from './service-order.mapper'

describe('service order project mapping', () => {
  it('maps projects from the paginated project response', () => {
    expect(
      mapServiceOrderProjects({
        count: 1,
        items: [
          {
            id: 14,
            name: 'Waterfront Retail Fitout',
            short_code: 'WRF-14',
            client_id: 8,
            status: 'in_progress',
          },
        ],
      }),
    ).toEqual([
      {
        id: 14,
        name: 'Waterfront Retail Fitout',
        shortCode: 'WRF-14',
        clientId: 8,
        status: 'in_progress',
      },
    ])
  })

  it('retains the project relationship returned on a service order', () => {
    expect(
      mapServiceOrder({
        id: 3,
        client_id: 8,
        project_id: 14,
      }).projectId,
    ).toBe(14)
  })
})
