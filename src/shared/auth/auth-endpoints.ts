export const AUTH_ENDPOINTS = {
  twoFactorStatus: '/auth/2fa/status',
  enableTwoFactor: '/auth/2fa/enable',
  disableTwoFactor: '/auth/2fa/disable',
  logout: '/auth/browser/logout',
  refresh: '/auth/browser/refresh',
  me: '/auth/me',
  verifyToken: '/auth/verify-token',
  employeeRole: (userId: string | number) => `/roles/employees/${userId}`,
  permissionsMap: '/roles/permissions-map',
  authorityLimits: '/roles/me/authority-limits',
} as const
