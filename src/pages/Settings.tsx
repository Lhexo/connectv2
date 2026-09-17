import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  User as UserIcon, 
  Bell, 
  Shield, 
  Database, 
  ChevronRight,
  Palette,
  Globe,
  Save,
  Camera,
  Layers,
  Plus,
  Trash2,
  Download,
  Archive,
  FileSpreadsheet,
  AlertTriangle,
  History,
  Upload
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User, Category } from '../types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import Toast, { ToastType } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

interface SettingsProps {
  user: User | null;
  onUpdateUser: (user: User) => void;
  initialTab?: string;
}

export default function Settings({ user, onUpdateUser, initialTab = 'profilo' }: SettingsProps) {
  const isAdmin = user?.role === 'admin' || user?.role === 'amministratore';
  const [activeTab, setActiveTab] = useState(
    initialTab === 'admin' && !isAdmin ? 'profilo' : initialTab
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState<string>('');
  const [archiveDate, setArchiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [backupStartDate, setBackupStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [backupEndDate, setBackupEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    department: user?.department || '',
    avatar: user?.avatar || '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [notificationSettings, setNotificationSettings] = useState({
    task_deadline: true,
    new_task: true,
    comments: true,
    weekly_report: false
  });

  // Toast & Modal State
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false
  });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; onConfirm: () => void; title: string; message: string }>({
    open: false,
    onConfirm: () => {},
    title: '',
    message: ''
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
  };

  useEffect(() => {
    if (activeTab === 'categorie') {
      fetchCategories();
    }
    if (activeTab === 'notifiche') {
      fetchNotificationSettings();
    }
  }, [activeTab]);

  const fetchNotificationSettings = async () => {
    try {
      const res = await fetch('/api/notifications/settings');
      const data = await res.json();
      setNotificationSettings({
        task_deadline: !!data.task_deadline,
        new_task: !!data.new_task,
        comments: !!data.comments,
        weekly_report: !!data.weekly_report
      });
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    }
  };

  const handleUpdateNotification = async (key: string, value: boolean) => {
    const newSettings = { ...notificationSettings, [key]: value };
    setNotificationSettings(newSettings);
    try {
      await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleExcelExport = async () => {
    setLoading(true);
    try {
      const queryParams = (backupStartDate && backupEndDate) 
        ? `?startDate=${backupStartDate}&endDate=${backupEndDate}`
        : '';
      const res = await fetch(`/api/admin/export-excel${queryParams}`);
      if (!res.ok) throw new Error('Export fallito');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Export_Aziendale_${backupStartDate || 'Tutto'}_${backupEndDate || 'Oggi'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      showToast('File Excel esportato con successo', 'success');
    } catch (error) {
      console.error('Excel Export error:', error);
      showToast('Errore durante la generazione del file Excel', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveData = async () => {
    setConfirmModal({
      open: true,
      title: 'Conferma Archiviazione (Azzeramento)',
      message: `ATTENZIONE: Questa operazione eliminerà DEFINITIVAMENTE tutti i task, le chiamate, le note e gli allegati creati prima del ${archiveDate}. Assicurati di aver scaricato un export Excel prima di procedere. Fornitori, clienti e team non verranno toccati.`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/admin/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beforeDate: archiveDate })
          });
          const data = await res.json();
          if (res.ok) {
            showToast(`Azzeramento completato: ${data.archivedTasks} task e ${data.archivedCalls} chiamate eliminati.`, 'success');
          } else {
            showToast(data.error || 'Errore durante l\'archiviazione', 'error');
          }
        } catch (error) {
          console.error('Archive error:', error);
          showToast('Errore di connessione durante l\'archiviazione', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          parent_id: newCategoryParent ? Number(newCategoryParent) : null
        })
      });
      if (res.ok) {
        setNewCategoryName('');
        setNewCategoryParent('');
        fetchCategories();
      }
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    setConfirmModal({
      open: true,
      title: 'Elimina Categoria',
      message: 'Sei sicuro di voler eliminare questa categoria? I task associati rimarranno senza categoria.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchCategories();
            showToast('Categoria eliminata', 'success');
          } else {
            const data = await res.json();
            showToast(data.error || 'Errore durante l\'eliminazione', 'error');
          }
        } catch (error) {
          console.error('Error deleting category:', error);
          showToast('Errore di connessione', 'error');
        }
      }
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.password && formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Le password non coincidono' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          department: formData.department,
          avatar: formData.avatar,
          password: formData.password || undefined
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profilo aggiornato con successo' });
        onUpdateUser({
          ...user,
          name: formData.name,
          email: formData.email,
          department: formData.department,
          avatar: formData.avatar
        });
      } else {
        setMessage({ type: 'error', text: 'Errore durante l\'aggiornamento' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profilo', label: 'Profilo', icon: UserIcon },
    { id: 'categorie', label: 'Categorie Task', icon: Layers },
    { id: 'notifiche', label: 'Notifiche', icon: Bell },
  ];

  if (isAdmin) {
    tabs.push({ id: 'admin', label: 'Amministrazione', icon: Shield });
  }

  const parentCategories = categories.filter(c => !c.parent_id);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8 pb-12"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-serif font-bold text-[#111827]">Impostazioni</h1>
        <p className="text-[#6B7280]">Gestisci il tuo account e le preferenze della piattaforma.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Tabs Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-3xl border border-[#E5E7EB] p-2 shadow-sm space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                  activeTab === tab.id 
                    ? "bg-[#5A5A40] text-white shadow-md" 
                    : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]"
                )}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="bg-white rounded-[2.5rem] border border-[#E5E7EB] shadow-sm overflow-hidden min-h-[500px]">
            {activeTab === 'profilo' && (
              <div className="p-8 lg:p-12 space-y-10">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-[2rem] bg-[#F3F4F6] border-4 border-white shadow-xl overflow-hidden flex items-center justify-center text-[#5A5A40] text-4xl font-serif font-bold">
                      {formData.avatar ? (
                        <img src={formData.avatar} className="w-full h-full object-cover" />
                      ) : (
                        formData.name.charAt(0)
                      )}
                    </div>
                    <button className="absolute -bottom-2 -right-2 p-3 bg-[#5A5A40] text-white rounded-2xl shadow-lg hover:scale-110 transition-transform">
                      <Camera size={18} />
                    </button>
                  </div>
                  <div className="text-center md:text-left">
                    <h2 className="text-2xl font-serif font-bold text-[#111827]">{formData.name}</h2>
                    <p className="text-[#6B7280] font-medium">{formData.department} • {user?.role === 'admin' ? 'Amministratore' : 'Utente Standard'}</p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-8">
                  {message && (
                    <div className={cn(
                      "p-4 rounded-2xl text-sm font-bold border text-center",
                      message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
                    )}>
                      {message.text}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] ml-1">Nome Completo</label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-5 py-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] ml-1">Email Aziendale</label>
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-5 py-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] ml-1">Reparto</label>
                      <input 
                        type="text" 
                        value={formData.department}
                        readOnly
                        className="w-full px-5 py-4 bg-[#F3F4F6] border border-[#E5E7EB] rounded-2xl outline-none text-[#9CA3AF] cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] ml-1">URL Avatar</label>
                      <input 
                        type="text" 
                        value={formData.avatar}
                        onChange={(e) => setFormData({...formData, avatar: e.target.value})}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full px-5 py-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[#F3F4F6] space-y-6">
                    <h3 className="text-lg font-serif font-bold text-[#111827]">Cambia Password</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] ml-1">Nuova Password</label>
                        <input 
                          type="password" 
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          className="w-full px-5 py-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                          placeholder="Lascia vuoto per non cambiare"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] ml-1">Conferma Password</label>
                        <input 
                          type="password" 
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                          className="w-full px-5 py-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                          placeholder="Ripeti la nuova password"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 flex justify-end">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex items-center gap-2 bg-[#5A5A40] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Save size={18} />
                          Salva Modifiche
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'categorie' && (
              <div className="p-8 lg:p-12 space-y-8">
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-serif font-bold text-[#111827]">Gestione Categorie</h2>
                  <p className="text-[#6B7280]">Organizza i task in categorie e sottocategorie.</p>
                </div>

                <form onSubmit={handleAddCategory} className="bg-[#F9FAFB] p-6 rounded-3xl border border-[#E5E7EB] space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40]">Aggiungi Nuova Categoria</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nome categoria..."
                      className="w-full px-4 py-3 bg-white border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                    />
                    <select 
                      value={newCategoryParent}
                      onChange={(e) => setNewCategoryParent(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                    >
                      <option value="">Nessun genitore (Principale)</option>
                      {parentCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-[#5A5A40] text-white py-3 rounded-xl font-bold hover:bg-[#4A4A30] transition-all"
                  >
                    <Plus size={18} /> Aggiungi Categoria
                  </button>
                </form>

                <div className="space-y-4">
                  {parentCategories.map(parent => (
                    <div key={parent.id} className="space-y-2">
                      <div className="flex items-center justify-between p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#5A5A40]"></div>
                          <span className="font-bold text-[#111827]">{parent.name}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteCategory(parent.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="ml-8 space-y-2">
                        {categories.filter(c => c.parent_id === parent.id).map(child => (
                          <div key={child.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl">
                            <span className="text-sm font-medium text-[#4B5563]">{child.name}</span>
                            <button 
                              onClick={() => handleDeleteCategory(child.id)}
                              className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notifiche' && (
              <div className="p-8 lg:p-12 space-y-8">
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-serif font-bold text-[#111827]">Centro Notifiche</h2>
                  <p className="text-[#6B7280]">Gestisci come e quando ricevere gli avvisi.</p>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'task_deadline', title: 'Scadenza Task', desc: 'Ricevi un avviso quando un task si avvicina alla scadenza.' },
                    { id: 'new_task', title: 'Nuovo Task Assegnato', desc: 'Notifica immediata quando ti viene assegnato un nuovo lavoro.' },
                    { id: 'comments', title: 'Commenti e Note', desc: 'Avvisami quando qualcuno aggiunge una nota ai miei task.' },
                    { id: 'weekly_report', title: 'Resoconto Settimanale', desc: 'Invia un riepilogo via email ogni lunedì mattina.' },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-6 bg-white border border-[#E5E7EB] rounded-3xl shadow-sm">
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#111827]">{item.title}</h4>
                        <p className="text-xs text-[#6B7280]">{item.desc}</p>
                      </div>
                      <div 
                        onClick={() => handleUpdateNotification(item.id, !notificationSettings[item.id as keyof typeof notificationSettings])}
                        className={cn(
                          "w-12 h-6 rounded-full p-1 transition-colors cursor-pointer",
                          notificationSettings[item.id as keyof typeof notificationSettings] ? "bg-[#5A5A40]" : "bg-[#E5E7EB]"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 bg-white rounded-full transition-transform",
                          notificationSettings[item.id as keyof typeof notificationSettings] ? "translate-x-6" : "translate-x-0"
                        )}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'admin' && user?.role === 'admin' && (
              <div className="p-8 lg:p-12 space-y-10">
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-serif font-bold text-[#111827]">Amministrazione ed Esportazione</h2>
                  <p className="text-[#6B7280]">Esporta i dati aziendali strutturati in Excel e gestisci l'azzeramento per ottimizzare le prestazioni.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#F9FAFB] p-8 rounded-[2rem] border border-[#E5E7EB] space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                        <FileSpreadsheet size={24} />
                      </div>
                      <h3 className="font-bold text-lg">Esportazione Excel</h3>
                    </div>
                    <p className="text-sm text-[#6B7280]">Scarica un report Excel strutturato contenente tutte le attività, i dettagli dei task (comprensivi di note e gerarchia categorie) e il registro completo delle chiamate.</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Dal:</label>
                        <input 
                          type="date" 
                          value={backupStartDate}
                          onChange={(e) => setBackupStartDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all font-bold text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Al:</label>
                        <input 
                          type="date" 
                          value={backupEndDate}
                          onChange={(e) => setBackupEndDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all font-bold text-sm"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleExcelExport}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Download size={18} /> Scarica Esportazione Excel</>}
                    </button>
                  </div>

                  <div className="bg-[#F9FAFB] p-8 rounded-[2rem] border border-[#E5E7EB] space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                        <Archive size={24} />
                      </div>
                      <h3 className="font-bold text-lg">Archiviazione (Azzeramento)</h3>
                    </div>
                    <p className="text-sm text-[#6B7280]">Elimina definitivamente i dati transazionali (task, chiamate, note) fino alla data selezionata (inclusa) per liberare spazio.</p>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Elimina dati fino al (incluso):</label>
                        <input 
                          type="date" 
                          value={archiveDate}
                          onChange={(e) => setArchiveDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-bold text-sm"
                        />
                      </div>
                      <button 
                        onClick={handleArchiveData}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                      >
                        {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Archive size={18} /> Avvia Azzeramento Dati</>}
                      </button>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                      <AlertTriangle className="text-amber-500 flex-shrink-0" size={18} />
                      <p className="text-[10px] text-amber-800 leading-tight">
                        L'azzeramento rimuove solo Task, Chiamate, Note e Allegati. <strong>Clienti, Fornitori e Team non vengono mai eliminati.</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl flex gap-4">
                  <AlertTriangle className="text-rose-500 flex-shrink-0" size={24} />
                  <div className="space-y-1">
                    <h4 className="font-bold text-rose-900 text-sm">Attenzione</h4>
                    <p className="text-xs text-rose-700 leading-relaxed">
                      L'archiviazione è un'operazione irreversibile dall'interfaccia utente. I dati archiviati non saranno più visibili nelle liste attive ma rimarranno conservati nel database storico per consultazioni future via database administrator.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Conferma"
        type="warning"
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
