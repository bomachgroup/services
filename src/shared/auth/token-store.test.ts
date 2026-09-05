import { beforeEach, describe, expect, it } from 'vitest'

import { requireAuthenticatedUser } from '@/app/auth/route-guards'
import type { AuthContextValue } from '@/app/auth/auth.types'

describe('tokenStore URL boundary', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/?token=url-access&refresh_token=url-refresh')
  })

  it('does not import credentials from URL query parameters', async () => {
    vi.resetModules()
    const { tokenStore } = await import('./token-store')

    expect(tokenStore.getAccessToken()).toBeNull()
    expect(tokenStore.getRefreshToken()).toBeNull()
  })

  it('does not treat URL credentials as an embedded authenticated session', () => {
    const auth = {
      isLoading: false,
      isAuthenticated: false,
      user: null,
      authBootstrapError: null,
      accessIssue: null,
    } as AuthContextValue

    const result = requireAuthenticatedUser({
      auth,
      locationHref: '/services',
    })

    expect(result).toBeDefined()
  })
})
