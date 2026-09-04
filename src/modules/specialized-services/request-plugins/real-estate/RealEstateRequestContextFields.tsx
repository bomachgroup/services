import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/app/auth'
import { hasPermission, PERMISSIONS } from '@/app/permissions'
import type { ClientOption, ServiceOption } from '@/modules/commercial/api/service-requests.types'
import { formatCurrency } from '@/shared/lib/formatters'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'

import { realEstateQueries } from '../../real-estate/real-estate.queries'
import type { SpecializedRequestFormValues, SpecializedRequestContextFieldsProps } from '../types'

export type RealEstateRequestSourceMode = 'estate' | 'standalone' | 'brokerage'

export interface RealEstateRequestContext {
  sourceMode: RealEstateRequestSourceMode
  estateId: number
  selectedId: number | null
}

const sourceModeOptions: Array<{ mode: RealEstateRequestSourceMode; label: string }> = [
  { mode: 'estate', label: 'Estate' },
  { mode: 'standalone', label: 'Standalone property' },
  { mode: 'brokerage', label: 'Unlinked brokerage' },
]

export function RealEstateRequestContextFields({
  value,
  onChange,
  error,
}: SpecializedRequestContextFieldsProps<RealEstateRequestContext>) {
  const context = value ?? createInitialRealEstateRequestContext()
  const { user } = useAuth()
  const canListEstates = hasPermission(user, PERMISSIONS.estatesList)
  const canListProperties = hasPermission(user, PERMISSIONS.propertiesList)
  const canListBrokerage = hasPermission(user, PERMISSIONS.brokerageList)

  const estatesQuery = useQuery({
    ...realEstateQueries.estates({ limit: 100, page: 1 }),
    enabled: canListEstates,
  })
  const standaloneQuery = useQuery({
    ...realEstateQueries.standaloneProperties({ limit: 100, page: 1 }),
    enabled: canListProperties && context.sourceMode === 'standalone',
  })
  const brokerageQuery = useQuery({
    ...realEstateQueries.brokerage({ limit: 100, page: 1 }),
    enabled: canListBrokerage && context.sourceMode === 'brokerage',
  })
  const propertiesQuery = useQuery({
    ...realEstateQueries.properties(context.estateId, { limit: 100, page: 1 }),
    enabled: canListProperties && context.sourceMode === 'estate' && context.estateId > 0,
  })

  const estates = estatesQuery.data?.items ?? []
  const standaloneProperties = standaloneQuery.data?.items ?? []
  const unlinkedBrokerage = (brokerageQuery.data?.items ?? []).filter(
    (listing) => listing.estateId == null,
  )
  const estateProperties = propertiesQuery.data?.items ?? []

  const setSourceMode = (sourceMode: RealEstateRequestSourceMode) => {
    onChange({
      sourceMode,
      estateId: 0,
      selectedId: null,
    })
  }

  if (!canListEstates && !canListProperties && !canListBrokerage) {
    return (
      <div className="commercial-form-note commercial-form-note-warning">
        You do not have permission to browse real estate inventory for this specialized service flow.
      </div>
    )
  }

  return (
    <>
      <div className="commercial-field commercial-field--full">
        <span>Inventory source</span>
        <div className="commercial-tabs commercial-tabs--form" role="group" aria-label="Inventory source">
          {sourceModeOptions.map((option) => {
            const disabled =
              (option.mode === 'estate' && !canListEstates) ||
              (option.mode === 'standalone' && !canListProperties) ||
              (option.mode === 'brokerage' && !canListBrokerage)

            return (
              <button
                key={option.mode}
                type="button"
                className={`commercial-tab ${context.sourceMode === option.mode ? 'is-active' : ''}`}
                disabled={disabled}
                onClick={() => setSourceMode(option.mode)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {context.sourceMode === 'estate' ? (
        <>
          <DropdownSelect
            label="Estate"
            required
            searchable
            loading={estatesQuery.isPending}
            placeholder="Select an estate"
            searchPlaceholder="Search estates..."
            options={mapDropdownOptions(
              estates.map((estate) => ({
                value: estate.id,
                label: estate.estateName,
                description: [estate.estateCode, estate.cityTown].filter(Boolean).join(' · '),
              })),
            )}
            value={String(context.estateId || 0)}
            onChange={(nextValue) => {
              const estateId = Number(nextValue)
              onChange({
                ...context,
                estateId,
                selectedId: null,
              })
            }}
          />

          <DropdownSelect
            label="Property (optional)"
            searchable
            disabled={!context.estateId || !canListProperties}
            loading={propertiesQuery.isPending}
            placeholder={
              !context.estateId
                ? 'Choose an estate first'
                : propertiesQuery.isPending
                  ? 'Loading properties...'
                  : 'No specific property'
            }
            searchPlaceholder="Search properties..."
            options={[
              { value: '0', label: 'No specific property' },
              ...mapDropdownOptions(
                estateProperties.map((property) => ({
                  value: property.id,
                  label: property.propertyName,
                  description:
                    property.plotNumber != null
                      ? `Plot ${property.plotNumber}`
                      : property.propertyType,
                })),
              ),
            ]}
            value={String(context.selectedId ?? 0)}
            onChange={(nextValue) => {
              const selectedId = Number(nextValue)
              onChange({
                ...context,
                selectedId: selectedId > 0 ? selectedId : null,
              })
            }}
          />
        </>
      ) : null}

      {context.sourceMode === 'standalone' ? (
        <DropdownSelect
          label="Standalone property"
          required
          searchable
          loading={standaloneQuery.isPending}
          placeholder={
            standaloneQuery.isPending ? 'Loading standalone properties...' : 'Select a property'
          }
          searchPlaceholder="Search properties..."
          options={mapDropdownOptions(
            standaloneProperties.map((property) => ({
              value: property.id,
              label: property.propertyName,
              description: `${property.propertyTypeDisplay || property.propertyType} · ${formatCurrency(property.price)}`,
            })),
          )}
          value={String(context.selectedId ?? 0)}
          onChange={(nextValue) => {
            const selectedId = Number(nextValue)
            onChange({
              ...context,
              selectedId: selectedId > 0 ? selectedId : null,
            })
          }}
        />
      ) : null}

      {context.sourceMode === 'brokerage' ? (
        <DropdownSelect
          label="Unlinked brokerage listing"
          required
          searchable
          loading={brokerageQuery.isPending}
          placeholder={
            brokerageQuery.isPending ? 'Loading brokerage listings...' : 'Select a listing'
          }
          searchPlaceholder="Search listings..."
          options={mapDropdownOptions(
            unlinkedBrokerage.map((listing) => ({
              value: listing.id,
              label: listing.title,
              description: `${listing.location} · ${formatCurrency(listing.price)}`,
            })),
          )}
          value={String(context.selectedId ?? 0)}
          onChange={(nextValue) => {
            const selectedId = Number(nextValue)
            onChange({
              ...context,
              selectedId: selectedId > 0 ? selectedId : null,
            })
          }}
        />
      ) : null}

      {brokerageQuery.isError || standaloneQuery.isError || estatesQuery.isError ? (
        <div className="commercial-field commercial-field--full">
          <small className="commercial-field-error">Real estate inventory could not be loaded.</small>
        </div>
      ) : null}

      {context.sourceMode === 'estate' && !estatesQuery.isPending && estates.length === 0 ? (
        <div className="commercial-field commercial-field--full">
          <p className="commercial-form-note commercial-form-note-warning">
            No estates are available yet. Create an estate in Real Estate before continuing.
          </p>
        </div>
      ) : null}

      {context.sourceMode === 'standalone' &&
      !standaloneQuery.isPending &&
      standaloneProperties.length === 0 ? (
        <div className="commercial-field commercial-field--full">
          <p className="commercial-form-note commercial-form-note-warning">
            No standalone properties are available yet. Add one in Real Estate before continuing.
          </p>
        </div>
      ) : null}

      {context.sourceMode === 'brokerage' && !brokerageQuery.isPending && unlinkedBrokerage.length === 0 ? (
        <div className="commercial-field commercial-field--full">
          <p className="commercial-form-note commercial-form-note-warning">
            No unlinked brokerage listings are available yet. Add one in Real Estate before
            continuing.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="commercial-field commercial-field--full">
          <small className="commercial-field-error">{error}</small>
        </div>
      ) : null}
    </>
  )
}

export function createInitialRealEstateRequestContext(): RealEstateRequestContext {
  return {
    sourceMode: 'estate',
    estateId: 0,
    selectedId: null,
  }
}

export function validateRealEstateRequestContext(
  context: RealEstateRequestContext | null | undefined,
) {
  if (!context) return 'Choose an inventory source to continue.'

  if (context.sourceMode === 'estate') {
    if (!context.estateId) return 'Select an estate to continue.'
    return null
  }

  if (context.sourceMode === 'standalone') {
    if (!context.selectedId) return 'Select a standalone property to continue.'
    return null
  }

  if (context.sourceMode === 'brokerage') {
    if (!context.selectedId) return 'Select an unlinked brokerage listing to continue.'
    return null
  }

  return 'Choose an inventory source to continue.'
}

export function buildRealEstateRequestHandoff({
  service,
  context,
  client,
  formValues,
}: {
  service: ServiceOption
  context: RealEstateRequestContext
  client: ClientOption | null
  formValues: SpecializedRequestFormValues
}) {
  const sharedSearch = {
    service: String(service.id),
  }

  const navigationSearch =
    context.sourceMode === 'estate'
      ? {
          ...sharedSearch,
          estate: String(context.estateId),
          ...(context.selectedId ? { property: String(context.selectedId) } : {}),
        }
      : context.sourceMode === 'standalone'
        ? {
            ...sharedSearch,
            standaloneProperty: String(context.selectedId),
          }
        : {
            ...sharedSearch,
            brokerage: String(context.selectedId),
          }

  return {
    domain: 'real_estate',
    serviceId: service.id,
    ...(client ? { clientId: client.id } : {}),
    ...(formValues.contactName ? { contactName: formValues.contactName } : {}),
    ...(formValues.contactPhone ? { contactPhone: formValues.contactPhone } : {}),
    ...(formValues.contactEmail ? { contactEmail: formValues.contactEmail } : {}),
    ...(formValues.branchId ? { branchId: formValues.branchId } : {}),
    ...(formValues.crmLeadId ? { crmLeadId: formValues.crmLeadId } : {}),
    context: {
      sourceMode: context.sourceMode,
      estateId: context.estateId,
      selectedId: context.selectedId,
    },
    navigation: {
      section: 'real-estate-inventory',
      search: navigationSearch,
    },
  }
}
