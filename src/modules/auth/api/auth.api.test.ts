import { describe, expect, it } from 'vitest'

import { authApi } from './auth.api'
import { tokenStore } from '@/shared/auth/token-store'

describe('authApi.currentUser', () => {
  it('completes the authenticated /auth/me bootstrap after credentials are present', async () => {
    const login = await authApi.login({ email: 'admin@gmail.com', password: 'password' })

    expect(login).toEqual({ type: 'authenticated' })

    const user = await authApi.currentUser()

    expect(user).toMatchObject({
      id: '102',
      email: 'admin@gmail.com',
      isVerified: true,
    })

    tokenStore.clear('manual')
  })
})
