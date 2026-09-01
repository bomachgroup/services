import { Navigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { tokenStore } from '@/shared/auth/token-store'
import { AppShellSkeleton } from '@/shared/ui/skeleton/AppShellSkeleton'

import type { AuthUserKind } from './auth.types'
import { isUserKind } from './auth.utils'
import { useAuth } from './useAuth'

interface RequireAuthProps {
  children: ReactNode
  allowedKinds?: readonly AuthUserKind[]
  loadingFallback?: ReactNode
}

export function RequireAuth({
  children,
  allowedKinds,
  loadingFallback = <AppShellSkeleton />,
}: RequireAuthProps) {
  const auth = useAuth()

  const isEmbed =
    typeof window !== 'undefined' &&
    (window.location.search.includes('embed=true') ||
      window.location.search.includes('embedded=true') ||
      window.location.search.includes('token=') ||
      window.location.search.includes('access_token=') ||
      Boolean(tokenStore.getAccessToken()))

  if (auth.isLoading || (isEmbed && (!auth.isAuthenticated || !auth.user))) {
    return loadingFallback
  }

  if (auth.accessIssue) {
    return <Navigate to="/forbidden" replace />
  }

  if (!auth.isAuthenticated || !auth.user) {
    return <Navigate to="/login" replace />
  }

  if (allowedKinds && !isUserKind(auth.user, allowedKinds)) {
    return <Navigate to="/forbidden" replace />
  }

  return children
}
