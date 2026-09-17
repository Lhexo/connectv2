import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  type = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-[#1A1A1A]/5"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  type === 'danger' ? "bg-rose-50 text-rose-500" :
                  type === 'warning' ? "bg-amber-50 text-amber-500" :
                  "bg-blue-50 text-blue-500"
                )}>
                  <AlertTriangle size={24} />
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-[#F5F5F0] rounded-xl text-[#1A1A1A]/40 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <h3 className="text-xl font-serif font-bold text-[#1A1A1A] mb-2">{title}</h3>
              <p className="text-[#1A1A1A]/60 leading-relaxed">{message}</p>
            </div>
            
            <div className="p-6 bg-[#F9FAFB] flex flex-col sm:flex-row gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-2xl font-bold text-[#1A1A1A]/60 hover:bg-[#F3F4F6] transition-all"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={cn(
                  "flex-1 px-6 py-3 rounded-2xl font-bold text-white shadow-lg transition-all",
                  type === 'danger' ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200" :
                  type === 'warning' ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" :
                  "bg-blue-500 hover:bg-blue-600 shadow-blue-200"
                )}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
