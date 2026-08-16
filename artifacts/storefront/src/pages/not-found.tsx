import { Link } from 'wouter';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getProductImage } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 opacity-20 mix-blend-luminosity">
        <img src={getProductImage('cyberpunk-girl')} alt="Background" className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center max-w-2xl px-6"
      >
        <div className="flex justify-center mb-6">
          <AlertTriangle className="w-16 h-16 text-primary" />
        </div>
        <h1 className="text-7xl md:text-9xl font-display font-bold text-white tracking-[0.2em] mb-4">
          404
        </h1>
        <h2 className="text-2xl md:text-3xl font-mono uppercase tracking-[0.3em] text-primary mb-6">
          Sector Not Found
        </h2>
        <p className="font-mono text-muted-foreground uppercase tracking-widest mb-12">
          You have drifted out of bounds. The coordinates you entered do not exist in this sector.
        </p>
        
        <Link href="/" className="inline-flex bg-white text-black px-10 py-4 font-mono font-bold uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-colors items-center gap-3 group">
          Return to Base <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </motion.div>
    </div>
  );
}
