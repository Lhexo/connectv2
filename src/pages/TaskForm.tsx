import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Tag as TagIcon, 
  Calendar, 
  Briefcase, 
  Users,
  Truck,
  AlertCircle,
  X
} from 'lucide-react';
import { User as UserType, Category, Client, Supplier, Tag, TaskType, TaskPriority } from '../types';
import { cn } from '../lib/utils';

interface TaskFormProps {
  user: UserType | null;
}

export default function TaskForm({ user }: TaskFormProps) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    assignee_id: user?.id.toString() || '',
    type: 'interno' as TaskType,
    client_id: '',
    supplier_id: '',
    priority: 'Media' as TaskPriority,
    deadline: '',
    internal_notes: '',
    tags: [] as number[],
    duration_minutes: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, catsRes, clientsRes, suppliersRes, tagsRes] = await Promise.all([
          fetch('/api/users', { credentials: 'include' }),
          fetch('/api/categories', { credentials: 'include' }),
          fetch('/api/clients', { credentials: 'include' }),
          fetch('/api/suppliers', { credentials: 'include' }),
          fetch('/api/tags', { credentials: 'include' })
        ]);
        
        const [usersData, catsData, clientsData, suppliersData, tagsData] = await Promise.all([
          usersRes.json(),
          catsRes.json(),
          clientsRes.json(),
          suppliersRes.json(),
          tagsRes.json()
        ]);

        setUsers(Array.isArray(usersData) ? usersData : []);
        setCategories(Array.isArray(catsData) ? catsData : []);
        setClients(Array.isArray(clientsData) ? clientsData : []);
        setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
        setAvailableTags(Array.isArray(tagsData) ? tagsData : []);
      } catch (error) {
        console.error('Error fetching form data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          category_id: Number(formData.category_id),
          assignee_id: Number(formData.assignee_id),
          client_id: formData.type === 'cliente' ? Number(formData.client_id) : null,
          supplier_id: formData.type === 'fornitore' ? Number(formData.supplier_id) : null,
          deadline: formData.deadline || null,
          duration_minutes: formData.duration_minutes ? Number(formData.duration_minutes) : 0
        })
      });
      const data = await response.json();
      navigate(`/tasks/${data.id}`);
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const toggleTag = (tagId: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId) 
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5A5A40] border-t-transparent"></div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 pb-20"
    >
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors group font-bold text-sm"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Torna indietro
        </button>
        <div className="text-right">
          <h1 className="text-3xl font-serif font-bold text-[#111827]">Nuova Attività</h1>
          <p className="text-sm text-[#6B7280]">Compila i campi per creare una nuova attività.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[2.5rem] border border-[#E5E7EB] shadow-sm space-y-10">
        {/* Basic Info */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Titolo Attività *</label>
            <input 
              required
              type="text" 
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-5 text-xl font-bold text-[#111827] focus:ring-4 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] transition-all outline-none"
              placeholder="Cosa bisogna fare?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Descrizione</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-5 text-sm font-medium text-[#374151] focus:ring-4 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] transition-all outline-none h-40 resize-none"
              placeholder="Dettagli dell'attività, istruzioni, note..."
            ></textarea>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Note Interne (Solo Staff)</label>
            <textarea 
              value={formData.internal_notes}
              onChange={(e) => setFormData({...formData, internal_notes: e.target.value})}
              className="w-full bg-[#F5F5F0] border border-[#E5E7EB] rounded-2xl p-5 text-sm font-medium text-[#374151] focus:ring-4 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] transition-all outline-none h-32 resize-none"
              placeholder="Note visibili solo ai membri del team..."
            ></textarea>
          </div>
        </div>

        {/* Classification & Priority */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10 border-t border-[#F3F4F6]">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Categoria *</label>
            <select 
              required
              value={formData.category_id}
              onChange={(e) => setFormData({...formData, category_id: e.target.value})}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 text-sm font-bold text-[#111827] focus:ring-4 focus:ring-[#5A5A40]/10 outline-none"
            >
              <option value="">Seleziona categoria</option>
              {categories.filter(c => !c.parent_id).map(parent => (
                <optgroup key={parent.id} label={parent.name}>
                  <option value={parent.id}>{parent.name} (Generale)</option>
                  {categories.filter(c => c.parent_id === parent.id).map(child => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Assegnato a *</label>
            <select 
              required
              value={formData.assignee_id}
              onChange={(e) => setFormData({...formData, assignee_id: e.target.value})}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 text-sm font-bold text-[#111827] focus:ring-4 focus:ring-[#5A5A40]/10 outline-none"
            >
              <option value="">Seleziona utente</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Priorità *</label>
            <select 
              required
              value={formData.priority}
              onChange={(e) => setFormData({...formData, priority: e.target.value as TaskPriority})}
              className={cn(
                "w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 text-sm font-bold outline-none",
                formData.priority === 'Urgente' ? "text-rose-600" :
                formData.priority === 'Alta' ? "text-orange-600" :
                formData.priority === 'Media' ? "text-blue-600" : "text-slate-600"
              )}
            >
              <option value="Bassa">Bassa</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
        </div>

        {/* Type & Entity */}
        <div className="space-y-8 pt-10 border-t border-[#F3F4F6]">
          <div className="space-y-4">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Ambito Attività</label>
            <div className="flex flex-wrap gap-4">
              {[
                { id: 'interno', label: 'Interna', icon: Briefcase },
                { id: 'cliente', label: 'Cliente', icon: Users },
                { id: 'fornitore', label: 'Fornitore', icon: Truck }
              ].map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData({...formData, type: type.id as TaskType})}
                  className={cn(
                    "flex-1 min-w-[120px] flex items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all font-bold",
                    formData.type === type.id 
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-lg shadow-[#5A5A40]/20" 
                      : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#5A5A40]/30"
                  )}
                >
                  <type.icon size={20} /> {type.label}
                </button>
              ))}
            </div>
          </div>

          {formData.type === 'cliente' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Cliente Associato *</label>
              <select 
                required
                value={formData.client_id}
                onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 text-sm font-bold text-[#111827] focus:ring-4 focus:ring-[#5A5A40]/10 outline-none"
              >
                <option value="">Seleziona cliente</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `[Codice: ${c.code}]` : ''}
                  </option>
                ))}
              </select>
            </motion.div>
          )}

          {formData.type === 'fornitore' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Fornitore Associato *</label>
              <select 
                required
                value={formData.supplier_id}
                onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 text-sm font-bold text-[#111827] focus:ring-4 focus:ring-[#5A5A40]/10 outline-none"
              >
                <option value="">Seleziona fornitore</option>
                {(Array.isArray(suppliers) ? suppliers : []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </motion.div>
          )}
        </div>

        {/* Tags & Deadline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pt-10 border-t border-[#F3F4F6]">
          <div className="space-y-4">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Etichette / Tag</label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all border-2",
                    formData.tags.includes(tag.id)
                      ? "bg-[#5A5A40] text-white border-[#5A5A40]"
                      : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#5A5A40]/30"
                  )}
                >
                  {tag.name}
                </button>
              ))}
              {availableTags.length === 0 && (
                <p className="text-xs text-[#9CA3AF] italic">Nessun tag disponibile.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Scadenza (Opzionale)</label>
            <div className="relative">
              <Calendar size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input 
                type="date" 
                value={formData.deadline}
                onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm font-bold text-[#111827] focus:ring-4 focus:ring-[#5A5A40]/10 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">Tempo Impiegato (Minuti)</label>
            <input 
              type="number" 
              min="0"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({...formData, duration_minutes: e.target.value})}
              className="w-full px-5 py-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm font-bold text-[#111827] focus:ring-4 focus:ring-[#5A5A40]/10 outline-none"
              placeholder="Minuti impiegati..."
            />
          </div>
        </div>

        <div className="pt-10 flex flex-col sm:flex-row gap-4">
          <button 
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-5 rounded-2xl text-sm font-black border-2 border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] transition-all"
          >
            Annulla
          </button>
          <button 
            type="submit"
            className="flex-1 py-5 rounded-2xl text-sm font-black bg-[#5A5A40] text-white hover:bg-[#4A4A30] transition-all shadow-xl shadow-[#5A5A40]/20 flex items-center justify-center gap-3"
          >
            <Save size={20} /> Crea Attività
          </button>
        </div>
      </form>
    </motion.div>
  );
}
