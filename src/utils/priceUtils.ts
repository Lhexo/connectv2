/**
 * Price & Tax Utilities (Client-Side Only)
 * 
 * Performs dynamic on-the-fly calculation of taxable net amounts (Imponibile)
 * and VAT from gross prices (Prezzi Ivati).
 * Strictly frontend-only: does not modify databases, API payloads, or XML exports.
 */

/**
 * Parses a VAT rate from numeric or string values (e.g. '22', 22, '22%', '10').
 * Defaults to 22% if not provided, empty, or invalid.
 */
export function parseVatRate(vatRateOrCode?: string | number | null, defaultRate = 22): number {
  if (vatRateOrCode === null || vatRateOrCode === undefined || vatRateOrCode === '') {
    return defaultRate;
  }
  if (typeof vatRateOrCode === 'number') {
    return isNaN(vatRateOrCode) ? defaultRate : vatRateOrCode;
  }
  // Remove non-numeric characters except comma and dot
  const clean = String(vatRateOrCode).replace('%', '').replace(',', '.').trim();
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? defaultRate : parsed;
}

/**
 * Calculates the taxable amount (Imponibile / Net Price) from a gross price (Prezzo Ivato).
 * Formula: Imponibile = Prezzo Ivato / (1 + (Aliquota IVA / 100))
 * 
 * Mathematical rounding to two decimal places: Math.round(val * 100) / 100
 * Handles negative numbers seamlessly (discounts, deductions).
 * 
 * @param grossPrice - Price including VAT (can be negative)
 * @param vatRate - VAT percentage (e.g. 22 for 22%)
 */
export function calculateTaxable(grossPrice: number | string, vatRate: number | string = 22): number {
  const numGross = typeof grossPrice === 'number' ? grossPrice : parseFloat(String(grossPrice)) || 0;
  if (numGross === 0 || isNaN(numGross)) return 0;

  const rate = parseVatRate(vatRate, 22);
  if (rate <= 0) {
    return Math.round(numGross * 100) / 100;
  }

  const taxable = numGross / (1 + (rate / 100));
  return Math.round(taxable * 100) / 100;
}

/**
 * Calculates the VAT component from a gross price.
 * Formula: VAT = Prezzo Ivato - Imponibile
 * Mathematical rounding to two decimal places.
 */
export function calculateVat(grossPrice: number | string, vatRate: number | string = 22): number {
  const numGross = typeof grossPrice === 'number' ? grossPrice : parseFloat(String(grossPrice)) || 0;
  if (numGross === 0 || isNaN(numGross)) return 0;

  const taxable = calculateTaxable(numGross, vatRate);
  const vat = numGross - taxable;
  return Math.round(vat * 100) / 100;
}

/**
 * Calculates line totals for an order item given quantity, gross unit price, and VAT rate.
 */
export interface LineTotals {
  unitGross: number;
  unitTaxable: number;
  unitVat: number;
  totalGross: number;
  totalTaxable: number;
  totalVat: number;
  vatRate: number;
}

export function calculateLineTotals(
  qty: number | string,
  grossUnitPrice: number | string,
  vatRate: number | string = 22
): LineTotals {
  const cleanQty = typeof qty === 'number' ? qty : parseFloat(String(qty)) || 0;
  const cleanGross = typeof grossUnitPrice === 'number' ? grossUnitPrice : parseFloat(String(grossUnitPrice)) || 0;
  const rate = parseVatRate(vatRate, 22);

  const unitTaxable = calculateTaxable(cleanGross, rate);
  const unitVat = Math.round((cleanGross - unitTaxable) * 100) / 100;

  const totalGross = Math.round(cleanQty * cleanGross * 100) / 100;
  const totalTaxable = Math.round(cleanQty * unitTaxable * 100) / 100;
  const totalVat = Math.round((totalGross - totalTaxable) * 100) / 100;

  return {
    unitGross: cleanGross,
    unitTaxable,
    unitVat,
    totalGross,
    totalTaxable,
    totalVat,
    vatRate: rate
  };
}

/**
 * Calculates aggregate order totals across an array of cart/order items.
 * Returns:
 * - totalTaxable: sum of all line taxable amounts
 * - totalVat: sum of all line VAT amounts
 * - totalGross: sum of all line gross amounts (Totale Ordine Ivato)
 */
export interface OrderTotals {
  totalTaxable: number;
  totalVat: number;
  totalGross: number;
}

export function calculateOrderTotals(
  items: Array<{
    qty?: number | string;
    quantity?: number | string;
    price?: number | string;
    gross_price?: number | string;
    unit_price?: number | string;
    vat_code?: number | string | null;
    vat_rate?: number | string | null;
  }>
): OrderTotals {
  let sumTaxable = 0;
  let sumGross = 0;

  items.forEach(item => {
    const qty = item.qty !== undefined ? item.qty : (item.quantity !== undefined ? item.quantity : 1);
    const price = item.price !== undefined ? item.price : (item.gross_price !== undefined ? item.gross_price : (item.unit_price !== undefined ? item.unit_price : 0));
    const vatRate = item.vat_code !== undefined && item.vat_code !== null ? item.vat_code : (item.vat_rate !== undefined && item.vat_rate !== null ? item.vat_rate : 22);

    const line = calculateLineTotals(qty, price, vatRate);
    sumTaxable += line.totalTaxable;
    sumGross += line.totalGross;
  });

  const totalTaxable = Math.round(sumTaxable * 100) / 100;
  const totalGross = Math.round(sumGross * 100) / 100;
  const totalVat = Math.round((totalGross - totalTaxable) * 100) / 100;

  return {
    totalTaxable,
    totalVat,
    totalGross
  };
}

/**
 * Formats a currency amount with Euro symbol, taking care of negative values (e.g. "-€ 10.00").
 */
export function formatEuro(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount).toFixed(2);
  return isNegative ? `-€ ${abs}` : `€ ${abs}`;
}
