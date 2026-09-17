import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  Settings, 
  Bell,
  PlusCircle, 
  Search, 
  MessageSquare,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  Clock,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  Truck,
  UserCog,
  BarChart3,
  LogOut,
  PhoneCall,
  Save,
  FileCode,
  RefreshCw,
  Calendar,
  ShoppingBag,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { User, Task } from './types';

// Pages
import Dashboard from './pages/Dashboard';
import TaskList from './pages/TaskList';
import TaskDetail from './pages/TaskDetail';
import TaskForm from './pages/TaskForm';
import ClientList from './pages/ClientList';
import ClientDetail from './pages/ClientDetail';
import SupplierList from './pages/SupplierList';
import SupplierDetail from './pages/SupplierDetail';
import UserManagement from './pages/UserManagement';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import PosteGenerator from './pages/PosteGenerator';
import Easyfatt from './pages/Easyfatt';
import { Girovisite } from './pages/Girovisite';
import CreateOrder from './pages/CreateOrder';
import AgentStats from './pages/AgentStats';

export default function App() {
  console.log('App component rendering...');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [callData, setCallData] = useState({ 
    caller: '', 
    caller_type: 'esterno' as 'cliente' | 'fornitore' | 'esterno',
    reason: '', 
    taskId: '',
    categoryId: '',
    clientId: '',
    supplierId: '',
    duration_minutes: ''
  });

  useEffect(() => {
    if (isCallModalOpen) {
      fetchClients();
      fetchSuppliers();
    }
  }, [isCallModalOpen]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [clearNotifDate, setClearNotifDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setNotifications(data);
        } else {
          console.warn('Expected JSON for notifications but received different content-type:', contentType);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000); // Poll every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  const markNotificationAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const clearNotificationsBeforeDate = async (date: string) => {
    try {
      const res = await fetch('/api/notifications/clear-before', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error clearing notifications before date:', error);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          fetchCategories();
          fetchClients();
          fetchSuppliers();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();

    const timeout = setTimeout(() => {
      setLoading(current => {
        if (current) {
          console.warn('Auth check timed out, forcing loading to false');
          return false;
        }
        return current;
      });
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : []);
      } else {
        setSuppliers([]);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    }
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingCall) return;
    
    setIsLoggingCall(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_name: callData.caller,
          caller_type: callData.caller_type,
          reason: callData.reason,
          duration: callTimer,
          task_id: callData.taskId ? Number(callData.taskId) : null,
          category_id: callData.categoryId ? Number(callData.categoryId) : null,
          client_id: callData.clientId ? Number(callData.clientId) : null,
          supplier_id: callData.supplierId ? Number(callData.supplierId) : null,
          duration_minutes: callData.duration_minutes ? Number(callData.duration_minutes) : 0
        })
      });
      if (res.ok) {
        setIsCallModalOpen(false);
        setCallData({ 
          caller: '', 
          caller_type: 'esterno', 
          reason: '', 
          taskId: '', 
          categoryId: '',
          clientId: '',
          supplierId: '',
          duration_minutes: ''
        });
        setCallTimer(0);
        setIsTimerRunning(false);
        // Refresh page if on task detail page to show new call in history
        if (location.pathname.includes('/tasks/')) {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error logging call:', error);
    } finally {
      setIsLoggingCall(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'amministratore';
  const isAgent = userRole === 'agent' || userRole === 'agente';
  const isCapoArea = userRole === 'capoarea';
  const isSalesRole = isAgent || isCapoArea;
  const isBaseUser = userRole === 'user';

  // Agent / Capoarea: Exactly 4 distinct, large tactical buttons
  const agentNavItems = [
    { icon: Calendar, label: 'Girovisite & Affiancamenti', path: '/girovisite', desc: 'Calendario visite e appuntamenti' },
    { icon: ShoppingBag, label: 'Crea Nuovo Ordine', path: '/ordine', desc: 'Showroom visivo e carrello rapido' },
    { icon: Users, label: 'I Miei Clienti', path: '/clients', desc: 'Anagrafica, storico e ordini diretti' },
    { icon: RefreshCw, label: 'Easyfatt & Ordini', path: '/easyfatt', desc: 'Gestione ordini, clienti e catalogo' },
    { icon: TrendingUp, label: 'Statistiche & Obiettivi', path: '/statistiche', desc: 'Monitoraggio target e clienti dormienti' },
  ];

  const adminNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Calendar, label: 'Girovisite', path: '/girovisite' },
    { icon: ShoppingBag, label: 'Crea Ordine', path: '/ordine' },
    { icon: TrendingUp, label: 'Statistiche', path: '/statistiche' },
    { icon: CheckSquare, label: 'Attività', path: '/tasks' },
    { icon: Users, label: 'Clienti', path: '/clients' },
    { icon: Truck, label: 'Fornitori', path: '/suppliers' },
    { icon: UserCog, label: 'Team', path: '/users' },
    { icon: RefreshCw, label: 'Easyfatt-XML', path: '/easyfatt' },
    { icon: FileCode, label: 'Spedizioni Poste', path: '/poste-generator' },
    { icon: Settings, label: 'Impostazioni', path: '/settings/profile' },
  ];

  const userNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: CheckSquare, label: 'Attività', path: '/tasks' },
    { icon: Users, label: 'Clienti', path: '/clients' },
    { icon: Truck, label: 'Fornitori', path: '/suppliers' },
    { icon: FileCode, label: 'Spedizioni Poste', path: '/poste-generator' },
    { icon: Settings, label: 'Impostazioni', path: '/settings/profile' },
  ];

  const filteredNavItems = isSalesRole 
    ? agentNavItems 
    : (isAdmin ? adminNavItems : userNavItems);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-6 max-w-xs text-center">
          <div className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin"></div>
          <div className="space-y-2">
            <span className="block text-sm font-bold text-[#5A5A40] uppercase tracking-widest">Inizializzazione Sistema...</span>
            <p className="text-xs text-[#9CA3AF] font-medium">Il sistema potrebbe essere rallentato dopo l'importazione dei dati. Attendi un istante.</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 text-[10px] font-black uppercase tracking-widest text-[#5A5A40] hover:underline"
          >
            Ricarica Pagina
          </button>
        </div>
      </div>
    );
  }

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" />;
  }

  if (location.pathname === '/login') {
    return <Login onLogin={(u) => { setUser(u); navigate('/'); }} />;
  }

  return (
    <div className="flex h-screen bg-[#fcfaf7] font-sans text-[#1a1a1a] overflow-hidden">
      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 bg-[#fcfaf7] border-r border-[rgba(26,26,26,0.05)] transition-transform duration-300 z-50 w-[280px] p-6 flex flex-col h-full lg:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="font-serif italic text-3xl font-semibold tracking-tight text-[#1a1a1a] select-none">
            Connect.
          </Link>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 hover:bg-white rounded-lg transition-colors text-[#1a1a1a]/60 hover:text-[#1a1a1a]"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2.5 overflow-y-auto pr-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3.5 transition-all font-bold",
                  isSalesRole 
                    ? "px-4 py-3.5 rounded-2xl text-base" 
                    : "px-3.5 py-2.5 rounded-xl text-sm font-medium",
                  isActive 
                    ? "bg-[#5A5A40] text-white shadow-md" 
                    : isSalesRole
                      ? "text-[#1a1a1a] bg-white border border-gray-100 hover:bg-gray-50 hover:shadow-xs"
                      : "text-[#1a1a1a] hover:bg-white/80 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                )}
              >
                <div className={cn(
                  "rounded-xl shrink-0 transition-colors flex items-center justify-center",
                  isSalesRole ? "p-2.5" : "p-1",
                  isActive ? "bg-white/20 text-white" : "bg-[#5A5A40]/10 text-[#5A5A40]"
                )}>
                  <item.icon size={isSalesRole ? 22 : 18} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate">{item.label}</span>
                  {isSalesRole && (item as any).desc && (
                    <span className={cn("text-[11px] font-normal truncate", isActive ? "text-white/80" : "text-gray-400")}>
                      {(item as any).desc}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Profile Card Mobile */}
        <div className="pt-4 border-t border-[rgba(26,26,26,0.05)]">
          <div className="bg-white p-3.5 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[rgba(26,26,26,0.03)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#6366f1] text-white flex items-center justify-center font-mono text-sm font-semibold flex-shrink-0">
              {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-lg" /> : (user?.name?.charAt(0) || 'A')}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold truncate text-[#1a1a1a]">{user?.name}</span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#1a1a1a]/50 truncate">{user?.department || user?.role}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "bg-[#fcfaf7] border-r border-[rgba(26,26,26,0.05)] transition-all duration-300 hidden lg:flex flex-col z-20 h-screen sticky top-0 shrink-0",
          isSidebarOpen ? "w-[280px] p-8" : "w-20 p-4"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          {isSidebarOpen ? (
            <Link to="/" className="font-serif italic text-3xl font-semibold tracking-tight text-[#1a1a1a] select-none">
              Connect.
            </Link>
          ) : (
            <Link to="/" className="font-serif italic text-2xl font-bold text-[#1a1a1a] mx-auto">
              C.
            </Link>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 hover:bg-white rounded-lg transition-colors text-[#1a1a1a]/60 hover:text-[#1a1a1a] ml-auto"
          >
            {isSidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 space-y-2.5 overflow-y-auto pr-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3.5 transition-all font-bold group",
                  isSalesRole 
                    ? (isSidebarOpen ? "p-3.5 rounded-2xl text-base" : "p-3 rounded-xl justify-center")
                    : "px-3.5 py-2.5 rounded-xl text-sm font-medium",
                  isActive 
                    ? "bg-[#5A5A40] text-white shadow-md" 
                    : isSalesRole
                      ? "text-[#1a1a1a] bg-white border border-gray-100 hover:border-[#5A5A40]/30 hover:shadow-xs"
                      : "text-[#1a1a1a] hover:bg-white/80 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                )}
                title={item.label}
              >
                <div className={cn(
                  "rounded-xl shrink-0 transition-colors flex items-center justify-center",
                  isSalesRole ? "p-2.5" : "p-1",
                  isActive 
                    ? "bg-white/20 text-white" 
                    : "bg-[#5A5A40]/10 text-[#5A5A40] group-hover:bg-[#5A5A40]/15"
                )}>
                  <item.icon size={isSalesRole ? 22 : 18} />
                </div>
                {isSidebarOpen && (
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate">{item.label}</span>
                    {isSalesRole && (item as any).desc && (
                      <span className={cn("text-[11px] font-normal truncate", isActive ? "text-white/80" : "text-gray-400")}>
                        {(item as any).desc}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Profile Card Desktop */}
        <div className="pt-4 border-t border-[rgba(26,26,26,0.05)]">
          <div className={cn(
            "bg-white p-3.5 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[rgba(26,26,26,0.03)] flex items-center gap-3 relative group",
            !isSidebarOpen && "justify-center p-2"
          )}>
            <div className="w-9 h-9 rounded-lg bg-[#6366f1] text-white flex items-center justify-center font-mono text-sm font-semibold flex-shrink-0">
              {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-lg" /> : (user?.name?.charAt(0) || 'A')}
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold truncate text-[#1a1a1a]">{user?.name}</span>
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#1a1a1a]/50 truncate">{user?.department || user?.role}</span>
              </div>
            )}
            <button 
              onClick={handleLogout}
              className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fcfaf7]">
        {/* Header */}
        <header className="h-16 sm:h-20 bg-[#fcfaf7] border-b border-[rgba(26,26,26,0.05)] flex items-center justify-between px-4 sm:px-6 lg:px-10 z-10 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white border border-[rgba(26,26,26,0.08)] text-[#1a1a1a] shrink-0 hover:bg-gray-50"
              title="Menu Navigation"
            >
              <Menu size={20} />
            </button>

            {!isSalesRole ? (
              <div className="search-pill-studio w-full max-w-[200px] sm:max-w-xs md:w-96">
                <Search size={16} className="text-[#1a1a1a]/40 shrink-0" />
                <input 
                  type="text" 
                  placeholder="Ricerca globale..." 
                  className="bg-transparent border-none outline-none text-xs sm:text-sm w-full font-sans text-[#1a1a1a] placeholder:text-[#1a1a1a]/40 truncate"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-[#5A5A40] bg-[#5A5A40]/10 px-3 py-1 rounded-full font-bold truncate">
                  {isCapoArea ? "Area Capoarea" : "Area Agente"}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Notifications */}
            <div className="relative group/notif">
              <button className="p-2 sm:p-2.5 bg-white border border-[rgba(26,26,26,0.05)] hover:border-[#6366f1] rounded-full transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative">
                <Bell size={18} className="text-[#1a1a1a]" />
                {notifications.some(n => !n.is_read) && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#6366f1] rounded-full border-2 border-white"></span>
                )}
              </button>
              
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-2xl shadow-2xl border border-[rgba(26,26,26,0.08)] opacity-0 invisible group-hover/notif:opacity-100 group-hover/notif:visible transition-all z-50 overflow-hidden">
                <div className="p-4 border-b border-[#1a1a1a]/5 flex items-center justify-between">
                  <span className="font-semibold text-sm text-[#1a1a1a]">Notifiche</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#6366f1] font-semibold">Recenti</span>
                </div>

                <div className="p-3.5 bg-[#fcfaf7] border-b border-[#1a1a1a]/5 flex flex-col gap-2">
                  <span className="text-[10px] font-mono uppercase text-[#1a1a1a]/60">Cancella notifiche fino a data:</span>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="date" 
                      value={clearNotifDate}
                      onChange={(e) => setClearNotifDate(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white border border-[#1a1a1a]/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#6366f1] text-[#1a1a1a] flex-1 font-mono"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (clearNotifDate) {
                          clearNotificationsBeforeDate(clearNotifDate);
                        }
                      }}
                      className="bg-rose-500 hover:bg-rose-600 text-white font-semibold text-[10px] px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Cancella
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-[#1a1a1a]/40 text-xs font-mono">
                      Nessuna notifica.
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => markNotificationAsRead(notif.id)}
                        className={cn(
                          "p-4 hover:bg-[#fcfaf7] transition-colors border-b border-[#1a1a1a]/5 cursor-pointer",
                          !notif.is_read && "bg-indigo-50/40"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            notif.type === 'deadline' ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
                          )}>
                            {notif.type === 'deadline' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-[#1a1a1a]">{notif.title}</p>
                            <p className="text-[10px] text-[#1a1a1a]/60">{notif.message}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {!isSalesRole && (
              <>
                <button 
                  onClick={() => setIsCallModalOpen(true)}
                  className="btn-action-studio !bg-white !text-[#1a1a1a] !border !border-[rgba(26,26,26,0.08)] hover:!border-[#6366f1] !py-2 !px-3 sm:!px-4"
                >
                  <PhoneCall size={16} className="text-[#6366f1] shrink-0" />
                  <span className="hidden sm:inline">Inizia Chiamata</span>
                </button>
                <Link 
                  to="/tasks/new"
                  className="btn-action-studio !py-2 !px-3 sm:!px-4"
                >
                  <PlusCircle size={16} className="shrink-0" />
                  <span className="hidden sm:inline">Nuova Attività</span>
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Page Content Canvas */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8 bg-[#fcfaf7]">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <Routes location={location}>
                {/* If sales role (agent/capoarea), redirect root to girovisite, else normal dashboard */}
                <Route path="/" element={
                  isSalesRole ? <Navigate to="/girovisite" replace /> : <Dashboard user={user} />
                } />
                
                <Route path="/girovisite" element={
                  isBaseUser ? <Navigate to="/" replace /> : <Girovisite currentUser={user} onSelectClient={(id) => navigate(`/clients/${id}`)} />
                } />

                <Route path="/ordine" element={<CreateOrder user={user} />} />
                <Route path="/crea-ordine" element={<CreateOrder user={user} />} />
                <Route path="/statistiche" element={<AgentStats user={user} />} />

                <Route path="/easyfatt" element={<Easyfatt user={user} />} />

                <Route path="/clients" element={<ClientList />} />
                <Route path="/clients/:id" element={<ClientDetail user={user} />} />

                {/* Internal pages restricted for Agents and Capoarea */}
                <Route path="/tasks" element={
                  isSalesRole ? <Navigate to="/girovisite" replace /> : <TaskList user={user} />
                } />
                <Route path="/tasks/new" element={
                  isSalesRole ? <Navigate to="/girovisite" replace /> : <TaskForm user={user} />
                } />
                <Route path="/tasks/:id" element={
                  isSalesRole ? <Navigate to="/girovisite" replace /> : <TaskDetail />
                } />
                <Route path="/suppliers" element={
                  isSalesRole ? <Navigate to="/girovisite" replace /> : <SupplierList />
                } />
                <Route path="/suppliers/:id" element={
                  isSalesRole ? <Navigate to="/girovisite" replace /> : <SupplierDetail />
                } />
                
                {/* Strictly Admin only for Team / User Management */}
                <Route path="/users" element={
                  isAdmin ? <UserManagement /> : (isSalesRole ? <Navigate to="/girovisite" replace /> : <Navigate to="/" replace />)
                } />
                
                <Route path="/poste-generator" element={
                  isSalesRole ? <Navigate to="/girovisite" replace /> : <PosteGenerator />
                } />

                {/* Split Settings Routes */}
                <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
                <Route path="/settings/profile" element={
                  <SettingsPage user={user} onUpdateUser={setUser} initialTab="profilo" />
                } />
                <Route path="/settings/admin" element={
                  isAdmin ? <SettingsPage user={user} onUpdateUser={setUser} initialTab="admin" /> : <Navigate to="/settings/profile" replace />
                } />
                
                <Route path="/login" element={
                  <Login onLogin={(u) => { 
                    setUser(u); 
                    const r = (u.role || '').toLowerCase();
                    navigate(r === 'agent' || r === 'agente' || r === 'capoarea' ? '/girovisite' : '/'); 
                  }} />
                } />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Call Logging Modal */}
      <AnimatePresence>
        {isCallModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCallModalOpen(false)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-[#E5E7EB] overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                      <PhoneCall size={20} />
                    </div>
                    <h3 className="text-xl font-serif font-bold text-[#111827]">Registra Chiamata</h3>
                  </div>
                  <button onClick={() => setIsCallModalOpen(false)} className="p-2 hover:bg-[#F3F4F6] rounded-xl transition-colors">
                    <X size={20} className="text-[#6B7280]" />
                  </button>
                </div>

                <form onSubmit={handleLogCall} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Durata Chiamata (secondi)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        value={callTimer}
                        onChange={(e) => setCallTimer(Number(e.target.value))}
                        className="flex-1 px-5 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-mono font-bold"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className={cn(
                          "px-4 py-3 rounded-2xl text-xs font-bold transition-all whitespace-nowrap",
                          isTimerRunning 
                            ? "bg-rose-100 text-rose-600 hover:bg-rose-200" 
                            : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                        )}
                      >
                        {isTimerRunning ? "Pausa" : "Avvia"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Tempo Impiegato (minuti)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={callData.duration_minutes}
                      onChange={(e) => setCallData({ ...callData, duration_minutes: e.target.value })}
                      className="w-full px-5 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-bold"
                      placeholder="Minuti impiegati..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Tipo Chiamante</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['cliente', 'fornitore', 'esterno'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setCallData({ ...callData, caller_type: type, caller: '', clientId: '', supplierId: '' })}
                          className={cn(
                            "py-2 rounded-xl text-[10px] font-bold border transition-all capitalize",
                            callData.caller_type === type 
                              ? "bg-[#5A5A40] text-white border-[#5A5A40]" 
                              : "bg-[#F9FAFB] text-[#1A1A1A]/60 border-[#E5E7EB] hover:border-[#5A5A40]/30"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">
                      {callData.caller_type === 'cliente' ? 'Seleziona Cliente *' : 
                       callData.caller_type === 'fornitore' ? 'Seleziona Fornitore *' : 
                       'Chi ha chiamato? *'}
                    </label>
                    {callData.caller_type === 'esterno' ? (
                      <input 
                        required
                        type="text" 
                        value={callData.caller}
                        onChange={(e) => setCallData({...callData, caller: e.target.value})}
                        className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-bold"
                        placeholder="Nome del chiamante..."
                      />
                    ) : callData.caller_type === 'cliente' ? (
                      <select
                        required
                        value={callData.clientId}
                        onChange={(e) => {
                          const client = clients.find(c => c.id.toString() === e.target.value);
                          setCallData({
                            ...callData, 
                            clientId: e.target.value, 
                            caller: client ? client.name : ''
                          });
                        }}
                        className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-bold"
                      >
                        <option value="">Seleziona cliente...</option>
                        {(Array.isArray(clients) ? clients : []).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        required
                        value={callData.supplierId}
                        onChange={(e) => {
                          const supplierList = Array.isArray(suppliers) ? suppliers : [];
                          const supplier = supplierList.find(s => s && s.id && s.id.toString() === e.target.value);
                          setCallData({
                            ...callData, 
                            supplierId: e.target.value, 
                            caller: supplier ? supplier.name : ''
                          });
                        }}
                        className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-bold"
                      >
                        <option value="">Seleziona fornitore...</option>
                        {(Array.isArray(suppliers) ? suppliers : []).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Motivo della chiamata</label>
                    <textarea 
                      value={callData.reason}
                      onChange={(e) => setCallData({...callData, reason: e.target.value})}
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-medium h-24 resize-none"
                      placeholder="Dettagli della chiamata..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Categoria Chiamata</label>
                    <select 
                      value={callData.categoryId}
                      onChange={(e) => setCallData({...callData, categoryId: e.target.value})}
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-bold"
                    >
                      <option value="">Seleziona categoria...</option>
                      {categories.filter(c => !c.parent_id).map(c => (
                        <optgroup key={c.id} label={c.name}>
                          <option value={c.id}>{c.name} (Generale)</option>
                          {categories.filter(sub => sub.parent_id === c.id).map(sub => (
                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <button 
                    type="submit"
                    disabled={isLoggingCall}
                    className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                  >
                    <Save size={18} /> {isLoggingCall ? 'Registrazione...' : 'Registra Chiamata'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
