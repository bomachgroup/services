import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
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
  consumeWorkspaceSwitchTransition,
  rememberWorkspaceSwitch,
  WORKSPACE_ARRIVAL_MS,
  WORKSPACE_SWITCH_DELAY_MS,
  type WorkspaceSwitchOrigin,
  type WorkspaceSwitchTransition,
} from '@/shared/auth/workspace-switch'
import { getAvailableApps } from './app-switcher.utils'
import './app-switcher.css'

type WorkspaceApp = ReturnType<typeof getAvailableApps>[number]
type WorkspaceAppId = WorkspaceApp['id']

function AppGlyph({ appId }: { appId: WorkspaceAppId }) {
  const Icon =
    appId === 'os'
      ? IconBuildingSkyscraper
      : appId === 'services'
        ? IconBriefcase2
        : IconSpeakerphone
  return <Icon aria-hidden="true" size={19} stroke={1.8} />
}

function OpenInNewTabIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-[17px]"
    >
      <path
        d="M11.25 3.75h5v5M16 4l-7 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 11.25v4A.75.75 0 0 1 14.25 16h-9.5A.75.75 0 0 1 4 15.25v-9.5A.75.75 0 0 1 4.75 5h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function workspaceLabel(appId: WorkspaceAppId) {
  return appId === 'os' ? 'Bomach OS' : appId === 'services' ? 'Services' : 'Marketing'
}

function workspaceDescription(appId: WorkspaceAppId) {
  return appId === 'os'
    ? 'People and company operations'
    : appId === 'services'
      ? 'Service delivery and commercial operations'
      : 'Campaigns, pipeline, and revenue execution'
}

function SwitchTransition({
  sourceApp,
  targetApp,
  origin,
  phase,
}: {
  sourceApp: WorkspaceAppId
  targetApp: WorkspaceAppId
  origin: WorkspaceSwitchOrigin
  phase: 'departing' | 'arriving'
}) {
  const style = {
    '--switch-origin-x': `${origin.x * 100}%`,
    '--switch-origin-y': `${origin.y * 100}%`,
  } as CSSProperties

  return (
    <div
      className="workspace-switch-overlay"
      data-phase={phase}
      style={style}
      role="status"
      aria-live="polite"
      aria-label={
        phase === 'departing'
          ? `Switching to ${workspaceLabel(targetApp)}`
          : `Opening ${workspaceLabel(targetApp)}`
      }
    >
      <div className="workspace-switch-card">
        <div className="workspace-switch-brand" aria-hidden="true">
          <span className="workspace-switch-brand__letter">B</span>
          <span className="workspace-switch-brand__orbit" />
        </div>
        <div className="workspace-switch-route" aria-hidden="true">
          <span className="workspace-switch-route__step workspace-switch-route__step--source">
            <span className="workspace-switch-route__app">
              <AppGlyph appId={sourceApp} />
            </span>
            <span className="workspace-switch-route__label">{workspaceLabel(sourceApp)}</span>
          </span>
          <span className="workspace-switch-route__line" />
          <span className="workspace-switch-route__arrow">
            <IconArrowRight size={16} stroke={1.8} />
          </span>
          <span className="workspace-switch-route__step workspace-switch-route__step--destination">
            <span className="workspace-switch-route__destination">
              <AppGlyph appId={targetApp} />
            </span>
            <span className="workspace-switch-route__label">{workspaceLabel(targetApp)}</span>
          </span>
        </div>
        <p className="workspace-switch-eyebrow">BOMACH WORKSPACE</p>
        <p className="workspace-switch-title">
          {phase === 'departing'
            ? `Leaving ${workspaceLabel(sourceApp)}`
            : `${workspaceLabel(targetApp)} is ready`}
        </p>
        <p className="workspace-switch-description">
          {phase === 'departing'
            ? `Opening your ${workspaceLabel(targetApp)} workspace`
            : workspaceDescription(targetApp)}
        </p>
        <div className="workspace-switch-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  )
}

function randomSwitchOrigin(anchor: HTMLElement | null): WorkspaceSwitchOrigin {
  if (!anchor) return { x: 0.92, y: 0.08 }

  const bounds = anchor.getBoundingClientRect()
  const x = bounds.left + bounds.width * (0.25 + Math.random() * 0.5)
  const y = bounds.top + bounds.height * (0.25 + Math.random() * 0.5)
  return {
    x: Math.min(1, Math.max(0, x / Math.max(1, window.innerWidth))),
    y: Math.min(1, Math.max(0, y / Math.max(1, window.innerHeight))),
  }
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
  const currentApp: WorkspaceAppId = 'services'
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [switching, setSwitching] = useState<WorkspaceSwitchTransition | null>(null)
  const [arriving, setArriving] = useState<WorkspaceSwitchTransition | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const transition = consumeWorkspaceSwitchTransition(currentApp)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (transition && !reducedMotion) setArriving(transition)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [currentApp])

  useEffect(() => {
    if (!arriving) return
    const timer = window.setTimeout(() => setArriving(null), WORKSPACE_ARRIVAL_MS)
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
      menu.style.transformOrigin = `${Math.min(
        Math.max(anchor.left + anchor.width / 2 - viewportLeft, 12),
        width - 12,
      )}px 0px`
    }

    positionMenu()
    window.addEventListener('resize', positionMenu)
    return () => {
      window.removeEventListener('resize', positionMenu)
      menu.style.left = ''
      menu.style.right = ''
      menu.style.width = ''
      menu.style.transformOrigin = ''
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
    const origin = randomSwitchOrigin(detailsRef.current)
    const transition: WorkspaceSwitchTransition = {
      sourceApp: currentApp,
      targetApp: app.id,
      origin,
      startedAt: Date.now(),
    }
    rememberWorkspaceSwitch(app.id, { sourceApp: currentApp, origin })
    detailsRef.current?.removeAttribute('open')
    setSwitching(transition)

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
            <span className="workspace-switch-menu__title">Switch workspace</span>
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
                <div
                  key={app.id}
                  className={`workspace-switch-option ${active ? 'is-current' : ''}`}
                >
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
      {switching ? (
        <TransitionPortal transition={switching} phase="departing" />
      ) : null}
      {!switching && arriving ? (
        <TransitionPortal transition={arriving} phase="arriving" targetApp={currentApp} />
      ) : null}
    </>
  )
}

function TransitionPortal({
  transition,
  phase,
  targetApp = transition.targetApp,
}: {
  transition: WorkspaceSwitchTransition
  phase: 'departing' | 'arriving'
  targetApp?: WorkspaceAppId
}) {
  return createPortal(
    <SwitchTransition
      sourceApp={transition.sourceApp}
      targetApp={targetApp}
      origin={transition.origin}
      phase={phase}
    />,
    document.body,
  )
}
