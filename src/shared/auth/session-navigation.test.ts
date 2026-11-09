import { describe, expect, it } from 'vitest'

import { resolveRootAppOrigin, safeServicesReturnTarget } from './session-navigation'

describe('shared-host root navigation', () => {
  it('uses the current test or production Bomach host while Services is mounted there', () => {
    expect(
      resolveRootAppOrigin(
        {
          origin: 'https://bomach-os-test.vercel.app',
          hostname: 'bomach-os-test.vercel.app',
          port: '',
          protocol: 'https:',
        },
        'https://bomach-os.vercel.app',
      ),
    ).toBe('https://bomach-os-test.vercel.app')
  })

  it('uses the configured OS host from the standalone Services deployment', () => {
    expect(
      resolveRootAppOrigin(
        {
          origin: 'https://services-mocha-xi.vercel.app',
          hostname: 'services-mocha-xi.vercel.app',
          port: '',
          protocol: 'https:',
        },
        'https://bomach-os-test.vercel.app',
      ),
    ).toBe('https://bomach-os-test.vercel.app')
  })

  it('uses the local OS dev server when Services runs on its local port', () => {
    expect(
      resolveRootAppOrigin(
        {
          origin: 'http://localhost:5174',
          hostname: 'localhost',
          port: '5174',
          protocol: 'http:',
        },
        '',
      ),
    ).toBe('http://localhost:5173')
  })

  it('keeps switch-back navigation on the local front door when mounted at /services', () => {
    expect(
      resolveRootAppOrigin(
        {
          origin: 'http://localhost:5173',
          hostname: 'localhost',
          port: '5173',
          protocol: 'http:',
        },
        'https://bomach-os.vercel.app',
      ),
    ).toBe('http://localhost:5173')
  })

  it('routes local Services and Marketing dev ports back through the OS front door', () => {
    expect(
      resolveRootAppOrigin(
        {
          origin: 'http://localhost:5177',
          hostname: 'localhost',
          port: '5177',
          protocol: 'http:',
        },
        'https://bomach-os.vercel.app',
      ),
    ).toBe('http://localhost:5173')
    expect(
      resolveRootAppOrigin(
        { origin: 'http://localhost:5175', hostname: 'localhost', port: '5175', protocol: 'http:' },
        '',
      ),
    ).toBe('http://localhost:5173')
  })

  it('keeps local production-preview testing on the local OS dev server', () => {
    expect(
      resolveRootAppOrigin(
        {
          origin: 'http://127.0.0.1:4173',
          hostname: '127.0.0.1',
          port: '4173',
          protocol: 'http:',
        },
        'https://bomach-os.vercel.app',
      ),
    ).toBe('http://127.0.0.1:5173')
  })

  it('maps standalone Services routes onto the shared-host prefix for the login return', () => {
    expect(
      safeServicesReturnTarget('/app/service-requests?status=open', 'services-mocha-xi.vercel.app'),
    ).toBe('/services/app/service-requests?status=open')
  })

  it('normalizes the shared-host Services root for login return paths', () => {
    expect(safeServicesReturnTarget('/services?tab=overview')).toBe('/services/?tab=overview')
    expect(safeServicesReturnTarget('/app', 'services-mocha-xi.vercel.app')).toBe('/services/app')
  })

  it('does not promote unprefixed routes from the shared Bomach host', () => {
    expect(
      safeServicesReturnTarget('/app/service-requests', 'bomach-os-test.vercel.app'),
    ).toBeNull()
  })
})
