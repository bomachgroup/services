export type WorkspaceAppId = 'os' | 'services' | 'marketing'

interface WorkspaceMemory {
  version: 1
  userId: string
  lastVisited: { app: WorkspaceAppId; href: string }
  apps: Partial<Record<WorkspaceAppId, string>>
  savedAt: number
}

export const WORKSPACE_MEMORY_KEY = 'bomach.workspace-memory.v1'

const blockedPaths = new Set([
  '/login',
  '/splash',
  '/forgot-password',
  '/reset-password',
  '/two-factor-verify',
  '/biometric',
  '/no-access',
  '/forbidden',
])
const privateQueryKeys =
  /search|email|token|password|secret|code|reason|notes|returnto|expired|reset/i

function safeHref(app: WorkspaceAppId, value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.length > 2048 ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    return null
  }

  try {
    const parsed = new URL(value, 'https://bomach.invalid')
    if (parsed.origin !== 'https://bomach.invalid') return null

    let pathname = parsed.pathname
    if (app === 'services') {
      if (pathname === '/' || pathname === '/services') pathname = '/services/'
      else if (pathname === '/marketing' || pathname.startsWith('/marketing/')) return null
      else if (!pathname.startsWith('/services/')) pathname = `/services${pathname}`
    } else if (app === 'marketing') {
      if (pathname === '/' || pathname === '/marketing') pathname = '/marketing/'
      else if (pathname === '/services' || pathname.startsWith('/services/')) return null
      else if (!pathname.startsWith('/marketing/')) pathname = `/marketing${pathname}`
    } else if (
      pathname === '/services' ||
      pathname.startsWith('/services/') ||
      pathname === '/marketing' ||
      pathname.startsWith('/marketing/')
    ) {
      return null
    }

    const prefix = app === 'services' ? '/services' : app === 'marketing' ? '/marketing' : ''
    const relativePath = prefix ? pathname.slice(prefix.length) || '/' : pathname
    if (blockedPaths.has(relativePath.replace(/\/$/, '') || '/')) return null

    const safeSearch = new URLSearchParams()
    for (const [key, queryValue] of parsed.searchParams) {
      if (privateQueryKeys.test(key) || queryValue.length > 256) continue
      safeSearch.append(key, queryValue)
    }
    const search = safeSearch.toString()
    const hash = parsed.hash && parsed.hash.length <= 128 ? parsed.hash : ''
    return `${pathname}${search ? `?${search}` : ''}${hash}`
  } catch {
    return null
  }
}

function parseMemory(raw: string | null): WorkspaceMemory | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<WorkspaceMemory>
    if (
      value.version !== 1 ||
      typeof value.userId !== 'string' ||
      !value.lastVisited ||
      !['os', 'services', 'marketing'].includes(value.lastVisited.app)
    ) {
      return null
    }
    const lastHref = safeHref(value.lastVisited.app, value.lastVisited.href)
    if (!lastHref || !value.apps || typeof value.apps !== 'object') return null

    const apps: WorkspaceMemory['apps'] = {}
    for (const app of ['os', 'services', 'marketing'] as const) {
      const href = safeHref(app, value.apps[app])
      if (href) apps[app] = href
    }

    return {
      version: 1,
      userId: value.userId,
      lastVisited: { app: value.lastVisited.app, href: lastHref },
      apps,
      savedAt: typeof value.savedAt === 'number' ? value.savedAt : 0,
    }
  } catch {
    return null
  }
}

export function rememberedWorkspaceHref(
  userId: string | number,
  app: WorkspaceAppId,
): string | null {
  if (typeof window === 'undefined') return null
  try {
    const memory = parseMemory(window.localStorage.getItem(WORKSPACE_MEMORY_KEY))
    if (memory?.userId !== String(userId)) return null
    return memory.apps[app] ?? (memory.lastVisited.app === app ? memory.lastVisited.href : null)
  } catch {
    return null
  }
}

export function saveWorkspaceLocation(
  userId: string | number,
  app: WorkspaceAppId,
  href: string,
): void {
  if (typeof window === 'undefined') return
  const safeLocation = safeHref(app, href)
  if (!safeLocation) return

  try {
    const userKey = String(userId)
    const existing = parseMemory(window.localStorage.getItem(WORKSPACE_MEMORY_KEY))
    const memory: WorkspaceMemory =
      existing?.userId === userKey
        ? { ...existing, lastVisited: { app, href: safeLocation }, savedAt: Date.now() }
        : {
            version: 1,
            userId: userKey,
            lastVisited: { app, href: safeLocation },
            apps: {},
            savedAt: Date.now(),
          }
    memory.apps[app] = safeLocation
    window.localStorage.setItem(WORKSPACE_MEMORY_KEY, JSON.stringify(memory))
  } catch {
    // Workspace navigation remains usable when browser storage is unavailable.
  }
}

export function clearWorkspaceMemory(userId?: string | number): void {
  if (typeof window === 'undefined') return
  try {
    if (
      userId !== undefined &&
      parseMemory(window.localStorage.getItem(WORKSPACE_MEMORY_KEY))?.userId !== String(userId)
    ) {
      return
    }
    window.localStorage.removeItem(WORKSPACE_MEMORY_KEY)
  } catch {
    // Sign-out should not fail because browser storage is unavailable.
  }
}
