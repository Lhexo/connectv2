import { Router, Request, Response } from 'express';
import multer from 'multer';
import { XMLParser } from 'fast-xml-parser';
import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import { 
  pool, 
  queryGet, 
  queryAll, 
  queryRun,
  upsertProductsBatchInPostgres, 
  deleteProductsByCodesInPostgres,
  upsertClientsBatchInPostgres
} from '../lib/db';
import { calculateInstallments } from '../services/paymentScheduler';

const router = Router();
// Multer setup per salvare i file nella cartella uploads/ alla radice del progetto
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Se Danea invia fileName nel body (o se disponibile), preserva il nome file originale
    const rawFileName = req.body?.fileName || req.body?.filename || req.body?.FileName || file.originalname || 'image.jpg';
    const safeName = path.basename(String(rawFileName).trim());
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ==============================================================================
// HELPER: Sanitizzazione e Codifica XML & Customer Mapper
// ==============================================================================
export function escapeXml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatCap(capStr: string | null | undefined): string {
  if (!capStr) return '';
  const digitsOnly = String(capStr).trim().replace(/[^0-9]/g, '');
  return digitsOnly.length > 0 && digitsOnly.length <= 5 ? digitsOnly.padStart(5, '0') : String(capStr).trim();
}

export function formatProvince(provStr: string | null | undefined): string {
  if (!provStr) return '';
  const clean = String(provStr).trim().toUpperCase();
  return clean.length > 2 ? clean.substring(0, 2) : clean;
}

function getFieldVal(node: any, keys: string[], fallback: any = null): any {
  if (!node || typeof node !== 'object') return fallback;
  for (const k of keys) {
    if (node[k] !== undefined && node[k] !== null && String(node[k]).trim() !== '') return node[k];
  }
  return fallback;
}

