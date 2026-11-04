import { getVisibleNavigation } from '@/app/navigation'
import { operationsNavigation } from '@/app/navigation/navigation.config'
import type { AuthUser } from '@/app/auth'

const apps = [
  {
    id: 'os',
    label: 'Bomach OS',
    description: 'People and company operations',
    href: '/dashboard',
  },
  {
    id: 'services',
    label: 'Services',
    description: 'Service delivery and commercial operations',
    href: '/services',
  },
] as const

export function getAvailableApps(user: AuthUser | null) {
  const hasServicesDestination = getVisibleNavigation(operationsNavigation, user).length > 0
  return apps.filter((app) => app.id === 'os' || hasServicesDestination)
}
