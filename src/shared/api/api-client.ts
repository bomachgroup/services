import { env } from '@/shared/config/env'
import { AUTH_ENDPOINTS } from '@/shared/auth/auth-endpoints'

import { ApiError } from './api-error'

type RequestBody = BodyInit | object | null | undefined

interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'credentials'> {
  body?: RequestBody
  skipRefresh?: boolean
}

interface ApiErrorPayload {
  detail?: string | Array<{ loc?: unknown; msg?: string; message?: string; type?: string }>
  message?: string
  code?: string
  errors?: unknown
}

export const SESSION_ESTABLISHED_KEY = 'bomach:session-established'
export const SESSION_EXPIRED_NOTICE_KEY = 'bomach:session-expired-notice'
export const SESSION_EXPIRED_EVENT = 'bomach:session-expired'
export const BROWSER_REQUEST_HEADER = 'X-Bomach-Request'
export const BROWSER_REQUEST_VALUE = 'browser'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE'])
let refreshPromise: Promise<boolean> | null = null

function resolveApiErrorMessage(payload: ApiErrorPayload | undefined, fallback: string): string {
  if (!payload) return fallback
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim()
  if (Array.isArray(payload.detail)) {
    for (const item of payload.detail) {
      if (!item || typeof item !== 'object') continue
      const message = item.msg?.trim() || item.message?.trim()
      if (message) return message
    }
  }
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim()
  return fallback
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${env.apiBaseUrl}${normalizedPath}`
}

function isNativeBody(body: RequestBody): body is BodyInit {
  return (
    body !== null &&
    body !== undefined &&
    (typeof body === 'string' ||
      body instanceof Blob ||
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body))
  )
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return response.json()
  return response.text()
}

async function executeRequest(path: string, options: ApiRequestOptions): Promise<Response> {
  const { body, skipRefresh: _skipRefresh, ...requestOptions } = options
  void _skipRefresh
  const method = (requestOptions.method ?? 'GET').toUpperCase()
  const headers = new Headers(requestOptions.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (!SAFE_METHODS.has(method)) headers.set(BROWSER_REQUEST_HEADER, BROWSER_REQUEST_VALUE)

  let requestBody: BodyInit | null | undefined
  if (body !== undefined) {
    if (isNativeBody(body)) requestBody = body
    else if (body === null) requestBody = null
    else {
      headers.set('Content-Type', 'application/json')
      requestBody = JSON.stringify(body)
    }
  }

  try {
    return await fetch(buildUrl(path), {
      ...requestOptions,
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      ...(requestBody !== undefined ? { body: requestBody } : {}),
    })
  } catch (cause) {
    if (options.signal?.aborted) throw cause
    throw new ApiError('The server could not be reached.', {
      status: 0,
      code: 'NETWORK_ERROR',
      cause,
    })
  }
}

function announceExpiredSession(): void {
  if (typeof window === 'undefined') return
  const hadSession = window.sessionStorage.getItem(SESSION_ESTABLISHED_KEY) === '1'
  window.sessionStorage.removeItem(SESSION_ESTABLISHED_KEY)
  if (hadSession) {
    window.sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1')
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
  }
}

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await executeRequest(AUTH_ENDPOINTS.refresh, {
        method: 'POST',
        skipRefresh: true,
      })
      if (response.ok) return true

      if ([400, 401, 403].includes(response.status)) {
        await parseResponse(response)
        announceExpiredSession()
        return false
      }

      const payload = await parseResponse(response)
      const errorPayload =
        typeof payload === 'object' && payload !== null ? (payload as ApiErrorPayload) : undefined
      throw new ApiError(
        resolveApiErrorMessage(errorPayload, 'The sign-in service is temporarily unavailable.'),
        {
          status: response.status,
          code: 'SESSION_REFRESH_FAILED',
          details: payload,
        },
      )
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function requestResponse(path: string, options: ApiRequestOptions): Promise<Response> {
  let response = await executeRequest(path, options)
  if (response.status === 401 && !options.skipRefresh) {
    const refreshed = await refreshSession()
    if (refreshed && !options.signal?.aborted) {
      response = await executeRequest(path, { ...options, skipRefresh: true })
    }
  }
  if (response.status === 401 && !options.skipRefresh) announceExpiredSession()
  return response
}

async function request<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const response = await requestResponse(path, options)
  const payload = await parseResponse(response)
  if (!response.ok) {
    const errorPayload =
      typeof payload === 'object' && payload !== null ? (payload as ApiErrorPayload) : undefined
    throw new ApiError(
      resolveApiErrorMessage(errorPayload, 'The request could not be completed.'),
      {
        status: response.status,
        ...(errorPayload?.code !== undefined ? { code: errorPayload.code } : {}),
        details: errorPayload?.errors ?? payload,
      },
    )
  }
  return payload as TResponse
}

async function requestBlob(
  path: string,
  options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
): Promise<Blob> {
  const response = await requestResponse(path, { ...options, method: 'GET' })
  if (!response.ok) {
    const payload = await parseResponse(response)
    const errorPayload =
      typeof payload === 'object' && payload !== null ? (payload as ApiErrorPayload) : undefined
    throw new ApiError(
      resolveApiErrorMessage(errorPayload, 'The request could not be completed.'),
      {
        status: response.status,
        ...(errorPayload?.code !== undefined ? { code: errorPayload.code } : {}),
        details: errorPayload?.errors ?? payload,
      },
    )
  }
  return response.blob()
}

function createBodyRequest<TResponse>(
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  body: RequestBody,
  options: Omit<ApiRequestOptions, 'method' | 'body'> | undefined,
): Promise<TResponse> {
  return request<TResponse>(path, {
    ...options,
    method,
    ...(body !== undefined ? { body } : {}),
  })
}

export const apiClient = {
  get: <TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    request<TResponse>(path, { ...options, method: 'GET' }),
  getBlob: (path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    requestBlob(path, options),
  post: <TResponse>(
    path: string,
    body?: RequestBody,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) => createBodyRequest<TResponse>('POST', path, body, options),
  put: <TResponse>(
    path: string,
    body?: RequestBody,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) => createBodyRequest<TResponse>('PUT', path, body, options),
  patch: <TResponse>(
    path: string,
    body?: RequestBody,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) => createBodyRequest<TResponse>('PATCH', path, body, options),
  delete: <TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    request<TResponse>(path, { ...options, method: 'DELETE' }),
}
