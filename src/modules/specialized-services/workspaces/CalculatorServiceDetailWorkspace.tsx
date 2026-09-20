import { IconArrowRight, IconCalculator, IconFilePlus, IconX } from '@tabler/icons-react'

import type { ServiceRequestListItem } from '@/modules/commercial/api/service-requests.types'
import type { ServiceCatalogueItem } from '@/modules/service-administration/types/service-administration.types'
import type { ServiceOrder } from '@/modules/fulfillment/service-orders/service-order.types'
import { CompactActionButton } from '@/shared/ui/module-controls'

interface CalculatorServiceDetailWorkspaceProps {
  detail: ServiceCatalogueItem
  requests: ServiceRequestListItem[]
  orders: ServiceOrder[]
  canRequests: boolean
  canOrders: boolean
  canCreateRequest: boolean
  requestsLoading: boolean
  ordersLoading: boolean
  onClose: () => void
  onCreateRequest: () => void
  onOpenRequests: () => void
  onOpenOrders: () => void
  onOpenRequest: (id: number) => void
  onOpenOrder: (id: number) => void
}

function statusClass(status: string) {
  if (status === 'completed' || status === 'converted' || status === 'quoted') {
    return 'commercial-pill-green'
  }
  if (status === 'awaiting_client' || status === 'quality_review' || status === 'site_assessment') {
    return 'commercial-pill-yellow'
  }
  if (status === 'rejected' || status === 'cancelled' || status === 'on_hold') {
    return 'commercial-pill-gray'
  }
  return 'commercial-pill-blue'
}

