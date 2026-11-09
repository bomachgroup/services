import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearWorkspaceMemory,
  rememberedWorkspaceHref,
  saveWorkspaceLocation,
  WORKSPACE_MEMORY_KEY,
} from './workspace-memory'

describe('shared workspace location memory', () => {
  beforeEach(() => window.localStorage.clear())

  it('uses the shared Services prefix and keeps each app location for the signed-in user', () => {
    saveWorkspaceLocation('staff-7', 'os', '/hr/employees?status=active')
    saveWorkspaceLocation('staff-7', 'services', '/app/calculator-library?tab=recent')
    saveWorkspaceLocation('staff-7', 'marketing', '/marketing/campaigns?tab=active')

    expect(rememberedWorkspaceHref('staff-7', 'services')).toBe(
      '/services/app/calculator-library?tab=recent',
    )
    expect(rememberedWorkspaceHref('staff-7', 'os')).toBe('/hr/employees?status=active')
    expect(rememberedWorkspaceHref('staff-7', 'marketing')).toBe('/marketing/campaigns?tab=active')
    expect(rememberedWorkspaceHref('staff-8', 'services')).toBeNull()
  })

  it('removes private query values and rejects unsafe or cross-app routes', () => {
    saveWorkspaceLocation('staff-7', 'services', '/app/requests?status=open&search=private')
    expect(rememberedWorkspaceHref('staff-7', 'services')).toBe(
      '/services/app/requests?status=open',
    )

    clearWorkspaceMemory()
    saveWorkspaceLocation('staff-7', 'os', '/services/app/dashboard')
    expect(window.localStorage.getItem(WORKSPACE_MEMORY_KEY)).toBeNull()

    saveWorkspaceLocation('staff-7', 'marketing', '/services/app/dashboard')
    expect(window.localStorage.getItem(WORKSPACE_MEMORY_KEY)).toBeNull()
  })

  it('clears memory only for the matching user when a user id is provided', () => {
    saveWorkspaceLocation('staff-7', 'services', '/app/dashboard')
    clearWorkspaceMemory('staff-8')
    expect(rememberedWorkspaceHref('staff-7', 'services')).toBe('/services/app/dashboard')

    clearWorkspaceMemory('staff-7')
    expect(window.localStorage.getItem(WORKSPACE_MEMORY_KEY)).toBeNull()
  })
})