export function mapDaneaCustomer(c: any) {
  const code = getFieldVal(c, ['CustomerCode', 'Code', 'code', 'CODE', 'Cod.', 'Codice', 'codice', 'InternalID', 'internal_id', 'ID', 'id']);
  const name = getFieldVal(c, ['CustomerName', 'Name', 'name', 'NAME', 'Denominazione', 'denominazione', 'RagioneSociale', 'ragione_sociale', 'Ragione Sociale', 'ragionesociale', 'CompanyName', 'company_name', 'Nominativo', 'nominativo', 'Intestazione', 'intestazione', 'Cliente', 'cliente', 'CognomeNome', 'Cognome Nome']);
  const webLogin = getFieldVal(c, ['CustomerWebLogin', 'WebLogin', 'web_login', 'Login web', 'LoginWeb', 'login_web']);
  const address = getFieldVal(c, ['CustomerAddress', 'Address', 'address', 'INDIRIZZO', 'Indirizzo', 'indirizzo', 'Via', 'via', 'Street', 'street']);
  const postcode = formatCap(getFieldVal(c, ['CustomerPostcode', 'Postcode', 'postcode', 'Cap', 'CAP', 'cap', 'Zip', 'ZIP', 'zip']));
  const city = getFieldVal(c, ['CustomerCity', 'City', 'city', 'CITY', 'Città', 'citta', 'Citta', 'Comune', 'comune']);
  const province = formatProvince(getFieldVal(c, ['CustomerProvince', 'Province', 'province', 'PROVINCIA', 'Provincia', 'provincia', 'Prov.', 'Prov', 'prov']));
  const country = getFieldVal(c, ['CustomerCountry', 'Country', 'country', 'NAZIONE', 'Nazione', 'nazione', 'Stato', 'stato']) || 'Italia';
  const fiscalCode = getFieldVal(c, ['CustomerFiscalCode', 'FiscalCode', 'fiscalcode', 'Codice fiscale', 'CodiceFiscale', 'Codice_Fiscale', 'cf', 'CF', 'FISCAL_CODE', 'fiscal_code']);
  const vatCode = getFieldVal(c, ['CustomerVatCode', 'VatCode', 'vatcode', 'P_IVA', 'Partita Iva', 'PartitaIva', 'Partita_Iva', 'piva', 'PIVA', 'VAT_CODE', 'vat_code']);
  const sdiPec = getFieldVal(c, ['CustomerEInvoiceDestCode', 'EInvoiceDestCode', 'einvoicedestcode', 'Cod. destinatario Fatt. elettr.', 'CodiceDestinatario', 'SDI', 'sdi']);
  const phone = getFieldVal(c, ['CustomerTel', 'Tel', 'tel', 'TEL', 'Telefono', 'telefono', 'Phone', 'phone']);
  const cellPhone = getFieldVal(c, ['CustomerCellPhone', 'CellPhone', 'cellphone', 'CELL', 'Cell', 'cell', 'Cellulare', 'cellulare', 'Mobile', 'mobile']);
  const fax = getFieldVal(c, ['CustomerFax', 'Fax', 'fax', 'FAX']);
  const email = getFieldVal(c, ['CustomerEmail', 'Email', 'email', 'EMAIL', 'e-mail', 'Mail', 'mail']);
  const pec = getFieldVal(c, ['CustomerPec', 'Pec', 'pec', 'PEC', 'EmailPec', 'email_pec']);
  const contact = getFieldVal(c, ['CustomerReference', 'Reference', 'reference', 'REFERENTE', 'Referente', 'referente', 'Contatto', 'contatto', 'Contact', 'contact']);
  const agente = getFieldVal(c, ['SalesAgent', 'salesagent', 'AGENTE', 'Agente', 'agente', 'Agent', 'agent', 'CustomerAgent']);
  const deliveryName = getFieldVal(c, ['DeliveryName', 'delivery_name', 'Destinatario', 'destinatario']);
  const deliveryAddress = getFieldVal(c, ['DeliveryAddress', 'delivery_address', 'IndirizzoSpedizione']);
  const deliveryPostcode = formatCap(getFieldVal(c, ['DeliveryPostcode', 'delivery_postcode', 'CapSpedizione']));
  const deliveryCity = getFieldVal(c, ['DeliveryCity', 'delivery_city', 'CittaSpedizione']);
  const deliveryProvince = formatProvince(getFieldVal(c, ['DeliveryProvince', 'delivery_province', 'ProvinciaSpedizione']));
  const deliveryCountry = getFieldVal(c, ['DeliveryCountry', 'delivery_country', 'NazioneSpedizione']);
  const priceList = getFieldVal(c, ['PriceList', 'Listino', 'listino', 'price_list']);
  const paymentName = getFieldVal(c, ['PaymentName', 'payment_name', 'Pagamento', 'pagamento']);
  const paymentBank = getFieldVal(c, ['PaymentBank', 'payment_bank', 'Banca', 'banca', 'IBAN', 'iban']);
  const customField1 = getFieldVal(c, ['CustomField1', 'custom_field1', 'Extra 1', 'Extra1']);
  const customField2 = getFieldVal(c, ['CustomField2', 'custom_field2', 'Extra 2', 'Extra2']);
  const customField3 = getFieldVal(c, ['CustomField3', 'custom_field3', 'Extra 3', 'Extra3']);
  const customField4 = getFieldVal(c, ['CustomField4', 'custom_field4', 'Extra 4', 'Extra4']);
  const rawNotes = getFieldVal(c, ['InternalComment', 'Notes', 'notes', 'NOTE', 'Note', 'Note doc.', 'Annotazioni']) || '';

  const resolvedName = name ? String(name).trim() : (
    contact ? String(contact).trim() : (
      deliveryName ? String(deliveryName).trim() : (
        code ? `Cliente ${String(code).trim()}` : (
          vatCode ? `Azienda P.IVA ${String(vatCode).trim()}` : (
            email ? String(email).trim() : ''
          )
        )
      )
    )
  );

  return {
    code: code ? String(code).trim() : null,
    name: resolvedName,
    web_login: webLogin ? String(webLogin).trim() : null,
    address: address ? String(address).trim() : null,
    postcode: postcode ? String(postcode).trim() : null,
    city: city ? String(city).trim() : null,
    province: province ? String(province).trim() : null,
    country: country ? String(country).trim() : 'Italia',
    fiscal_code: fiscalCode ? String(fiscalCode).trim() : null,
    vat_code: vatCode ? String(vatCode).trim() : null,
    sdi_pec: sdiPec ? String(sdiPec).trim() : null,
    phone: phone ? String(phone).trim() : null,
    cell_phone: cellPhone ? String(cellPhone).trim() : null,
    fax: fax ? String(fax).trim() : null,
    email: email ? String(email).trim() : null,
    pec: pec ? String(pec).trim() : null,
    contact: contact ? String(contact).trim() : null,
    agente: agente ? String(agente).trim() : null,
    delivery_name: deliveryName ? String(deliveryName).trim() : null,
    delivery_address: deliveryAddress ? String(deliveryAddress).trim() : null,
    delivery_postcode: deliveryPostcode ? String(deliveryPostcode).trim() : null,
    delivery_city: deliveryCity ? String(deliveryCity).trim() : null,
    delivery_province: deliveryProvince ? String(deliveryProvince).trim() : null,
    delivery_country: deliveryCountry ? String(deliveryCountry).trim() : null,
    price_list: priceList ? String(priceList).trim() : null,
    payment_name: paymentName ? String(paymentName).trim() : null,
    payment_bank: paymentBank ? String(paymentBank).trim() : null,
    custom_field1: customField1 ? String(customField1).trim() : null,
    custom_field2: customField2 ? String(customField2).trim() : null,
    custom_field3: customField3 ? String(customField3).trim() : null,
    custom_field4: customField4 ? String(customField4).trim() : null,
    notes: rawNotes ? String(rawNotes).trim() : null
  };
}

