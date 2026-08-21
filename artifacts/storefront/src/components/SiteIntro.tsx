import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';

export function SiteIntro() {
  const [show, setShow] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    // Only run on initial load, not subsequent route changes
    // Check if we should skip intro
    const params = new URLSearchParams(window.location.search);
    const skipIntro = params.get('intro') === '0';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (skipIntro || reducedMotion) {
      setShow(false);
      return;
    }

    // Lock body scroll and make the app behind the overlay inert
    // (no keyboard focus / clicks on invisible content while the intro plays)
    const appRoot = document.querySelector('[data-site-root]');
    document.body.style.overflow = 'hidden';
    appRoot?.setAttribute('inert', '');
    setShow(true);

    // Unmount after 2.5s
    const timer = setTimeout(() => {
      setShow(false);
      document.body.style.overflow = '';
      appRoot?.removeAttribute('inert');
    }, 2500);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      appRoot?.removeAttribute('inert');
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          data-testid="site-intro"
          role="presentation"
          aria-hidden="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.5, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {/* Faint scanline flicker */}
          <div className="absolute inset-0 scanlines opacity-30 mix-blend-overlay" />
          
          {/* Letterbox top */}
          <motion.div 
            className="absolute top-0 left-0 w-full h-16 bg-black z-10"
            initial={{ y: 0 }}
            animate={{ y: "-100%" }}
            transition={{ delay: 2.1, duration: 0.4, ease: "easeIn" }}
          />
          {/* Letterbox bottom */}
          <motion.div 
            className="absolute bottom-0 left-0 w-full h-16 bg-black z-10"
            initial={{ y: 0 }}
            animate={{ y: "100%" }}
            transition={{ delay: 2.1, duration: 0.4, ease: "easeIn" }}
          />

          <motion.div
            className="relative flex flex-col items-center justify-center"
            initial={{ scale: 0.92, opacity: 0, filter: "brightness(0.5) blur(4px)" }}
            animate={{ scale: 1, opacity: 1, filter: "brightness(1) blur(0px)" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            {/* Logo wrapper */}
            <div className="relative">
              {/* Glow bloom behind logo */}
              <motion.div 
                className="absolute inset-0 bg-primary rounded-full blur-[40px] opacity-0"
                animate={{ opacity: [0, 0.4, 0] }}
                transition={{ delay: 1, duration: 1, ease: "easeInOut" }}
              />

              <img 
                src={`${import.meta.env.BASE_URL}brand/ep-logo-white.png`} 
                alt="Evolve Performance" 
                className="w-24 h-24 md:w-32 md:h-32 object-contain relative z-10" 
              />
              
              {/* Sweep light mask over the logo */}
              <motion.div
                className="absolute inset-0 z-20 mix-blend-overlay opacity-0"
                style={{
                  background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)",
                  backgroundSize: "200% 200%",
                }}
                animate={{ 
                  backgroundPosition: ["200% 200%", "-100% -100%"],
                  opacity: [0, 1, 0]
                }}
                transition={{ delay: 0.8, duration: 1, ease: "linear" }}
              />
            </div>

            <motion.h1
              className="mt-6 text-xl md:text-2xl font-display font-bold uppercase tracking-[0.4em] text-white text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.8, ease: "easeOut" }}
            >
              Evolve Performance
            </motion.h1>
            
            {/* Red Underglow pulse under text */}
            <motion.div 
              className="absolute -bottom-4 w-full h-[2px] bg-primary"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: [0, 1, 0] }}
              transition={{ delay: 1.4, duration: 0.8, ease: "easeInOut" }}
              style={{ boxShadow: "0 0 20px 4px rgba(255,0,0,0.6)" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
