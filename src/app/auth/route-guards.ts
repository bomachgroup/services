import { redirect } from '@tanstack/react-router'

import { buildCentralLoginUrl } from '@/shared/auth/session-navigation'

import type { AuthContextValue, AuthUserKind } from './auth.types'

interface RequireAuthenticatedUserOptions {
  auth: AuthContextValue
  locationHref: string
  allowedKinds?: readonly AuthUserKind[]
}

export function requireAuthenticatedUser({
  auth,
  locationHref,
  allowedKinds,
}: RequireAuthenticatedUserOptions): void | ReturnType<typeof redirect> {
  if (auth.isLoading) return

  if (auth.authLoadError) return

  if (auth.accessIssue) {
    return redirect({
      to: '/forbidden',
      replace: true,
    })
  }

  if (!auth.isAuthenticated || !auth.user) {
    return redirect({
      href: buildCentralLoginUrl(locationHref),
      replace: true,
    })
  }

  if (allowedKinds && !allowedKinds.includes(auth.user.kind)) {
    return redirect({
      to: '/forbidden',
      replace: true,
    })
  }
}
