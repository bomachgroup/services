export type AuthTokenMessage = {
  type: 'BOMACH_AUTH_TOKEN'
  token: string
  refreshToken?: string
}

export const AUTH_READY_MESSAGE = { type: 'BOMACH_AUTH_READY' } as const

const AUTH_READY_MAX_ATTEMPTS = 12

export function shouldRetryAuthReadyAnnouncement({
  hasToken,
  attempts,
  maxAttempts = AUTH_READY_MAX_ATTEMPTS,
}: {
  hasToken: boolean
  attempts: number
  maxAttempts?: number
}): boolean {
  return !hasToken && attempts < maxAttempts
}

export function getAuthBootstrapError(): string {
  return 'Bomach OS did not provide a valid session to Services. Return to Bomach OS and open Services again.'
}

export function getTrustedParentOrigin(referrer: string | undefined | null): string {
  if (!referrer) return '*'

  try {
    return new URL(referrer).origin
  } catch {
    return '*'
  }
}

function isAuthTokenMessage(value: unknown): value is AuthTokenMessage {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return payload.type === 'BOMACH_AUTH_TOKEN' && typeof payload.token === 'string' && payload.token.length > 0
}

export function isTrustedAuthTokenMessage(
  event: MessageEvent<unknown>,
  parent: Window,
  parentOrigin: string,
): event is MessageEvent<AuthTokenMessage> {
  return (
    event.source === parent &&
    (parentOrigin === '*' || event.origin === parentOrigin) &&
    isAuthTokenMessage(event.data)
  )
}
