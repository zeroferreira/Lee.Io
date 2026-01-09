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

  return (
    <AnimatePresence>
      {normalizedMessage && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          className="fixed top-6 left-1/2 z-[200] min-w-[300px] max-w-md"
        >
          <div className="bg-background text-foreground border border-foreground/20 shadow-lg rounded-xl p-4 pr-10 flex items-center gap-3 backdrop-blur-sm">
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
