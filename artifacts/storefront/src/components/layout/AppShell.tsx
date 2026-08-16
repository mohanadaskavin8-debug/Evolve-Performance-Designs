import React, { useState } from 'react';
import { Link } from 'wouter';
import { ShoppingCart, Menu, X, User, ChevronRight, ArrowRight, CheckCircle } from 'lucide-react';
import { useGetSiteSettings, useGetCart, useSubscribeNewsletter } from '@workspace/api-client-react';
import { getCartSessionId } from '@/lib/utils';
import { useUser } from '@clerk/react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground relative">
      <div className="grain-overlay" />
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Navbar() {
  const { data: settings } = useGetSiteSettings({ query: { queryKey: ['site-settings'] } });
  const { data: cart } = useGetCart({ sessionId: getCartSessionId() }, { query: { queryKey: ['cart', getCartSessionId()] } });
  const { isSignedIn } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {settings?.announcementBanner && (
        <div className="fixed top-0 left-0 right-0 h-8 bg-foreground text-background flex items-center justify-center text-xs font-mono tracking-widest z-50 uppercase">
          {settings.announcementBanner}
        </div>
      )}
      
      <header className={`fixed ${settings?.announcementBanner ? 'top-8' : 'top-0'} left-0 right-0 h-20 border-b border-white/5 bg-background/60 backdrop-blur-xl z-40 transition-all`}>
        <div className="px-6 md:px-12 h-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button className="md:hidden text-white hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <Link href="/" className="flex items-center gap-3 group">
              <img 
                src={import.meta.env.BASE_URL + "brand/ep-logo-white.png"}
                alt="Evolve Performance"
                className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/40?text=EP';
                }}
              />
              <span className="font-display font-bold uppercase tracking-[0.2em] hidden md:block text-xl mt-1">
                Evolve
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-10">
            <Link href="/products" className="text-sm font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-white transition-colors relative group">
              Equip
              <span className="absolute -bottom-2 left-0 w-0 h-px bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
            <Link href="/collections/all" className="text-sm font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-white transition-colors relative group">
              Series
              <span className="absolute -bottom-2 left-0 w-0 h-px bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          </nav>

          <div className="flex items-center gap-6">
            {isSignedIn ? (
              <Link href="/account" className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-white transition-colors">
                <User className="w-5 h-5" />
              </Link>
            ) : (
              <Link href="/sign-in" className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-white transition-colors">
                <span className="text-xs font-mono uppercase tracking-widest">Login</span>
              </Link>
            )}
            
            <Link href="/cart" className="relative text-muted-foreground hover:text-white transition-colors flex items-center">
              <ShoppingCart className="w-5 h-5" />
              {cart?.itemCount ? (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-sm">
                  {cart.itemCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(16px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className={`fixed inset-0 ${settings?.announcementBanner ? 'top-24' : 'top-20'} z-30 bg-background/95 md:hidden`}
          >
            <nav className="flex flex-col p-8 gap-8">
              <Link href="/products" className="text-2xl font-display font-bold uppercase tracking-widest text-muted-foreground hover:text-white flex justify-between items-center" onClick={() => setMobileMenuOpen(false)}>
                Equip <ChevronRight className="w-6 h-6 text-primary" />
              </Link>
              <div className="h-px bg-white/10 w-full" />
              <Link href="/collections/all" className="text-2xl font-display font-bold uppercase tracking-widest text-muted-foreground hover:text-white flex justify-between items-center" onClick={() => setMobileMenuOpen(false)}>
                Series <ChevronRight className="w-6 h-6 text-primary" />
              </Link>
              <div className="h-px bg-white/10 w-full" />
              <Link href="/track" className="text-2xl font-display font-bold uppercase tracking-widest text-muted-foreground hover:text-white flex justify-between items-center" onClick={() => setMobileMenuOpen(false)}>
                Track Ops <ChevronRight className="w-6 h-6 text-primary" />
              </Link>
              <div className="h-px bg-white/10 w-full" />
              <Link href={isSignedIn ? '/account' : '/sign-in'} className="text-2xl font-display font-bold uppercase tracking-widest text-muted-foreground hover:text-white flex justify-between items-center" onClick={() => setMobileMenuOpen(false)}>
                {isSignedIn ? 'Profile' : 'Authenticate'} <ChevronRight className="w-6 h-6 text-primary" />
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);
  const subscribe = useSubscribeNewsletter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || subscribe.isPending) return;
    subscribe.mutate(
      { data: { email: trimmed } },
      { onSuccess: () => setJoined(true) }
    );
  };

  if (joined) {
    return (
      <div className="flex items-center gap-3 font-mono text-sm uppercase tracking-widest text-white" data-testid="text-newsletter-success">
        <CheckCircle className="w-5 h-5 text-primary" />
        You're in. Welcome to the crew.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full md:w-auto" data-testid="form-newsletter">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          placeholder="operative@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full sm:w-72 bg-black border border-white/20 px-4 py-3 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-primary transition-colors"
          data-testid="input-newsletter-email"
        />
        <button
          type="submit"
          disabled={subscribe.isPending}
          className="bg-white text-black px-6 py-3 font-mono font-bold uppercase tracking-[0.2em] text-sm hover:bg-primary hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="button-newsletter-subscribe"
        >
          {subscribe.isPending ? 'Joining…' : <>Enlist <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
      {subscribe.isError && (
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-destructive">
          {((subscribe.error as any)?.data?.error) || 'Something went wrong — try again.'}
        </p>
      )}
    </form>
  );
}

function Footer() {
  const { data: settings } = useGetSiteSettings({ query: { queryKey: ['site-settings'] } });

  return (
    <footer className="border-t border-white/10 bg-background pt-20 pb-10">
      <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="flex items-center gap-4 mb-6 group inline-flex">
            <img 
              src={import.meta.env.BASE_URL + "brand/ep-logo-white.png"}
              alt="Evolve Performance"
              className="w-12 h-12 object-contain group-hover:scale-110 transition-transform duration-500"
            />
            <span className="font-display font-bold uppercase tracking-[0.2em] text-2xl mt-1">
              Evolve
            </span>
          </Link>
          <p className="text-muted-foreground text-sm font-mono max-w-md leading-relaxed">
            Train with conviction. Cinematic lifting gear built for athletes who push beyond their limits. Equip yourself for the next level.
          </p>
        </div>
        
        <div>
          <h4 className="font-display font-bold uppercase tracking-[0.2em] mb-6 text-white text-lg">Armory</h4>
          <ul className="space-y-4 text-sm font-mono text-muted-foreground uppercase tracking-wider">
            <li><Link href="/products" className="hover:text-primary transition-colors">All Gear</Link></li>
            <li><Link href="/collections/all" className="hover:text-primary transition-colors">Series</Link></li>
            <li><Link href="/track" className="hover:text-primary transition-colors">Track Ops</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-display font-bold uppercase tracking-[0.2em] mb-6 text-white text-lg">Comms</h4>
          <ul className="space-y-4 text-sm font-mono text-muted-foreground uppercase tracking-wider">
            <li><Link href="/support" className="hover:text-primary transition-colors">Contact Command</Link></li>
            <li><Link href="/pages/faq" className="hover:text-primary transition-colors">Intel (FAQ)</Link></li>
            <li><Link href="/pages/shipping-policy" className="hover:text-primary transition-colors">Deployment</Link></li>
            <li><Link href="/pages/return-policy" className="hover:text-primary transition-colors">Returns</Link></li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto px-6 md:px-12 mt-16">
        <div className="border border-white/10 bg-white/[0.02] p-8 md:p-10 flex flex-col md:flex-row md:items-end gap-8 justify-between">
          <div className="max-w-md">
            <h4 className="font-display font-bold uppercase tracking-[0.2em] text-white text-lg mb-3">Join the crew</h4>
            <p className="text-muted-foreground text-sm font-mono leading-relaxed">
              Training intel, drop alerts, and member-only deals. No spam — unsubscribe anytime.
            </p>
          </div>
          <NewsletterSignup />
        </div>
      </div>
      <div className="container mx-auto px-6 md:px-12 mt-20 pt-8 border-t border-white/5 text-xs font-mono text-muted-foreground flex flex-col md:flex-row justify-between items-center uppercase tracking-widest">
        <p>&copy; {new Date().getFullYear()} {settings?.businessName || 'Evolve Performance'}. All rights reserved.</p>
        <div className="flex gap-8 mt-6 md:mt-0">
          <Link href="/pages/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/pages/terms" className="hover:text-white transition-colors">Terms</Link>
           <a href="/admin/" className="hover:text-white transition-colors">Admin</a>
        </div>
      </div>
    </footer>
  );
}
