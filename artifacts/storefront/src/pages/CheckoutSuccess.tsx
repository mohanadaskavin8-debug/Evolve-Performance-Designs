import { Link } from 'wouter';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCartQueryKey } from '@workspace/api-client-react';
import { getCartSessionId } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function CheckoutSuccess() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Clear cart cache on success since backend cleared it during checkout conversion
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey({ sessionId: getCartSessionId() }) });
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-background pt-32 pb-24 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full border border-white/10 bg-white/[0.02] p-12 md:p-20 text-center"
      >
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center border border-primary">
            <CheckCircle className="w-12 h-12 text-primary" />
          </div>
        </div>
        
        <h1 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6">
          Mission Accomplished
        </h1>
        
        <p className="font-mono text-muted-foreground uppercase tracking-widest leading-relaxed mb-12">
          Your order has been secured. Intel and tracking data will be transmitted to your comms channel shortly. Prepare for deployment.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-6">
          <Link 
            href="/track" 
            className="bg-primary text-white px-8 py-4 font-mono font-bold uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
          >
            Track Status
          </Link>
          <Link 
            href="/products" 
            className="bg-transparent text-white border border-white/30 px-8 py-4 font-mono font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            Return to Armory <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
