import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import gsap from 'gsap';
import { useRef } from 'react';

export default function CheckoutSuccess() {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = new URLSearchParams(window.location.search);
  const orderNumber = searchParams.get('orderNumber') || 'PENDING';
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.stagger-item', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power3.out'
      });
    }, containerRef);
    
    // Clear cart session ID since it was checked out
    localStorage.removeItem('ep_cart_session_id');

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-20 relative overflow-hidden" ref={containerRef}>
      <div className="absolute inset-0 z-0">
        <img src={import.meta.env.BASE_URL.replace(/\/$/, '') + "/products/neo-tokyo-drift.jpg"} className="w-full h-full object-cover opacity-10" alt="Background" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/50" />
      </div>

      <div className="container mx-auto px-4 relative z-10 text-center max-w-2xl">
        <div className="stagger-item w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-primary/50">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        
        <h1 className="stagger-item text-5xl md:text-7xl font-display font-bold uppercase tracking-tight mb-6">
          Mission Accomplished
        </h1>
        
        <p className="stagger-item font-mono text-muted-foreground text-lg mb-10">
          Your gear has been secured. Our logistics network is preparing your artifacts for deployment.
        </p>

        <div className="stagger-item bg-card border border-border p-8 rounded-xl mb-12">
          <span className="block font-mono text-sm text-muted-foreground uppercase tracking-widest mb-2">Order Designation</span>
          <span className="font-display text-4xl font-bold tracking-widest text-primary">{orderNumber}</span>
        </div>

        <div className="stagger-item flex flex-col sm:flex-row justify-center gap-4">
          <Button size="lg" className="h-14 font-display uppercase tracking-widest px-8" asChild>
            <Link href="/track">Track Deployment</Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 font-display uppercase tracking-widest px-8 bg-background" asChild>
            <Link href="/products">Return to Armory</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
