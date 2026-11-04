import type { AppRole, AuthUserKind } from '@/app/auth/auth.types'
import type { AppPermission } from '@/app/permissions'

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  username: string
  initials: string
  role: AppRole
  roleLabel: string
  backendRoleId: number | null
  kind: AuthUserKind
  permissions: AppPermission[]
  backendPermissions: string[]
  isVerified: boolean
}
