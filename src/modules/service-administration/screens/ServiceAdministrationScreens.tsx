import { IconApps, IconChevronDown, IconChevronRight, IconCopy } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AccessLockIcon } from '@/shared/ui/module-controls'
import { DropdownSelect } from '@/shared/ui/dropdown-select'
import {
  RequestFormBuilderPanel,
  RequestFormBuilderSaveButton,
} from '../components/RequestFormBuilderPanel'
import { SERVICE_CATALOGUE_STATUS_FILTER_OPTIONS } from '../components/service-admin-dropdown-options'
import type {
  PricingCalculator,
  PricingType,
  RequestFieldTypeOption,
  RequestFormField,
  ServiceCatalogueItem,
  ServiceParentOption,
  SaveRequestFormInput,
  ServiceRequestForm,
} from '../types/service-administration.types'
import { formatNumberFieldValue, parseNumberFieldValue } from '@/shared/lib/number-input'
import { formatCurrency } from '@/shared/lib/formatters'

const parentClassNames: Record<string, string> = {
  'Real Estate': 'service-admin-service-icon--real-estate',
  'Real Estate Development & Brokerage': 'service-admin-service-icon--real-estate',
  Engineering: 'service-admin-service-icon--engineering',
  'Engineering & Construction': 'service-admin-service-icon--engineering',
  Survey: 'service-admin-service-icon--survey',
  'Land Surveying & Geospatial': 'service-admin-service-icon--survey',
  ICT: 'service-admin-service-icon--ict',
  'Information Technology': 'service-admin-service-icon--ict',
  'Courier, Logistics & E-commerce': 'service-admin-service-icon--logistics',
  'Agriculture & Food Processing': 'service-admin-service-icon--agriculture',
  'Legal Services': 'service-admin-service-icon--legal',
}

type ServiceParentGroup = {
  key: string
  parentId: number | null
  parentName: string
  services: ServiceCatalogueItem[]
}

function parentGroupKey(parentId: number | null | undefined, parentName?: string) {
  if (parentId != null) return `parent-${parentId}`
  return `parent-name-${parentName?.trim() || 'none'}`
}

const EXPANDED_PARENT_GROUPS_KEY = 'bomach.service-catalogue.expanded-parent-groups'

function readExpandedParentGroups(): Set<string> {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(EXPANDED_PARENT_GROUPS_KEY)
    if (!raw) return new Set()

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function writeExpandedParentGroups(expanded: Set<string>) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(EXPANDED_PARENT_GROUPS_KEY, JSON.stringify([...expanded]))
}

function parentIconClass(parentName?: string) {
  return parentClassNames[parentName ?? ''] ?? 'service-admin-service-icon--default'
}

function groupServicesByParent(
  services: ServiceCatalogueItem[],
  parents: ServiceParentOption[],
): ServiceParentGroup[] {
  const grouped = new Map<string, ServiceParentGroup>()

  for (const service of services) {
    const key = parentGroupKey(service.parentId, service.parentName)
    const existing = grouped.get(key)
    if (existing) {
      existing.services.push(service)
      continue
    }

    grouped.set(key, {
      key,
      parentId: service.parentId ?? null,
      parentName: service.parentName?.trim() || 'Unassigned',
      services: [service],
    })
  }

  const orderIndex = new Map(parents.map((parent, index) => [parent.id, index]))

  return [...grouped.values()].sort((left, right) => {
    const leftOrder =
      left.parentId != null && orderIndex.has(left.parentId)
        ? orderIndex.get(left.parentId)!
        : Number.MAX_SAFE_INTEGER
    const rightOrder =
      right.parentId != null && orderIndex.has(right.parentId)
        ? orderIndex.get(right.parentId)!
        : Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return left.parentName.localeCompare(right.parentName)
  })
}

