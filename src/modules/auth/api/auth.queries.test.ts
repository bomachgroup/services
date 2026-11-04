import { describe, expect, it } from 'vitest'

import { authQueries } from './auth.queries'

describe('authQueries.currentUser', () => {
  it('always bootstraps the current user from the shared browser session', () => {
    expect(authQueries.currentUser().enabled).not.toBe(false)
    expect(authQueries.currentUser().queryKey).toEqual(['auth', 'current-user'])
  })
})
