import type { ServiceRequestDetail, ServiceRequestStatus } from './service-requests.types'

const POST_QUOTE_STATUSES = new Set<ServiceRequestStatus>([
  'quoted',
  'awaiting_client',
  'converted',
])

const REGRESSIVE_STATUSES = new Set<ServiceRequestStatus>([
  'new',
  'under_review',
  'site_assessment',
])

const COMMERCIAL_MILESTONES = new Set([
  'quote_accepted',
  'invoice_issued',
  'payment_confirmed',
  'payment_threshold_met',
])

function hasCommercialMilestone(request: ServiceRequestDetail) {
  return request.activities.some((activity) => COMMERCIAL_MILESTONES.has(activity.activityType))
}

function paymentThresholdMet(request: ServiceRequestDetail) {
  return request.activities.some((activity) => activity.activityType === 'payment_threshold_met')
}

export function getServiceRequestCapabilities(request: ServiceRequestDetail) {
  const terminal = request.status === 'converted' || request.status === 'rejected'
  const quotedOrBeyond = POST_QUOTE_STATUSES.has(request.status)
  const commerciallyAdvanced = quotedOrBeyond || hasCommercialMilestone(request)
  const mobilisationReady = paymentThresholdMet(request)

  return {
    canPrepareQuotation: !request.quoteId && !terminal && !commerciallyAdvanced,
    canScheduleAssessment: !terminal && !commerciallyAdvanced,
    canEditControlPanel: !terminal,
    controlPanelLocked: commerciallyAdvanced && !terminal,
    mobilisationReady,
    allowedStatuses: commerciallyAdvanced
      ? request.status === 'converted' || request.status === 'rejected'
        ? [request.status]
        : (['quoted', 'awaiting_client', 'converted'] as ServiceRequestStatus[])
      : null,
    controlPanelNotice: terminal
      ? ''
      : mobilisationReady
        ? 'Mobilisation payment received. Create the service order from the invoice, or update owner and follow-up fields here.'
        : commerciallyAdvanced
          ? 'This request has moved into quotation or billing. Status cannot be rolled back to assessment or intake stages.'
          : '',
  }
}

export function isRegressiveStatusChange(
  currentStatus: ServiceRequestStatus,
  nextStatus: ServiceRequestStatus,
) {
  return (
    currentStatus !== nextStatus &&
    POST_QUOTE_STATUSES.has(currentStatus) &&
    REGRESSIVE_STATUSES.has(nextStatus)
  )
}
