import pg from 'pg';

const { Pool } = pg;

export function getConnectionString(): string {
  const uri = process.env.DATABASE_URI || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!uri) {
    console.warn('[DB NOTICE] Missing DATABASE_URI / POSTGRES_URL / DATABASE_URL environment variable. Defaulting to local connection.');
    return 'postgresql://postgres:postgres@localhost:5432/connectbeauty?sslmode=disable';
  }
  let finalUri = uri.trim();
  // Rimozione forzata dell'endpoint con -pooler per prevenire blocchi TCP / PgBouncer su server persistenti
  if (finalUri.includes('-pooler.')) {
    console.log('[DB NOTICE] Sostituzione endpoint Neon pooled (-pooler) con endpoint diretto per evitare socket timeout.');
    finalUri = finalUri.replace(/-pooler\./g, '.');
  }
  if (!finalUri.includes('sslmode=')) {
    finalUri += (finalUri.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  return finalUri;
}

export function getMaskedDbUrl(rawUrl?: string): string {
  try {
    const target = rawUrl || getConnectionString();
    const parsed = new URL(target.replace(/^postgresql:\/\//i, 'http://').replace(/^postgres:\/\//i, 'http://'));
    const user = parsed.username || 'user';
    const host = parsed.host || 'neon.tech';
    const pathname = parsed.pathname || '/neondb';
    return `postgresql://${user}:***@${host}${pathname}`;
  } catch (e) {
    const target = rawUrl || process.env.DATABASE_URI || 'unknown-db';
    return target.replace(/:([^:@]+)@/, ':***@');
  }
}

const connectionString = getConnectionString();
const maskedUrl = getMaskedDbUrl(connectionString);
console.log(`[NEON PG POOL INIT] Target Neon PostgreSQL Endpoint: ${maskedUrl}`);

const isSslNeeded = connectionString.includes('sslmode=') || connectionString.includes('neon.tech') || process.env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString,
  ssl: isSslNeeded ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Max 5s per connettersi (Fail Fast)
  statement_timeout: 10000,      // Max 10s per eseguire una query (Fail Fast)
  query_timeout: 10000,          // Max 10s per query
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[PG Pool Idle Client Error]', err?.message || err);
});

export async function queryWithRetry<T = any>(
  sqlOrConfig: string | pg.QueryConfig,
  values?: any[],
  retries = 2
): Promise<pg.QueryResult<T>> {
  let attempt = 0;
  while (true) {
    try {
      if (values !== undefined) {
        return await pool.query<T>(sqlOrConfig as string, values);
      } else {
        return await pool.query<T>(sqlOrConfig as any);
      }
    } catch (err: any) {
      attempt++;
      const errMsg = err?.message || '';
      const isTransient = 
        errMsg.includes('timeout') ||
        errMsg.includes('Connection') ||
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('closed') ||
        err?.code === '57P01' ||
        err?.code === '08006' ||
        err?.code === '08001';
      
      if (isTransient && attempt <= retries) {
        console.warn(`[NEON PG] Connection wake-up / transient delay (attempt ${attempt}/${retries}). Retrying in 1.5s...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      throw err;
    }
  }
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
  transactionName = 'Transaction'
): Promise<T> {
  const currentMaskedUri = getMaskedDbUrl();
  console.log(`[NEON PG TRANSACTION START] [${transactionName}] Target DB: ${currentMaskedUri}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`[NEON PG TRANSACTION] [${transactionName}] BEGIN transaction initiated on ${currentMaskedUri}`);

    const result = await callback(client);

    await client.query('COMMIT');
    console.log(`[NEON PG TRANSACTION SUCCESS] [${transactionName}] COMMIT executed successfully on ${currentMaskedUri}`);
    return result;
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      console.error(`[NEON PG TRANSACTION ROLLBACK] [${transactionName}] ROLLBACK executed on ${currentMaskedUri} due to error: ${err?.message || err}`);
    } catch (rbErr) {
      console.error(`[NEON PG TRANSACTION ROLLBACK FAILED] [${transactionName}]:`, rbErr);
    }
    console.error(`[NEON PG TRANSACTION ERROR DETAILS] [${transactionName}] DB: ${currentMaskedUri}`, {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      hint: err?.hint,
      position: err?.position,
      where: err?.where,
      schema: err?.schema,
      table: err?.table,
      column: err?.column,
      dataType: err?.dataType,
      constraint: err?.constraint
    });
    throw err;
  } finally {
    client.release();
  }
}

export interface ProductUpsertPayload {
  code: string;
  description: string;
  price: number;
  vat_code?: string | null;
  um?: string | null;
  stock?: number | null;
  barcode?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description_html?: string | null;
  producer_name?: string | null;
  link?: string | null;
  notes?: string | null;
  image_file_name?: string | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
  supplier_product_code?: string | null;
  supplier_net_price?: number | null;
  supplier_gross_price?: number | null;
  supplier_notes?: string | null;
  manage_warehouse?: boolean | null;
  warehouse_location?: string | null;
  min_stock?: number | null;
  ordered_qty?: number | null;
  weight_um?: string | null;
  net_weight?: number | null;
  gross_weight?: number | null;
  size_um?: string | null;
  net_size_x?: number | null;
  net_size_y?: number | null;
  net_size_z?: number | null;
  custom_field1?: string | null;
  custom_field2?: string | null;
  custom_field3?: string | null;
  custom_field4?: string | null;
  online_customized?: boolean | null;
  variants?: Array<{
    size?: string | null;
    color?: string | null;
    barcode?: string | null;
    available_qty?: number | null;
  }>;
  extra_barcodes?: Array<{
    barcode: string;
    package_qty?: number | null;
  }>;
}

export interface ClientUpsertPayload {
  code?: string | null;
  name: string;
  web_login?: string | null;
  address?: string | null;
  postcode?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  fiscal_code?: string | null;
  vat_code?: string | null;
  sdi_pec?: string | null;
  phone?: string | null;
  cell_phone?: string | null;
  fax?: string | null;
  email?: string | null;
  pec?: string | null;
  contact?: string | null;
  agente?: string | null;
  delivery_name?: string | null;
  delivery_address?: string | null;
  delivery_postcode?: string | null;
  delivery_city?: string | null;
  delivery_province?: string | null;
  delivery_country?: string | null;
  price_list?: string | null;
  payment_name?: string | null;
  payment_bank?: string | null;
  custom_field1?: string | null;
  custom_field2?: string | null;
  custom_field3?: string | null;
  custom_field4?: string | null;
  notes?: string | null;
}

export async function upsertClientInPostgres(
  c: ClientUpsertPayload,
  clientOrPool: pg.PoolClient | pg.Pool = pool
): Promise<{ status: 'inserted' | 'updated' | 'skipped'; id: number; name: string; code?: string | null }> {
  if (!c.name || !c.name.trim()) {
    console.warn('[NEON PG CLIENT UPSERT SKIPPED] Client missing required field "name", skipping:', c);
    return { status: 'skipped', id: -1, name: '' };
  }

  const name = c.name.trim();
  const code = c.code ? c.code.trim() : null;
  const webLogin = c.web_login ? c.web_login.trim() : null;
  const vatCode = c.vat_code ? c.vat_code.trim() : null;
  const fiscalCode = c.fiscal_code ? c.fiscal_code.trim() : null;
  const email = c.email ? c.email.trim() : null;

  // Auto-record payment method if provided
  if (c.payment_name && c.payment_name.trim()) {
    try {
      await clientOrPool.query(
        'INSERT INTO payment_methods (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [c.payment_name.trim()]
      );
    } catch (pmErr) {
      // Non-blocking
    }
  }

  let existingId: number | null = null;

  // Priority lookup per Easyfatt XML spec
  if (code) {
    const res = await clientOrPool.query('SELECT id FROM clients WHERE LOWER(TRIM(code)) = LOWER(TRIM($1)) LIMIT 1', [code]);
    if (res.rows.length > 0) existingId = res.rows[0].id;
  }
  if (!existingId && webLogin) {
    const res = await clientOrPool.query('SELECT id FROM clients WHERE LOWER(TRIM(web_login)) = LOWER(TRIM($1)) LIMIT 1', [webLogin]);
    if (res.rows.length > 0) existingId = res.rows[0].id;
  }
  if (!existingId && vatCode) {
    const res = await clientOrPool.query('SELECT id FROM clients WHERE LOWER(TRIM(vat_code)) = LOWER(TRIM($1)) LIMIT 1', [vatCode]);
    if (res.rows.length > 0) existingId = res.rows[0].id;
  }
  if (!existingId && fiscalCode) {
    const res = await clientOrPool.query('SELECT id FROM clients WHERE LOWER(TRIM(fiscal_code)) = LOWER(TRIM($1)) LIMIT 1', [fiscalCode]);
    if (res.rows.length > 0) existingId = res.rows[0].id;
  }
  if (!existingId && email) {
    const res = await clientOrPool.query('SELECT id FROM clients WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1', [email]);
    if (res.rows.length > 0) existingId = res.rows[0].id;
  }
  if (!existingId) {
    const res = await clientOrPool.query('SELECT id FROM clients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1', [name]);
    if (res.rows.length > 0) existingId = res.rows[0].id;
  }

  const values = [
    code,
    name,
    webLogin,
    c.address || null,
    c.postcode || null,
    c.city || null,
    c.province || null,
    c.country || 'Italia',
    fiscalCode,
    vatCode,
    c.sdi_pec || null,
    c.phone || null,
    c.cell_phone || null,
    c.fax || null,
    email,
    c.pec || null,
    c.contact || null,
    c.agente || null,
    c.delivery_name || null,
    c.delivery_address || null,
    c.delivery_postcode || null,
    c.delivery_city || null,
    c.delivery_province || null,
    c.delivery_country || null,
    c.price_list || null,
    c.payment_name || null,
    c.payment_bank || null,
    c.custom_field1 || null,
    c.custom_field2 || null,
    c.custom_field3 || null,
    c.custom_field4 || null,
    c.notes || null,
  ];

  if (existingId) {
    await clientOrPool.query(
      `UPDATE clients SET
        code = $1, name = $2, web_login = $3, address = $4, postcode = $5, city = $6, province = $7, country = $8,
        fiscal_code = $9, vat_code = $10, sdi_pec = $11, phone = $12, cell_phone = $13, fax = $14, email = $15, pec = $16,
        contact = $17, agente = COALESCE($18, agente), delivery_name = $19, delivery_address = $20, delivery_postcode = $21,
        delivery_city = $22, delivery_province = $23, delivery_country = $24, price_list = $25, payment_name = $26, payment_bank = $27,
        custom_field1 = $28, custom_field2 = $29, custom_field3 = $30, custom_field4 = $31, notes = $32
      WHERE id = $33`,
      [...values, existingId]
    );
    console.log(`[NEON PG CLIENT UPSERT] Client updated: "${name}" (ID: ${existingId}, Code: ${code || 'N/A'}) into table "clients"`);
    return { status: 'updated', id: existingId, name, code };
  } else {
    const insertRes = await clientOrPool.query(
      `INSERT INTO clients (
        code, name, web_login, address, postcode, city, province, country,
        fiscal_code, vat_code, sdi_pec, phone, cell_phone, fax, email, pec,
        contact, agente, delivery_name, delivery_address, delivery_postcode,
        delivery_city, delivery_province, delivery_country, price_list, payment_name, payment_bank,
        custom_field1, custom_field2, custom_field3, custom_field4, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32
      ) RETURNING id`,
      values
    );
    const newId = insertRes.rows[0]?.id;
    console.log(`[NEON PG CLIENT UPSERT] Client inserted: "${name}" (New ID: ${newId}, Code: ${code || 'N/A'}) into table "clients"`);
    return { status: 'inserted', id: newId, name, code };
  }
}

export async function upsertProductsBatchInPostgres(
  products: ProductUpsertPayload[],
  clientOrPool: pg.PoolClient | pg.Pool = pool
): Promise<{ inserted: number; updated: number; total: number }> {
  if (!products || products.length === 0) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  const validProducts = products.filter(p => p && p.code && String(p.code).trim());
  if (validProducts.length === 0) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  let totalInserted = 0;
  let totalUpdated = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
    const batch = validProducts.slice(i, i + BATCH_SIZE);
    try {
      // Check existing codes in this batch to accurately report inserted vs updated
      const batchCodes = batch.map(p => String(p.code).trim());
      const existingRes = await clientOrPool.query(
        'SELECT code FROM products WHERE code = ANY($1)',
        [batchCodes]
      );
      const existingCodeSet = new Set(existingRes.rows.map(r => r.code));

      const valueRows: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      for (const p of batch) {
        const code = String(p.code).trim();
        const description = (p.description || '').trim();
        const price = Number(p.price) || 0.0;
        const vat_code = p.vat_code || '22';
        const um = p.um || 'pz';
        const stock = Number(p.stock) || 0.0;
        const barcode = p.barcode ? String(p.barcode).trim() : null;
        const category = p.category ? String(p.category).trim() : null;
        const subcategory = p.subcategory ? String(p.subcategory).trim() : null;
        const description_html = p.description_html ? String(p.description_html).trim() : null;
        const producer_name = p.producer_name ? String(p.producer_name).trim() : null;
        const link = p.link ? String(p.link).trim() : null;
        const notes = p.notes ? String(p.notes).trim() : null;
        const image_file_name = p.image_file_name ? String(p.image_file_name).trim() : null;
        const supplier_code = p.supplier_code ? String(p.supplier_code).trim() : null;
        const supplier_name = p.supplier_name ? String(p.supplier_name).trim() : null;
        const supplier_product_code = p.supplier_product_code ? String(p.supplier_product_code).trim() : null;
        const supplier_net_price = Number(p.supplier_net_price) || 0.0;
        const supplier_gross_price = Number(p.supplier_gross_price) || 0.0;
        const supplier_notes = p.supplier_notes ? String(p.supplier_notes).trim() : null;
        const manage_warehouse = p.manage_warehouse === false ? false : true;
        const warehouse_location = p.warehouse_location ? String(p.warehouse_location).trim() : null;
        const min_stock = Number(p.min_stock) || 0.0;
        const ordered_qty = Number(p.ordered_qty) || 0.0;
        const weight_um = p.weight_um ? String(p.weight_um).trim() : null;
        const net_weight = Number(p.net_weight) || 0.0;
        const gross_weight = Number(p.gross_weight) || 0.0;
        const size_um = p.size_um ? String(p.size_um).trim() : null;
        const net_size_x = Number(p.net_size_x) || 0.0;
        const net_size_y = Number(p.net_size_y) || 0.0;
        const net_size_z = Number(p.net_size_z) || 0.0;
        const custom_field1 = p.custom_field1 ? String(p.custom_field1).trim() : null;
        const custom_field2 = p.custom_field2 ? String(p.custom_field2).trim() : null;
        const custom_field3 = p.custom_field3 ? String(p.custom_field3).trim() : null;
        const custom_field4 = p.custom_field4 ? String(p.custom_field4).trim() : null;
        const online_customized = Boolean(p.online_customized) === true;

        const rowPlaceholders = [];
        const rowVals = [
          code, description, price, vat_code, um, stock,
          barcode, category, subcategory, description_html, producer_name, link, notes, image_file_name,
          supplier_code, supplier_name, supplier_product_code, supplier_net_price, supplier_gross_price, supplier_notes,
          manage_warehouse, warehouse_location, min_stock, ordered_qty, weight_um, net_weight, gross_weight,
          size_um, net_size_x, net_size_y, net_size_z, custom_field1, custom_field2, custom_field3, custom_field4,
          online_customized
        ];

        for (const val of rowVals) {
          rowPlaceholders.push(`$${paramIdx++}`);
          queryParams.push(val);
        }
        valueRows.push(`(${rowPlaceholders.join(', ')})`);
      }

      const sql = `
        INSERT INTO products (
          code, description, price, vat_code, um, stock,
          barcode, category, subcategory, description_html, producer_name, link, notes, image_file_name,
          supplier_code, supplier_name, supplier_product_code, supplier_net_price, supplier_gross_price, supplier_notes,
          manage_warehouse, warehouse_location, min_stock, ordered_qty, weight_um, net_weight, gross_weight,
          size_um, net_size_x, net_size_y, net_size_z, custom_field1, custom_field2, custom_field3, custom_field4,
          online_customized
        )
        VALUES ${valueRows.join(', ')}
        ON CONFLICT (code) DO UPDATE SET
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          vat_code = EXCLUDED.vat_code,
          um = EXCLUDED.um,
          stock = EXCLUDED.stock,
          barcode = EXCLUDED.barcode,
          category = EXCLUDED.category,
          subcategory = EXCLUDED.subcategory,
          description_html = EXCLUDED.description_html,
          producer_name = EXCLUDED.producer_name,
          link = EXCLUDED.link,
          notes = EXCLUDED.notes,
          image_file_name = EXCLUDED.image_file_name,
          supplier_code = EXCLUDED.supplier_code,
          supplier_name = EXCLUDED.supplier_name,
          supplier_product_code = EXCLUDED.supplier_product_code,
          supplier_net_price = EXCLUDED.supplier_net_price,
          supplier_gross_price = EXCLUDED.supplier_gross_price,
          supplier_notes = EXCLUDED.supplier_notes,
          manage_warehouse = EXCLUDED.manage_warehouse,
          warehouse_location = EXCLUDED.warehouse_location,
          min_stock = EXCLUDED.min_stock,
          ordered_qty = EXCLUDED.ordered_qty,
          weight_um = EXCLUDED.weight_um,
          net_weight = EXCLUDED.net_weight,
          gross_weight = EXCLUDED.gross_weight,
          size_um = EXCLUDED.size_um,
          net_size_x = EXCLUDED.net_size_x,
          net_size_y = EXCLUDED.net_size_y,
          net_size_z = EXCLUDED.net_size_z,
          custom_field1 = EXCLUDED.custom_field1,
          custom_field2 = EXCLUDED.custom_field2,
          custom_field3 = EXCLUDED.custom_field3,
          custom_field4 = EXCLUDED.custom_field4,
          online_customized = EXCLUDED.online_customized
        RETURNING id, code;
      `;

      const res = await clientOrPool.query(sql, queryParams);
      const returnedRows = res.rows || [];
      const codeToIdMap = new Map<string, number>();
      for (const r of returnedRows) {
        codeToIdMap.set(r.code, r.id);
        if (existingCodeSet.has(r.code)) {
          totalUpdated++;
        } else {
          totalInserted++;
        }
      }

      // Handle variants & extra barcodes in PostgreSQL
      for (const p of batch) {
        const prodId = codeToIdMap.get(String(p.code).trim());
        if (!prodId) continue;

        if (p.variants && p.variants.length > 0) {
          try {
            await clientOrPool.query('DELETE FROM product_variants WHERE product_id = $1', [prodId]);
            for (const v of p.variants) {
              await clientOrPool.query(
                'INSERT INTO product_variants (product_id, size, color, barcode, available_qty) VALUES ($1, $2, $3, $4, $5)',
                [prodId, v.size || null, v.color || null, v.barcode || null, Number(v.available_qty) || 0.0]
              );
            }
          } catch (vErr: any) {
            console.error(`[PostgreSQL Variants Warning] Error for product ${p.code}:`, vErr?.message || vErr);
          }
        }

        if (p.extra_barcodes && p.extra_barcodes.length > 0) {
          try {
            await clientOrPool.query('DELETE FROM product_extra_barcodes WHERE product_id = $1', [prodId]);
            for (const eb of p.extra_barcodes) {
              await clientOrPool.query(
                'INSERT INTO product_extra_barcodes (product_id, barcode, package_qty) VALUES ($1, $2, $3)',
                [prodId, eb.barcode, eb.package_qty !== null && eb.package_qty !== undefined ? Number(eb.package_qty) : null]
              );
            }
          } catch (ebErr: any) {
            console.error(`[PostgreSQL ExtraBarcodes Warning] Error for product ${p.code}:`, ebErr?.message || ebErr);
          }
        }
      }
    } catch (batchErr: any) {
      console.error(`[PostgreSQL Batch Products ERROR] Failed batch chunk starting at index ${i}:`, batchErr?.message || batchErr);
    }
  }

  return { inserted: totalInserted, updated: totalUpdated, total: validProducts.length };
}

export async function deleteProductsByCodesInPostgres(
  codes: string[],
  clientOrPool: pg.PoolClient | pg.Pool = pool
): Promise<number> {
  if (!codes || codes.length === 0) return 0;
  const cleanCodes = codes.map(c => String(c).trim()).filter(Boolean);
  if (cleanCodes.length === 0) return 0;

  try {
    const res = await clientOrPool.query(
      'DELETE FROM products WHERE code = ANY($1) AND (online_customized = false OR online_customized IS NULL)',
      [cleanCodes]
    );
    return res.rowCount || 0;
  } catch (err: any) {
    console.error('[PostgreSQL Delete Products ERROR]', err?.message || err);
    return 0;
  }
}

export async function upsertClientsBatchInPostgres(
  clients: ClientUpsertPayload[],
  clientOrPool: pg.PoolClient | pg.Pool = pool
): Promise<{ inserted: number; updated: number; total: number }> {
  if (!clients || clients.length === 0) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  const validClients = clients.filter(c => c && c.name && c.name.trim());
  if (validClients.length === 0) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  let totalInserted = 0;
  let totalUpdated = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < validClients.length; i += BATCH_SIZE) {
    const batch = validClients.slice(i, i + BATCH_SIZE);
    try {
      for (const c of batch) {
        const res = await upsertClientInPostgres(c, clientOrPool);
        if (res.status === 'inserted') totalInserted++;
        if (res.status === 'updated') totalUpdated++;
      }
    } catch (batchErr: any) {
      console.error(`[PostgreSQL Batch Clients ERROR] Failed batch chunk starting at index ${i}:`, batchErr?.message || batchErr);
    }
  }

  return { inserted: totalInserted, updated: totalUpdated, total: validClients.length };
}

