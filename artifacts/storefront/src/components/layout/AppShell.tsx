import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'wouter';
import { ShoppingCart, Menu, X, User } from 'lucide-react';
import { useGetSiteSettings, useGetCart } from '@workspace/api-client-react';
import { getCartSessionId } from '@/lib/utils';
import { useUser, SignOutButton } from '@clerk/react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem('ep_intro_seen');
    if (!hasSeenIntro) {
      setShowIntro(true);
    }
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
    sessionStorage.setItem('ep_intro_seen', 'true');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground relative">
      <div className="grain-overlay" />
      
      <AnimatePresence>
        {showIntro && <IntroScreen onComplete={handleIntroComplete} />}
      </AnimatePresence>

      <Navbar />
      
      <main className="flex-1 pt-16">
        {children}
      </main>

      <Footer />
    </div>
  );
}

function IntroScreen({ onComplete }: { onComplete: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.to(containerRef.current, { opacity: 0, duration: 0.5, onComplete });
        }
      });

      tl.from(logoRef.current, { scale: 0.5, opacity: 0, duration: 1, ease: "power4.out" })
        .to(logoRef.current, { scale: 1.1, duration: 0.5, ease: "power2.inOut" })
        .from(textRef.current, { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.2")
        .to({}, { duration: 1.5 }); // Hold

    }, containerRef);

    return () => ctx.revert();
  }, [onComplete]);

  return (
    <motion.div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
      exit={{ opacity: 0 }}
    >
      <img 
        ref={logoRef}
        src={import.meta.env.BASE_URL + "assets/Image_4_1786835910739.jpeg"}
        alt="Evolve Performance"
        className="w-32 h-32 rounded-full mb-8"
        onError={(e) => {
          e.currentTarget.src = 'https://via.placeholder.com/128?text=EP';
        }}
      />
      <h1 ref={textRef} className="text-xl md:text-3xl font-display font-bold tracking-widest text-primary">
        TRAIN LIKE AN ANIME CHARACTER
      </h1>
      <button 
        onClick={onComplete}
        className="absolute bottom-10 text-muted-foreground hover:text-white transition-colors uppercase tracking-widest text-sm font-mono"
      >
        Skip
      </button>
    </motion.div>
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
        <div className="fixed top-0 left-0 right-0 h-8 bg-primary text-primary-foreground flex items-center justify-center text-xs font-mono tracking-wider z-40">
          {settings.announcementBanner}
        </div>
      )}
      
      <header className={`fixed ${settings?.announcementBanner ? 'top-8' : 'top-0'} left-0 right-0 h-16 border-b border-border/50 bg-background/80 backdrop-blur-md z-40 transition-all`}>
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <Link href="/" className="flex items-center gap-3">
              <img 
                src={import.meta.env.BASE_URL + "assets/Image_4_1786835910739.jpeg"}
                alt="Logo"
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/32?text=EP';
                }}
              />
              <span className="font-display font-bold uppercase tracking-wider hidden md:block">
                {settings?.businessName || 'Evolve Performance'}
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/products" className="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors">
              Shop
            </Link>
            <Link href="/products?collection=all" className="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors">
              Collections
            </Link>
            <Link href="/track" className="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors">
              Track Order
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <Link href="/account" className="hidden md:flex items-center gap-2 hover:text-primary transition-colors">
                <User className="w-5 h-5" />
              </Link>
            ) : (
              <Link href="/account" className="hidden md:flex items-center gap-2 hover:text-primary transition-colors">
                <span className="text-sm font-bold uppercase tracking-widest">Login</span>
              </Link>
            )}
            
            <Link href="/cart" className="relative hover:text-primary transition-colors flex items-center">
              <ShoppingCart className="w-5 h-5" />
              {cart?.itemCount ? (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
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
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed inset-0 ${settings?.announcementBanner ? 'top-24' : 'top-16'} z-30 bg-background border-b border-border md:hidden`}
          >
            <nav className="flex flex-col p-6 gap-6">
              <Link href="/products" className="text-xl font-display font-bold uppercase tracking-widest hover:text-primary" onClick={() => setMobileMenuOpen(false)}>
                Shop All
              </Link>
              <Link href="/products?collection=all" className="text-xl font-display font-bold uppercase tracking-widest hover:text-primary" onClick={() => setMobileMenuOpen(false)}>
                Collections
              </Link>
              <Link href="/track" className="text-xl font-display font-bold uppercase tracking-widest hover:text-primary" onClick={() => setMobileMenuOpen(false)}>
                Track Order
              </Link>
              <div className="h-px bg-border my-2" />
              <Link href="/account" className="text-xl font-display font-bold uppercase tracking-widest hover:text-primary" onClick={() => setMobileMenuOpen(false)}>
                {isSignedIn ? 'My Account' : 'Login / Sign Up'}
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Footer() {
  const { data: settings } = useGetSiteSettings({ query: { queryKey: ['site-settings'] } });

  return (
    <footer className="border-t border-border mt-24 bg-card py-12">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="flex items-center gap-3 mb-4">
            <img 
              src={import.meta.env.BASE_URL + "assets/Image_4_1786835910739.jpeg"}
              alt="Logo"
              className="w-8 h-8 rounded-full"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/32?text=EP';
              }}
            />
            <span className="font-display font-bold uppercase tracking-wider">
              {settings?.businessName || 'Evolve Performance'}
            </span>
          </Link>
          <p className="text-muted-foreground text-sm font-mono max-w-sm">
            Train with conviction. Cinematic lifting gear built for athletes who push beyond their limits.
          </p>
        </div>
        
        <div>
          <h4 className="font-display font-bold uppercase tracking-widest mb-4">Shop</h4>
          <ul className="space-y-2 text-sm font-mono text-muted-foreground">
            <li><Link href="/products" className="hover:text-primary">All Products</Link></li>
            <li><Link href="/collections/all" className="hover:text-primary">Collections</Link></li>
            <li><Link href="/track" className="hover:text-primary">Track Order</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-display font-bold uppercase tracking-widest mb-4">Support</h4>
          <ul className="space-y-2 text-sm font-mono text-muted-foreground">
            <li><Link href="/support" className="hover:text-primary">Contact Us</Link></li>
            <li><Link href="/pages/faq" className="hover:text-primary">FAQ</Link></li>
            <li><Link href="/pages/shipping-policy" className="hover:text-primary">Shipping Policy</Link></li>
            <li><Link href="/pages/return-policy" className="hover:text-primary">Returns</Link></li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto px-4 mt-12 pt-8 border-t border-border/50 text-xs font-mono text-muted-foreground flex flex-col md:flex-row justify-between items-center">
        <p>&copy; {new Date().getFullYear()} {settings?.businessName || 'Evolve Performance'}. All rights reserved.</p>
        <div className="flex gap-4 mt-4 md:mt-0">
          <Link href="/pages/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/pages/terms" className="hover:text-white">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
