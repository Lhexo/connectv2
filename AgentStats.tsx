import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Calendar, 
  Users, 
  AlertTriangle, 
  ArrowUpRight, 
  Eye, 
  Copy, 
  Search, 
  Filter, 
  Target, 
  Edit3, 
  PlusCircle, 
  Sparkles,
  ChevronRight,
  Printer,
  ChevronDown,
  X,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Order, Client } from '../types';
import { printOrderDocument, copyOrderToClipboard, downloadOrderPdf, buildPrintableFromOrder, PrintableOrderData } from '../utils/printAndCopyOrder';

export default function AgentStats({ user, currentUser }: { user?: any; currentUser?: any }) {
  const activeUser = user || currentUser;
  const navigate = useNavigate();

  const isCapoArea = activeUser?.role === 'capoarea' || activeUser?.role === 'capo_area' || activeUser?.role === 'area_manager';
  const isAdmin = activeUser?.role === 'admin' || activeUser?.role === 'amministratore';
  const [scopeFilter, setScopeFilter] = useState<'all' | 'my'>('all');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for order history
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'Bozza' | 'Nuovo' | 'Confermato'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Agent monthly target (stored in localStorage per user)
  const userStorageKey = `agent_monthly_target_${activeUser?.id || 'default'}`;
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    const saved = localStorage.getItem(userStorageKey);
    return saved ? Number(saved) : 15000;
  });
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [newTargetInput, setNewTargetInput] = useState<string>(String(monthlyTarget));

  // Selected Order for Detail Modal
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

  // Helper to construct printable order data
  const getPrintableFromOrder = (ord: Order): PrintableOrderData => {
    const client = clients.find(c => 
      (ord.client_id && String(c.id) === String(ord.client_id)) ||
      (ord.client_name && c.name.toLowerCase() === ord.client_name.toLowerCase()) ||
      (Boolean((ord as any).client_code) && c.code && c.code === (ord as any).client_code)
    );
    return buildPrintableFromOrder(ord, client);
  };

  // Load orders and clients
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const orderUrl = (isCapoArea || isAdmin) && scopeFilter === 'my'
          ? '/api/easyfatt/orders?scope=my'
          : '/api/easyfatt/orders';
        const [ordersRes, clientsRes] = await Promise.all([
          fetch(orderUrl),
          fetch('/api/clients')
        ]);

        if (ordersRes.ok) {
          const ords: Order[] = await ordersRes.json();
          setOrders(ords);
        }

        if (clientsRes.ok) {
          const cls: Client[] = await clientsRes.json();
          setClients(cls);
        }
      } catch (err) {
        console.error('Error loading stats data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [scopeFilter, isCapoArea, isAdmin]);

  const saveTarget = () => {
    const val = Number(newTargetInput);
    if (val > 0) {
      setMonthlyTarget(val);
      localStorage.setItem(userStorageKey, String(val));
    }
    setIsEditingTarget(false);
  };

  // Current Month calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Orders in current month (excluding drafts)
  const currentMonthConfirmedOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.date) return false;
      const d = new Date(o.date);
      const isCurrentMonth = d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      return isCurrentMonth && o.status !== 'Bozza';
    });
  }, [orders, currentYear, currentMonth]);

  const currentMonthRevenue = useMemo(() => {
    return currentMonthConfirmedOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  }, [currentMonthConfirmedOrders]);

  const targetProgressPercent = useMemo(() => {
    if (monthlyTarget <= 0) return 0;
    return Math.min(100, Math.round((currentMonthRevenue / monthlyTarget) * 100));
  }, [currentMonthRevenue, monthlyTarget]);

  // Monthly Sales Chart Data (Last 6 months)
  const monthlyChartData = useMemo(() => {
    const monthsNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const result = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const label = `${monthsNames[mIdx]} '${String(yr).slice(-2)}`;

      const total = orders
        .filter(o => {
          if (!o.date || o.status === 'Bozza') return false;
          const od = new Date(o.date);
          return od.getFullYear() === yr && od.getMonth() === mIdx;
        })
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      result.push({
        name: label,
        fatturato: Math.round(total),
      });
    }

    return result;
  }, [orders, currentYear, currentMonth]);

  // Top Clients & Re-engagement (60+ days without order)
  const clientStats = useMemo(() => {
    const clientMap = new Map<number, { client: Client; totalSpent: number; orderCount: number; lastOrderDate: string | null }>();

    clients.forEach(c => {
      clientMap.set(c.id, { client: c, totalSpent: 0, orderCount: 0, lastOrderDate: null });
    });

    orders.forEach(o => {
      if (o.client_id && o.status !== 'Bozza') {
        const entry = clientMap.get(o.client_id);
        if (entry) {
          entry.totalSpent += Number(o.total) || 0;
          entry.orderCount += 1;
          if (!entry.lastOrderDate || new Date(o.date) > new Date(entry.lastOrderDate)) {
            entry.lastOrderDate = o.date;
          }
        }
      }
    });

    const list = Array.from(clientMap.values());

    // Sort by total spent for top ranking
    const topRevenue = [...list]
      .filter(item => item.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    // Filter inactive clients (last order > 60 days ago or never ordered)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const inactiveClients = list
      .filter(item => {
        if (!item.lastOrderDate) return false; // never ordered
        return new Date(item.lastOrderDate) < sixtyDaysAgo;
      })
      .sort((a, b) => new Date(a.lastOrderDate!).getTime() - new Date(b.lastOrderDate!).getTime())
      .slice(0, 5);

    return { topRevenue, inactiveClients };
  }, [clients, orders]);

  // Filtered Orders List
  const filteredOrders = useMemo(() => {
    const q = orderSearchQuery.toLowerCase().trim();
    return orders.filter(o => {
      // Status filter
      if (orderStatusFilter !== 'all') {
        if (orderStatusFilter === 'Bozza' && o.status !== 'Bozza') return false;
        if (orderStatusFilter === 'Nuovo' && o.status !== 'Nuovo') return false;
        if (orderStatusFilter === 'Confermato' && !['Confermato', 'Esportato', 'Completato'].includes(o.status)) return false;
      }

      // Search query
      if (!q) return true;
      const clientName = o.client_name?.toLowerCase() || '';
      const orderNum = String(o.number || o.id);
      const notes = o.notes?.toLowerCase() || '';

      return clientName.includes(q) || orderNum.includes(q) || notes.includes(q);
    });
  }, [orders, orderStatusFilter, orderSearchQuery]);

  // Duplicate / Re-order action
  const handleDuplicateOrder = (order: Order) => {
    navigate(`/ordine?duplicateOrderId=${order.id}${order.client_id ? `&clientId=${order.client_id}` : ''}`);
  };

  // Continue Draft action
  const handleContinueDraft = (order: Order) => {
    navigate(`/ordine?orderId=${order.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-[#5A5A40] uppercase tracking-wider">Caricamento Statistiche...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl font-bold">
              <TrendingUp size={20} />
            </span>
            <span className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider">
              Performance & Portafoglio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Statistiche & Storico Ordini
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Tieni d'occhio i tuoi progressi mensili, le bozze in lavorazione e lo storico ordini dei tuoi clienti.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/ordine')}
          className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white px-5 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer shrink-0 self-start md:self-auto"
        >
          <ShoppingBag size={18} />
          <span>Crea Nuovo Ordine</span>
        </button>
      </div>

      {/* Target & Revenue Progress Block (Tactical & Focused) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly Target Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Target size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">
                  Obiettivo Mensile Personale
                </h3>
                <span className="text-xs text-gray-400">
                  Mese corrente: {new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(now)}
                </span>
              </div>
            </div>

            {/* Edit Target Button */}
            {!isEditingTarget ? (
              <button
                type="button"
                onClick={() => { setIsEditingTarget(true); setNewTargetInput(String(monthlyTarget)); }}
                className="text-xs font-bold text-[#5A5A40] hover:text-[#4A4A30] flex items-center gap-1.5 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                title="Modifica Obiettivo"
              >
                <Edit3 size={14} />
                <span>Modifica Target</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={newTargetInput}
                  onChange={e => setNewTargetInput(e.target.value)}
                  className="w-24 px-2 py-1 text-xs font-bold border border-gray-300 rounded-lg outline-none"
                />
                <button
                  type="button"
                  onClick={saveTarget}
                  className="bg-[#5A5A40] text-white text-xs px-2.5 py-1 rounded-lg font-bold"
                >
                  Salva
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTarget(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Big numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                Fatturato Mese
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-gray-900">
                € {currentMonthRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                Target Fissato
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-gray-500">
                € {monthlyTarget.toLocaleString('it-IT')}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                Raggiungimento
              </span>
              <span className={`text-2xl sm:text-3xl font-black font-mono ${
                targetProgressPercent >= 100 ? 'text-emerald-600' : 'text-[#5A5A40]'
              }`}>
                {targetProgressPercent}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${targetProgressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full transition-all ${
                  targetProgressPercent >= 100 
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' 
                    : 'bg-gradient-to-r from-[#5A5A40] to-amber-500'
                }`}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-gray-400 mt-2 font-medium">
              <span>0 €</span>
              <span>
                {targetProgressPercent >= 100 
                  ? '🎉 Obiettivo mensile superato!' 
                  : `Mancano € ${(Math.max(0, monthlyTarget - currentMonthRevenue)).toLocaleString('it-IT', { minimumFractionDigits: 2 })} al target`}
              </span>
              <span>€ {monthlyTarget.toLocaleString('it-IT')}</span>
            </div>
          </div>
        </div>

        {/* Quick KPI summary */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider">
            Attività Ordini Recenti
          </h4>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                  <Clock size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-800 block">Bozze in sospeso</span>
                  <span className="text-[11px] text-amber-700">Ordini da finalizzare</span>
                </div>
              </div>
              <span className="text-xl font-black font-mono text-amber-800">
                {orders.filter(o => o.status === 'Bozza').length}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-800 block">Ordini confermati</span>
                  <span className="text-[11px] text-emerald-700">Questo mese</span>
                </div>
              </div>
              <span className="text-xl font-black font-mono text-emerald-800">
                {currentMonthConfirmedOrders.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOrderStatusFilter('Bozza')}
            className="w-full text-center py-2 text-xs font-bold text-[#5A5A40] hover:underline"
          >
            Vedi tutte le bozze in sospeso →
          </button>
        </div>
      </div>

      {/* Sales Trend Chart (Clean & Simple) */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-black text-gray-900">
              Andamento Vendite (Ultimi 6 Mesi)
            </h3>
            <span className="text-xs text-gray-400">
              Fatturato generato nei mesi precedenti
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `€${val}`} />
              <Tooltip 
                formatter={(val: any) => [`€ ${Number(val).toLocaleString('it-IT')}`, 'Fatturato']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="fatturato" fill="#5A5A40" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Clients & Inactive Clients Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top 5 Clients by Revenue */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#5A5A40]" />
                <h3 className="text-base font-black text-gray-900">Top Clienti per Volume</h3>
              </div>
              <span className="text-xs text-gray-400 font-bold">Classifica personale</span>
            </div>

            <div className="space-y-2.5">
              {clientStats.topRevenue.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">Nessun ordine registrato finora.</p>
              ) : (
                clientStats.topRevenue.map((item, idx) => (
                  <div 
                    key={item.client.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-900 block truncate">
                          {item.client.name}
                        </span>
                        <span className="text-[11px] text-gray-400 block truncate">
                          {item.orderCount} ordini • {item.client.city || 'Senza sede'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black font-mono text-gray-900 block">
                        € {item.totalSpent.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/ordine?clientId=${item.client.id}`)}
                        className="text-[11px] font-bold text-[#5A5A40] hover:underline cursor-pointer"
                      >
                        Nuovo Ordine +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Inactive Clients: "Da Riattivare" (60+ days without orders) */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                <h3 className="text-base font-black text-gray-900">Opportunità di Riattivazione</h3>
              </div>
              <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                60+ gg senza ordini
              </span>
            </div>

            <div className="space-y-2.5">
              {clientStats.inactiveClients.length === 0 ? (
                <p className="text-xs text-emerald-600 font-bold py-6 text-center">
                  Ottimo lavoro! Tutti i tuoi clienti hanno ordinato di recente.
                </p>
              ) : (
                clientStats.inactiveClients.map((item) => {
                  const daysSince = item.lastOrderDate 
                    ? Math.floor((new Date().getTime() - new Date(item.lastOrderDate).getTime()) / (1000 * 3600 * 24))
                    : null;

                  return (
                    <div 
                      key={item.client.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-gray-900 block truncate">
                          {item.client.name}
                        </span>
                        <span className="text-[11px] text-amber-700 block">
                          Ultimo ordine: {daysSince} giorni fa ({item.lastOrderDate})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/ordine?clientId=${item.client.id}`)}
                          className="bg-[#5A5A40] text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-[#4A4A30] transition-colors cursor-pointer"
                        >
                          Ordina
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-100">
            Suggerimento: Contatta o pianifica una visita per questi clienti per proporre il riassortimento.
          </p>
        </div>
      </div>

      {/* Orders History List with Filters & Quick Actions */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs space-y-4">
        {/* Capo Area / Admin Scope Toggle */}
        {(isCapoArea || isAdmin) && (
          <div className="flex items-center gap-2 p-1.5 bg-gray-100/90 rounded-2xl w-fit text-xs mb-1">
            <span className="text-[11px] font-bold text-gray-500 pl-2">Ambito Ordini:</span>
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                scopeFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tutti gli Ordini Area
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('my')}
              className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                scopeFilter === 'my' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Solo Miei Clienti
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900">Storico Ordini</h3>
            <span className="text-xs text-gray-500">
              {filteredOrders.length} ordini trovati
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setOrderStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                orderStatusFilter === 'all'
                  ? 'bg-[#5A5A40] text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tutti ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('Bozza')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                orderStatusFilter === 'Bozza'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Bozze ({orders.filter(o => o.status === 'Bozza').length})
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('Nuovo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                orderStatusFilter === 'Nuovo'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Inviati ({orders.filter(o => o.status === 'Nuovo').length})
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('Confermato')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                orderStatusFilter === 'Confermato'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Confermati / Evasi
            </button>
          </div>
        </div>

        {/* Search inside orders */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca cliente, n. ordine o note..."
            value={orderSearchQuery}
            onChange={e => setOrderSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#5A5A40]"
          />
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-bold text-gray-700">Nessun ordine trovato con questi criteri</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Data / N.</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Stato</th>
                  <th className="py-3 px-3 text-right">Totale</th>
                  <th className="py-3 px-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map(order => {
                  const isDraft = order.status === 'Bozza';
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-gray-900 block">{order.date}</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {order.formatted_number || `ID #${order.id}`}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-gray-900 block truncate max-w-xs">
                          {order.client_name || 'Cliente sconosciuto'}
                        </span>
                        {order.notes && (
                          <span className="text-[10px] text-gray-400 italic block truncate max-w-xs">
                            {order.notes}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isDraft 
                            ? 'bg-amber-100 text-amber-800' 
                            : order.status === 'Nuovo'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-black text-gray-900">
                        € {(Number(order.total) || 0).toFixed(2)}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View details */}
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetails(order)}
                            className="p-1.5 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors cursor-pointer"
                            title="Vedi Dettagli Ordine"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Print order */}
                          <button
                            type="button"
                            onClick={() => printOrderDocument(getPrintableFromOrder(order))}
                            className="p-1.5 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors cursor-pointer"
                            title="Stampa Ordine"
                          >
                            <Printer size={16} />
                          </button>

                          {/* Download PDF */}
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await downloadOrderPdf(getPrintableFromOrder(order));
                              if (ok) showToast('PDF scaricato con successo!');
                              else showToast('Errore nel download del PDF', 'error');
                            }}
                            className="p-1.5 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors cursor-pointer"
                            title="Scarica PDF"
                          >
                            <Download size={16} />
                          </button>

                          {/* Copy order text */}
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await copyOrderToClipboard(getPrintableFromOrder(order));
                              if (ok) showToast('Riepilogo ordine copiato negli appunti!');
                            }}
                            className="p-1.5 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors cursor-pointer"
                            title="Copia Riepilogo Ordine"
                          >
                            <FileText size={16} />
                          </button>

                          {/* If draft, continue */}
                          {isDraft ? (
                            <button
                              type="button"
                              onClick={() => handleContinueDraft(order)}
                              className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Riprendi Bozza
                            </button>
                          ) : (
                            /* Reorder / Duplicate */
                            <button
                              type="button"
                              onClick={() => handleDuplicateOrder(order)}
                              className="p-1.5 hover:bg-gray-200 text-[#5A5A40] rounded-lg transition-colors cursor-pointer"
                              title="Riordina per questo cliente"
                            >
                              <Copy size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrderDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrderDetails(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-gray-200 z-10 max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-start pb-4 border-b border-gray-100">
                <div>
                  <span className="text-[10px] font-mono font-bold text-gray-400">
                    {selectedOrderDetails.formatted_number || `ORDINE #${selectedOrderDetails.id}`}
                  </span>
                  <h3 className="text-lg font-black text-gray-900">
                    {selectedOrderDetails.client_name}
                  </h3>
                  <span className="text-xs text-gray-500">
                    Data: {selectedOrderDetails.date} • Stato: {selectedOrderDetails.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Items in order */}
              <div className="flex-1 overflow-y-auto py-4 space-y-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  Articoli dell'Ordine
                </span>

                {selectedOrderDetails.items && selectedOrderDetails.items.length > 0 ? (
                  selectedOrderDetails.items.map((it, i) => (
                    <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 text-xs">
                      <div>
                        <span className="font-bold text-gray-900 block">{it.description}</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          Cod. {it.product_code} • {it.qty} {it.um || 'pz'} x € {Number(it.price).toFixed(2)}
                        </span>
                      </div>
                      <span className="font-mono font-black text-gray-900">
                        € {(Number(it.qty) * Number(it.price)).toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">Nessun dettaglio articolo registrato</p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <div className="flex justify-between items-center text-sm font-black text-gray-900">
                  <span>Totale Ordine:</span>
                  <span className="font-mono text-base text-[#5A5A40]">
                    € {(Number(selectedOrderDetails.total) || 0).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderDetails(null);
                      handleDuplicateOrder(selectedOrderDetails);
                    }}
                    className="w-full bg-[#5A5A40] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#4A4A30] transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    title="Copia e crea nuovo ordine da questo"
                  >
                    <Copy size={14} />
                    <span>Riordina</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyOrderToClipboard(getPrintableFromOrder(selectedOrderDetails));
                      if (ok) showToast('Riepilogo ordine copiato negli appunti!');
                    }}
                    className="w-full bg-amber-50 text-amber-900 border border-amber-200 py-2.5 rounded-xl font-bold text-xs hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Copia testo ordine per WhatsApp o Email"
                  >
                    <FileText size={14} />
                    <span>Copia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => printOrderDocument(getPrintableFromOrder(selectedOrderDetails))}
                    className="w-full bg-blue-50 text-blue-900 border border-blue-200 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Stampa documento ordine"
                  >
                    <Printer size={14} />
                    <span>Stampa</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await downloadOrderPdf(getPrintableFromOrder(selectedOrderDetails));
                      if (ok) showToast('PDF scaricato con successo!');
                      else showToast('Errore durante il download del PDF', 'error');
                    }}
                    className="w-full bg-emerald-50 text-emerald-900 border border-emerald-200 py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Scarica PDF A4"
                  >
                    <Download size={14} />
                    <span>Scarica PDF</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
              toastMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
