import { useEffect, useRef } from 'react';
import { useGetHomepageContent, useListFeaturedProducts } from '@workspace/api-client-react';
import { ProductCard } from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const { data: content, isLoading: isContentLoading } = useGetHomepageContent({ query: { queryKey: ['homepage-content'] } });
  const { data: featured, isLoading: isFeaturedLoading } = useListFeaturedProducts({ query: { queryKey: ['featured-products'] } });
  
  const heroRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtextRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!isContentLoading && headlineRef.current) {
      gsap.fromTo(headlineRef.current, 
        { y: 50, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.2 }
      );
      gsap.fromTo(subtextRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.4 }
      );
    }
  }, [isContentLoading]);

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={import.meta.env.BASE_URL.replace(/\/$/, '') + "/products/jdm-night-city.jpg"} 
            alt="Hero background" 
            className="w-full h-full object-cover opacity-40"
            onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>
        
        <div className="container mx-auto px-4 z-10 text-center flex flex-col items-center mt-16">
          <Badge className="mb-6 animate-pulse font-mono uppercase">New Drop Live</Badge>
          <h1 ref={headlineRef} className="text-5xl md:text-7xl lg:text-9xl font-display font-bold uppercase tracking-tighter text-white mb-6 leading-none max-w-5xl opacity-0">
            {content?.heroHeadline || "TRAIN LIKE AN ANIME CHARACTER"}
          </h1>
          <p ref={subtextRef} className="text-lg md:text-2xl text-muted-foreground font-mono max-w-2xl mx-auto mb-10 opacity-0">
            {content?.heroSubtext || "Cinematic lifting straps for those who train with conviction. Every design is a universe."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="font-display uppercase tracking-widest text-lg h-14 px-8" asChild>
              <Link href="/products">{content?.heroCtaPrimary || "Shop Collection"}</Link>
            </Button>
            <Button size="lg" variant="outline" className="font-display uppercase tracking-widest text-lg h-14 px-8 bg-background/50 backdrop-blur-sm" asChild>
              <Link href="/collections/all">{content?.heroCtaSecondary || "View Collections"}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-tight text-primary">Featured Gear</h2>
              <p className="font-mono text-muted-foreground mt-2">The most sought-after artifacts.</p>
            </div>
            <Link href="/products" className="font-mono text-sm uppercase tracking-widest text-foreground hover:text-primary transition-colors border-b border-primary/30 pb-1">
              View All [→]
            </Link>
          </div>
          
          {isFeaturedLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map(i => <div key={i} className="aspect-[4/5] bg-card border border-border animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {featured?.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trust & Story Section */}
      <section className="py-24 bg-card border-y border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <Badge variant="secondary" className="mb-4 font-mono uppercase text-primary">The Lore</Badge>
              <h2 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-tight mb-6">Built For The Protagonist.</h2>
              <p className="font-mono text-muted-foreground mb-8 leading-relaxed text-lg">
                Evolve Performance isn't just another fitness brand. We blend the high-octane energy of anime, gaming, and cinematic universes with premium, heavy-duty lifting gear. When you strap in, you step into a new world. 
              </p>
              <div className="grid grid-cols-2 gap-8">
                <div className="border-l-2 border-primary pl-4">
                  <div className="text-4xl font-display font-bold text-foreground mb-1">10</div>
                  <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Unique Universes</div>
                </div>
                <div className="border-l-2 border-primary pl-4">
                  <div className="text-4xl font-display font-bold text-foreground mb-1">50k+</div>
                  <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Orders Shipped</div>
                </div>
                <div className="border-l-2 border-primary pl-4">
                  <div className="text-4xl font-display font-bold text-foreground mb-1">45</div>
                  <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Countries</div>
                </div>
                <div className="border-l-2 border-primary pl-4">
                  <div className="text-4xl font-display font-bold text-foreground mb-1">4.9</div>
                  <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Average Rating</div>
                </div>
              </div>
            </motion.div>
            <motion.div 
              className="relative"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="aspect-[4/5] md:aspect-square rounded-2xl overflow-hidden border border-border">
                <img 
                  src={import.meta.env.BASE_URL.replace(/\/$/, '') + "/products/shonen-protagonist.jpg"} 
                  alt="Brand Story" 
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
                  onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1526506114620-6d3ce039757f?q=80&w=1469&auto=format&fit=crop' }}
                />
              </div>
              <div className="absolute -bottom-6 -left-6 w-32 h-32 md:w-48 md:h-48 bg-background p-2 md:p-4 rounded-xl border border-border shadow-2xl hidden sm:block">
                <img 
                  src={import.meta.env.BASE_URL.replace(/\/$/, '') + "/products/cyberpunk-girl.jpg"} 
                  alt="Detail" 
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-32 bg-background text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 pattern-dots" />
        <div className="container mx-auto px-4 relative z-10 max-w-2xl">
          <h2 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tight mb-4">Join The Guild</h2>
          <p className="font-mono text-muted-foreground mb-10">
            Sign up for early access to limited drops, exclusive colorways, and community events.
          </p>
          <form className="flex flex-col sm:flex-row gap-4" onSubmit={e => { e.preventDefault(); /* integrate newsletter */ }}>
            <Input 
              type="email" 
              placeholder="YOUR EMAIL ADDRESS" 
              className="h-14 font-mono uppercase bg-card border-border text-center sm:text-left"
              required
            />
            <Button type="submit" size="lg" className="h-14 font-display uppercase tracking-widest px-8 w-full sm:w-auto">
              Subscribe
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
