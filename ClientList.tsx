import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  X,
  Edit,
  Trash2,
  AlertTriangle,
  UserCheck,
  ShoppingBag,
  History,
  ExternalLink,
  LayoutList,
  LayoutGrid,
  CreditCard
} from 'lucide-react';
import { Client, User } from '../types';
import { SortOrder } from '../types/pagination';
import { cn } from '../lib/utils';
import { EasyfattClientModal } from '../components/EasyfattClientModal';
import ClientSalesHistory from '../components/ClientSalesHistory';
import { TableSortHeader } from '../components/TableSortHeader';
import { DataTablePagination } from '../components/DataTablePagination';

export default function ClientList() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<number | null>(null);

  // Sales History Modal State
  const [historyClient, setHistoryClient] = useState<Client | null>(null);

  // View Mode & Pagination & Sorting States
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [currentLimit, setCurrentLimit] = useState<number>(25);

  useEffect(() => {
    fetchClients();
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => { if (data.user) setCurrentUser(data.user); })
      .catch(() => {});
    fetch('/api/users', { credentials: 'include' })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setUsers(data); })
      .catch(() => {});
  }, []);

  const fetchClients = () => {
    setLoading(true);
    fetch('/api/clients', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setClients(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowAddModal(true);
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    try {
      await fetch(`/api/clients/${clientToDelete}`, { 
        method: 'DELETE',
        credentials: 'include'
      });
      fetchClients();
      setShowDeleteModal(false);
      setClientToDelete(null);
    } catch (error) {
      console.error('Delete client error:', error);
    }
  };

  const userRole = (currentUser?.role || '').toLowerCase();
  const isAgent = userRole === 'agent' || userRole === 'agente';
  const isCapoArea = userRole === 'capoarea' || userRole === 'capo_area' || userRole === 'area_manager';
  const isSalesRole = isAgent || isCapoArea;
  const isAdmin = userRole === 'admin' || userRole === 'amministratore';

  const [clientScope, setClientScope] = useState<'all' | 'my'>('all');

  const isDirectClient = (c: Client) => {
    if (!currentUser?.name || !c.agente) return false;
    const curName = currentUser.name.toLowerCase().trim();
    const agName = c.agente.toLowerCase().trim();
    return agName.includes(curName) || curName.includes(agName);
  };

  const visibleClients = clients.filter(c => {
    if (isAgent && !isCapoArea) {
      const hasSpecificMatches = clients.some(isDirectClient);
      if (hasSpecificMatches) {
        return isDirectClient(c);
      }
      return true;
    }
    if (isCapoArea && clientScope === 'my') {
      return isDirectClient(c);
    }
    return true;
  });

  const filteredClients = visibleClients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.code && c.code.toLowerCase().includes(search.toLowerCase())) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase()) ||
    c.vat_code?.toLowerCase().includes(search.toLowerCase()) ||
    c.agente?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      let valA = (a as any)[sortBy] ?? '';
      let valB = (b as any)[sortBy] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredClients, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedClients.length / currentLimit));
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * currentLimit;
    return sortedClients.slice(start, start + currentLimit);
  }, [sortedClients, currentPage, currentLimit]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
            {isCapoArea ? "Clienti & Area di Vendita" : isAgent ? "I Miei Clienti" : "Anagrafica Clienti"}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Schede anagrafiche, contatti diretti, creazione ordini e storico acquisti.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setEditingClient(null);
              setShowAddModal(true);
            }}
            className="bg-[#5A5A40] text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 font-bold text-xs sm:text-sm hover:bg-[#4A4A30] transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus size={18} /> Nuovo Cliente
          </button>
        </div>
      </div>

      {/* Capo Area Client Scope Switcher */}
      {isCapoArea && (
        <div className="flex items-center gap-2 p-1.5 bg-gray-100/90 rounded-2xl w-fit text-xs">
          <span className="text-[11px] font-bold text-gray-500 pl-2">Visualizzazione:</span>
          <button
            type="button"
            onClick={() => {
              setClientScope('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              clientScope === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Tutti i Clienti Area ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setClientScope('my');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              clientScope === 'my' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            I Miei Clienti Assegnati ({clients.filter(isDirectClient).length})
          </button>
        </div>
      )}

      {/* Search Bar & View Mode Controls */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/70 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Cerca per ragione sociale, codice cliente, P.IVA, città..." 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-[#5A5A40] transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200/80">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === 'table' ? "bg-white text-gray-900 shadow-2xs" : "text-gray-500 hover:text-gray-900"
              )}
              title="Vista Tabella con Ordinamento"
            >
              <LayoutList size={14} />
              <span>Tabella</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === 'cards' ? "bg-white text-gray-900 shadow-2xs" : "text-gray-500 hover:text-gray-900"
              )}
              title="Vista Schede / Card"
            >
              <LayoutGrid size={14} />
              <span>Schede</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Cards View */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-gray-50/50 text-[10px] uppercase tracking-widest text-[#6B7280]">
                  <TableSortHeader
                    columnKey="code"
                    sortState={{ sortBy, sortOrder }}
                    onSort={toggleSort}
                  >
                    Codice
                  </TableSortHeader>
                  <TableSortHeader
                    columnKey="name"
                    sortState={{ sortBy, sortOrder }}
                    onSort={toggleSort}
                  >
                    Ragione Sociale / Cliente
                  </TableSortHeader>
                  <TableSortHeader
                    columnKey="city"
                    sortState={{ sortBy, sortOrder }}
                    onSort={toggleSort}
                  >
                    Città / Prov
                  </TableSortHeader>
                  <TableSortHeader
                    columnKey="contact"
                    sortState={{ sortBy, sortOrder }}
                    onSort={toggleSort}
                  >
                    Contatto / Recapito
                  </TableSortHeader>
                  <TableSortHeader
                    columnKey="agente"
                    sortState={{ sortBy, sortOrder }}
                    onSort={toggleSort}
                  >
                    Agente Assegnato
                  </TableSortHeader>
                  <TableSortHeader
                    columnKey="price_list"
                    sortState={{ sortBy, sortOrder }}
                    onSort={toggleSort}
                  >
                    Listino
                  </TableSortHeader>
                  <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] [content-visibility:auto]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400 font-medium text-xs">
                      Caricamento anagrafiche clienti...
                    </td>
                  </tr>
                ) : paginatedClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-[#9CA3AF]">
                      <Users size={40} className="mx-auto text-gray-300 stroke-1 mb-2" />
                      <p className="text-xs font-bold text-gray-700">Nessun cliente trovato con i criteri specificati.</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {search ? "Prova a modificare o resettare la ricerca." : "Non ci sono ancora clienti registrati."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedClients.map(client => {
                    const rawPhone = client.phone || client.cell_phone || '';
                    const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
                    const fullAddress = [client.address, client.city, client.province].filter(Boolean).join(', ');

                    return (
                      <tr key={client.id} className="hover:bg-[#F9FAFB] text-xs transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#111827] whitespace-nowrap">
                          {client.code ? (
                            <span className="text-[11px] bg-gray-100 text-gray-700 font-mono px-2 py-0.5 rounded font-bold">
                              {client.code}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px] font-mono">#{client.id}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <Link 
                              to={`/clients/${client.id}`}
                              className="font-bold text-[#111827] hover:text-[#5A5A40] hover:underline transition-colors flex items-center gap-1.5"
                            >
                              <span>{client.name}</span>
                              <ExternalLink size={12} className="opacity-40 hover:opacity-100" />
                            </Link>
                            {client.vat_code && (
                              <span className="text-[10px] text-gray-500 font-mono">P.IVA: {client.vat_code}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-[#5A5A40] shrink-0" />
                            <span>{client.city ? `${client.city} (${client.province || ''})` : 'N/D'}</span>
                            {fullAddress && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 ml-1"
                                title="Apri in Google Maps"
                              >
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-gray-600">
                          <div className="space-y-0.5">
                            {client.contact && (
                              <div className="font-medium text-gray-800">{client.contact}</div>
                            )}
                            {cleanPhone && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Phone size={11} className="text-[#5A5A40]" />
                                <a href={`tel:${cleanPhone}`} className="text-gray-700 hover:text-emerald-700 font-mono">
                                  {rawPhone}
                                </a>
                              </div>
                            )}
                            {client.email && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Mail size={11} className="text-gray-400" />
                                <a href={`mailto:${client.email}`} className="text-gray-500 hover:underline truncate max-w-[150px]">
                                  {client.email}
                                </a>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {client.agente ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block whitespace-nowrap ${
                              isDirectClient(client) && isCapoArea
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {isDirectClient(client) && isCapoArea ? `★ ${client.agente}` : client.agente}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">Non assegnato</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {client.price_list ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {client.price_list}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">Default</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/crea-ordine?clientId=${client.id}`)}
                              className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                              title="Crea Ordine"
                            >
                              <ShoppingBag size={13} />
                              <span className="hidden sm:inline">Ordine</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setHistoryClient(client)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                              title="Storico Acquisti"
                            >
                              <History size={13} />
                              <span className="hidden sm:inline">Storico</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEdit(client)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#5A5A40] transition-colors cursor-pointer"
                              title="Modifica Anagrafica"
                            >
                              <Edit size={14} />
                            </button>

                            {!isSalesRole && (
                              <button
                                type="button"
                                onClick={() => {
                                  setClientToDelete(client.id);
                                  setShowDeleteModal(true);
                                }}
                                className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-300 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Elimina"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        loading ? (
          <div className="text-center py-20 text-gray-400 font-medium text-sm">Caricamento anagrafiche clienti...</div>
        ) : paginatedClients.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-300 py-16 text-center p-6">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Users size={30} />
            </div>
            <h3 className="text-base font-bold text-gray-900">Nessun cliente trovato</h3>
            <p className="text-gray-500 text-xs mt-1">
              {search ? "Nessun risultato corrispondente alla ricerca." : "Non ci sono ancora clienti registrati nel tuo archivio."}
            </p>
            <button
              onClick={() => {
                setEditingClient(null);
                setShowAddModal(true);
              }}
              className="mt-4 inline-flex items-center gap-2 bg-[#5A5A40] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#4A4A30] transition-all cursor-pointer"
            >
              <Plus size={16} /> Aggiungi Primo Cliente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 [content-visibility:auto] [contain-intrinsic-size:auto_280px]">
            {paginatedClients.map((client) => {
              const rawPhone = client.phone || client.cell_phone || '';
              const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
              const fullAddress = [client.address, client.city, client.province].filter(Boolean).join(', ');

              return (
                <motion.div
                  layout
                  key={client.id}
                  className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Bar: Initials + Code + Actions */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center font-bold text-base border border-[#5A5A40]/15 shrink-0">
                          {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          {client.code && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 font-mono px-2 py-0.5 rounded font-bold w-max">
                              Cod. {client.code}
                            </span>
                          )}
                          {client.price_list && (
                            <span className="text-[10px] text-emerald-700 font-bold mt-0.5 truncate">
                              Listino: {client.price_list}
                            </span>
                          )}
                          {client.agente && (
                            <span className={`text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded-md w-max truncate ${
                              isDirectClient(client) && isCapoArea
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {isDirectClient(client) && isCapoArea ? `★ Mio Cliente (${client.agente})` : `Agente: ${client.agente}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => handleEdit(client)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#5A5A40] transition-colors cursor-pointer"
                          title="Modifica Anagrafica"
                        >
                          <Edit size={16} />
                        </button>
                        {!isSalesRole && (
                          <button 
                            onClick={() => {
                              setClientToDelete(client.id);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-300 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Elimina"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Customer Name */}
                    <Link to={`/clients/${client.id}`} className="group block mb-3">
                      <h3 className="font-bold text-base text-gray-900 group-hover:text-[#5A5A40] transition-colors line-clamp-1">
                        {client.name}
                      </h3>
                      {client.contact && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Ref: <span className="font-medium text-gray-700">{client.contact}</span>
                        </p>
                      )}
                    </Link>
                    
                    {/* Quick Contact Info with Direct Links */}
                    <div className="space-y-2 text-xs text-gray-600 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                      {/* Phone */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone size={14} className="text-[#5A5A40] shrink-0" />
                          <span className="font-medium truncate">{rawPhone || 'Nessun telefono'}</span>
                        </div>
                        {cleanPhone && (
                          <a 
                            href={`tel:${cleanPhone}`}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors shrink-0 shadow-2xs"
                            title="Chiama subito il cliente"
                          >
                            Chiama
                          </a>
                        )}
                      </div>

                      {/* Address / Google Maps */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin size={14} className="text-[#5A5A40] shrink-0" />
                          <span className="truncate">
                            {fullAddress || 'Indirizzo non presente'}
                          </span>
                        </div>
                        {fullAddress && (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors shrink-0 shadow-2xs"
                            title="Apri in Google Maps"
                          >
                            <ExternalLink size={10} /> Mappe
                          </a>
                        )}
                      </div>

                      {/* Email */}
                      {client.email && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <Mail size={14} className="text-[#5A5A40] shrink-0" />
                          <a 
                            href={`mailto:${client.email}`}
                            className="text-[#5A5A40] hover:underline font-medium truncate"
                          >
                            {client.email}
                          </a>
                        </div>
                      )}

                      {/* P.IVA */}
                      {client.vat_code && (
                        <div className="text-[10px] font-mono text-gray-500 pt-0.5 border-t border-gray-200/60">
                          P.IVA: <span className="font-semibold text-gray-700">{client.vat_code}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2 MAIN ACTIONS: "Nuovo Ordine" and "Storico Acquisti" */}
                  <div className="mt-4 pt-3.5 border-t border-gray-100 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/crea-ordine?clientId=${client.id}`)}
                      className="w-full bg-[#5A5A40] hover:bg-[#4A4A30] text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title="Apri il catalogo per creare un ordine per questo cliente"
                    >
                      <ShoppingBag size={15} />
                      <span>Crea Ordine</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setHistoryClient(client)}
                      className="w-full bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      title="Visualizza lo storico acquisti e i consumi abituali del cliente"
                    >
                      <History size={15} className="text-[#5A5A40]" />
                      <span>Vedi Storico</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {/* Universal Pagination Controls for All Roles (Agent, Capoarea, Admin) */}
      <DataTablePagination
        pagination={{
          page: currentPage,
          limit: currentLimit,
          totalItems: sortedClients.length,
          totalPages,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        }}
        onPageChange={(page) => setCurrentPage(page)}
        onLimitChange={(limit) => {
          setCurrentLimit(limit);
          setCurrentPage(1);
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        itemName="clienti"
        isLoading={loading}
      />

      {/* Easyfatt Client Modal */}
      <EasyfattClientModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingClient(null);
        }}
        onSave={() => {
          fetchClients();
          setShowAddModal(false);
          setEditingClient(null);
        }}
        initialClient={editingClient}
        currentUser={currentUser}
        users={users}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-[#1A1A1A]/10 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900">Elimina Cliente</h3>
                <p className="text-xs text-gray-500">
                  Sei sicuro di voler eliminare questo cliente? Questa operazione è irreversibile.
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setClientToDelete(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all shadow-sm cursor-pointer"
                >
                  Elimina
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Client Sales History Modal (Accessible 1-click by Agent) */}
      <AnimatePresence>
        {historyClient && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6">
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center font-bold">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base sm:text-lg text-gray-900">
                      Storico Acquisti: {historyClient.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Prodotti ordinati in precedenza e frequenza d'acquisto
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const cid = historyClient.id;
                      setHistoryClient(null);
                      navigate(`/crea-ordine?clientId=${cid}`);
                    }}
                    className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <ShoppingBag size={14} />
                    <span>Crea Ordine per {historyClient.name.split(' ')[0]}</span>
                  </button>
                  <button
                    onClick={() => setHistoryClient(null)}
                    className="p-2 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <ClientSalesHistory 
                  clientId={historyClient.id} 
                  clientName={historyClient.name} 
                  isAdmin={isAdmin}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
