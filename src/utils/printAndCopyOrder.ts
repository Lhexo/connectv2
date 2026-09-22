// Utility to reliably copy and print order summaries, optimized for iframe environments
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { calculateTaxable, calculateLineTotals, calculateOrderTotals, parseVatRate } from './priceUtils';

export interface PrintableOrderData {
  orderNumber?: string | number;
  date?: string;
  status?: string;
  clientName?: string;
  clientCode?: string;
  clientAddress?: string;
  clientCity?: string;
  clientProvince?: string;
  clientVat?: string;
  clientFiscalCode?: string;
  clientPhone?: string;
  clientEmail?: string;
  agentName?: string;
  paymentName?: string;
  paymentBank?: string;
  notes?: string;
  items: {
    code?: string;
    description?: string;
    qty: number;
    price: number; // Gross price (Prezzo Ivato)
    taxablePrice?: number; // Prezzo Imponibile scorporato al volo
    vatRate?: number; // Aliquota IVA (es. 22)
    taxableTotal?: number; // Totale Imponibile riga
    total?: number; // Totale Ivato riga
    um?: string;
  }[];
  taxableTotal?: number; // Totale Imponibile complessivo ordine
  vatTotal?: number; // Totale IVA complessivo ordine
  total: number; // Totale Ordine Ivato
}

/**
 * Builds a normalized PrintableOrderData object from any raw Order, XML Document, or cart snapshot
 */
export function buildPrintableFromOrder(order: any, client?: any): PrintableOrderData {
  if (!order) {
    return { items: [], total: 0 };
  }

  // Extract client details with thorough fallbacks (camelCase, snake_case, PascalCase, or client object)
  const clientName = (
    order.clientName || 
    order.client_name || 
    order.CustomerName || 
    order.customer_name || 
    client?.name || 
    client?.ragione_sociale || 
    'Cliente'
  ).toString().trim();

  const clientCode = (
    order.clientCode || 
    order.client_code || 
    order.CustomerCode || 
    client?.code || 
    ''
  ).toString().trim();

  const clientAddress = (
    order.clientAddress || 
    order.client_address || 
    order.CustomerAddress || 
    client?.address || 
    ''
  ).toString().trim();

  const clientCity = (
    order.clientCity || 
    order.client_city || 
    order.CustomerCity || 
    client?.city || 
    ''
  ).toString().trim();

  const clientProvince = (
    order.clientProvince || 
    order.client_province || 
    order.CustomerProvince || 
    client?.province || 
    ''
  ).toString().trim();

  const clientVat = (
    order.clientVat || 
    order.client_vat || 
    order.CustomerVatCode || 
    client?.vat_code || 
    client?.fiscal_code || 
    ''
  ).toString().trim();

  const clientFiscalCode = (
    order.clientFiscalCode || 
    order.client_fiscal_code || 
    order.CustomerFiscalCode || 
    client?.fiscal_code || 
    ''
  ).toString().trim();

  const clientPhone = (
    order.clientPhone || 
    order.client_phone || 
    order.CustomerTel || 
    order.CustomerCellPhone || 
    client?.cell_phone || 
    client?.phone || 
    ''
  ).toString().trim();

  const clientEmail = (
    order.clientEmail || 
    order.client_email || 
    order.CustomerEmail || 
    client?.email || 
    ''
  ).toString().trim();

  const agentName = (
    order.agentName || 
    order.agent_name || 
    order.SalesAgent || 
    client?.agente || 
    ''
  ).toString().trim();

  const paymentName = (
    order.paymentName || 
    order.payment_name || 
    order.PaymentName || 
    client?.payment_name || 
    ''
  ).toString().trim();

  const paymentBank = (
    order.paymentBank || 
    order.payment_bank || 
    order.PaymentBank || 
    client?.payment_bank || 
    ''
  ).toString().trim();

  const notes = (
    order.notes || 
    order.internal_comment || 
    order.InternalComment || 
    ''
  ).toString().trim();

  const orderNumber = (
    order.orderNumber || 
    order.formatted_number || 
    order.number || 
    order.Number || 
    (order.id ? `#${order.id}` : 'Bozza')
  );

  const date = (
    order.date || 
    order.Date || 
    (order.created_at ? String(order.created_at).split('T')[0] : new Date().toISOString().split('T')[0])
  );

  const status = (order.status || 'Confermato').toString();

  // Extract raw items from all possible structures
  let rawItems: any[] = [];
  if (Array.isArray(order.items)) {
    rawItems = order.items;
  } else if (Array.isArray(order.rows)) {
    rawItems = order.rows;
  } else if (order.Rows?.Row) {
    rawItems = Array.isArray(order.Rows.Row) ? order.Rows.Row : [order.Rows.Row];
  } else if (typeof order.items === 'string') {
    try {
      rawItems = JSON.parse(order.items);
    } catch {
      rawItems = [];
    }
  }

  const items = rawItems.map((it: any) => {
    const code = String(it.code || it.product_code || it.item_code || it.Code || it.productCode || '').trim();
    const description = String(it.description || it.product_description || it.name || it.Description || 'Articolo').trim();
    const qty = Number(it.qty ?? it.quantity ?? it.Qty ?? 1) || 1;
    const price = Number(it.price ?? it.unit_price ?? it.Price ?? 0) || 0;
    const vatRate = parseVatRate(it.vatRate ?? it.vat_rate ?? it.vat_code ?? it.vatCode ?? it.VatCode ?? it.vat ?? 22, 22);

    // Apply calculateTaxable & calculateLineTotals al volo
    const lineTotals = calculateLineTotals(qty, price, vatRate);
    const itemTotal = it.total !== undefined && it.total !== null ? Number(it.total) : lineTotals.totalGross;
    const um = String(it.um || it.Um || 'pz').trim();

    return {
      code,
      description,
      qty,
      price, // Gross price (Ivato)
      taxablePrice: it.taxablePrice !== undefined ? Number(it.taxablePrice) : lineTotals.unitTaxable,
      vatRate: lineTotals.vatRate,
      taxableTotal: it.taxableTotal !== undefined ? Number(it.taxableTotal) : lineTotals.totalTaxable,
      total: itemTotal,
      um
    };
  });

  const orderTotals = calculateOrderTotals(items.map(it => ({
    qty: it.qty,
    price: it.price,
    vatRate: it.vatRate
  })));

  const total = Number(order.total ?? order.Total) || orderTotals.totalGross;
  const taxableTotal = order.taxableTotal !== undefined ? Number(order.taxableTotal) : orderTotals.totalTaxable;
  const vatTotal = order.vatTotal !== undefined ? Number(order.vatTotal) : orderTotals.totalVat;

  return {
    orderNumber,
    date,
    status,
    clientName,
    clientCode,
    clientAddress,
    clientCity,
    clientProvince,
    clientVat,
    clientFiscalCode,
    clientPhone,
    clientEmail,
    agentName,
    paymentName,
    paymentBank,
    notes,
    items,
    taxableTotal,
    vatTotal,
    total
  };
}

