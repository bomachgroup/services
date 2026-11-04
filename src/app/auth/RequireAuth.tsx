import { Navigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'

import { authKeys } from '@/modules/auth/api/auth.keys'
import { presentError } from '@/shared/errors'
import { ErrorState } from '@/shared/ui/error-state/ErrorState'
import { AppShellSkeleton } from '@/shared/ui/skeleton/AppShellSkeleton'
import { redirectToCentralLogin } from '@/shared/auth/session-navigation'

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
  const queryClient = useQueryClient()

  const isUnauthenticated = !auth.isLoading && !auth.authLoadError && !auth.isAuthenticated

  useEffect(() => {
    if (!isUnauthenticated) return
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    redirectToCentralLogin(currentPath)
  }, [isUnauthenticated])

  if (auth.accessIssue) {
    return <Navigate to="/forbidden" replace />
  }

  if (auth.authLoadError) {
    const error = presentError(auth.authLoadError, 'page-load')
    return (
      <main className="bg-surface-muted grid min-h-svh place-items-center p-4">
        <div className="w-full max-w-xl">
          <ErrorState
            title={error.title}
            description={error.message}
            onRetry={() =>
              void queryClient.refetchQueries({ queryKey: authKeys.currentUser(), type: 'active' })
            }
          />
        </div>
      </main>
    )
  }

  if (auth.isLoading || isUnauthenticated) {
    return loadingFallback
  }

  if (!auth.isAuthenticated || !auth.user) {
    return loadingFallback
  }

  if (allowedKinds && !isUserKind(auth.user, allowedKinds)) {
    return <Navigate to="/forbidden" replace />
  }

  return children
}
