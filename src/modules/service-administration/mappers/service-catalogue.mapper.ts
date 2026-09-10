import { mapCalculatorDto } from './calculator.mapper'
import { mapRequestFormDto } from './request-form.mapper'
import { mapWorkflowDto } from './workflow.mapper'
import type {
  ServiceCatalogueCardDto,
  ServiceCatalogueDetailDto,
} from '../api/service-administration.contracts'
import type { ServiceCatalogueItem, ServiceStatus } from '../types/service-administration.types'

function normalizeStatus(status: string): ServiceStatus {
  if (status === 'active' || status === 'draft' || status === 'inactive') {
    return status
  }

  return 'inactive'
}

function calculateReadiness(card: ServiceCatalogueCardDto): number {
  // Match the backend publish rule:
  // - active request form
  // - at least one active branch
  // Calculator is optional; workflow is not required.
  const checks = [Boolean(card.active_request_form), card.active_branches.length > 0]

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export function mapServiceCatalogueCard(dto: ServiceCatalogueCardDto): ServiceCatalogueItem {
  return {
    id: String(dto.id),
    code: dto.code ?? '',
    name: dto.name,
    parentId: dto.parent_id ?? null,
    parentName: dto.parent_name,
    description: dto.description,
    owner: dto.owner_role_name,
    status: normalizeStatus(dto.status),
    branchNames: dto.active_branches.map((branch) => branch.branch_name),
    specializedServiceId: dto.specialized_service_id,
    specializedDomain: dto.specialized_domain,
    specializedConfig: dto.specialized_config,
    ...(dto.active_calculator?.name ? { calculatorName: dto.active_calculator.name } : {}),
    ...(dto.active_request_form?.name ? { requestFormName: dto.active_request_form.name } : {}),
    ...(dto.active_workflow?.name ? { workflowName: dto.active_workflow.name } : {}),
    readiness: calculateReadiness(dto),
    ...(dto.default_sla_days !== undefined ? { slaDays: dto.default_sla_days } : {}),
    ...(dto.fulfillment_mode ? { fulfilmentMode: dto.fulfillment_mode } : {}),
  }
}

export function mapServiceCatalogueDetail(dto: ServiceCatalogueDetailDto): ServiceCatalogueItem {
  const activeRequestForm =
    dto.request_forms.find((form) => form.id === dto.active_request_form_id) ??
    dto.active_request_form ??
    dto.request_forms[0]

  const activeWorkflow =
    dto.workflows.find((workflow) => workflow.id === dto.active_workflow_id) ??
    dto.active_workflow ??
    dto.workflows[0]

  const activeCalculator =
    dto.active_calculator_id != null && dto.active_calculator?.id === dto.active_calculator_id
      ? dto.active_calculator
      : (dto.active_calculator ?? null)

  return {
    ...mapServiceCatalogueCard(dto),
    requestFields: (activeRequestForm?.fields ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((field) => field.label),
    workflowStages: (activeWorkflow?.stages ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((stage) => stage.name),
    ...(activeCalculator
      ? {
          activeCalculator: mapCalculatorDto(activeCalculator, {
            id: dto.id,
            name: dto.name,
          }),
        }
      : {}),
    ...(activeRequestForm
      ? { activeRequestForm: mapRequestFormDto(activeRequestForm, dto.name) }
      : {}),
    ...(activeWorkflow ? { activeWorkflow: mapWorkflowDto(activeWorkflow, dto.name) } : {}),
  }
}
