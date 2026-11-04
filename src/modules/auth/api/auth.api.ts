import { ApiError } from '@/shared/api/api-error'
import { apiClient } from '@/shared/api/api-client'
import { AUTH_ENDPOINTS } from '@/shared/auth/auth-endpoints'

import { AuthAccessError } from '../errors/auth-access-error'
import { mapAuthenticatedUser } from '../mappers/auth.mapper'
import type {
  AuthorityLimitsResponseDto,
  PermissionsMapResponseDto,
  RoleResponseDto,
  TwoFactorStatusResponseDto,
  TwoFactorToggleRequestDto,
  TwoFactorToggleResponseDto,
  UserResponseDto,
  VerifyTokenResponseDto,
} from '../types/auth.contracts'
import type { AuthenticatedUser } from '../types/auth.types'

async function loadStaffUser(user: UserResponseDto): Promise<AuthenticatedUser> {
  try {
    const role = await apiClient.get<RoleResponseDto>(AUTH_ENDPOINTS.employeeRole(user.id))
    return mapAuthenticatedUser(user, role)
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      if (error.message === 'Employee profile not found.') {
        throw new AuthAccessError('employee-profile-missing', error.message)
      }

      if (
        error.message === 'No role assigned.' ||
        error.message === 'No role assigned to this employee.'
      ) {
        throw new AuthAccessError('role-missing', error.message)
      }

      throw new AuthAccessError('role-access-denied', error.message)
    }

    throw error
  }
}

async function currentUser(): Promise<AuthenticatedUser | null> {
  try {
    const user = await apiClient.get<UserResponseDto>(AUTH_ENDPOINTS.me)
    return await loadStaffUser(user)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

async function logout(): Promise<void> {
  await apiClient.post<{ success: true }>(AUTH_ENDPOINTS.logout)
}

async function getTwoFactorStatus(): Promise<TwoFactorStatusResponseDto> {
  return apiClient.get<TwoFactorStatusResponseDto>(AUTH_ENDPOINTS.twoFactorStatus)
}

async function enableTwoFactor(
  payload: TwoFactorToggleRequestDto,
): Promise<TwoFactorToggleResponseDto> {
  return apiClient.post<TwoFactorToggleResponseDto>(AUTH_ENDPOINTS.enableTwoFactor, payload)
}

async function disableTwoFactor(
  payload: TwoFactorToggleRequestDto,
): Promise<TwoFactorToggleResponseDto> {
  return apiClient.post<TwoFactorToggleResponseDto>(AUTH_ENDPOINTS.disableTwoFactor, payload)
}

async function verifyToken(): Promise<VerifyTokenResponseDto> {
  return apiClient.get<VerifyTokenResponseDto>(AUTH_ENDPOINTS.verifyToken)
}

async function getPermissionsMap(): Promise<PermissionsMapResponseDto> {
  return apiClient.get<PermissionsMapResponseDto>(AUTH_ENDPOINTS.permissionsMap)
}

async function getAuthorityLimits(): Promise<AuthorityLimitsResponseDto> {
  return apiClient.get<AuthorityLimitsResponseDto>(AUTH_ENDPOINTS.authorityLimits)
}

export const authApi = {
  getTwoFactorStatus,
  enableTwoFactor,
  disableTwoFactor,
  currentUser,
  verifyToken,
  getPermissionsMap,
  getAuthorityLimits,
  logout,
}
