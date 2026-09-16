import { APP_PERMISSION_VALUES, type AppPermission } from '@/app/permissions/permission.types'
import { PERMISSIONS } from '@/app/permissions'

const appPermissions = new Set<string>(APP_PERMISSION_VALUES)

export interface BackendPermissionMapping {
  permissions: AppPermission[]
  backendPermissions: string[]
  unmappedBackendPermissions: string[]
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function flattenBackendPermissions(permissions: Record<string, string[]>): string[] {
  return Object.entries(permissions).flatMap(([resource, actions]) => {
    const normalizedResource = normalize(resource)
    return actions.map((action) => `${normalizedResource}.${normalize(action)}`)
  })
}

export function mapBackendPermissions(
  permissions: Record<string, string[]>,
): BackendPermissionMapping {
  const backendPermissions = flattenBackendPermissions(permissions)
  const granted = new Set<AppPermission>()
  const unmappedBackendPermissions: string[] = []

  const isGlobalWildcard =
    Boolean(permissions['*']?.some((a) => a === '*' || a === 'all')) ||
    Boolean(permissions['all']?.some((a) => a === '*' || a === 'all')) ||
    Boolean(permissions['admin']) ||
    backendPermissions.includes('*.*') ||
    backendPermissions.includes('*.all') ||
    backendPermissions.includes('all.*') ||
    backendPermissions.includes('all.all')

  if (isGlobalWildcard) {
    for (const perm of APP_PERMISSION_VALUES) {
      granted.add(perm)
    }
  } else {
    for (const [resource, actions] of Object.entries(permissions)) {
      const normalizedResource = normalize(resource)
      const hasWildcardAction = actions.some((a) => {
        const norm = normalize(a)
        return norm === '*' || norm === 'all' || norm === 'manage'
      })

      if (hasWildcardAction) {
        for (const appPerm of APP_PERMISSION_VALUES) {
          if (appPerm.startsWith(`${normalizedResource}.`)) {
            granted.add(appPerm)
          }
        }
      }
    }

    for (const backendPermission of backendPermissions) {
      if (appPermissions.has(backendPermission)) {
        granted.add(backendPermission as AppPermission)
      } else {
        unmappedBackendPermissions.push(backendPermission)
      }
    }
  }

  if (
    backendPermissions.includes('categories.list') ||
    backendPermissions.includes('service_parents.list') ||
    backendPermissions.includes('services.create')
  ) {
    granted.add(PERMISSIONS.serviceParentsList)
  }

  if (backendPermissions.includes('service_requests.create')) {
    granted.add(PERMISSIONS.clientsList)
    granted.add(PERMISSIONS.clientsCreate)
  }

  if (
    backendPermissions.includes('documents.view') ||
    backendPermissions.includes('orders.view') ||
    backendPermissions.includes('orders.list')
  ) {
    granted.add(PERMISSIONS.deliverableRead)
  }

  return {
    permissions: [...granted],
    backendPermissions,
    unmappedBackendPermissions,
  }
}
