import { useListFeaturedProducts, useGetHomepageContent } from '@workspace/api-client-react';
import { ProductCard } from '@/components/ProductCard';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { getProductImage } from '@/lib/utils';
import { useRef } from 'react';

export default function Home() {
  const { data: products, isLoading: productsLoading } = useListFeaturedProducts();
  const { data: content, isLoading: contentLoading } = useGetHomepageContent();

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  if (productsLoading || contentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Use a specific cinematic strap for the hero background, maybe neon-japan or cyberpunk-girl
  const heroImage = getProductImage('neon-japan');

  return (
    <div className="bg-background">
      {/* Cinematic Hero */}
      <section ref={heroRef} className="relative h-screen w-full overflow-hidden flex items-center justify-center border-b border-white/10">
        <motion.div 
          className="absolute inset-0 w-full h-full"
          style={{ y, opacity }}
        >
          <img 
            src={heroImage} 
            alt="Hero Background" 
            className="w-full h-full object-cover object-center opacity-60 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
        </motion.div>
        
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto flex flex-col items-center mt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold uppercase tracking-[0.2em] text-white leading-none mb-6">
              {content?.heroHeadline || "Level Up Your Lift"}
            </h1>
            <p className="text-lg md:text-xl font-mono text-muted-foreground uppercase tracking-widest max-w-2xl mx-auto leading-relaxed mb-12 border-l border-r border-primary/50 px-8">
              {content?.heroSubtext || "Cinematic lifting gear built for athletes who push beyond limits."}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6">
              <Link 
                href="/products"
                className="bg-primary text-white font-mono uppercase tracking-[0.2em] px-10 py-4 text-sm hover:bg-white hover:text-black transition-colors duration-300 flex items-center justify-center gap-3 group border border-primary hover:border-white"
              >
                {content?.heroCtaPrimary || "Deploy Now"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="/collections/all"
                className="bg-transparent text-white border border-white/30 font-mono uppercase tracking-[0.2em] px-10 py-4 text-sm hover:bg-white/10 transition-colors duration-300 flex items-center justify-center"
              >
                {content?.heroCtaSecondary || "View Series"}
              </Link>
            </div>
          </motion.div>
        </div>

        <motion.div 
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Scroll for Intel</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </motion.div>
      </section>

      {/* Featured Gear (Marquee/Wide format showcase) */}
      <section className="py-32 relative z-20 bg-background border-b border-white/5">
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-[0.2em] text-white">
                Featured Specs
              </h2>
              <div className="w-24 h-1 bg-primary mt-6" />
            </div>
            <Link href="/products" className="font-mono text-sm uppercase tracking-widest text-muted-foreground hover:text-white flex items-center gap-2 transition-colors">
              View All Specs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="flex flex-col gap-12">
            {products?.map((product, index) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
            
            {products?.length === 0 && (
              <div className="text-center py-20 font-mono text-muted-foreground uppercase tracking-widest border border-white/10">
                No active drops found.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Philosophy / Cinematic Banner */}
      <section className="py-32 relative overflow-hidden bg-black border-b border-white/5">
        <div className="absolute inset-0 opacity-40">
          <img src={getProductImage('ninja-fire')} className="w-full h-full object-cover grayscale mix-blend-screen" alt="Background" />
        </div>
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="max-w-3xl mx-auto text-center border border-white/10 bg-black/60 backdrop-blur-xl p-12 md:p-20">
            <h2 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-8">
              More Than A Strap
            </h2>
            <p className="font-mono text-muted-foreground leading-loose tracking-wider uppercase text-sm md:text-base">
              Every design is an original cinematic frame. Woven with military-grade materials, engineered to withstand extreme tension, and printed edge-to-edge. When you wrap the bar, you aren't just lifting—you're stepping into another universe.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
