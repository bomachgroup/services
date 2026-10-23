import { describe, expect, it } from 'vitest'

import { mapBackendPermissions } from './auth-permissions.mapper'
import { PERMISSIONS } from '@/app/permissions'

describe('mapBackendPermissions', () => {
  it('does not infer global access beyond the supplied permission map', () => {
    const result = mapBackendPermissions({ dashboard: ['view'] })

    expect(result.permissions).toEqual([PERMISSIONS.dashboardView])
    expect(result.permissions).not.toContain(PERMISSIONS.estatesDelete)
  })

  it('does not infer unrelated resources from services.list', () => {
    const result = mapBackendPermissions({ services: ['list'] })

    expect(result.permissions).toEqual([PERMISSIONS.servicesList])
    expect(result.permissions).not.toContain(PERMISSIONS.serviceWorkflowsList)
    expect(result.permissions).not.toContain(PERMISSIONS.serviceRequestFormsCreate)
  })

  it('keeps explicit wildcard grants scoped to their resource', () => {
    const result = mapBackendPermissions({ services: ['*'] })

    expect(result.permissions).toContain(PERMISSIONS.servicesCreate)
    expect(result.permissions).not.toContain(PERMISSIONS.estatesCreate)
  })
})
