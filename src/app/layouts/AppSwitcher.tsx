import { IconApps } from '@tabler/icons-react'

import type { AuthUser } from '@/app/auth'
import { buildRootAppHref } from '@/shared/auth/session-navigation'
import { getAvailableApps } from './app-switcher.utils'

export function AppSwitcher({
  user,
  compact = false,
  placement = 'right',
}: {
  user: AuthUser | null
  compact?: boolean
  placement?: 'left' | 'right'
}) {
  return (
    <details className="group/app-switcher relative z-40 shrink-0">
      <summary
        aria-label="Switch application"
        title="Switch application"
        className="border-border bg-surface text-foreground-muted hover:bg-surface-muted focus-visible:ring-brand-500 flex size-9 cursor-pointer list-none items-center justify-center rounded-xl border transition-colors focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      >
        <IconApps aria-hidden="true" size={18} />
      </summary>
      <div
        className={`border-border bg-surface shadow-elevation-lg absolute top-[calc(100%+0.5rem)] w-[min(18rem,calc(100vw-2rem))] rounded-2xl border p-2 ${placement === 'left' ? 'left-0' : 'right-0'}`}
      >
        <p className="text-foreground-muted px-3 py-2 text-xs font-semibold">Your applications</p>
        <div className="space-y-1">
          {getAvailableApps(user).map((app) => {
            const active = app.id === 'services'
            const href = app.id === 'os' ? buildRootAppHref() : app.href
            return (
              <a
                key={app.id}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors outline-none focus-visible:ring-2 ${active ? 'bg-brand-50 text-brand-700' : 'text-foreground hover:bg-surface-muted'}`}
              >
                <span className="border-border bg-surface text-brand-600 flex size-9 shrink-0 items-center justify-center rounded-xl border">
                  <IconApps aria-hidden="true" size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{app.label}</span>
                  {!compact ? (
                    <span className="text-foreground-muted block truncate text-[0.6875rem]">
                      {app.description}
                    </span>
                  ) : null}
                </span>
                {active ? (
                  <span className="text-foreground-muted text-[0.625rem]">Current</span>
                ) : null}
              </a>
            )
          })}
        </div>
      </div>
    </details>
  )
}
