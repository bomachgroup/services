export type WorkspaceSwitchApp = 'os' | 'services' | 'marketing'

interface WorkspaceSwitchMarker {
  targetApp: WorkspaceSwitchApp
  startedAt: number
}

export const WORKSPACE_SWITCH_KEY = 'bomach.workspace-switch.v1'
export const WORKSPACE_SWITCH_DELAY_MS = 280
export const WORKSPACE_ARRIVAL_MS = 520
const WORKSPACE_SWITCH_MAX_AGE_MS = 15_000

export function rememberWorkspaceSwitch(targetApp: WorkspaceSwitchApp): void {
  if (typeof window === 'undefined') return
  try {
    const marker: WorkspaceSwitchMarker = { targetApp, startedAt: Date.now() }
    window.sessionStorage.setItem(WORKSPACE_SWITCH_KEY, JSON.stringify(marker))
  } catch {
    // The destination still opens if session storage is unavailable.
  }
}

export function consumeWorkspaceSwitch(currentApp: WorkspaceSwitchApp): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_SWITCH_KEY)
    if (!raw) return false
    window.sessionStorage.removeItem(WORKSPACE_SWITCH_KEY)

    const marker = JSON.parse(raw) as Partial<WorkspaceSwitchMarker>
    const elapsed = Date.now() - Number(marker.startedAt)
    return (
      marker.targetApp === currentApp &&
      Number.isFinite(elapsed) &&
      elapsed >= 0 &&
      elapsed <= WORKSPACE_SWITCH_MAX_AGE_MS
    )
  } catch {
    return false
  }
}
