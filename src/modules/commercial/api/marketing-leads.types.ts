export interface MarketingLeadOption {
  id: number
  fullName: string
  phone: string
  email: string
  division: string
  divisionDisplay: string
  source: string
  sourceDisplay: string
  status: string
  statusDisplay: string
  linkedClientId: number | null
  linkedClientName: string | null
}
