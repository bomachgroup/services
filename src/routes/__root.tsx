import {
  Outlet,
  createRootRouteWithContext,
  type ErrorComponentProps,
} from '@tanstack/react-router'

import type { RouterContext } from '@/app/router/router'
import { NotFoundPage, OperationsLayout } from '@/app/layouts'
import { ErrorState } from '@/shared/ui/error-state'

function RootComponent() {
  return <Outlet />
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <main className="bg-background grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-xl">
        <ErrorState
          title="The application could not continue"
          description={error.message}
          onRetry={reset}
        />
      </div>
    </main>
  )
}

function NotFoundComponent() {
  return (
    <OperationsLayout>
      <NotFoundPage />
    </OperationsLayout>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: NotFoundComponent,
})
