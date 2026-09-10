import { redirect } from '@tanstack/react-router'

import { tokenStore } from '@/shared/auth/token-store'

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
  const isEmbed =
    typeof window !== 'undefined' &&
    (window.location.search.includes('embed=true') ||
      window.location.search.includes('embedded=true') ||
      Boolean(tokenStore.getAccessToken()))

  if (auth.isLoading || (isEmbed && (!auth.isAuthenticated || !auth.user))) {
    return
  }

  if (auth.accessIssue) {
    return redirect({
      to: '/forbidden',
      replace: true,
    })
  }

  if (!auth.isAuthenticated || !auth.user) {
    return redirect({
      to: '/login',
      search: {
        redirect: locationHref,
      },
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
