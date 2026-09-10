import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/app/auth'
import { hasPermission, PERMISSIONS } from '@/app/permissions'
import { formatCurrency } from '@/shared/lib/formatters'
import {
  formatGroupedNumberFieldValue,
  parseGroupedNumberFieldValue,
} from '@/shared/lib/number-input'
import { DropdownSelect, mapDropdownOptions } from '@/shared/ui/dropdown-select'

import type { BrokerageListing, Property } from '../../real-estate/real-estate.types'
import {
  propertyPriceSourceLabel,
  resolvePropertySaleBasePrice,
} from '../../real-estate/property-pricing.utils'
import { realEstateQueries } from '../../real-estate/real-estate.queries'
import type { SpecializedRequestContextFieldsProps } from '../types'
import {
  allowedRealEstateSourceModes,
  createInitialRealEstateRequestContext,
  realEstateRequestContext,
} from './real-estate.request-context'

export type RealEstateRequestSourceMode = 'estate' | 'standalone' | 'brokerage'

export interface RealEstateRequestContext {
  sourceMode: RealEstateRequestSourceMode
  estateId: number
  selectedId: number | null
  settlementMode: 'full_payment' | 'reservation' | 'installment'
  /** Custom override. Null means use the inventory / calculated price. */
  agreedPrice: number | null
  /** Resolved inventory price for the selected asset (estate-rate or listed). */
  inventoryPrice: number | null
}

const sourceModeOptions: Array<{ mode: RealEstateRequestSourceMode; label: string }> = [
  { mode: 'estate', label: 'Estate' },
  { mode: 'standalone', label: 'Standalone property' },
  { mode: 'brokerage', label: 'Unlinked brokerage' },
]

type PaymentPlanOption = {
  mode: RealEstateRequestContext['settlementMode']
  label: string
  meta: string
  dueAmount: number | null
}

function percentOf(amount: number, percent: number | null | undefined) {
  if (!amount || percent == null || !Number.isFinite(percent)) return null
  return (amount * percent) / 100
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  return `${Number(value)}%`
}

