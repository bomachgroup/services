import { describe, expect, it } from 'vitest'

import { resolveRouterBasePath } from './base-path'

describe('Services router base path', () => {
  it('uses root routes for the standalone deployment', () => {
    expect(resolveRouterBasePath('/')).toBe('/')
  })

  it('uses prefixed routes when mounted under the Bomach host', () => {
    expect(resolveRouterBasePath('/services/')).toBe('/services')
  })
})
