import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/server'

import { apiClient, BROWSER_REQUEST_HEADER, BROWSER_REQUEST_VALUE } from './api-client'

describe('browser API client', () => {
  it('uses same-origin cookies and the browser request header for writes', async () => {
    let observedRequest: Request | undefined
    server.use(
      http.post('/api/v1/test/write', ({ request }) => {
        observedRequest = request
        return HttpResponse.json({ ok: true })
      }),
    )

    await expect(apiClient.post('/test/write', { name: 'Example' })).resolves.toEqual({ ok: true })

    expect(observedRequest?.credentials).toBe('include')
    expect(observedRequest?.headers.get(BROWSER_REQUEST_HEADER)).toBe(BROWSER_REQUEST_VALUE)
    expect(observedRequest?.headers.get('authorization')).toBeNull()
    expect(observedRequest?.cache).toBe('no-store')
  })

  it('refreshes an expired browser session once and retries the original request', async () => {
    let refreshCount = 0
    let requestCount = 0
    server.use(
      http.post('/api/v1/auth/browser/refresh', () => {
        refreshCount += 1
        return HttpResponse.json({ success: true })
      }),
      http.get('/api/v1/test/read', () => {
        requestCount += 1
        return requestCount === 1
          ? HttpResponse.json({ detail: 'Expired.' }, { status: 401 })
          : HttpResponse.json({ ok: true })
      }),
    )

    await expect(apiClient.get('/test/read')).resolves.toEqual({ ok: true })
    expect(refreshCount).toBe(1)
    expect(requestCount).toBe(2)
  })
})
