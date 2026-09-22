import { describe, expect, it } from 'vitest'

import { ApiError } from '@/shared/api/api-error'

import { presentError } from './error-presentation'

describe('page error presentation', () => {
  it('labels a missing page capability as unavailable', () => {
    const result = presentError(new ApiError('Not found', { status: 404 }), 'page-load')

    expect(result.title).toBe('This capability is unavailable')
    expect(result.message).toContain('not available')
  })

  it('keeps action-level forbidden errors distinct from page access', () => {
    const result = presentError(new ApiError('Forbidden', { status: 403 }), 'form-submit')

    expect(result.title).toBe('Permission required')
    expect(result.message).toContain('complete this action')
  })
})
