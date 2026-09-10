import type { Invoice, Payment } from './billing.types'

function formatMoney(value: number) {
  const amount = Number(value) || 0
  const hasFraction = Math.abs(amount % 1) > 0.000001
  return `₦${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB')
}

function paymentMethodLabel(method: Payment['paymentMethod']) {
  return method.replaceAll('_', ' ')
}

function buildInvoiceDocumentHtml(invoice: Invoice, payments: Payment[] = []) {
  const status = invoice.statusDisplay || invoice.status.replaceAll('_', ' ')
  const client = invoice.clientName || `Client #${invoice.clientId}`
  const itemsRows =
    invoice.items.length > 0
      ? invoice.items
          .map(
            (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.description)}</strong>
            ${
              item.paymentTimingDisplay
                ? `<div class="muted">${escapeHtml(item.paymentTimingDisplay)}</div>`
                : ''
            }
          </td>
          <td class="num">${escapeHtml(String(item.quantity))}</td>
          <td class="num">${escapeHtml(formatMoney(item.unitPrice))}</td>
          <td class="num">${escapeHtml(formatMoney(item.total))}</td>
        </tr>`,
          )
          .join('')
      : `<tr><td colspan="4" class="muted">No line items recorded.</td></tr>`

  const paymentRows =
    payments.length > 0
      ? payments
          .map(
            (payment) => `
        <tr>
          <td>${escapeHtml(payment.paymentReference || `Payment #${payment.id}`)}</td>
          <td>${escapeHtml(formatDate(payment.paymentDate))}</td>
          <td>${escapeHtml(paymentMethodLabel(payment.paymentMethod))}</td>
          <td class="num">${escapeHtml(formatMoney(payment.amount))}</td>
        </tr>`,
          )
          .join('')
      : ''

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #15172d;
      --muted: #5f687a;
      --line: #d7dde8;
      --surface: #f5f7fb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      color: var(--ink);
      background: #fff;
      font: 12px/1.45 "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 2px solid var(--ink);
    }
    .brand {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .brand small {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0;
    }
    .invoice-meta {
      text-align: right;
    }
    .invoice-meta h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.04em;
    }
    .invoice-meta p {
      margin: 4px 0 0;
      color: var(--muted);
    }
    .status {
      display: inline-block;
      margin-top: 8px;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--line);
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin: 22px 0;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px 16px;
      background: #fff;
    }
    .label {
      color: var(--muted);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .card h2,
    .section-title {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 800;
    }
    .card p,
    .card div.value {
      margin: 6px 0 0;
      font-size: 13px;
      font-weight: 700;
    }
    .muted { color: var(--muted); font-weight: 500; font-size: 11px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th, td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th {
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      background: var(--surface);
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .totals {
      width: min(320px, 100%);
      margin: 18px 0 0 auto;
      border: 1px solid var(--line);
      border-radius: 10px;
      overflow: hidden;
    }
    .totals div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
    }
    .totals div:last-child { border-bottom: 0; }
    .totals .grand {
      background: var(--surface);
      font-weight: 800;
      font-size: 14px;
    }
    .notes {
      margin-top: 22px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
    }
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 10px;
    }
    @media print {
      body { padding: 0; }
      .sheet { max-width: none; }
      .card, .totals, .notes, table { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      <div>
        <div class="brand">
          Bomach
          <small>Service Operations</small>
        </div>
      </div>
      <div class="invoice-meta">
        <h1>INVOICE</h1>
        <p>${escapeHtml(invoice.invoiceNumber)}</p>
        <span class="status">${escapeHtml(status)}</span>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <h2>Bill to</h2>
        <div class="value">${escapeHtml(client)}</div>
        <p class="muted">Service: ${escapeHtml(invoice.serviceName || '—')}</p>
        ${
          invoice.serviceRequestNumber
            ? `<p class="muted">Request: ${escapeHtml(invoice.serviceRequestNumber)}</p>`
            : ''
        }
        ${
          invoice.quoteNumber
            ? `<p class="muted">Quote: ${escapeHtml(invoice.quoteNumber)}</p>`
            : ''
        }
      </div>
      <div class="card">
        <h2>Invoice details</h2>
        <p><span class="label">Issue date</span><br />${escapeHtml(formatDate(invoice.issueDate))}</p>
        <p><span class="label">Due date</span><br />${escapeHtml(formatDate(invoice.dueDate))}</p>
        <p><span class="label">Payment schedule</span><br />${escapeHtml(invoice.paymentSchedule || '—')}</p>
      </div>
    </div>

    <h2 class="section-title">Line items</h2>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit price</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals">
      <div><span>Subtotal</span><strong>${escapeHtml(formatMoney(invoice.subtotal))}</strong></div>
      <div><span>Tax (${escapeHtml(String(invoice.taxRate))}%)</span><strong>${escapeHtml(formatMoney(invoice.taxAmount))}</strong></div>
      <div class="grand"><span>Total</span><strong>${escapeHtml(formatMoney(invoice.totalAmount))}</strong></div>
      <div><span>Amount paid</span><strong>${escapeHtml(formatMoney(invoice.amountPaid))}</strong></div>
      <div><span>Balance due</span><strong>${escapeHtml(formatMoney(invoice.balance))}</strong></div>
    </div>

    ${
      invoice.paymentInstructions
        ? `<div class="notes"><div class="label">Payment instructions</div><p>${escapeHtml(invoice.paymentInstructions)}</p></div>`
        : ''
    }

    ${
      invoice.notes
        ? `<div class="notes"><div class="label">Notes</div><p>${escapeHtml(invoice.notes)}</p></div>`
        : ''
    }

    ${
      paymentRows
        ? `<h2 class="section-title" style="margin-top:24px">Payments received</h2>
           <table>
             <thead>
               <tr>
                 <th>Reference</th>
                 <th>Date</th>
                 <th>Method</th>
                 <th class="num">Amount</th>
               </tr>
             </thead>
             <tbody>${paymentRows}</tbody>
           </table>`
        : ''
    }

    <div class="footer">
      Generated ${escapeHtml(formatDateTime(new Date().toISOString()))} · ${escapeHtml(invoice.invoiceNumber)}
    </div>
  </div>
</body>
</html>`
}

export function printInvoiceAsPdf(invoice: Invoice, payments: Payment[] = []) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=920,height=1100')
  if (!printWindow) {
    throw new Error('Allow pop-ups to download or print this invoice as PDF.')
  }

  printWindow.document.open()
  printWindow.document.write(buildInvoiceDocumentHtml(invoice, payments))
  printWindow.document.close()
  printWindow.focus()

  const triggerPrint = () => {
    printWindow.print()
  }

  printWindow.addEventListener('afterprint', () => {
    printWindow.close()
  })

  if (printWindow.document.readyState === 'complete') {
    window.setTimeout(triggerPrint, 80)
  } else {
    printWindow.addEventListener('load', () => {
      window.setTimeout(triggerPrint, 80)
    })
  }
}
