import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Users, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  Clock,
  ChevronRight,
  Calendar,
  Lock,
  Check,
  FileText,
  Filter,
  CheckCircle2,
  Activity,
  Eye,
  ShoppingBag,
  X,
  CreditCard,
  TrendingUp,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { Client, Task, User } from '../types';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import ClientSalesHistory from '../components/ClientSalesHistory';

function parseClientNotes(notesStr: string | null | undefined) {
  if (!notesStr) return { rawNotes: '', daneaData: {} as Record<string, string> };

  let rawNotes = notesStr;
  let daneaData: Record<string, string> = {};

  // Check if there is JSON metadata
  if (notesStr.includes('---DANEA_METADATA---')) {
    const parts = notesStr.split('---DANEA_METADATA---');
    rawNotes = parts[0].trim();
    try {
      daneaData = JSON.parse(parts[1].trim());
    } catch (e) {
      console.error("Failed to parse DANEA_METADATA JSON", e);
    }
  } else {
    // Extract key-value pairs written as text lines
    const lines = notesStr.split('\n');
    const remainingLines: string[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const prefixes = [
        { key: 'Note', label: 'Note' },
        { key: 'Note Documenti', label: 'Note doc.' },
        { key: 'Indirizzo', label: 'Indirizzo' },
        { key: 'Cod. Fiscale', label: 'Codice fiscale' },
        { key: 'P. IVA', label: 'Partita Iva' },
        { key: 'Cod. Destinatario SDIC', label: 'Cod. destinatario Fatt. elettr.' },
        { key: 'Pagamento', label: 'Pagamento' },
        { key: 'Banca', label: 'Banca' },
        { key: 'Listino', label: 'Listino' },
        { key: 'Agente', label: 'Agente' },
      ];

      let matched = false;
      for (const pref of prefixes) {
        if (trimmed.startsWith(`${pref.key}:`)) {
          const val = trimmed.substring(pref.key.length + 1).trim();
          if (val) {
            daneaData[pref.label] = val;
          }
          matched = true;
          break;
        }
      }

      if (!matched) {
        remainingLines.push(line);
      }
    });

    if (Object.keys(daneaData).length > 0) {
      rawNotes = remainingLines.join('\n').trim();
    }
  }

  return { rawNotes, daneaData };
}

interface ClientDetailProps {
  user?: User | null;
}

