import { Link } from '@tanstack/react-router'
import { IconSearch } from '@tabler/icons-react'

import { ModuleScrollArea } from '@/shared/ui/module-controls'

export function NotFoundPage() {
  return (
    <ModuleScrollArea>
      <div className="flex min-h-[70svh] items-center justify-center p-4 sm:p-6 lg:p-8">
        <section
          aria-labelledby="not-found-title"
          className="border-border bg-surface shadow-card w-full max-w-2xl rounded-2xl border px-6 py-10 text-center sm:px-10 sm:py-12"
        >
          <span className="bg-brand-50 text-brand-700 mx-auto grid size-14 place-items-center rounded-2xl">
            <IconSearch size={26} stroke={1.8} aria-hidden="true" />
          </span>
          <p className="text-brand-700 mt-5 text-xs font-bold tracking-[0.14em] uppercase">404</p>
          <h1 id="not-found-title" className="text-foreground mt-1 text-2xl font-extrabold">
            Page not found
          </h1>
          <p className="text-foreground-muted mx-auto mt-2 max-w-md text-sm leading-6">
            We couldn’t find the page you’re looking for. The address may be incorrect, or the page
            may have moved.
          </p>
          <Link
            to="/app/dashboard"
            className="bg-brand-600 hover:bg-brand-800 rounded-control focus-visible:ring-brand-600 mt-6 inline-flex h-10 items-center justify-center px-4 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Go to dashboard
          </Link>
        </section>
      </div>
    </ModuleScrollArea>
  )
}
