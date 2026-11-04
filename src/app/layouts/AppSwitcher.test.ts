import { describe, expect, it } from 'vitest'

import { getAvailableApps } from './app-switcher.utils'
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
  it('shows Services when at least one existing destination is permitted', () => {
    expect(getAvailableApps(user(['quotes.list'])).map(({ id }) => id)).toEqual(['os', 'services'])
  })

  it('does not show Services when the user has no Services destination access', () => {
    expect(getAvailableApps(user(['employees.list'])).map(({ id }) => id)).toEqual(['os'])
  })
})
