import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  User, 
  UserCheck,
  Mail, 
  Briefcase, 
  Shield, 
  MoreVertical,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { User as UserType } from '../types';
import { cn } from '../lib/utils';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function UserManagement() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    role: 'user',
    password: 'password123',
    avatar: ''
  });

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info', visible: boolean }>({ message: '', type: 'info', visible: false });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean, title: string, message: string, onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, visible: true });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', { credentials: 'include' });
      const data = await response.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error('Expected array for users, got:', data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      if (response.ok) {
        setIsModalOpen(false);
        setEditingUser(null);
        setFormData({ name: '', email: '', department: '', role: 'user', password: 'password123', avatar: '' });
        fetchUsers();
        showToast(editingUser ? 'Utente aggiornato' : 'Utente creato', 'success');
      } else {
        const data = await response.json();
        showToast(data.error || 'Errore durante il salvataggio', 'error');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      showToast('Errore di connessione', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmModal({
      open: true,
      title: 'Elimina Utente',
      message: 'Sei sicuro di voler eliminare questo utente? Questa azione non può essere annullata.',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/users/${id}`, { 
            method: 'DELETE',
            credentials: 'include'
          });
          if (response.ok) {
            fetchUsers();
            showToast('Utente eliminato', 'success');
          } else {
            const data = await response.json();
            showToast(data.error || 'Errore durante l\'eliminazione', 'error');
          }
        } catch (error) {
          console.error('Error deleting user:', error);
          showToast('Errore di connessione', 'error');
        }
      }
    });
  };

  const openEditModal = (user: UserType) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role,
      password: '', // Don't show password in edit
      avatar: user.avatar || ''
    });
    setIsModalOpen(true);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-bold text-[#9CA3AF] animate-pulse uppercase tracking-widest">Caricamento Team...</p>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#1A1A1A]">Team Connect</h1>
          <p className="text-[#6B7280]">Gestisci gli utenti interni e i permessi della piattaforma</p>
        </div>
        <button 
          onClick={() => {
            setEditingUser(null);
            setFormData({ name: '', email: '', department: '', role: 'user', password: 'password123', avatar: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-[#5A5A40] text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <Plus size={20} />
          Aggiungi Membro
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="p-6 border-b border-[#F3F4F6] flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3 bg-[#F3F4F6] px-4 py-2.5 rounded-xl">
            <Search size={20} className="text-[#9CA3AF]" />
            <input 
              type="text" 
              placeholder="Cerca per nome, email o reparto..." 
              className="bg-transparent border-none outline-none text-sm w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F9FAFB] text-[#6B7280] text-xs uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-4">Utente</th>
                <th className="px-6 py-4">Reparto</th>
                <th className="px-6 py-4">Ruolo</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {!Array.isArray(users) || users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-sm font-bold text-[#9CA3AF]">Nessun utente trovato.</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F9FAFB] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center font-bold">
                          {user.name ? user.name.charAt(0) : '?'}
                        </div>
                        <span className="font-semibold text-[#111827]">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                        <Briefcase size={14} className="text-[#9CA3AF]" />
                        {user.department}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
                        user.role === 'admin' || user.role === 'amministratore' ? "bg-purple-100 text-purple-700" :
                        user.role === 'capoarea' ? "bg-amber-100 text-amber-800 border border-amber-200" :
                        user.role === 'agent' || user.role === 'agente' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {user.role === 'admin' || user.role === 'amministratore' ? <Shield size={12} /> : 
                         user.role === 'capoarea' ? <UserCheck size={12} /> :
                         <User size={12} />}
                        {user.role === 'admin' || user.role === 'amministratore' ? 'Admin' : 
                         user.role === 'capoarea' ? 'Capoarea' :
                         user.role === 'agent' || user.role === 'agente' ? 'Agente' : 'User'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                        <Mail size={14} className="text-[#9CA3AF]" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 transition-opacity">
                        <button 
                          onClick={() => openEditModal(user)}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-[#E5E7EB] text-[#4B5563] transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(user.id)}
                          className="p-2 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 text-red-500 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold">
                {editingUser ? 'Modifica Utente' : 'Nuovo Utente'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#F3F4F6] rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Nome Completo</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Email Aziendale</label>
                <input 
                  required
                  type="email" 
                  className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Password {editingUser && '(lascia vuoto per non cambiare)'}</label>
                <input 
                  required={!editingUser}
                  type="password" 
                  className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">URL Avatar</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                  value={formData.avatar}
                  onChange={(e) => setFormData({...formData, avatar: e.target.value})}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Reparto</label>
                <select 
                  required
                  className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all capitalize"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                >
                  <option value="">Seleziona Reparto</option>
                  <option value="direzionale">Direzionale</option>
                  <option value="commerciale">Commerciale</option>
                  <option value="marketing">Marketing</option>
                  <option value="grafica">Grafica</option>
                  <option value="logistica">Logistica</option>
                  <option value="amministrazione">Amministrazione</option>
                  <option value="assistenza tecnica">Assistenza Tecnica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Ruolo</label>
                <select 
                  className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all font-medium text-sm text-[#111827]"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  <option value="user">User (Utente generico)</option>
                  <option value="agent">Agente (Commerciale)</option>
                  <option value="capoarea">Capoarea (Area Manager)</option>
                  <option value="admin">Admin (Amministratore)</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full bg-[#5A5A40] text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 mt-4"
              >
                {editingUser ? 'Aggiorna Membro' : 'Crea Membro'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
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