export function formatQuery(sql: string): string {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

export function sanitizeSql(sql: string): string {
  return sql
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/DATETIME/gi, 'TIMESTAMP')
    .replace(/COLLATE\s+NOCASE/gi, '')
    .replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+/gi, 'INSERT INTO ')
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+/gi, 'INSERT INTO ')
    .replace(/INSERT\s+OR\s+REPLACE\s+/gi, 'INSERT ')
    .replace(/INSERT\s+OR\s+IGNORE\s+/gi, 'INSERT ');
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<pg.QueryResult<T>> {
  const formattedSql = formatQuery(sql);
  try {
    return await pool.query<T>(formattedSql, params);
  } catch (err: any) {
    console.error(`[DB ERROR - Neon PostgreSQL query failed] SQL: "${formattedSql}", Params: ${JSON.stringify(params)} - Error: ${err?.message || err}`);
    throw err;
  }
}

export async function queryGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const formattedSql = formatQuery(sql);
  try {
    const res = await pool.query(formattedSql, params);
    return res.rows[0];
  } catch (err: any) {
    console.error(`[DB ERROR - Neon PostgreSQL queryGet failed] SQL: "${formattedSql}", Params: ${JSON.stringify(params)} - Error: ${err?.message || err}`);
    throw err;
  }
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const formattedSql = formatQuery(sql);
  try {
    const res = await pool.query(formattedSql, params);
    return res.rows;
  } catch (err: any) {
    console.error(`[DB ERROR - Neon PostgreSQL queryAll failed] SQL: "${formattedSql}", Params: ${JSON.stringify(params)} - Error: ${err?.message || err}`);
    throw err;
  }
}

