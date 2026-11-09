import { Outlet } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { RequireAuth } from '@/app/auth'
import { operationsNavigation } from '@/app/navigation'

import { AppShell } from './AppShell'

export function OperationsLayout({ children }: { children?: ReactNode }) {
  return (
    <RequireAuth allowedKinds={['staff']}>
      <AppShell navigation={operationsNavigation}>{children ?? <Outlet />}</AppShell>
    </RequireAuth>
  )
}
