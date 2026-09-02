import { IconSubtask } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import { AccessLockIcon } from '@/shared/ui/module-controls'

import { AutomationRulesPanel } from '../components/AutomationRulesPanel'
import { WorkflowDesignerPanel } from '../components/WorkflowDesignerPanel'
import { buildStagesForService } from '../components/workflow-designer-panel.utils'

import type {
  SaveWorkflowInput,
  ServiceCatalogueItem,
  ServiceWorkflow,
  WorkflowOwnerRoleOption,
  WorkflowStage,
} from '../types/service-administration.types'

const fulfillmentModes = [
  ['Quick Service Order', 'Short work without a full project'],
  ['Managed Service Case', 'Recurring or retained service'],
  ['Project & Worksite', 'Engineering and multi-milestone work'],
] as const

export function WorkflowDesignerScreen({
  services,
  workflows,
  selectedServiceId,
  onSelectedServiceChange,
  ownerRoles,
  saving,
  onSave,
}: {
  services: ServiceCatalogueItem[]
  workflows: ServiceWorkflow[]
  selectedServiceId: string
  onSelectedServiceChange: (serviceId: string) => void
  ownerRoles: WorkflowOwnerRoleOption[]
  saving: boolean
  onSave?: (input: SaveWorkflowInput) => void
}) {
  const canEdit = Boolean(onSave)

  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? services[0]

  const linkedWorkflow = useMemo(() => {
    if (!selectedService) return undefined
    return (
      workflows.find((workflow) => workflow.serviceId === selectedService.id) ??
      workflows.find((workflow) => workflow.serviceName === selectedService.name)
    )
  }, [selectedService, workflows])

  const sourceKey = `${selectedService?.id ?? ''}:${linkedWorkflow?.id ?? ''}:${linkedWorkflow?.updatedAt ?? ''}`

  const [draftKey, setDraftKey] = useState(sourceKey)
  const [stages, setStages] = useState<WorkflowStage[]>(() =>
    selectedService ? buildStagesForService(selectedService, linkedWorkflow, ownerRoles) : [],
  )

  if (sourceKey !== draftKey && selectedService) {
    setDraftKey(sourceKey)
    setStages(buildStagesForService(selectedService, linkedWorkflow, ownerRoles))
  }

  const saveWorkflow = () => {
    if (!selectedService || !onSave) return
    if (stages.length === 0) return

    onSave({
      ...(linkedWorkflow?.id ? { id: linkedWorkflow.id } : {}),
      name: linkedWorkflow?.name ?? `${selectedService.name} Workflow`,
      serviceId: selectedService.id,
      status: linkedWorkflow?.status ?? 'active',
      stages: stages.map((stage, index) => ({ ...stage, order: index + 1 })),
    })
  }

  if (!selectedService) {
    return (
      <div className="service-admin-page service-admin-content">
        <WorkflowDesignerPanel
          stages={[]}
          onStagesChange={() => undefined}
          ownerRoles={ownerRoles}
          canEdit={false}
          emptyTitle="No workflow to configure yet"
          emptyDescription="Create a service first. Its workflow stages will then be configured here in the same layout."
        />

        <div className="service-admin-g2">
          <div className="service-admin-card">
            <div className="service-admin-card-header">
              <div className="service-admin-card-title">Automation Rules</div>
              <button
                type="button"
                className="service-admin-button service-admin-button-small"
                disabled
              >
                Add Rule
              </button>
            </div>
            <div className="service-admin-card-subtitle py-5">
              Automation rules will appear here after a workflow exists.
            </div>
          </div>

          <div className="service-admin-card">
            <div className="service-admin-card-header">
              <div className="service-admin-card-title">Fulfillment Modes</div>
            </div>
            {fulfillmentModes.map(([title, description]) => (
              <div key={title} className="service-admin-list-row opacity-60">
                <div className="service-admin-list-ico service-admin-list-ico--mode">
                  <IconSubtask size={16} aria-hidden="true" />
                </div>
                <div className="service-admin-list-meta">
                  <div className="service-admin-list-name">{title}</div>
                  <div className="service-admin-list-sub">{description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="service-admin-page service-admin-content">
      <WorkflowDesignerPanel
        stages={stages}
        onStagesChange={setStages}
        ownerRoles={ownerRoles}
        canEdit={canEdit}
        headerActions={
          <div className="service-admin-acts">
            <select
              aria-label="Select service"
              value={selectedService.id}
              onChange={(event) => onSelectedServiceChange(event.target.value)}
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            {canEdit ? (
              <>
                <button
                  type="button"
                  className="service-admin-button service-admin-button-primary"
                  disabled={saving || stages.length === 0}
                  onClick={saveWorkflow}
                >
                  {saving ? 'Saving...' : 'Save Workflow'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="service-admin-button service-admin-button-primary"
                  disabled
                  title="You do not have permission to edit workflows"
                >
                  <AccessLockIcon show />
                  Save Workflow
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="service-admin-g2">
        <AutomationRulesPanel />

        <div className="service-admin-card">
          <div className="service-admin-card-header">
            <div className="service-admin-card-title">Fulfillment Modes</div>
          </div>
          {fulfillmentModes.map(([title, description]) => (
            <div key={title} className="service-admin-list-row">
              <div className="service-admin-list-ico service-admin-list-ico--mode">
                <IconSubtask size={16} aria-hidden="true" />
              </div>
              <div className="service-admin-list-meta">
                <div className="service-admin-list-name">{title}</div>
                <div className="service-admin-list-sub">{description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
