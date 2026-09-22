import { pool } from '../lib/db';

export interface PaymentMethodRule {
  id?: number;
  name: string;
  offset_days: number;
  installments: number;
  fine_mese: boolean;
  custom_offsets?: string | number[] | null;
}

export interface ScheduledInstallment {
  installment_index: number;
  due_date: string; // YYYY-MM-DD
  amount: number;   // 2 decimal places, exact sum
  is_advance: boolean;
  is_paid: boolean;
  paid_date: string | null;
  source_type: 'AUTO' | 'DANEA' | 'ADMIN_MANUAL';
  notes: string;
  payment_method?: string;
}

/**
 * Format a Date object as YYYY-MM-DD string
 */
export function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse an ISO date string (YYYY-MM-DD) safely at midday (12:00:00)
 * to avoid timezone shifts and daylight-saving time edge cases.
 */
export function parseIsoDate(dateStr?: string | null): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  }
  const clean = dateStr.trim().split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 12, 0, 0);
    }
  }
  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

/**
 * Returns the last day of the month for the given Date as YYYY-MM-DD.
 */
export function getEndOfMonth(d: Date): string {
  // Day 0 of next month is the last day of current month
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0);
  return formatIsoDate(lastDay);
}

/**
 * Calculate due date given a base date, offset days, and fine_mese flag.
 */
export function calculateDueDate(baseDateStr: string, offsetDays: number, fineMese: boolean = false): string {
  const base = parseIsoDate(baseDateStr);
  const target = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  if (fineMese) {
    return getEndOfMonth(target);
  }
  return formatIsoDate(target);
}

/**
 * Parse custom offsets from comma-separated string, JSON string, or array.
 * Examples: "30,60,90", "[30, 60, 90]", [30, 60, 90]
 */
export function parseCustomOffsets(raw: any): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const nums = raw.map(Number).filter(n => !isNaN(n) && n >= 0);
    return nums.length > 0 ? nums : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const nums = parsed.map(Number).filter(n => !isNaN(n) && n >= 0);
          return nums.length > 0 ? nums : null;
        }
      } catch (e) {
        // Fall back to comma split
      }
    }
    const parts = trimmed.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 0);
    return parts.length > 0 ? parts : null;
  }
  return null;
}

/**
 * Infer payment rule heuristics if not explicitly found in DB.
 * Supports Danea patterns like "R.B. 30/60/90 GG F.M.", "Bonifico 30 gg", "Contanti", etc.
 */
export function inferRuleFromPaymentName(name?: string | null): PaymentMethodRule {
  const norm = (name || '').trim().toLowerCase();
  if (!norm) {
    return { name: 'Bonifico bancario', offset_days: 0, installments: 1, fine_mese: false };
  }

  const isFineMese = norm.includes('f.m.') || norm.includes('fm') || norm.includes('fine mese') || norm.includes('fine_mese');

  if (norm.includes('30/60/90/120')) {
    return { name, offset_days: 30, installments: 4, fine_mese: isFineMese, custom_offsets: '30,60,90,120' };
  }
  if (norm.includes('30/60/90')) {
    return { name, offset_days: 30, installments: 3, fine_mese: isFineMese, custom_offsets: '30,60,90' };
  }
  if (norm.includes('30/60')) {
    return { name, offset_days: 30, installments: 2, fine_mese: isFineMese, custom_offsets: '30,60' };
  }
  if (norm.includes('60/90')) {
    return { name, offset_days: 60, installments: 2, fine_mese: isFineMese, custom_offsets: '60,90' };
  }
  if (norm.includes('90 gg') || norm.includes('90gg') || norm.includes('90 giorni')) {
    return { name, offset_days: 90, installments: 1, fine_mese: isFineMese, custom_offsets: '90' };
  }
  if (norm.includes('60 gg') || norm.includes('60gg') || norm.includes('60 giorni')) {
    return { name, offset_days: 60, installments: 1, fine_mese: isFineMese, custom_offsets: '60' };
  }
  if (norm.includes('30 gg') || norm.includes('30gg') || norm.includes('30 giorni')) {
    return { name, offset_days: 30, installments: 1, fine_mese: isFineMese, custom_offsets: '30' };
  }

  return {
    name: name || 'Standard',
    offset_days: 0,
    installments: 1,
    fine_mese: isFineMese,
    custom_offsets: null
  };
}

/**
 * Retrieve rule from payment_methods table (PostgreSQL native).
 */
