import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, type PropsWithChildren } from 'react'

import { authQueries } from '@/modules/auth/api/auth.queries'
import { authApi } from '@/modules/auth/api/auth.api'
import { isAuthAccessError } from '@/modules/auth/errors/auth-access-error'
import { SESSION_ESTABLISHED_KEY, SESSION_EXPIRED_EVENT } from '@/shared/api/api-client'
import { redirectToSessionExpiredLogin } from '@/shared/auth/session-navigation'
import { useToast } from '@/shared/ui'

import { AuthContext } from './auth.context'
import type { AuthContextValue } from './auth.types'

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const currentUserQueryOptions = authQueries.currentUser()
  const currentUserQuery = useQuery(currentUserQueryOptions)
  const { mutateAsync: logoutAsync } = useMutation({ mutationFn: authApi.logout })

  useEffect(() => {
    const handleSessionExpired = () => {
      queryClient.clear()
      redirectToSessionExpiredLogin()
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [queryClient])

  useEffect(() => {
    if (currentUserQuery.data) window.sessionStorage.setItem(SESSION_ESTABLISHED_KEY, '1')
  }, [currentUserQuery.data])

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await logoutAsync()
    } catch (error) {
      toast.error('Could not sign out', {
        description: 'Your session is still active. Check your connection and try again.',
      })
      throw error
    }

    window.sessionStorage.removeItem(SESSION_ESTABLISHED_KEY)
    window.sessionStorage.removeItem('bomach:session-expired-notice')
    queryClient.clear()
    toast.success('Signed out', {
      description: 'You have been logged out of the workspace.',
    })
  }, [logoutAsync, queryClient, toast])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: currentUserQuery.data ?? null,
      isAuthenticated: Boolean(currentUserQuery.data),
      isLoading: currentUserQuery.isPending && !currentUserQuery.data,
      authLoadError: currentUserQuery.data ? null : currentUserQuery.error,
      accessIssue: isAuthAccessError(currentUserQuery.error) ? currentUserQuery.error.issue : null,
      signOut,
    }),
    [currentUserQuery.data, currentUserQuery.error, currentUserQuery.isPending, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
