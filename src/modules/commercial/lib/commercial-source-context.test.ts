import { describe, expect, it } from 'vitest'

import {
  commercialEmptyLabel,
  commercialSourceContextLabel,
} from './commercial-source-context'

describe('commercialSourceContextLabel', () => {
  it('labels real-estate asset lines with asset name', () => {
    expect(
      commercialSourceContextLabel({
        domain: 'real_estate',
        role: 'asset',
        asset_name: 'Plot 12',
        request_asset_id: 44,
      }),
    ).toBe('Real estate asset · Plot 12')
  })

  it('falls back to request asset id when name is missing', () => {
    expect(
      commercialSourceContextLabel({
        domain: 'real_estate',
        role: 'asset',
        request_asset_id: 9,
      }),
    ).toBe('Real estate asset · #9')
  })

  it('labels generic real-estate linked items', () => {
    expect(
      commercialSourceContextLabel({
        domain: 'real_estate',
        role: 'fee',
      }),
    ).toBe('Real estate linked item')
  })

  it('uses quotation-item fallback when requested', () => {
    expect(commercialSourceContextLabel({}, { fromQuoteItem: true })).toBe(
      'From quotation item',
    )
    expect(commercialSourceContextLabel(null, { fromQuoteItem: true })).toBe(
      'From quotation item',
    )
  })

  it('returns empty string for unrelated context', () => {
    expect(commercialSourceContextLabel({ domain: 'survey' })).toBe('')
  })
})

describe('commercialEmptyLabel', () => {
  it('keeps non-empty values', () => {
    expect(commercialEmptyLabel(' INV-001 ', 'No invoice linked')).toBe('INV-001')
  })

  it('uses empty fallback for blank values', () => {
    expect(commercialEmptyLabel('', 'No quote linked')).toBe('No quote linked')
    expect(commercialEmptyLabel(null, 'No request linked')).toBe('No request linked')
  })
})
