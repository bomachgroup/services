import { createRouter } from '@tanstack/react-router'

import type { AuthContextValue } from '@/app/auth'
import { queryClient } from '@/app/query/query-client'
import { routeTree } from '@/routeTree.gen'
import { resolveRouterBasePath } from './base-path'

export interface RouterContext {
  queryClient: typeof queryClient
  auth: AuthContextValue
}

export const router = createRouter({
  routeTree,
  basepath: resolveRouterBasePath(import.meta.env.BASE_URL),
  context: {
    queryClient,
    auth: undefined!,
  },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
