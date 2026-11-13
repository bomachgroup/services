export type WorkspaceSwitchApp = 'os' | 'services' | 'marketing'

export interface WorkspaceSwitchOrigin {
  x: number
  y: number
}

export interface WorkspaceSwitchContext {
  sourceApp: WorkspaceSwitchApp
  origin: WorkspaceSwitchOrigin
}

export interface WorkspaceSwitchTransition extends WorkspaceSwitchContext {
  targetApp: WorkspaceSwitchApp
  startedAt: number
}

interface WorkspaceSwitchMarker extends Partial<WorkspaceSwitchContext> {
  targetApp: WorkspaceSwitchApp
  startedAt: number
}

export const WORKSPACE_SWITCH_KEY = 'bomach.workspace-switch.v1'
export const WORKSPACE_SWITCH_DELAY_MS = 560
export const WORKSPACE_ARRIVAL_MS = 760
const WORKSPACE_SWITCH_MAX_AGE_MS = 15_000
const DEFAULT_ORIGIN: WorkspaceSwitchOrigin = { x: 0.92, y: 0.08 }

function isWorkspaceSwitchApp(value: unknown): value is WorkspaceSwitchApp {
  return value === 'os' || value === 'services' || value === 'marketing'
}

function normalizeOrigin(origin: unknown): WorkspaceSwitchOrigin {
  if (!origin || typeof origin !== 'object') return DEFAULT_ORIGIN

  const candidate = origin as Partial<WorkspaceSwitchOrigin>
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return DEFAULT_ORIGIN

  return {
    x: Math.min(1, Math.max(0, candidate.x as number)),
    y: Math.min(1, Math.max(0, candidate.y as number)),
  }
}

function appFromReferrer(): WorkspaceSwitchApp {
  if (typeof document === 'undefined' || !document.referrer) return 'os'

  try {
    const path = new URL(document.referrer).pathname
    if (path === '/services' || path.startsWith('/services/')) return 'services'
    if (path === '/marketing' || path.startsWith('/marketing/')) return 'marketing'
  } catch {
    // A malformed or external referrer does not prevent a normal app arrival.
  }

  return 'os'
}

export function rememberWorkspaceSwitch(
  targetApp: WorkspaceSwitchApp,
  context?: WorkspaceSwitchContext,
): void {
  if (typeof window === 'undefined') return

  try {
    const marker: WorkspaceSwitchMarker = {
      sourceApp: context?.sourceApp ?? 'os',
      targetApp,
      origin: normalizeOrigin(context?.origin),
      startedAt: Date.now(),
    }
    window.sessionStorage.setItem(WORKSPACE_SWITCH_KEY, JSON.stringify(marker))
  } catch {
    // The destination still opens if session storage is unavailable.
  }
}

export function consumeWorkspaceSwitchTransition(
  currentApp: WorkspaceSwitchApp,
): WorkspaceSwitchTransition | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_SWITCH_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(WORKSPACE_SWITCH_KEY)

    const marker = JSON.parse(raw) as Partial<WorkspaceSwitchMarker>
    const elapsed = Date.now() - Number(marker.startedAt)
    if (
      marker.targetApp !== currentApp ||
      !Number.isFinite(elapsed) ||
      elapsed < 0 ||
      elapsed > WORKSPACE_SWITCH_MAX_AGE_MS
    ) {
      return null
    }

    const referrerApp = appFromReferrer()
    const sourceApp =
      isWorkspaceSwitchApp(marker.sourceApp) && marker.sourceApp !== currentApp
        ? marker.sourceApp
        : referrerApp !== currentApp
          ? referrerApp
          : currentApp === 'os'
            ? 'services'
            : 'os'

    return {
      sourceApp,
      targetApp: currentApp,
      origin: normalizeOrigin(marker.origin),
      startedAt: Number(marker.startedAt),
    }
  } catch {
    return null
  }
}

export function consumeWorkspaceSwitch(currentApp: WorkspaceSwitchApp): boolean {
  return consumeWorkspaceSwitchTransition(currentApp) !== null
}
