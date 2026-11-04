export interface UserResponseDto {
  id: number
  email: string
  username: string
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  is_verified: boolean
  is_superuser?: boolean
  created_at: string
}

export interface BranchMinimalDto {
  id: number
  branch_name: string
}

export interface RoleResponseDto {
  id: number
  name: string
  branches: BranchMinimalDto[]
  permissions: Record<string, string[]>
  created_at: string
  updated_at: string
}

export interface ErrorResponseDto {
  detail: string
}

export interface TwoFactorStatusResponseDto {
  success: boolean
  two_factor_enabled: boolean
}

export interface TwoFactorToggleRequestDto {
  password: string
}

export type TwoFactorToggleResponseDto = TwoFactorStatusResponseDto

export interface VerifyTokenResponseDto {
  success: boolean
  valid: boolean
  user_id: number | null
  detail: string
}

export interface PermissionsMapResponseDto {
  permissions_map: Record<string, string[]>
}

export interface AuthorityLimitItemDto {
  resource: string
  action: string
  label: string
  helper_text: string
}

export interface AuthorityLimitsResponseDto {
  items: AuthorityLimitItemDto[]
}
