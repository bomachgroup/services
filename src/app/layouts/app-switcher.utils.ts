import { getVisibleNavigation } from '@/app/navigation'
import { operationsNavigation } from '@/app/navigation/navigation.config'
import type { AuthUser } from '@/app/auth'

export function resolveServicesAppHref(baseUrl: string): '/' | '/services/' {
  return baseUrl === '/services/' ? '/services/' : '/'
}

export const MARKETING_APP_ACCESS_ANY_OF = [
  'dashboard.view',
  'dashboard.list',
  'marketing_dashboard.view',
  'marketing_dashboard.list',
  'stats.view',
  'stats.list',
  'employees.view',
  'employees.list',
  'role_daily_routines.view',
  'role_daily_routines.list',
  'target_reports.view',
  'target_reports.list',
  'leads.view',
  'leads.list',
  'deals.view',
  'deals.list',
  'followups.view',
  'followups.list',
  'content.view',
  'content.list',
  'marketing_campaigns.view',
  'marketing_campaigns.list',
  'analytics.view',
  'analytics.list',
  'marketing_analytics.view',
  'marketing_analytics.list',
  'revenue_execution.view',
  'revenue_execution.list',
  'employee_targets.view',
  'employee_targets.list',
  'role_kpis.view',
  'role_kpis.list',
  'kpis.view',
  'kpis.list',
  'partners.view',
  'partners.list',
  'service_requests.view',
  'service_requests.list',
  'media_library.view',
  'media_library.list',
  'approval_requests.view',
  'approval_requests.list',
  'approval_flows.view',
  'approval_flows.list',
  'meetings.view',
  'meetings.list',
  'training_programs.view',
  'training_programs.list',
  'role_sops.view',
  'role_sops.list',
  'role_success_playbook.view',
  'role_success_playbook.list',
] as const

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
    href: resolveServicesAppHref(import.meta.env.BASE_URL),
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Campaigns, pipeline, and revenue execution',
    href: '/marketing/dashboard',
  },
] as const

export function getAvailableApps(user: AuthUser | null) {
  const hasServicesDestination = getVisibleNavigation(operationsNavigation, user).length > 0
  const hasMarketingDestination = MARKETING_APP_ACCESS_ANY_OF.some((grant) => {
    return user?.backendPermissions.includes(grant) ?? false
  })
  return apps.filter(
    (app) =>
      app.id === 'os' || (app.id === 'services' ? hasServicesDestination : hasMarketingDestination),
  )
}
