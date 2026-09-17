import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Clock, 
  User, 
  Tag,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  Users,
  Briefcase,
  Truck,
  Trash2,
  Phone,
  AlertTriangle
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Task, TaskStatus, User as UserType, Category } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import Toast, { ToastType } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function TaskList({ user: currentUser }: { user: UserType | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  const [searchParams] = useSearchParams();
  
  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'Tutti'>('Tutti');
  const [userFilter, setUserFilter] = useState<number | 'Tutti'>('Tutti');
  const [macroCategoryFilter, setMacroCategoryFilter] = useState<number | 'Tutti'>('Tutti');
  const [clientFilter, setClientFilter] = useState<number | 'Tutti'>(searchParams.get('clientId') ? Number(searchParams.get('clientId')) : 'Tutti');
  const [supplierFilter, setSupplierFilter] = useState<number | 'Tutti'>(searchParams.get('supplierId') ? Number(searchParams.get('supplierId')) : 'Tutti');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Toast & Modal State
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false
  });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; task: Task | null }>({
    open: false,
    task: null
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
  };

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (userFilter !== 'Tutti') params.append('userId', userFilter.toString());
      if (macroCategoryFilter !== 'Tutti') params.append('macroCategoryId', macroCategoryFilter.toString());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter !== 'Tutti') params.append('status', statusFilter);
      if (search) params.append('search', search);
      if (clientFilter !== 'Tutti') params.append('clientId', clientFilter.toString());
      if (supplierFilter !== 'Tutti') params.append('supplierId', supplierFilter.toString());
      
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/tasks${query}`);
      const data = await res.json();
      setTasks(data);
      setLoading(false);
    };

    fetchTasks();
  }, [userFilter, macroCategoryFilter, startDate, endDate, statusFilter, search, clientFilter, supplierFilter]);

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then(res => res.json()),
      fetch('/api/categories').then(res => res.json())
    ]).then(([usersData, catsData]) => {
      setUsers(usersData);
      setCategories(catsData);
    });
  }, []);

  const filteredTasks = tasks; // Filtering is now handled on the server side

  const handleDelete = (task: Task) => {
    if (currentUser?.role !== 'admin' && task.creator_id !== currentUser?.id) {
      showToast('Non hai i permessi per eliminare questo elemento.', 'error');
      return;
    }
    setConfirmModal({ open: true, task });
  };

  const confirmDelete = async () => {
    const task = confirmModal.task;
    if (!task) return;

    try {
      const endpoint = task.activity_source === 'call' ? `/api/calls/${task.id}` : `/api/tasks/${task.id}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== task.id || t.activity_source !== task.activity_source));
        showToast('Elemento eliminato con successo', 'success');
        setConfirmModal({ open: false, task: null });
      } else {
        const data = await res.json();
        showToast(data.error || 'Errore durante l\'eliminazione', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Errore di connessione', 'error');
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'Nuovo': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'In Corso': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'In Attesa': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Completato': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Annullato': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif font-bold text-[#111827]">Gestione Attività</h1>
          <p className="text-[#6B7280] text-sm font-medium">Monitora e gestisci le attività del team in tempo reale.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1.5 rounded-2xl border border-[#E5E7EB] flex shadow-sm">
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2.5 rounded-xl transition-all duration-200", 
                viewMode === 'list' 
                  ? "bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20" 
                  : "text-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#5A5A40]"
              )}
            >
              <ListIcon size={20} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2.5 rounded-xl transition-all duration-200", 
                viewMode === 'grid' 
                  ? "bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20" 
                  : "text-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#5A5A40]"
              )}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
          <Link 
            to="/tasks/new"
            className="bg-[#5A5A40] text-white px-6 py-3.5 rounded-2xl flex items-center gap-2 font-bold hover:bg-[#4A4A30] transition-all shadow-xl shadow-[#5A5A40]/20 active:scale-95"
          >
            <Plus size={20} /> Nuova Attività
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-[#E5E7EB] shadow-sm space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px] relative group">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#5A5A40] transition-colors" />
            <input 
              type="text" 
              placeholder="Cerca per titolo, descrizione, cliente o fornitore..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] transition-all outline-none"
            />
          </div>
          
          <div className="flex items-center gap-3 bg-[#F9FAFB] px-4 py-2 rounded-2xl border border-[#E5E7EB]">
            <Filter size={18} className="text-[#5A5A40]" />
            <select 
              value={statusFilter || 'Tutti'}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent border-none outline-none text-sm font-bold text-[#111827] cursor-pointer pr-8"
            >
              <option value="Tutti">Tutti gli stati</option>
              <option value="Nuovo">Nuovo</option>
              <option value="In Corso">In Corso</option>
              <option value="In Attesa">In Attesa</option>
              <option value="Completato">Completato</option>
              <option value="Annullato">Annullato</option>
            </select>
          </div>

          <div className="flex items-center gap-3 bg-[#F9FAFB] px-4 py-2 rounded-2xl border border-[#E5E7EB]">
            <Briefcase size={18} className="text-[#5A5A40]" />
            <select 
              value={macroCategoryFilter ?? 'Tutti'}
              onChange={(e) => setMacroCategoryFilter(e.target.value === 'Tutti' ? 'Tutti' : Number(e.target.value))}
              className="bg-transparent border-none outline-none text-sm font-bold text-[#111827] cursor-pointer pr-8"
            >
              <option value="Tutti">Macro Categorie</option>
              {categories.filter(c => !c.parent_id).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 bg-[#F9FAFB] px-4 py-2 rounded-2xl border border-[#E5E7EB]">
            <User size={18} className="text-[#5A5A40]" />
            <select 
              value={userFilter ?? 'Tutti'}
              onChange={(e) => setUserFilter(e.target.value === 'Tutti' ? 'Tutti' : Number(e.target.value))}
              className="bg-transparent border-none outline-none text-sm font-bold text-[#111827] cursor-pointer pr-8"
            >
              <option value="Tutti">Assegnato a</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[#1A1A1A]/5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40">Dal:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#F5F5F0] border-none rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40">Al:</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#F5F5F0] border-none rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20"
            />
          </div>
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs font-medium text-[#5A5A40] hover:underline underline-offset-4"
            >
              Resetta date
            </button>
          )}
        </div>
      </div>

      {/* Task List/Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[#1A1A1A]/40 font-medium">Caricamento attività...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#1A1A1A]/20 py-20 text-center">
          <div className="bg-[#F5F5F0] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-[#1A1A1A]/20">
            <Search size={32} />
          </div>
          <h3 className="text-lg font-bold">Nessun'attività trovata</h3>
          <p className="text-[#1A1A1A]/40">Prova a cambiare i filtri o crea una nuova attività.</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/5 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F5F5F0]/50 border-b border-[#1A1A1A]/5">
              <tr>
                <th className="p-4 text-xs uppercase tracking-widest font-bold text-[#1A1A1A]/40">Attività</th>
                <th className="p-4 text-xs uppercase tracking-widest font-bold text-[#1A1A1A]/40">Categoria</th>
                <th className="p-4 text-xs uppercase tracking-widest font-bold text-[#1A1A1A]/40">Assegnato a</th>
                <th className="p-4 text-xs uppercase tracking-widest font-bold text-[#1A1A1A]/40">Stato</th>
                <th className="p-4 text-xs uppercase tracking-widest font-bold text-[#1A1A1A]/40">Scadenza</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {filteredTasks.map((task) => (
                <tr key={`${task.activity_source}-${task.id}`} className="hover:bg-[#F5F5F0]/30 transition-colors group">
                  <td className="p-4">
                    {task.activity_source === 'call' ? (
                      <div className="block">
                        <div className="font-medium text-[#1A1A1A]/60 italic">{task.title}</div>
                        <div className="text-xs text-[#1A1A1A]/40 mt-1 flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <Phone size={12} />
                            <span>Chiamata Registrata • {Math.floor((task.call_duration || 0) / 60)}m {(task.call_duration || 0) % 60}s</span>
                          </div>
                          {task.description && (
                            <div className="text-[11px] bg-[#F5F5F0] p-1.5 rounded-lg border border-[#1A1A1A]/5 italic">
                              "{task.description}"
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Link to={`/tasks/${task.id}`} className="block">
                        <div className="font-medium group-hover:text-[#5A5A40] transition-colors">{task.title}</div>
                        <div className="text-xs text-[#1A1A1A]/40 mt-0.5 flex items-center gap-1">
                          {task.type === 'cliente' ? <Users size={12} /> : task.type === 'fornitore' ? <Truck size={12} /> : task.type === 'chiamata' ? <Phone size={12} /> : <Briefcase size={12} />}
                          {task.type === 'cliente' ? task.client_name : task.type === 'fornitore' ? task.supplier_name : task.type === 'chiamata' ? 'Chiamata Registrata' : 'Attività Interna'}
                        </div>
                      </Link>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-xs px-2 py-1 bg-[#F5F5F0] rounded-lg text-[#1A1A1A]/60 font-medium">
                      {task.category_name || 'Nessuna'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40] text-[10px] font-bold">
                        {task.assignee_name?.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-sm">{task.assignee_name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      "text-xs px-3 py-1 rounded-full border font-medium",
                      getStatusColor(task.status)
                    )}>
                      {task.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-sm text-[#1A1A1A]/60">
                      <Clock size={14} />
                      {task.deadline ? format(new Date(task.deadline), 'dd MMM', { locale: it }) : '-'}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      id={`delete-task-${task.id}`}
                      onClick={() => handleDelete(task)}
                      className="p-2 hover:bg-rose-50 rounded-lg text-rose-300 hover:text-rose-500 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => (
            <motion.div
              layout
              key={`${task.activity_source}-${task.id}`}
              className="bg-white p-6 rounded-2xl border border-[#1A1A1A]/5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className={cn(
                "absolute top-0 left-0 w-1 h-full",
                task.status === 'Nuovo' ? "bg-blue-500" :
                task.status === 'In Corso' ? "bg-amber-500" :
                task.status === 'In Attesa' ? "bg-rose-500" :
                task.status === 'Annullato' ? "bg-gray-500" : "bg-emerald-500"
              )} />
              
              <div className="flex justify-between items-start mb-4">
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border",
                  getStatusColor(task.status)
                )}>
                  {task.status}
                </span>
                <button 
                  id={`grid-delete-task-${task.id}`}
                  onClick={() => handleDelete(task)}
                  className="text-rose-300 hover:text-rose-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {task.activity_source === 'call' ? (
                <div className="mb-4">
                  <h3 className="font-bold text-lg mb-1 text-[#1A1A1A]/60 italic line-clamp-1">{task.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-[#1A1A1A]/40 mb-2">
                    <Phone size={12} />
                    <span>Chiamata • {Math.floor((task.call_duration || 0) / 60)}m {(task.call_duration || 0) % 60}s</span>
                  </div>
                  <p className="text-sm text-[#1A1A1A]/50 line-clamp-2 mb-4 leading-relaxed italic bg-[#F5F5F0] p-2 rounded-xl border border-[#1A1A1A]/5">
                    {task.description ? `"${task.description}"` : 'Nessun motivo registrato.'}
                  </p>
                </div>
              ) : (
                <Link to={`/tasks/${task.id}`}>
                  <h3 className="font-bold text-lg mb-2 group-hover:text-[#5A5A40] transition-colors line-clamp-1">{task.title}</h3>
                  <p className="text-sm text-[#1A1A1A]/50 line-clamp-2 mb-4 leading-relaxed">
                    {task.description || 'Nessuna descrizione fornita.'}
                  </p>
                </Link>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-[#1A1A1A]/5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#5A5A40] flex items-center justify-center text-white text-[10px] font-bold">
                    {task.assignee_name?.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">{task.assignee_name}</span>
                    <span className="text-[10px] text-[#1A1A1A]/40 uppercase">{task.category_name}</span>
                  </div>
                </div>
                {task.deadline && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-[#1A1A1A]/40 font-bold">Scadenza</div>
                    <div className="text-xs font-medium">{format(new Date(task.deadline), 'dd/MM/yyyy')}</div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, task: null })}
        onConfirm={confirmDelete}
        title="Conferma Eliminazione"
        message={`Sei sicuro di voler eliminare "${confirmModal.task?.title}"? Questa operazione non può essere annullata.`}
        confirmText="Elimina"
        type="danger"
      />

      <Toast
        isVisible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </motion.div>
  );
}

