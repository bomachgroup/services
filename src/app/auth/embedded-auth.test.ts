import { describe, expect, it } from 'vitest'

import {
  AUTH_READY_MESSAGE,
  getAuthBootstrapError,
  getTrustedParentOrigin,
  isTrustedAuthTokenMessage,
  shouldRetryAuthReadyAnnouncement,
} from './embedded-auth'

describe('embedded authentication boundary', () => {
  it('defines the ready message emitted by the embedded child', () => {
    expect(AUTH_READY_MESSAGE).toEqual({ type: 'BOMACH_AUTH_READY' })
  })

  it('retries ready announcements only while credentials are missing and attempts remain', () => {
    expect(shouldRetryAuthReadyAnnouncement({ hasToken: false, attempts: 1 })).toBe(true)
    expect(shouldRetryAuthReadyAnnouncement({ hasToken: true, attempts: 1 })).toBe(false)
    expect(shouldRetryAuthReadyAnnouncement({ hasToken: false, attempts: 12 })).toBe(false)
  })

  it('provides a recoverable message when credential delivery times out', () => {
    expect(getAuthBootstrapError()).toContain('did not provide a valid session')
  })

  it('derives the parent origin from a valid referrer', () => {
    expect(getTrustedParentOrigin('https://os.bomach.app/services?embed=true')).toBe(
      'https://os.bomach.app',
    )
  })

  it('falls back to wildcard only when the referrer is unavailable or invalid', () => {
    expect(getTrustedParentOrigin('')).toBe('*')
    expect(getTrustedParentOrigin('not a url')).toBe('*')
  })

  it('accepts token messages only from the parent and trusted origin', () => {
    const parent = window.parent
    const unrelatedWindow = {} as Window
    const event = new MessageEvent('message', {
      source: parent,
      origin: 'https://os.bomach.app',
      data: { type: 'BOMACH_AUTH_TOKEN', token: 'access-token' },
    })

    expect(isTrustedAuthTokenMessage(event, parent, 'https://os.bomach.app')).toBe(true)
    expect(
      isTrustedAuthTokenMessage(
        new MessageEvent('message', {
          source: window,
          origin: 'https://os.bomach.app',
          data: { type: 'BOMACH_AUTH_TOKEN', token: 'access-token' },
        }),
        unrelatedWindow,
        'https://os.bomach.app',
      ),
    ).toBe(false)
    expect(
      isTrustedAuthTokenMessage(
        new MessageEvent('message', {
          source: parent,
          origin: 'https://evil.example',
          data: { type: 'BOMACH_AUTH_TOKEN', token: 'access-token' },
        }),
        parent,
        'https://os.bomach.app',
      ),
    ).toBe(false)
  })
})
