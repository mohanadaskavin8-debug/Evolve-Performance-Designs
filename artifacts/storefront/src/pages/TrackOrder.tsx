import { useState } from 'react';
import { useLookupTracking } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Search, Package, MapPin, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const { data: tracking, isLoading, error } = useLookupTracking(
    { orderNumber, email },
    { query: { enabled: hasSearched, queryKey: ['tracking', orderNumber, email], retry: false } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderNumber && email) {
      setHasSearched(true);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container mx-auto px-6 md:px-12 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6 text-center">
          Track Ops
        </h1>
        <div className="w-24 h-1 bg-primary mx-auto mb-16" />

        <div className="border border-white/10 bg-white/[0.02] p-8 md:p-12 mb-16">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-2">
              <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Order ID</label>
              <input 
                type="text" 
                placeholder="EV-12345"
                value={orderNumber}
                onChange={(e) => { setOrderNumber(e.target.value); setHasSearched(false); }}
                className="w-full bg-black border border-white/20 px-4 py-3 text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-primary transition-colors"
                required
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Comms (Email)</label>
              <input 
                type="email" 
                placeholder="operative@domain.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setHasSearched(false); }}
                className="w-full bg-black border border-white/20 px-4 py-3 text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-primary transition-colors"
                required
              />
            </div>
            <div className="flex items-end">
              <button 
                type="submit"
                disabled={isLoading}
                className="bg-white text-black px-8 py-3 font-mono font-bold uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-colors h-[46px] w-full md:w-auto flex items-center justify-center gap-2"
              >
                {isLoading ? <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <><Search className="w-4 h-4" /> Locate</>}
              </button>
            </div>
          </form>
        </div>

        {error && hasSearched && (
          <div className="border border-destructive/50 bg-destructive/10 text-destructive p-6 font-mono text-sm uppercase tracking-widest text-center">
            Signal lost. Invalid Order ID or Email provided.
          </div>
        )}

        {tracking && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-white/10 bg-black p-8 md:p-12"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-white/10 pb-8">
              <div>
                <h3 className="font-display font-bold uppercase tracking-[0.15em] text-white text-2xl mb-2">
                  Order {tracking.orderNumber}
                </h3>
                <p className="font-mono text-xs uppercase tracking-widest text-primary">Status: {tracking.status}</p>
              </div>
              <div className="font-mono text-sm uppercase tracking-widest text-muted-foreground text-left md:text-right">
                {tracking.carrier && <p>Carrier: <span className="text-white">{tracking.carrier}</span></p>}
                {tracking.trackingNumber && <p>Tracking: <span className="text-white">{tracking.trackingNumber}</span></p>}
              </div>
            </div>

            <div className="relative border-l border-white/20 ml-4 md:ml-8 space-y-12">
              {tracking.events.map((event, index) => {
                const Icon = event.isCompleted ? CheckCircle : event.isCurrent ? Package : MapPin;
                const isPast = event.isCompleted || event.isCurrent;
                
                return (
                  <div key={index} className="relative pl-10">
                    <div className={`absolute -left-[18px] p-1 rounded-full bg-black border-2 ${isPast ? 'border-primary text-primary' : 'border-white/20 text-white/20'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h4 className={`font-display font-bold uppercase tracking-widest text-lg mb-1 ${isPast ? 'text-white' : 'text-muted-foreground'}`}>
                      {event.label}
                    </h4>
                    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      {event.description}
                    </p>
                    {event.timestamp && (
                      <p className="font-mono text-xs text-white/50">{new Date(event.timestamp).toLocaleString()}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