function formatDurationHours(hours: number | null | undefined) {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

function resolveBrokerageInventoryPrice(listing: BrokerageListing | null | undefined) {
  if (!listing) return 0
  return listing.price > 0 ? listing.price : 0
}

function resolvePropertyInventoryPrice(
  property: Property | null | undefined,
  estatePricePerSqm?: number | null,
) {
  return resolvePropertySaleBasePrice(property, estatePricePerSqm)
}

export function RealEstateRequestContextFields({
  value,
  onChange,
  error,
  service,
}: SpecializedRequestContextFieldsProps<RealEstateRequestContext>) {
  const context = value ?? createInitialRealEstateRequestContext()
  const { user } = useAuth()
  const canListEstates = hasPermission(user, PERMISSIONS.estatesList)
  const canListProperties = hasPermission(user, PERMISSIONS.propertiesList)
  const canListBrokerage = hasPermission(user, PERMISSIONS.brokerageList)
  const allowedSourceModes = allowedRealEstateSourceModes(service)
  const [customPriceOpen, setCustomPriceOpen] = useState(
    () => context.agreedPrice != null && context.agreedPrice > 0,
  )

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

  const estates = (estatesQuery.data?.items ?? []).filter(
    (estate) =>
      estate.isActive !== false &&
      (estate.estateStatus === 'available' || estate.estateStatus === 'under_development'),
  )
  const standaloneProperties = (standaloneQuery.data?.items ?? []).filter(
    (property) => property.status === 'available' && property.isActive !== false,
  )
  const unlinkedBrokerage = (brokerageQuery.data?.items ?? []).filter(
    (listing) => listing.estateId == null && listing.status === 'available',
  )
  const estateProperties = (propertiesQuery.data?.items ?? []).filter(
    (property) => property.status === 'available' && property.isActive !== false,
  )
  const selectedEstate = estates.find((estate) => estate.id === context.estateId) ?? null
  const selectedProperty =
    context.sourceMode === 'estate'
      ? (estateProperties.find((property) => property.id === context.selectedId) ?? null)
      : context.sourceMode === 'standalone'
        ? (standaloneProperties.find((property) => property.id === context.selectedId) ?? null)
        : null
  const selectedBrokerage =
    context.sourceMode === 'brokerage'
      ? (unlinkedBrokerage.find((listing) => listing.id === context.selectedId) ?? null)
      : null

  const inventoryPrice = selectedProperty
    ? resolvePropertyInventoryPrice(selectedProperty, selectedEstate?.pricePerSqm)
    : resolveBrokerageInventoryPrice(selectedBrokerage)

  const priceSourceLabel = selectedProperty
    ? propertyPriceSourceLabel(selectedProperty, selectedEstate?.pricePerSqm)
    : selectedBrokerage
      ? 'Listed brokerage price'
      : ''

  const displayPrice =
    customPriceOpen && context.agreedPrice != null && context.agreedPrice > 0
      ? context.agreedPrice
      : inventoryPrice

  useEffect(() => {
    if (!context.selectedId) return
    if (context.inventoryPrice === inventoryPrice) return
    onChange({
      ...context,
      inventoryPrice: inventoryPrice > 0 ? inventoryPrice : null,
    })
    // Intentionally sync inventory price when the selected asset resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.selectedId, inventoryPrice])

  const allowReservation =
    context.sourceMode === 'estate' && Boolean(selectedEstate?.allowReservation)
  const allowInstallment =
    context.sourceMode === 'estate' && Boolean(selectedEstate?.allowInstallment)

  const paymentPlanOptions: PaymentPlanOption[] = (() => {
    const options: PaymentPlanOption[] = [
      {
        mode: 'full_payment',
        label: 'Full payment',
        meta: 'Full balance due to complete the sale',
        dueAmount: displayPrice > 0 ? displayPrice : null,
      },
    ]

    if (allowReservation) {
      const reservationPercent = selectedEstate?.reservationPercent ?? null
      const holdPeriod = formatDurationHours(selectedEstate?.reservationDurationHours)
      const terms = [
        reservationPercent != null ? `${formatPercent(reservationPercent)} reservation` : null,
        holdPeriod ? `${holdPeriod} hold` : null,
        selectedEstate?.reservationRefundable ? 'Refundable' : 'Non-refundable',
      ]
        .filter(Boolean)
        .join(' · ')
      options.push({
        mode: 'reservation',
        label: 'Reservation',
        meta: terms || 'Hold under estate reservation policy',
        dueAmount: percentOf(displayPrice, reservationPercent),
      })
    }

    if (allowInstallment) {
      const downPaymentPercent = selectedEstate?.installmentDownPaymentPercent ?? null
      const months = selectedEstate?.installmentMonths ?? null
      const terms = [
        downPaymentPercent != null ? `${formatPercent(downPaymentPercent)} down payment` : null,
        months != null ? `${months}-month plan` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      options.push({
        mode: 'installment',
        label: 'Installment',
        meta: terms || 'Down payment under estate installment policy',
        dueAmount: percentOf(displayPrice, downPaymentPercent),
      })
    }

    return options
  })()

  useEffect(() => {
    if (!context.selectedId) return
    const allowed = new Set(paymentPlanOptions.map((option) => option.mode))
    if (allowed.has(context.settlementMode)) return
    onChange({
      ...context,
      settlementMode: 'full_payment',
    })
    // Keep settlement mode valid against estate policy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.selectedId, paymentPlanOptions])

  const resetSelectionFields = {
    settlementMode: 'full_payment' as const,
    agreedPrice: null,
    inventoryPrice: null,
  }

  const setSourceMode = (sourceMode: RealEstateRequestSourceMode) => {
    if (!allowedSourceModes.has(sourceMode)) return
    setCustomPriceOpen(false)
    onChange({
      sourceMode,
      estateId: 0,
      selectedId: null,
      ...resetSelectionFields,
    })
  }

  useEffect(() => {
    if (allowedSourceModes.has(context.sourceMode)) return
    const nextMode = allowedSourceModes.values().next().value
    if (!nextMode) return
    queueMicrotask(() => setSourceMode(nextMode))
    // Keep selected inventory source aligned with the selected service.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.sourceMode, service.id])

  if (!canListEstates && !canListProperties && !canListBrokerage) {
    return (
      <div className="commercial-form-note commercial-form-note-warning">
        You do not have permission to browse real estate inventory for this specialized service
        flow.
      </div>
    )
  }

  return (
    <>
      <div className="commercial-field commercial-field--full">
        <span>Inventory source</span>
        <div
          className="commercial-tabs commercial-tabs--form"
          role="group"
          aria-label="Inventory source"
        >
          {sourceModeOptions.map((option) => {
            const disabled =
              !allowedSourceModes.has(option.mode) ||
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
        {realEstateRequestContext(service) === 'property_brokerage' ? (
          <small className="commercial-form-note">
            Property brokerage uses verified unlinked brokerage listings.
          </small>
        ) : null}
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
              setCustomPriceOpen(false)
              const estateId = Number(nextValue)
              onChange({
                ...context,
                estateId,
                selectedId: null,
                ...resetSelectionFields,
              })
            }}
          />

          <DropdownSelect
            label="Property"
            required
            searchable
            disabled={!context.estateId || !canListProperties}
            loading={propertiesQuery.isPending}
            placeholder={
              !context.estateId
                ? 'Choose an estate first'
                : propertiesQuery.isPending
                  ? 'Loading properties...'
                  : 'Select a property'
            }
            searchPlaceholder="Search properties..."
            options={[
              ...mapDropdownOptions(
                estateProperties.map((property) => ({
                  value: property.id,
                  label: property.propertyName,
                  description:
                    property.plotNumber != null
                      ? `Plot ${property.plotNumber} · ${formatCurrency(resolvePropertyInventoryPrice(property, selectedEstate?.pricePerSqm))}`
                      : `${property.propertyType} · ${formatCurrency(resolvePropertyInventoryPrice(property, selectedEstate?.pricePerSqm))}`,
                })),
              ),
            ]}
            value={String(context.selectedId ?? 0)}
            onChange={(nextValue) => {
              setCustomPriceOpen(false)
              const selectedId = Number(nextValue)
              const property = estateProperties.find((item) => item.id === selectedId)
              const nextInventory = resolvePropertyInventoryPrice(
                property,
                selectedEstate?.pricePerSqm,
              )
              onChange({
                ...context,
                selectedId: selectedId > 0 ? selectedId : null,
                agreedPrice: null,
                inventoryPrice: nextInventory > 0 ? nextInventory : null,
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
              description: `${property.propertyTypeDisplay || property.propertyType} · ${formatCurrency(resolvePropertyInventoryPrice(property))}`,
            })),
          )}
          value={String(context.selectedId ?? 0)}
          onChange={(nextValue) => {
            setCustomPriceOpen(false)
            const selectedId = Number(nextValue)
            const property = standaloneProperties.find((item) => item.id === selectedId)
            const nextInventory = resolvePropertyInventoryPrice(property)
            onChange({
              ...context,
              selectedId: selectedId > 0 ? selectedId : null,
              agreedPrice: null,
              inventoryPrice: nextInventory > 0 ? nextInventory : null,
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
              description: `${listing.location} · ${formatCurrency(resolveBrokerageInventoryPrice(listing))}`,
            })),
          )}
          value={String(context.selectedId ?? 0)}
          onChange={(nextValue) => {
            setCustomPriceOpen(false)
            const selectedId = Number(nextValue)
            const listing = unlinkedBrokerage.find((item) => item.id === selectedId)
            const nextInventory = resolveBrokerageInventoryPrice(listing)
            onChange({
              ...context,
              selectedId: selectedId > 0 ? selectedId : null,
              agreedPrice: null,
              inventoryPrice: nextInventory > 0 ? nextInventory : null,
            })
          }}
        />
      ) : null}

      {context.selectedId ? (
        <div className="commercial-field commercial-field--full">
          <span>Payment method</span>
          <div
            className="commercial-payment-method-list"
            role="radiogroup"
            aria-label="Payment method"
          >
            {paymentPlanOptions.map((option) => {
              const selected = context.settlementMode === option.mode
              return (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={
                    selected
                      ? 'commercial-payment-method-row is-selected'
                      : 'commercial-payment-method-row'
                  }
                  onClick={() =>
                    onChange({
                      ...context,
                      settlementMode: option.mode,
                    })
                  }
                >
                  <span className="commercial-payment-method-radio" aria-hidden="true" />
                  <span className="commercial-payment-method-copy">
                    <b>{option.label}</b>
                    <small>{option.meta}</small>
                  </span>
                  <strong className="commercial-payment-method-due">
                    {option.dueAmount != null && option.dueAmount > 0
                      ? formatCurrency(option.dueAmount)
                      : '—'}
                  </strong>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {context.selectedId ? (
        <div className="commercial-field commercial-field--full">
          <span>Price</span>
          <div className="commercial-price-panel">
            <div className="commercial-price-panel-header">
              <div className="commercial-price-panel-main">
                <div className="commercial-price-panel-label">
                  {customPriceOpen ? 'Adjusted price' : 'Listed price'}
                </div>
                <div className="commercial-price-panel-value">{formatCurrency(displayPrice)}</div>
                {priceSourceLabel ? (
                  <div className="commercial-price-panel-note">{priceSourceLabel}</div>
                ) : null}
              </div>
              {!customPriceOpen ? (
                <button
                  type="button"
                  className="commercial-btn commercial-btn-small"
                  onClick={() => {
                    setCustomPriceOpen(true)
                    onChange({
                      ...context,
                      agreedPrice: inventoryPrice > 0 ? inventoryPrice : null,
                      inventoryPrice: inventoryPrice > 0 ? inventoryPrice : null,
                    })
                  }}
                >
                  Adjust price
                </button>
              ) : null}
            </div>

            {customPriceOpen ? (
              <div className="commercial-price-panel-edit">
                <label className="commercial-price-panel-input">
                  <span>Sale price</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={
                      inventoryPrice > 0 ? formatGroupedNumberFieldValue(inventoryPrice) : '0'
                    }
                    value={formatGroupedNumberFieldValue(context.agreedPrice)}
                    onChange={(event) => {
                      const next = parseGroupedNumberFieldValue(event.target.value)
                      onChange({
                        ...context,
                        agreedPrice: next > 0 ? next : null,
                        inventoryPrice: inventoryPrice > 0 ? inventoryPrice : null,
                      })
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="commercial-btn commercial-btn-small"
                  onClick={() => {
                    setCustomPriceOpen(false)
                    onChange({
                      ...context,
                      agreedPrice: null,
                      inventoryPrice: inventoryPrice > 0 ? inventoryPrice : null,
                    })
                  }}
                >
                  Use listed price
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {brokerageQuery.isError || standaloneQuery.isError || estatesQuery.isError ? (
        <div className="commercial-field commercial-field--full">
          <small className="commercial-field-error">
            Real estate inventory could not be loaded.
          </small>
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

      {context.sourceMode === 'brokerage' &&
      !brokerageQuery.isPending &&
      unlinkedBrokerage.length === 0 ? (
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
