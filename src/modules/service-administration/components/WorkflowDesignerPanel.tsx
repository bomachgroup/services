import { useState, type ReactNode } from 'react'

import { useToast } from '@/shared/ui'
import { formatNumberFieldValue, parseNumberFieldValue } from '@/shared/lib/number-input'

import { daysToHours, hoursToDays } from './workflow-designer-panel.utils'

import type {
  WorkflowOwnerRoleOption,
  WorkflowStage,
} from '../types/service-administration.types'

type StageDraft = {
  name: string
  ownerRole: string
  ownerRoleId: number | null
  slaDays: number
  requiresApproval: boolean
  requiresEvidence: boolean
}

function stageToDraft(stage: WorkflowStage): StageDraft {
  return {
    name: stage.name,
    ownerRole: stage.ownerRole,
    ownerRoleId: stage.ownerRoleId ?? null,
    slaDays: hoursToDays(stage.slaHours),
    requiresApproval: stage.requiresApproval,
    requiresEvidence: stage.requiresEvidence,
  }
}

function defaultStageDraft(ownerRoles: WorkflowOwnerRoleOption[]): StageDraft {
  return {
    name: '',
    ownerRole: ownerRoles[0]?.name ?? 'Unassigned',
    ownerRoleId: ownerRoles[0]?.id ?? null,
    slaDays: 1,
    requiresApproval: false,
    requiresEvidence: true,
  }
}

type StageEditorState =
  | { mode: 'create'; draft: StageDraft }
  | { mode: 'edit'; index: number; draft: StageDraft }

