import { useState, type ReactNode } from 'react'

import { useToast } from '@/shared/ui'
import { AccessLockIcon } from '@/shared/ui/module-controls'

import type {
  RequestFieldTypeOption,
  RequestFormField,
  ServiceRequestForm,
} from '../types/service-administration.types'

type FieldDraft = {
  label: string
  key: string
  type: RequestFormField['type']
  required: boolean
  options: string[]
}

function fieldSupportsOptions(
  type: RequestFormField['type'],
  fieldTypes: RequestFieldTypeOption[],
) {
  return fieldTypes.find((item) => item.value === type)?.supportsOptions ?? false
}

function defaultOptionsForType(
  type: RequestFormField['type'],
  fieldTypes: RequestFieldTypeOption[],
) {
  return fieldSupportsOptions(type, fieldTypes) ? [''] : []
}

function fieldToDraft(field: RequestFormField): FieldDraft {
  return {
    label: field.label,
    key: field.key,
    type: field.type,
    required: field.required,
    options: field.options?.length ? [...field.options] : [''],
  }
}

function defaultFieldDraft(
  type: RequestFormField['type'],
  fieldTypes: RequestFieldTypeOption[],
): FieldDraft {
  return {
    label: '',
    key: '',
    type,
    required: false,
    options: defaultOptionsForType(type, fieldTypes),
  }
}