export function CalculatorServiceDetailWorkspace({
  detail,
  requests,
  orders,
  canRequests,
  canOrders,
  canCreateRequest,
  requestsLoading,
  ordersLoading,
  onClose,
  onCreateRequest,
  onOpenRequests,
  onOpenOrders,
  onOpenRequest,
  onOpenOrder,
}: CalculatorServiceDetailWorkspaceProps) {
  const variables = detail.activeCalculator?.variables ?? []
  const charges = detail.activeCalculator?.charges ?? []
  const stages = detail.activeWorkflow?.stages ?? []
  const calculatorName = detail.calculatorName || detail.activeCalculator?.name || 'Attached'
  const requestFormName = detail.requestFormName || detail.activeRequestForm?.name

  return (
    <div className="commercial-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="commercial-modal commercial-modal--xl specialized-calculator-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calculator-service-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div>
            <h2 id="calculator-service-detail-title">{detail.name}</h2>
            <p>
              {detail.code || 'No service code'} ·{' '}
              {detail.specializedDomain || 'Specialized service'} · Calculator-backed pricing
            </p>
          </div>
          <div className="commercial-modal-header-meta">
            <span className="commercial-pill commercial-pill-blue">{detail.readiness}% ready</span>
            <button
              type="button"
              className="commercial-modal-close"
              aria-label="Close details"
              onClick={onClose}
            >
              <IconX size={17} />
            </button>
          </div>
        </header>

        <div className="commercial-modal-body specialized-calculator-detail-body">
          <section className="specialized-calculator-detail-hero">
            <span className="specialized-calculator-detail-hero-icon" aria-hidden="true">
              <IconCalculator size={24} stroke={1.8} />
            </span>
            <div>
              <span className="specialized-calculator-card-label">Calculator service</span>
              <h3>{calculatorName}</h3>
              <p>{detail.description || 'No service description configured.'}</p>
            </div>
            <div className="specialized-calculator-detail-hero-stat">
              <span>Request readiness</span>
              <strong>
                {detail.requestFormName || detail.activeRequestForm ? 'Ready' : 'Needs setup'}
              </strong>
            </div>
          </section>

          <div className="specialized-calculator-detail-summary">
            <div>
              <span>Request form</span>
              <b>{requestFormName || 'Not configured'}</b>
            </div>
            <div>
              <span>Pricing model</span>
              <b>{detail.activeCalculator?.pricingType || 'Server-managed'}</b>
            </div>
            <div>
              <span>Default SLA</span>
              <b>{detail.slaDays ?? 0} days</b>
            </div>
            <div>
              <span>Branches</span>
              <b>{detail.branchNames.length}</b>
            </div>
          </div>

          <div className="specialized-calculator-detail-grid">
            <section className="specialized-detail-panel">
              <header className="specialized-detail-panel-header">
                <div>
                  <h3>Calculator setup</h3>
                  <p>Inputs and charges used to prepare the service estimate.</p>
                </div>
              </header>
              {variables.length ? (
                <div className="specialized-calculator-variable-list">
                  {variables.map((variable) => (
                    <div key={variable.id}>
                      <span>{variable.label}</span>
                      <b>
                        {variable.type}
                        {variable.unit ? ` · ${variable.unit}` : ''}
                      </b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="specialized-detail-muted">No calculator inputs configured.</div>
              )}
              <div className="specialized-calculator-detail-subsection">
                <span className="specialized-detail-section-label">Charges</span>
                {charges.length ? (
                  <div className="specialized-calculator-variable-list">
                    {charges.map((charge) => (
                      <div key={charge.id}>
                        <span>{charge.label}</span>
                        <b>
                          {charge.kind} · {String(charge.value)}
                        </b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="specialized-detail-muted">No additional charges configured.</div>
                )}
              </div>
            </section>

            <aside className="specialized-detail-panel">
              <header className="specialized-detail-panel-header">
                <div>
                  <h3>Request setup</h3>
                  <p>Configuration used when staff creates a request.</p>
                </div>
              </header>
              <dl className="specialized-calculator-detail-facts">
                <div>
                  <dt>Owner</dt>
                  <dd>{detail.owner || 'Unassigned'}</dd>
                </div>
                <div>
                  <dt>Fulfilment mode</dt>
                  <dd>{detail.fulfilmentMode || 'Not configured'}</dd>
                </div>
                <div>
                  <dt>Workflow</dt>
                  <dd>{detail.workflowName || detail.activeWorkflow?.name || 'Not configured'}</dd>
                </div>
                <div>
                  <dt>Branches</dt>
                  <dd>
                    {detail.branchNames.length ? detail.branchNames.join(', ') : 'None configured'}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>

          <section className="specialized-detail-panel">
            <header className="specialized-detail-panel-header">
              <div>
                <h3>Workflow</h3>
                <p>Operational stages applied after a request is created.</p>
              </div>
            </header>
            {stages.length ? (
              <div className="specialized-calculator-workflow-list">
                {stages.map((stage, index) => (
                  <div key={stage.id}>
                    <span className="specialized-calculator-workflow-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <b>{stage.name}</b>
                      <small>
                        {stage.ownerRole || 'Unassigned role'} · {Math.round(stage.slaHours / 24)}d
                        SLA
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="specialized-detail-muted">No active workflow configured.</div>
            )}
          </section>

          <div className="specialized-calculator-live-grid">
            <section className="specialized-detail-panel">
              <header className="specialized-detail-panel-header">
                <div>
                  <h3>Live service requests</h3>
                  <p>Recent requests created for this calculator service.</p>
                </div>
                <CompactActionButton
                  disabled={!canRequests}
                  locked={!canRequests}
                  onClick={onOpenRequests}
                >
                  Open Requests
                  <IconArrowRight size={13} />
                </CompactActionButton>
              </header>
              {!canRequests ? (
                <div className="specialized-detail-muted">Service Request access not granted.</div>
              ) : requestsLoading ? (
                <div className="specialized-detail-muted">Loading service requests...</div>
              ) : requests.length ? (
                <div className="specialized-table-wrap specialized-table-wrap--detail">
                  <table className="specialized-table">
                    <thead>
                      <tr>
                        <th>Request</th>
                        <th>Client</th>
                        <th>Status</th>
                        <th>Owner</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((request) => (
                        <tr key={request.id}>
                          <td>
                            <b>{request.requestNumber}</b>
                          </td>
                          <td>{request.clientName}</td>
                          <td>
                            <span className={`commercial-pill ${statusClass(request.status)}`}>
                              {request.statusDisplay}
                            </span>
                          </td>
                          <td>{request.ownerName || 'Unassigned'}</td>
                          <td>
                            <button
                              type="button"
                              className="specialized-btn specialized-btn-small"
                              onClick={() => onOpenRequest(request.id)}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="specialized-detail-muted">
                  No requests have been created for this service.
                </div>
              )}
            </section>

            <section className="specialized-detail-panel">
              <header className="specialized-detail-panel-header">
                <div>
                  <h3>Live orders</h3>
                  <p>Recent orders associated with this service.</p>
                </div>
                <CompactActionButton
                  disabled={!canOrders}
                  locked={!canOrders}
                  onClick={onOpenOrders}
                >
                  Open Orders
                  <IconArrowRight size={13} />
                </CompactActionButton>
              </header>
              {!canOrders ? (
                <div className="specialized-detail-muted">Service Order access not granted.</div>
              ) : ordersLoading ? (
                <div className="specialized-detail-muted">Loading service orders...</div>
              ) : orders.length ? (
                <div className="specialized-table-wrap specialized-table-wrap--detail">
                  <table className="specialized-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Stage</th>
                        <th>Progress</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <b>{order.orderNumber}</b>
                          </td>
                          <td>{order.stage || 'Not started'}</td>
                          <td>{order.progress}%</td>
                          <td>
                            <span className={`commercial-pill ${statusClass(order.orderStatus)}`}>
                              {order.orderStatus.replaceAll('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="specialized-btn specialized-btn-small"
                              onClick={() => onOpenOrder(order.id)}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="specialized-detail-muted">
                  No orders were found in the current search window.
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="commercial-modal-footer">
          <div className="commercial-modal-footer-start">
            <span className="specialized-detail-footer-note">
              Calculator setup is managed in Service Catalogue.
            </span>
          </div>
          <div className="commercial-modal-footer-actions">
            <button type="button" className="specialized-btn" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="specialized-btn specialized-btn-primary"
              disabled={!canCreateRequest}
              onClick={onCreateRequest}
            >
              <IconFilePlus size={13} />
              Create Request
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