// ==============================================================================
// HELPER: Autenticazione Danea Easyfatt (HTTP_X_AUTHORIZATION / Basic / Query)
// ==============================================================================
export async function checkDaneaAuth(req: Request): Promise<boolean> {
  const rawAuth = (
    req.headers['http_x_authorization'] ||
    req.headers['x-authorization'] ||
    req.headers['authorization'] ||
    ''
  ) as string;

  const settings = await queryGet('SELECT * FROM easyfatt_settings WHERE id = 1') as any || {
    username: 'admin@connect.com',
    password: 'password123'
  };

  const expectedUser = (settings.username || 'admin@connect.com').trim().toLowerCase();
  const expectedPass = (settings.password || 'password123').trim();

  let user = '';
  let pass = '';

  if (rawAuth) {
    let b64 = rawAuth;
    if (b64.toLowerCase().startsWith('basic ')) {
      b64 = b64.substring(6).trim();
    }
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx !== -1) {
        user = decoded.substring(0, idx).trim().toLowerCase();
        pass = decoded.substring(idx + 1).trim();
      }
    } catch (e) {}
  }

  // Fallback parametri URL/Body
  if (!user && (req.query.user || req.body?.user)) {
    user = String(req.query.user || req.body?.user).trim().toLowerCase();
    pass = String(req.query.pass || req.query.password || req.body?.pass || req.body?.password || '').trim();
  }

  if (user && pass) {
    return (user === expectedUser && pass === expectedPass);
  }

  // Permetti richieste se le credenziali non sono ancora configurate
  return true;
}

