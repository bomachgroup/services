import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  consumeWorkspaceSwitch,
  rememberWorkspaceSwitch,
  WORKSPACE_SWITCH_KEY,
} from './workspace-switch'

describe('workspace switch transition marker', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.useRealTimers()
  })

  it('plays the arrival transition once in the app selected by the user', () => {
    rememberWorkspaceSwitch('services')

    expect(consumeWorkspaceSwitch('os')).toBe(false)
    expect(consumeWorkspaceSwitch('services')).toBe(false)
  })

  it('consumes a matching marker only once', () => {
    rememberWorkspaceSwitch('services')

    expect(consumeWorkspaceSwitch('services')).toBe(true)
    expect(consumeWorkspaceSwitch('services')).toBe(false)
    expect(window.sessionStorage.getItem(WORKSPACE_SWITCH_KEY)).toBeNull()
  })

  it('ignores stale markers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-05T10:00:00Z'))
    rememberWorkspaceSwitch('os')
    vi.setSystemTime(new Date('2026-11-05T10:00:16Z'))

    expect(consumeWorkspaceSwitch('os')).toBe(false)
  })
})
