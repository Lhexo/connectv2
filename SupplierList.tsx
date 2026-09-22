import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  Truck, 
  Phone, 
  Mail, 
  MapPin, 
  MoreVertical,
  ChevronRight,
  Filter,
  Tag,
  X,
  Edit,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Supplier } from '../types';
import { cn } from '../lib/utils';

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contact: '',
    phone: '',
    email: '',
    category: '',
    notes: ''
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers', { credentials: 'include' });
      const data = await response.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';
    const method = editingSupplier ? 'PATCH' : 'POST';
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
        credentials: 'include'
      });
      if (response.ok) {
        setIsModalOpen(false);
        setEditingSupplier(null);
        setNewSupplier({ name: '', contact: '', phone: '', email: '', category: '', notes: '' });
        fetchSuppliers();
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNewSupplier({ ...supplier });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await fetch(`/api/suppliers/${supplierToDelete}`, { 
        method: 'DELETE',
        credentials: 'include'
      });
      fetchSuppliers();
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    } catch (error) {
      console.error('Error deleting supplier:', error);
    }
  };

  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const filteredSuppliers = safeSuppliers.filter(s => 
    s && ((s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.category && s.category.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#1A1A1A]">Fornitori</h1>
          <p className="text-[#6B7280]">Gestisci i partner e i fornitori di Connect</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#5A5A40] text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuovo Fornitore
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E5E7EB] space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3 bg-[#F3F4F6] px-4 py-2.5 rounded-xl">
            <Search size={20} className="text-[#9CA3AF]" />
            <input 
              type="text" 
              placeholder="Cerca per nome o categoria..." 
              className="bg-transparent border-none outline-none text-sm w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm font-medium hover:bg-[#F9FAFB] transition-colors">
            <Filter size={18} />
            Filtri
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-[#1A1A1A]/10 py-20 text-center space-y-4">
            <div className="bg-[#F5F5F0] w-16 h-16 rounded-full flex items-center justify-center mx-auto text-[#5A5A40]">
              <Truck size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-serif font-bold text-[#111827]">Nessun fornitore trovato</h3>
              <p className="text-sm text-[#1A1A1A]/40">Prova a cambiare i filtri o aggiungi un nuovo fornitore.</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20"
            >
              <Plus size={20} /> Aggiungi Fornitore
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map((supplier) => (
              <motion.div 
                key={supplier.id}
                whileHover={{ y: -4 }}
                className="bg-white border border-[#E5E7EB] rounded-2xl p-5 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#5A5A40]">
                    <Truck size={24} />
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEdit(supplier)}
                      className="p-2 hover:bg-[#F3F4F6] rounded-xl transition-colors text-[#9CA3AF] hover:text-[#5A5A40]"
                      title="Modifica"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setSupplierToDelete(supplier.id);
                        setShowDeleteModal(true);
                      }}
                      className="p-2 hover:bg-rose-50 rounded-xl transition-colors text-rose-300 hover:text-rose-500"
                      title="Elimina"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <Link to={`/suppliers/${supplier.id}`}>
                  <h3 className="text-lg font-bold text-[#111827] mb-1 hover:text-[#5A5A40] transition-colors">{supplier.name}</h3>
                </Link>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] text-xs font-semibold mb-4">
                  <Tag size={12} />
                  {supplier.category}
                </div>

                <div className="space-y-3 text-sm text-[#4B5563]">
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-[#9CA3AF]" />
                    {supplier.phone}
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-[#9CA3AF]" />
                    {supplier.email}
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-[#9CA3AF]" />
                    {supplier.contact}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#F3F4F6] flex items-center justify-end">
                  <Link 
                    to={`/tasks?search=${encodeURIComponent(supplier.name)}`}
                    className="text-[#5A5A40] text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Vedi Attività
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for New Supplier */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-serif font-bold">{editingSupplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</h2>
                <button onClick={() => { setIsModalOpen(false); setEditingSupplier(null); }} className="p-2 hover:bg-[#F3F4F6] rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddSupplier} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#374151] mb-1.5">Ragione Sociale</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#374151] mb-1.5">Categoria</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                      value={newSupplier.category}
                      onChange={(e) => setNewSupplier({...newSupplier, category: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#374151] mb-1.5">Referente</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                      value={newSupplier.contact}
                      onChange={(e) => setNewSupplier({...newSupplier, contact: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#374151] mb-1.5">Telefono</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                      value={newSupplier.phone}
                      onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#374151] mb-1.5">Email</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                      value={newSupplier.email}
                      onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#374151] mb-1.5">Note</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all resize-none"
                    value={newSupplier.notes}
                    onChange={(e) => setNewSupplier({...newSupplier, notes: e.target.value})}
                  ></textarea>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-[#5A5A40] text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 mt-4"
                >
                  {editingSupplier ? 'Salva Modifiche' : 'Salva Fornitore'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Truck size={32} />
                </div>
                <h3 className="text-2xl font-serif font-bold text-[#111827] mb-2">Elimina Fornitore</h3>
                <p className="text-[#6B7280] mb-8">Sei sicuro di voler eliminare questo fornitore? Questa azione non può essere annullata.</p>
                
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 py-4 bg-[#F3F4F6] text-[#374151] rounded-2xl font-bold hover:bg-[#E5E7EB] transition-all"
                  >
                    Annulla
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-200"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Removed custom X function as it's now imported from lucide-react
