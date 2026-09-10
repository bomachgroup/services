import { describe, expect, it } from 'vitest'

import { authQueries } from './auth.queries'

describe('authQueries.currentUser', () => {
  it('disables the current-user request until embedded credentials are ready', () => {
    expect(authQueries.currentUser(false).enabled).toBe(false)
  })

  it('enables the current-user request by default', () => {
    expect(authQueries.currentUser().enabled).toBe(true)
  })
})