export function WorkflowDesignerPanel({
  variant = 'page',
  stages,
  onStagesChange,
  ownerRoles,
  canEdit = true,
  emptyTitle = 'No workflow stages yet',
  emptyDescription = 'Add stages to define how this service moves from request to completion.',
  headerActions,
}: {
  variant?: 'page' | 'embedded'
  stages: WorkflowStage[]
  onStagesChange: (stages: WorkflowStage[]) => void
  ownerRoles: WorkflowOwnerRoleOption[]
  canEdit?: boolean
  emptyTitle?: string
  emptyDescription?: string
  headerActions?: ReactNode
}) {
  const toast = useToast()
  const [stageEditor, setStageEditor] = useState<StageEditorState | null>(null)

  const openEdit = (index: number) => {
    const stage = stages[index]
    if (!stage) return
    setStageEditor({ mode: 'edit', index, draft: stageToDraft(stage) })
  }

  const openCreate = () => {
    setStageEditor({ mode: 'create', draft: defaultStageDraft(ownerRoles) })
  }

  const closeEditor = () => {
    setStageEditor(null)
  }

  const deleteStage = (index: number) => {
    onStagesChange(
      stages
        .filter((_, itemIndex) => itemIndex !== index)
        .map((stage, orderIndex) => ({ ...stage, order: orderIndex + 1 })),
    )
  }

  const applyStageEdit = () => {
    if (!stageEditor) return
    const name = stageEditor.draft.name.trim()
    if (!name) {
      toast.error('Stage name is required')
      return
    }

    const nextStage: WorkflowStage = {
      id: `stage-new-${Date.now()}`,
      name,
      order: stages.length + 1,
      ownerRole: stageEditor.draft.ownerRole,
      ownerRoleId: stageEditor.draft.ownerRoleId,
      slaHours: daysToHours(stageEditor.draft.slaDays),
      requiresApproval: stageEditor.draft.requiresApproval,
      requiresEvidence: stageEditor.draft.requiresEvidence,
      clientVisible: true,
    }

    if (stageEditor.mode === 'create') {
      onStagesChange([...stages, nextStage])
    } else {
      onStagesChange(
        stages.map((stage, index) =>
          index === stageEditor.index
            ? {
                ...stage,
                name,
                ownerRole: stageEditor.draft.ownerRole,
                ownerRoleId: stageEditor.draft.ownerRoleId,
                slaHours: daysToHours(stageEditor.draft.slaDays),
                requiresApproval: stageEditor.draft.requiresApproval,
                requiresEvidence: stageEditor.draft.requiresEvidence,
              }
            : stage,
        ),
      )
    }

    closeEditor()
  }

  const updateDraft = (patch: Partial<StageDraft>) => {
    setStageEditor((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current,
    )
  }

  return (
    <>
      <div
        className={[
          'service-admin-card',
          variant === 'embedded' ? 'service-admin-workflow-panel--embedded' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="service-admin-card-header">
          <div>
            <div className="service-admin-card-title">Workflow & Fulfillment Designer</div>
            <div className="service-admin-card-subtitle">
              Stages, owners, SLAs, approvals, evidence and client checkpoints
            </div>
          </div>
          {canEdit || headerActions ? (
            <div className="service-admin-acts">
              {canEdit ? (
                <button type="button" className="service-admin-button" onClick={openCreate}>
                  Add Stage
                </button>
              ) : null}
              {headerActions}
            </div>
          ) : null}
        </div>

        <div className="service-admin-table-wrap" style={{ marginTop: 12 }}>
          <table className="service-admin-table service-admin-workflow-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Owner</th>
                <th>SLA</th>
                <th>Approval</th>
                <th>Evidence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stages.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="py-8 text-center" role="status">
                      <div className="service-admin-card-title">{emptyTitle}</div>
                      <div className="service-admin-card-subtitle mt-1">{emptyDescription}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                stages.map((stage, index) => (
                  <tr key={stage.id}>
                    <td>
                      <b>{stage.name}</b>
                    </td>
                    <td>{stage.ownerRole}</td>
                    <td>{hoursToDays(stage.slaHours)} day(s)</td>
                    <td>{stage.requiresApproval ? 'Yes' : 'No'}</td>
                    <td>{stage.requiresEvidence ? 'Required' : 'Optional'}</td>
                    <td>
                      {canEdit ? (
                        <div className="service-admin-acts">
                          <button
                            type="button"
                            className="service-admin-button service-admin-button-small"
                            onClick={() => openEdit(index)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="service-admin-button service-admin-button-small"
                            onClick={() => deleteStage(index)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && stageEditor ? (
        <div
          className="service-admin-editor-backdrop"
          role="presentation"
          onMouseDown={closeEditor}
        >
          <section
            className="service-admin-field-editor-modal service-admin-stage-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-label={stageEditor.mode === 'create' ? 'Add workflow stage' : 'Edit workflow stage'}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2>{stageEditor.mode === 'create' ? 'Add Stage' : 'Edit Stage'}</h2>
                <p>
                  {stageEditor.mode === 'create'
                    ? 'Define the stage before adding it to this workflow'
                    : 'Update stage ownership, SLA and checkpoints'}
                </p>
              </div>
              <button
                type="button"
                className="service-admin-stage-editor-close"
                aria-label="Close"
                onClick={closeEditor}
              >
                ×
              </button>
            </header>
            <div className="service-admin-field-editor-body service-admin-stage-editor-body">
              <label className="service-admin-stage-editor-field service-admin-stage-editor-field--full">
                <span>Stage name</span>
                <input
                  autoFocus
                  placeholder="e.g. Request Review"
                  value={stageEditor.draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                />
              </label>
              <label className="service-admin-stage-editor-field">
                <span>Owner role</span>
                <select
                  value={stageEditor.draft.ownerRoleId ?? ''}
                  disabled={ownerRoles.length === 0}
                  onChange={(event) => {
                    const roleId = event.target.value ? Number(event.target.value) : null
                    const role = ownerRoles.find((item) => item.id === roleId)
                    updateDraft({
                      ownerRoleId: role?.id ?? null,
                      ownerRole: role?.name ?? 'Unassigned',
                    })
                  }}
                >
                  <option value="">Unassigned</option>
                  {ownerRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="service-admin-stage-editor-field">
                <span>SLA (days)</span>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 1"
                  value={formatNumberFieldValue(stageEditor.draft.slaDays)}
                  onChange={(event) =>
                    updateDraft({ slaDays: parseNumberFieldValue(event.target.value) })
                  }
                />
              </label>
              <div className="service-admin-stage-editor-checks">
                <span className="service-admin-stage-editor-checks-label">Checkpoints</span>
                <div className="service-admin-stage-editor-check-grid">
                  <label className="service-admin-stage-editor-check">
                    <input
                      type="checkbox"
                      checked={stageEditor.draft.requiresApproval}
                      onChange={(event) => updateDraft({ requiresApproval: event.target.checked })}
                    />
                    <span>
                      <b>Requires approval</b>
                      <small>Stage cannot advance without sign-off</small>
                    </span>
                  </label>
                  <label className="service-admin-stage-editor-check">
                    <input
                      type="checkbox"
                      checked={stageEditor.draft.requiresEvidence}
                      onChange={(event) => updateDraft({ requiresEvidence: event.target.checked })}
                    />
                    <span>
                      <b>Evidence required</b>
                      <small>Upload or attach proof before completion</small>
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <footer>
              <button type="button" className="service-admin-button" onClick={closeEditor}>
                Cancel
              </button>
              <button
                type="button"
                className="service-admin-button service-admin-button-primary"
                onClick={applyStageEdit}
              >
                {stageEditor.mode === 'create' ? 'Add Stage' : 'Save Stage'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  )
}
