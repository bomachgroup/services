import type {
  ServiceCatalogueItem,
  ServiceWorkflow,
  WorkflowOwnerRoleOption,
  WorkflowStage,
} from '../types/service-administration.types'

export function hoursToDays(hours: number) {
  return Math.max(1, Math.round(hours / 24) || 1)
}

export function daysToHours(days: number) {
  return Math.max(1, days) * 24
}

export function cloneStages(stages: WorkflowStage[]) {
  return stages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((stage) => ({ ...stage }))
}

export function stagesFromNames(
  names: string[],
  ownerRoles: WorkflowOwnerRoleOption[],
): WorkflowStage[] {
  return names.map((name, index) => {
    const role = ownerRoles[Math.min(index, Math.max(0, ownerRoles.length - 1))]
    return {
      id: `stage-seed-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      order: index + 1,
      ownerRole: role?.name ?? 'Unassigned',
      ownerRoleId: role?.id ?? null,
      slaHours: daysToHours(index === 0 ? 1 : 2),
      requiresApproval: /Approval|Review|Payment|Inspection/i.test(name),
      requiresEvidence: index > 1,
      clientVisible: true,
    }
  })
}

export function buildStagesForService(
  service: ServiceCatalogueItem,
  workflow: ServiceWorkflow | undefined,
  ownerRoles: WorkflowOwnerRoleOption[],
): WorkflowStage[] {
  if (workflow?.stages.length) return cloneStages(workflow.stages)
  if (service.workflowStages?.length) return stagesFromNames(service.workflowStages, ownerRoles)
  return stagesFromNames(
    ['Request Review', 'Execution', 'Quality Review', 'Client Acceptance'],
    ownerRoles,
  )
}
