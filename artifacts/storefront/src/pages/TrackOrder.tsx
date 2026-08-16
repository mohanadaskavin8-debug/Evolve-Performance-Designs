import { useState } from 'react';
import { useLookupTracking } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, Truck, CheckCircle2, Clock } from 'lucide-react';
import { useUser } from '@clerk/react';

export default function TrackOrder() {
  const { user } = useUser();
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress || '');
  const [orderNumber, setOrderNumber] = useState('');
  
  const [queryParams, setQueryParams] = useState<{orderNumber: string, email: string} | null>(null);

  const { data: timeline, isLoading, error } = useLookupTracking(
    (queryParams || { orderNumber: '', email: '' }), 
    { query: { queryKey: ['tracking', queryParams?.orderNumber, queryParams?.email], enabled: !!queryParams } }
  );

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !orderNumber) return;
    setQueryParams({ orderNumber, email });
  };

  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tight mb-4">
          Track Deployment
        </h1>
        <p className="font-mono text-muted-foreground">Monitor the status of your inbound artifacts.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 md:p-10 mb-12">
        <form onSubmit={handleTrack} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-display uppercase tracking-widest text-muted-foreground mb-2">Order Number</label>
            <Input 
              placeholder="EP-..." 
              className="h-14 font-mono uppercase bg-background"
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-display uppercase tracking-widest text-muted-foreground mb-2">Email Address</label>
            <Input 
              type="email"
              placeholder="EMAIL@EXAMPLE.COM" 
              className="h-14 font-mono uppercase bg-background"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" size="lg" className="h-14 font-display uppercase tracking-widest w-full md:w-auto px-8" disabled={isLoading}>
              {isLoading ? 'SCANNING...' : 'TRACK'}
            </Button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive font-mono text-center rounded-xl mb-12">
          Order not found. Please verify your details.
        </div>
      )}

      {timeline && (
        <div className="bg-card border border-border rounded-2xl p-6 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Truck className="w-64 h-64" />
          </div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-10 border-b border-border pb-6">
              <div>
                <h3 className="font-display font-bold uppercase tracking-widest text-2xl mb-1">Status: <span className="text-primary">{timeline.status}</span></h3>
                <p className="font-mono text-muted-foreground">Carrier: {timeline.carrier || 'Pending'} • Tracking: {timeline.trackingNumber || 'Pending'}</p>
              </div>
              {timeline.trackingUrl && (
                <Button variant="outline" size="sm" className="font-mono uppercase text-xs" asChild>
                  <a href={timeline.trackingUrl} target="_blank" rel="noopener noreferrer">View at Carrier</a>
                </Button>
              )}
            </div>

            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border">
              {timeline.events.map((event, idx) => {
                const isCompleted = event.isCompleted;
                const isCurrent = event.isCurrent;
                
                return (
                  <div key={idx} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${isCompleted ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-card bg-background z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      {isCompleted ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-background p-4 rounded-xl border ${isCurrent ? 'border-primary shadow-[0_0_15px_rgba(255,0,0,0.2)]' : 'border-border'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-display font-bold uppercase tracking-widest text-foreground">{event.label}</h4>
                        {event.timestamp && <span className="font-mono text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleDateString()}</span>}
                      </div>
                      <p className="font-mono text-sm text-muted-foreground">{event.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