function labelToKey(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

type FieldEditorState =
  { mode: 'create'; draft: FieldDraft } | { mode: 'edit'; index: number; draft: FieldDraft }

export function RequestFormBuilderPanel({
  variant = 'page',
  fieldTypes,
  fields,
  onFieldsChange,
  formStatus,
  onFormStatusChange,
  showFormStatus = true,
  canEdit = true,
  emptyTitle = 'No fields on this form yet',
  emptyDescription = 'Add fields from the palette to define what clients must provide for this service.',
  headerAction,
  paletteFooter,
}: {
  variant?: 'page' | 'embedded'
  fieldTypes: RequestFieldTypeOption[]
  fields: RequestFormField[]
  onFieldsChange: (fields: RequestFormField[]) => void
  formStatus?: ServiceRequestForm['status']
  onFormStatusChange?: (status: ServiceRequestForm['status']) => void
  showFormStatus?: boolean
  canEdit?: boolean
  emptyTitle?: string
  emptyDescription?: string
  headerAction?: ReactNode
  paletteFooter?: ReactNode
}) {
  const toast = useToast()
  const [fieldEditor, setFieldEditor] = useState<FieldEditorState | null>(null)
  const paletteDisabled = !canEdit

  const openCreate = (type: RequestFormField['type']) => {
    setFieldEditor({ mode: 'create', draft: defaultFieldDraft(type, fieldTypes) })
  }

  const openEdit = (index: number) => {
    const field = fields[index]
    if (!field) return
    const supportsOptions = fieldSupportsOptions(field.type, fieldTypes)
    setFieldEditor({
      mode: 'edit',
      index,
      draft: {
        ...fieldToDraft(field),
        options: supportsOptions ? (field.options?.length ? [...field.options] : ['']) : [],
      },
    })
  }

  const closeEditor = () => {
    setFieldEditor(null)
  }

  const updateDraft = (patch: Partial<FieldDraft>) => {
    setFieldEditor((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current,
    )
  }

  const applyFieldEdit = () => {
    if (!fieldEditor) return
    const label = fieldEditor.draft.label.trim()
    if (!label) {
      toast.error('Field label is required')
      return
    }

    const key = fieldEditor.draft.key.trim() || labelToKey(label)
    const supportsOptions = fieldSupportsOptions(fieldEditor.draft.type, fieldTypes)
    const options = supportsOptions
      ? fieldEditor.draft.options.map((option) => option.trim()).filter(Boolean)
      : []

    if (supportsOptions && options.length === 0) {
      toast.error('Add at least one option for this field')
      return
    }

    const nextField = {
      label,
      key,
      type: fieldEditor.draft.type,
      required: fieldEditor.draft.required,
      ...(supportsOptions ? { options } : {}),
    }

    if (fieldEditor.mode === 'create') {
      onFieldsChange([
        ...fields,
        {
          id: `field-${Date.now()}`,
          ...nextField,
        },
      ])
    } else {
      onFieldsChange(
        fields.map((item, index) =>
          index === fieldEditor.index
            ? {
                ...item,
                ...nextField,
              }
            : item,
        ),
      )
    }

    closeEditor()
  }

  return (
    <>
      <div
        className={[
          'service-admin-request-builder',
          variant === 'embedded' ? 'service-admin-request-builder--embedded' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <aside className="service-admin-request-palette">
          <h2>Field Palette</h2>
          <div className="service-admin-request-palette-list">
            {fieldTypes.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={paletteDisabled}
                onClick={() => openCreate(item.value)}
              >
                <span>+</span>
                {item.label}
              </button>
            ))}
            {fieldTypes.length === 0 ? (
              <div className="service-admin-card-subtitle py-3">
                Field types will load once the form builder is available.
              </div>
            ) : null}
          </div>
          {showFormStatus && formStatus && onFormStatusChange ? (
            <label className="service-admin-field">
              <span>Form status</span>
              <select
                value={formStatus}
                disabled={!canEdit}
                onChange={(event) =>
                  onFormStatusChange(event.target.value as ServiceRequestForm['status'])
                }
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          ) : null}
          {paletteFooter}
        </aside>

        <section className="service-admin-request-canvas">
          <div className="service-admin-request-canvas-header">
            <div>
              <h2>Service Request Form Builder</h2>
              <p>Create the exact information required per service</p>
            </div>
            {headerAction}
          </div>

          {fields.length === 0 ? (
            <div className="service-admin-empty-table-state" role="status">
              <div className="service-admin-card-title">{emptyTitle}</div>
              <div className="service-admin-card-subtitle mt-1">{emptyDescription}</div>
            </div>
          ) : (
            <div className="service-admin-request-field-list">
              {fields.map((field, index) => (
                <article key={field.id} className="service-admin-request-field-row">
                  <span className="service-admin-request-drag">::</span>
                  <div className="service-admin-grow">
                    <b>{field.label}</b>
                    <small>
                      {field.type} · {field.required ? 'Required' : 'Optional'}
                      {field.options?.length ? ` · ${field.options.length} options` : ''}
                    </small>
                  </div>
                  {canEdit ? (
                    <button type="button" onClick={() => openEdit(index)}>
                      Edit
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() =>
                        onFieldsChange(fields.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      Delete
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {canEdit && fieldEditor ? (
        <div
          className="service-admin-editor-backdrop"
          role="presentation"
          onMouseDown={closeEditor}
        >
          <section
            className="service-admin-field-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-label={fieldEditor.mode === 'create' ? 'Add form field' : 'Edit form field'}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2>{fieldEditor.mode === 'create' ? 'Add Field' : 'Edit Field'}</h2>
                <p>
                  {fieldEditor.mode === 'create'
                    ? 'Define the field before adding it to this form'
                    : 'Update the label, type, or required setting'}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={closeEditor}>
                ×
              </button>
            </header>
            <div className="service-admin-field-editor-body">
              <label>
                <span>Label</span>
                <input
                  autoFocus
                  placeholder="e.g. Full name"
                  value={fieldEditor.draft.label}
                  onChange={(event) => updateDraft({ label: event.target.value })}
                />
              </label>
              <label>
                <span>Type</span>
                <select
                  value={fieldEditor.draft.type}
                  onChange={(event) => {
                    const nextType = event.target.value as RequestFormField['type']
                    const supportsOptions = fieldSupportsOptions(nextType, fieldTypes)
                    updateDraft({
                      type: nextType,
                      options: supportsOptions
                        ? fieldEditor.draft.options.length
                          ? fieldEditor.draft.options
                          : ['']
                        : [],
                    })
                  }}
                >
                  {fieldTypes.length > 0 ? (
                    fieldTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="text">Text</option>
                      <option value="textarea">Long text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="select">Dropdown</option>
                      <option value="file">File upload</option>
                      <option value="checkbox">Checkbox</option>
                    </>
                  )}
                </select>
              </label>
              {fieldSupportsOptions(fieldEditor.draft.type, fieldTypes) ? (
                <div className="service-admin-field-options-editor">
                  <div className="service-admin-field-options-editor-header">
                    <span>Options</span>
                    <button
                      type="button"
                      onClick={() => updateDraft({ options: [...fieldEditor.draft.options, ''] })}
                    >
                      + Add option
                    </button>
                  </div>
                  <div className="service-admin-field-options-list">
                    {fieldEditor.draft.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="service-admin-field-option-row">
                        <input
                          placeholder={`Option ${optionIndex + 1}`}
                          value={option}
                          onChange={(event) =>
                            updateDraft({
                              options: fieldEditor.draft.options.map((item, index) =>
                                index === optionIndex ? event.target.value : item,
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          aria-label={`Remove option ${optionIndex + 1}`}
                          disabled={fieldEditor.draft.options.length <= 1}
                          onClick={() =>
                            updateDraft({
                              options: fieldEditor.draft.options.filter(
                                (_, index) => index !== optionIndex,
                              ),
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="service-admin-field-editor-check">
                <input
                  type="checkbox"
                  checked={fieldEditor.draft.required}
                  onChange={(event) => updateDraft({ required: event.target.checked })}
                />
                Required field
              </label>
            </div>
            <footer>
              <button type="button" className="service-admin-button" onClick={closeEditor}>
                Cancel
              </button>
              <button
                type="button"
                className="service-admin-button service-admin-button-primary"
                onClick={applyFieldEdit}
              >
                {fieldEditor.mode === 'create' ? 'Add Field' : 'Save Field'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  )
}

export function RequestFormBuilderSaveButton({
  canEdit,
  disabled,
  saving,
  onClick,
}: {
  canEdit: boolean
  disabled: boolean
  saving: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="service-admin-request-save"
      disabled={disabled}
      title={!canEdit ? 'You do not have permission to save this form' : undefined}
      onClick={onClick}
    >
      <AccessLockIcon show={!canEdit && disabled} />
      {saving ? 'Saving…' : 'Save Form'}
    </button>
  )
}