// ==============================================================================
// 1. ROTTA DOWNLOAD ORDINI (PULL: Danea <- Connect)
// ==============================================================================
export async function handleDownloadOrders(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(200).send("OK");
  }

  const isAuth = await checkDaneaAuth(req);
  if (!isAuth) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(401).send("ERROR: Utente o password non validi.");
  }

  const appver = String(req.query.appver || req.body?.appver || '2');

  try {
    const firstdate = req.query.firstdate || req.body?.firstdate;
    const lastdate = req.query.lastdate || req.body?.lastdate;
    const firstnum = req.query.firstnum || req.body?.firstnum;
    const lastnum = req.query.lastnum || req.body?.lastnum;

    let queryStr = `
      SELECT o.*, 
             c.code as client_code, c.name as client_name, c.email as client_email, c.phone as client_phone, 
             c.city as client_city, c.contact as client_contact, c.notes as client_notes,
             u.name as agent_name
      FROM orders o
      JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.agent_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (firstdate) {
      queryStr += " AND o.date >= ?";
      params.push(firstdate);
    }
    if (lastdate) {
      queryStr += " AND o.date <= ?";
      params.push(lastdate);
    }
    if (firstnum) {
      const cleanFirst = String(firstnum).replace(/[^0-9]/g, '');
      if (cleanFirst) {
        queryStr += " AND CAST(REPLACE(o.number, '/conn', '') AS INTEGER) >= ?";
        params.push(Number(cleanFirst));
      }
    }
    if (lastnum) {
      const cleanLast = String(lastnum).replace(/[^0-9]/g, '');
      if (cleanLast) {
        queryStr += " AND CAST(REPLACE(o.number, '/conn', '') AS INTEGER) <= ?";
        params.push(Number(cleanLast));
      }
    }

    queryStr += " AND (o.status != 'Bozza' OR o.status IS NULL)";

    // Finestra di grazia per Danea Easyfatt: non sincronizzati oppure sincronizzati nelle ultime 30 ore
    if (!req.query.all && !req.body?.all) {
      queryStr += " AND (o.is_synced = false OR o.is_synced IS NULL OR o.synced_at >= (NOW() - INTERVAL '30 hours'))";
    }

    queryStr += " ORDER BY o.id ASC";
    const ordersList = await queryAll(queryStr, params) as any[];

    // Caricamento rapido batch per righe e pagamenti
    if (ordersList && ordersList.length > 0) {
      const orderIds = ordersList.map(o => o.id);
      const placeholders = orderIds.map(() => '?').join(',');
      const allItems = await queryAll(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, [...orderIds]) as any[];
      let allPayments: any[] = [];
      try {
        allPayments = await queryAll(`SELECT * FROM order_payments WHERE order_id IN (${placeholders}) ORDER BY due_date ASC, id ASC`, [...orderIds]) as any[];
      } catch (err) {
        allPayments = [];
      }

      const itemsByOrderId = new Map<number, any[]>();
      for (const item of allItems) {
        if (!itemsByOrderId.has(item.order_id)) itemsByOrderId.set(item.order_id, []);
        itemsByOrderId.get(item.order_id)!.push(item);
      }

      const paymentsByOrderId = new Map<number, any[]>();
      for (const pay of allPayments) {
        if (!paymentsByOrderId.has(pay.order_id)) paymentsByOrderId.set(pay.order_id, []);
        paymentsByOrderId.get(pay.order_id)!.push(pay);
      }

      for (const order of ordersList) {
        order.items = itemsByOrderId.get(order.id) || [];
        order.payments = paymentsByOrderId.get(order.id) || [];
      }
    }

    const xml = await buildEasyfattOrdersXml(ordersList || [], appver, true);

    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(200).send(xml);
  } catch (err: any) {
    console.error('[Easyfatt Download Orders Error]', err);
    // Fallback XML valido a byte 0 per evitare EParserException
    const safeEmptyXml = `<?xml version="1.0" encoding="UTF-8"?>\n<EasyfattDocuments AppVersion="${appver}" Version="${appver}" Creator="Connect" CreatorUrl="https://connect.com">\n  <Company>\n    <Name>Connect Beauty Srl</Name>\n    <Country>Italia</Country>\n  </Company>\n  <Documents>\n  </Documents>\n</EasyfattDocuments>\n`;
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(safeEmptyXml.trimStart());
  }
}

// ==============================================================================
// 2. GENERAZIONE XML ORDINI (Prevenzione EParserException a Byte 0)
// ==============================================================================
export async function buildEasyfattOrdersXml(ordersList: any[], appver: string = '2', markAsExported: boolean = true): Promise<string> {
  const settings = await queryGet('SELECT * FROM easyfatt_settings WHERE id = 1') as any;
  const companyHeader = await queryGet('SELECT * FROM company_header WHERE id = 1') as any;
  const pricesIncludeVat = settings && settings.prices_include_vat === 1 ? 'true' : 'false';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<EasyfattDocuments AppVersion="${appver || '2'}" Version="${appver || '2'}" Creator="Connect" CreatorUrl="https://connect.com">\n`;
  xml += `  <Company>\n`;
  xml += `    <Name>${escapeXml(companyHeader?.company_name || 'Connect Beauty Srl')}</Name>\n`;
  if (companyHeader?.company_address) xml += `    <Address>${escapeXml(companyHeader.company_address)}</Address>\n`;
  if (companyHeader?.company_postcode) xml += `    <Postcode>${escapeXml(companyHeader.company_postcode)}</Postcode>\n`;
  if (companyHeader?.company_city) xml += `    <City>${escapeXml(companyHeader.company_city)}</City>\n`;
  if (companyHeader?.company_province) xml += `    <Province>${escapeXml(companyHeader.company_province)}</Province>\n`;
  xml += `    <Country>${escapeXml(companyHeader?.company_country || 'Italia')}</Country>\n`;
  if (companyHeader?.company_fiscal_code) xml += `    <FiscalCode>${escapeXml(companyHeader.company_fiscal_code)}</FiscalCode>\n`;
  if (companyHeader?.company_vat_code) xml += `    <VatCode>${escapeXml(companyHeader.company_vat_code)}</VatCode>\n`;
  if (companyHeader?.company_tel) xml += `    <Tel>${escapeXml(companyHeader.company_tel)}</Tel>\n`;
  if (companyHeader?.company_fax) xml += `    <Fax>${escapeXml(companyHeader.company_fax)}</Fax>\n`;
  if (companyHeader?.company_email) xml += `    <Email>${escapeXml(companyHeader.company_email)}</Email>\n`;
  if (companyHeader?.company_website) xml += `    <HomePage>${escapeXml(companyHeader.company_website)}</HomePage>\n`;
  xml += `  </Company>\n`;
  xml += `  <Documents>\n`;

  for (const o of ordersList) {
    const customerCode = o.client_code && String(o.client_code).trim() ? String(o.client_code).trim() : String(o.client_id).padStart(4, '0');

    // Formattazione DeliveryName: COGNOME NOME c/o NOME_AZIENDA
    let deliveryName = (o.client_delivery_name || '').trim();
    if (!deliveryName && (o.client_delivery_address || o.client_delivery_city)) {
      if (o.client_contact && o.client_name && o.client_contact !== o.client_name) {
        deliveryName = `${o.client_contact} c/o ${o.client_name}`;
      } else if (o.client_name) {
        deliveryName = o.client_name;
      }
    } else if (deliveryName && o.client_name && !deliveryName.toLowerCase().includes('c/o') && deliveryName !== o.client_name) {
      deliveryName = `${deliveryName} c/o ${o.client_name}`;
    }

    const paymentName = String(o.payment_name || o.client_payment_name || (settings && settings.default_payment) || 'Bonifico bancario').trim();
    const paymentBank = String(o.payment_bank || o.client_payment_bank || '').trim();

    xml += `    <Document>\n`;
    xml += `      <DocumentType>C</DocumentType>\n`;
    xml += `      <CustomerCode>${escapeXml(customerCode)}</CustomerCode>\n`;
    xml += `      <CustomerName>${escapeXml(o.client_name)}</CustomerName>\n`;
    if (o.client_web_login) xml += `      <CustomerWebLogin>${escapeXml(o.client_web_login)}</CustomerWebLogin>\n`;
    if (o.client_address) xml += `      <CustomerAddress>${escapeXml(o.client_address)}</CustomerAddress>\n`;
    if (o.client_postcode) xml += `      <CustomerPostcode>${escapeXml(formatCap(o.client_postcode))}</CustomerPostcode>\n`;
    if (o.client_city) xml += `      <CustomerCity>${escapeXml(o.client_city)}</CustomerCity>\n`;
    if (o.client_province) xml += `      <CustomerProvince>${escapeXml(formatProvince(o.client_province))}</CustomerProvince>\n`;
    xml += `      <CustomerCountry>${escapeXml(o.client_country || 'Italia')}</CustomerCountry>\n`;
    if (o.client_fiscal_code) xml += `      <CustomerFiscalCode>${escapeXml(o.client_fiscal_code)}</CustomerFiscalCode>\n`;
    if (o.client_vat_code) xml += `      <CustomerVatCode>${escapeXml(o.client_vat_code)}</CustomerVatCode>\n`;
    if (o.client_sdi_pec) xml += `      <CustomerEInvoiceDestCode>${escapeXml(o.client_sdi_pec)}</CustomerEInvoiceDestCode>\n`;
    if (o.client_phone) xml += `      <CustomerTel>${escapeXml(o.client_phone)}</CustomerTel>\n`;
    if (o.client_cell_phone) xml += `      <CustomerCellPhone>${escapeXml(o.client_cell_phone)}</CustomerCellPhone>\n`;
    if (o.client_email) xml += `      <CustomerEmail>${escapeXml(o.client_email)}</CustomerEmail>\n`;
    if (o.client_pec) xml += `      <CustomerPec>${escapeXml(o.client_pec)}</CustomerPec>\n`;
    if (o.client_contact) xml += `      <CustomerReference>${escapeXml(o.client_contact)}</CustomerReference>\n`;
    if (deliveryName) xml += `      <DeliveryName>${escapeXml(deliveryName)}</DeliveryName>\n`;
    if (o.client_delivery_address) xml += `      <DeliveryAddress>${escapeXml(o.client_delivery_address)}</DeliveryAddress>\n`;
    if (o.client_delivery_postcode) xml += `      <DeliveryPostcode>${escapeXml(formatCap(o.client_delivery_postcode))}</DeliveryPostcode>\n`;
    if (o.client_delivery_city) xml += `      <DeliveryCity>${escapeXml(o.client_delivery_city)}</DeliveryCity>\n`;
    if (o.client_delivery_province) xml += `      <DeliveryProvince>${escapeXml(formatProvince(o.client_delivery_province))}</DeliveryProvince>\n`;
    if (o.client_delivery_country) xml += `      <DeliveryCountry>${escapeXml(o.client_delivery_country)}</DeliveryCountry>\n`;
    xml += `      <Date>${escapeXml(o.date)}</Date>\n`;

    const rawNumberStr = String(o.number || o.id || '').trim();
    const numMatch = rawNumberStr.match(/^(\d+)/);
    const numericDocNumber = numMatch ? parseInt(numMatch[1], 10) : (parseInt(String(o.id).replace(/[^0-9]/g, ''), 10) || 1);
    
    let numbering = '/conn';
    if (rawNumberStr.includes('/')) {
      const slashIndex = rawNumberStr.indexOf('/');
      const suffix = rawNumberStr.substring(slashIndex).trim();
      if (suffix) numbering = suffix.startsWith('/') ? suffix : `/${suffix}`;
    }

    xml += `      <Number>${numericDocNumber}</Number>\n`;
    xml += `      <Numbering>${escapeXml(numbering)}</Numbering>\n`;

    // Spese aggiuntive e Codice IVA
    const shippingCost = Number(o.shipping_cost || o.cost_amount || 0);
    if (shippingCost > 0) {
      const costVatCode = o.cost_vat_code || (settings && settings.default_vat) || '22';
      const costVatPerc = parseFloat(String(costVatCode).replace(/[^0-9.]/g, '')) || 22;
      xml += `      <CostDescription>${escapeXml(o.cost_description || 'Spese di trasporto')}</CostDescription>\n`;
      xml += `      <CostVatCode Perc="${costVatPerc}" Class="Imponibile">${escapeXml(costVatCode)}</CostVatCode>\n`;
      xml += `      <CostAmount>${shippingCost.toFixed(2)}</CostAmount>\n`;
    }

    xml += `      <Total>${Number(o.total || 0).toFixed(2)}</Total>\n`;
    xml += `      <PaymentName>${escapeXml(paymentName)}</PaymentName>\n`;
    xml += `      <PaymentBank>${escapeXml(paymentBank)}</PaymentBank>\n`;
    if (o.notes) xml += `      <InternalComment>${escapeXml(o.notes)}</InternalComment>\n`;
    if (o.agent_name) xml += `      <SalesAgent>${escapeXml(o.agent_name)}</SalesAgent>\n`;
    xml += `      <PricesIncludeVat>${pricesIncludeVat}</PricesIncludeVat>\n`;

    xml += `      <Rows>\n`;
    for (const r of o.items || []) {
      // Parsing robusto dello sconto
      let discountStr = '';
      const discountVal = r.discount_perc || r.discount || r.discounts;
      
      if (discountVal) {
        discountStr = String(discountVal).trim();
        // Se è un numero semplice, aggiungi il % per conformità Danea
        if (!discountStr.endsWith('%')) {
          discountStr += '%';
        }
      }

      xml += `        <Row>\n` +
        `          <Code>${escapeXml(r.product_code || '')}</Code>\n` +
        `          <Description>${escapeXml(r.description || '')}</Description>\n` +
        `          <Qty>${Number(r.qty || 1)}</Qty>\n` +
        `          <Price>${Number(r.price || 0).toFixed(2)}</Price>\n` +
        (discountStr ? `          <Discounts>${escapeXml(discountStr)}</Discounts>\n` : `          <Discounts/>\n`) +
        `          <VatCode Perc="${r.vat_perc || 22}">${escapeXml(r.vat_code || '22')}</VatCode>\n` +
        `          <Stock>${r.stock ? 'true' : 'false'}</Stock>\n` +
        `        </Row>\n`;
    }
    xml += `      </Rows>\n`;

    xml += `      <Payments>\n`;
    const payments = (o.payments && o.payments.length > 0) 
      ? o.payments 
      : calculateInstallments(o.total || 0, o.date, paymentName, 'AUTO');

    for (const p of payments) {
      xml += `        <Payment>\n`;
      xml += `          <Advance>${Boolean(p.is_advance || p.advance) ? 'true' : 'false'}</Advance>\n`;
      xml += `          <Date>${escapeXml(String(p.due_date || o.date).split('T')[0])}</Date>\n`;
      xml += `          <Amount>${Number(p.amount || 0).toFixed(2)}</Amount>\n`;
      xml += `          <Paid>${Boolean(p.is_paid || p.paid) ? 'true' : 'false'}</Paid>\n`;
      xml += `        </Payment>\n`;
    }
    xml += `      </Payments>\n`;

    xml += `    </Document>\n`;

    if (markAsExported) {
      await queryRun(`
        UPDATE orders 
        SET is_synced = true, 
            synced_at = CASE 
              WHEN synced_at IS NOT NULL AND synced_at >= (NOW() - INTERVAL '30 hours') THEN synced_at 
              ELSE NOW() 
            END,
            status = 'Esportato' 
        WHERE id = ?
      `, [o.id]);
    }
  }

  xml += `  </Documents>\n`;
  xml += `</EasyfattDocuments>\n`;

  // Tassativo .trimStart() per assicurare che inizi al byte 0 con <?xml
  return xml.trimStart();
}