export async function queryRun(sql: string, params: any[] = []): Promise<{ changes: number; rowCount: number; lastInsertRowid?: number | string }> {
  let formattedSql = formatQuery(sql);
  const isInsert = /^\s*INSERT\s+/i.test(formattedSql);
  const hasReturning = /\bRETURNING\b/i.test(formattedSql);

  if (isInsert && !hasReturning) {
    formattedSql += ' RETURNING *';
  }

  try {
    const res = await pool.query(formattedSql, params);
    const insertedRow = res.rows[0];
    const lastInsertRowid = insertedRow ? (insertedRow.id ?? insertedRow.user_id ?? insertedRow.task_id) : undefined;

    return {
      changes: res.rowCount ?? 0,
      rowCount: res.rowCount ?? 0,
      lastInsertRowid,
    };
  } catch (err: any) {
    console.error(`[DB ERROR - Neon PostgreSQL queryRun failed] SQL: "${formattedSql}", Params: ${JSON.stringify(params)} - Error: ${err?.message || err}`);
    throw err;
  }
}

export async function queryExec(sqlScript: string): Promise<void> {
  const sanitized = sanitizeSql(sqlScript);
  try {
    await pool.query(sanitized);
  } catch (err: any) {
    console.error(`[DB ERROR - Neon PostgreSQL queryExec failed] Script Length: ${sanitized.length} - Error: ${err?.message || err}`);
    throw err;
  }
}

