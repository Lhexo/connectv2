/**
 * Price & Tax Utilities (Client-Side Only)
 * 
 * Works strictly with net taxable prices (Prezzi Imponibili) from database/catalog.
 * VAT is calculated per line item and aggregated into total taxable, total VAT, and total gross.
 * Strictly frontend-only: does not modify databases, API payloads, or XML exports.
 */

/**
 * Parses a VAT rate from numeric or string values (e.g. '22', 22, '22%', '10', '4').
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
 * Normalizes / returns the taxable amount (Imponibile).
 * Since prices from the database are already net taxable, this ensures clean 2-decimal rounding.
 */
export function calculateTaxable(netPrice: number | string, _vatRate?: number | string): number {
  const numNet = typeof netPrice === 'number' ? netPrice : parseFloat(String(netPrice)) || 0;
  if (numNet === 0 || isNaN(numNet)) return 0;
  return Math.round(numNet * 100) / 100;
}

/**
 * Calculates the VAT component for a net taxable price.
 * Formula: VAT = Prezzo Imponibile * (Aliquota IVA / 100)
 */
export function calculateVat(netPrice: number | string, vatRate: number | string = 22): number {
  const numNet = typeof netPrice === 'number' ? netPrice : parseFloat(String(netPrice)) || 0;
  if (numNet === 0 || isNaN(numNet)) return 0;

  const rate = parseVatRate(vatRate, 22);
  const vat = numNet * (rate / 100);
  return Math.round(vat * 100) / 100;
}

/**
 * Parses a discount percentage from numeric or string values (e.g. 5, '5%', '20+5%').
 */
export function parseDiscountPerc(discountOrPerc?: string | number | null): number {
  if (discountOrPerc === null || discountOrPerc === undefined || discountOrPerc === '') return 0;
  if (typeof discountOrPerc === 'number') {
    return isNaN(discountOrPerc) ? 0 : Math.max(0, Math.min(100, discountOrPerc));
  }
  const str = String(discountOrPerc).trim();
  if (str.includes('+')) {
    const parts = str.split('+').map(p => parseFloat(p.replace('%', '').replace(',', '.').trim())).filter(p => !isNaN(p));
    if (parts.length > 0) {
      let multiplier = 1;
      for (const p of parts) {
        multiplier *= (1 - p / 100);
      }
      return Math.max(0, Math.min(100, Math.round((1 - multiplier) * 10000) / 100));
    }
  }
  const clean = str.replace('%', '').replace(',', '.').trim();
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
}

/**
 * Calculates line totals for an order item given quantity, net taxable unit price, VAT rate, and optional discount percentage.
 */
export interface LineTotals {
  unitGross: number;
  unitTaxable: number;
  unitVat: number;
  totalGross: number;
  totalTaxable: number;
  totalVat: number;
  vatRate: number;
  discountPerc: number;
  discountAmount: number;
}

export function calculateLineTotals(
  qty: number | string,
  netUnitPrice: number | string,
  vatRate: number | string = 22,
  discountPercOrDiscounts?: number | string | null,
  customTotalTaxable?: number | null
): LineTotals {
  const cleanQty = typeof qty === 'number' ? qty : parseFloat(String(qty)) || 0;
  const cleanNet = typeof netUnitPrice === 'number' ? netUnitPrice : parseFloat(String(netUnitPrice)) || 0;
  const rate = parseVatRate(vatRate, 22);
  const discountPerc = parseDiscountPerc(discountPercOrDiscounts);

  const unitTaxable = Math.round(cleanNet * 100) / 100;
  const unitVat = Math.round(cleanNet * (rate / 100) * 100) / 100;
  const unitGross = Math.round((cleanNet + unitVat) * 100) / 100;

  // Imponibile totale riga:
  // Se è stato inserito direttamente un valore nel campo TOTALE RIGA IMPONIBILE, si usa quel valore esatto.
  // Altrimenti: (prezzo_netto * quantità) * (1 - (sconto_percentuale / 100))
  let totalTaxable: number;
  const rawLineTaxable = cleanQty * cleanNet;

  if (customTotalTaxable !== undefined && customTotalTaxable !== null && !isNaN(Number(customTotalTaxable))) {
    totalTaxable = Math.round(Number(customTotalTaxable) * 100) / 100;
  } else {
    const discountMultiplier = Math.max(0, 1 - (discountPerc / 100));
    totalTaxable = Math.round(rawLineTaxable * discountMultiplier * 100) / 100;
  }

  // Sconto valore monetario: differenza tra lordo teorico e imponibile netto scontato
  const discountAmount = cleanNet > 0 && totalTaxable < rawLineTaxable
    ? Math.max(0, Math.round((rawLineTaxable - totalTaxable) * 100) / 100)
    : 0;

  // IVA calcolata su imponibile riga (supporta correttamente anche importi negativi)
  const totalVat = Math.round(totalTaxable * (rate / 100) * 100) / 100;
  const totalGross = Math.round((totalTaxable + totalVat) * 100) / 100;

  return {
    unitGross,
    unitTaxable,
    unitVat,
    totalGross,
    totalTaxable,
    totalVat,
    vatRate: rate,
    discountPerc,
    discountAmount
  };
}

