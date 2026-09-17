import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, isVisible, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className={cn(
            "fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border min-w-[300px] max-w-md",
            type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" :
            type === 'error' ? "bg-rose-50 border-rose-100 text-rose-800" :
            "bg-blue-50 border-blue-100 text-blue-800"
          )}
        >
          <div className="shrink-0">
            {type === 'success' ? <CheckCircle2 size={20} /> : 
             type === 'error' ? <AlertCircle size={20} /> : 
             <AlertCircle size={20} />}
          </div>
          <p className="text-sm font-medium flex-1">{message}</p>
          <button 
            onClick={onClose}
            className="shrink-0 p-1 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
