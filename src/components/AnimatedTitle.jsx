import { motion } from 'framer-motion';

export const AnimatedTitle = ({ size = 'small', layoutIdPrefix = 'title' }) => {
  const isLarge = size === 'large';
  
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2, // Much faster stagger (was 0.8)
        delayChildren: 0.3    // Faster initial delay (was 0.5)
      },
    },
  };

  const item = {
    hidden: { y: 20, opacity: 0 }, // Reduced movement
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100, damping: 10 }, // Snappier
    },
  };

  return (
    <div className={`relative flex items-end font-bold ${isLarge ? 'text-6xl md:text-8xl' : 'text-2xl'}`}>
      <motion.div
        className="flex items-end relative z-10" 
        initial={isLarge ? "hidden" : undefined}
        animate={isLarge ? "visible" : undefined}
        variants={container}
        layoutId={layoutIdPrefix}
      >
        <motion.span 
          layoutId={`${layoutIdPrefix}-lee`}
          variants={item}
          className="inline-block"
        >
          Leé
        </motion.span>
        <motion.span 
          layoutId={`${layoutIdPrefix}-dot`}
          variants={item}
          className="text-primary inline-block"
        >
          .
        </motion.span>
        <motion.span 
          layoutId={`${layoutIdPrefix}-io`}
          variants={item}
          className="inline-block"
        >
          Io
        </motion.span>
      </motion.div>

      {isLarge && (
        <svg className="absolute -inset-x-12 -inset-y-6 w-[calc(100%+6rem)] h-[calc(100%+3rem)] pointer-events-none overflow-visible z-0">
          <motion.rect
            width="100%"
            height="100%"
            rx="100"
            fill="none"
            strokeWidth="4"
            className="stroke-black dark:stroke-white"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut", delay: 0.8 }}
          />
          
          <motion.rect
            width="100%"
            height="100%"
            rx="100"
            fill="none"
            strokeWidth="6"
            className="stroke-white dark:stroke-black"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut", delay: 1.1 }}
          />
        </svg>
      )}
    </div>
  );
};