export default function ClientDetail({ user: propUser }: ClientDetailProps = {}) {
  const { id } = useParams();
  const [currentUser, setCurrentUser] = useState<User | null>(propUser || null);
  const [client, setClient] = useState<(Client & { activities: Task[] }) | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [hidePastDeadlines, setHidePastDeadlines] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'anagrafica' | 'analytics'>('anagrafica');

  useEffect(() => {
    if (propUser) {
      setCurrentUser(propUser);
    } else {
      fetch('/api/me')
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setCurrentUser(data); })
        .catch(() => {});
    }
  }, [propUser]);

  const userRole = (currentUser?.role || '').toLowerCase();
  const isAgent = userRole === 'agent' || userRole === 'agente';
  const isCapoArea = userRole === 'capoarea';
  const isSalesRole = isAgent || isCapoArea;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/clients/${id}`).then(res => res.ok ? res.json() : null),
      fetch(`/api/easyfatt/orders?clientId=${id}`).then(res => res.ok ? res.json() : []),
      fetch(`/api/payment-methods`).then(res => res.ok ? res.json() : [])
    ]).then(([clientData, ordersData, pmData]) => {
      setClient(clientData);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setPaymentMethods(Array.isArray(pmData) ? pmData : []);
      setLoading(false);
    }).catch(err => {
      console.error("Error loading client detail data:", err);
      setLoading(false);
    });
  }, [id]);

  // Helper to calculate order installment dates
  const calculateOrderInstallments = (order: any, pms: any[]) => {
    const pm = pms.find(p => p.name === order.payment_name);
    const installmentsNum = pm ? (pm.installments || 1) : 1;
    const offsetDays = pm ? (pm.offset_days || 0) : 0;
    const fineMese = pm ? (pm.fine_mese === 1 || pm.fine_mese === true) : false;

    const orderInstallments: { date: string; amount: number }[] = [];
    if (installmentsNum > 1) {
      const baseAmount = Math.floor((order.total / installmentsNum) * 100) / 100;
      const difference = Math.round((order.total - (baseAmount * installmentsNum)) * 100) / 100;

      for (let i = 0; i < installmentsNum; i++) {
        let amt = baseAmount;
        if (i === installmentsNum - 1) {
          amt = Math.round((baseAmount + difference) * 100) / 100;
        }
        let currentDate = new Date(order.date);
        let dateStr = order.date;
        if (!isNaN(currentDate.getTime())) {
          const gap = offsetDays === 0 ? 30 : offsetDays;
          let d = new Date(currentDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
          if (fineMese) {
            d = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          }
          for (let j = 1; j <= i; j++) {
            d = new Date(d.getTime() + gap * 24 * 60 * 60 * 1000);
            if (fineMese) {
              d = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            }
          }
          dateStr = d.toISOString().split('T')[0];
        }
        orderInstallments.push({ date: dateStr, amount: amt });
      }
    } else {
      let currentDate = new Date(order.date);
      let dateStr = order.date;
      if (!isNaN(currentDate.getTime())) {
        let d = new Date(currentDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
        if (fineMese) {
          d = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        }
        dateStr = d.toISOString().split('T')[0];
      }
      orderInstallments.push({ date: dateStr, amount: order.total });
    }
    return orderInstallments;
  };

  // Compute all installment deadlines across this client's orders
  const allDeadlines = useMemo(() => {
    const deadlines: {
      orderId: number;
      orderNumber: string | number;
      orderDate: string;
      date: string;
      amount: number;
      installmentIndex: number;
      totalInstallments: number;
      paymentName: string;
      isOverdue: boolean;
      orderObj: any;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    orders.forEach(order => {
      const insts = calculateOrderInstallments(order, paymentMethods);
      if (insts && insts.length > 0) {
        insts.forEach((inst, index) => {
          const isPast = inst.date < todayStr;
          deadlines.push({
            orderId: order.id,
            orderNumber: order.number || order.id,
            orderDate: order.date,
            date: inst.date,
            amount: inst.amount,
            installmentIndex: index + 1,
            totalInstallments: insts.length,
            paymentName: order.payment_name || 'N/D',
            isOverdue: isPast,
            orderObj: order
          });
        });
      }
    });

    deadlines.sort((a, b) => a.date.localeCompare(b.date));
    return deadlines;
  }, [orders, paymentMethods]);

  const visibleDeadlines = useMemo(() => {
    if (hidePastDeadlines) {
      return allDeadlines.filter(d => !d.isOverdue);
    }
    return allDeadlines;
  }, [allDeadlines, hidePastDeadlines]);

  // Group visible deadlines by YYYY-MM for monthly cashflow
  const monthlyPayments = useMemo(() => {
    const groups: Record<string, { month: string; total: number; installments: any[] }> = {};

    visibleDeadlines.forEach(inst => {
      const month = inst.date.substring(0, 7); // YYYY-MM
      if (!groups[month]) {
        groups[month] = { month, total: 0, installments: [] };
      }
      groups[month].total += inst.amount;
      groups[month].installments.push(inst);
    });

    return Object.values(groups).sort((a, b) => a.month.localeCompare(b.month));
  }, [visibleDeadlines]);

  const totalTurnover = useMemo(() => {
    return orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [orders]);

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold">Caricamento scheda cliente...</div>;
  if (!client) return <div className="p-8 text-center text-rose-600 font-bold">Cliente non trovato</div>;

  const { rawNotes, daneaData } = parseClientNotes(client.notes);
  const hasDaneaData = Object.keys(daneaData).length > 0;

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(fieldId);
    setTimeout(() => setCopiedText(null), 1500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/clients" className="p-2 hover:bg-[#F3F4F6] rounded-xl transition-colors text-[#6B7280]">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-serif font-bold text-[#111827] flex items-center flex-wrap gap-3">
            <span>{client.name}</span>
            {client.code && (
              <span className="text-sm font-sans font-black px-3 py-1 bg-[#F5F5F0] text-[#5A5A40] rounded-full border border-[#5A5A40]/10 flex items-center gap-1">
                <Lock size={12} />
                Codice Easyfatt: {client.code}
              </span>
            )}
          </h1>
        </div>

        {/* TABS SELECTOR & ACTIONS */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <Link
            to={`/crea-ordine?clientId=${client.id}`}
            className="flex items-center gap-2 bg-[#5A5A40] hover:bg-[#484833] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Apri il catalogo per creare un ordine per questo cliente"
          >
            <ShoppingBag size={15} />
            <span>Crea Nuovo Ordine</span>
          </Link>

          <div className="flex items-center p-1 bg-[#F3F4F6] rounded-2xl border border-gray-200/80">
            <button
              onClick={() => setActiveTab('anagrafica')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                activeTab === 'anagrafica'
                  ? "bg-white text-[#111827] shadow-xs"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <Users size={15} className={activeTab === 'anagrafica' ? "text-[#5A5A40]" : "text-gray-400"} />
              <span>Scheda Anagrafica & Scadenze</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                activeTab === 'analytics'
                  ? "bg-white text-[#111827] shadow-xs"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <BarChart3 size={15} className={activeTab === 'analytics' ? "text-[#5A5A40]" : "text-gray-400"} />
              <span>Statistiche & Storico Acquisti</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'anagrafica' ? (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Contact Info & Orders Summary */}
        <div className="space-y-8">
          {/* Contact Info Card */}
          <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <h2 className="text-lg font-serif font-bold flex items-center gap-2">
              <Users size={18} className="text-[#5A5A40]" />
              Informazioni Contatto
            </h2>
            <div className="space-y-4">
              {client.code && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 bg-[#F9FAFB] rounded-lg text-[#6B7280]">
                    <Users size={16} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Codice Cliente</div>
                    <div className="font-bold text-[#111827]">{client.code}</div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-[#F9FAFB] rounded-lg text-[#6B7280]">
                  <Users size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Referente</div>
                  <div className="font-bold text-[#111827]">{client.contact || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-[#F9FAFB] rounded-lg text-[#6B7280]">
                  <Phone size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Telefono</div>
                  <div className="font-bold text-[#111827]">{client.phone || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-[#F9FAFB] rounded-lg text-[#6B7280]">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Email</div>
                  <div className="font-bold text-[#111827]">{client.email || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-[#F9FAFB] rounded-lg text-[#6B7280]">
                  <MapPin size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Città</div>
                  <div className="font-bold text-[#111827]">{client.city || 'N/A'}</div>
                </div>
              </div>
            </div>
            {rawNotes && (
              <div className="pt-6 border-t border-[#F3F4F6]">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Note in Anagrafica</div>
                <p className="text-sm text-[#4B5563] leading-relaxed whitespace-pre-line">"{rawNotes}"</p>
              </div>
            )}
          </div>

          {/* Orders & Commercial Summary Card */}
          <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold flex items-center gap-2">
                <ShoppingBag size={18} className="text-[#5A5A40]" />
                Sintesi Ordini Cliente
              </h2>
              <span className="text-xs font-black bg-[#5A5A40]/10 text-[#5A5A40] px-2.5 py-1 rounded-full">
                {orders.length} {orders.length === 1 ? 'ordine' : 'ordini'}
              </span>
            </div>

            <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fatturato Ordini Generato</span>
                <p className="text-xl font-serif font-black text-[#111827]">
                  € {totalTurnover.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-800 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
            </div>

            {/* Quick Orders List */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Storico Ordini Recenti</span>
              {orders.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nessun ordine registrato per questo cliente.</p>
              ) : (
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {orders.map((ord: any) => (
                    <div 
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className="p-3 bg-[#F9FAFB] hover:bg-[#F3F4F6] rounded-2xl border border-gray-200/80 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#111827] group-hover:text-[#5A5A40] transition-colors">
                            Ord. #{ord.number || ord.id}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border",
                            ord.status === 'Esportato' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-100 text-gray-600 border-gray-200"
                          )}>
                            {ord.status || 'Nuovo'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 block mt-0.5 font-mono">
                          {ord.date ? ord.date.split('-').reverse().join('/') : 'N/D'} • {ord.payment_name || 'N/D'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-[#111827] block">
                          € {Number(ord.total).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-[#5A5A40] font-bold underline opacity-0 group-hover:opacity-100 transition-opacity">
                          Dettagli
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Deadlines Planning & Easyfatt Metadata & Activities */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* PIANIFICAZIONE SCADENZE E RATE DI PAGAMENTO */}
          <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-[#111827]">
                    Pianificazione Scadenze & Rate di Pagamento
                  </h3>
                </div>
                <p className="text-xs text-[#6B7280]">
                  Calendario scadenziario e flussi finanziari generati dalle condizioni di pagamento degli ordini cliente (RB, Bonifici, Acconti, ecc.).
                </p>
              </div>

              {/* TEMPORAL FILTER TOGGLE */}
              <label className="flex items-center gap-2.5 cursor-pointer bg-[#F9FAFB] hover:bg-gray-100 px-4 py-2.5 rounded-xl border border-[#E5E7EB] transition-all text-xs font-bold text-[#111827] shadow-2xs select-none shrink-0">
                <input
                  type="checkbox"
                  checked={hidePastDeadlines}
                  onChange={(e) => setHidePastDeadlines(e.target.checked)}
                  className="w-4 h-4 rounded text-[#5A5A40] focus:ring-[#5A5A40] border-gray-300 accent-[#5A5A40]"
                />
                <Filter size={14} className="text-[#5A5A40]" />
                <span>Nascondi scadenze passate</span>
              </label>
            </div>

            {/* DEADLINES STATS SUMMARY BADGES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-800">Scadenze In Essere / Future</span>
                  <p className="text-base font-black text-emerald-950">
                    {allDeadlines.filter(d => !d.isOverdue).length} rate
                  </p>
                </div>
                <span className="text-sm font-mono font-black text-emerald-700">
                  € {allDeadlines.filter(d => !d.isOverdue).reduce((s, d) => s + d.amount, 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-800">Scadenze Antecedenti / Passate</span>
                  <p className="text-base font-black text-amber-950">
                    {allDeadlines.filter(d => d.isOverdue).length} rate {hidePastDeadlines ? '(Nascoste)' : '(Visibili)'}
                  </p>
                </div>
                <span className="text-sm font-mono font-black text-amber-700">
                  € {allDeadlines.filter(d => d.isOverdue).reduce((s, d) => s + d.amount, 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-600">Totale Rate Visualizzate</span>
                  <p className="text-base font-black text-gray-900">
                    {visibleDeadlines.length} rate
                  </p>
                </div>
                <span className="text-sm font-mono font-black text-[#5A5A40]">
                  € {visibleDeadlines.reduce((s, d) => s + d.amount, 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* DEADLINES TABLE & CASHFLOW AGGREGATION */}
            {allDeadlines.length === 0 ? (
              <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                <Calendar size={32} className="mx-auto text-gray-300" />
                <p className="text-xs font-bold text-gray-500">Nessuna scadenza pianificata trovata per gli ordini di questo cliente.</p>
                <p className="text-[11px] text-gray-400">Le scadenze vengono calcolate automaticamente quando si registrano ordini con condizioni di pagamento a rate o differite.</p>
              </div>
            ) : visibleDeadlines.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-amber-200 bg-amber-50/30 rounded-2xl text-xs space-y-3">
                <p className="text-amber-900 font-bold">
                  Tutte le scadenze pianificate per questo cliente ({allDeadlines.length}) sono antecedenti alla data odierna e sono state nascoste dal filtro.
                </p>
                <button
                  type="button"
                  onClick={() => setHidePastDeadlines(false)}
                  className="px-4 py-2 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Mostra anche le scadenze passate
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* TABLE OF DEADLINES */}
                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 text-[10px] uppercase font-black tracking-wider text-gray-500 border-b border-gray-100">
                        <th className="p-3.5">Ordine #</th>
                        <th className="p-3.5">Data Ordine</th>
                        <th className="p-3.5">Rata / Modalità</th>
                        <th className="p-3.5">Data Scadenza</th>
                        <th className="p-3.5 text-right">Importo Rata</th>
                        <th className="p-3.5 text-center">Stato Scadenza</th>
                        <th className="p-3.5 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {visibleDeadlines.map((d, idx) => (
                        <tr key={`${d.orderId}-${d.installmentIndex}-${idx}`} className={cn(
                          "hover:bg-gray-50/50 transition-colors",
                          d.isOverdue ? "bg-amber-50/20" : ""
                        )}>
                          <td className="p-3.5 font-mono font-bold text-gray-800">
                            Ord. #{d.orderNumber}
                          </td>
                          <td className="p-3.5 font-mono text-gray-500">
                            {d.orderDate ? d.orderDate.split('-').reverse().join('/') : 'N/D'}
                          </td>
                          <td className="p-3.5 text-gray-600">
                            <span className="font-bold text-[#5A5A40]">Rata {d.installmentIndex}/{d.totalInstallments}</span>
                            <span className="text-[10px] text-gray-400 block truncate max-w-[180px]">{d.paymentName}</span>
                          </td>
                          <td className="p-3.5 font-mono font-bold text-gray-700">
                            {d.date.split('-').reverse().join('/')}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-[#111827]">
                            € {d.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3.5 text-center">
                            {d.isOverdue ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock size={10} />
                                Scaduta / Antecedente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 size={10} />
                                In Essere / Futura
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => setSelectedOrder(d.orderObj)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-[#5A5A40]/10 text-gray-700 hover:text-[#5A5A40] rounded-lg font-black transition-all text-[10px] cursor-pointer"
                              title="Visualizza Dettagli Ordine"
                            >
                              <Eye size={12} />
                              Ordine
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MONTHLY CASHFLOW AGGREGATION CARD */}
                {monthlyPayments.length > 0 && (
                  <div className="bg-[#F9FAFB] rounded-2xl border border-gray-200/80 p-5 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5 border-b border-gray-200 pb-2.5">
                      <Activity size={14} className="text-emerald-600" />
                      Aggregazione Mensile Flussi Incassi
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {monthlyPayments.map((gp) => {
                        const [year, month] = gp.month.split('-');
                        const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
                        return (
                          <div key={gp.month} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-800 capitalize text-xs flex items-center gap-1.5">
                                <Calendar size={12} className="text-[#5A5A40]" />
                                {monthName}
                              </span>
                              <span className="font-mono font-bold text-emerald-700 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                € {gp.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-100">
                              {gp.installments.map((inst: any, idx: number) => (
                                <span key={idx} className="text-[9px] bg-gray-50 text-gray-700 px-2 py-0.5 rounded font-mono border border-gray-200/60">
                                  Ord. #{inst.orderNumber} (Rata {inst.installmentIndex}/{inst.totalInstallments}): €{inst.amount.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DANEA EASYFATT SYNCHRONIZED METADATA */}
          {hasDaneaData && (
            <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-800">
                    <Lock size={16} />
                  </div>
                  <div>
                    <h3 className="text-md font-serif font-bold text-gray-900 flex items-center gap-1.5">
                      Dati Sincronizzati Danea Easyfatt
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      Sola Lettura — Aggiornato tramite tracciato d'importazione Easyfatt
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-center text-[9px] bg-amber-500/10 text-amber-950 font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Lock size={11} />
                  Sola Lettura
                </span>
              </div>

              {/* Structured Grid Layout for Easyfatt Data */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* 1. Dati Fiscali */}
                <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-gray-100 space-y-3.5">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-[#5A5A40] border-b border-gray-200 pb-2 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Fisco & Invoicing
                  </h5>
                  <div className="space-y-2.5">
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Partita IVA</span>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="font-bold text-gray-800 font-mono text-xs">{daneaData['Partita Iva'] || 'N/D'}</span>
                        {daneaData['Partita Iva'] && (
                          <button
                            onClick={() => copyToClipboard(daneaData['Partita Iva'], 'piva')}
                            className="p-1 hover:bg-white rounded text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-150 transition-colors cursor-pointer"
                            title="Copia Partita IVA"
                          >
                            {copiedText === 'piva' ? <Check size={11} className="text-emerald-600" /> : <FileText size={11} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Codice Fiscale</span>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="font-bold text-gray-800 font-mono text-xs">{daneaData['Codice fiscale'] || 'N/D'}</span>
                        {daneaData['Codice fiscale'] && (
                          <button
                            onClick={() => copyToClipboard(daneaData['Codice fiscale'], 'cf')}
                            className="p-1 hover:bg-white rounded text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-150 transition-colors cursor-pointer"
                            title="Copia Codice Fiscale"
                          >
                            {copiedText === 'cf' ? <Check size={11} className="text-emerald-600" /> : <FileText size={11} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Codice SDI</span>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className={cn(
                          "font-bold font-mono text-xs px-1.5 py-0.5 rounded",
                          daneaData['Cod. destinatario Fatt. elettr.'] ? "bg-amber-500/10 text-amber-950" : "text-gray-400"
                        )}>
                          {daneaData['Cod. destinatario Fatt. elettr.'] || 'N/D'}
                        </span>
                        {daneaData['Cod. destinatario Fatt. elettr.'] && (
                          <button
                            onClick={() => copyToClipboard(daneaData['Cod. destinatario Fatt. elettr.'], 'sdi')}
                            className="p-1 hover:bg-white rounded text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-150 transition-colors cursor-pointer"
                            title="Copia Codice SDI"
                          >
                            {copiedText === 'sdi' ? <Check size={11} className="text-emerald-600" /> : <FileText size={11} />}
                          </button>
                        )}
                      </div>
                    </div>
                    {daneaData['Pec'] && (
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Indirizzo PEC</span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="font-bold text-gray-800 font-mono text-[10px] truncate max-w-[120px]" title={daneaData['Pec']}>{daneaData['Pec']}</span>
                          <button
                            onClick={() => copyToClipboard(daneaData['Pec'], 'pec')}
                            className="p-1 hover:bg-white rounded text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-150 transition-colors cursor-pointer"
                            title="Copia PEC"
                          >
                            {copiedText === 'pec' ? <Check size={11} className="text-emerald-600" /> : <FileText size={11} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Sede & Spedizione */}
                <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-gray-100 space-y-3.5">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-[#5A5A40] border-b border-gray-200 pb-2 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Sede & Spedizione
                  </h5>
                  <div className="space-y-2.5">
                    {daneaData['Indirizzo'] && (
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Indirizzo</span>
                        <span className="font-bold text-gray-800 block mt-0.5 leading-tight">{daneaData['Indirizzo']}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {daneaData['Cap'] && (
                        <div>
                          <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">C.A.P.</span>
                          <span className="font-bold text-gray-800 font-mono">{daneaData['Cap']}</span>
                        </div>
                      )}
                      {daneaData['Prov.'] && (
                        <div>
                          <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Provincia</span>
                          <span className="font-bold text-gray-800 font-mono">{daneaData['Prov.']}</span>
                        </div>
                      )}
                    </div>
                    {daneaData['Regione'] && (
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Regione</span>
                        <span className="font-bold text-gray-800">{daneaData['Regione']}</span>
                      </div>
                    )}
                    {daneaData['Nazione'] && daneaData['Nazione'] !== 'Italia' && (
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Nazione</span>
                        <span className="font-bold text-gray-800">{daneaData['Nazione']}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Condizioni Commerciali */}
                <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-gray-100 space-y-3.5">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-[#5A5A40] border-b border-gray-200 pb-2 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Condizioni Vendita
                  </h5>
                  <div className="space-y-2.5">
                    {daneaData['Listino'] && (
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Listino Associato</span>
                        <span className="font-bold text-[#5A5A40] bg-[#5A5A40]/10 px-2 py-0.5 rounded text-[10px] inline-block mt-0.5 border border-[#5A5A40]/5">
                          {daneaData['Listino']}
                        </span>
                      </div>
                    )}
                    {daneaData['Sconti'] && (
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Sconti Riservati</span>
                        <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px] inline-block font-mono mt-0.5 border border-rose-100">
                          {daneaData['Sconti']}
                        </span>
                      </div>
                    )}
                    {daneaData['Fido'] && (
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Fido Accordato</span>
                        <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[10px] inline-block font-mono mt-0.5 border border-emerald-100">
                          {daneaData['Fido']}
                        </span>
                      </div>
                    )}
                    {daneaData['Agente'] && (
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block tracking-wider">Agente Associato</span>
                        <span className="font-bold text-gray-800 block mt-0.5 truncate">{daneaData['Agente']}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment details if they exist */}
              {(daneaData['Pagamento'] || daneaData['Banca'] || daneaData['Note doc.']) && (
                <div className="p-4 bg-[#F5F5F0]/30 rounded-2xl border border-[#5A5A40]/10 space-y-2 text-xs text-gray-700">
                  <span className="text-gray-400 font-bold uppercase text-[8px] tracking-wider block">Modalità Pagamento & Note Interne</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {daneaData['Pagamento'] && (
                      <div>
                        <strong className="text-gray-400 font-bold uppercase text-[8px]">Pagamento:</strong> <span className="font-bold text-gray-800">{daneaData['Pagamento']}</span>
                      </div>
                    )}
                    {daneaData['Banca'] && (
                      <div>
                        <strong className="text-gray-400 font-bold uppercase text-[8px]">Banca d'Appoggio:</strong> <span className="font-bold text-gray-800">{daneaData['Banca']}</span>
                      </div>
                    )}
                    {daneaData['Note doc.'] && (
                      <div className="sm:col-span-2 italic text-[#52524E] border-t border-gray-150 pt-2.5 mt-1.5">
                        <strong className="text-gray-400 not-italic font-black uppercase text-[8px] block mb-0.5">Nota per Documenti:</strong> "{daneaData['Note doc.']}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Timeline */}
          {!isSalesRole && (
            <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                  <Clock size={20} className="text-[#5A5A40]" />
                  Cronologia Attività
                </h2>
                <Link 
                  to={`/tasks?clientId=${client.id}`}
                  className="text-sm text-[#5A5A40] hover:underline font-medium"
                >
                  Vedi tutte
                </Link>
              </div>
              <div className="space-y-4">
                {client.activities && client.activities.map((activity: any) => (
                  <Link 
                    key={`${activity.activity_source}-${activity.id}`}
                    to={activity.activity_source === 'task' ? `/tasks/${activity.id}` : '#'}
                    className="flex items-start gap-4 p-5 bg-[#F9FAFB] hover:bg-[#F3F4F6] rounded-2xl border border-[#E5E7EB] transition-all group"
                  >
                    <div className={cn(
                      "p-3 rounded-xl",
                      activity.activity_source === 'call' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {activity.activity_source === 'call' ? <Phone size={18} /> : <Briefcase size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-bold text-[#111827] truncate group-hover:text-[#5A5A40] transition-colors">
                          {activity.title}
                        </div>
                        <span className={cn(
                          "text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded border",
                          activity.status === 'Completato' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          activity.status === 'In Corso' ? "bg-amber-50 text-amber-700 border-amber-100" :
                          activity.status === 'Nuovo' ? "bg-blue-50 text-blue-700 border-blue-100" :
                          "bg-gray-50 text-gray-700 border-gray-100"
                        )}>
                          {activity.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280] line-clamp-1 mb-2">
                        {activity.description || 'Nessuna descrizione'}
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">
                          <Calendar size={12} />
                          {format(parseISO(activity.created_at), 'dd MMM yyyy', { locale: it })}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">
                          <Clock size={12} />
                          {format(parseISO(activity.created_at), 'HH:mm')}
                        </div>
                        {activity.assignee_name && (
                          <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">
                            <Users size={12} />
                            {activity.assignee_name}
                          </div>
                        )}
                      </div>
                    </div>
                    {activity.activity_source === 'task' && (
                      <ChevronRight size={16} className="text-[#D1D5DB] group-hover:translate-x-1 transition-transform self-center" />
                    )}
                  </Link>
                ))}
                {(!client.activities || client.activities.length === 0) && (
                  <div className="text-center py-12 bg-[#F9FAFB] rounded-3xl border border-dashed border-[#E5E7EB]">
                    <p className="text-sm text-[#9CA3AF] font-medium">Nessuna attività registrata per questo cliente</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
        <ClientSalesHistory clientId={client.id} isAdmin={!isSalesRole} clientName={client.name} />
      )}

      {/* ORDER DETAIL MODAL */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl border border-gray-100"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingBag size={20} className="text-[#5A5A40]" />
                    Dettaglio Ordine #{selectedOrder.number || selectedOrder.id}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Data Ordine: {selectedOrder.date ? selectedOrder.date.split('-').reverse().join('/') : 'N/D'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Order Metadata */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#F9FAFB] rounded-2xl border border-gray-100 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">Cliente</span>
                  <span className="font-bold text-gray-800">{client.name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">Stato Documento</span>
                  <span className={cn(
                    "inline-block font-black uppercase px-2 py-0.5 rounded text-[10px] mt-0.5 border",
                    selectedOrder.status === 'Esportato' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-100 text-gray-700 border-gray-200"
                  )}>
                    {selectedOrder.status || 'Nuovo'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">Metodo di Pagamento</span>
                  <span className="font-bold text-[#5A5A40] block">{selectedOrder.payment_name || 'Non specificato'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">Banca d'Appoggio</span>
                  <span className="font-bold text-gray-700 block truncate">{selectedOrder.payment_bank || 'N/D'}</span>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">
                  Articoli in Ordine ({selectedOrder.items ? selectedOrder.items.length : 0})
                </h4>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="border border-gray-100 rounded-2xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100">
                        <tr>
                          <th className="p-3">Codice</th>
                          <th className="p-3">Descrizione</th>
                          <th className="p-3 text-center">Qtà</th>
                          <th className="p-3 text-right">Prezzo</th>
                          <th className="p-3 text-right">Totale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-mono">
                        {selectedOrder.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="p-3 font-bold text-gray-700">{item.product_code}</td>
                            <td className="p-3 font-sans font-medium text-gray-800">{item.description}</td>
                            <td className="p-3 text-center font-bold">{item.qty} {item.um || 'pz'}</td>
                            <td className="p-3 text-right">€ {Number(item.price).toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-gray-900">
                              € {(Number(item.qty) * Number(item.price)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Nessun articolo associato.</p>
                )}
              </div>

              {/* Order Total & Notes */}
              <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {selectedOrder.notes ? (
                  <div className="text-xs text-gray-500 italic max-w-xs">
                    <strong>Note:</strong> "{selectedOrder.notes}"
                  </div>
                ) : <div />}
                <div className="text-right self-end sm:self-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Totale Complessivo Ordine</span>
                  <span className="text-2xl font-serif font-black text-[#111827]">
                    € {Number(selectedOrder.total).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
