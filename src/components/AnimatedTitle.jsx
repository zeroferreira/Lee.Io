import { motion } from 'framer-motion';

export const AnimatedTitle = ({ size = 'small', layoutIdPrefix = 'title' }) => {
  const isLarge = size === 'large';
  
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.8, // Slower stagger
        delayChildren: 0.5    // Initial delay
      },
    },
  };

  const item = {
    hidden: { y: -50, opacity: 0 }, // Start higher up
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 60, damping: 15 }, // Slower, softer spring
    },
  };

  return (
    <motion.div
      className={`flex items-end font-bold ${isLarge ? 'text-6xl md:text-8xl' : 'text-2xl'}`}
      initial={isLarge ? "hidden" : undefined} // Only animate entrance when large (intro)
      animate={isLarge ? "visible" : undefined}
      variants={container}
      layoutId={layoutIdPrefix} // Add container layoutId for smoother group movement
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
  );
};
