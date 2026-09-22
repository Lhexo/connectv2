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
const upload = multer({ dest: path.join(process.cwd(), 'uploads') });

// ==============================================================================
// HELPER: Sanitizzazione e Codifica XML
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
  const pricesIncludeVat = settings && settings.prices_include_vat === 1 ? 'true' : 'false';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<EasyfattDocuments AppVersion="${appver || '2'}" Version="${appver || '2'}" Creator="Connect" CreatorUrl="https://connect.com">\n`;
  xml += `  <Company>\n`;
  xml += `    <Name>Connect Beauty Srl</Name>\n`;
  xml += `    <Country>Italia</Country>\n`;
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

    xml += `    <Document>\n`;
    xml += `      <DocumentType>C</DocumentType>\n`;
    xml += `      <CustomerCode>${customerCode}</CustomerCode>\n`;
    xml += `      <CustomerName>${escapeXml(o.client_name)}</CustomerName>\n`;
    if (o.client_address) xml += `      <CustomerAddress>${escapeXml(o.client_address)}</CustomerAddress>\n`;
    if (o.client_postcode) xml += `      <CustomerPostcode>${escapeXml(formatCap(o.client_postcode))}</CustomerPostcode>\n`;
    if (o.client_city) xml += `      <CustomerCity>${escapeXml(o.client_city)}</CustomerCity>\n`;
    if (o.client_province) xml += `      <CustomerProvince>${escapeXml(formatProvince(o.client_province))}</CustomerProvince>\n`;
    xml += `      <CustomerCountry>${escapeXml(o.client_country || 'Italia')}</CustomerCountry>\n`;
    if (o.client_fiscal_code) xml += `      <CustomerFiscalCode>${escapeXml(o.client_fiscal_code)}</CustomerFiscalCode>\n`;
    if (o.client_vat_code) xml += `      <CustomerVatCode>${escapeXml(o.client_vat_code)}</CustomerVatCode>\n`;
    if (o.client_phone) xml += `      <CustomerTel>${escapeXml(o.client_phone)}</CustomerTel>\n`;
    if (o.client_email) xml += `      <CustomerEmail>${escapeXml(o.client_email)}</CustomerEmail>\n`;
    if (o.client_contact) xml += `      <CustomerReference>${escapeXml(o.client_contact)}</CustomerReference>\n`;
    if (deliveryName) xml += `      <DeliveryName>${escapeXml(deliveryName)}</DeliveryName>\n`;
    if (o.client_delivery_address) xml += `      <DeliveryAddress>${escapeXml(o.client_delivery_address)}</DeliveryAddress>\n`;
    if (o.client_delivery_postcode) xml += `      <DeliveryPostcode>${escapeXml(formatCap(o.client_delivery_postcode))}</DeliveryPostcode>\n`;
    if (o.client_delivery_city) xml += `      <DeliveryCity>${escapeXml(o.client_delivery_city)}</DeliveryCity>\n`;
    if (o.client_delivery_province) xml += `      <DeliveryProvince>${escapeXml(formatProvince(o.client_delivery_province))}</DeliveryProvince>\n`;
    xml += `      <Date>${o.date}</Date>\n`;

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
    xml += `      <PaymentName>${escapeXml(o.payment_name)}</PaymentName>\n`;
    xml += `      <PricesIncludeVat>${pricesIncludeVat}</PricesIncludeVat>\n`;

    xml += `      <Rows>\n`;
    for (const item of (o.items || [])) {
      const vatCode = item.vat_code || (settings && settings.default_vat) || '22';
      const vatPerc = parseFloat(String(vatCode).replace(/[^0-9.]/g, '')) || 22;
      xml += `        <Row>\n`;
      xml += `          <Code>${escapeXml(item.product_code)}</Code>\n`;
      xml += `          <Description>${escapeXml(item.description)}</Description>\n`;
      xml += `          <Qty>${item.qty}</Qty>\n`;
      xml += `          <Um>${escapeXml(item.um || 'pz')}</Um>\n`;
      xml += `          <Price>${Number(item.price || 0).toFixed(2)}</Price>\n`;
      xml += `          <VatCode Perc="${vatPerc}" Class="Imponibile">${escapeXml(vatCode)}</VatCode>\n`;
      xml += `          <Total>${(Number(item.qty || 0) * Number(item.price || 0)).toFixed(2)}</Total>\n`;
      xml += `        </Row>\n`;
    }
    xml += `      </Rows>\n`;

    xml += `      <Payments>\n`;
    const payments = (o.payments && o.payments.length > 0) 
      ? o.payments 
      : calculateInstallments(o.total || 0, o.date, o.payment_name || 'Bonifico bancario', 'AUTO');

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
    // 3. Elaborazione Batch UPSERT Clienti
    else if (jsonObj.EasyfattCustomers) {
      const root = jsonObj.EasyfattCustomers;
      const customersSection = root.Customers;
      const rawCusts = customersSection?.Customer ? (Array.isArray(customersSection.Customer) ? customersSection.Customer : [customersSection.Customer]) : [];
      
      const mappedClients = rawCusts.map((c: any) => ({
        code: String(c.Code || c.InternalID || '').trim(),
        name: String(c.Name || '').trim(),
        address: c.Address ? String(c.Address).trim() : null,
        postcode: c.Postcode ? formatCap(String(c.Postcode)) : null,
        city: c.City ? String(c.City).trim() : null,
        province: c.Province ? formatProvince(String(c.Province)) : null,
        country: c.Country ? String(c.Country).trim() : 'Italia',
        fiscal_code: c.FiscalCode ? String(c.FiscalCode).trim() : null,
        vat_code: c.VatCode ? String(c.VatCode).trim() : null,
        phone: c.Tel ? String(c.Tel).trim() : null,
        cell_phone: c.Cell ? String(c.Cell).trim() : null,
        email: c.Email ? String(c.Email).trim() : null,
        pec: c.Pec ? String(c.Pec).trim() : null,
        contact: c.Reference ? String(c.Reference).trim() : null
      })).filter((c: any) => c.name);

      await upsertClientsBatchInPostgres(mappedClients);
    }

    try { if (tempFilePathToUnlink) fs.unlinkSync(tempFilePathToUnlink); } catch (e) {}

    // 4. Risposta Handshake Rigorosa per AppVersion
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
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const responseBody = `OK\nImageSendURL=${proto}://${host}/api/easyfatt/upload-image\nImageSendFinishURL=${proto}://${host}/api/easyfatt/upload-image-finished\n`;
    return res.status(200).send(responseBody);
  } catch (err: any) {
    console.error('Easyfatt catalog import error:', err);
    try { if (tempFilePathToUnlink) fs.unlinkSync(tempFilePathToUnlink); } catch (e) {}
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send("ERROR: " + (err.message || 'Errore elaborazione catalogo'));
  }
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

router.all(downloadPaths, handleDownloadOrders);
router.all(uploadPaths, upload.any(), handleUploadCatalog);

export default router;
