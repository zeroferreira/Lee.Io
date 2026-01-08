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
          <defs>
            <filter id="pencil-effect">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" />
            </filter>
            <filter id="pencil-effect-2">
              <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="4" seed="5" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
            </filter>
          </defs>
          
          {/* Main heavy stroke */}
          <motion.rect
            width="100%"
            height="100%"
            rx="100"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-foreground opacity-70"
            filter="url(#pencil-effect)"
            initial={{ pathLength: 0, opacity: 0, pathOffset: 0 }}
            animate={{ 
              pathLength: [0, 1.05, 1.05], 
              pathOffset: [0, 0, 1],
              opacity: [0, 1, 1, 0] 
            }}
            transition={{ 
              duration: 1.5, 
              times: [0, 0.5, 0.9, 1],
              ease: "easeInOut", 
              delay: 0.5 
            }}
          />

          {/* Secondary lighter stroke for messy/sketchy look */}
          <motion.rect
            width="100%"
            height="100%"
            rx="100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-foreground opacity-50"
            filter="url(#pencil-effect-2)"
            initial={{ pathLength: 0, opacity: 0, pathOffset: 0 }}
            animate={{ 
              pathLength: [0, 1.1, 1.1], 
              pathOffset: [0, 0, 1],
              opacity: [0, 1, 1, 0] 
            }}
            transition={{ 
              duration: 1.6, 
              times: [0, 0.5, 0.9, 1],
              ease: "easeInOut", 
              delay: 0.6 
            }}
          />
        </svg>
      )}
    </div>
  );
};
