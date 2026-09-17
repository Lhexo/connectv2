import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Plus, 
  Search, 
  UserPlus, 
  Check, 
  X, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin, 
  Building2, 
  Filter, 
  RefreshCw, 
  Trash2, 
  Inbox, 
  Send,
  AlertCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Lock,
  List,
  Grid,
  Eye,
  Navigation,
  Copy,
  ExternalLink,
  HelpCircle,
  Rss,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AgentVisit as JointVisit, CoVisitInvite as VisitInvite, Client, User } from '../types';
import ConfirmModal from './ConfirmModal';

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const WEEKDAY_NAMES_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const formatDateStr = (y: number, m: number, d: number) => {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
};

interface GirovisiteSectionProps {
  currentUser?: any;
  onSelectClient?: (clientId: number) => void;
}

export default function GirovisiteSection({ currentUser, onSelectClient }: GirovisiteSectionProps) {
  // State
  const [visits, setVisits] = useState<JointVisit[]>([]);
  const [myClients, setMyClients] = useState<Client[]>([]);
  const [colleagues, setColleagues] = useState<User[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<VisitInvite[]>([]);
  const [sentInvites, setSentInvites] = useState<VisitInvite[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Tabs
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeInviteTab, setActiveInviteTab] = useState<'received' | 'sent'>('received');

  // Modals State
  const [isNewVisitModalOpen, setIsNewVisitModalOpen] = useState(false);
  const [selectedVisitForInvite, setSelectedVisitForInvite] = useState<JointVisit | null>(null);
  const [selectedClientForModal, setSelectedClientForModal] = useState<Client | null>(null);
  const [visitToDeleteId, setVisitToDeleteId] = useState<number | null>(null);

  // New Visit Form State
  const [newVisitClientId, setNewVisitClientId] = useState<string>('');
  const [newVisitDate, setNewVisitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newVisitTimeSlot, setNewVisitTimeSlot] = useState<string>('09:00');
  const [newVisitNotes, setNewVisitNotes] = useState<string>('');

  // Invite Agent Form State
  const [selectedGuestAgentId, setSelectedGuestAgentId] = useState<string>('');

  // View mode for Girovisite visits section
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Monthly Calendar navigation state
  const today = new Date();
  const [currentCalYear, setCurrentCalYear] = useState<number>(today.getFullYear());
  const [currentCalMonth, setCurrentCalMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Read-only visit inspector states for Calendar view
  const [readonlyVisit, setReadonlyVisit] = useState<JointVisit | null>(null);
  const [readonlyDayModal, setReadonlyDayModal] = useState<{ dateStr: string; visits: JointVisit[] } | null>(null);

  // iCal Feed State & Handlers
  const [icalUrl, setIcalUrl] = useState<string>('');
  const [webcalUrl, setWebcalUrl] = useState<string>('');
  const [copiedIcal, setCopiedIcal] = useState<boolean>(false);
  const [showIcalInstructions, setShowIcalInstructions] = useState<boolean>(false);
  const [isRegeneratingIcal, setIsRegeneratingIcal] = useState<boolean>(false);

  const handleCopyIcalUrl = () => {
    if (!icalUrl) return;
    navigator.clipboard.writeText(icalUrl).then(() => {
      setCopiedIcal(true);
      setTimeout(() => setCopiedIcal(false), 2500);
    }).catch(err => {
      console.error('Failed to copy iCal link:', err);
    });
  };

  const handleRegenerateIcalUrl = async () => {
    if (!window.confirm('Sei sicuro di voler rigenerare il tuo link iCal? I calendari esterni già configurati con il vecchio link smetteranno di sincronizzarsi fino all\'aggiornamento dell\'URL.')) {
      return;
    }
    setIsRegeneratingIcal(true);
    try {
      const res = await fetch('/api/girovisite/ical-url/regenerate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIcalUrl(data.ical_url || '');
        setWebcalUrl(data.webcal_url || '');
        showToast('Link Feed iCal rigenerato con successo!');
      } else {
        showToast('Errore durante la rigenerazione del link iCal.', true);
      }
    } catch (err) {
      console.error('Error regenerating iCal link:', err);
      showToast('Errore di connessione durante la rigenerazione.', true);
    } finally {
      setIsRegeneratingIcal(false);
    }
  };

  const handlePrevMonth = () => {
    if (currentCalMonth === 0) {
      setCurrentCalMonth(11);
      setCurrentCalYear(prev => prev - 1);
    } else {
      setCurrentCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentCalMonth === 11) {
      setCurrentCalMonth(0);
      setCurrentCalYear(prev => prev + 1);
    } else {
      setCurrentCalMonth(prev => prev + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCurrentCalYear(now.getFullYear());
    setCurrentCalMonth(now.getMonth());
  };

  const todayDateStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // Fetch all required data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [visitsRes, clientsRes, colleaguesRes, recInvitesRes, sentInvitesRes, icalRes] = await Promise.all([
        fetch('/api/girovisite/visits'),
        fetch('/api/clients'),
        fetch('/api/girovisite/colleagues'),
        fetch('/api/girovisite/invites/received'),
        fetch('/api/girovisite/invites/sent'),
        fetch('/api/girovisite/ical-url')
      ]);

      if (visitsRes.ok) {
        const data = await visitsRes.json();
        setVisits(data);
      }
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setMyClients(data);
      }
      if (colleaguesRes.ok) {
        const data = await colleaguesRes.json();
        setColleagues(data);
      }
      if (recInvitesRes.ok) {
        const data = await recInvitesRes.json();
        setReceivedInvites(data);
      }
      if (sentInvitesRes.ok) {
        const data = await sentInvitesRes.json();
        setSentInvites(data);
      }
      if (icalRes.ok) {
        const data = await icalRes.json();
        setIcalUrl(data.ical_url || '');
        setWebcalUrl(data.webcal_url || '');
      }
    } catch (err) {
      console.error('Error loading Girovisite data:', err);
      setError('Impossibile caricare i dati del girovisite.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(null), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // Create new visit
  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitClientId || !newVisitDate) {
      showToast('Seleziona un cliente e una data per la visita.', true);
      return;
    }

    try {
      const res = await fetch('/api/girovisite/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Number(newVisitClientId),
          visit_date: newVisitDate,
          time_slot: newVisitTimeSlot,
          notes: newVisitNotes
        })
      });

      if (!res.ok) {
        let errMsg = 'Errore durante la creazione della visita';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const createdVisit = await res.json();
      setVisits(prev => [...prev, createdVisit]);
      setIsNewVisitModalOpen(false);
      setNewVisitClientId('');
      setNewVisitNotes('');
      showToast('Visita programmata con successo!');
    } catch (err: any) {
      showToast(err.message || 'Errore di rete durante la creazione della visita.', true);
    }
  };

  // Delete visit
  const handleDeleteVisit = (visitId: number) => {
    setVisitToDeleteId(visitId);
  };

  const performDeleteVisit = async (visitId: number) => {
    try {
      const res = await fetch(`/api/girovisite/visits/${visitId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        let errMsg = 'Errore durante l\'eliminazione della visita';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      setVisits(prev => prev.filter(v => v.id !== visitId));
      showToast('Visita eliminata dal calendario.');
    } catch (err: any) {
      showToast(err.message, true);
    } finally {
      setVisitToDeleteId(null);
    }
  };

  // Send Joint Visit Invite
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisitForInvite || !selectedGuestAgentId) {
      showToast('Seleziona un collega a cui inviare la richiesta di affiancamento.', true);
      return;
    }

    try {
      const res = await fetch('/api/girovisite/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visit_id: selectedVisitForInvite.id,
          guest_agent_id: Number(selectedGuestAgentId)
        })
      });

      if (!res.ok) {
        let errMsg = 'Errore durante l\'invio dell\'invito';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const newInvite = await res.json();
      setSentInvites(prev => [newInvite, ...prev]);
      setSelectedVisitForInvite(null);
      setSelectedGuestAgentId('');
      showToast('Richiesta di affiancamento inviata con successo al collega!');
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Binary Response to Invite: Accept [SÌ] or Decline [NO]
  const handleRespondInvite = async (inviteId: number, action: 'accept' | 'decline') => {
    try {
      const res = await fetch(`/api/girovisite/invites/${inviteId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!res.ok) {
        let errMsg = 'Errore nell\'elaborazione della risposta';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const updatedInvite = await res.json();

      setReceivedInvites(prev =>
        prev.map(inv => inv.id === inviteId ? updatedInvite : inv)
      );

      if (action === 'accept') {
        showToast('Invito accettato [SÌ]! L\'uscita di affiancamento è stata aggiunta al tuo calendario.');
        const visitsRes = await fetch('/api/girovisite/visits');
        if (visitsRes.ok) {
          const freshVisits = await visitsRes.json();
          setVisits(freshVisits);
        }
      } else {
        showToast('Invito rifiutato [NO]. La richiesta è stata chiusa.');
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Filtered Visits
  const filteredVisits = visits.filter(v => {
    const matchesQuery = 
      !searchQuery || 
      v.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.client_city && v.client_city.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesDate = !selectedDate || v.visit_date === selectedDate;

    return matchesQuery && matchesDate;
  }).sort((a, b) => a.visit_date.localeCompare(b.visit_date));

  // Monthly Calendar Grid Calculation
  const calendarDays = React.useMemo(() => {
    const year = currentCalYear;
    const month = currentCalMonth;

    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon=0...Sun=6

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      days.push({
        dateStr: formatDateStr(prevYear, prevMonth, day),
        dayNum: day,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        dateStr: formatDateStr(year, month, day),
        dayNum: day,
        isCurrentMonth: true
      });
    }

    // Next month padding to fill complete week grid
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let day = 1; day <= remaining; day++) {
      days.push({
        dateStr: formatDateStr(nextYear, nextMonth, day),
        dayNum: day,
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentCalYear, currentCalMonth]);

  const visitsByDate = React.useMemo(() => {
    const map: Record<string, JointVisit[]> = {};
    filteredVisits.forEach(v => {
      if (!map[v.visit_date]) {
        map[v.visit_date] = [];
      }
      map[v.visit_date].push(v);
    });
    return map;
  }, [filteredVisits]);

  const pendingReceivedCount = receivedInvites.filter(i => i.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      
      {/* Toast notifications */}
      <AnimatePresence>
        {(error || successMsg) && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl border flex items-center gap-3 text-xs sm:text-sm font-bold shadow-md",
              error 
                ? "bg-rose-50 border-rose-200 text-rose-800" 
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            )}
          >
            {error ? <AlertCircle size={18} className="text-rose-600" /> : <CheckCircle2 size={18} className="text-emerald-600" />}
            <span className="flex-1">{error || successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container Card */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#5A5A40] via-[#8C8C6B] to-[#5A5A40]" />

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-[#5A5A40]/15">
                <Calendar size={11} />
                Connect Girovisite
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sincronizzato
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-black tracking-tight text-gray-900 flex items-center gap-2">
              Girovisite & Affiancamenti tra Agenti
            </h1>
            <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
              Pianifica le visite con i tuoi clienti assegnati e collabora con i colleghi agenti per le uscite di affiancamento con risposte chiare [SÌ] / [NO].
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
              title="Aggiorna Dati"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Aggiorna</span>
            </button>
            <button
              onClick={() => setIsNewVisitModalOpen(true)}
              className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Programma Nuova Visita</span>
            </button>
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* LEFT COLUMN: PARTE 1 - CALENDARIO E VISITE (7 Cols) */}
          <section className="lg:col-span-7 space-y-4">
            <div className="bg-gray-50/70 border border-[#E5E7EB] rounded-2xl p-4 sm:p-6 space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center font-bold">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase text-gray-900 tracking-wider">
                      1. Calendario Visite Programmate
                    </h2>
                    <p className="text-[11px] text-gray-500">I tuoi appuntamenti e gli affiancamenti confermati</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {/* View Mode Toggle: Mese vs Elenco */}
                  <div className="bg-gray-200/80 p-1 rounded-xl flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('calendar')}
                      className={cn(
                        "py-1 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                        viewMode === 'calendar' ? "bg-white text-[#5A5A40] shadow-xs" : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <Grid size={13} />
                      <span>Vista Mese</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "py-1 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                        viewMode === 'list' ? "bg-white text-[#5A5A40] shadow-xs" : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <List size={13} />
                      <span>Vista Elenco</span>
                    </button>
                  </div>

                  <span className="bg-[#5A5A40] text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-full">
                    {filteredVisits.length} {filteredVisits.length === 1 ? 'visita' : 'visite'}
                  </span>
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cerca cliente o città..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#5A5A40] text-gray-900 shadow-xs"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="relative flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#5A5A40] text-gray-900 shadow-xs"
                  />
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate('')}
                      className="px-2 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                      title="Mostra tutte le date"
                    >
                      Tutte
                    </button>
                  )}
                </div>
              </div>

              {/* READ-ONLY MONTHLY CALENDAR VIEW */}
              {viewMode === 'calendar' && (
                <div className="space-y-3">
                  {/* Calendar Month Navigation Header */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
                        title="Mese precedente"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={handleGoToToday}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-all uppercase"
                      >
                        Oggi
                      </button>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
                        title="Mese successivo"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="text-center font-serif font-black text-base text-gray-900 tracking-wide uppercase">
                      {MONTH_NAMES_IT[currentCalMonth]} {currentCalYear}
                    </div>

                    <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                      <Lock size={11} className="text-amber-600" />
                      <span>Solo Lettura</span>
                    </div>
                  </div>

                  {/* Weekdays Header Row */}
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-gray-500 uppercase bg-gray-100/70 p-2 rounded-xl">
                    {WEEKDAY_NAMES_IT.map(dayName => (
                      <div key={dayName}>{dayName}</div>
                    ))}
                  </div>

                  {/* Calendar Month Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((cell) => {
                      const dayVisits = visitsByDate[cell.dateStr] || [];
                      const isToday = cell.dateStr === todayDateStr;

                      return (
                        <div
                          key={cell.dateStr}
                          className={cn(
                            "min-h-[85px] p-1.5 border rounded-xl flex flex-col justify-between transition-all",
                            cell.isCurrentMonth ? "bg-white border-gray-200" : "bg-gray-50/60 border-gray-150 text-gray-400 opacity-50",
                            isToday && "ring-2 ring-[#5A5A40] bg-[#5A5A40]/5"
                          )}
                        >
                          {/* Cell top line */}
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                "text-[11px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded-full",
                                isToday
                                  ? "bg-[#5A5A40] text-white"
                                  : cell.isCurrentMonth ? "text-gray-900" : "text-gray-400"
                              )}
                            >
                              {cell.dayNum}
                            </span>

                            {dayVisits.length > 0 && (
                              <span className="text-[9px] font-mono font-bold bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.2 rounded-full">
                                {dayVisits.length}
                              </span>
                            )}
                          </div>

                          {/* Visit Chips inside day cell - READ ONLY */}
                          <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                            {dayVisits.slice(0, 2).map((visit) => {
                              const isJoint = visit.is_joint || visit.agent_id !== currentUser?.id;

                              return (
                                <button
                                  key={visit.id}
                                  type="button"
                                  onClick={() => setReadonlyVisit(visit)}
                                  className={cn(
                                    "w-full text-left p-1 text-[9px] font-bold rounded-lg border transition-all truncate block hover:scale-[1.02] cursor-pointer",
                                    isJoint
                                      ? "bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100"
                                      : "bg-[#5A5A40]/10 border-[#5A5A40]/20 text-[#5A5A40] hover:bg-[#5A5A40]/20"
                                  )}
                                  title={`${visit.time_slot || '09:00'} - ${visit.client_name} (${visit.client_city || ''}) [Visualizza Dettaglio]`}
                                >
                                  <div className="flex items-center gap-1 truncate">
                                    <span className="font-mono font-black shrink-0">{visit.time_slot || '09:00'}</span>
                                    <span className="truncate">{visit.client_name}</span>
                                  </div>
                                </button>
                              );
                            })}

                            {dayVisits.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setReadonlyDayModal({ dateStr: cell.dateStr, visits: dayVisits })}
                                className="w-full text-center text-[9px] font-bold text-[#5A5A40] hover:underline bg-gray-100 py-0.5 rounded-md"
                              >
                                + {dayVisits.length - 2} altre
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Calendar Legend & Lock Notice */}
                  <div className="bg-gray-100/60 border border-gray-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between text-[11px] text-gray-600 gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#5A5A40]" />
                        Visita Standard
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        Affiancamento
                      </span>
                    </div>
                    <div className="text-gray-500 italic text-[10px] flex items-center gap-1">
                      <Lock size={10} className="text-amber-600" />
                      <span>Calendario in sola lettura (non modificabile da qui)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* LIST VIEW */}
              {viewMode === 'list' && (
                <>
                  {loading ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                      <RefreshCw size={24} className="animate-spin text-[#5A5A40] mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Caricamento visite...</p>
                    </div>
                  ) : filteredVisits.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 p-6 space-y-3">
                      <Calendar size={32} className="text-gray-300 mx-auto" />
                      <div className="space-y-1">
                        <p className="font-bold text-gray-800 text-sm">Nessuna visita in programma</p>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto">
                          {selectedDate || searchQuery 
                            ? "Nessun appuntamento soddisfa i filtri di ricerca selezionati." 
                            : "Programma la tua prima visita usando il pulsante '+ Programma Nuova Visita'."}
                        </p>
                      </div>
                      {(selectedDate || searchQuery) && (
                        <button
                          onClick={() => { setSelectedDate(''); setSearchQuery(''); }}
                          className="text-xs font-bold text-[#5A5A40] hover:underline uppercase tracking-wider pt-1"
                        >
                          Azzera filtri di ricerca
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {filteredVisits.map((visit) => {
                        const isJoint = visit.is_joint || visit.agent_id !== currentUser?.id;

                        return (
                          <div
                            key={visit.id}
                            className={cn(
                              "bg-white border rounded-2xl p-4 transition-all shadow-xs hover:shadow-md space-y-3 relative group",
                              isJoint 
                                ? "border-indigo-200 bg-indigo-50/30" 
                                : "border-gray-200"
                            )}
                          >
                            {/* Visit Header Line */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="bg-[#5A5A40] text-white text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <Calendar size={10} />
                                  {visit.visit_date}
                                </span>
                                <span className="bg-gray-100 text-gray-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Clock size={10} />
                                  {visit.time_slot || '09:00'}
                                </span>
                                {isJoint && (
                                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1">
                                    <Users size={10} />
                                    Affiancamento
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    const client = myClients.find(c => c.id === visit.client_id);
                                    if (client) {
                                      setSelectedClientForModal(client);
                                    } else {
                                      setSelectedClientForModal({
                                        id: visit.client_id,
                                        name: visit.client_name,
                                        contact: '',
                                        phone: '',
                                        email: '',
                                        city: visit.client_city || '',
                                        notes: ''
                                      });
                                    }
                                  }}
                                  className="text-gray-400 hover:text-[#5A5A40] p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                                  title="Vedi Scheda Cliente"
                                >
                                  <Building2 size={13} />
                                  <span className="text-[11px] hidden sm:inline">Scheda</span>
                                </button>

                                <button
                                  onClick={() => setSelectedVisitForInvite(visit)}
                                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95"
                                  title="Invita un collega per affiancamento"
                                >
                                  <UserPlus size={12} />
                                  <span>+ Chiedi Affiancamento</span>
                                </button>

                                <button
                                  onClick={() => handleDeleteVisit(visit.id)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Elimina Visita"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Client Info & Destination Address */}
                            <div>
                              <h3 className="text-sm font-bold text-gray-900">
                                {visit.client_name}
                              </h3>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 font-mono mt-1.5 bg-gray-50/80 p-2 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <MapPin size={13} className="text-[#5A5A40] shrink-0" />
                                  <span className="truncate">
                                    {visit.client_address ? `${visit.client_address}${visit.client_city ? `, ${visit.client_city}` : ''}` : (visit.client_city || 'Indirizzo non specificato')}
                                  </span>
                                </div>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([visit.client_address, visit.client_city].filter(Boolean).join(', ') || visit.client_name)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-xs active:scale-95 shrink-0"
                                  title="Apri le indicazioni stradali su Google Maps"
                                >
                                  <Navigation size={12} />
                                  <span>Google Maps</span>
                                </a>
                              </div>
                            </div>

                            {/* Notes */}
                            {visit.notes && (
                              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-150 text-xs text-gray-700 font-sans">
                                <strong className="text-gray-900 uppercase font-black text-[10px] block mb-0.5">Note Appuntamento:</strong>
                                {visit.notes}
                              </div>
                            )}

                            {/* Joint Visit Details */}
                            {isJoint && (() => {
                              const isHost = visit.host_agent_id 
                                ? Number(visit.host_agent_id) === Number(currentUser?.id)
                                : Number(visit.agent_id) === Number(currentUser?.id);
                              const hostName = visit.host_agent_name || visit.agent_name || 'un collega';
                              const matchingSentInvite = sentInvites.find(i => i.visit_id === visit.id);
                              const guestName = visit.guest_agent_name || matchingSentInvite?.guest_agent_name || 'un collega';

                              return (
                                <div className="bg-indigo-50/80 border border-indigo-100 p-2.5 rounded-xl text-xs text-indigo-950 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Users size={14} className="text-indigo-600 flex-shrink-0" />
                                    <span>
                                      {isHost ? (
                                        <>Hai invitato l'agente <strong>{guestName}</strong></>
                                      ) : (
                                        <>Sei stato invitato dall'agente <strong>{hostName}</strong></>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

            </div>
          </section>

          {/* RIGHT COLUMN: PARTE 2 - CENTRO INVITI E COLLABORAZIONI (5 Cols) */}
          <section className="lg:col-span-5 space-y-4">
            <div className="bg-gray-50/70 border border-[#E5E7EB] rounded-2xl p-4 sm:p-6 space-y-4">
              
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center font-bold">
                    <Users size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase text-gray-900 tracking-wider">
                      2. Centro Inviti Affiancamenti
                    </h2>
                    <p className="text-[11px] text-gray-500">Gestione risposte [SÌ / NO] tra colleghi agenti</p>
                  </div>
                </div>

                {pendingReceivedCount > 0 && (
                  <span className="bg-rose-500 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
                    {pendingReceivedCount} NUOVI
                  </span>
                )}
              </div>

              {/* Sub-Tabs: Received vs Sent */}
              <div className="bg-gray-200/80 p-1 rounded-xl flex gap-1">
                <button
                  onClick={() => setActiveInviteTab('received')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                    activeInviteTab === 'received'
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Inbox size={14} />
                  <span>Inviti Ricevuti</span>
                  {pendingReceivedCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ml-1">
                      {pendingReceivedCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveInviteTab('sent')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                    activeInviteTab === 'sent'
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Send size={14} />
                  <span>Inviti Inviati</span>
                  <span className="text-gray-400 text-[10px]">({sentInvites.length})</span>
                </button>
              </div>

              {/* TAB CONTENT: RECEIVED INVITES */}
              {activeInviteTab === 'received' && (
                <div className="space-y-3">
                  {receivedInvites.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-200 p-4">
                      <Inbox size={28} className="text-gray-300 mx-auto mb-1.5" />
                      <p className="font-bold text-gray-700 text-xs uppercase tracking-wider">Nessun invito ricevuto</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Le richieste di affiancamento inviate dai colleghi appariranno qui.
                      </p>
                    </div>
                  ) : (
                    receivedInvites.map((invite) => {
                      const isPending = invite.status === 'PENDING';
                      const isAccepted = invite.status === 'ACCEPTED';
                      const isDeclined = invite.status === 'DECLINED';

                      return (
                        <div
                          key={invite.id}
                          className={cn(
                            "bg-white border rounded-2xl p-4 space-y-3 shadow-xs transition-all",
                            isPending 
                              ? "border-amber-300 bg-amber-50/30" 
                              : isAccepted 
                              ? "border-emerald-200 bg-emerald-50/20" 
                              : "border-gray-200 bg-gray-50 opacity-70"
                          )}
                        >
                          <div className="flex items-center justify-between text-xs border-b border-gray-100 pb-2">
                            <span className="bg-[#5A5A40] text-white font-bold px-2 py-0.5 rounded-md text-[10px]">
                              DA: {invite.host_agent_name || 'Collega Agente'}
                            </span>
                            <span className="text-gray-500 font-mono text-[11px]">{invite.visit_date}</span>
                          </div>

                          <div className="text-xs font-bold text-gray-900">
                            Ti chiede di affiancarlo dal cliente:
                          </div>

                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-xs space-y-1.5">
                            <div className="font-bold text-gray-900 text-sm">{invite.client_name}</div>
                            <div className="text-gray-600 flex items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-1 min-w-0">
                                <MapPin size={11} className="text-[#5A5A40] shrink-0" />
                                <span className="truncate">{invite.client_address ? `${invite.client_address}${invite.client_city ? `, ${invite.client_city}` : ''}` : (invite.client_city || 'N.D.')}</span>
                              </div>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([invite.client_address, invite.client_city].filter(Boolean).join(', ') || invite.client_name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-[10px] font-bold px-2 py-0.5 rounded-md transition-all shrink-0"
                                title="Apri le indicazioni stradali su Google Maps"
                              >
                                <Navigation size={10} />
                                <span>Maps</span>
                              </a>
                            </div>
                            <div className="text-gray-400 text-[10px]">
                              Orario: {invite.time_slot || '09:00'}
                            </div>
                          </div>

                          {/* BINARY RESPONSE BUTTONS: [SÌ] ACCETTA / [NO] RIFIUTA */}
                          {isPending ? (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                onClick={() => handleRespondInvite(invite.id, 'accept')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1"
                              >
                                <Check size={14} className="stroke-[3]" />
                                <span>[SÌ] ACCETTA</span>
                              </button>

                              <button
                                onClick={() => handleRespondInvite(invite.id, 'decline')}
                                className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-3 rounded-xl text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1"
                              >
                                <X size={14} className="stroke-[3]" />
                                <span>[NO] RIFIUTA</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-center font-mono text-xs font-bold py-2 border rounded-xl">
                              {isAccepted && (
                                <span className="text-emerald-700 flex items-center justify-center gap-1">
                                  <CheckCircle2 size={14} className="text-emerald-600" />
                                  Stato: ACCETTATO (In Calendario)
                                </span>
                              )}
                              {isDeclined && (
                                <span className="text-rose-700 flex items-center justify-center gap-1">
                                  <XCircle size={14} className="text-rose-600" />
                                  Stato: RIFIUTATO (Chiuso)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB CONTENT: SENT INVITES */}
              {activeInviteTab === 'sent' && (
                <div className="space-y-3">
                  {sentInvites.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-200 p-4">
                      <Send size={28} className="text-gray-300 mx-auto mb-1.5" />
                      <p className="font-bold text-gray-700 text-xs uppercase tracking-wider">Nessun invito inviato</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Clicca su "+ Chiedi affiancamento" su un tuo appuntamento per invitare un collega.
                      </p>
                    </div>
                  ) : (
                    sentInvites.map((invite) => {
                      const isPending = invite.status === 'PENDING';
                      const isAccepted = invite.status === 'ACCEPTED';
                      const isDeclined = invite.status === 'DECLINED';

                      return (
                        <div
                          key={invite.id}
                          className="bg-white border border-gray-200 rounded-2xl p-3.5 space-y-2 shadow-xs font-mono text-xs"
                        >
                          <div className="flex items-center justify-between text-gray-500 text-[11px]">
                            <span>A: <strong className="text-gray-900">{invite.guest_agent_name || 'Collega'}</strong></span>
                            <span>{invite.visit_date}</span>
                          </div>

                          <div className="font-bold text-gray-900 text-xs">
                            Cliente: {invite.client_name} ({invite.client_city || 'N.D.'})
                          </div>

                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-gray-400 text-[10px]">ESITO RICHIESTA:</span>
                            {isPending && (
                              <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1 text-[10px] animate-pulse">
                                <Clock size={11} />
                                IN ATTESA
                              </span>
                            )}
                            {isAccepted && (
                              <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 text-[10px]">
                                <CheckCircle2 size={11} className="text-emerald-700" />
                                ACCETTATO [SÌ]
                              </span>
                            )}
                            {isDeclined && (
                              <span className="bg-rose-100 text-rose-900 font-bold px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1 text-[10px]">
                                <XCircle size={11} className="text-rose-700" />
                                RIFIUTATO [NO]
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

            </div>
          </section>

        </div>
      </div>

      {/* MODAL 1: PROGRAMMA NUOVA VISITA */}
      <AnimatePresence>
        {isNewVisitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewVisitModalOpen(false)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] border border-[#E5E7EB] shadow-2xl p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-lg font-serif font-black uppercase text-gray-900 flex items-center gap-2">
                  <Plus size={18} className="text-[#5A5A40]" />
                  <span>Programma Nuova Visita</span>
                </h3>
                <button
                  onClick={() => setIsNewVisitModalOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateVisit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-800 uppercase mb-1">
                    Seleziona Cliente (I Tuoi Clienti Assegnati): *
                  </label>
                  <select
                    value={newVisitClientId || ''}
                    onChange={(e) => setNewVisitClientId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 font-medium text-sm text-gray-900 focus:outline-none focus:border-[#5A5A40]"
                    required
                  >
                    <option value="">-- Scegli un tuo cliente --</option>
                    {myClients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `(${c.city})` : ''} - Agente: {c.agente || 'Tu'}
                      </option>
                    ))}
                  </select>
                  {myClients.length === 0 && (
                    <p className="text-rose-600 font-bold mt-1 text-[11px]">
                      Nessun cliente risulta assegnato direttamente al tuo nome nel sistema.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-800 uppercase mb-1">
                      Data Visita: *
                    </label>
                    <input
                      type="date"
                      value={newVisitDate}
                      onChange={(e) => setNewVisitDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-medium text-sm text-gray-900 focus:outline-none focus:border-[#5A5A40]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 uppercase mb-1">
                      Orario previsto:
                    </label>
                    <input
                      type="time"
                      value={newVisitTimeSlot}
                      onChange={(e) => setNewVisitTimeSlot(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-medium text-sm text-gray-900 focus:outline-none focus:border-[#5A5A40]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-800 uppercase mb-1">
                    Note / Obiettivo della visita:
                  </label>
                  <textarea
                    value={newVisitNotes}
                    onChange={(e) => setNewVisitNotes(e.target.value)}
                    rows={3}
                    placeholder="Es. Presentazione novità cosmetiche, consegna ordine, campionatura..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-normal text-gray-900 focus:outline-none focus:border-[#5A5A40]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewVisitModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl uppercase"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={myClients.length === 0}
                    className="px-5 py-2 bg-[#5A5A40] hover:bg-[#4A4A30] text-white font-bold rounded-xl shadow-sm uppercase disabled:opacity-50"
                  >
                    Conferma Visita
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: RICHIEDI AFFIANCAMENTO */}
      <AnimatePresence>
        {selectedVisitForInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVisitForInvite(null)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] border border-[#E5E7EB] shadow-2xl p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-lg font-serif font-black uppercase text-gray-900 flex items-center gap-2">
                  <UserPlus size={18} className="text-amber-600" />
                  <span>Invita Collega in Affiancamento</span>
                </h3>
                <button
                  onClick={() => setSelectedVisitForInvite(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 font-mono text-xs space-y-0.5">
                <div className="font-bold text-amber-900 uppercase">Dettaglio Uscita:</div>
                <div className="text-gray-900 font-bold text-sm">{selectedVisitForInvite.client_name}</div>
                <div className="text-gray-600">Data: {selectedVisitForInvite.visit_date} (Ore {selectedVisitForInvite.time_slot})</div>
              </div>

              <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-800 uppercase mb-1">
                    Seleziona Collega (Agente o Admin): *
                  </label>
                  <select
                    value={selectedGuestAgentId || ''}
                    onChange={(e) => setSelectedGuestAgentId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 font-medium text-sm text-gray-900 focus:outline-none focus:border-[#5A5A40]"
                    required
                  >
                    <option value="">-- Seleziona un collega (Agente / Admin) --</option>
                    {colleagues
                      .filter(col => {
                        if (!col.role) return false;
                        const r = String(col.role).toLowerCase().trim();
                        return ['admin', 'amministratore', 'agent', 'agente'].includes(r);
                      })
                      .map(col => {
                        const isAdm = col.role && (col.role.toLowerCase().includes('admin') || col.role.toLowerCase().includes('amministratore'));
                        const roleBadge = isAdm ? 'Admin' : 'Agente';
                        return (
                          <option key={col.id} value={col.id}>
                            {col.name} ({roleBadge}{col.department ? ` - ${col.department}` : ''})
                          </option>
                        );
                      })}
                  </select>
                </div>

                <p className="text-gray-500 text-[11px] leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                  Il collega riceverà la notifica e potrà accettare [SÌ] o rifiutare [NO]. Se accetta, l'uscita comparirà automaticamente nel suo calendario.
                </p>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVisitForInvite(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl uppercase"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm uppercase"
                  >
                    Invia Invito
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: SCHEDA CLIENTE MODAL */}
      <AnimatePresence>
        {selectedClientForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClientForModal(null)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] border border-[#E5E7EB] shadow-2xl p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-lg font-serif font-black uppercase text-gray-900 flex items-center gap-2">
                  <Building2 size={18} className="text-[#5A5A40]" />
                  <span>Scheda Anagrafica Cliente</span>
                </h3>
                <button
                  onClick={() => setSelectedClientForModal(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 font-sans text-xs">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="text-base font-bold text-gray-900">{selectedClientForModal.name}</div>
                  <div className="text-gray-500 font-mono text-[11px] mt-0.5">Codice: {selectedClientForModal.code || 'N.D.'}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                    <span className="font-bold text-gray-400 uppercase block text-[10px]">Referente:</span>
                    <span className="font-bold text-gray-900 text-xs">{selectedClientForModal.contact || 'N.D.'}</span>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                    <span className="font-bold text-gray-400 uppercase block text-[10px]">Agente di Riferimento:</span>
                    <span className="font-bold text-[#5A5A40] text-xs">{selectedClientForModal.agente || 'Nessuno'}</span>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
                  <div><strong className="text-gray-500 uppercase text-[10px]">Città:</strong> {selectedClientForModal.city || 'N.D.'}</div>
                  <div><strong className="text-gray-500 uppercase text-[10px]">Telefono:</strong> {selectedClientForModal.phone || 'N.D.'}</div>
                  <div><strong className="text-gray-500 uppercase text-[10px]">Email:</strong> {selectedClientForModal.email || 'N.D.'}</div>
                </div>

                {selectedClientForModal.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-gray-800">
                    <strong className="text-amber-900 uppercase block text-[10px] mb-0.5">Note Cliente:</strong>
                    {selectedClientForModal.notes}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-gray-100">
                {onSelectClient && selectedClientForModal.id && (
                  <button
                    onClick={() => {
                      const id = selectedClientForModal.id;
                      setSelectedClientForModal(null);
                      onSelectClient(id);
                    }}
                    className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white font-bold text-xs px-3.5 py-2 rounded-xl uppercase"
                  >
                    Vedi Dettaglio Completo →
                  </button>
                )}
                <button
                  onClick={() => setSelectedClientForModal(null)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs px-4 py-2 rounded-xl uppercase ml-auto"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION MODAL FOR DELETING VISITS */}
      <ConfirmModal
        isOpen={visitToDeleteId !== null}
        onClose={() => setVisitToDeleteId(null)}
        onConfirm={() => {
          if (visitToDeleteId !== null) {
            performDeleteVisit(visitToDeleteId);
          }
        }}
        title="Elimina Visita"
        message="Sei sicuro di voler eliminare questa visita dal tuo calendario?"
        confirmText="Elimina Visita"
        cancelText="Annulla"
        type="danger"
      />

      {/* CALENDAR READ-ONLY INSPECTOR MODAL */}
      <AnimatePresence>
        {readonlyVisit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReadonlyVisit(null)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] border border-[#E5E7EB] shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl">
                    <Eye size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-serif font-black uppercase text-gray-900">
                      Dettaglio Visita (Solo Lettura)
                    </h3>
                    <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                      <Lock size={10} />
                      Consulta i dettagli programmati
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReadonlyVisit(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl space-y-1">
                  <div className="text-[10px] font-black uppercase text-gray-400">Cliente / Ragione Sociale</div>
                  <div className="text-sm font-bold text-gray-900">{readonlyVisit.client_name}</div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200/60 mt-1">
                    <div className="flex items-center gap-1.5 text-gray-600 font-mono text-[11px] min-w-0">
                      <MapPin size={12} className="text-[#5A5A40] shrink-0" />
                      <span className="truncate">
                        {readonlyVisit.client_address ? `${readonlyVisit.client_address}${readonlyVisit.client_city ? `, ${readonlyVisit.client_city}` : ''}` : (readonlyVisit.client_city || 'Indirizzo non specificato')}
                      </span>
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([readonlyVisit.client_address, readonlyVisit.client_city].filter(Boolean).join(', ') || readonlyVisit.client_name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-xs shrink-0"
                      title="Apri le indicazioni stradali su Google Maps"
                    >
                      <Navigation size={12} />
                      <span>Google Maps</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl">
                    <span className="text-[10px] font-black text-gray-400 uppercase block">Data</span>
                    <span className="font-bold text-gray-900">{readonlyVisit.visit_date}</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl">
                    <span className="text-[10px] font-black text-gray-400 uppercase block">Orario</span>
                    <span className="font-bold text-gray-900">{readonlyVisit.time_slot || '09:00'}</span>
                  </div>
                </div>

                {readonlyVisit.is_joint && (() => {
                  const isHost = readonlyVisit.host_agent_id 
                    ? Number(readonlyVisit.host_agent_id) === Number(currentUser?.id)
                    : Number(readonlyVisit.agent_id) === Number(currentUser?.id);
                  const hostName = readonlyVisit.host_agent_name || readonlyVisit.agent_name || 'un collega';
                  const matchingSentInvite = sentInvites.find(i => i.visit_id === readonlyVisit.id);
                  const guestName = readonlyVisit.guest_agent_name || matchingSentInvite?.guest_agent_name || 'un collega';

                  return (
                    <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-indigo-950 flex items-center gap-2">
                      <Users size={16} className="text-indigo-600 shrink-0" />
                      <div>
                        <strong className="block text-[10px] uppercase text-indigo-800">Affiancamento Agenti</strong>
                        <span>
                          {isHost ? (
                            <>Hai invitato l'agente <strong>{guestName}</strong></>
                          ) : (
                            <>Sei stato invitato dall'agente <strong>{hostName}</strong></>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {readonlyVisit.notes && (
                  <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl text-gray-800">
                    <strong className="text-amber-900 uppercase block text-[10px] mb-0.5">Note Appuntamento:</strong>
                    <p className="whitespace-pre-wrap">{readonlyVisit.notes}</p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    const client = myClients.find(c => c.id === readonlyVisit.client_id);
                    setReadonlyVisit(null);
                    if (client) {
                      setSelectedClientForModal(client);
                    } else {
                      setSelectedClientForModal({
                        id: readonlyVisit.client_id,
                        name: readonlyVisit.client_name,
                        contact: '',
                        phone: '',
                        email: '',
                        city: readonlyVisit.client_city || '',
                        notes: ''
                      });
                    }
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1"
                >
                  <Building2 size={13} />
                  <span>Scheda Cliente</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReadonlyVisit(null)}
                  className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white font-bold text-xs px-4 py-2 rounded-xl uppercase"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CALENDAR READ-ONLY DAY VISITS MODAL */}
      <AnimatePresence>
        {readonlyDayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReadonlyDayModal(null)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] border border-[#E5E7EB] shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-serif font-black uppercase text-gray-900 flex items-center gap-2">
                    <Calendar size={18} className="text-[#5A5A40]" />
                    <span>Visite del {readonlyDayModal.dateStr}</span>
                  </h3>
                  <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                    <Lock size={10} />
                    <span>Visualizzazione in sola lettura</span>
                  </p>
                </div>
                <button
                  onClick={() => setReadonlyDayModal(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                {readonlyDayModal.visits.map((visit) => {
                  const isJoint = visit.is_joint || visit.agent_id !== currentUser?.id;

                  return (
                    <div
                      key={visit.id}
                      onClick={() => {
                        setReadonlyDayModal(null);
                        setReadonlyVisit(visit);
                      }}
                      className={cn(
                        "p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md space-y-1",
                        isJoint ? "bg-indigo-50/50 border-indigo-200" : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs bg-[#5A5A40] text-white px-2 py-0.5 rounded-md">
                          {visit.time_slot || '09:00'}
                        </span>
                        {isJoint && (
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                            Affiancamento
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-gray-900 text-xs">{visit.client_name}</div>
                      {visit.client_city && (
                        <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
                          <MapPin size={11} />
                          <span>{visit.client_city}</span>
                        </div>
                      )}
                      {visit.notes && (
                        <div className="text-[11px] text-gray-600 italic bg-white p-2 rounded-lg border border-gray-200 mt-1">
                          "{visit.notes}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setReadonlyDayModal(null)}
                  className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white font-bold text-xs px-4 py-2 rounded-xl uppercase"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
