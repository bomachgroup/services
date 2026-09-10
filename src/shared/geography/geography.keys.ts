export const geographyKeys = {
  root: ['geography', 'v1'] as const,
  nigeriaStates: () => [...geographyKeys.root, 'nigeria', 'states'] as const,
  nigeriaLgas: (state: string) => [...geographyKeys.root, 'nigeria', 'lgas', state] as const,
  nigeriaCities: (state: string, lga: string) =>
    [...geographyKeys.root, 'nigeria', 'cities', state, lga] as const,
}