/**
 * Calculates aggregate order totals across an array of cart/order items.
 * Procedura fiscale corretta:
 * 1. Valuta per ciascuna riga l'imponibile effettivo (quantità, sconti % ed eventuali valori manuali diretti).
 * 2. Esegue la somma algebrica tra tutte le righe (inclusi valori negativi: sconti, detrazioni, storni).
 * 3. E SOLO DOPO calcola l'IVA sulle somme aggregate degli imponibili per aliquota.
 * 4. Totale Ordine (Ivato) = Totale Imponibile + Totale IVA.
 */
export interface OrderTotals {
  totalTaxable: number;
  totalVat: number;
  totalGross: number;
  vatBreakdown?: Record<number, { taxable: number; vat: number }>;
}

export function calculateOrderTotals(
  items: Array<{
    qty?: number | string;
    quantity?: number | string;
    price?: number | string;
    net_price?: number | string;
    net_price_1?: number | string;
    unit_price?: number | string;
    vat_code?: number | string | null;
    vat_rate?: number | string | null;
    vatRate?: number | string | null;
    discount_perc?: number | string | null;
    discount?: number | string | null;
    discounts?: string | number | null;
    custom_taxable_total?: number | null;
    taxable_total?: number | null;
    taxableTotal?: number | null;
    line_total?: number | null;
    total?: number | null;
  }>
): OrderTotals {
  // Raggruppa gli imponibili per ciascuna aliquota IVA per applicare l'imposta solo dopo aver sommato tutte le righe
  const rateTaxableMap: Record<number, number> = {};

  items.forEach(item => {
    const qty = Number(item.qty !== undefined ? item.qty : (item.quantity !== undefined ? item.quantity : 1)) || 0;
    const price = Number(
      item.price !== undefined 
        ? item.price 
        : (item.net_price !== undefined 
            ? item.net_price 
            : (item.net_price_1 !== undefined 
                ? item.net_price_1 
                : (item.unit_price !== undefined ? item.unit_price : 0)))
    ) || 0;
    
    const vatRate = parseVatRate(
      item.vat_code !== undefined && item.vat_code !== null 
        ? item.vat_code 
        : (item.vat_rate !== undefined && item.vat_rate !== null 
            ? item.vat_rate 
            : (item.vatRate !== undefined && item.vatRate !== null ? item.vatRate : 22)),
      22
    );

    const disc = parseDiscountPerc(
      item.discount_perc !== undefined && item.discount_perc !== null 
        ? item.discount_perc 
        : (item.discounts !== undefined && item.discounts !== null 
            ? item.discounts 
            : item.discount)
    );

    // Valuta eventuale override manuale per il totale riga imponibile
    const customTotal = item.custom_taxable_total !== undefined && item.custom_taxable_total !== null
      ? Number(item.custom_taxable_total)
      : (item.taxable_total !== undefined && item.taxable_total !== null
          ? Number(item.taxable_total)
          : (item.taxableTotal !== undefined && item.taxableTotal !== null
              ? Number(item.taxableTotal)
              : null));

    let lineTaxable: number;
    if (customTotal !== null && !isNaN(customTotal)) {
      lineTaxable = Math.round(customTotal * 100) / 100;
    } else {
      const rawTaxable = qty * price;
      const discountMultiplier = Math.max(0, 1 - (disc / 100));
      lineTaxable = Math.round(rawTaxable * discountMultiplier * 100) / 100;
    }

    if (!rateTaxableMap[vatRate]) {
      rateTaxableMap[vatRate] = 0;
    }
    rateTaxableMap[vatRate] += lineTaxable;
  });

  let sumTaxable = 0;
  let sumVat = 0;
  const vatBreakdown: Record<number, { taxable: number; vat: number }> = {};

  // Solo dopo aver sommato gli imponibili di tutte le righe si calcola l'IVA
  Object.keys(rateTaxableMap).forEach(rateKey => {
    const rate = Number(rateKey);
    const taxableForRate = Math.round(rateTaxableMap[rate] * 100) / 100;
    const vatForRate = Math.round(taxableForRate * (rate / 100) * 100) / 100;

    sumTaxable += taxableForRate;
    sumVat += vatForRate;
    vatBreakdown[rate] = { taxable: taxableForRate, vat: vatForRate };
  });

  const totalTaxable = Math.round(sumTaxable * 100) / 100;
  const totalVat = Math.round(sumVat * 100) / 100;
  const totalGross = Math.round((totalTaxable + totalVat) * 100) / 100;

  return {
    totalTaxable,
    totalVat,
    totalGross,
    vatBreakdown
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
