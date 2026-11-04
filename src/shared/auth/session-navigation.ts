import { env } from '@/shared/config/env'

const ROOT_LOGIN_PATH = '/login'

export interface LocationOriginContext {
  origin: string
  hostname: string
  port: string
  protocol: string
}

const SHARED_BOMACH_HOSTS = new Set(['bomach-os-test.vercel.app', 'bomach-os.vercel.app'])

export function resolveRootAppOrigin(
  location: LocationOriginContext | null,
  configuredOrigin: string,
): string {
  if (!location) return configuredOrigin || 'http://localhost:5173'

  if (SHARED_BOMACH_HOSTS.has(location.hostname)) return location.origin
  if (
    ['localhost', '127.0.0.1'].includes(location.hostname) &&
    ['4173', '5174'].includes(location.port)
  ) {
    return `${location.protocol}//${location.hostname}:5173`
  }

  return configuredOrigin || 'https://bomach-os.vercel.app'
}

function rootAppOrigin(): string {
  const location =
    typeof window === 'undefined'
      ? null
      : {
          origin: window.location.origin,
          hostname: window.location.hostname,
          port: window.location.port,
          protocol: window.location.protocol,
        }
  return resolveRootAppOrigin(location, env.bomachOsOrigin)
}

export function buildRootAppHref(): string {
  const origin = rootAppOrigin()
  const url = new URL('/dashboard', origin)
  const currentOrigin = typeof window === 'undefined' ? origin : window.location.origin
  return url.origin === currentOrigin ? `${url.pathname}${url.search}` : url.toString()
}

export function safeServicesReturnTarget(target: string, currentHostname?: string): string | null {
  if (
    !target.startsWith('/') ||
    target.startsWith('//') ||
    target.includes('\\') ||
    [...target].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    return null
  }

  try {
    const parsed = new URL(target, 'https://bomach.invalid')
    if (parsed.origin !== 'https://bomach.invalid') return null
    if (parsed.pathname === '/services/login') return '/services'
    if (parsed.pathname === '/services' || parsed.pathname.startsWith('/services/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    if (!currentHostname || SHARED_BOMACH_HOSTS.has(currentHostname)) return null
    if (parsed.pathname === '/' || parsed.pathname === '/login') return '/services'
    if (
      parsed.pathname !== '/app' &&
      !parsed.pathname.startsWith('/app/') &&
      parsed.pathname !== '/portal' &&
      !parsed.pathname.startsWith('/portal/') &&
      parsed.pathname !== '/forbidden'
    ) {
      return null
    }
    return `/services${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

export function buildCentralLoginUrl(currentPath: string, expired = false): string {
  const origin = rootAppOrigin()
  const url = new URL(ROOT_LOGIN_PATH, origin)
  const hostname = typeof window === 'undefined' ? undefined : window.location.hostname
  const returnTo = safeServicesReturnTarget(currentPath, hostname)
  if (returnTo) url.searchParams.set('returnTo', returnTo)
  if (expired) url.searchParams.set('expired', '1')
  const currentOrigin = typeof window === 'undefined' ? origin : window.location.origin
  return url.origin === currentOrigin ? `${url.pathname}${url.search}` : url.toString()
}

export function buildSessionExpiredLoginUrl(currentPath: string): string {
  return buildCentralLoginUrl(currentPath, true)
}

export function redirectToCentralLogin(currentPath: string): void {
  if (typeof window === 'undefined') return
  window.location.replace(buildCentralLoginUrl(currentPath))
}

export function redirectToSessionExpiredLogin(): void {
  if (typeof window === 'undefined' || window.location.pathname === ROOT_LOGIN_PATH) return
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.replace(buildSessionExpiredLoginUrl(currentPath))
}