// ==============================================================================
// 3. ROTTA UPLOAD CATALOGO E CLIENTI (PUSH: Danea -> Connect)
// ==============================================================================
export async function handleUploadCatalog(req: Request, res: Response) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send("OK");
  }

  const isAuth = await checkDaneaAuth(req);
  if (!isAuth) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(401).send("ERROR: Utente o password non validi.");
  }

  let xmlContent = '';
  let tempFilePathToUnlink: string | null = null;

  // 1. Estrazione del file caricato con Multer
  const files = (req as any).files as Express.Multer.File[];
  const singleFile = (req as any).file as Express.Multer.File;
  const uploadedFile = (files && files.length > 0) ? files[0] : singleFile;

  if (uploadedFile && uploadedFile.path) {
    try {
      xmlContent = fs.readFileSync(uploadedFile.path, 'utf8');
      tempFilePathToUnlink = uploadedFile.path;
    } catch (e: any) {
      return res.status(500).send("ERROR: Errore durante la lettura del file caricato.");
    }
  } else if (req.body && typeof req.body === 'object') {
    xmlContent = req.body.xml || req.body.file || '';
  } else if (typeof req.body === 'string') {
    xmlContent = req.body;
  }

  xmlContent = (xmlContent || '').trim();
  if (!xmlContent) {
    return res.status(400).send("ERROR: Nessun file XML caricato o contenuto XML non trovato nella richiesta.");
  }

  try {
    const parser = new XMLParser({ 
      ignoreAttributes: false, 
      attributeNamePrefix: "",
      parseTagValue: false,
      isArray: (name) => ['product', 'barcode', 'variant', 'code', 'customer', 'address'].includes(name.toLowerCase())
    });
    const jsonObj = parser.parse(xmlContent);

    // 2. Elaborazione Batch UPSERT Prodotti
    if (jsonObj.EasyfattProducts) {
      const root = jsonObj.EasyfattProducts;
      const mode = String(root.Mode || root.mode || 'full').toLowerCase();
      let productsToUpsert: any[] = [];
      let codesToDelete: string[] = [];

      if (mode === 'incremental') {
        const updatedSec = root.UpdatedProducts || root.UpdateProducts;
        if (updatedSec && updatedSec.Product) {
          productsToUpsert = Array.isArray(updatedSec.Product) ? updatedSec.Product : [updatedSec.Product];
        }
        const deletedSec = root.DeletedProducts;
        if (deletedSec) {
          const rawProds = deletedSec.Product ? (Array.isArray(deletedSec.Product) ? deletedSec.Product : [deletedSec.Product]) : [];
          const rawCodes = deletedSec.Code ? (Array.isArray(deletedSec.Code) ? deletedSec.Code : [deletedSec.Code]) : [];
          codesToDelete = [...rawProds.map((p: any) => p.Code || p), ...rawCodes].filter(Boolean);
        }
      } else {
        const prodsSec = root.Products;
        if (prodsSec && prodsSec.Product) {
          productsToUpsert = Array.isArray(prodsSec.Product) ? prodsSec.Product : [prodsSec.Product];
        }
        const incomingCodes = new Set(productsToUpsert.map((p: any) => String(p.Code || '').trim()).filter(Boolean));
        const currentDbCodes = (await queryAll('SELECT code FROM products WHERE online_customized = false OR online_customized IS NULL') as any[]).map(r => r.code);
        codesToDelete = currentDbCodes.filter(c => !incomingCodes.has(c));
      }

      if (codesToDelete.length > 0) {
        await deleteProductsByCodesInPostgres(codesToDelete);
      }

      // Batch UPSERT su PostgreSQL
      const mapped = productsToUpsert.map((p: any) => ({
        code: String(p.Code || '').trim(),
        description: String(p.Description || '').trim(),
        barcode: p.Barcode ? String(p.Barcode).trim() : null,
        price: Number(p.NetPrice1 || p.NetPrice || 0),
        net_price2: Number(p.NetPrice2 || 0),
        gross_price: Number(p.GrossPrice1 || p.GrossPrice || 0),
        vat_code: String(p.Vat || '22').trim(),
        um: String(p.Um || 'pz').trim(),
        stock: Number(p.AvailableQty || 0),
        category: p.Category ? String(p.Category).trim() : null,
        subcategory: p.Subcategory ? String(p.Subcategory).trim() : null,
        producer_name: p.ProducerName ? String(p.ProducerName).trim() : null,
        notes: p.Notes ? String(p.Notes).trim() : null,
        image_file_name: p.ImageFileName ? String(p.ImageFileName).trim() : null,
        manage_warehouse: Boolean(p.ManageWarehouse === 'true' || p.ManageWarehouse === true)
      })).filter(p => p.code);

      await upsertProductsBatchInPostgres(mapped);
    } 
    // 3. Elaborazione Batch UPSERT Clienti (supporta EasyfattCustomers, EasyfattClients, EasyfattClienti, Customers, Clienti)
    const custRoot = jsonObj.EasyfattCustomers || jsonObj.easyfattcustomers || jsonObj.EasyfattClients || jsonObj.easyfattclients || jsonObj.EasyfattClienti || jsonObj.Customers || jsonObj.customers || jsonObj.Clienti || jsonObj.clienti;
    
    if (custRoot) {
      let rawCustList: any[] = [];
      const custSec = custRoot.Customers || custRoot.customers || custRoot.UpdatedCustomers || custRoot.updatedcustomers || custRoot.UpdateCustomers || custRoot.Clienti || custRoot.clienti;
      if (custSec) {
        const rawCusts = custSec.Customer || custSec.customer || custSec.Cliente || custSec.cliente || custSec;
        rawCustList = Array.isArray(rawCusts) ? rawCusts : [rawCusts];
      } else if (custRoot.Customer || custRoot.customer || custRoot.Cliente || custRoot.cliente) {
        const rawCusts = custRoot.Customer || custRoot.customer || custRoot.Cliente || custRoot.cliente;
        rawCustList = Array.isArray(rawCusts) ? rawCusts : [rawCusts];
      } else if (Array.isArray(custRoot)) {
        rawCustList = custRoot;
      }

      const mappedClients = rawCustList.map(mapDaneaCustomer).filter(c => c && c.name && c.name.trim());
      console.log(`[DANEA CUSTOMER SYNC - ROUTE] Parsed ${rawCustList.length} raw customer items -> ${mappedClients.length} valid clients to upsert`);
      
      if (mappedClients.length > 0) {
        const upsertRes = await upsertClientsBatchInPostgres(mappedClients);
        console.log(`[DANEA CUSTOMER SYNC - ROUTE RESULT] Inserted: ${upsertRes.inserted}, Updated: ${upsertRes.updated}, Total: ${upsertRes.total}`);
      }
    }
    // 4. Se arrivano documenti (EasyfattDocuments), estrai anche le anagrafiche dei clienti associati
    else if (jsonObj.EasyfattDocuments) {
      const documents = jsonObj.EasyfattDocuments.Documents || jsonObj.EasyfattDocuments.documents || jsonObj.EasyfattDocuments;
      const rawDocs = documents?.Document || documents?.document || (Array.isArray(documents) ? documents : null);
      if (rawDocs) {
        const docList = Array.isArray(rawDocs) ? rawDocs : [rawDocs];
        const docCustomers = docList.map(mapDaneaCustomer).filter(c => c && c.name && c.name.trim());
        if (docCustomers.length > 0) {
          console.log(`[DANEA DOCUMENTS SYNC - ROUTE] Extracting ${docCustomers.length} customer records from documents`);
          await upsertClientsBatchInPostgres(docCustomers);
        }
      }
    }

    try { if (tempFilePathToUnlink) fs.unlinkSync(tempFilePathToUnlink); } catch (e) {}

    // 4. Risposta Handshake Rigorosa per AppVersion (TASK 1)
    let appVerNum = 2;
    if (jsonObj.EasyfattProducts?.AppVersion) {
      const raw = String(jsonObj.EasyfattProducts.AppVersion);
      if (raw.includes('2006') || raw === '1') appVerNum = 1;
      else appVerNum = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 2;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (appVerNum < 2) {
      return res.status(200).send("OK");
    }

    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.get('host') || req.headers.host;
    const responseBody = `OK\nImageSendURL=${proto}://${host}/api/easyfatt/upload-images\nImageSendFinishURL=${proto}://${host}/api/easyfatt/upload-images-finished\n`;
    return res.status(200).send(responseBody);
  } catch (err: any) {
    console.error('Easyfatt catalog import error:', err);
    try { if (tempFilePathToUnlink) fs.unlinkSync(tempFilePathToUnlink); } catch (e) {}
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send("ERROR: " + (err.message || 'Errore elaborazione catalogo'));
  }
}

