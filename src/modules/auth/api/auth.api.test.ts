import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'

import { authApi } from './auth.api'
import { server } from '@/mocks/server'

describe('authApi.currentUser', () => {
  it('loads the signed-in staff identity and role through same-origin browser requests', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({
          id: 102,
          email: 'admin@gmail.com',
          username: 'admin',
          first_name: 'Admin',
          last_name: 'User',
          phone_number: null,
          is_verified: true,
          created_at: '2026-08-01T08:00:00Z',
        }),
      ),
      http.get('/api/v1/roles/employees/102', () =>
        HttpResponse.json({
          id: 1,
          name: 'Service Administrator',
          branches: [],
          permissions: { services: ['list'] },
          created_at: '2026-08-01T08:00:00Z',
          updated_at: '2026-08-01T08:00:00Z',
        }),
      ),
    )

    const user = await authApi.currentUser()

    expect(user).toMatchObject({
      id: '102',
      email: 'admin@gmail.com',
      isVerified: true,
    })
  })

  it('treats a rejected browser session as signed out', async () => {
    server.use(
      http.post('/api/v1/auth/browser/refresh', () =>
        HttpResponse.json({ detail: 'Refresh session is not available.' }, { status: 401 }),
      ),
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({ detail: 'Authentication required.' }, { status: 401 }),
      ),
    )

    await expect(authApi.currentUser()).resolves.toBeNull()
  })
})
