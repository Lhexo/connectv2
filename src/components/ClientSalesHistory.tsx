import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Upload, 
  Trash2, 
  Calendar, 
  Package, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  FileSpreadsheet, 
  Sparkles,
  RefreshCw,
  ShoppingBag,
  Info,
  DollarSign,
  Tag
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO, differenceInDays, addDays, isValid } from 'date-fns';
import { it } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';

function safeParseDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isValid(dateStr) ? dateStr : null;
  if (typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // 1. Try parseISO
  let parsed = parseISO(trimmed);
  if (isValid(parsed)) return parsed;

  // 2. Try native Date constructor
  parsed = new Date(trimmed);
  if (isValid(parsed)) return parsed;

  // 3. Try parsing DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    parsed = new Date(year, month, day);
    if (isValid(parsed)) return parsed;
  }

  // 4. Try parsing YYYY/MM/DD or YYYY-MM-DD
  const yyyymmddMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10) - 1;
    const day = parseInt(yyyymmddMatch[3], 10);
    parsed = new Date(year, month, day);
    if (isValid(parsed)) return parsed;
  }

  return null;
}

function safeDiffDays(d1: string | Date | null | undefined, d2: string | Date | null | undefined): number {
  const dateObj1 = safeParseDate(d1);
  const dateObj2 = safeParseDate(d2);
  if (!dateObj1 || !dateObj2) return 0;
  try {
    return differenceInDays(dateObj1, dateObj2);
  } catch {
    return 0;
  }
}

function safeAddDays(d: string | Date | null | undefined, days: number): Date {
  const dateObj = safeParseDate(d);
  if (!dateObj) return new Date();
  try {
    const result = addDays(dateObj, days);
    return isValid(result) ? result : new Date();
  } catch {
    return new Date();
  }
}

function safeFormatDate(d: string | Date | null | undefined, fmt = 'dd/MM/yyyy'): string {
  if (!d) return 'N/D';
  const dateObj = safeParseDate(d);
  if (!dateObj) return typeof d === 'string' && d.trim() ? d : 'N/D';
  try {
    return format(dateObj, fmt);
  } catch {
    return 'N/D';
  }
}

interface SalesHistoryItem {
  id: number;
  client_id: number;
  type?: string;
  document_type: string;
  document_number: string;
  document_date: string;
  product_code: string;
  product_description: string;
  quantity: number;
  unit_of_measure: string;
  unit_price: number;
  total_amount: number;
  category: string;
  created_at?: string;
  is_imported?: boolean;
}

interface ClientSalesHistoryProps {
  clientId: number | string;
  isAdmin: boolean;
  clientName: string;
}

