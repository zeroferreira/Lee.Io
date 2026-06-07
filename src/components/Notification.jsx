import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export const Notification = ({ message, onClose, duration = 4000 }) => {
  const normalizedMessage =
    typeof message === 'string'
      ? { type: 'info', text: message }
      : message && typeof message === 'object' && 'text' in message
        ? message
        : message
          ? { type: 'info', text: String(message) }
          : null;

  useEffect(() => {
    if (normalizedMessage) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [normalizedMessage, duration, onClose]);

  const typeStyles = {
    success: 'bg-emerald-50/90 text-emerald-800 border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-500/30',
    error: 'bg-red-50/90 text-red-800 border-red-500/20 dark:bg-red-950/30 dark:text-red-200 dark:border-red-500/30',
    info: 'bg-background/90 text-foreground border-foreground/20'
  };

  const typeClasses = normalizedMessage ? (typeStyles[normalizedMessage.type] || typeStyles.info) : '';

  return (
    <AnimatePresence>
      {normalizedMessage && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          className="fixed top-6 left-1/2 z-[200] min-w-[300px] max-w-md"
        >
          <div className={`${typeClasses} border shadow-lg rounded-2xl p-4 pr-10 flex items-center gap-3 backdrop-blur-sm`}>
            <p className="text-sm font-medium">{normalizedMessage.text}</p>
            <button 
              onClick={onClose}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-foreground/10 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