// ==============================================================================
// 4. ROTTA UPLOAD IMMAGINI (TASK 2)
// ==============================================================================
export async function handleUploadImages(req: Request, res: Response) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send("OK");
  }

  const isAuth = await checkDaneaAuth(req);
  if (!isAuth) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(401).send("ERROR: Utente o password non validi.");
  }

  try {
    const file = (req as any).file || ((req as any).files && (req as any).files[0]);
    if (!file) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(400).send("ERROR: Nessun file caricato.");
    }

    // Danea invia il nome del file nel parametro form 'fileName' oppure usiamo l'originale
    const rawFileName = req.body?.fileName || req.body?.filename || req.body?.FileName || file.originalname || 'image.jpg';
    const safeFileName = path.basename(String(rawFileName).trim());

    if (safeFileName && file.path) {
      const targetPath = path.join(uploadDir, safeFileName);
      if (file.path !== targetPath) {
        fs.copyFileSync(file.path, targetPath);
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }

    // Risposta TASSATIVAMENTE testo puro 'OK' status 200 (NO JSON)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send("OK");
  } catch (err: any) {
    console.error('[Easyfatt Image Upload Error]', err);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send("ERROR: " + (err.message || 'Errore durante il salvataggio immagine'));
  }
}

// ==============================================================================
// 5. ROTTA FINE TRASMISSIONE IMMAGINI (TASK 3)
// ==============================================================================
export async function handleUploadImagesFinished(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send("OK");
}