export async function getPaymentMethodRule(
  paymentName?: string | null
): Promise<PaymentMethodRule> {
  const searchName = (paymentName || '').trim();
  if (!searchName) {
    return inferRuleFromPaymentName(searchName);
  }

  // Query PostgreSQL pool
  try {
    const res = await pool.query(
      `SELECT * FROM payment_methods WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
      [searchName]
    );
    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      return {
        id: row.id,
        name: row.name,
        offset_days: Number(row.offset_days) || 0,
        installments: Number(row.installments) || 1,
        fine_mese: Boolean(row.fine_mese),
        custom_offsets: row.custom_offsets
      };
    }
  } catch (err) {
    console.warn('[getPaymentMethodRule] Error querying PostgreSQL:', err);
  }

  // Fallback heuristics
  return inferRuleFromPaymentName(searchName);
}

/**
 * Pure calculation function for order installments.
 * Ensures penny-rounding exact match: sum(installments.amount) === orderTotal.
 */
export function calculateInstallments(
  orderTotal: number,
  orderDate: string,
  ruleOrName: string | PaymentMethodRule,
  sourceType: 'AUTO' | 'DANEA' | 'ADMIN_MANUAL' = 'AUTO'
): ScheduledInstallment[] {
  const total = Math.max(0, Number(orderTotal) || 0);
  const baseDateStr = orderDate || formatIsoDate(new Date());

  const rule: PaymentMethodRule =
    typeof ruleOrName === 'string'
      ? inferRuleFromPaymentName(ruleOrName)
      : ruleOrName;

  const customOffsets = parseCustomOffsets(rule.custom_offsets);
  const installmentsCount = customOffsets && customOffsets.length > 0
    ? customOffsets.length
    : Math.max(1, Number(rule.installments) || 1);

  const offsetDays = Number(rule.offset_days) || 0;
  const fineMese = Boolean(rule.fine_mese);

  // Penny rounding logic
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / installmentsCount);
  const remainderCents = totalCents - (baseCents * installmentsCount);

  const installments: ScheduledInstallment[] = [];

  for (let i = 0; i < installmentsCount; i++) {
    // Assign remainder cents to the last installment for accounting standard
    const isLast = i === installmentsCount - 1;
    const centsForThis = isLast ? baseCents + remainderCents : baseCents;
    const amount = Number((centsForThis / 100).toFixed(2));

    // Determine offset
    let curOffset: number;
    if (customOffsets && customOffsets.length > 0) {
      if (i < customOffsets.length) {
        curOffset = customOffsets[i];
      } else {
        const lastOff = customOffsets[customOffsets.length - 1];
        const prevOff = customOffsets.length > 1 ? customOffsets[customOffsets.length - 2] : 0;
        const gap = lastOff - prevOff > 0 ? lastOff - prevOff : 30;
        curOffset = lastOff + gap * (i - customOffsets.length + 1);
      }
    } else {
      if (offsetDays === 0) {
        curOffset = i * 30;
      } else {
        // e.g. 30, 60, 90...
        curOffset = offsetDays + (i * 30);
      }
    }

    const dueDate = calculateDueDate(baseDateStr, curOffset, fineMese);

    installments.push({
      installment_index: i + 1,
      due_date: dueDate,
      amount,
      is_advance: false,
      is_paid: false,
      paid_date: null,
      source_type: sourceType,
      notes: installmentsCount > 1 ? `Rata ${i + 1} di ${installmentsCount}` : '',
      payment_method: rule.name || 'Standard'
    });
  }

  return installments;
}

/**
 * Persists installments to PostgreSQL order_payments table.
 * Uses direct positional parameters $1, $2, ... with await pool.query (or transactional pgClient).
 */
export async function saveOrderPaymentsInPostgres(
  pgClientOrPool: any,
  orderId: number,
  clientId: number,
  installments: ScheduledInstallment[],
  sourceType: 'AUTO' | 'DANEA' | 'ADMIN_MANUAL' = 'AUTO'
): Promise<void> {
  if (!orderId || !installments || installments.length === 0) return;
  const target = pgClientOrPool || pool;

  // 1. Clear existing payments for this order
  await target.query('DELETE FROM order_payments WHERE order_id = $1', [orderId]);

  // 2. Batch insert (chunks of 100) using direct positional parameters
  const chunkSize = 100;
  for (let i = 0; i < installments.length; i += chunkSize) {
    const chunk = installments.slice(i, i + chunkSize);
    const values: any[] = [];
    const placeholders: string[] = [];

    chunk.forEach((inst, idx) => {
      const base = idx * 12;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`
      );
      values.push(
        orderId,
        clientId || null,
        inst.due_date,
        inst.amount,
        Boolean(inst.is_advance),
        Boolean(inst.is_advance),
        Boolean(inst.is_paid),
        Boolean(inst.is_paid),
        inst.paid_date || null,
        inst.source_type || sourceType,
        inst.notes || '',
        inst.payment_method || 'Bonifico bancario'
      );
    });

    const query = `
      INSERT INTO order_payments (
        order_id, client_id, due_date, amount,
        is_advance, advance,
        is_paid, paid,
        paid_date, source_type, notes, payment_method
      )
      VALUES ${placeholders.join(', ')}
    `;

    await target.query(query, values);
  }
}

/**
 * High-level service method to generate and save order payments for an order in PostgreSQL.
 */
export async function schedulePaymentsForOrder(
  orderId: number,
  orderData: {
    client_id: number;
    total: number;
    date: string;
    payment_name?: string;
  },
  options?: {
    pgClient?: any;
    sourceType?: 'AUTO' | 'DANEA' | 'ADMIN_MANUAL';
  }
): Promise<ScheduledInstallment[]> {
  const pgTarget = options?.pgClient || pool;
  const rule = await getPaymentMethodRule(orderData.payment_name);
  const installments = calculateInstallments(
    orderData.total,
    orderData.date,
    rule,
    options?.sourceType || 'AUTO'
  );

  await saveOrderPaymentsInPostgres(
    pgTarget,
    orderId,
    orderData.client_id,
    installments,
    options?.sourceType || 'AUTO'
  );

  return installments;
}
