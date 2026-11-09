import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  IconApps,
  IconArrowRight,
  IconBriefcase2,
  IconBuildingSkyscraper,
  IconCheck,
  IconChevronDown,
  IconExternalLink,
  IconSpeakerphone,
} from '@tabler/icons-react'

import type { AuthUser } from '@/app/auth'
import { buildRootAppHref } from '@/shared/auth/session-navigation'
import { rememberedWorkspaceHref } from '@/shared/auth/workspace-memory'
import {
  consumeWorkspaceSwitch,
  rememberWorkspaceSwitch,
  WORKSPACE_ARRIVAL_MS,
  WORKSPACE_SWITCH_DELAY_MS,
} from '@/shared/auth/workspace-switch'
import { getAvailableApps } from './app-switcher.utils'
import './app-switcher.css'

type WorkspaceApp = ReturnType<typeof getAvailableApps>[number]

function AppGlyph({ appId }: { appId: WorkspaceApp['id'] }) {
  const Icon =
    appId === 'os'
      ? IconBuildingSkyscraper
      : appId === 'services'
        ? IconBriefcase2
        : IconSpeakerphone
  return <Icon aria-hidden="true" size={19} stroke={1.8} />
}

function SwitchTransition({ app, phase }: { app: WorkspaceApp; phase: 'switching' | 'arriving' }) {
  return (
    <div
      className="workspace-switch-overlay"
      data-phase={phase}
      role="status"
      aria-live="polite"
      aria-label={`${phase === 'switching' ? 'Switching to' : 'Opening'} ${app.label}`}
    >
      <div className="workspace-switch-card">
        <div className="workspace-switch-brand" aria-hidden="true">
          <span className="workspace-switch-brand__letter">B</span>
          <span className="workspace-switch-brand__orbit" />
        </div>
        <div className="workspace-switch-route" aria-hidden="true">
          <span className="workspace-switch-route__app">
            <IconApps size={19} stroke={1.8} />
          </span>
          <span className="workspace-switch-route__line" />
          <span className="workspace-switch-route__arrow">
            <IconArrowRight size={16} stroke={1.8} />
          </span>
          <span className="workspace-switch-route__destination">
            <AppGlyph appId={app.id} />
          </span>
        </div>
        <p className="workspace-switch-eyebrow">BOMACH WORKSPACE</p>
        <p className="workspace-switch-title">
          {phase === 'switching' ? 'Switching to' : 'Welcome to'} {app.label}
        </p>
        <p className="workspace-switch-description">{app.description}</p>
        <div className="workspace-switch-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  )
}

export function AppSwitcher({
  user,
  compact = false,
  placement = 'right',
}: {
  user: AuthUser | null
  compact?: boolean
  placement?: 'left' | 'right'
}) {
  const apps = getAvailableApps(user)
  const currentApp = 'services' as const
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<WorkspaceApp | null>(null)
  const [arriving, setArriving] = useState(false)
  const currentWorkspace = apps.find((app) => app.id === currentApp)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (consumeWorkspaceSwitch(currentApp)) setArriving(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [currentApp])

  useEffect(() => {
    if (!arriving) return
    const timer = window.setTimeout(() => setArriving(false), WORKSPACE_ARRIVAL_MS)
    return () => window.clearTimeout(timer)
  }, [arriving])

  useLayoutEffect(() => {
    if (!menuOpen || !detailsRef.current || !menuRef.current) return

    const details = detailsRef.current
    const menu = menuRef.current
    const positionMenu = () => {
      const anchor = details.getBoundingClientRect()
      const width = Math.min(296, window.innerWidth - 24)
      const desiredLeft = placement === 'left' ? anchor.left : anchor.right - width
      const viewportLeft = Math.min(Math.max(12, desiredLeft), window.innerWidth - width - 12)
      menu.style.left = `${viewportLeft - anchor.left}px`
      menu.style.right = 'auto'
      menu.style.width = `${width}px`
    }

    positionMenu()
    window.addEventListener('resize', positionMenu)
    return () => {
      window.removeEventListener('resize', positionMenu)
      menu.style.left = ''
      menu.style.right = ''
      menu.style.width = ''
    }
  }, [menuOpen, placement])

  function navigateToApp(event: MouseEvent<HTMLAnchorElement>, app: WorkspaceApp, href: string) {
    if (
      app.id === currentApp ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    rememberWorkspaceSwitch(app.id)
    detailsRef.current?.removeAttribute('open')
    setSwitchingTo(app)

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(
      () => window.location.assign(href),
      reducedMotion ? 0 : WORKSPACE_SWITCH_DELAY_MS,
    )
  }

  return (
    <>
      <details
        ref={detailsRef}
        className="group/app-switcher relative z-40 shrink-0"
        onToggle={(event) => setMenuOpen(event.currentTarget.open)}
      >
        <summary
          aria-label="Switch workspace"
          title="Switch workspace"
          className="workspace-switch-trigger border-border bg-surface text-foreground-muted hover:bg-surface-muted focus-visible:ring-brand-500 flex size-10 cursor-pointer list-none items-center justify-center rounded-xl border transition-colors focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
        >
          <IconApps
            aria-hidden="true"
            size={18}
            className="transition-transform duration-200 group-open/app-switcher:rotate-45 motion-reduce:transition-none"
          />
          <IconChevronDown aria-hidden="true" className="workspace-switch-trigger__chevron" />
        </summary>
        <div
          ref={menuRef}
          className={`workspace-switch-menu border-border bg-surface shadow-elevation-lg absolute top-[calc(100%+0.65rem)] w-[min(20rem,calc(100vw-1.5rem))] rounded-[1.35rem] border p-2 ${placement === 'left' ? 'left-0' : 'right-0'}`}
          aria-label="Available workspaces"
        >
          <div className="workspace-switch-menu__header">
            <span className="workspace-switch-menu__eyebrow">BOMACH WORKSPACE</span>
            <span className="workspace-switch-menu__title">Switch workspace</span>
            <span className="workspace-switch-menu__hint">
              {currentWorkspace ? `Currently in ${currentWorkspace.label}` : 'Choose an app'}
            </span>
          </div>
          <div className="workspace-switch-menu__list">
            {apps.map((app) => {
              const active = app.id === currentApp
              const rememberedHref = user ? rememberedWorkspaceHref(user.id, app.id) : null
              const href =
                app.id === 'os'
                  ? buildRootAppHref(rememberedHref)
                  : app.id === 'marketing'
                    ? buildRootAppHref(rememberedHref ?? app.href)
                    : (rememberedHref ?? app.href)
              const itemClassName = `workspace-switch-option ${active ? 'is-current' : ''}`
              const content = (
                <>
                  <span
                    className={`workspace-switch-option__icon workspace-switch-option__icon--${app.id}`}
                  >
                    <AppGlyph appId={app.id} />
                  </span>
                  <span className="workspace-switch-option__copy">
                    <span className="workspace-switch-option__name">{app.label}</span>
                    {!compact ? (
                      <span className="workspace-switch-option__description">
                        {app.description}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <span className="workspace-switch-option__state">
                      <IconCheck aria-hidden="true" size={14} />
                      Current
                    </span>
                  ) : (
                    <IconArrowRight aria-hidden="true" className="workspace-switch-option__arrow" />
                  )}
                </>
              )

              return (
                <div key={app.id} className={itemClassName}>
                  {active ? (
                    <span className="workspace-switch-option__main" aria-current="page">
                      {content}
                    </span>
                  ) : (
                    <a
                      href={href}
                      className="workspace-switch-option__main"
                      onClick={(event) => navigateToApp(event, app, href)}
                    >
                      {content}
                    </a>
                  )}
                  <a
                    href={href}
                    className="workspace-switch-option__open"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${app.label} in a new tab`}
                    title={`Open ${app.label} in a new tab`}
                  >
                    <IconExternalLink aria-hidden="true" size={17} stroke={1.8} />
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      </details>
      {switchingTo
        ? createPortal(<SwitchTransition app={switchingTo} phase="switching" />, document.body)
        : null}
      {!switchingTo && arriving && currentWorkspace
        ? createPortal(<SwitchTransition app={currentWorkspace} phase="arriving" />, document.body)
        : null}
    </>
  )
}
