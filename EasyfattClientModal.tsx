import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  MapPin, 
  CreditCard, 
  Truck, 
  Mail, 
  Phone, 
  FileText, 
  FileCode, 
  Check, 
  Sparkles,
  UserCheck,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, User } from '../types';

interface EasyfattClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (savedClient: Client) => void;
  initialClient?: Partial<Client> | null;
  currentUser?: User | null;
  users?: User[]; // List of all users for agent dropdown (for admins)
}

export const EasyfattClientModal: React.FC<EasyfattClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialClient,
  currentUser,
  users = []
}) => {
  const [activeTab, setActiveTab] = useState<'anagrafica' | 'indirizzo' | 'spedizione' | 'commerciale'>('anagrafica');
  const [isDifferentDelivery, setIsDifferentDelivery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state according to Easyfatt XML schema
  const [formData, setFormData] = useState<Partial<Client>>({
    code: '',
    web_login: '',
    name: '',
    contact: '',
    phone: '',
    cell_phone: '',
    fax: '',
    email: '',
    pec: '',
    address: '',
    postcode: '',
    city: '',
    province: '',
    country: 'Italia',
    fiscal_code: '',
    vat_code: '',
    sdi_pec: '',
    delivery_name: '',
    delivery_address: '',
    delivery_postcode: '',
    delivery_city: '',
    delivery_province: '',
    delivery_country: 'Italia',
    price_list: '',
    payment_name: 'Bonifico bancario',
    payment_bank: '',
    custom_field1: '',
    custom_field2: '',
    notes: '',
    agente: ''
  });

  useEffect(() => {
    if (initialClient) {
      setFormData({
        code: initialClient.code || '',
        web_login: initialClient.web_login || '',
        name: initialClient.name || '',
        contact: initialClient.contact || '',
        phone: initialClient.phone || '',
        cell_phone: initialClient.cell_phone || '',
        fax: initialClient.fax || '',
        email: initialClient.email || '',
        pec: initialClient.pec || '',
        address: initialClient.address || '',
        postcode: initialClient.postcode || '',
        city: initialClient.city || '',
        province: initialClient.province || '',
        country: initialClient.country || 'Italia',
        fiscal_code: initialClient.fiscal_code || '',
        vat_code: initialClient.vat_code || '',
        sdi_pec: initialClient.sdi_pec || '',
        delivery_name: initialClient.delivery_name || '',
        delivery_address: initialClient.delivery_address || '',
        delivery_postcode: initialClient.delivery_postcode || '',
        delivery_city: initialClient.delivery_city || '',
        delivery_province: initialClient.delivery_province || '',
        delivery_country: initialClient.delivery_country || 'Italia',
        price_list: initialClient.price_list || '',
        payment_name: initialClient.payment_name || 'Bonifico bancario',
        payment_bank: initialClient.payment_bank || '',
        custom_field1: initialClient.custom_field1 || '',
        custom_field2: initialClient.custom_field2 || '',
        notes: initialClient.notes || '',
        agente: initialClient.agente || (currentUser?.role === 'agent' || currentUser?.role === 'agente' || currentUser?.role === 'capoarea' || currentUser?.role === 'capo_area' || currentUser?.role === 'area_manager' ? currentUser.name : '')
      });

      if (initialClient.delivery_address || initialClient.delivery_city || initialClient.delivery_name) {
        setIsDifferentDelivery(true);
      } else {
        setIsDifferentDelivery(false);
      }
    } else {
      // Reset form
      setFormData({
        code: '',
        web_login: '',
        name: '',
        contact: '',
        phone: '',
        cell_phone: '',
        fax: '',
        email: '',
        pec: '',
        address: '',
        postcode: '',
        city: '',
        province: '',
        country: 'Italia',
        fiscal_code: '',
        vat_code: '',
        sdi_pec: '',
        delivery_name: '',
        delivery_address: '',
        delivery_postcode: '',
        delivery_city: '',
        delivery_province: '',
        delivery_country: 'Italia',
        price_list: '',
        payment_name: 'Bonifico bancario',
        payment_bank: '',
        custom_field1: '',
        custom_field2: '',
        notes: '',
        agente: currentUser?.role === 'agent' || currentUser?.role === 'agente' || currentUser?.role === 'capoarea' || currentUser?.role === 'capo_area' || currentUser?.role === 'area_manager' ? currentUser.name : ''
      });
      setIsDifferentDelivery(false);
    }
    setError(null);
  }, [initialClient, currentUser, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Client, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError('La Ragione Sociale / Nome cliente è un campo obbligatorio.');
      setActiveTab('anagrafica');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      ...formData,
      // If delivery address is not enabled, clear delivery fields
      delivery_name: isDifferentDelivery ? formData.delivery_name : '',
      delivery_address: isDifferentDelivery ? formData.delivery_address : '',
      delivery_postcode: isDifferentDelivery ? formData.delivery_postcode : '',
      delivery_city: isDifferentDelivery ? formData.delivery_city : '',
      delivery_province: isDifferentDelivery ? formData.delivery_province : '',
      delivery_country: isDifferentDelivery ? formData.delivery_country : ''
    };

    try {
      const isEditing = !!initialClient?.id;
      const url = isEditing ? `/api/clients/${initialClient.id}` : '/api/clients';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Errore nel salvataggio dell\'anagrafica cliente');
      }

      const result = await res.json();
      const savedClientObj: Client = {
        ...payload,
        id: result.id || initialClient?.id || Date.now(),
        name: payload.name || '',
        contact: payload.contact || '',
        phone: payload.phone || '',
        email: payload.email || '',
        city: payload.city || '',
        notes: payload.notes || ''
      } as Client;

      onSave(savedClientObj);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Si è verificato un errore durante il salvataggio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const agentUsers = users.filter(u => {
    const r = (u.role || '').toLowerCase();
    return r === 'agent' || r === 'agente' || r === 'capoarea' || r === 'capo_area' || r === 'area_manager' || r === 'user';
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A1A1A] via-[#2A2A20] to-[#5A5A40] text-white px-6 py-5 flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 text-emerald-400">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-serif tracking-wide text-white">
                  {initialClient?.id ? 'Modifica Anagrafica Cliente' : 'Nuovo Cliente'}
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                  <Sparkles size={10} /> Danea Easyfatt XML
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5 font-sans">
                Compilazione guidata secondo il tracciato nativo Danea Easyfatt-Xml (Protocollo 2/3)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('anagrafica')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'anagrafica'
                ? 'bg-white text-[#5A5A40] shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Building2 size={14} />
            <span>1. Dati Anagrafici</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('indirizzo')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'indirizzo'
                ? 'bg-white text-[#5A5A40] shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <MapPin size={14} />
            <span>2. Sede & Contatti</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('spedizione')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'spedizione'
                ? 'bg-white text-[#5A5A40] shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Truck size={14} />
            <span>3. Spedizione {isDifferentDelivery && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('commerciale')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'commerciale'
                ? 'bg-white text-[#5A5A40] shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <CreditCard size={14} />
            <span>4. Listino & Pagamento</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3.5 flex items-center gap-2 font-medium">
              <span className="font-bold">Attenzione:</span> {error}
            </div>
          )}

          {/* TAB 1: DATI ANAGRAFICI */}
          {activeTab === 'anagrafica' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-gray-100 pb-2 mb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#5A5A40] flex items-center gap-1.5">
                  <Building2 size={14} /> Identificativi e Dati Fiscali (&lt;Customer&gt;)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-1 space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Codice Cliente</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerCode&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code || ''}
                    onChange={e => handleChange('code', e.target.value)}
                    placeholder="Es. 0018 o C001"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Ragione Sociale / Nome *</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerName&gt;</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name || ''}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder="Es. Centro Estetico Il Girasole Srl"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Partita IVA</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerVatCode&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.vat_code || ''}
                    onChange={e => handleChange('vat_code', e.target.value.toUpperCase())}
                    placeholder="Es. 03322350178"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Codice Fiscale</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerFiscalCode&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fiscal_code || ''}
                    onChange={e => handleChange('fiscal_code', e.target.value.toUpperCase())}
                    placeholder="Es. RSSMRA80A01H501Z"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Persona di Riferimento / Referente</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerReference&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.contact || ''}
                    onChange={e => handleChange('contact', e.target.value)}
                    placeholder="Es. Dr. Marco Rossi"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Login Web Cliente (E-Commerce)</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerWebLogin&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.web_login || ''}
                    onChange={e => handleChange('web_login', e.target.value)}
                    placeholder="Es. cliente_girasole"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Agente Assegnato</span>
                  <span className="text-[10px] text-gray-400 font-mono">&lt;SalesAgent&gt;</span>
                </label>
                {agentUsers.length > 0 ? (
                  <select
                    value={formData.agente || ''}
                    onChange={e => handleChange('agente', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  >
                    <option value="">-- Seleziona Agente / Capoarea --</option>
                    {agentUsers.map(u => {
                      const isCapo = (u.role || '').toLowerCase().includes('capo') || (u.role || '').toLowerCase().includes('area');
                      return (
                        <option key={u.id} value={u.name}>
                          {u.name} ({isCapo ? 'Capoarea' : 'Agente'} - {u.email})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.agente || ''}
                    onChange={e => handleChange('agente', e.target.value)}
                    placeholder="Nome Agente commerciale"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INDIRIZZO SEDE & CONTATTI */}
          {activeTab === 'indirizzo' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-gray-100 pb-2 mb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#5A5A40] flex items-center gap-1.5">
                  <MapPin size={14} /> Sede Legale e Recapiti Operativi
                </h3>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Indirizzo e N. Civico</span>
                  <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerAddress&gt;</span>
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={e => handleChange('address', e.target.value)}
                  placeholder="Es. Via Flaminia, 963"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>CAP</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;Postcode&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.postcode || ''}
                    onChange={e => handleChange('postcode', e.target.value)}
                    placeholder="06061"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Città</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;City&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={e => handleChange('city', e.target.value)}
                    placeholder="Castiglione del Lago"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Provincia</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;Province&gt;</span>
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={formData.province || ''}
                    onChange={e => handleChange('province', e.target.value.toUpperCase())}
                    placeholder="PG"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono uppercase focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Nazione</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;Country&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.country || 'Italia'}
                    onChange={e => handleChange('country', e.target.value)}
                    placeholder="Italia"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Codice Destinatario SDI / PEC Fattura</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerEInvoiceDestCode&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.sdi_pec || ''}
                    onChange={e => handleChange('sdi_pec', e.target.value.toUpperCase())}
                    placeholder="Es. M5UXCR1 oppure 0000000"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              {/* Contatti */}
              <div className="pt-2 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Email Ordini / Commerciale</span>
                      <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerEmail&gt;</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={e => handleChange('email', e.target.value)}
                      placeholder="info@cliente.it"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Indirizzo PEC</span>
                      <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerPec&gt;</span>
                    </label>
                    <input
                      type="email"
                      value={formData.pec || ''}
                      onChange={e => handleChange('pec', e.target.value)}
                      placeholder="azienda@pec.it"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Telefono Fisso</span>
                      <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerTel&gt;</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={e => handleChange('phone', e.target.value)}
                      placeholder="075-26589"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Cellulare</span>
                      <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerCellPhone&gt;</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.cell_phone || ''}
                      onChange={e => handleChange('cell_phone', e.target.value)}
                      placeholder="335 1234567"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Fax</span>
                      <span className="text-[10px] text-gray-400 font-mono">&lt;CustomerFax&gt;</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.fax || ''}
                      onChange={e => handleChange('fax', e.target.value)}
                      placeholder="075-26590"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SPEDIZIONE / CONSEGNA */}
          {activeTab === 'spedizione' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-gray-100 pb-2 mb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#5A5A40] flex items-center gap-1.5">
                  <Truck size={14} /> Luogo di Consegna Merce (&lt;Delivery...&gt;)
                </h3>
              </div>

              <label className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-200 cursor-pointer hover:bg-gray-100/80 transition-all">
                <input
                  type="checkbox"
                  checked={isDifferentDelivery}
                  onChange={e => setIsDifferentDelivery(e.target.checked)}
                  className="w-4 h-4 rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                />
                <div className="text-xs">
                  <div className="font-bold text-gray-900">Indirizzo di spedizione/consegna diverso dalla sede legale</div>
                  <div className="text-gray-500">Seleziona per specificare un magazzino o un punto di consegna differente</div>
                </div>
              </label>

              {isDifferentDelivery ? (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Nome / C/O Presso Destinatario</span>
                      <span className="text-[10px] text-gray-400 font-mono">&lt;DeliveryName&gt;</span>
                    </label>
                    <input
                      type="text"
                      value={formData.delivery_name || ''}
                      onChange={e => handleChange('delivery_name', e.target.value)}
                      placeholder="Es. Magazzino Logistica 2 c/o Rossi"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Indirizzo Consegna</span>
                      <span className="text-[10px] text-gray-400 font-mono">&lt;DeliveryAddress&gt;</span>
                    </label>
                    <input
                      type="text"
                      value={formData.delivery_address || ''}
                      onChange={e => handleChange('delivery_address', e.target.value)}
                      placeholder="Es. Via dell'Industria 45"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                        <span>CAP</span>
                        <span className="text-[10px] text-gray-400 font-mono">&lt;DeliveryPostcode&gt;</span>
                      </label>
                      <input
                        type="text"
                        value={formData.delivery_postcode || ''}
                        onChange={e => handleChange('delivery_postcode', e.target.value)}
                        placeholder="06061"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                        <span>Città Consegna</span>
                        <span className="text-[10px] text-gray-400 font-mono">&lt;DeliveryCity&gt;</span>
                      </label>
                      <input
                        type="text"
                        value={formData.delivery_city || ''}
                        onChange={e => handleChange('delivery_city', e.target.value)}
                        placeholder="Perugia"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                        <span>Provincia</span>
                        <span className="text-[10px] text-gray-400 font-mono">&lt;DeliveryProvince&gt;</span>
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={formData.delivery_province || ''}
                        onChange={e => handleChange('delivery_province', e.target.value.toUpperCase())}
                        placeholder="PG"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono uppercase focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Nazione Spedizione</span>
                      <span className="text-[10px] text-gray-400 font-mono">&lt;DeliveryCountry&gt;</span>
                    </label>
                    <input
                      type="text"
                      value={formData.delivery_country || 'Italia'}
                      onChange={e => handleChange('delivery_country', e.target.value)}
                      placeholder="Italia"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 font-medium">
                  I prodotti verranno spediti all'indirizzo della sede legale specificato nel tab "Sede & Contatti".
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LISTINO & PAGAMENTO */}
          {activeTab === 'commerciale' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-gray-100 pb-2 mb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#5A5A40] flex items-center gap-1.5">
                  <CreditCard size={14} /> Condizioni Commerciali e Amministrative
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 opacity-70">
                  <label className="text-xs font-bold text-gray-500 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>Listino Prezzi Assegnato</span>
                      <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Disattivato</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;PriceList&gt;</span>
                  </label>
                  <input
                    type="text"
                    value=""
                    disabled
                    readOnly
                    placeholder="Disattivato (Non utilizzato)"
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl p-2.5 text-sm font-semibold text-gray-400 cursor-not-allowed select-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Modalità di Pagamento</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;PaymentName&gt;</span>
                  </label>
                  <select
                    value={formData.payment_name || 'Bonifico bancario'}
                    onChange={e => handleChange('payment_name', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  >
                    <option value="Bonifico bancario">Bonifico bancario</option>
                    <option value="Bonifico 30-60 gg F.M.">Bonifico 30-60 gg F.M.</option>
                    <option value="R.B. 30 Giorni F.M.">R.B. 30 Giorni F.M.</option>
                    <option value="R.B. 30-60-90 Giorni F.M.">R.B. 30-60-90 Giorni F.M.</option>
                    <option value="Contanti alla consegna">Contanti alla consegna (RDM)</option>
                    <option value="Carta di credito">Carta di credito / Stripe</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Banca di Appoggio / Coordinate IBAN</span>
                  <span className="text-[10px] text-gray-400 font-mono">&lt;PaymentBank&gt;</span>
                </label>
                <input
                  type="text"
                  value={formData.payment_bank || ''}
                  onChange={e => handleChange('payment_bank', e.target.value)}
                  placeholder="Es. Intesa Sanpaolo - IBAN IT83 H062 2562 9610 7404 2366 76W"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Campo Personalizzato 1</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;CustomField1&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.custom_field1 || ''}
                    onChange={e => handleChange('custom_field1', e.target.value)}
                    placeholder="Es. Categoria Cliente / Priorità"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>Campo Personalizzato 2</span>
                    <span className="text-[10px] text-gray-400 font-mono">&lt;CustomField2&gt;</span>
                  </label>
                  <input
                    type="text"
                    value={formData.custom_field2 || ''}
                    onChange={e => handleChange('custom_field2', e.target.value)}
                    placeholder="Es. Orario Apertura / Note Consegna"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Note Interne / Commenti</span>
                  <span className="text-[10px] text-gray-400 font-mono">&lt;InternalComment&gt;</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={e => handleChange('notes', e.target.value)}
                  placeholder="Eventuali note operative, preferenze o accordi commerciali speciali..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all resize-none"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all"
            >
              Annulla
            </button>

            <div className="flex items-center gap-2">
              {activeTab !== 'commerciale' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'anagrafica') setActiveTab('indirizzo');
                    else if (activeTab === 'indirizzo') setActiveTab('spedizione');
                    else if (activeTab === 'spedizione') setActiveTab('commerciale');
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-all"
                >
                  Avanti →
                </button>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-[#5A5A40] text-white hover:bg-[#4A4A30] transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Salvataggio in corso...</span>
                ) : (
                  <>
                    <Check size={16} />
                    <span>{initialClient?.id ? 'Salva Modifiche Anagrafica' : 'Salva Nuovo Cliente'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