export async function initDatabase(): Promise<void> {
  try {
    try {
      await queryExec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT 'password123',
      department TEXT,
      role TEXT,
      avatar TEXT,
      ical_token TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      notes TEXT,
      agente TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      category TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id INTEGER,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      internal_notes TEXT,
      category_id INTEGER,
      assignee_id INTEGER,
      status TEXT DEFAULT 'Nuovo',
      type TEXT CHECK(type IN ('cliente', 'interno', 'fornitore')),
      priority TEXT DEFAULT 'Media' CHECK(priority IN ('Bassa', 'Media', 'Alta', 'Urgente')),
      client_id INTEGER,
      supplier_id INTEGER,
      creator_id INTEGER,
      deadline TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (task_id, tag_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id SERIAL PRIMARY KEY,
      caller_name TEXT NOT NULL,
      caller_type TEXT CHECK(caller_type IN ('cliente', 'fornitore', 'esterno')),
      reason TEXT,
      duration INTEGER,
      task_id INTEGER,
      client_id INTEGER,
      supplier_id INTEGER,
      category_id INTEGER,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backups (
      id SERIAL PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS task_notes (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_notification_settings (
      user_id INTEGER PRIMARY KEY,
      task_deadline BOOLEAN DEFAULT TRUE,
      new_task BOOLEAN DEFAULT TRUE,
      comments BOOLEAN DEFAULT TRUE,
      weekly_report BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT,
      title TEXT,
      message TEXT,
      related_id INTEGER,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0.0,
      vat_code TEXT DEFAULT '22',
      um TEXT DEFAULT 'pz',
      stock REAL DEFAULT 0,
      classe_provvigione TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      agent_id INTEGER,
      date TEXT NOT NULL,
      number TEXT,
      payment_name TEXT,
      payment_bank TEXT,
      notes TEXT,
      total REAL DEFAULT 0.0,
      status TEXT DEFAULT 'Nuovo',
      is_imported INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      synced_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_code TEXT NOT NULL,
      description TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 1.0,
      price REAL NOT NULL DEFAULT 0.0,
      vat_code TEXT DEFAULT '22',
      um TEXT DEFAULT 'pz',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      size TEXT,
      color TEXT,
      barcode TEXT,
      available_qty REAL DEFAULT 0.0,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_extra_barcodes (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      barcode TEXT NOT NULL,
      package_qty REAL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_visits (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      visit_date TEXT NOT NULL,
      time_slot TEXT DEFAULT '09:00',
      notes TEXT,
      is_joint INTEGER DEFAULT 0,
      host_agent_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(agent_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(host_agent_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS co_visit_invites (
      id SERIAL PRIMARY KEY,
      visit_id INTEGER NOT NULL,
      host_agent_id INTEGER NOT NULL,
      guest_agent_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      visit_date TEXT NOT NULL,
      time_slot TEXT DEFAULT '09:00',
      status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(visit_id) REFERENCES agent_visits(id) ON DELETE CASCADE,
      FOREIGN KEY(host_agent_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(guest_agent_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS client_sales_history (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'product',
      code TEXT,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      document_number TEXT,
      document_date TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
    `);
    } catch (tableErr) {
      console.error('[PostgreSQL Engine ERROR] Error creating initial tables:', tableErr);
    }

  // Column additions safely in fast combined statements
  const clientCols = [
    'web_login TEXT', 'postcode TEXT', 'province TEXT', 'country TEXT', 'fiscal_code TEXT', 'vat_code TEXT',
    'sdi_pec TEXT', 'cell_phone TEXT', 'fax TEXT', 'pec TEXT', 'delivery_name TEXT', 'delivery_address TEXT',
    'delivery_postcode TEXT', 'delivery_city TEXT', 'delivery_province TEXT', 'delivery_country TEXT',
    'price_list TEXT', 'payment_name TEXT', 'payment_bank TEXT', 'custom_field1 TEXT', 'custom_field2 TEXT',
    'custom_field3 TEXT', 'custom_field4 TEXT',
    'agente TEXT', 'code TEXT', 'address TEXT', 'city TEXT', 'contact TEXT', 'phone TEXT', 'email TEXT', 'notes TEXT'
  ];
  try {
    const clientAddCols = clientCols.map(c => `ADD COLUMN IF NOT EXISTS ${c}`).join(', ');
    await pool.query(`ALTER TABLE clients ${clientAddCols}`);
  } catch (e) {
    console.error('[PostgreSQL Engine ERROR] clientCols alter table error:', e);
  }

  try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_imported INTEGER DEFAULT 0`); } catch (e) {
    console.error('[PostgreSQL Engine ERROR] orders is_imported alter error:', e);
  }
  try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_synced INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP`); } catch (e) {
    console.error('[PostgreSQL Engine ERROR] orders is_synced alter error:', e);
  }

  // Ensure non-imported orders have '/conn' suffix in their order number
  try {
    await pool.query(`
      UPDATE orders 
      SET number = CASE 
        WHEN number IS NOT NULL AND number != '' AND number NOT LIKE '%/conn' THEN number || '/conn'
        WHEN number IS NULL OR number = '' THEN id::text || '/conn'
        ELSE number 
      END
      WHERE (is_imported = 0 OR is_imported IS NULL) AND (number NOT LIKE '%/conn' OR number IS NULL OR number = '')
    `);
  } catch (e) {
    console.error('[PostgreSQL Engine ERROR] orders /conn suffix migration error:', e);
  }

  try {
    await pool.query(`ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS ical_token TEXT,
      ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT 'password123',
      ADD COLUMN IF NOT EXISTS avatar TEXT
    `);
  } catch (e) {
    console.error('[PostgreSQL Engine ERROR] users alter error:', e);
  }

  const productCols = [
    'barcode TEXT', 'category TEXT', 'subcategory TEXT', 'description_html TEXT', 'producer_name TEXT',
    'link TEXT', 'notes TEXT', 'image_file_name TEXT', 'supplier_code TEXT', 'supplier_name TEXT',
    'supplier_product_code TEXT', 'supplier_net_price REAL DEFAULT 0.0', 'supplier_gross_price REAL DEFAULT 0.0',
    'supplier_notes TEXT', 'manage_warehouse BOOLEAN DEFAULT TRUE', 'warehouse_location TEXT',
    'min_stock REAL DEFAULT 0.0', 'ordered_qty REAL DEFAULT 0.0', 'weight_um TEXT',
    'net_weight REAL DEFAULT 0.0', 'gross_weight REAL DEFAULT 0.0', 'size_um TEXT',
    'net_size_x REAL DEFAULT 0.0', 'net_size_y REAL DEFAULT 0.0', 'net_size_z REAL DEFAULT 0.0',
    'custom_field1 TEXT', 'custom_field2 TEXT', 'custom_field3 TEXT', 'custom_field4 TEXT',
    'online_promo TEXT', 'online_warranty TEXT', 'online_category_image TEXT', 'online_notes TEXT',
    'online_customized BOOLEAN DEFAULT FALSE',
    'classe_provvigione TEXT'
  ];
  try {
    const productAddCols = productCols.map(c => `ADD COLUMN IF NOT EXISTS ${c}`).join(', ');
    await pool.query(`ALTER TABLE products ${productAddCols}`);
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS classe_provvigione TEXT`);
  } catch (e) {
    console.error('[PostgreSQL Engine ERROR] productCols alter table error:', e);
  }

  const historyCols = [
    'category TEXT', 'unit_of_measure TEXT', 'unit_price REAL DEFAULT 0.0', 'is_imported BOOLEAN DEFAULT TRUE'
  ];
  try {
    const historyAddCols = historyCols.map(c => `ADD COLUMN IF NOT EXISTS ${c}`).join(', ');
    await pool.query(`ALTER TABLE client_sales_history ${historyAddCols}`);
  } catch (e) {
    console.error('[PostgreSQL Engine ERROR] client_sales_history alter table error:', e);
  }

  try {
    await pool.query(`ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Media',
      ADD COLUMN IF NOT EXISTS supplier_id INTEGER,
      ADD COLUMN IF NOT EXISTS internal_notes TEXT,
      ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0
    `);
  } catch (e) {
    console.error('[PostgreSQL Engine ERROR] tasks alter table error:', e);
  }

  try {
    await pool.query(`ALTER TABLE calls 
      ADD COLUMN IF NOT EXISTS caller_type TEXT,
      ADD COLUMN IF NOT EXISTS duration INTEGER,
      ADD COLUMN IF NOT EXISTS category_id INTEGER,
      ADD COLUMN IF NOT EXISTS client_id INTEGER,
      ADD COLUMN IF NOT EXISTS supplier_id INTEGER,
      ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0
    `);
  } catch (e) {
    console.error('[PostgreSQL Engine ERROR] calls alter table error:', e);
  }

  // easyfatt_settings
  try {
    await queryExec(`
      CREATE TABLE IF NOT EXISTS easyfatt_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        default_payment TEXT DEFAULT 'Bonifico bancario',
        min_order_total REAL DEFAULT 0.0,
        default_notes TEXT DEFAULT '',
        default_vat TEXT DEFAULT '22',
        prices_include_vat INTEGER DEFAULT 0,
        product_link_filter TEXT DEFAULT 'all',
        product_commission_filter TEXT
      );
    `);
    await pool.query('ALTER TABLE easyfatt_settings ADD COLUMN IF NOT EXISTS product_commission_filter TEXT');
    const existing = await queryGet('SELECT id FROM easyfatt_settings WHERE id = 1');
    if (!existing) {
      await queryRun("INSERT INTO easyfatt_settings (id, username, password, default_payment, min_order_total, default_notes, default_vat, prices_include_vat, product_link_filter, product_commission_filter) VALUES (1, 'admin@connect.com', 'password123', 'Bonifico bancario', 0.0, '', '22', 0, 'all', NULL) ON CONFLICT (id) DO NOTHING");
    }
  } catch (e) {
    console.error("[PostgreSQL Engine ERROR] Error setting up easyfatt_settings table:", e);
  }

  // company_header
  try {
    await queryExec(`
      CREATE TABLE IF NOT EXISTS company_header (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        company_name TEXT DEFAULT 'Connect Beauty S.r.l.',
        company_address TEXT DEFAULT 'Via Armando Diaz 162',
        company_postcode TEXT DEFAULT '35010',
        company_city TEXT DEFAULT 'Vigonza',
        company_province TEXT DEFAULT 'PD',
        company_country TEXT DEFAULT 'Italia',
        company_vat_code TEXT DEFAULT '00165987261',
        company_fiscal_code TEXT DEFAULT '00165987261',
        company_tel TEXT DEFAULT '049/1234567',
        company_fax TEXT DEFAULT '049/1234568',
        company_email TEXT DEFAULT 'info@connect-beauty.it',
        company_pec TEXT DEFAULT 'connectbeauty@pec.it',
        company_website TEXT DEFAULT 'www.connect-beauty.it',
        company_logo TEXT DEFAULT ''
      );
    `);
    const existingCH = await queryGet('SELECT id FROM company_header WHERE id = 1');
    if (!existingCH) {
      await queryRun(`
        INSERT INTO company_header (
          id, company_name, company_address, company_postcode, company_city, 
          company_province, company_country, company_vat_code, company_fiscal_code, 
          company_tel, company_fax, company_email, company_pec, company_website, company_logo
        ) VALUES (
          1, 'Connect Beauty S.r.l.', 'Via Armando Diaz 162', '35010', 'Vigonza',
          'PD', 'Italia', '00165987261', '00165987261',
          '049/1234567', '049/1234568', 'info@connect-beauty.it', 'connectbeauty@pec.it', 'www.connect-beauty.it', ''
        ) ON CONFLICT (id) DO NOTHING
      `);
    }
  } catch (e) {
    console.error("[PostgreSQL Engine ERROR] Error setting up company_header table:", e);
  }

  // payment_methods
  try {
    await queryExec(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        offset_days INTEGER DEFAULT 0,
        installments INTEGER DEFAULT 1,
        fine_mese INTEGER DEFAULT 0,
        custom_offsets TEXT
      );
    `);
    await pool.query("INSERT INTO payment_methods (name, offset_days, installments, fine_mese) VALUES ('Bonifico bancario', 0, 1, 0) ON CONFLICT (name) DO NOTHING");
    await pool.query("INSERT INTO payment_methods (name, offset_days, installments, fine_mese) VALUES ('R.B. 30/60 gg F.M.', 30, 2, 1) ON CONFLICT (name) DO NOTHING");
    await pool.query("INSERT INTO payment_methods (name, offset_days, installments, fine_mese) VALUES ('Contanti', 0, 1, 0) ON CONFLICT (name) DO NOTHING");
    await pool.query("INSERT INTO payment_methods (name, offset_days, installments, fine_mese) VALUES ('Carta di Credito', 0, 1, 0) ON CONFLICT (name) DO NOTHING");
    await pool.query("INSERT INTO payment_methods (name, offset_days, installments, fine_mese) VALUES ('Contrassegno', 0, 1, 0) ON CONFLICT (name) DO NOTHING");
  } catch (e) {
    console.error("[PostgreSQL Engine ERROR] Error setting up payment_methods table:", e);
  }

  // Initial seed
  try {
    const userCount = await queryGet<{ count: string | number }>('SELECT COUNT(*) as count FROM users');
    if (Number(userCount?.count || 0) === 0) {
      await queryRun('INSERT INTO users (name, email, password, department, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING', ['Amministratore', 'info@connectitalia.com', 'Genmb456!', 'direzionale', 'admin']);
      await queryRun('INSERT INTO users (name, email, password, department, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING', ['Mario Rossi', 'mario@connect.com', 'password123', 'marketing', 'user']);
      await queryRun('INSERT INTO users (name, email, password, department, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING', ['Luigi Bianchi', 'luigi@connect.com', 'password123', 'assistenza tecnica', 'user']);
      await queryRun('INSERT INTO users (name, email, password, department, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING', ['Elena Verdi', 'elena@connect.com', 'password123', 'grafica', 'user']);

      await queryRun("INSERT INTO tags (name, color) VALUES ('Urgente', '#EF4444') ON CONFLICT (name) DO NOTHING");
      await queryRun("INSERT INTO tags (name, color) VALUES ('In attesa', '#F59E0B') ON CONFLICT (name) DO NOTHING");
      await queryRun("INSERT INTO tags (name, color) VALUES ('Approvato', '#10B981') ON CONFLICT (name) DO NOTHING");
      await queryRun("INSERT INTO tags (name, color) VALUES ('Revisione', '#3B82F6') ON CONFLICT (name) DO NOTHING");

      await queryRun('INSERT INTO suppliers (name, contact, phone, email, category, notes) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING', ['Cosmetic Pack Srl', 'Roberto Neri', '021234567', 'info@cosmeticpack.it', 'Packaging', 'Fornitore principale flaconi']);
      await queryRun('INSERT INTO suppliers (name, contact, phone, email, category, notes) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING', ['Essence Lab', 'Giulia Bruni', '051987654', 'lab@essencelab.com', 'Materie prime', 'Fragranze e oli essenziali']);

      const insertCategory = async (name: string, parentId: number | string | null = null): Promise<number | null> => {
        const existing = await queryGet<{ id: number }>('SELECT id FROM categories WHERE name = ?', [name]);
        if (existing) return Number(existing.id);
        const res = await queryRun('INSERT INTO categories (name, parent_id) VALUES (?, ?)', [name, parentId ? Number(parentId) : null]);
        return res.lastInsertRowid ? Number(res.lastInsertRowid) : null;
      };

      const marketId = await insertCategory('Marketing', null);
      await insertCategory('Campagne', marketId);
      await insertCategory('Comunicazione', marketId);
      await insertCategory('Social', marketId);

      const commId = await insertCategory('Commerciale', null);
      await insertCategory('Richieste cliente', commId);
      await insertCategory('Supporto vendita', commId);
      await insertCategory('Follow up', commId);

      const adminId = await insertCategory('Amministrazione', null);
      await insertCategory('Pagamenti', adminId);
      await insertCategory('Documentazione', adminId);
      await insertCategory('Pratiche', adminId);

      const assistId = await insertCategory('Assistenza', null);
      await insertCategory('Guasto', assistId);
      await insertCategory('Manutenzione', assistId);
      await insertCategory('Supporto tecnico', assistId);

      const direzId = await insertCategory('Direzionale', null);
      await insertCategory('Strategia', direzId);
      await insertCategory('Sviluppo Business', direzId);
      await insertCategory('Risorse Umane', direzId);

      const graphId = await insertCategory('Grafica', null);
      await insertCategory('Materiali pubblicitari', graphId);
      await insertCategory('Contenuti grafici', graphId);
      await insertCategory('Packaging', graphId);

      const logId = await insertCategory('Logistica', null);
      await insertCategory('Spedizioni', logId);
      await insertCategory('Gestione ordine', logId);
      await insertCategory('Magazzino', logId);
    } else {
      const existingAdmin = await queryGet('SELECT * FROM users WHERE email = ? OR email = ?', ['info@connectitalia.com', 'info@masterbeautyitalia.com']);
      if (existingAdmin) {
        await queryRun('UPDATE users SET email = ?, password = ?, role = ? WHERE id = ?', ['info@connectitalia.com', 'Genmb456!', 'admin', existingAdmin.id]);
      } else {
        await queryRun('INSERT INTO users (name, email, password, department, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING', ['Amministratore', 'info@connectitalia.com', 'Genmb456!', 'direzionale', 'admin']);
      }
    }
  } catch (err) {
    console.error('[PostgreSQL Engine ERROR] Error seeding users and categories:', err);
  }

  // Seed default products
  try {
    const prodCount = await queryGet<{ count: string | number }>('SELECT COUNT(*) as count FROM products');
    if (Number(prodCount?.count || 0) === 0) {
      await queryRun('INSERT INTO products (code, description, price, vat_code, um, stock) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (code) DO NOTHING', ['SV-001', 'Siero Viso Idratante Antietà (Visage Seta 50ml)', 45.00, '22', 'pz', 120]);
      await queryRun('INSERT INTO products (code, description, price, vat_code, um, stock) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (code) DO NOTHING', ['SH-002', 'Shampoo Professionale Ristrutturante (KeraGlow 1L)', 22.50, '22', 'pz', 80]);
      await queryRun('INSERT INTO products (code, description, price, vat_code, um, stock) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (code) DO NOTHING', ['MS-003', 'Maschera Capelli Idratante Profonda (KeraGlow 500ml)', 18.00, '22', 'pz', 95]);
      await queryRun('INSERT INTO products (code, description, price, vat_code, um, stock) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (code) DO NOTHING', ['OC-004', 'Olio Corpo Purificante Termale (ThermaSpa 250ml)', 34.00, '22', 'pz', 60]);
      await queryRun('INSERT INTO products (code, description, price, vat_code, um, stock) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (code) DO NOTHING', ['CR-005', 'Crema Massaggio Rilassante Arnica (ProBody 1L)', 28.50, '22', 'pz', 45]);
      await queryRun('INSERT INTO products (code, description, price, vat_code, um, stock) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (code) DO NOTHING', ['GL-006', 'Gel Igienizzante Mani Aloe Vera (CleanSan 5L)', 15.00, '22', 'pz', 150]);
      await queryRun('INSERT INTO products (code, description, price, vat_code, um, stock) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (code) DO NOTHING', ['SM-007', 'Smalto Semipermanente Rosso Connect (ColorMax 15ml)', 9.90, '22', 'pz', 300]);
    }
  } catch (err) {
    console.error('[PostgreSQL Engine ERROR] Error seeding products:', err);
  }

  // Seed clients
  try {
    const clientCount = await queryGet<{ count: string | number }>('SELECT COUNT(*) as count FROM clients');
    if (Number(clientCount?.count || 0) === 0) {
      await queryRun("INSERT INTO clients (code, name, contact, phone, email, city, notes, agente) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING", ['CLI-001', 'Centro Estetico BellaVita', 'Laura Conti', '02 882233', 'info@bellavita.it', 'Milano', 'Cliente premium trattamenti viso', 'Mario Rossi']);
      await queryRun("INSERT INTO clients (code, name, contact, phone, email, city, notes, agente) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING", ['CLI-002', 'Atelier Bellezza Seta', 'Sara Galli', '039 123456', 'contatto@atelier-seta.it', 'Monza', 'Richiede campionatura nuova linea sieri', 'Mario Rossi']);
      await queryRun("INSERT INTO clients (code, name, contact, phone, email, city, notes, agente) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING", ['CLI-003', 'Spa Relax & Beauty', 'Marco Vanni', '011 554433', 'direzione@sparelax.it', 'Torino', 'Interessato a trattamenti corpo termali', 'Luigi Bianchi']);
      await queryRun("INSERT INTO clients (code, name, contact, phone, email, city, notes, agente) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING", ['CLI-004', 'Nail & Skin Studio', 'Elena Rinaldi', '0321 887766', 'info@nailskin.it', 'Novara', 'Fornitura mensile smalti semipermanenti', 'Luigi Bianchi']);
      await queryRun("INSERT INTO clients (code, name, contact, phone, email, city, notes, agente) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING", ['CLI-005', 'Centro Benessere Armonia', 'Chiara Fontana', '051 443322', 'armonia@benessere.it', 'Bologna', 'Dimostrazione macchinari estetici', 'Elena Verdi']);
    } else {
      const unassigned = await queryAll<{ id: number }>("SELECT id FROM clients WHERE agente IS NULL OR agente = ''");
      if (unassigned.length > 0) {
        const agents = ['Mario Rossi', 'Luigi Bianchi', 'Elena Verdi'];
        for (let idx = 0; idx < unassigned.length; idx++) {
          await queryRun("UPDATE clients SET agente = ? WHERE id = ?", [agents[idx % agents.length], unassigned[idx].id]);
        }
      }
    }
  } catch (err) {
    console.error('[PostgreSQL Engine ERROR] Error seeding clients:', err);
  }

  // Seed initial visits
  try {
    const visitCount = await queryGet<{ count: string | number }>('SELECT COUNT(*) as count FROM agent_visits');
    if (Number(visitCount?.count || 0) === 0) {
      const mario = await queryGet<{ id: number }>("SELECT id FROM users WHERE name = 'Mario Rossi'");
      const luigi = await queryGet<{ id: number }>("SELECT id FROM users WHERE name = 'Luigi Bianchi'");
      const client1 = await queryGet<{ id: number }>("SELECT id FROM clients WHERE name = 'Centro Estetico BellaVita'");
      const client3 = await queryGet<{ id: number }>("SELECT id FROM clients WHERE name = 'Spa Relax & Beauty'");

      const todayStr = new Date().toISOString().split('T')[0];

      if (mario && client1) {
        await queryRun(`
          INSERT INTO agent_visits (agent_id, client_id, visit_date, time_slot, notes)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT DO NOTHING
        `, [mario.id, client1.id, todayStr, '10:00', 'Presentazione nuovo siero antietà Visage Seta']);
      }

      if (luigi && client3) {
        await queryRun(`
          INSERT INTO agent_visits (agent_id, client_id, visit_date, time_slot, notes)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT DO NOTHING
        `, [luigi.id, client3.id, todayStr, '14:30', 'Dimostrazione trattamenti olio corpo ThermaSpa']);
      }
    }
  } catch (err) {
    console.error('[PostgreSQL Engine ERROR] Error seeding initial visits:', err);
  }
  } catch (fatalInitError) {
    console.error('[DB INIT ERROR]', fatalInitError);
  }
}

export const initPgSchema = initDatabase;

export async function ensureClientInSqlite(clientId: any, _sqliteDb?: any): Promise<number | null> {
  if (clientId === undefined || clientId === null || clientId === '') return null;
  const numId = Number(clientId);

  if (!isNaN(numId) && numId > 0) {
    try {
      const pgRes = await pool.query('SELECT id FROM clients WHERE id = $1', [numId]);
      if (pgRes.rows && pgRes.rows.length > 0) return pgRes.rows[0].id;
    } catch (e) {
      console.error('[ensureClientInSqlite] Error checking Postgres by id:', e);
    }
  }

  try {
    const strVal = String(clientId).trim();
    if (strVal) {
      const pgMatch = await pool.query('SELECT id FROM clients WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($2) LIMIT 1', [strVal, strVal]);
      if (pgMatch.rows && pgMatch.rows.length > 0) return pgMatch.rows[0].id;
    }
  } catch (err) {
    console.error('[ensureClientInSqlite] Error in Postgres client matching:', err);
  }

  return null;
}

export const ensureClientInPostgres = ensureClientInSqlite;

export const TABLE_DEPENDENCY_ORDER = [
  'users',
  'categories',
  'tags',
  'suppliers',
  'clients',
  'products',
  'product_variants',
  'product_extra_barcodes',
  'payment_methods',
  'company_header',
  'easyfatt_settings',
  'orders',
  'order_items',
  'tasks',
  'task_tags',
  'task_history',
  'task_notes',
  'calls',
  'attachments',
  'backups',
  'user_notification_settings',
  'user_notifications',
  'agent_visits',
  'co_visit_invites',
  'client_sales_history'
];

/**
 * Historical SQLite migration and sync functions - now no-ops in 100% PostgreSQL architecture.
 */
export async function migrateAllSqliteToPostgres(_sqliteDb?: any): Promise<{ migratedTables: Record<string, number> }> {
  return { migratedTables: {} };
}

export async function fullSyncAllTablesFromPostgresToSqlite(_sqliteDb?: any): Promise<void> {
  // No-op: The system runs exclusively on PostgreSQL.
}

export function runWithoutReplication<T>(fn: () => T): T {
  return fn();
}

export async function replicateMutationToPostgres(_sql: string, _params: any[], _result: any): Promise<void> {
  // No-op: Mutations run directly against PostgreSQL.
}

export function installPostgresReplicationHook(_sqliteDb?: any): void {
  // No-op: The system runs exclusively on PostgreSQL.
}

/**
 * Explicit transaction handler for creating Orders in PostgreSQL with ACID safety.
 */
export async function createOrderInPostgres(orderData: {
  client_id: number;
  agent_id: number | null;
  date: string;
  number?: string;
  payment_name: string;
  payment_bank: string;
  notes: string;
  items: Array<{
    product_code: string;
    description: string;
    qty: number;
    price: number;
    vat_code: string;
    um: string;
  }>;
  status: string;
  sqliteDb?: any;
}): Promise<{ orderId: number; formattedNumber: string }> {
  const { client_id, agent_id, date, payment_name, payment_bank, notes, items, status } = orderData;

  return await withTransaction(async (pgClient) => {
    // 1. Calculate total
    let total = 0;
    for (const item of items) {
      total += (Number(item.qty) || 0) * (Number(item.price) || 0);
    }

    // 2. Insert order in PostgreSQL
    const initialNumber = orderData.number
      ? (String(orderData.number).endsWith('/conn') ? String(orderData.number).trim() : `${String(orderData.number).trim()}/conn`)
      : null;

    const orderRes = await pgClient.query(
      `INSERT INTO orders (client_id, agent_id, date, number, payment_name, payment_bank, notes, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        client_id,
        agent_id,
        date || new Date().toISOString().split('T')[0],
        initialNumber,
        payment_name || 'Bonifico bancario',
        payment_bank || '',
        notes || '',
        total,
        status || 'Nuovo'
      ]
    );

    const orderId = orderRes.rows[0].id;
    let formattedNumber = orderData.number ? String(orderData.number).trim() : '';
    if (formattedNumber) {
      if (!formattedNumber.endsWith('/conn')) {
        formattedNumber = `${formattedNumber}/conn`;
      }
    } else {
      formattedNumber = `${orderId}/conn`;
    }

    // Ensure order number in PG is always saved with the '/conn' suffix
    await pgClient.query('UPDATE orders SET number = $1 WHERE id = $2', [formattedNumber, orderId]);

    // 3. Insert items in PostgreSQL & update stock
    for (const item of items) {
      await pgClient.query(
        `INSERT INTO order_items (order_id, product_code, description, qty, price, vat_code, um)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          item.product_code,
          item.description,
          Number(item.qty) || 1,
          Number(item.price) || 0,
          item.vat_code || '22',
          item.um || 'pz'
        ]
      );

      if (status !== 'Bozza') {
        await pgClient.query(
          'UPDATE products SET stock = GREATEST(0, stock - $1) WHERE code = $2',
          [Number(item.qty) || 0, item.product_code]
        );
      }
    }

    return { orderId, formattedNumber };
  }, 'CreateOrderPostgres');
}

/**
 * Updates an order in PostgreSQL with ACID safety.
 */
export async function updateOrderInPostgres(orderId: number, orderData: {
  client_id: number;
  date: string;
  payment_name: string;
  payment_bank: string;
  notes: string;
  items: Array<{
    product_code: string;
    description: string;
    qty: number;
    price: number;
    vat_code: string;
    um: string;
  }>;
  status: string;
  sqliteDb?: any;
}): Promise<void> {
  const { client_id, date, payment_name, payment_bank, notes, items, status } = orderData;

  await withTransaction(async (pgClient) => {
    let total = 0;
    for (const item of items) {
      total += (Number(item.qty) || 0) * (Number(item.price) || 0);
    }

    // 1. Update order in PostgreSQL
    await pgClient.query(
      `UPDATE orders SET client_id = $1, date = $2, payment_name = $3, payment_bank = $4, notes = $5, total = $6, status = $7 WHERE id = $8`,
      [client_id, date, payment_name || 'Bonifico bancario', payment_bank || '', notes || '', total, status || 'Nuovo', orderId]
    );

    // 2. Replace items in PostgreSQL
    await pgClient.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
    for (const item of items) {
      await pgClient.query(
        `INSERT INTO order_items (order_id, product_code, description, qty, price, vat_code, um)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, item.product_code, item.description, Number(item.qty) || 1, Number(item.price) || 0, item.vat_code || '22', item.um || 'pz']
      );
    }
  }, 'UpdateOrderPostgres');
}

/**
 * Deletes an order from PostgreSQL.
 */
export async function deleteOrderInPostgres(orderId: number, _sqliteDb?: any): Promise<void> {
  await withTransaction(async (pgClient) => {
    await pgClient.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
    await pgClient.query('DELETE FROM orders WHERE id = $1', [orderId]);
  }, 'DeleteOrderPostgres');
}

/**
 * Diagnostic database status report for PostgreSQL.
 */
export async function getDatabaseStatus(_sqliteDb?: any): Promise<any> {
  const t0 = Date.now();
  let pgConnected = false;
  let latencyMs = -1;
  const tableCounts: Record<string, { postgres: number; sqlite: number }> = {};

  try {
    const pingRes = await pool.query('SELECT 1 as ping');
    if (pingRes.rows && pingRes.rows[0].ping === 1) {
      pgConnected = true;
      latencyMs = Date.now() - t0;
    }
  } catch (err: any) {
    pgConnected = false;
  }

  for (const table of TABLE_DEPENDENCY_ORDER) {
    let pgCount = 0;

    if (pgConnected) {
      try {
        const c = await pool.query(`SELECT COUNT(*) as count FROM "${table}"`);
        pgCount = Number(c.rows[0]?.count || 0);
      } catch (e) {}
    }

    tableCounts[table] = { postgres: pgCount, sqlite: pgCount };
  }

  return {
    postgres: {
      connected: pgConnected,
      latencyMs,
      endpoint: getMaskedDbUrl(),
      ssl: true
    },
    tables: tableCounts,
    replicationHookActive: false
  };
}


