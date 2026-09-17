import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Tag as TagIcon, 
  Paperclip, 
  MessageSquare, 
  History,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  MoreVertical,
  Calendar,
  X,
  Truck,
  Plus,
  ChevronRight,
  Briefcase,
  Users,
  Trash2,
  AlertTriangle,
  Pencil,
  Check,
  Edit2
} from 'lucide-react';
import { Task, TaskHistory, Attachment, User as UserType, Tag } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { AnimatePresence } from 'motion/react';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<(Task & { history: TaskHistory[], attachments: Attachment[], tags: Tag[] }) | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info', visible: boolean }>({ message: '', type: 'info', visible: false });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean, title: string, message: string, onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, visible: true });
  };
  const [newDeadline, setNewDeadline] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'attachments'>('info');

  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [tempDuration, setTempDuration] = useState('0');

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    fetchTask(true);
    fetchNotes();
    fetch('/api/users').then(res => res.json()).then(setUsers);
  }, [id]);

  const fetchNotes = () => {
    fetch(`/api/tasks/${id}/notes`)
      .then(res => res.json())
      .then(setNotes)
      .catch(err => console.error('Fetch notes error:', err));
  };

  const fetchTask = (isInitial = false) => {
    if (isInitial) setLoading(true);
    fetch(`/api/tasks/${id}`)
      .then(res => res.json())
      .then(data => {
        setTask(data);
        setNewDeadline(data.deadline ? data.deadline.split('T')[0] : '');
        setTempDuration(data.duration_minutes !== undefined && data.duration_minutes !== null ? data.duration_minutes.toString() : '0');
        if (isInitial) setLoading(false);
      })
      .catch(err => {
        console.error('Fetch task error:', err);
        if (isInitial) setLoading(false);
      });
  };

  const updateTask = async (updates: any) => {
    setIsUpdating(true);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      fetchTask();
      setShowPauseModal(false);
      setShowReassignModal(false);
      setShowDeadlineModal(false);
    } catch (error) {
      console.error('Update error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = (status: string, reason?: string) => {
    updateTask({ status, pause_reason: reason });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote })
      });
      if (res.ok) {
        setNewNote('');
        fetchNotes();
        showToast('Nota aggiunta', 'success');
      }
    } catch (error) {
      console.error('Add note error:', error);
    }
  };

  const handleUpdateNote = async (noteId: number) => {
    if (!editingNoteContent.trim()) return;
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingNoteContent })
      });
      if (res.ok) {
        setEditingNoteId(null);
        fetchNotes();
        showToast('Nota aggiornata', 'success');
      }
    } catch (error) {
      console.error('Update note error:', error);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    setConfirmModal({
      open: true,
      title: 'Elimina Nota',
      message: 'Sei sicuro di voler eliminare questa nota?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
          if (res.ok) {
            fetchNotes();
            showToast('Nota eliminata', 'success');
          }
        } catch (error) {
          console.error('Delete note error:', error);
        }
      }
    });
  };

  const handleDelete = async () => {
    setConfirmModal({
      open: true,
      title: 'Elimina Attività',
      message: 'Sei sicuro di voler eliminare questa attività? Questa azione non può essere annullata.',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
          if (res.ok) {
            navigate('/tasks');
          } else {
            const data = await res.json();
            showToast(data.error || 'Errore durante l\'eliminazione', 'error');
          }
        } catch (error) {
          console.error('Delete error:', error);
          showToast('Errore di connessione', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to small JPEGs (e.g., < 2MB)
    if (file.type !== 'image/jpeg') {
      showToast('Per favore carica solo file JPEG.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Il file è troppo grande. Massimo 2MB.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/tasks/${id}/attachments`, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        fetchTask();
      } else {
        console.error('Upload failed');
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      console.error('Upload error');
    };

    xhr.send(formData);
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    setConfirmModal({
      open: true,
      title: 'Elimina Allegato',
      message: 'Sei sicuro di voler eliminare questo allegato?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/tasks/${id}/attachments/${attachmentId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            fetchTask();
            showToast('Allegato eliminato', 'success');
          } else {
            showToast('Errore durante l\'eliminazione', 'error');
          }
        } catch (error) {
          console.error('Delete attachment error:', error);
          showToast('Errore di connessione', 'error');
        }
      }
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5A5A40] border-t-transparent"></div>
    </div>
  );
  if (!task) return <div className="text-center py-20 text-[#6B7280] font-bold">Attività non trovata.</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-5xl mx-auto space-y-8 pb-20"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors group font-bold text-sm"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Torna indietro
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {task.status !== 'Completato' && task.status !== 'Annullato' && (
            <>
              {task.status === 'Nuovo' && (
                <button 
                  onClick={() => updateStatus('In Corso')}
                  className="flex items-center gap-2 bg-[#5A5A40] text-white px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20"
                >
                  <Play size={16} /> Prendi in carico
                </button>
              )}
              {task.status === 'In Corso' && (
                <button 
                  onClick={() => setShowPauseModal(true)}
                  className="flex items-center gap-2 bg-rose-50 text-rose-700 px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-rose-100 transition-all border border-rose-100"
                >
                  <Pause size={16} /> Metti in pausa
                </button>
              )}
              {task.status === 'In Attesa' && (
                <button 
                  onClick={() => updateStatus('In Corso')}
                  className="flex items-center gap-2 bg-amber-50 text-amber-700 px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-amber-100 transition-all border border-amber-100"
                >
                  <Play size={16} /> Riprendi
                </button>
              )}
              <button 
                onClick={() => updateStatus('Completato')}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-emerald-100 transition-all border border-emerald-100"
              >
                <CheckCircle2 size={16} /> Completa
              </button>
            </>
          )}
          <div className="relative group/menu">
            <button className="p-2.5 hover:bg-[#F3F4F6] rounded-2xl text-[#9CA3AF] hover:text-[#111827] transition-all border border-transparent hover:border-[#E5E7EB]">
              <MoreVertical size={20} />
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] py-2 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50">
              <button 
                onClick={() => updateStatus('Annullato')}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <X size={16} /> Annulla attività
              </button>
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 size={16} /> Elimina Attività
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-10 rounded-[2.5rem] border border-[#E5E7EB] shadow-sm space-y-8 relative overflow-hidden">
            <div className="space-y-4 relative z-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-lg border",
                  task.status === 'Nuovo' ? "bg-blue-50 text-blue-700 border-blue-100" :
                  task.status === 'In Corso' ? "bg-amber-50 text-amber-700 border-amber-100" :
                  task.status === 'In Attesa' ? "bg-rose-50 text-rose-700 border-rose-100" :
                  task.status === 'Annullato' ? "bg-gray-50 text-gray-700 border-gray-100" :
                  "bg-emerald-50 text-emerald-700 border-emerald-100"
                )}>
                  {task.status}
                </span>
                <span className="text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-lg border bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB]">
                  {task.category_name}
                </span>
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-lg border",
                  task.priority === 'Urgente' ? "bg-rose-600 text-white border-rose-600" :
                  task.priority === 'Alta' ? "bg-orange-100 text-orange-700 border-orange-200" :
                  task.priority === 'Media' ? "bg-blue-100 text-blue-700 border-blue-200" :
                  "bg-slate-100 text-slate-600 border-slate-200"
                )}>
                  Priorità {task.priority}
                </span>
              </div>
              <h1 className="text-4xl font-serif font-bold leading-tight text-[#111827]">{task.title}</h1>
            </div>

            <div className="prose prose-sm max-w-none text-[#4B5563] leading-relaxed whitespace-pre-wrap font-medium text-base">
              {task.description || 'Nessuna descrizione fornita per questa attività.'}
            </div>

            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4">
                {task.tags.map(tag => (
                  <span key={tag.id} className="px-3 py-1 bg-[#F3F4F6] text-[#6B7280] text-[10px] font-bold rounded-full border border-[#E5E7EB]">
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 pt-8 border-t border-[#F3F4F6]">
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-[#9CA3AF]">Assegnato a</span>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#5A5A40] flex items-center justify-center text-white text-xs font-black shadow-lg shadow-[#5A5A40]/20">
                    {task.assignee_name?.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="font-bold text-[#111827]">{task.assignee_name}</span>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-[#9CA3AF]">Scadenza</span>
                <div className="flex items-center gap-3 font-bold text-[#111827]">
                  <div className="p-2 bg-[#F9FAFB] rounded-xl text-[#5A5A40]">
                    <Calendar size={20} />
                  </div>
                  {task.deadline ? format(new Date(task.deadline), 'dd MMMM yyyy', { locale: it }) : 'Nessuna scadenza'}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-[#9CA3AF]">Soggetto</span>
                <div className="flex items-center gap-3 font-bold text-[#111827]">
                  <div className="p-2 bg-[#F9FAFB] rounded-xl text-[#5A5A40]">
                    {task.type === 'cliente' ? <Users size={20} /> : task.type === 'fornitore' ? <Truck size={20} /> : <Briefcase size={20} />}
                  </div>
                  {task.type === 'cliente' ? task.client_name : task.type === 'fornitore' ? task.supplier_name : 'Attività Interna'}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-[#9CA3AF]">Tempo Impiegato</span>
                <div className="flex items-center gap-3 font-bold text-[#111827]">
                  <div className="p-2 bg-[#F9FAFB] rounded-xl text-[#5A5A40]">
                    <Clock size={20} />
                  </div>
                  {isEditingDuration ? (
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="number" 
                        min="0"
                        value={tempDuration}
                        onChange={(e) => setTempDuration(e.target.value)}
                        className="w-16 px-2 py-1.5 border border-[#E5E7EB] rounded-xl text-xs outline-none focus:border-[#5A5A40] text-[#111827] font-bold"
                        autoFocus
                      />
                      <button 
                        onClick={() => {
                          updateTask({ duration_minutes: Number(tempDuration) });
                          setIsEditingDuration(false);
                          showToast('Tempo aggiornato con successo', 'success');
                        }}
                        className="p-1.5 bg-[#5A5A40] text-white rounded-lg hover:bg-[#4A4A30] transition-colors"
                        title="Salva"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          setTempDuration(task.duration_minutes !== undefined && task.duration_minutes !== null ? task.duration_minutes.toString() : '0');
                          setIsEditingDuration(false);
                        }}
                        className="p-1.5 bg-[#F3F4F6] text-[#6B7280] rounded-lg hover:bg-[#E5E7EB] transition-colors"
                        title="Annulla"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group/duration">
                      <span>{task.duration_minutes || 0} min</span>
                      <button 
                        onClick={() => setIsEditingDuration(true)}
                        className="opacity-100 sm:opacity-0 group-hover/duration:opacity-100 p-1 hover:bg-[#F3F4F6] rounded-lg transition-all text-[#5A5A40]"
                        title="Modifica tempo"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="space-y-4">
            <div className="flex items-center gap-8 border-b border-[#E5E7EB] px-6 overflow-x-auto no-scrollbar">
              {[
                { id: 'info', label: 'Dettagli', icon: FileText },
                { id: 'history', label: 'Cronologia', icon: History },
                { id: 'attachments', label: 'Allegati', icon: Paperclip },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 py-5 text-sm font-black transition-all relative whitespace-nowrap",
                    activeTab === tab.id ? "text-[#5A5A40]" : "text-[#9CA3AF] hover:text-[#111827]"
                  )}
                >
                  <tab.icon size={18} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#5A5A40] rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-[#E5E7EB] shadow-sm min-h-[300px]">
              {activeTab === 'info' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] flex items-center gap-2">
                        <User size={18} className="text-[#5A5A40]" />
                        Entità Associata
                      </h3>
                      {task.client_id ? (
                        <div className="p-6 bg-[#F9FAFB] rounded-3xl border border-[#E5E7EB] group hover:border-[#5A5A40]/30 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase text-[#5A5A40] bg-[#5A5A40]/10 px-2 py-0.5 rounded">Cliente</span>
                            <span className="text-[10px] font-bold text-[#9CA3AF]">#{task.client_id}</span>
                          </div>
                          <div className="font-black text-lg text-[#111827]">{task.client_name}</div>
                          <Link to="/clients" className="text-xs text-[#5A5A40] font-black mt-4 flex items-center gap-1 hover:gap-2 transition-all">
                            Vedi scheda completa <ChevronRight size={14} />
                          </Link>
                        </div>
                      ) : task.supplier_id ? (
                        <div className="p-6 bg-[#F9FAFB] rounded-3xl border border-[#E5E7EB] group hover:border-[#5A5A40]/30 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Fornitore</span>
                            <span className="text-[10px] font-bold text-[#9CA3AF]">#{task.supplier_id}</span>
                          </div>
                          <div className="font-black text-lg text-[#111827]">{task.supplier_name}</div>
                          <Link to="/suppliers" className="text-xs text-[#5A5A40] font-black mt-4 flex items-center gap-1 hover:gap-2 transition-all">
                            Vedi scheda completa <ChevronRight size={14} />
                          </Link>
                        </div>
                      ) : (
                        <div className="p-8 bg-[#F9FAFB] rounded-3xl border border-dashed border-[#E5E7EB] text-center">
                          <Briefcase size={24} className="mx-auto text-[#D1D5DB] mb-2" />
                          <p className="text-xs font-bold text-[#9CA3AF]">Attività interna Connect</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] flex items-center gap-2">
                        <TagIcon size={18} className="text-[#5A5A40]" />
                        Metadati di Sistema
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-[#F9FAFB] rounded-2xl">
                          <span className="text-xs font-bold text-[#6B7280]">Data Creazione</span>
                          <span className="text-xs font-black text-[#111827]">{format(new Date(task.created_at), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-[#F9FAFB] rounded-2xl">
                          <span className="text-xs font-bold text-[#6B7280]">Ultimo Aggiornamento</span>
                          <span className="text-xs font-black text-[#111827]">{format(new Date(task.updated_at), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-[#F9FAFB] rounded-2xl">
                          <span className="text-xs font-bold text-[#6B7280]">Tipologia</span>
                          <span className="text-xs font-black text-[#111827] uppercase tracking-wider">{task.type}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-8">
                  {task.history.map((item, i) => (
                    <div key={item.id} className="flex gap-6 group">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-4 border-white shadow-sm ring-2 mt-1",
                          i === 0 ? "ring-[#5A5A40] bg-[#5A5A40]" : "ring-[#E5E7EB] bg-[#D1D5DB]"
                        )} />
                        {i !== task.history.length - 1 && (
                          <div className="w-0.5 flex-1 bg-[#F3F4F6] my-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-black text-[#111827] capitalize">{item.action}</span>
                          <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{format(new Date(item.timestamp), 'dd MMM, HH:mm', { locale: it })}</span>
                        </div>
                        <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB]">
                          <p className="text-sm font-medium text-[#4B5563]">{item.details}</p>
                          {item.user_name && (
                            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#E5E7EB]">
                              <div className="w-4 h-4 rounded-full bg-[#D1D5DB] flex items-center justify-center text-[8px] font-black text-white">
                                {item.user_name.charAt(0)}
                              </div>
                              <span className="text-[10px] font-black text-[#9CA3AF]">Eseguito da {item.user_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'attachments' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#111827]">File e Documentazione</h3>
                    <label className="cursor-pointer bg-[#5A5A40] hover:bg-[#4A4A30] text-white px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-[#5A5A40]/20 disabled:opacity-50">
                      {uploadProgress !== null ? (
                        <>Caricamento {uploadProgress}%</>
                      ) : (
                        <>
                          <Plus size={16} /> Carica JPEG
                        </>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={handleFileUpload} 
                        accept="image/jpeg"
                        disabled={uploadProgress !== null}
                      />
                    </label>
                  </div>

                  {task.attachments.length === 0 ? (
                    <div className="py-16 text-center bg-[#F9FAFB] rounded-[2rem] border border-dashed border-[#E5E7EB]">
                      <Paperclip size={32} className="mx-auto text-[#D1D5DB] mb-3" />
                      <p className="text-sm font-bold text-[#9CA3AF]">Nessun allegato presente.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {task.attachments.map(att => (
                        <div key={att.id} className="p-5 bg-white rounded-3xl border border-[#E5E7EB] shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                          <div className="p-3 bg-[#F9FAFB] rounded-2xl text-[#5A5A40] group-hover:bg-[#5A5A40] group-hover:text-white transition-colors">
                            {att.file_type?.startsWith('image/') ? <ImageIcon size={24} /> : <FileText size={24} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-black text-[#111827] truncate">{att.file_name}</div>
                            <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-1">{format(new Date(att.created_at), 'dd/MM/yyyy')}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a 
                              href={att.file_path} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-2.5 bg-[#F9FAFB] hover:bg-[#5A5A40]/10 rounded-xl text-[#9CA3AF] hover:text-[#5A5A40] transition-all"
                            >
                              <ArrowLeft size={18} className="rotate-180" />
                            </a>
                            <button 
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-2.5 bg-[#F9FAFB] hover:bg-red-50 rounded-xl text-[#9CA3AF] hover:text-red-500 transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-[#E5E7EB] shadow-sm space-y-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#111827]">Azioni Rapide</h3>
            <div className="space-y-3">
              <button 
                onClick={() => setShowReassignModal(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-[#F9FAFB] transition-all text-sm font-bold text-[#374151] group border border-transparent hover:border-[#E5E7EB]"
              >
                <div className="flex items-center gap-3">
                  <User size={18} className="text-[#5A5A40]" /> Riassegna Attività
                </div>
                <ChevronRight size={14} className="text-[#D1D5DB] group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => setShowDeadlineModal(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-[#F9FAFB] transition-all text-sm font-bold text-[#374151] group border border-transparent hover:border-[#E5E7EB]"
              >
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-[#5A5A40]" /> Cambia Scadenza
                </div>
                <ChevronRight size={14} className="text-[#D1D5DB] group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-rose-50 text-rose-600 transition-all text-sm font-bold group border border-transparent hover:border-rose-100"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={18} /> Elimina Attività
                </div>
                <ChevronRight size={14} className="text-rose-300 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="bg-[#5A5A40] p-8 rounded-[2.5rem] text-white shadow-xl space-y-6 relative overflow-hidden flex flex-col h-[600px]">
            <div className="relative z-10 space-y-4 flex flex-col h-full">
              <div className="flex items-center justify-between font-black uppercase tracking-tighter text-sm">
                <div className="flex items-center gap-2">
                  <MessageSquare size={20} className="text-white/80" />
                  <span>Note Interne</span>
                </div>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{notes.length}</span>
              </div>

              {/* Notes Thread */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {notes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/40 space-y-2">
                    <MessageSquare size={32} />
                    <p className="text-xs font-bold">Nessuna nota interna</p>
                  </div>
                ) : (
                  notes.map(note => (
                    <div key={note.id} className="group/note space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-black">
                            {note.user_name?.charAt(0)}
                          </div>
                          <span className="text-[10px] font-black text-white/80">{note.user_name}</span>
                        </div>
                        <span className="text-[8px] font-bold text-white/40">
                          {format(new Date(note.created_at), 'dd/MM HH:mm')}
                        </span>
                      </div>
                      
                      <div className="bg-white/10 rounded-2xl p-4 relative group">
                        {editingNoteId === note.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingNoteContent}
                              onChange={(e) => setEditingNoteContent(e.target.value)}
                              className="w-full bg-white/10 border-none rounded-xl p-2 text-xs font-medium text-white outline-none resize-none h-20"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setEditingNoteId(null)}
                                className="text-[10px] font-black text-white/60 hover:text-white"
                              >
                                Annulla
                              </button>
                              <button 
                                onClick={() => handleUpdateNote(note.id)}
                                className="text-[10px] font-black text-amber-300 hover:text-amber-200"
                              >
                                Salva
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-white/90 leading-relaxed whitespace-pre-wrap">
                              {note.content}
                            </p>
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteContent(note.content);
                                }}
                                className="p-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                              >
                                <Pencil size={12} />
                              </button>
                              <button 
                                onClick={() => handleDeleteNote(note.id)}
                                className="p-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-rose-400 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Input */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <textarea 
                  placeholder="Aggiungi una nota privata..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                  className="w-full bg-white/10 border-none rounded-2xl p-4 text-sm font-medium placeholder:text-white/40 focus:ring-4 focus:ring-white/10 h-24 resize-none outline-none"
                ></textarea>
                <button 
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="w-full bg-white text-[#5A5A40] py-3 rounded-2xl text-sm font-black hover:bg-white/90 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Invia Nota
                </button>
              </div>
            </div>
            <div className="absolute -left-10 -top-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
          </div>
        </div>
      </div>

      {/* Pause Modal */}
      <AnimatePresence>
        {showPauseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-[#111827]">Metti in pausa</h3>
                  <p className="text-sm font-medium text-[#6B7280] mt-1">Specifica il motivo della sospensione.</p>
                </div>
                <button onClick={() => setShowPauseModal(false)} className="p-3 hover:bg-[#F9FAFB] rounded-2xl text-[#9CA3AF] transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-3">
                {[
                  'Attesa risposta cliente',
                  'Mancanza informazioni',
                  'Attesa materiale',
                  'Priorità diversa'
                ].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setPauseReason(reason)}
                    className={cn(
                      "w-full text-left p-5 rounded-2xl border-2 transition-all text-sm font-bold",
                      pauseReason === reason 
                        ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-lg shadow-[#5A5A40]/20" 
                        : "bg-[#F9FAFB] border-transparent text-[#4B5563] hover:border-[#5A5A40]/30"
                    )}
                  >
                    {reason}
                  </button>
                ))}
                <div className="pt-2">
                  <textarea
                    placeholder="Altro motivo specifico..."
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-5 text-sm font-medium text-[#111827] focus:ring-4 focus:ring-[#5A5A40]/10 outline-none h-32 resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setShowPauseModal(false)}
                  className="flex-1 py-4 rounded-2xl text-sm font-black border-2 border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] transition-all"
                >
                  Annulla
                </button>
                <button 
                  onClick={() => updateStatus('In Attesa', pauseReason)}
                  disabled={!pauseReason || isUpdating}
                  className="flex-1 py-4 rounded-2xl text-sm font-black bg-rose-600 text-white hover:bg-rose-700 transition-all disabled:opacity-50 shadow-xl shadow-rose-600/20"
                >
                  Conferma Sospensione
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reassign Modal */}
      <AnimatePresence>
        {showReassignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-[#111827]">Riassegna Task</h3>
                  <p className="text-sm font-medium text-[#6B7280] mt-1">Seleziona il nuovo responsabile.</p>
                </div>
                <button onClick={() => setShowReassignModal(false)} className="p-3 hover:bg-[#F9FAFB] rounded-2xl text-[#9CA3AF] transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => updateTask({ assignee_id: u.id })}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border-2 transition-all text-sm font-bold flex items-center gap-3",
                      task.assignee_id === u.id 
                        ? "bg-[#5A5A40] text-white border-[#5A5A40]" 
                        : "bg-[#F9FAFB] border-transparent text-[#4B5563] hover:border-[#5A5A40]/30"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                      {u.name.charAt(0)}
                    </div>
                    {u.name}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deadline Modal */}
      <AnimatePresence>
        {showDeadlineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-[#111827]">Cambia Scadenza</h3>
                  <p className="text-sm font-medium text-[#6B7280] mt-1">Imposta una nuova data di scadenza.</p>
                </div>
                <button onClick={() => setShowDeadlineModal(false)} className="p-3 hover:bg-[#F9FAFB] rounded-2xl text-[#9CA3AF] transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <input 
                  type="date" 
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-4 focus:ring-[#5A5A40]/10 font-bold"
                />
                <button 
                  onClick={() => updateTask({ deadline: newDeadline || null })}
                  className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-black text-sm shadow-lg shadow-[#5A5A40]/20 hover:bg-[#4A4A30] transition-all"
                >
                  Aggiorna Scadenza
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
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