function ServiceCatalogueCard({
  service,
  onConfigure,
  configureLabel,
  onDuplicate,
  showParentMeta = false,
}: {
  service: ServiceCatalogueItem
  onConfigure?: ((service: ServiceCatalogueItem) => void) | undefined
  configureLabel?: 'Configure' | 'View'
  onDuplicate?: ((service: ServiceCatalogueItem) => void) | undefined
  showParentMeta?: boolean
}) {
  const parentClassName = parentIconClass(service.parentName)

  return (
    <article className="service-admin-service-card">
      <div className={`service-admin-service-icon ${parentClassName}`}>
        <IconApps size={18} />
      </div>
      <div className="service-admin-service-name">{service.name}</div>
      <p className="service-admin-service-description">{service.description}</p>
      <div className="service-admin-row-subtitle service-admin-service-meta">
        {service.code}
        {showParentMeta ? ` · ${service.parentName ?? 'No parent'}` : null}
        {service.slaDays != null ? ` · ${service.slaDays}d SLA` : null}
      </div>
      <div className="service-admin-service-footer">
        <span className={`service-admin-pill ${statusClass(service.status)}`}>
          {service.status}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className="service-admin-button service-admin-button-small"
            disabled={!onConfigure}
            title={!onConfigure ? 'You do not have permission to view this service' : undefined}
            onClick={() => onConfigure?.(service)}
          >
            <AccessLockIcon show={!onConfigure} size={11} />
            {configureLabel}
          </button>
          {onDuplicate ? (
            <button
              type="button"
              className="service-admin-button service-admin-button-small"
              aria-label="Duplicate service"
              onClick={() => onDuplicate(service)}
            >
              <IconCopy size={13} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function statusClass(status: string) {
  if (status.toLowerCase() === 'active') return 'service-admin-pill-green'
  if (status.toLowerCase() === 'draft') return 'service-admin-pill-yellow'
  return 'service-admin-pill-gray'
}

export function ServiceCatalogueScreen({
  services,
  totalCount,
  query,
  status,
  parentId,
  parents,
  page,
  pageSize,
  onFiltersChange,
  onPageChange,
  onConfigure,
  configureLabel = 'Configure',
  onCreate,
  createDisabled = false,
  onBranchAvailability,
  branchAvailabilityDisabled = false,
  onDuplicate,
}: {
  services: ServiceCatalogueItem[]
  totalCount: number
  query: string
  status: string
  parentId: number | null
  parents: ServiceParentOption[]
  page: number
  pageSize: number
  onFiltersChange: (filters: { query: string; status: string; parentId?: number }) => void
  onPageChange: (page: number) => void
  onConfigure?: ((service: ServiceCatalogueItem) => void) | undefined
  configureLabel?: 'Configure' | 'View'
  onCreate?: (() => void) | undefined
  createDisabled?: boolean
  onBranchAvailability?: (() => void) | undefined
  branchAvailabilityDisabled?: boolean
  onDuplicate?: ((service: ServiceCatalogueItem) => void) | undefined
}) {
  const hasActiveFilters = query.trim().length > 0 || status.length > 0 || parentId != null
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const [searchDraft, setSearchDraft] = useState(query)
  const [syncedQuery, setSyncedQuery] = useState(query)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(readExpandedParentGroups)
  const onFiltersChangeRef = useRef(onFiltersChange)
  const statusRef = useRef(status)
  const parentIdRef = useRef(parentId)
  const groupedServices = useMemo(
    () => groupServicesByParent(services, parents),
    [parents, services],
  )

  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setSearchDraft(query)
  }

  useEffect(() => {
    onFiltersChangeRef.current = onFiltersChange
  }, [onFiltersChange])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    parentIdRef.current = parentId
  }, [parentId])

  useEffect(() => {
    if (searchDraft === query) return

    const timeoutId = window.setTimeout(() => {
      onFiltersChangeRef.current({
        query: searchDraft,
        status: statusRef.current,
        ...(parentIdRef.current ? { parentId: parentIdRef.current } : {}),
      })
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [searchDraft, query])

  const recordCountLabel = `${totalCount} service${totalCount === 1 ? '' : 's'}`
  const showGroupedLayout = parentId == null

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      writeExpandedParentGroups(next)
      return next
    })
  }

  const applyFilters = (next: { query?: string; status?: string; parentId?: number | null }) => {
    const resolvedParentId =
      next.parentId === null ? undefined : (next.parentId ?? parentId ?? undefined)

    onFiltersChange({
      query: next.query ?? searchDraft,
      status: next.status ?? status,
      ...(resolvedParentId ? { parentId: resolvedParentId } : {}),
    })
  }

  return (
    <div className="service-admin-page service-admin-content">
      <div className="service-admin-card service-admin-catalog-shell">
        <div className="service-admin-filter-group service-admin-catalog-filter">
          <input
            className="service-admin-grow"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (searchDraft === query) return
              applyFilters({ query: searchDraft })
            }}
            placeholder="Search services..."
          />
          <DropdownSelect
            compact
            placeholder="All statuses"
            options={SERVICE_CATALOGUE_STATUS_FILTER_OPTIONS}
            value={status}
            onChange={(value) => applyFilters({ status: value })}
          />
          {parents.length > 0 ? (
            <DropdownSelect
              compact
              className="ui-dropdown--parent-filter"
              placeholder="All parent services"
              options={[
                { value: '', label: 'All parent services' },
                ...parents.map((parent) => ({
                  value: String(parent.id),
                  label: parent.name,
                })),
              ]}
              value={parentId != null ? String(parentId) : ''}
              onChange={(value) => {
                applyFilters({
                  parentId: value ? Number(value) : null,
                })
              }}
            />
          ) : null}
          <span className="service-admin-grow" />
          <button
            type="button"
            className="service-admin-button"
            disabled={branchAvailabilityDisabled || !onBranchAvailability}
            title={
              branchAvailabilityDisabled
                ? 'You do not have permission to view branch availability'
                : undefined
            }
            onClick={() => onBranchAvailability?.()}
          >
            <AccessLockIcon show={branchAvailabilityDisabled} />
            Branch Availability
          </button>
          <button
            type="button"
            className="service-admin-button service-admin-button-primary"
            disabled={createDisabled || !onCreate}
            title={createDisabled ? 'You do not have permission to create services' : undefined}
            onClick={() => onCreate?.()}
          >
            <AccessLockIcon show={createDisabled} />
            Create Service
          </button>
        </div>

        {services.length === 0 ? (
          <section className="service-admin-card col-span-full border-dashed p-6 sm:p-8">
            <div className="mx-auto max-w-xl text-center">
              <div className="service-admin-card-title">
                {hasActiveFilters
                  ? 'No services match the current filters'
                  : 'No services in the catalogue yet'}
              </div>
              <div className="service-admin-card-subtitle mt-1">
                {hasActiveFilters
                  ? 'Try clearing or adjusting the search and filter settings to see more services.'
                  : 'Service cards will appear here after the first Service is created. You can still search, filter, review branch availability, and start the setup flow from this page.'}
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    className="service-admin-button service-admin-button-primary"
                    onClick={() => applyFilters({ query: '', status: '', parentId: null })}
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    className="service-admin-button service-admin-button-primary"
                    disabled={createDisabled || !onCreate}
                    title={
                      createDisabled ? 'You do not have permission to create services' : undefined
                    }
                    onClick={() => onCreate?.()}
                  >
                    <AccessLockIcon show={createDisabled} />
                    Create first Service
                  </button>
                )}
                <button
                  type="button"
                  className="service-admin-button"
                  disabled={branchAvailabilityDisabled || !onBranchAvailability}
                  title={
                    branchAvailabilityDisabled
                      ? 'You do not have permission to view branch availability'
                      : undefined
                  }
                  onClick={() => onBranchAvailability?.()}
                >
                  <AccessLockIcon show={branchAvailabilityDisabled} />
                  Branch Availability
                </button>
              </div>
            </div>
          </section>
        ) : showGroupedLayout ? (
          <div className="service-admin-parent-groups">
            {groupedServices.map((group) => {
              const collapsed = !expandedGroups.has(group.key)
              const activeCount = group.services.filter(
                (service) => service.status === 'active',
              ).length
              const draftCount = group.services.filter(
                (service) => service.status === 'draft',
              ).length

              return (
                <section key={group.key} className="service-admin-parent-group">
                  <button
                    type="button"
                    className="service-admin-parent-group-header"
                    aria-expanded={!collapsed}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className="service-admin-parent-group-chevron" aria-hidden="true">
                      {collapsed ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
                    </span>
                    <span
                      className={`service-admin-service-icon service-admin-parent-group-icon ${parentIconClass(group.parentName)}`}
                    >
                      <IconApps size={16} />
                    </span>
                    <span className="service-admin-parent-group-copy">
                      <span className="service-admin-parent-group-name">{group.parentName}</span>
                      <span className="service-admin-parent-group-meta">
                        {group.services.length} service{group.services.length === 1 ? '' : 's'}
                        {activeCount > 0 ? ` · ${activeCount} active` : ''}
                        {draftCount > 0 ? ` · ${draftCount} draft` : ''}
                      </span>
                    </span>
                  </button>

                  {!collapsed ? (
                    <div className="service-admin-service-grid service-admin-parent-group-body">
                      {group.services.map((service) => (
                        <ServiceCatalogueCard
                          key={service.id}
                          service={service}
                          onConfigure={onConfigure}
                          configureLabel={configureLabel}
                          onDuplicate={onDuplicate}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="service-admin-service-grid">
            {services.map((service) => (
              <ServiceCatalogueCard
                key={service.id}
                service={service}
                onConfigure={onConfigure}
                configureLabel={configureLabel}
                onDuplicate={onDuplicate}
                showParentMeta
              />
            ))}
          </div>
        )}

        <div className="service-admin-table-pagination">
          <div className="service-admin-table-pagination-summary">
            <span className="service-admin-table-pagination-count">{recordCountLabel}</span>
            {showGroupedLayout ? (
              <>
                <span className="service-admin-table-pagination-divider" aria-hidden="true" />
                <span>
                  {groupedServices.length} parent group{groupedServices.length === 1 ? '' : 's'}
                </span>
              </>
            ) : null}
            <span className="service-admin-table-pagination-divider" aria-hidden="true" />
            <span>
              Page <b>{page}</b> of <b>{pageCount}</b>
            </span>
          </div>
          <div className="service-admin-table-pagination-actions">
            <button
              type="button"
              className="service-admin-button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="service-admin-button"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function pricingTypeLabel(type: PricingType | undefined) {
  switch (type) {
    case 'unit_rate':
      return 'Unit rate'
    case 'area_rate':
      return 'Area rate'
    case 'percentage':
      return 'Percentage'
    case 'formula':
      return 'Formula'
    default:
      return 'Fixed'
  }
}

function calculatorNumericFields(calculator: PricingCalculator) {
  return calculator.variables
    .filter((variable) => variable.type === 'number')
    .map((variable, index) => ({
      key: variable.key,
      label: variable.label,
      value: index === 0 ? Math.max(1, calculator.sampleTotal / 1000) : 1,
    }))
}

function calculatorPreviewBase(calculator: PricingCalculator): number {
  if (calculator.sampleTotal > 0) return calculator.sampleTotal

  const fixedCharge = calculator.charges.find(
    (charge) => charge.kind === 'fixed' && typeof charge.value === 'number' && charge.value > 0,
  )
  if (fixedCharge && typeof fixedCharge.value === 'number') return fixedCharge.value

  return 0
}

export function CalculatorLibraryScreen({
  calculators,
  onCreate,
  createDisabled = false,
  createLocked = false,
  hasServices = true,
}: {
  calculators: PricingCalculator[]
  onCreate?: (() => void) | undefined
  createDisabled?: boolean
  /** True only when create is blocked by permission (not empty catalogue). */
  createLocked?: boolean
  hasServices?: boolean
}) {
  const [selectedActiveId, setActiveId] = useState(calculators[0]?.id ?? '')
  const activeId = calculators.some((calculator) => calculator.id === selectedActiveId)
    ? selectedActiveId
    : (calculators[0]?.id ?? '')

  const active = calculators.find((calculator) => calculator.id === activeId) ?? calculators[0]
  const [inputs, setInputs] = useState<Record<string, number>>({})

  const fields = active ? calculatorNumericFields(active) : []
  const previewBase = active ? calculatorPreviewBase(active) : 0
  const estimated = active
    ? Object.keys(inputs).length === 0
      ? previewBase
      : Object.values(inputs).reduce((total, value) => total + Number(value || 0), 0)
    : 0

  const formula = active
    ? (active.charges.find((charge) => charge.kind === 'formula')?.value ??
      (active.pricingType === 'fixed'
        ? 'Base amount + Deposit + Tax + Discount approval'
        : active.charges.map((charge) => charge.label).join(' + ')))
    : 'No calculator selected'

  const showCreateLock = createLocked && (createDisabled || !onCreate)

  return (
    <div className="service-admin-page service-admin-content">
      <div className="service-admin-grid-2-1">
        <section className="service-admin-card">
          <div className="service-admin-card-header">
            <div>
              <div className="service-admin-card-title">Service Calculator Library</div>
              <div className="service-admin-card-subtitle">
                Reusable formulas for estimates, quotes and invoices
              </div>
            </div>
            <button
              type="button"
              className="service-admin-button service-admin-button-primary"
              disabled={createDisabled || !onCreate}
              title={
                showCreateLock
                  ? 'You do not have permission to create calculators'
                  : !hasServices
                    ? 'Create a service in the catalogue before adding a calculator'
                    : undefined
              }
              onClick={() => onCreate?.()}
            >
              <AccessLockIcon show={showCreateLock} />
              New Calculator
            </button>
          </div>

          <div className="service-admin-table-wrap">
            <table className="service-admin-table service-admin-calculator-table">
              <thead>
                <tr>
                  <th>Calculator</th>
                  <th>Service</th>
                  <th>Template</th>
                  <th>Fields</th>
                  <th>Deposit</th>
                  <th>Approval</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {calculators.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="py-8 text-center">
                        <div className="service-admin-card-title">No calculators configured</div>
                        <div className="service-admin-card-subtitle mt-1">
                          {!hasServices
                            ? 'Create a service in the catalogue first, then add a calculator for it.'
                            : 'Calculator configurations will appear here once a service has pricing set up.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
                {calculators.map((calculator) => {
                  const isActive = calculator.id === active?.id

                  return (
                    <tr
                      key={calculator.id}
                      className={isActive ? 'service-admin-table-row--active' : undefined}
                      aria-selected={isActive}
                    >
                      <td>
                        <b>{calculator.name}</b>
                        <div className="service-admin-row-subtitle">{calculator.code}</div>
                      </td>
                      <td>{calculator.serviceName}</td>
                      <td>{pricingTypeLabel(calculator.pricingType)}</td>
                      <td>{calculator.variables.length}</td>
                      <td>
                        {calculator.charges.find((charge) =>
                          charge.label.toLowerCase().includes('deposit'),
                        )?.value ?? '—'}
                      </td>
                      <td>
                        &gt;{' '}
                        {calculator.charges.find((charge) =>
                          charge.label.toLowerCase().includes('approval'),
                        )?.value ?? '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`service-admin-button service-admin-button-small${
                            isActive ? 'service-admin-calculator-test-button--active' : ''
                          }`}
                          aria-pressed={isActive}
                          onClick={() => {
                            setActiveId(calculator.id)
                            setInputs({})
                          }}
                        >
                          Test
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="service-admin-card">
          <div className="service-admin-card-header">
            <div>
              <div className="service-admin-card-title">Live Calculator Test</div>
              <div className="service-admin-card-subtitle">
                {active?.name ?? 'Select or create a calculator to preview pricing'}
              </div>
            </div>
          </div>

          {!active ? (
            <div className="service-admin-notice service-admin-notice-blue">
              <b>No calculator selected yet</b>
              <br />
              Select or create a calculator to preview variables, formula rules, deposits, taxes,
              and approval thresholds in one place.
            </div>
          ) : null}

          {fields.map((field) => (
            <div className="service-admin-field" key={field.key}>
              <label>{field.label}</label>
              <input
                type="number"
                value={formatNumberFieldValue(inputs[field.key] ?? field.value)}
                onChange={(event) =>
                  setInputs((current) => ({
                    ...current,
                    [field.key]: parseNumberFieldValue(event.target.value),
                  }))
                }
              />
            </div>
          ))}

          <div className="service-admin-notice service-admin-notice-blue">
            <b>Formula</b>
            <br />
            <code>{String(formula)}</code>
          </div>

          <div className="service-admin-kpi service-admin-kpi-blue">
            <div className="service-admin-kpi-label">Estimated client price</div>
            <div className="service-admin-kpi-value">{formatCurrency(estimated)}</div>
            <div className="service-admin-kpi-subtitle">
              Tax, deposit and approval rules apply as configured.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export function RequestFormBuilderScreen({
  services,
  selectedServiceId,
  onSelectedServiceChange,
  form,
  fieldTypes,
  saving = false,
  onSave,
}: {
  services: ServiceCatalogueItem[]
  selectedServiceId: string
  onSelectedServiceChange: (serviceId: string) => void
  form: ServiceRequestForm | null
  fieldTypes: RequestFieldTypeOption[]
  saving?: boolean
  onSave?: (input: SaveRequestFormInput) => void
}) {
  const canEdit = Boolean(onSave)
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? services[0] ?? null
  const formSourceKey = `${selectedService?.id ?? ''}:${form?.id ?? 'new'}:${form?.updatedAt ?? ''}`

  const [draftKey, setDraftKey] = useState(formSourceKey)
  const [formStatus, setFormStatus] = useState<ServiceRequestForm['status']>(
    form?.status ?? 'draft',
  )
  const [fields, setFields] = useState<RequestFormField[]>(form?.fields ?? [])

  if (formSourceKey !== draftKey) {
    setDraftKey(formSourceKey)
    setFormStatus(form?.status ?? 'draft')
    setFields(form?.fields ?? [])
  }

  const saveDisabled = !canEdit || !selectedService || saving

  const saveForm = () => {
    if (!selectedService || !onSave) return

    onSave({
      ...(form?.id ? { id: form.id } : {}),
      name: form?.name ?? `${selectedService.name} Request Form`,
      serviceId: selectedService.id,
      status: formStatus,
      fields,
    })
  }

  return (
    <div className="service-admin-page service-admin-content">
      <RequestFormBuilderPanel
        fieldTypes={fieldTypes}
        fields={fields}
        onFieldsChange={setFields}
        formStatus={formStatus}
        onFormStatusChange={setFormStatus}
        canEdit={canEdit && Boolean(selectedService)}
        emptyTitle={selectedService ? 'No fields on this form yet' : 'No service selected'}
        emptyDescription={
          selectedService
            ? 'Add fields from the palette to define what clients must provide for this service.'
            : 'Choose a service to start designing its request form.'
        }
        headerAction={
          <DropdownSelect
            label="Service"
            compact
            className="service-admin-request-service-dropdown"
            placeholder={services.length === 0 ? 'Create a service first' : 'Select a service'}
            disabled={services.length === 0}
            options={services.map((service) => ({
              value: String(service.id),
              label: service.name,
            }))}
            value={selectedService?.id != null ? String(selectedService.id) : ''}
            onChange={(value) => onSelectedServiceChange(value)}
          />
        }
        paletteFooter={
          <RequestFormBuilderSaveButton
            canEdit={canEdit}
            disabled={saveDisabled}
            saving={saving}
            onClick={saveForm}
          />
        }
      />
    </div>
  )
}
