import { useQuery } from '@tanstack/react-query'

import { geographyQueries } from '@/shared/geography/geography.queries'
import { DropdownSelect } from '@/shared/ui/dropdown-select'

type NigeriaLocationFieldsProps = {
  state: string
  lga: string
  cityTown: string
  fallbackCityTown?: string
  onStateChange: (value: string) => void
  onLgaChange: (value: string) => void
  onCityTownChange: (value: string) => void
  onFallbackCityTownChange?: (value: string) => void
}

export function NigeriaLocationFields({
  state,
  lga,
  cityTown,
  fallbackCityTown = '',
  onStateChange,
  onLgaChange,
  onCityTownChange,
  onFallbackCityTownChange,
}: NigeriaLocationFieldsProps) {
  const statesQuery = useQuery(geographyQueries.nigeriaStates())
  const lgasQuery = useQuery(geographyQueries.nigeriaLgas(state))
  const citiesQuery = useQuery(geographyQueries.nigeriaCities(state, lga))

  const stateOptions = statesQuery.data?.items ?? []
  const lgaOptions = lgasQuery.data?.items ?? []
  const cityOptions = citiesQuery.data?.items ?? []
  const citySelectionDisabled = !state || !lga
  const useCityFallback = !citySelectionDisabled && !citiesQuery.isLoading && cityOptions.length === 0
  const locationError =
    statesQuery.isError || (Boolean(state) && lgasQuery.isError) || (Boolean(lga) && citiesQuery.isError)

  return (
    <div className="commercial-form-grid-location">
      <DropdownSelect
        label="State"
        required
        searchable
        fullWidth={false}
        loading={statesQuery.isLoading || statesQuery.isFetching}
        fieldClassName="commercial-field"
        placeholder={statesQuery.isError ? 'Failed to load states' : 'Select state'}
        options={[
          { value: '', label: 'Select state' },
          ...stateOptions.map((option) => ({ value: option, label: option })),
        ]}
        value={state}
        onChange={onStateChange}
      />

      <DropdownSelect
        label="LGA"
        required
        searchable
        fullWidth={false}
        loading={lgasQuery.isLoading || lgasQuery.isFetching}
        fieldClassName="commercial-field"
        placeholder={lgasQuery.isError ? 'Failed to load LGAs' : 'Select LGA'}
        disabled={!state}
        options={[
          { value: '', label: 'Select LGA' },
          ...lgaOptions.map((option) => ({ value: option, label: option })),
        ]}
        value={lga}
        onChange={onLgaChange}
      />

      {useCityFallback ? (
        <label className="commercial-field">
          <span>
            City / town <em>*</em>
          </span>
          <input
            value={fallbackCityTown}
            disabled={citySelectionDisabled}
            onChange={(event) => onFallbackCityTownChange?.(event.target.value)}
            placeholder="Enter city or town"
          />
        </label>
      ) : (
        <DropdownSelect
          label="City / town"
          required
          searchable
          fullWidth={false}
          loading={citiesQuery.isLoading || citiesQuery.isFetching}
          fieldClassName="commercial-field"
          placeholder={citiesQuery.isError ? 'Failed to load cities' : 'Select city / town'}
          disabled={citySelectionDisabled}
          options={[
            { value: '', label: 'Select city / town' },
            ...cityOptions.map((option) => ({ value: option, label: option })),
          ]}
          value={cityTown}
          onChange={onCityTownChange}
        />
      )}

      {locationError ? (
        <div className="commercial-field commercial-field--full">
          <div className="commercial-notice commercial-notice-red">
            Could not load location lists from the server.
            <button
              type="button"
              className="commercial-btn commercial-btn-ghost commercial-btn-compact"
              style={{ marginLeft: 8 }}
              onClick={() => {
                void statesQuery.refetch()
                if (state) void lgasQuery.refetch()
                if (state && lga) void citiesQuery.refetch()
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
