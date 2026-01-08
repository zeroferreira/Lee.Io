import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export const Notification = ({ message, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          className="fixed top-6 left-1/2 z-[200] min-w-[300px] max-w-md"
        >
          <div className="bg-background text-foreground border border-foreground/20 shadow-lg rounded-xl p-4 pr-10 flex items-center gap-3 backdrop-blur-sm">
            <p className="text-sm font-medium">{message}</p>
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