/**
 * Generates clean formatted text for clipboard copying (ideal for WhatsApp, Email, or CRM)
 */
export function formatOrderPlainText(orderOrData: any, client?: any): string {
  const order = buildPrintableFromOrder(orderOrData, client);
  const lines: string[] = [];

  lines.push('========================================');
  lines.push(`CONNECT BEAUTY S.R.L. - RIEPILOGO ORDINE`);
  lines.push(`Ordine N: ${order.orderNumber}`);
  lines.push(`Data: ${order.date}`);
  lines.push(`Stato: ${order.status}`);
  if (order.agentName) {
    lines.push(`Commerciale / Agente: ${order.agentName}`);
  }
  lines.push('========================================');
  lines.push('');
  lines.push('--- DATI CLIENTE ---');
  lines.push(`Cliente: ${order.clientName}`);
  if (order.clientCode) lines.push(`Codice Cliente: ${order.clientCode}`);
  if (order.clientVat) lines.push(`P.IVA: ${order.clientVat}`);
  if (order.clientFiscalCode && order.clientFiscalCode !== order.clientVat) {
    lines.push(`Codice Fiscale: ${order.clientFiscalCode}`);
  }
  const addressParts = [order.clientAddress, order.clientCity, order.clientProvince].filter(Boolean);
  if (addressParts.length > 0) {
    lines.push(`Indirizzo: ${addressParts.join(', ')}`);
  }
  if (order.clientPhone) lines.push(`Telefono: ${order.clientPhone}`);
  if (order.clientEmail) lines.push(`Email: ${order.clientEmail}`);
  lines.push('');

  if (order.paymentName || order.paymentBank) {
    lines.push('--- CONDIZIONI COMMERCIALI ---');
    if (order.paymentName) lines.push(`Pagamento: ${order.paymentName}`);
    if (order.paymentBank) lines.push(`Banca d'appoggio: ${order.paymentBank}`);
    lines.push('');
  }

  if (order.notes) {
    lines.push('--- NOTE ORDINE ---');
    lines.push(order.notes);
    lines.push('');
  }

  lines.push('--- ARTICOLI ORDINATI ---');
  if (order.items && order.items.length > 0) {
    order.items.forEach((item, index) => {
      const unitTaxable = item.taxablePrice !== undefined ? item.taxablePrice : calculateTaxable(item.price, item.vatRate || 22);
      const rowTaxable = item.taxableTotal !== undefined ? item.taxableTotal : Math.round(Number(item.qty || 0) * unitTaxable * 100) / 100;
      const rowGross = item.total !== undefined ? item.total : (Number(item.qty || 0) * Number(item.price || 0));
      const vatRate = item.vatRate !== undefined ? item.vatRate : 22;
      const codePart = item.code ? `[${item.code}] ` : '';
      const umPart = item.um ? ` ${item.um}` : ' pz';

      lines.push(`${index + 1}. ${codePart}${item.description}`);
      lines.push(`   Quantità: ${item.qty}${umPart} | Imp. Unit: € ${unitTaxable.toFixed(2)} (IVA ${vatRate}%)`);
      lines.push(`   Totale Riga Imp: € ${rowTaxable.toFixed(2)}`);
    });
  } else {
    lines.push('(Nessun articolo registrato)');
  }

  lines.push('----------------------------------------');
  if (order.taxableTotal !== undefined && order.vatTotal !== undefined) {
    lines.push(`Totale Imponibile: € ${order.taxableTotal.toFixed(2)}`);
    lines.push(`Totale IVA:        € ${order.vatTotal.toFixed(2)}`);
  }
  lines.push(`TOTALE ORDINE (Ivato): € ${order.total.toFixed(2)}`);
  lines.push('========================================');
  lines.push('Connect Beauty S.r.l. - Via dell\'Innovazione 12, Milano - ordini@connectbeauty.it');

  return lines.join('\n');
}

