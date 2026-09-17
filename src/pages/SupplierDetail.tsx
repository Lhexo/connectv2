import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Truck, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  PhoneCall, 
  Clock,
  ChevronRight,
  Calendar,
  Tag,
  Users
} from 'lucide-react';
import { Supplier, Task, Call } from '../types';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function SupplierDetail() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState<(Supplier & { activities: Task[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/suppliers/${id}`)
      .then(res => res.json())
      .then(data => {
        setSupplier(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center">Caricamento...</div>;
  if (!supplier) return <div className="p-8 text-center text-rose-600">Fornitore non trovato</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      <div className="flex items-center gap-4">
        <Link to="/suppliers" className="p-2 hover:bg-[#F3F4F6] rounded-xl transition-colors text-[#6B7280]">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl font-serif font-bold text-[#111827]">{supplier.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          {/* Info Card */}
          <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <h2 className="text-lg font-serif font-bold flex items-center gap-2">
              <Truck size={18} className="text-[#5A5A40]" />
              Informazioni Fornitore
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-[#F9FAFB] rounded-lg text-[#6B7280]">
                  <Tag size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Categoria</div>
                  <div className="font-bold text-[#111827]">{supplier.category || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-[#F9FAFB] rounded-lg text-[#6B7280]">
                  <Phone size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Telefono</div>
                  <div className="font-bold text-[#111827]">{supplier.phone || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-[#F9FAFB] rounded-lg text-[#6B7280]">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Email</div>
                  <div className="font-bold text-[#111827]">{supplier.email || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-[#F9FAFB] rounded-lg text-[#6B7280]">
                  <Users size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Referente</div>
                  <div className="font-bold text-[#111827]">{supplier.contact || 'N/A'}</div>
                </div>
              </div>
            </div>
            {supplier.notes && (
              <div className="pt-6 border-t border-[#F3F4F6]">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2">Note</div>
                <p className="text-sm text-[#4B5563] leading-relaxed">{supplier.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          {/* Activity Timeline */}
          <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                <Clock size={20} className="text-[#5A5A40]" />
                Cronologia Attività
              </h2>
              <Link 
                to={`/tasks?supplierId=${supplier.id}`}
                className="text-sm text-[#5A5A40] hover:underline font-medium"
              >
                Vedi tutte
              </Link>
            </div>
            <div className="space-y-4">
              {supplier.activities.map(activity => (
                <Link 
                  key={`${activity.activity_source}-${activity.id}`}
                  to={activity.activity_source === 'task' ? `/tasks/${activity.id}` : '#'}
                  className="flex items-start gap-4 p-5 bg-[#F9FAFB] hover:bg-[#F3F4F6] rounded-2xl border border-[#E5E7EB] transition-all group"
                >
                  <div className={cn(
                    "p-3 rounded-xl",
                    activity.activity_source === 'call' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {activity.activity_source === 'call' ? <Phone size={18} /> : <Briefcase size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-bold text-[#111827] truncate group-hover:text-[#5A5A40] transition-colors">
                        {activity.title}
                      </div>
                      <span className={cn(
                        "text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded border",
                        activity.status === 'Completato' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        activity.status === 'In Corso' ? "bg-amber-50 text-amber-700 border-amber-100" :
                        activity.status === 'Nuovo' ? "bg-blue-50 text-blue-700 border-blue-100" :
                        "bg-gray-50 text-gray-700 border-gray-100"
                      )}>
                        {activity.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] line-clamp-1 mb-2">
                      {activity.description || 'Nessuna descrizione'}
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">
                        <Calendar size={12} />
                        {format(parseISO(activity.created_at), 'dd MMM yyyy', { locale: it })}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">
                        <Clock size={12} />
                        {format(parseISO(activity.created_at), 'HH:mm')}
                      </div>
                      {activity.assignee_name && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">
                          <Users size={12} />
                          {activity.assignee_name}
                        </div>
                      )}
                    </div>
                  </div>
                  {activity.activity_source === 'task' && (
                    <ChevronRight size={16} className="text-[#D1D5DB] group-hover:translate-x-1 transition-transform self-center" />
                  )}
                </Link>
              ))}
              {supplier.activities.length === 0 && (
                <div className="text-center py-12 bg-[#F9FAFB] rounded-3xl border border-dashed border-[#E5E7EB]">
                  <p className="text-sm text-[#9CA3AF] font-medium">Nessuna attività registrata per questo fornitore</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
