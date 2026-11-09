import { describe, expect, it } from 'vitest'

import { getAvailableApps, resolveServicesAppHref } from './app-switcher.utils'
import type { AuthUser } from '@/app/auth'

function user(permissions: string[]): AuthUser {
  return {
    id: '1',
    name: 'Test Staff',
    email: 'staff@example.test',
    username: 'staff',
    initials: 'TS',
    role: 'UNKNOWN',
    roleLabel: 'Staff User',
    backendRoleId: 1,
    kind: 'staff',
    permissions: permissions as AuthUser['permissions'],
    backendPermissions: permissions,
    isVerified: true,
  }
}

describe('workspace app switcher access', () => {
  it('keeps the Services self-link correct for standalone and shared-host builds', () => {
    expect(resolveServicesAppHref('/')).toBe('/')
    expect(resolveServicesAppHref('/services/')).toBe('/services/')
  })

  it('shows Services when at least one existing destination is permitted', () => {
    const apps = getAvailableApps(user(['quotes.list']))
    expect(apps.map(({ id }) => id)).toEqual(['os', 'services'])
    expect(apps.find(({ id }) => id === 'services')?.href).toBe('/')
  })

  it('does not show Services when the user has no Services destination access', () => {
    expect(getAvailableApps(user(['hr_employees.list'])).map(({ id }) => id)).toEqual(['os'])
  })

  it('shows Marketing only when the user has a Marketing destination permission', () => {
    expect(getAvailableApps(user(['marketing_campaigns.list'])).map(({ id }) => id)).toEqual([
      'os',
      'marketing',
    ])
    expect(getAvailableApps(user(['hr_employees.list'])).map(({ id }) => id)).not.toContain(
      'marketing',
    )
  })
})