/**
 * Copies plain text to clipboard with multiple reliable fallbacks
 */
export async function copyOrderToClipboard(orderOrData: any, client?: any): Promise<boolean> {
  const text = formatOrderPlainText(orderOrData, client);

  // Fallback helper using textarea
  const copyViaTextarea = (str: string): boolean => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = str;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (err) {
      console.error('Fallback execCommand copy error:', err);
      return false;
    }
  };

  try {
    if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return copyViaTextarea(text);
  } catch (clipErr) {
    console.warn('navigator.clipboard failed, falling back to textarea execCommand:', clipErr);
    return copyViaTextarea(text);
  }
}

/**
 * Builds the complete A4 printable HTML layout
 */
export function buildOrderDocumentHtml(printable: PrintableOrderData): string {
  const company = {
    name: 'Connect Beauty S.r.l.',
    address: 'Via dell\'Innovazione 12',
    postcode: '20126',
    city: 'Milano',
    province: 'MI',
    vat: 'IT12345678901',
    phone: '+39 02 87654321',
    email: 'ordini@connectbeauty.it',
    web: 'www.connectbeauty.it'
  };

  const rowsHtml = printable.items.map((it: any, idx) => {
    const unitTaxable = it.taxablePrice !== undefined ? it.taxablePrice : calculateTaxable(it.price, it.vatRate || 22);
    const rowTaxable = it.taxableTotal !== undefined ? it.taxableTotal : Math.round(Number(it.qty || 0) * unitTaxable * 100) / 100;
    const rowGross = it.total !== undefined ? it.total : (Number(it.qty || 0) * Number(it.price || 0));
    const vatRate = it.vatRate !== undefined ? it.vatRate : 22;

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="padding: 9px 8px; font-family: monospace; font-size: 11px; color: #475569;">${it.code || '-'}</td>
        <td style="padding: 9px 8px; font-size: 12px; font-weight: 500; color: #0f172a;">${it.description}</td>
        <td style="padding: 9px 8px; text-align: center; font-size: 12px; color: #334155;">${it.qty} ${it.um || 'pz'}</td>
        <td style="padding: 9px 8px; text-align: right; font-size: 12px; font-family: monospace; color: #334155;">€ ${unitTaxable.toFixed(2)}</td>
        <td style="padding: 9px 8px; text-align: center; font-size: 11px; color: #64748b;">${vatRate}%</td>
        <td style="padding: 9px 8px; text-align: right; font-size: 12px; font-family: monospace; color: #334155;">€ ${rowTaxable.toFixed(2)}</td>
        <td style="padding: 9px 8px; text-align: right; font-weight: 700; font-size: 12px; font-family: monospace; color: #0f172a;">€ ${rowGross.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="utf-8">
        <title>Ordine ${printable.orderNumber || ''} - ${printable.clientName || 'Cliente'}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm 14mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 13px;
            line-height: 1.4;
            padding: 16px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .company-title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #0f172a;
            text-transform: uppercase;
          }
          .doc-badge {
            background: #0f172a;
            color: #ffffff;
            padding: 6px 14px;
            border-radius: 6px;
            text-align: right;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
          }
          .card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 14px;
            background: #ffffff;
          }
          .card-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          th {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            padding: 8px;
            text-align: left;
          }
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
          }
          .totals-table {
            width: 280px;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 6px 10px;
          }
          .totals-table tr.grand-total {
            border-top: 2px solid #0f172a;
            font-size: 16px;
            font-weight: 800;
            background-color: #f1f5f9;
          }
          .footer-box {
            border-top: 1px solid #cbd5e1;
            padding-top: 12px;
            margin-top: 24px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #64748b;
          }
          .sign-box {
            margin-top: 24px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
          }
          .sign-line {
            border-top: 1px dashed #94a3b8;
            padding-top: 6px;
            font-size: 11px;
            color: #64748b;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <div class="company-title">${company.name}</div>
            <div style="color: #475569; margin-top: 4px; font-size: 12px;">
              ${company.address} - ${company.postcode} ${company.city} (${company.province})<br>
              P.IVA: ${company.vat} | Tel: ${company.phone} | Email: ${company.email}
            </div>
          </div>
          <div class="doc-badge">
            <div style="font-size: 11px; opacity: 0.8; text-transform: uppercase;">Conferma d'Ordine</div>
            <div style="font-size: 18px; font-weight: 800;">${printable.orderNumber || ''}</div>
            <div style="font-size: 11px; margin-top: 2px;">Data: ${printable.date || ''}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-title">Intestatario Documento</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
              ${printable.clientName || 'Cliente'}
            </div>
            ${printable.clientCode ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Codice Cliente: <strong>${printable.clientCode}</strong></div>` : ''}
            ${printable.clientAddress ? `<div style="font-size: 12px; color: #334155;">${printable.clientAddress}</div>` : ''}
            ${(printable.clientCity || printable.clientProvince) ? `<div style="font-size: 12px; color: #334155;">${printable.clientCity} (${printable.clientProvince})</div>` : ''}
            <div style="margin-top: 6px; font-size: 11px; color: #475569;">
              ${printable.clientVat ? `P.IVA: <strong>${printable.clientVat}</strong> ` : ''}
              ${printable.clientFiscalCode && printable.clientFiscalCode !== printable.clientVat ? `| C.F.: <strong>${printable.clientFiscalCode}</strong>` : ''}
            </div>
            ${printable.clientPhone ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Tel: ${printable.clientPhone}</div>` : ''}
            ${printable.clientEmail ? `<div style="font-size: 11px; color: #475569;">Email: ${printable.clientEmail}</div>` : ''}
          </div>

          <div class="card">
            <div class="card-title">Dati Commerciali e Spedizione</div>
            ${printable.agentName ? `<div style="margin-bottom: 4px;"><strong>Agente:</strong> ${printable.agentName}</div>` : ''}
            ${printable.paymentName ? `<div style="margin-bottom: 4px;"><strong>Pagamento:</strong> ${printable.paymentName}</div>` : ''}
            ${printable.paymentBank ? `<div style="margin-bottom: 4px; font-size: 11px;"><strong>Banca:</strong> ${printable.paymentBank}</div>` : ''}
            <div style="margin-bottom: 4px;"><strong>Stato Ordine:</strong> <span style="display: inline-block; padding: 2px 8px; background: #e2e8f0; border-radius: 4px; font-weight: 600; font-size: 11px;">${printable.status}</span></div>
            ${printable.notes ? `<div style="margin-top: 6px; font-size: 11px; background: #fffbeb; padding: 6px; border-radius: 4px; border: 1px solid #fef3c7; color: #92400e;"><strong>Note:</strong> ${printable.notes}</div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 11%;">Codice</th>
              <th>Descrizione Articolo</th>
              <th style="width: 9%; text-align: center;">Quantità</th>
              <th style="width: 14%; text-align: right;">Prezzo Imp.</th>
              <th style="width: 8%; text-align: center;">IVA %</th>
              <th style="width: 14%; text-align: right;">Tot. Imponibile</th>
              <th style="width: 15%; text-align: right;">Totale Ivato</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 16px; color: #64748b;">Nessun articolo presente</td></tr>'}
          </tbody>
        </table>

        <div class="totals-wrap">
          <table class="totals-table">
            <tr>
              <td style="color: #64748b; font-size: 12px;">Totale Imponibile:</td>
              <td style="text-align: right; font-weight: 600; font-family: monospace;">€ ${printable.taxableTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 12px;">Totale IVA:</td>
              <td style="text-align: right; font-weight: 600; font-family: monospace;">€ ${printable.vatTotal.toFixed(2)}</td>
            </tr>
            <tr class="grand-total">
              <td>TOTALE ORDINE (Ivato):</td>
              <td style="text-align: right; color: #0f172a; font-family: monospace;">€ ${printable.total.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="sign-box">
          <div>
            <div class="sign-line">Firma Agente Commerciale</div>
          </div>
          <div>
            <div class="sign-line">Timbro e Firma per Accettazione Cliente</div>
          </div>
        </div>

        <div class="footer-box">
          <div>Documento generato da Connect Beauty B2B Portal & Easyfatt-Xml</div>
          <div>Pagina 1 di 1</div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Directly renders and downloads a crisp A4 PDF document
 */
export async function downloadOrderPdf(orderOrData: any, client?: any): Promise<boolean> {
  const printable = buildPrintableFromOrder(orderOrData, client);
  const html = buildOrderDocumentHtml(printable);

  try {
    // Create an off-screen render container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px'; // Standard A4 width in px at 96 DPI
    container.style.backgroundColor = '#ffffff';
    container.style.zIndex = '-999';
    container.innerHTML = html;
    document.body.appendChild(container);

    // Wait for fonts/layout to settle
    await new Promise((r) => setTimeout(r, 100));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    // Clean safe filename
    const safeOrderNum = String(printable.orderNumber || 'bozza').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeClient = String(printable.clientName || 'cliente').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);
    pdf.save(`Ordine_${safeOrderNum}_${safeClient}.pdf`);
    return true;
  } catch (err) {
    console.error('downloadOrderPdf failed:', err);
    return false;
  }
}

/**
 * Universal print method: builds iframe, triggers print, and gracefully falls back to PDF if blocked
 */
export async function printOrderDocument(orderOrData: any, client?: any): Promise<void> {
  const printable = buildPrintableFromOrder(orderOrData, client);
  const html = buildOrderDocumentHtml(printable);

  let printSuccess = false;

  // Attempt hidden iframe print with full standard printable dimension
  try {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '0';
    printFrame.style.width = '1024px';
    printFrame.style.height = '1400px';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0';
    printFrame.style.pointerEvents = 'none';
    printFrame.style.zIndex = '-999';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      await new Promise((resolve) => setTimeout(resolve, 350));

      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        printSuccess = true;
      } catch (printErr) {
        console.warn('iframe print() execution blocked by sandbox permissions:', printErr);
      } finally {
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 3000);
      }
    }
  } catch (frameErr) {
    console.warn('Iframe injection error:', frameErr);
  }

  // If iframe print succeeded, we're done
  if (printSuccess) {
    return;
  }

  // Fallback 1: Window open
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (win) {
      win.focus();
      setTimeout(() => {
        try { win.print(); } catch {}
      }, 500);
      return;
    }
  } catch {}

  // Fallback 2: Automatic PDF download so the user ALWAYS gets their printed/printable order!
  console.log('Falling back to high-res PDF generation and download...');
  await downloadOrderPdf(printable);
}
