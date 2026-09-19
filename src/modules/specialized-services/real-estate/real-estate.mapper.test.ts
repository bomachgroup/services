import { describe, expect, it } from 'vitest'

import { mapPortfolioStats } from './real-estate.mapper'
import { isValidBoundary } from './real-estate-map.utils'

describe('real-estate portfolio mapping', () => {
  it('keeps portfolio categories separate', () => {
    const stats = mapPortfolioStats({
      projects: { total: 9 },
      owned_units: { total: 18, available: 10, under_offer: 2, reserved: 3, sold: 3 },
      standalone_units: { total: 4, available: 3, under_offer: 0, reserved: 1, sold: 0 },
      brokerage_listings: { total: 5, available: 4, sold: 1, linked: 2, unlinked: 3 },
      managed_assets: { total: 27 },
      estate_summaries: {
        '1': {
          owned_units: 18,
          available: 10,
          under_offer: 2,
          reserved: 3,
          sold: 3,
          linked_brokerage: 2,
        },
      },
    })

    expect(stats.projects.total).toBe(9)
    expect(stats.ownedUnits.total).toBe(18)
    expect(stats.standaloneUnits.total).toBe(4)
    expect(stats.brokerageListings.linked).toBe(2)
    expect(stats.managedAssets.total).toBe(27)
    expect(stats.estateSummaries['1']).toEqual({
      ownedUnits: 18,
      available: 10,
      underOffer: 2,
      reserved: 3,
      sold: 3,
      linkedBrokerage: 2,
    })
  })
})

describe('real-estate boundary validation', () => {
  it('requires three valid, non-zero coordinate points', () => {
    expect(
      isValidBoundary([
        { lat: 6.5244, lng: 3.3792 },
        { lat: 6.525, lng: 3.38 },
        { lat: 6.524, lng: 3.381 },
      ]),
    ).toBe(true)
    expect(isValidBoundary([{ lat: 6.5244, lng: 3.3792 }])).toBe(false)
    expect(
      isValidBoundary([
        { lat: 0, lng: 0 },
        { lat: 6.525, lng: 3.38 },
        { lat: 6.524, lng: 3.381 },
      ]),
    ).toBe(false)
  })
})
