import { createFileRoute, redirect } from '@tanstack/react-router'

import { buildCentralLoginUrl } from '@/shared/auth/session-navigation'

interface LoginSearch {
  returnTo?: string
  redirect?: string
}

function validateLoginSearch(search: Record<string, unknown>): LoginSearch {
  const result: LoginSearch = {}
  if (typeof search.returnTo === 'string') result.returnTo = search.returnTo
  if (typeof search.redirect === 'string') result.redirect = search.redirect
  return result
}

export const Route = createFileRoute('/login')({
  validateSearch: validateLoginSearch,
  beforeLoad: ({ search }) => {
    return redirect({
      href: buildCentralLoginUrl(search.returnTo ?? search.redirect ?? '/services'),
      replace: true,
    })
  },
})
