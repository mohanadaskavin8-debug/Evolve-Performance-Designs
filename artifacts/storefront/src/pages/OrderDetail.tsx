import { useState } from 'react';
import { useRoute } from 'wouter';
import { useLookupOrder } from '@workspace/api-client-react';
import { useUser } from '@clerk/react';
import { formatPrice, getProductImage } from '@/lib/utils';
import { Link } from 'wouter';
import { ArrowLeft, Package, MapPin, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OrderDetail() {
  const [, params] = useRoute('/orders/:orderNumber');
  const orderNumber = params?.orderNumber || '';
  
  const { isLoaded, user } = useUser();
  const [emailInput, setEmailInput] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  // If user is logged in, we can use their email. If not, we wait for input.
  const queryEmail = user?.primaryEmailAddress?.emailAddress || submittedEmail;
  const readyToQuery = !!orderNumber && !!queryEmail && isLoaded;

  const { data: order, isLoading, error } = useLookupOrder(
    { orderNumber, email: queryEmail },
    { query: { enabled: readyToQuery, queryKey: ['order', orderNumber, queryEmail], retry: false } }
  );

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedEmail(emailInput);
  };

  if (!isLoaded) return <div className="min-h-screen bg-background" />;

  // Needs email input state
  if (!readyToQuery && !user) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-24 flex items-center justify-center">
        <div className="max-w-md w-full border border-white/10 bg-black p-8 md:p-12 text-center">
          <h2 className="font-display font-bold uppercase tracking-widest text-white text-2xl mb-6">Security Clearance</h2>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-8">
            Enter the comms channel (email) used for order {orderNumber} to view intel.
          </p>
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <input 
              type="email" 
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="operative@domain.com"
              className="w-full bg-transparent border border-white/20 px-4 py-3 text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-primary text-center"
              required
            />
            <button type="submit" className="bg-white text-black font-mono font-bold uppercase tracking-widest py-3 hover:bg-primary hover:text-white transition-colors">
              Verify
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 bg-background flex justify-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen pt-32 bg-background text-center flex flex-col items-center">
        <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-white mb-4">Signal Lost</h1>
        <p className="font-mono text-muted-foreground uppercase tracking-widest mb-8">Order details could not be retrieved. Verify credentials.</p>
        <Link href={user ? "/account" : "/track"} className="bg-white text-black px-8 py-3 font-mono uppercase tracking-widest hover:bg-primary hover:text-white transition-colors">
          Return
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container mx-auto px-6 md:px-12 max-w-5xl">
        <Link href={user ? "/account" : "/track"} className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-white transition-colors mb-12">
          <ArrowLeft className="w-4 h-4" /> {user ? 'Operative Profile' : 'Track Ops'}
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-4">
              Intel: {order.orderNumber}
            </h1>
            <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest">
              <span className="text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>
              <span className="px-2 py-1 bg-white/10 text-white">{order.status}</span>
            </div>
          </div>
          {order.trackingUrl && (
            <a 
              href={order.trackingUrl} 
              target="_blank" 
              rel="noreferrer"
              className="bg-primary text-white font-mono uppercase tracking-widest px-6 py-3 text-xs hover:bg-white hover:text-black transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" /> Track Signal
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-6">
            {order.items.map(item => (
              <div key={item.id} className="border border-white/10 bg-black flex flex-col sm:flex-row gap-6 p-4">
                <div className="w-full sm:w-48 h-24 sm:h-auto sm:aspect-video relative overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                  <img 
                    src={item.imageUrl || getProductImage(item.productSlug)} 
                    alt={item.productName} 
                    className="strap-panorama absolute inset-0 opacity-80"
                  />
                </div>
                <div className="flex-1 py-2">
                  <h3 className="font-display font-bold uppercase tracking-widest text-white text-lg mb-1">{item.productName}</h3>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-4">
                    Variant: {item.size || item.color || item.variantSku}
                  </p>
                  <div className="flex justify-between items-center font-mono text-sm">
                    <span className="text-white/60">QTY: {item.quantity}</span>
                    <span className="text-white font-bold">{formatPrice(item.totalPriceInCents)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="border border-white/10 bg-white/[0.02] p-8">
              <h3 className="font-display font-bold uppercase tracking-widest text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" /> Logistics
              </h3>
              <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider space-y-1">
                <p className="text-white mb-2">{order.shippingAddress.name}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                <p>{order.shippingAddress.countryCode}</p>
              </div>
            </div>

            <div className="border border-white/10 bg-white/[0.02] p-8">
              <h3 className="font-display font-bold uppercase tracking-widest text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> Ledger
              </h3>
              <div className="space-y-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-white">{formatPrice(order.subtotalInCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-white">{formatPrice(order.shippingInCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span className="text-white">{formatPrice(order.taxInCents)}</span>
                </div>
                {order.discountInCents > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Discount</span>
                    <span>-{formatPrice(order.discountInCents)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-3 mt-3 flex justify-between font-bold text-base text-white">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(order.totalInCents)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
