import { render, screen } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('shows a real not-found state and links back to the staff dashboard', async () => {
    const rootRoute = createRootRoute({ component: NotFoundPage })
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ['/not-found'] }),
    })

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
      'href',
      '/app/dashboard',
    )
  })
})