export default function ClientSalesHistory({ clientId, isAdmin, clientName }: ClientSalesHistoryProps) {
  const [items, setItems] = useState<SalesHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const hasImportedItems = useMemo(() => {
    return items.some(item => item.is_imported === true || (item.is_imported === undefined && item.category !== 'Ordini App'));
  }, [items]);

  const fetchSalesHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/sales-history`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching sales history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchSalesHistory();
    }
  }, [clientId]);

  // Handle XLSX import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/clients/${clientId}/sales-history/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUploadMessage({
          type: 'success',
          text: `Importazione completata con successo: ${data.importedCount} righe di vendita registrate!`,
        });
        fetchSalesHistory();
      } else {
        setUploadMessage({
          type: 'error',
          text: data.error || "Errore durante l'importazione del file.",
        });
      }
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: "Impossibile caricare il file. Verifica il formato Excel (.xlsx, .csv).",
      });
    } finally {
      setUploading(false);
      // reset file input
      e.target.value = '';
    }
  };

  // Handle Clear
  const handleClearHistory = async () => {
    setLoading(true);
    setUploadMessage(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/sales-history`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUploadMessage({ type: 'success', text: 'Dati dello storico importato azzerati con successo. Gli ordini CRM sono stati conservati.' });
        await fetchSalesHistory();
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Errore durante l\'azzeramento dello storico importato.' });
      }
    } catch (err) {
      console.error('Error clearing sales history:', err);
      setUploadMessage({ type: 'error', text: 'Impossibile completare la richiesta di azzeramento.' });
    } finally {
      setLoading(false);
    }
  };

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [items]);

  // Product items (excluding date/document placeholder rows)
  const productItems = useMemo(() => {
    return items.filter(item => item.type !== 'document');
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return productItems.filter(item => {
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesSearch = !searchTerm || 
        item.product_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.document_number?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [productItems, selectedCategory, searchTerm]);

  // Unique Document Dates sorted ascending for frequency calculations
  const uniqueDocDates = useMemo(() => {
    const dates = Array.from(new Set(items.map(i => i.document_date).filter((d): d is string => Boolean(d && d.trim())))).sort((a, b) => {
      const da = safeParseDate(a);
      const db = safeParseDate(b);
      if (da && db) return da.getTime() - db.getTime();
      return a.localeCompare(b);
    });
    return dates;
  }, [items]);

  // Unique Documents grouped
  const documentsGrouped = useMemo(() => {
    const docs: Record<string, {
      docNumber: string;
      docType: string;
      docDate: string;
      totalAmount: number;
      items: SalesHistoryItem[];
    }> = {};

    filteredItems.forEach(item => {
      // Skip items that do not have explicit document metadata
      if (!item.document_number && !item.document_date) return;

      const key = `${item.document_number || 'ND'}_${item.document_date || ''}`;
      if (!docs[key]) {
        docs[key] = {
          docNumber: item.document_number || 'N/D',
          docType: item.document_type || 'Fattura/Doc',
          docDate: item.document_date || '',
          totalAmount: 0,
          items: []
        };
      }
      docs[key].totalAmount += Number(item.total_amount) || 0;
      docs[key].items.push(item);
    });

    return Object.values(docs).sort((a, b) => {
      const da = safeParseDate(a.docDate);
      const db = safeParseDate(b.docDate);
      if (da && db) return db.getTime() - da.getTime();
      return (b.docDate || '').localeCompare(a.docDate || '');
    });
  }, [filteredItems]);

  // KPI calculations (strictly excluding imported XLSX items for LTV, Ticket Medio, and Reorder Status)
  const kpis = useMemo(() => {
    // Strictly filter items that represent actual CRM App orders (excluding ALL XLSX imported products)
    const crmOrderItems = items.filter(item => !item.is_imported);

    if (crmOrderItems.length === 0) {
      return {
        ltv: 0,
        avgReorderDays: 0,
        reorderStatus: 'N/A' as 'TARGET' | 'ATTESA' | 'CHURN' | 'N/A',
        reorderDaysDiff: 0,
        avgTicket: 0,
        totalOrders: 0,
        lastOrderDate: null as string | null
      };
    }

    // LTV (Fatturato Storico) calculated ONLY from real CRM orders
    const ltv = crmOrderItems.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

    // Real document order dates from CRM orders
    const crmDocDates = Array.from(new Set(
      crmOrderItems.map(i => i.document_date).filter((d): d is string => Boolean(d && d.trim()))
    )).sort((a, b) => {
      const da = safeParseDate(a);
      const db = safeParseDate(b);
      if (da && db) return da.getTime() - db.getTime();
      return a.localeCompare(b);
    });

    // Calculate avg reorder days using crmDocDates
    let avgReorderDays = 30; // default assumption
    if (crmDocDates.length > 1) {
      let totalGaps = 0;
      let validGapsCount = 0;
      for (let i = 1; i < crmDocDates.length; i++) {
        const gap = Math.abs(safeDiffDays(crmDocDates[i], crmDocDates[i - 1]));
        if (gap > 0) {
          totalGaps += gap;
          validGapsCount++;
        }
      }
      if (validGapsCount > 0) {
        avgReorderDays = Math.round(totalGaps / validGapsCount) || 30;
      }
    }

    // Extract unique orders from crmOrderItems
    const uniqueOrdersSet = new Set<string>();
    crmOrderItems.forEach((item, idx) => {
      if (item.document_number) {
        uniqueOrdersSet.add(`${item.document_number}_${item.document_date || ''}`);
      } else if (item.document_date) {
        uniqueOrdersSet.add(`DOCDATE_${item.document_date}`);
      } else {
        uniqueOrdersSet.add(`ITEM_${item.id || idx}`);
      }
    });

    const totalOrders = uniqueOrdersSet.size;
    const avgTicket = totalOrders > 0 ? ltv / totalOrders : 0;

    const lastOrderDate = crmDocDates.length > 0 ? crmDocDates[crmDocDates.length - 1] : null;

    let reorderStatus: 'TARGET' | 'ATTESA' | 'CHURN' | 'N/A' = 'N/A';
    let reorderDaysDiff = 0;

    if (lastOrderDate) {
      const daysSinceLast = safeDiffDays(new Date(), lastOrderDate);
      reorderDaysDiff = daysSinceLast;
      if (daysSinceLast <= avgReorderDays) {
        reorderStatus = 'TARGET';
      } else if (daysSinceLast <= Math.round(avgReorderDays * 1.35)) {
        reorderStatus = 'ATTESA';
      } else {
        reorderStatus = 'CHURN';
      }
    }

    return {
      ltv,
      avgReorderDays,
      reorderStatus,
      reorderDaysDiff,
      avgTicket,
      totalOrders,
      lastOrderDate
    };
  }, [items]);

  // Top Purchased Products Grouping (Includes ALL products, both imported XLSX and CRM App orders)
  const topProducts = useMemo(() => {
    const map: Record<string, {
      code: string;
      description: string;
      category: string;
      totalQty: number;
      totalValue: number;
      lastDate: string;
      purchaseCount: number;
      um: string;
    }> = {};

    productItems.forEach(item => {
      const key = item.product_code || item.product_description;
      if (!key) return;

      if (!map[key]) {
        map[key] = {
          code: item.product_code || 'N/D',
          description: item.product_description || 'Prodotto Generico',
          category: item.category || 'Generale',
          totalQty: 0,
          totalValue: 0,
          lastDate: item.document_date || '',
          purchaseCount: 0,
          um: item.unit_of_measure || 'pz'
        };
      }

      map[key].totalQty += Number(item.quantity) || 0;
      map[key].totalValue += Number(item.total_amount) || 0;
      map[key].purchaseCount += 1;
      if (item.document_date && item.document_date > map[key].lastDate) {
        map[key].lastDate = item.document_date;
      }
    });

    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }, [productItems]);

  // Reorder cycle analysis per top product (strictly calculated on CRM App orders)
  const reorderPredictions = useMemo(() => {
    const crmProductItems = productItems.filter(item => !item.is_imported);

    const map: Record<string, {
      code: string;
      description: string;
      category: string;
      totalQty: number;
      totalValue: number;
      lastDate: string;
      purchaseCount: number;
      um: string;
    }> = {};

    crmProductItems.forEach(item => {
      const key = item.product_code || item.product_description;
      if (!key) return;

      if (!map[key]) {
        map[key] = {
          code: item.product_code || 'N/D',
          description: item.product_description || 'Prodotto Generico',
          category: item.category || 'Generale',
          totalQty: 0,
          totalValue: 0,
          lastDate: item.document_date || '',
          purchaseCount: 0,
          um: item.unit_of_measure || 'pz'
        };
      }

      map[key].totalQty += Number(item.quantity) || 0;
      map[key].totalValue += Number(item.total_amount) || 0;
      map[key].purchaseCount += 1;
      if (item.document_date && item.document_date > map[key].lastDate) {
        map[key].lastDate = item.document_date;
      }
    });

    const crmTopProducts = Object.values(map).sort((a, b) => b.totalValue - a.totalValue);

    return crmTopProducts.slice(0, 8).map(prod => {
      if (!prod.lastDate) {
        return {
          ...prod,
          daysSinceLast: null,
          estimatedCycle: kpis.avgReorderDays || 30,
          daysOverdue: 0,
          alertLevel: 'NO_DATE' as const,
          nextEstimatedDate: null
        };
      }
      const daysSinceLast = safeDiffDays(new Date(), prod.lastDate);
      const estimatedCycle = kpis.avgReorderDays || 30;
      const daysOverdue = daysSinceLast - estimatedCycle;

      let alertLevel: 'URGENT' | 'DUE' | 'OK' | 'NO_DATE' = 'OK';
      if (daysOverdue > 10) alertLevel = 'URGENT';
      else if (daysOverdue >= -5) alertLevel = 'DUE';

      return {
        ...prod,
        daysSinceLast,
        estimatedCycle,
        daysOverdue,
        alertLevel,
        nextEstimatedDate: safeAddDays(prod.lastDate, estimatedCycle)
      };
    });
  }, [productItems, kpis.avgReorderDays]);

  const toggleDocExpand = (docKey: string) => {
    setExpandedDocs(prev => ({ ...prev, [docKey]: !prev[docKey] }));
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-3">
        <RefreshCw size={28} className="animate-spin text-[#5A5A40] mx-auto" />
        <p className="text-sm font-bold text-gray-600">Caricamento statistiche e storico acquisti...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER & UPLOAD BAR FOR ADMIN */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-[#5A5A40]" size={22} />
            Statistiche & Storico Acquisti
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Analisi dettagliata delle abitudini di acquisto, riordini frequenti e storico consumi di <strong className="text-gray-800">{clientName}</strong>.
          </p>
        </div>

        {/* ADMIN IMPORT CONTROLS */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {hasImportedItems && (
              <button
                type="button"
                onClick={() => setShowConfirmClear(true)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-rose-200 cursor-pointer"
                title="Azzera dati importati"
              >
                <Trash2 size={14} />
                <span>Azzera Dati Importati</span>
              </button>
            )}

            <label className={cn(
              "px-4 py-2 bg-[#5A5A40] hover:bg-[#4A4A33] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer",
              uploading && "opacity-50 pointer-events-none"
            )}>
              {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>{uploading ? 'Importazione...' : 'Importa XLSX Storico'}</span>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>
          </div>
        )}
      </div>

      {/* UPLOAD MESSAGE NOTICE */}
      {uploadMessage && (
        <div className={cn(
          "p-4 rounded-2xl text-xs font-bold border flex items-center justify-between",
          uploadMessage.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
        )}>
          <div className="flex items-center gap-2">
            {uploadMessage.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
            <span>{uploadMessage.text}</span>
          </div>
          <button onClick={() => setUploadMessage(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* EMPTY STATE */}
      {items.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-gray-300 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-800 flex items-center justify-center mx-auto">
            <FileSpreadsheet size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-serif font-bold text-gray-900">Nessuno storico acquisti importato</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Non sono ancora presenti dati sullo storico acquisti o sui prodotti consumati da questo cliente.
              {isAdmin && " Puoi caricare un file Excel con l'elenco dei documenti e delle righe vendute tramite il pulsante 'Importa XLSX Storico' in alto."}
            </p>
          </div>
          {isAdmin && (
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4A4A33] text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-all">
              <Upload size={16} />
              <span>Carica File Excel (.xlsx)</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
            </label>
          )}
        </div>
      ) : (
        <>
          {/* 1. KPI SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* KPI 1: LTV */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">LTV (Fatturato Storico)</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <TrendingUp size={18} />
                </div>
              </div>
              <p className="text-2xl font-serif font-black text-gray-900">
                € {kpis.ltv.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                Calcolato su {kpis.totalOrders} {kpis.totalOrders === 1 ? 'ordine App' : 'ordini App'} (esclusi dati XLSX)
              </p>
            </div>

            {/* KPI 2: FREQUENZA MEDIA RIORDINO */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Freq. Media Riordino</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Clock size={18} />
                </div>
              </div>
              <p className="text-2xl font-serif font-black text-gray-900">
                Ogni {kpis.avgReorderDays} {kpis.avgReorderDays === 1 ? 'giorno' : 'giorni'}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                Intervallo medio stimato tra ordini App
              </p>
            </div>

            {/* KPI 3: STATO RIORDINO (ALERT) */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Stato Riordino</span>
                <div className={cn(
                  "p-2 rounded-xl",
                  kpis.reorderStatus === 'TARGET' ? "bg-emerald-50 text-emerald-600" :
                  kpis.reorderStatus === 'ATTESA' ? "bg-amber-50 text-amber-600" :
                  kpis.reorderStatus === 'CHURN' ? "bg-rose-50 text-rose-600" : "bg-gray-100 text-gray-500"
                )}>
                  <AlertCircle size={18} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-black uppercase px-2.5 py-1 rounded-full border flex items-center gap-1.5",
                  kpis.reorderStatus === 'TARGET' ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                  kpis.reorderStatus === 'ATTESA' ? "bg-amber-50 text-amber-800 border-amber-200" :
                  kpis.reorderStatus === 'CHURN' ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-gray-100 text-gray-600 border-gray-200"
                )}>
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    kpis.reorderStatus === 'TARGET' ? "bg-emerald-500 animate-pulse" :
                    kpis.reorderStatus === 'ATTESA' ? "bg-amber-500" :
                    kpis.reorderStatus === 'CHURN' ? "bg-rose-500" : "bg-gray-400"
                  )} />
                  {kpis.reorderStatus === 'TARGET' && 'In Target'}
                  {kpis.reorderStatus === 'ATTESA' && 'In Attesa'}
                  {kpis.reorderStatus === 'CHURN' && 'In Ritardo (Rischio Churn)'}
                  {kpis.reorderStatus === 'N/A' && 'Senza Ordini App'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                {kpis.lastOrderDate 
                  ? `Ultimo ordine App ${kpis.reorderDaysDiff} giorni fa (${safeFormatDate(kpis.lastOrderDate)})`
                  : 'Nessun ordine registrato dall\'App'}
              </p>
            </div>

            {/* KPI 4: TICKET MEDIO */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Ticket Medio</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShoppingBag size={18} />
                </div>
              </div>
              <p className="text-2xl font-serif font-black text-gray-900">
                € {kpis.avgTicket.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                Valore medio speso per ordine App
              </p>
            </div>
          </div>

          {/* 2. CICLO DI RIORDINO & PREVISIONE ACQUISTO (CROSS-SELLING) */}
          <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-amber-500" />
                  Previsione Riordino & Suggerimenti Prossima Visita
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Algoritmo basato su ordini App per rilevare l'esaurimento scorte prima della visita.
                </p>
              </div>
              <span className="text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-center">
                Cross-Selling & Churn Prevention
              </span>
            </div>

            {reorderPredictions.length === 0 ? (
              <div className="p-6 bg-amber-50/50 rounded-2xl border border-amber-200/60 text-center space-y-1">
                <p className="text-xs font-bold text-amber-900">
                  Nessuna previsione di riordino generata da ordini dell'App.
                </p>
                <p className="text-[11px] text-amber-700">
                  I prodotti importati da file XLSX sono usati esclusivamente per identificare i prodotti più acquistati.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {reorderPredictions.map((pred, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "p-4 rounded-2xl border transition-all space-y-3 relative overflow-hidden",
                      pred.alertLevel === 'URGENT' ? "bg-rose-50/40 border-rose-200" :
                      pred.alertLevel === 'DUE' ? "bg-amber-50/40 border-amber-200" : "bg-[#F9FAFB] border-gray-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[9px] font-black font-mono text-gray-400 uppercase tracking-wider block">
                        {pred.code}
                      </span>
                      <span className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0",
                        pred.alertLevel === 'URGENT' ? "bg-rose-100 text-rose-800 border-rose-200" :
                        pred.alertLevel === 'DUE' ? "bg-amber-100 text-amber-800 border-amber-200" :
                        pred.alertLevel === 'OK' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                        "bg-gray-100 text-gray-600 border-gray-200"
                      )}>
                        {pred.alertLevel === 'URGENT' && 'In Ritardo'}
                        {pred.alertLevel === 'DUE' && 'Da Riordinare'}
                        {pred.alertLevel === 'OK' && 'In Regola'}
                        {pred.alertLevel === 'NO_DATE' && 'Senza Data'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs text-gray-900 line-clamp-2 leading-tight">
                        {pred.description}
                      </h4>
                      <span className="text-[10px] text-gray-500 block mt-1">
                        {pred.category} • {pred.totalQty} {pred.um} acquistati
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-200/60 text-[10px] space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Ultimo acquisto:</span>
                        <strong className="font-mono">{pred.lastDate ? safeFormatDate(pred.lastDate) : 'Senza data'}</strong>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Previsione riordino:</span>
                        <strong className="font-mono text-[#5A5A40]">
                          {pred.nextEstimatedDate ? safeFormatDate(pred.nextEstimatedDate) : 'N/D'}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. GRIGLIA TOP PRODOTTI ACQUISTATI */}
          <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-gray-900 flex items-center gap-2">
                  <Package size={20} className="text-[#5A5A40]" />
                  Top Prodotti più Acquistati & Consumi
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Classifica articoli per volume di fatturato e quantità cumulata.
                </p>
              </div>

              {/* SEARCH & CATEGORY FILTERS */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cerca prodotto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#F9FAFB] border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5A5A40] w-40 sm:w-52"
                  />
                </div>

                {categories.length > 0 && (
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="py-1.5 px-3 bg-[#F9FAFB] border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
                  >
                    <option value="ALL">Tutte le Categorie ({categories.length})</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 text-[10px] uppercase font-black tracking-wider text-gray-500 border-b border-gray-100">
                    <th className="p-3.5">Codice</th>
                    <th className="p-3.5">Descrizione Prodotto</th>
                    <th className="p-3.5">Categoria</th>
                    <th className="p-3.5 text-center">Qtà Totale</th>
                    <th className="p-3.5 text-center">N. Ordini</th>
                    <th className="p-3.5 font-mono">Ultimo Acquisto</th>
                    <th className="p-3.5 text-right">Valore Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {topProducts.map((prod, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-[#5A5A40]">{prod.code}</td>
                      <td className="p-3.5 font-bold text-gray-900">{prod.description}</td>
                      <td className="p-3.5">
                        <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium border border-gray-200">
                          {prod.category}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-gray-800">
                        {prod.totalQty} {prod.um}
                      </td>
                      <td className="p-3.5 text-center font-bold text-gray-600">
                        {prod.purchaseCount} volte
                      </td>
                      <td className="p-3.5 font-mono text-gray-500">
                        {prod.lastDate ? safeFormatDate(prod.lastDate) : 'Senza data'}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-gray-900">
                        € {prod.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. STORICO DOCUMENTI & DETTAGLIO RIGHE (ACCORDION) */}
          <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-gray-900 flex items-center gap-2">
                  <FileSpreadsheet size={20} className="text-[#5A5A40]" />
                  Storico Documenti & Fatture Vendita ({documentsGrouped.length})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Elenco completo dei documenti storici con dettaglio righe e articoli acquistati.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {documentsGrouped.map((doc, idx) => {
                const docKey = `${doc.docNumber}_${doc.docDate}`;
                const isExpanded = !!expandedDocs[docKey];

                return (
                  <div 
                    key={docKey}
                    className="border border-gray-200 rounded-2xl overflow-hidden transition-all bg-[#F9FAFB]"
                  >
                    {/* ACCORDION HEADER */}
                    <div 
                      onClick={() => toggleDocExpand(docKey)}
                      className="p-4 bg-white hover:bg-gray-50/80 cursor-pointer flex items-center justify-between transition-colors border-b border-transparent hover:border-gray-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl font-mono text-xs font-bold">
                          {doc.docType || 'Documento'} {doc.docNumber && doc.docNumber !== 'N/D' ? `#${doc.docNumber}` : ''}
                        </div>
                        <div>
                          <span className="font-mono text-xs font-bold text-gray-800 block">
                            Data: {doc.docDate ? safeFormatDate(doc.docDate) : 'Senza data'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {doc.items.length} {doc.items.length === 1 ? 'articolo' : 'articoli distinti'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono font-black text-sm text-gray-900">
                          € {doc.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <button className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED CONTENT: ITEMS TABLE */}
                    {isExpanded && (
                      <div className="p-4 bg-[#F9FAFB] border-t border-gray-200/80 text-xs space-y-3">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[9px] font-black uppercase text-gray-400 border-b border-gray-200">
                              <th className="pb-2">Codice</th>
                              <th className="pb-2">Descrizione Prodotto</th>
                              <th className="pb-2">Categoria</th>
                              <th className="pb-2 text-center">Qtà</th>
                              <th className="pb-2 text-right">Prezzo Unit.</th>
                              <th className="pb-2 text-right">Totale Riga</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200/60 font-mono">
                            {doc.items.map((row) => (
                              <tr key={row.id} className="hover:bg-white/60">
                                <td className="py-2.5 font-bold text-[#5A5A40]">{row.product_code || 'N/D'}</td>
                                <td className="py-2.5 font-sans font-medium text-gray-800">{row.product_description}</td>
                                <td className="py-2.5 font-sans text-gray-500">{row.category || '-'}</td>
                                <td className="py-2.5 text-center font-bold text-gray-800">{row.quantity} {row.unit_of_measure || 'pz'}</td>
                                <td className="py-2.5 text-right text-gray-600">€ {Number(row.unit_price).toFixed(2)}</td>
                                <td className="py-2.5 text-right font-bold text-gray-900">
                                  € {Number(row.total_amount).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* CONFIRM CLEAR MODAL */}
      <ConfirmModal
        isOpen={showConfirmClear}
        onClose={() => setShowConfirmClear(false)}
        onConfirm={handleClearHistory}
        title="Azzera Dati Importati"
        message={`Sei sicuro di voler cancellare i dati dello storico importati da file Excel per ${clientName}? Gli ordini e i dati registrati tramite il CRM rimarranno inalterati.`}
        confirmText="Sì, Azzera Dati Importati"
        cancelText="Annulla"
        type="danger"
      />
    </div>
  );
}