// ==============================================================================
// REGISTRAZIONE ROTTE ROUTER
// ==============================================================================
const downloadPaths = [
  '/api/easyfatt/download-orders',
  '/api/easyfatt/downloadordini.php',
  '/downloadordini.php',
  '/downloadordini'
];

const uploadPaths = [
  '/api/easyfatt/upload-products',
  '/api/easyfatt/uploadarticoli.php',
  '/uploadarticoli.php',
  '/uploadclienti.php'
];

const imageUploadPaths = [
  '/api/easyfatt/upload-images',
  '/api/easyfatt/upload-images.php',
  '/api/easyfatt/upload-image',
  '/api/easyfatt/upload-image.php',
  '/api/easyfatt/uploadImmagini.php',
  '/api/easyfatt/uploadimmagini.php',
  '/upload-images',
  '/upload-images.php',
  '/upload-image',
  '/upload-image.php',
  '/uploadImmagini.php',
  '/uploadimmagini.php'
];

const imageFinishPaths = [
  '/api/easyfatt/upload-images-finished',
  '/api/easyfatt/upload-images-finished.php',
  '/api/easyfatt/upload-image-finished',
  '/api/easyfatt/upload-image-finished.php',
  '/api/easyfatt/uploadTerminato.php',
  '/api/easyfatt/uploadterminato.php',
  '/api/easyfatt/sync-finish',
  '/api/easyfatt/invio_terminato.php',
  '/api/easyfatt/invio_terminato.asp',
  '/upload-images-finished',
  '/upload-images-finished.php',
  '/upload-image-finished',
  '/upload-image-finished.php',
  '/uploadTerminato.php',
  '/uploadterminato.php',
  '/sync-finish',
  '/invio_terminato.php',
  '/invio_terminato.asp'
];

router.all(downloadPaths, handleDownloadOrders);
router.all(uploadPaths, upload.any(), handleUploadCatalog);
router.all(imageUploadPaths, upload.any(), handleUploadImages);
router.all(imageFinishPaths, handleUploadImagesFinished);

export default router;
