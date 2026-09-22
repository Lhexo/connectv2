import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Users,
  Briefcase,
  PlusCircle,
  Truck,
  Calendar as CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ChevronLeft,
  ListTodo,
  Flag,
  RefreshCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Task, DashboardStats, User } from '../types';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function Dashboard({ user }: { user: User | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedMacroCategoryId, setSelectedMacroCategoryId] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then(res => {
        if (!res.ok) throw new Error('Unsuccessful fetch');
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        throw new Error('Not JSON');
      })
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(err => console.error('Error fetching users:', err));

    fetch('/api/categories')
      .then(res => {
        if (!res.ok) throw new Error('Unsuccessful fetch');
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        throw new Error('Not JSON');
      })
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(err => console.error('Error fetching categories:', err));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedUserId) params.append('userId', selectedUserId);
        if (selectedMacroCategoryId) params.append('macroCategoryId', selectedMacroCategoryId);
        
        const query = params.toString() ? `?${params.toString()}` : '';
        const [tasksRes, statsRes] = await Promise.all([
          fetch(`/api/tasks${query}`),
          fetch(`/api/stats${query}`)
        ]);
        
        if (!tasksRes.ok || !statsRes.ok) {
          throw new Error('Errore nel caricamento dei dati della dashboard');
        }

        const tasksData = await tasksRes.json();
        const statsData = await statsRes.json();
        
        if (Array.isArray(tasksData)) {
          setTasks(tasksData);
        } else {
          throw new Error('Formato dati task non valido');
        }

        if (statsData && !statsData.error) {
          setStats(statsData);
        } else {
          throw new Error(statsData?.error || 'Errore nel caricamento delle statistiche');
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError(error instanceof Error ? error.message : 'Si è verificato un errore imprevisto');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedUserId, selectedMacroCategoryId]);

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getTasksForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return tasks.filter(task => task.deadline && task.deadline.startsWith(dayStr));
  };

  // To-Do List Logic (Categorized by Urgency)
  const urgencyOrder = ['Urgente', 'Alta', 'Media', 'Bassa'];
  const todoTasks = tasks
    .filter(t => t.status !== 'Completato' && t.status !== 'Annullato')
    .sort((a, b) => urgencyOrder.indexOf(a.priority) - urgencyOrder.indexOf(b.priority));

  const mainStats = [
    { 
      label: 'Attività Totali', 
      value: stats?.totalTasks || 0, 
      icon: Briefcase, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50',
      trend: '',
      trendUp: true
    },
    { 
      label: 'Attività di Oggi', 
      value: stats?.todayActivities || 0, 
      icon: Clock, 
      color: 'text-[#5A5A40]', 
      bg: 'bg-[#F5F5F0]',
      trend: 'Operativo',
      trendUp: true
    },
    { 
      label: 'Completati', 
      value: stats?.completedTasks || 0, 
      icon: CheckCircle2, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      trend: 'Target',
      trendUp: true
    },
    { 
      label: 'In Scadenza', 
      value: stats?.overdueTasks || 0, 
      icon: AlertCircle, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50',
      trend: 'Urgente',
      trendUp: false
    },
    { 
      label: 'Attività Scadute', 
      value: stats?.expiredTasks || 0, 
      icon: AlertCircle, 
      color: 'text-rose-600', 
      bg: 'bg-rose-50',
      trend: 'Critico',
      trendUp: true
    },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-bold text-[#9CA3AF] animate-pulse uppercase tracking-widest">Caricamento Dashboard...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center max-w-md mx-auto">
      <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
        <AlertCircle size={40} />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-serif font-bold text-[#111827]">Errore di Caricamento</h2>
        <p className="text-[#6B7280]">{error}</p>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 bg-[#5A5A40] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20"
      >
        <RefreshCcw size={20} /> Riprova
      </button>
    </div>
  );

  if (!stats) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-12 bg-[#fcfaf7]"
    >
        {/* Top Title Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="space-y-2">
            <h1 className="text-5xl font-serif font-semibold text-[#1a1a1a] leading-none">
              Dashboard Operativa
            </h1>
            <p className="text-[#1a1a1a]/50 text-base font-normal">
              {selectedUserId || selectedMacroCategoryId 
                ? 'Vista filtrata delle attività nel sistema' 
                : 'Panoramica globale delle attività nel sistema'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full border border-[rgba(26,26,26,0.05)] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <Briefcase size={16} className="text-[#6366f1]" />
              <select 
                value={selectedMacroCategoryId}
                onChange={(e) => setSelectedMacroCategoryId(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-semibold text-[#1a1a1a] cursor-pointer pr-4 font-sans"
              >
                <option value="">Macro Categorie</option>
                {categories.filter(c => !c.parent_id).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full border border-[rgba(26,26,26,0.05)] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <Users size={16} className="text-[#6366f1]" />
              <select 
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-semibold text-[#1a1a1a] cursor-pointer pr-4 font-sans"
              >
                <option value="">Tutti gli utenti</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="px-5 py-2.5 bg-white border border-[rgba(26,26,26,0.05)] rounded-full text-xs font-mono uppercase tracking-wider text-[#1a1a1a]/70 flex items-center gap-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <CalendarIcon size={16} className="text-[#6366f1]" />
              {format(new Date(), 'd MMMM yyyy', { locale: it })}
            </div>
          </div>
        </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Totali', val: stats?.totalTasks || 0, color: 'text-[#1a1a1a]' },
          { label: 'Oggi', val: stats?.todayActivities || 0, color: 'text-[#1a1a1a]' },
          { label: 'Completati', val: stats?.completedTasks || 0, color: 'text-emerald-600' },
          { label: 'Scaduti', val: stats?.expiredTasks || 0, color: 'text-rose-600' }
        ].map((s) => (
          <div key={s.label} className="bg-white p-7 rounded-[24px] shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-white">
            <span className="font-mono text-[0.7rem] uppercase tracking-widest text-[#1a1a1a]/40 block mb-3">
              {s.label}
            </span>
            <span className={cn("text-5xl font-serif font-semibold block leading-none", s.color)}>
              {s.val}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Calendar View */}
          <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                <CalendarIcon size={20} className="text-[#5A5A40]" />
                Calendario Attività
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-[#111827] capitalize">{format(currentMonth, 'MMMM yyyy', { locale: it })}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-[#E5E7EB] rounded-2xl border border-[#E5E7EB] overflow-hidden">
              {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                <div key={day} className="bg-[#F9FAFB] py-2 text-center text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, i) => {
                const dayTasks = getTasksForDay(day);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isToday = isSameDay(day, new Date());

                return (
                  <div 
                    key={day.toString()} 
                    className={cn(
                      "bg-white min-h-[100px] p-2 transition-colors hover:bg-[#F9FAFB]",
                      !isCurrentMonth && "bg-[#F9FAFB]/50 opacity-40"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                        isToday ? "bg-[#5A5A40] text-white" : "text-[#111827]"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map(task => (
                        <div 
                          key={`${task.activity_source}-${task.id}`}
                          className={cn(
                            "text-[9px] font-bold p-1 rounded border truncate",
                            task.priority === 'Urgente' ? "bg-rose-50 border-rose-100 text-rose-600" :
                            task.priority === 'Alta' ? "bg-orange-50 border-orange-100 text-orange-600" :
                            "bg-blue-50 border-blue-100 text-blue-600"
                          )}
                        >
                          {task.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[8px] font-black text-[#9CA3AF] text-center uppercase">
                          + {dayTasks.length - 3} altri
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* To-Do List Categorized by Urgency */}
          <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                <ListTodo size={20} className="text-[#5A5A40]" />
                To-Do List per Urgenza
              </h2>
              <Link to="/tasks" className="text-xs font-bold text-[#5A5A40] hover:underline">Vedi tutte le attività</Link>
            </div>

            <div className="space-y-6">
              {urgencyOrder.map(urgency => {
                const urgencyTasks = todoTasks.filter(t => t.priority === urgency);
                if (urgencyTasks.length === 0) return null;

                return (
                  <div key={urgency} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Flag size={14} className={cn(
                        urgency === 'Urgente' ? "text-rose-500" :
                        urgency === 'Alta' ? "text-orange-500" :
                        urgency === 'Media' ? "text-blue-500" : "text-slate-400"
                      )} />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">{urgency}</h3>
                      <div className="h-px flex-1 bg-[#F3F4F6]"></div>
                      <span className="text-[10px] font-bold text-[#9CA3AF]">{urgencyTasks.length}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {urgencyTasks.map(task => {
                        const isCall = task.activity_source === 'call';
                        const key = `${task.activity_source}-${task.id}`;
                        const Content = (
                          <div className="flex items-center gap-4 p-3 bg-[#F9FAFB] hover:bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] transition-all group w-full text-left">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              isCall ? "bg-indigo-500" :
                              urgency === 'Urgente' ? "bg-rose-500 animate-pulse" :
                              urgency === 'Alta' ? "bg-orange-500" :
                              urgency === 'Media' ? "bg-blue-500" : "bg-slate-300"
                            )} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[#111827] truncate group-hover:text-[#5A5A40] transition-colors">{task.title}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-[#6B7280] font-medium">{isCall ? 'Chiamata' : (task.category_name || 'Generale')}</span>
                                <span className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">
                                  {task.deadline ? format(new Date(task.deadline), 'dd/MM/yyyy') : 'Nessuna scadenza'}
                                </span>
                              </div>
                            </div>
                            <ChevronRight size={14} className="text-[#D1D5DB] group-hover:translate-x-1 transition-transform" />
                          </div>
                        );

                        if (isCall) return <div key={key}>{Content}</div>;

                        return (
                          <Link 
                            key={key}
                            to={`/tasks/${task.id}`}
                            className="block"
                          >
                            {Content}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Actions & Alerts */}
        <div className="space-y-8">
          {/* Latest Calls Widget */}
          <div className="bg-white p-6 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold flex items-center gap-2">
                <Clock size={18} className="text-[#5A5A40]" />
                Ultime Chiamate
              </h2>
            </div>
            <div className="space-y-4">
              {stats?.latestCalls.map((call) => (
                <div key={call.id} className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB]">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                    call.caller_type === 'cliente' ? "bg-blue-500" : 
                    call.caller_type === 'fornitore' ? "bg-orange-500" : "bg-slate-500"
                  )}>
                    {call.caller_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#111827] truncate">{call.caller_name}</div>
                    <div className="text-[10px] text-[#6B7280] font-medium truncate">{call.reason}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-[#111827]">{Math.floor(call.duration / 60)}m {call.duration % 60}s</div>
                    <div className="text-[8px] text-[#9CA3AF] font-bold uppercase">{format(parseISO(call.created_at), 'HH:mm')}</div>
                  </div>
                </div>
              ))}
              {(!stats?.latestCalls || stats.latestCalls.length === 0) && (
                <p className="text-xs text-[#9CA3AF] text-center py-4">Nessuna chiamata recente</p>
              )}
            </div>
          </div>

          {/* Workload Distribution */}
          <div className="bg-white p-6 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <h2 className="text-lg font-serif font-bold flex items-center gap-2">
              <TrendingUp size={18} className="text-[#5A5A40]" />
              Stato Attività
            </h2>
            <div className="space-y-4">
              {stats?.tasksByStatus.map((s, i) => (
                <div key={s.status} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{s.status}</span>
                    <span className="text-[#9CA3AF]">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(s.count / (stats?.totalTasks || 1)) * 100}%` }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className={cn(
                        "h-full rounded-full",
                        s.status === 'Completato' ? "bg-emerald-500" :
                        s.status === 'In gestione' ? "bg-amber-500" :
                        s.status === 'In pausa' ? "bg-rose-500" : "bg-blue-500"
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-serif font-bold">Azioni Rapide</h2>
            <div className="grid grid-cols-1 gap-4">
              <Link to="/tasks/new" className="flex items-center gap-4 p-5 bg-[#5A5A40] text-white rounded-3xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 group">
                <div className="p-3 bg-white/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <PlusCircle size={28} />
                </div>
                <div>
                  <div className="font-bold text-lg">Nuova Attività</div>
                  <div className="text-xs text-white/60">Crea una nuova attività</div>
                </div>
              </Link>
              
              <Link to="/suppliers" className="flex items-center gap-4 p-5 bg-white border border-[#E5E7EB] rounded-3xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group">
                <div className="p-3 bg-[#F9FAFB] rounded-2xl text-[#5A5A40] group-hover:scale-110 transition-transform">
                  <Truck size={28} />
                </div>
                <div>
                  <div className="font-bold text-lg text-[#111827]">Fornitori</div>
                  <div className="text-xs text-[#6B7280]">Gestione ordini e partner</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Alerts / Deadlines */}
          <div className="space-y-4">
            <h2 className="text-xl font-serif font-bold">Scadenze Critiche</h2>
            <div className="space-y-3">
              {tasks.filter(t => t.deadline && new Date(t.deadline) <= new Date() && t.status !== 'Completato').slice(0, 3).map(task => (
                <div key={task.id} className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                  <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-rose-900">{task.title}</div>
                    <div className="text-[10px] font-bold text-rose-700 uppercase mt-1">Scaduto il {task.deadline && new Date(task.deadline).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.deadline && new Date(t.deadline) <= new Date() && t.status !== 'Completato').length === 0 && (
                <div className="p-8 text-center bg-[#F9FAFB] rounded-2xl border border-dashed border-[#E5E7EB]">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs font-bold text-[#9CA3AF]">Tutte le scadenze sono sotto controllo</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
