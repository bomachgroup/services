import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import { authMutations } from '@/modules/auth/api/auth.mutations'
import { authQueries } from '@/modules/auth/api/auth.queries'
import { isAuthAccessError } from '@/modules/auth/errors/auth-access-error'
import type { LoginCredentials, LoginResult } from '@/modules/auth/types/auth.types'
import { redirectToSessionExpiredLogin } from '@/shared/auth/session-navigation'
import { tokenStore } from '@/shared/auth/token-store'
import { useToast } from '@/shared/ui'

import { AuthContext } from './auth.context'
import type { AuthContextValue, AuthUser } from './auth.types'

type AuthTokenMessage = {
  type: 'BOMACH_AUTH_TOKEN'
  token: string
  refreshToken?: string
}

function isAuthTokenMessage(value: unknown): value is AuthTokenMessage {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return payload.type === 'BOMACH_AUTH_TOKEN' && typeof payload.token === 'string'
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const isEmbedded = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('embed') === 'true'
  }, [])
  const [embedAuthReady, setEmbedAuthReady] = useState(
    () => !isEmbedded || Boolean(tokenStore.getAccessToken() || tokenStore.hasRefreshToken()),
  )
  const [authBootstrapError, setAuthBootstrapError] = useState<string | null>(null)
  const currentUserQueryOptions = useMemo(
    () => authQueries.currentUser(embedAuthReady),
    [embedAuthReady],
  )
  const currentUserQuery = useQuery(currentUserQueryOptions)
  const { mutateAsync: loginMutateAsync } = useMutation(authMutations.login())
  const { mutateAsync: verifyTwoFactorMutateAsync } = useMutation(authMutations.verifyTwoFactor())
  const { mutateAsync: logoutMutateAsync } = useMutation(authMutations.logout())

  useEffect(() => {
    const unsubscribe = tokenStore.subscribe(({ tokens, reason }) => {
      if (tokens) return

      queryClient.setQueryData(currentUserQueryOptions.queryKey, null)

      if (reason === 'expired' || reason === 'invalid' || reason === 'storage-cleared') {
        queryClient.clear()
        redirectToSessionExpiredLogin()
      }
    })

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage) tokenStore.syncFromStorage()
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      unsubscribe()
      window.removeEventListener('storage', handleStorage)
    }
  }, [currentUserQueryOptions.queryKey, queryClient])

  // Handle token passed from query params (e.g. embedded in Bomach OS) or window postMessage
  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const queryToken = params.get('token') || params.get('access_token')
    const queryRefreshToken = params.get('refresh_token') || queryToken

    if (queryToken) {
      tokenStore.set({
        accessToken: queryToken,
        refreshToken: queryRefreshToken || queryToken,
      })
      queueMicrotask(() => {
        setEmbedAuthReady(true)
        setAuthBootstrapError(null)
        void queryClient.invalidateQueries({
          queryKey: currentUserQueryOptions.queryKey,
        })
      })
    }

    if (!isEmbedded || window.parent === window) return

    const parentOrigin = (() => {
      try {
        return document.referrer ? new URL(document.referrer).origin : '*'
      } catch {
        return '*'
      }
    })()
    let readyAnnouncements = 0
    const announceReady = () => {
      window.parent.postMessage({ type: 'BOMACH_AUTH_READY' }, parentOrigin)
      readyAnnouncements += 1
    }

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent ||
        (parentOrigin !== '*' && event.origin !== parentOrigin) ||
        !isAuthTokenMessage(event.data)
      ) {
        return
      }

      const token = event.data.token
      tokenStore.set({
        accessToken: token,
        refreshToken: typeof event.data.refreshToken === 'string' ? event.data.refreshToken : token,
      })
      setEmbedAuthReady(true)
      setAuthBootstrapError(null)
      void queryClient.invalidateQueries({
        queryKey: currentUserQueryOptions.queryKey,
      })
    }

    window.addEventListener('message', handleMessage)
    announceReady()
    const retryTimer = window.setInterval(() => {
      if (tokenStore.getAccessToken() || readyAnnouncements >= 12) {
        window.clearInterval(retryTimer)
        return
      }
      announceReady()
    }, 1000)
    const timeout = window.setTimeout(() => {
      if (!tokenStore.getAccessToken()) {
        setAuthBootstrapError(
          'Bomach OS did not provide a valid session to Services. Return to Bomach OS and open Services again.',
        )
      }
    }, 12000)

    return () => {
      window.clearInterval(retryTimer)
      window.clearTimeout(timeout)
      window.removeEventListener('message', handleMessage)
    }
  }, [currentUserQueryOptions.queryKey, isEmbedded, queryClient])

  const loadCurrentUser = useCallback(async (): Promise<AuthUser> => {
    const user = await queryClient.fetchQuery({
      ...currentUserQueryOptions,
      staleTime: 0,
    })

    if (!user) throw new Error('The authenticated user could not be loaded.')
    return user
  }, [currentUserQueryOptions, queryClient])

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResult> => {
      const result = await loginMutateAsync(credentials)

      if (result.type === 'authenticated') {
        try {
          await queryClient.invalidateQueries({
            queryKey: currentUserQueryOptions.queryKey,
          })
          const user = await loadCurrentUser()
          toast.success('Signed in successfully', {
            description: `${user.name} is now signed in.`,
          })
          return { type: 'authenticated', user }
        } catch (error) {
          // Login issued tokens, but staff bootstrap failed. Clear the half-session
          // so the login form can show a single recoverable error.
          tokenStore.clear('manual')
          queryClient.setQueryData(currentUserQueryOptions.queryKey, null)
          throw error
        }
      }

      return result
    },
    [currentUserQueryOptions.queryKey, loadCurrentUser, loginMutateAsync, queryClient, toast],
  )

  const verifyTwoFactor = useCallback(
    async (sessionToken: string, code: string): Promise<AuthUser> => {
      try {
        await verifyTwoFactorMutateAsync({ session_token: sessionToken, code })
        await queryClient.invalidateQueries({
          queryKey: currentUserQueryOptions.queryKey,
        })
        const user = await loadCurrentUser()
        toast.success('Signed in successfully', {
          description: `${user.name} is now signed in.`,
        })
        return user
      } catch (error) {
        if (tokenStore.getAccessToken()) {
          tokenStore.clear('manual')
          queryClient.setQueryData(currentUserQueryOptions.queryKey, null)
        }
        throw error
      }
    },
    [
      currentUserQueryOptions.queryKey,
      loadCurrentUser,
      queryClient,
      toast,
      verifyTwoFactorMutateAsync,
    ],
  )

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await logoutMutateAsync()
    } finally {
      tokenStore.clear('logout')
      queryClient.clear()
      toast.success('Signed out', {
        description: 'You have been logged out of the workspace.',
      })
    }
  }, [logoutMutateAsync, queryClient, toast])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: currentUserQuery.data ?? null,
      isAuthenticated: Boolean(currentUserQuery.data),
      isLoading:
        currentUserQuery.isPending && !currentUserQuery.data && authBootstrapError === null,
      authBootstrapError,
      accessIssue: isAuthAccessError(currentUserQuery.error) ? currentUserQuery.error.issue : null,
      login,
      verifyTwoFactor,
      signOut,
    }),
    [
      currentUserQuery.data,
      currentUserQuery.error,
      currentUserQuery.isPending,
      authBootstrapError,
      login,
      signOut,
      verifyTwoFactor,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
