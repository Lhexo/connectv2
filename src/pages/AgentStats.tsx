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
  Eye, 
  Copy, 
  Search, 
  Filter, 
  Target, 
  Edit3, 
  Printer, 
  X, 
  Download, 
  Trash2, 
  Hash, 
  RefreshCw, 
  Award, 
  Package, 
  CreditCard, 
  UserCheck, 
  MapPin, 
  Layers, 
  FileSpreadsheet, 
  SlidersHorizontal 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Order, Client, Product, User } from '../types';
import { 
  printOrderDocument, 
  copyOrderToClipboard, 
  downloadOrderPdf, 
  buildPrintableFromOrder, 
  PrintableOrderData 
} from '../utils/printAndCopyOrder';
import { 
  computeComprehensiveStats, 
  PaymentDeadline, 
  isUserAdmin, 
  isUserCapoArea, 
  isUserAgent 
} from '../utils/statsUtils';
import { cn } from '../lib/utils';

export default function AgentStats({ user, currentUser }: { user?: any; currentUser?: any }) {
  const activeUser = user || currentUser;
  const navigate = useNavigate();

  const isAdmin = isUserAdmin(activeUser);
  const isCapoArea = isUserCapoArea(activeUser);
  const isAgent = isUserAgent(activeUser);

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>(() => {
    if (isAgent) return activeUser?.name || 'my';
    return 'all';
  });

  const [timeRangeFilter, setTimeRangeFilter] = useState<'month' | 'prev_month' | 'quarter' | 'year' | 'all'>('month');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'Bozza' | 'Nuovo' | 'Confermato'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [hidePastDeadlines, setHidePastDeadlines] = useState(true);

  // Target states
  const userStorageKey = `agent_monthly_target_${activeUser?.id || 'default'}`;
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    const saved = localStorage.getItem(userStorageKey);
    return saved ? Number(saved) : (isAdmin ? 50000 : 15000);
  });
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [newTargetInput, setNewTargetInput] = useState<string>(String(monthlyTarget));

  // Modal states
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [orderToEditNumber, setOrderToEditNumber] = useState<Order | null>(null);
  const [newOrderNumberInput, setNewOrderNumberInput] = useState('');
  const [isSavingOrderNumber, setIsSavingOrderNumber] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to construct printable order data
  const getPrintableFromOrder = (ord: Order): PrintableOrderData => {
    const client = clients.find(c => 
      (ord.client_id && String(c.id) === String(ord.client_id)) ||
      (ord.client_name && c.name.toLowerCase() === ord.client_name.toLowerCase()) ||
      (Boolean((ord as any).client_code) && c.code && c.code === (ord as any).client_code)
    );
    return buildPrintableFromOrder(ord, client);
  };

  // Load all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, clientsRes, usersRes, productsRes, pmRes] = await Promise.all([
        fetch('/api/easyfatt/orders?all=true'),
        fetch('/api/clients?all=true'),
        fetch('/api/users'),
        fetch('/api/products').catch(() => ({ ok: false, json: () => [] } as any)),
        fetch('/api/payment-methods').catch(() => ({ ok: false, json: () => [] } as any))
      ]);

      if (ordersRes.ok) {
        const ords = await ordersRes.json();
        setOrders(Array.isArray(ords) ? ords : (ords.data || []));
      }

      if (clientsRes.ok) {
        const cls = await clientsRes.json();
        setClients(Array.isArray(cls) ? cls : (cls.data || []));
      }

      if (usersRes.ok) {
        const usrs = await usersRes.json();
        setUsersList(Array.isArray(usrs) ? usrs : []);
      }

      if (productsRes.ok) {
        const prods = await productsRes.json();
        setProducts(Array.isArray(prods) ? prods : []);
      }

      if (pmRes.ok) {
        const pms = await pmRes.json();
        setPaymentMethods(Array.isArray(pms) ? pms : []);
      }
    } catch (err) {
      console.error('Error loading stats data:', err);
      showToast('Errore nel caricamento dei dati statistici', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveTarget = () => {
    const val = Number(newTargetInput);
    if (val > 0) {
      setMonthlyTarget(val);
      localStorage.setItem(userStorageKey, String(val));
    }
    setIsEditingTarget(false);
  };

  // Delete Order Handler
  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeletingOrder(true);
    try {
      const res = await fetch(`/api/easyfatt/orders/${orderToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Ordine #${orderToDelete.formatted_number || orderToDelete.number || orderToDelete.id} eliminato con successo!`);
        if (selectedOrderDetails && selectedOrderDetails.id === orderToDelete.id) {
          setSelectedOrderDetails(null);
        }
        setOrderToDelete(null);
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Impossibile eliminare l\'ordine', 'error');
      }
    } catch (err) {
      showToast('Errore durante l\'eliminazione dell\'ordine', 'error');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // Save Order Number Handler
  const handleSaveOrderNumber = async () => {
    if (!orderToEditNumber || !newOrderNumberInput.trim()) return;
    setIsSavingOrderNumber(true);
    try {
      const res = await fetch(`/api/easyfatt/orders/${orderToEditNumber.id}/number`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: newOrderNumberInput.trim() })
      });

      if (res.ok) {
        showToast('Numerazione ordine aggiornata con successo!');
        setOrderToEditNumber(null);
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Errore durante l\'aggiornamento del numero ordine', 'error');
      }
    } catch (e) {
      showToast('Errore durante il salvataggio della numerazione', 'error');
    } finally {
      setIsSavingOrderNumber(false);
    }
  };

  // COMPUTE UNIFIED STATISTICS
  const stats = useMemo(() => {
    return computeComprehensiveStats({
      orders,
      clients,
      products,
      usersList,
      user: activeUser,
      selectedAgentFilter,
      timeRangeFilter,
      orderStatusFilter,
      paymentMethods
    });
  }, [orders, clients, products, usersList, activeUser, selectedAgentFilter, timeRangeFilter, orderStatusFilter, paymentMethods]);

  // Filtered Orders list with free text search
  const filteredOrders = useMemo(() => {
    const q = orderSearchQuery.toLowerCase().trim();
    if (!q) return stats.filteredOrders;

    return stats.filteredOrders.filter(o => {
      const clientName = o.client_name?.toLowerCase() || '';
      const orderNum = String(o.number || o.id);
      const notes = o.notes?.toLowerCase() || '';
      const agent = (o.agent_name || '').toLowerCase();
      const pay = (o.payment_name || '').toLowerCase();

      return clientName.includes(q) || orderNum.includes(q) || notes.includes(q) || agent.includes(q) || pay.includes(q);
    });
  }, [stats.filteredOrders, orderSearchQuery]);

  // Target progress percentage
  const targetProgressPercent = useMemo(() => {
    if (monthlyTarget <= 0) return 0;
    return Math.min(100, Math.round((stats.currentMonthRevenue / monthlyTarget) * 100));
  }, [stats.currentMonthRevenue, monthlyTarget]);

  // Visible deadlines based on hidePastDeadlines toggle
  const visibleDeadlines = useMemo(() => {
    return stats.allDeadlines.filter(d => !hidePastDeadlines || !d.isOverdue);
  }, [stats.allDeadlines, hidePastDeadlines]);

  // Duplicate / Re-order action
  const handleDuplicateOrder = (order: Order) => {
    navigate(`/ordine?duplicateOrderId=${order.id}${order.client_id ? `&clientId=${order.client_id}` : ''}`);
  };

  // Continue Draft action
  const handleContinueDraft = (order: Order) => {
    navigate(`/ordine?orderId=${order.id}`);
  };

  // Export Summary CSV
  const handleExportCSV = () => {
    try {
      const headers = ['Data', 'Numero', 'Cliente', 'Agente', 'Stato', 'Metodo Pagamento', 'Totale Imponibile (€)'];
      const rows = filteredOrders.map(o => [
        o.date,
        o.number || o.formatted_number || o.id,
        `"${(o.client_name || '').replace(/"/g, '""')}"`,
        `"${(o.agent_name || '').replace(/"/g, '""')}"`,
        o.status,
        `"${(o.payment_name || '').replace(/"/g, '""')}"`,
        Number(o.total || 0).toFixed(2)
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Report_Statistiche_${timeRangeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Report CSV esportato con successo!');
    } catch (e) {
      showToast('Errore durante l\'esportazione del file CSV', 'error');
    }
  };

  const currentAgentDisplayName = isAgent ? (activeUser?.name || 'Mio Portafoglio') : selectedAgentFilter === 'all' ? 'Tutti gli Agenti' : selectedAgentFilter;
  const now = new Date();

  // Recharts color palette
  const COLORS = ['#5A5A40', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider">Caricamento Statistiche & Portafoglio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-xs font-bold text-white flex items-center gap-2",
              toastMessage.type === 'error' ? 'bg-rose-600' : toastMessage.type === 'info' ? 'bg-blue-600' : 'bg-emerald-600'
            )}
          >
            <CheckCircle2 size={16} />
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner & Control Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl font-bold">
              <TrendingUp size={20} />
            </span>
            <span className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider">
              {isAdmin ? 'Cruscotto Direzionale & Statistiche' : isCapoArea ? 'Monitoraggio Capoarea & Rete Commerciale' : 'Performance & Portafoglio Personale'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Statistiche & Analisi Ordini
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {isAdmin || isCapoArea
              ? `Analisi globale su ${clients.length} clienti in anagrafica e ${orders.length} contratti registrati.` 
              : `Monitoraggio portafoglio (${stats.assignedClientsCount} clienti assegnati in anagrafica) e avanzamento obiettivi.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all cursor-pointer flex items-center gap-2 text-xs font-bold"
            title="Esporta Report CSV"
          >
            <FileSpreadsheet size={16} className="text-emerald-700" />
            <span className="hidden sm:inline">Esporta CSV</span>
          </button>

          <button
            type="button"
            onClick={() => loadData()}
            className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all cursor-pointer"
            title="Aggiorna dati"
          >
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            onClick={() => navigate('/ordine')}
            className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white px-5 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <ShoppingBag size={18} />
            <span>Crea Nuovo Ordine</span>
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS TOOLBAR: AGENT SCOPE & TIME RANGE */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: Agent Scope Selector (Admin / Capo Area) or Agent Badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <Users size={16} className="text-[#5A5A40]" />
            <span>Ambito Portafoglio:</span>
          </div>

          {!isAgent ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-900 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#5A5A40] cursor-pointer"
              >
                <option value="all">🌐 Tutti gli Agenti (Azienda Completa)</option>
                {stats.availableAgents.map(ag => (
                  <option key={ag} value={ag}>👤 Agente: {ag}</option>
                ))}
              </select>

              {selectedAgentFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedAgentFilter('all')}
                  className="text-[11px] font-bold text-rose-600 hover:underline px-1.5 py-1 cursor-pointer"
                >
                  Mostra Tutti
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-[#5A5A40]/10 text-[#5A5A40] px-3.5 py-1.5 rounded-xl text-xs font-black">
              <UserCheck size={14} />
              <span>Agente: {currentAgentDisplayName} ({stats.assignedClientsCount} clienti associati in anagrafica)</span>
            </div>
          )}
        </div>

        {/* Right: Time Range Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <div className="flex items-center gap-1 text-xs font-bold text-gray-400 mr-1 shrink-0">
            <Calendar size={14} />
            <span>Periodo:</span>
          </div>
          {[
            { key: 'month', label: 'Mese Corrente' },
            { key: 'prev_month', label: 'Mese Scorso' },
            { key: 'quarter', label: 'Ultimi 3 Mesi' },
            { key: 'year', label: 'Anno ' + now.getFullYear() },
            { key: 'all', label: 'Tutto lo Storico' },
          ].map(pill => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setTimeRangeFilter(pill.key as any)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                timeRangeFilter === pill.key
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI METRIC CARDS (6 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Fatturato Confermato */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Fatturato Confermato</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-gray-900">
              € {stats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
              Da {stats.confirmedOrdersCount} ordini confermati
            </p>
          </div>
        </div>

        {/* KPI 2: Bozze in Lavorazione */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Bozze in Corso</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-amber-700">
              € {stats.draftRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-amber-600 font-bold mt-0.5">
              {stats.draftOrdersCount} bozze da trasmettere
            </p>
          </div>
        </div>

        {/* KPI 3: Ticket Medio (AOV) */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Ticket Medio AOV</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <CreditCard size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-gray-900">
              € {stats.aov.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">
              Media per singolo contratto
            </p>
          </div>
        </div>

        {/* KPI 4: Quantità Pezzi Venduti */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Unità Vendute</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Package size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-purple-900">
              {stats.totalQuantitySold.toLocaleString('it-IT')} <span className="text-xs font-bold text-gray-400">pz</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">
              Volume articoli movimentati
            </p>
          </div>
        </div>

        {/* KPI 5: Copertura Portafoglio */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Clienti Attivi</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <UserCheck size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-indigo-900">
              {stats.activeClientsCount} <span className="text-xs font-bold text-gray-400">/ {stats.assignedClientsCount}</span>
            </div>
            <p className="text-[10px] text-indigo-600 font-bold mt-0.5">
              {stats.portfolioPenetrationRate}% penetrazione portafoglio
            </p>
          </div>
        </div>

        {/* KPI 6: Target Mensile Progress */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Target Mese</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Target size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-gray-900">
              {targetProgressPercent}%
            </div>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">
              € {stats.currentMonthRevenue.toLocaleString('it-IT', { maximumFractionDigits: 0 })} / {monthlyTarget.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Target Progress & Monthly Sales Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly Target Card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Target size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    Obiettivo Mensile {isAgent ? 'Personale' : 'Fissato'}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(now)}
                  </span>
                </div>
              </div>

              {/* Edit Target Button */}
              {!isEditingTarget ? (
                <button
                  type="button"
                  onClick={() => { setIsEditingTarget(true); setNewTargetInput(String(monthlyTarget)); }}
                  className="text-xs font-bold text-[#5A5A40] hover:text-[#4A4A30] flex items-center gap-1.5 p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Modifica Obiettivo"
                >
                  <Edit3 size={14} />
                  <span>Modifica</span>
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
                    className="bg-[#5A5A40] text-white text-xs px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                  >
                    Salva
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTarget(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Target Breakdown */}
            <div className="grid grid-cols-2 gap-3 my-3">
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Fatturato Mese</span>
                <span className="text-lg font-black font-mono text-gray-900">
                  € {stats.currentMonthRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Target Fissato</span>
                <span className="text-lg font-black font-mono text-gray-500">
                  € {monthlyTarget.toLocaleString('it-IT')}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 pt-3 border-t border-gray-100">
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
              <span className="font-bold text-gray-700">
                {targetProgressPercent >= 100 
                  ? '🎉 Obiettivo mensile raggiunto!' 
                  : `Mancano € ${(Math.max(0, monthlyTarget - stats.currentMonthRevenue)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
              </span>
              <span>€ {monthlyTarget.toLocaleString('it-IT')}</span>
            </div>
          </div>
        </div>

        {/* Sales Trend Chart (Last 6 Months) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-gray-900">
                Andamento Fatturato nel Tempo (Ultimi 6 Mesi)
              </h3>
              <span className="text-xs text-gray-400">
                Fatturato generato per ciascun mese dall'ambito selezionato
              </span>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
      </div>

      {/* PIANIFICAZIONE SCADENZE & RATE DI PAGAMENTO */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center">
                <Clock size={18} />
              </div>
              <h4 className="text-lg font-black text-gray-900">Pianificazione Scadenze & Rate di Pagamento</h4>
            </div>
            <p className="text-xs text-gray-500">
              Calendario scadenziario generato automaticamente dalle condizioni di pagamento degli ordini (Ri.Ba., Bonifici 30-60-90 gg F.M., ecc.).
            </p>
          </div>

          {/* TEMPORAL FILTER TOGGLE */}
          <label className="flex items-center gap-2.5 cursor-pointer bg-[#F9FAFB] hover:bg-gray-100 px-4 py-2.5 rounded-xl border border-gray-200 transition-all text-xs font-bold text-gray-800 shadow-2xs select-none">
            <input
              type="checkbox"
              checked={hidePastDeadlines}
              onChange={(e) => setHidePastDeadlines(e.target.checked)}
              className="w-4 h-4 rounded text-[#5A5A40] focus:ring-[#5A5A40] border-gray-300 accent-[#5A5A40]"
            />
            <Filter size={14} className="text-[#5A5A40]" />
            <span>Nascondi rate scadute antecedenti ad oggi</span>
          </label>
        </div>

        {/* DEADLINES STATS SUMMARY BADGES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-800">Scadenze In Essere / Future</span>
              <p className="text-base font-black text-emerald-950">
                {stats.allDeadlines.filter(d => !d.isOverdue).length} rate
              </p>
            </div>
            <span className="text-sm font-mono font-black text-emerald-700">
              € {stats.allDeadlines.filter(d => !d.isOverdue).reduce((s, d) => s + d.amount, 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-amber-800">Scadenze Antecedenti / Passate</span>
              <p className="text-base font-black text-amber-950">
                {stats.allDeadlines.filter(d => d.isOverdue).length} rate {hidePastDeadlines ? '(Nascoste)' : '(Visibili)'}
              </p>
            </div>
            <span className="text-sm font-mono font-black text-amber-700">
              € {stats.allDeadlines.filter(d => d.isOverdue).reduce((s, d) => s + d.amount, 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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

        {/* DEADLINES TABLE */}
        {visibleDeadlines.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs font-bold text-gray-500">Nessuna rata di scadenza trovata per il periodo selezionato.</p>
            {hidePastDeadlines && (
              <button
                type="button"
                onClick={() => setHidePastDeadlines(false)}
                className="mt-3 text-xs text-[#5A5A40] underline font-bold cursor-pointer"
              >
                Mostra anche le scadenze passate
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-[10px] uppercase font-black tracking-wider text-gray-500 border-b border-gray-100">
                  <th className="p-3.5">Ordine #</th>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Rata / Condizioni</th>
                  <th className="p-3.5">Data Scadenza</th>
                  <th className="p-3.5 text-right">Importo Rata</th>
                  <th className="p-3.5 text-center">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {visibleDeadlines.slice(0, 15).map((d, idx) => (
                  <tr key={`${d.orderId}-${d.installmentIndex}-${idx}`} className={cn(
                    "hover:bg-gray-50/50 transition-colors",
                    d.isOverdue ? "bg-amber-50/20" : ""
                  )}>
                    <td className="p-3.5 font-mono font-bold text-gray-800">
                      #{d.orderNumber}
                    </td>
                    <td className="p-3.5 font-bold text-gray-900">
                      {d.clientName}
                    </td>
                    <td className="p-3.5 text-gray-600">
                      <span className="font-bold text-[#5A5A40]">Rata {d.installmentIndex}/{d.totalInstallments}</span>
                      <span className="text-[10px] text-gray-400 block truncate max-w-[200px]">{d.paymentName}</span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-gray-700">
                      {d.date.split('-').reverse().join('/')}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-gray-900">
                      € {d.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-center">
                      {d.isOverdue ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock size={10} />
                          Scaduta
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={10} />
                          In Essere
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AGENTS LEADERBOARD (VISIBLE TO ADMIN AND CAPO AREA) */}
      {!isAgent && stats.agentsLeaderboard.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                <Award size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Classifica & Performance Rete Agenti</h3>
                <p className="text-xs text-gray-500">Confronto fatturato, ordini e penetrazione portafoglio nel periodo selezionato.</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Agente</th>
                  <th className="py-2.5 px-3 text-right">Ordini Confermati</th>
                  <th className="py-2.5 px-3 text-right">Clienti Attivi</th>
                  <th className="py-2.5 px-3 text-right">Ticket Medio</th>
                  <th className="py-2.5 px-3 text-right">Fatturato Periodo</th>
                  <th className="py-2.5 px-3 text-right">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.agentsLeaderboard.map((ag, idx) => (
                  <tr key={ag.name} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-gray-400">
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                        idx === 0 ? "bg-amber-100 text-amber-800" : idx === 1 ? "bg-gray-200 text-gray-800" : idx === 2 ? "bg-orange-100 text-orange-800" : "text-gray-500"
                      )}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-gray-900">
                      {ag.name}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-700">
                      {ag.ordersCount}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-700">
                      {ag.activeClients}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-700">
                      € {ag.aov.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-[#5A5A40] text-sm">
                      € {ag.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedAgentFilter(ag.name)}
                        className="text-[11px] font-bold text-[#5A5A40] hover:underline cursor-pointer"
                      >
                        Ispeziona Scheda →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Clients & Inactive Clients Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Clients by Revenue */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#5A5A40]" />
                <h3 className="text-base font-black text-gray-900">Top Clienti per Volume di Spesa</h3>
              </div>
              <span className="text-xs text-gray-400 font-bold">Classifica portafoglio</span>
            </div>

            <div className="space-y-2.5">
              {stats.topClients.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">Nessun ordine registrato per questo ambito.</p>
              ) : (
                stats.topClients.slice(0, 6).map((item, idx) => (
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
                          {item.orderCount} ordini • {item.client.city || 'Sede non specificata'}
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
              {stats.inactiveClients.length === 0 ? (
                <p className="text-xs text-emerald-600 font-bold py-6 text-center">
                  Ottimo lavoro! Tutti i clienti del portafoglio hanno ordinato di recente.
                </p>
              ) : (
                stats.inactiveClients.slice(0, 6).map((item) => (
                  <div 
                    key={item.client.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold text-gray-900 block truncate">
                        {item.client.name}
                      </span>
                      <span className="text-[11px] text-amber-700 block">
                        {item.daysSinceLastOrder !== null 
                          ? `Ultimo ordine: ${item.daysSinceLastOrder} giorni fa (${item.lastOrderDate})` 
                          : 'Nessun ordine storico in anagrafica'}
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
                ))
              )}
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-100">
            Suggerimento: Contatta o programma una visita con questi clienti per proporre il riordino catalogo.
          </p>
        </div>
      </div>

      {/* Top Products & Payment Methods Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Products */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-[#5A5A40]" />
              <h3 className="text-base font-black text-gray-900">Articoli più Venduti</h3>
            </div>
            <span className="text-xs text-gray-400 font-bold">Nel periodo selezionato</span>
          </div>

          {stats.topProducts.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">Nessun articolo venduto nel periodo selezionato.</p>
          ) : (
            <div className="space-y-3">
              {stats.topProducts.slice(0, 6).map((p, idx) => (
                <div key={p.code} className="flex items-center justify-between text-xs p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <span className="font-mono font-bold text-gray-400 text-[11px]">#{idx + 1}</span>
                    <div className="min-w-0">
                      <span className="font-bold text-gray-900 block truncate">{p.description}</span>
                      <span className="font-mono text-[10px] text-gray-400">Cod. {p.code}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black font-mono text-gray-900 block">€ {p.revenue.toFixed(2)}</span>
                    <span className="text-[11px] text-gray-500 font-bold">{p.qty} pz</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-[#5A5A40]" />
              <h3 className="text-base font-black text-gray-900">Ripartizione Pagamenti</h3>
            </div>
            <span className="text-xs text-gray-400 font-bold">Nel periodo selezionato</span>
          </div>

          {stats.paymentBreakdown.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">Nessun pagamento registrato nel periodo selezionato.</p>
          ) : (
            <div className="space-y-3">
              {stats.paymentBreakdown.slice(0, 6).map((pm) => (
                <div key={pm.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-800">{pm.name} ({pm.count} ordini)</span>
                    <span className="font-mono text-gray-900">€ {pm.total.toFixed(2)} ({pm.percentage}%)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#5A5A40] rounded-full" 
                      style={{ width: `${pm.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Orders History List with Filters & Quick Actions */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900">Elenco Contratti & Ordini</h3>
            <span className="text-xs text-gray-500">
              {filteredOrders.length} contratti trovati nei filtri impostati
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setOrderStatusFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                orderStatusFilter === 'all'
                  ? 'bg-[#5A5A40] text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Tutti ({stats.periodOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('Bozza')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                orderStatusFilter === 'Bozza'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              )}
            >
              Bozze ({stats.periodDraftOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('Nuovo')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                orderStatusFilter === 'Nuovo'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              )}
            >
              Inviati ({stats.periodOrders.filter(o => o.status === 'Nuovo').length})
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('Confermato')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                orderStatusFilter === 'Confermato'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              )}
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
            placeholder="Cerca cliente, n. ordine, agente o note..."
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
                  <th className="py-3 px-3">Agente</th>
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
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-gray-500 font-mono font-bold">
                            #{order.number || order.formatted_number || order.id}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setOrderToEditNumber(order);
                                setNewOrderNumberInput(String(order.number || order.formatted_number || order.id || ''));
                              }}
                              className="p-0.5 text-amber-700 hover:bg-amber-100 rounded cursor-pointer"
                              title="Sistemare numerazione ordine"
                            >
                              <Hash size={11} />
                            </button>
                          )}
                        </div>
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

                      <td className="py-3 px-3 text-gray-500 font-medium whitespace-nowrap">
                        {order.agent_name || 'N/D'}
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

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setOrderToEditNumber(order);
                                setNewOrderNumberInput(String(order.number || order.formatted_number || order.id || ''));
                              }}
                              className="p-1.5 hover:bg-amber-100 text-amber-800 rounded-lg transition-colors cursor-pointer"
                              title="Sistemare la numerazione di questo ordine"
                            >
                              <Hash size={16} />
                            </button>
                          )}

                          {(isAdmin || isDraft) && (
                            <button
                              type="button"
                              onClick={() => setOrderToDelete(order)}
                              className="p-1.5 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Elimina questo ordine"
                            >
                              <Trash2 size={16} />
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
              className="relative bg-white rounded-3xl max-w-xl w-full shadow-2xl z-10 overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl font-bold">
                    <FileText size={18} />
                  </span>
                  <div>
                    <h3 className="font-black text-gray-900 text-base">
                      Ordine #{selectedOrderDetails.formatted_number || selectedOrderDetails.number || selectedOrderDetails.id}
                    </h3>
                    <span className="text-xs text-gray-400">
                      Data: {selectedOrderDetails.date} • {selectedOrderDetails.status}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <div>
                    <span className="text-gray-400 block font-bold">Cliente</span>
                    <span className="font-bold text-gray-900">{selectedOrderDetails.client_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-bold">Agente</span>
                    <span className="font-bold text-gray-900">{selectedOrderDetails.agent_name || 'N/D'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-bold">Metodo di Pagamento</span>
                    <span className="font-bold text-gray-900">{selectedOrderDetails.payment_name || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-bold">Importo Totale</span>
                    <span className="font-mono font-black text-gray-900 text-sm">
                      € {(Number(selectedOrderDetails.total) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <span className="text-xs font-black text-gray-700 uppercase tracking-wider block">
                    Articoli Ordinati
                  </span>
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Codice</th>
                          <th className="p-2.5">Descrizione</th>
                          <th className="p-2.5 text-right">Qta</th>
                          <th className="p-2.5 text-right">Prezzo</th>
                          <th className="p-2.5 text-right">Totale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedOrderDetails.items?.map((it, idx) => {
                          const discPerc = it.discount_perc ?? (it as any).discount ?? 0;
                          const hasDisc = Boolean(discPerc && Number(discPerc) > 0);
                          const lineTot = Number(it.qty || 1) * Number(it.price || 0) * (hasDisc ? (1 - Number(discPerc) / 100) : 1);
                          return (
                            <tr key={idx}>
                              <td className="p-2.5 font-mono font-bold text-gray-600">{it.product_code}</td>
                              <td className="p-2.5 font-bold text-gray-900">{it.description}</td>
                              <td className="p-2.5 text-right font-mono font-bold">{it.qty} {it.um || ''}</td>
                              <td className="p-2.5 text-right font-mono">€ {Number(it.price || 0).toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono font-black text-emerald-600">€ {lineTot.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedOrderDetails.notes && (
                  <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-900 font-medium">
                    <span className="font-bold block mb-0.5">Note Ordine:</span>
                    {selectedOrderDetails.notes}
                  </div>
                )}

                {/* Actions inside modal */}
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
                      showToast('Generazione PDF in corso...');
                      const ok = await downloadOrderPdf(getPrintableFromOrder(selectedOrderDetails));
                      if (ok) showToast('PDF scaricato con successo!');
                    }}
                    className="w-full bg-emerald-50 text-emerald-900 border border-emerald-200 py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Scarica documento in formato PDF"
                  >
                    <Download size={14} />
                    <span>PDF</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrderToEditNumber(selectedOrderDetails);
                        setNewOrderNumberInput(String(selectedOrderDetails.number || selectedOrderDetails.formatted_number || selectedOrderDetails.id || ''));
                      }}
                      className="w-full bg-amber-50 text-amber-900 border border-amber-200 py-2.5 rounded-xl font-bold text-xs hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Sistemare la numerazione di questo ordine"
                    >
                      <Hash size={14} />
                      <span>N. Ordine</span>
                    </button>
                  )}
                  {(isAdmin || selectedOrderDetails.status === 'Bozza') && (
                    <button
                      type="button"
                      onClick={() => setOrderToDelete(selectedOrderDetails)}
                      className="w-full bg-rose-50 text-rose-900 border border-rose-200 py-2.5 rounded-xl font-bold text-xs hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Elimina questo ordine"
                    >
                      <Trash2 size={14} />
                      <span>Elimina</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Order Number Modal */}
      <AnimatePresence>
        {orderToEditNumber && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderToEditNumber(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl max-w-sm w-full shadow-2xl z-10 overflow-hidden border border-gray-100 p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl">
                  <Hash size={20} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">Sistemazione N. Ordine</h3>
                  <p className="text-xs text-gray-500">Modifica manuale del numero progressivo ordine</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block">Nuovo Numero / Sigla Ordine</label>
                <input
                  type="text"
                  value={newOrderNumberInput}
                  onChange={(e) => setNewOrderNumberInput(e.target.value)}
                  placeholder="Es. 101 oppure 101/A"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#5A5A40]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToEditNumber(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveOrderNumber}
                  disabled={isSavingOrderNumber || !newOrderNumberInput.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#5A5A40] hover:bg-[#4A4A30] rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSavingOrderNumber ? 'Salvataggio...' : 'Salva Numero'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Order Confirmation Modal */}
      <AnimatePresence>
        {orderToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderToDelete(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl max-w-sm w-full shadow-2xl z-10 overflow-hidden border border-gray-100 p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">Elimina Ordine</h3>
                  <p className="text-xs text-gray-500">Sei sicuro di voler rimuovere questo ordine?</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-gray-500">Numero:</span>
                  <span className="font-mono text-gray-900">#{orderToDelete.number || orderToDelete.formatted_number || orderToDelete.id}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="text-gray-900 truncate max-w-[160px]">{orderToDelete.client_name}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-gray-500">Totale:</span>
                  <span className="font-mono text-emerald-700">€ {(Number(orderToDelete.total) || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteOrder}
                  disabled={isDeletingOrder}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isDeletingOrder ? 'Eliminazione...' : 'Conferma Eliminazione'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
