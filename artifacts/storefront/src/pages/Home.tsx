import { useListShopProducts, useGetHomepageContent } from '@workspace/api-client-react';
import { ProductCard } from '@/components/ProductCard';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowRight, Play } from 'lucide-react';
import { getProductImage } from '@/lib/utils';
import { CATEGORIES, categorizeProduct, CategoryDef } from '@/lib/categories';

function HomeCategoryPanel({ category, image, testId, delay }: { category: CategoryDef, image: string, testId: string, delay: number }) {
  return (
    <Link href={`/category/${category.slug}`} data-testid={testId} className="block w-full group relative cursor-pointer">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay, ease: "easeOut" }}
        className="flex flex-col items-center w-full"
      >
        {/* The Card */}
        <div className="relative w-full aspect-[4/3] md:aspect-video border border-white/10 bg-black overflow-hidden red-underglow mb-6">
          <div className="absolute inset-0 scanlines opacity-50 z-20 pointer-events-none mix-blend-overlay" />
          
          <img
            src={image}
            className="absolute inset-0 w-full h-full object-cover z-0 grayscale mix-blend-luminosity opacity-50 group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-out"
            alt={category.name}
          />

          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors duration-700 z-10" />

          {/* Hover border effect inside the panel */}
          <div className="absolute inset-0 border-[0px] border-primary/0 group-hover:border-[4px] group-hover:border-primary transition-all duration-500 z-30 pointer-events-none" />

          {/* Recording indicator */}
          <div className="absolute top-4 left-4 z-40 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.8)]" />
            <span className="text-primary font-mono text-[10px] uppercase tracking-widest font-bold">Rec</span>
          </div>

          {/* Center Play / Shop Now button inside the card */}
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/90 flex flex-col items-center justify-center text-black backdrop-blur-sm shadow-[0_0_30px_rgba(255,0,0,0.8)] opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
               <span className="font-display font-bold uppercase tracking-widest text-xs md:text-sm mb-1">Shop</span>
               <Play className="w-6 h-6 md:w-8 md:h-8 fill-current" />
            </div>
          </div>
        </div>

        {/* Labels Beneath */}
        <div className="text-center w-full">
           <h2 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white group-hover:text-primary transition-colors duration-300 glitch-text" data-text={category.name}>
             {category.name}
           </h2>
           <p className="font-mono text-xs md:text-sm text-muted-foreground uppercase tracking-widest mt-3 opacity-80 group-hover:opacity-100 group-hover:text-white transition-colors duration-300">
             {category.tagline}
           </p>
        </div>
      </motion.div>
    </Link>
  );
}

export default function Home() {
  const { data, isLoading: productsLoading } = useListShopProducts({ limit: 50 });
  const { data: content, isLoading: contentLoading } = useGetHomepageContent();

  const products = data?.products || [];
  const wristWraps = products.filter(p => categorizeProduct(p) === 'wrist-wraps');
  
  const liftingImage = getProductImage('neon-japan');
  const wristImage = wristWraps[0]?.imageUrl || getProductImage('cyberpunk-girl');

  if (contentLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-black">
      {/* 2-Panel Cinematic Hero */}
      <section className="min-h-[90vh] bg-black pt-32 pb-20 flex flex-col justify-center border-b border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.1),transparent_60%)] pointer-events-none" />
        
        <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <HomeCategoryPanel category={CATEGORIES[0]} image={liftingImage} testId="hero-lifting-straps" delay={0.2} />
            <HomeCategoryPanel category={CATEGORIES[1]} image={wristImage} testId="hero-wrist-wraps" delay={0.4} />
          </div>
        </div>

        <motion.div 
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Scroll for Intel</span>
          <ArrowRight className="w-4 h-4 rotate-90 animate-bounce" />
        </motion.div>
      </section>

      {/* Explainer / Brand Text */}
      <section className="py-32 relative z-20 bg-black border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 scanlines opacity-20 pointer-events-none" />
        <div className="container mx-auto px-6 max-w-5xl relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold uppercase tracking-[0.2em] text-white leading-tight mb-8 glitch-text" data-text={content?.heroHeadline || "Level Up Your Lift"}>
              {content?.heroHeadline || "Level Up Your Lift"}
            </h2>
            <div className="w-24 h-1 bg-primary mx-auto mb-12 shadow-[0_0_15px_rgba(255,0,0,0.8)]" />
            <p className="text-lg md:text-xl font-mono text-muted-foreground uppercase tracking-widest max-w-3xl mx-auto leading-relaxed border-l-2 border-r-2 border-primary/50 px-8 py-4">
              {content?.heroSubtext || "Cinematic lifting gear built for athletes who push beyond limits."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured Gear */}
      <section className="py-32 relative z-20 bg-black border-b border-white/5">
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white glitch-text" data-text="Featured Specs">
                Featured Specs
              </h2>
              <div className="w-24 h-1 bg-primary mt-6 shadow-[0_0_10px_rgba(255,0,0,0.8)]" />
            </motion.div>
            <Link href="/products" className="font-mono text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
              View All Specs <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 gap-y-16 max-w-6xl mx-auto">
            {products.slice(0, 4).map((product, index) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy / Cinematic Banner */}
      <section className="py-40 relative overflow-hidden bg-black">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 scanlines opacity-50 z-20 pointer-events-none" />
          <motion.img 
            src={getProductImage('ninja-fire')} 
            className="w-full h-full object-cover grayscale mix-blend-luminosity opacity-40" 
            alt="Background" 
            initial={{ scale: 1 }}
            whileInView={{ scale: 1.1 }}
            transition={{ duration: 10, ease: "linear" }}
            viewport={{ once: false }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black z-10" />
        </div>
        <div className="container mx-auto px-6 md:px-12 relative z-20">
          <motion.div 
            className="max-w-4xl mx-auto text-center border border-primary/20 bg-black/80 backdrop-blur-xl p-12 md:p-24 shadow-[0_0_50px_rgba(255,0,0,0.15)] red-underglow"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-[0.2em] text-white mb-8 glitch-text" data-text="More Than A Strap">
              More Than A Strap
            </h2>
            <div className="w-16 h-1 bg-primary mx-auto mb-8 shadow-[0_0_10px_rgba(255,0,0,0.8)]" />
            <p className="font-mono text-muted-foreground leading-loose tracking-widest uppercase text-sm md:text-base">
              Every design is an original cinematic frame. Woven with military-grade materials, engineered to withstand extreme tension, and printed edge-to-edge. When you wrap the bar, you aren't just lifting—you're stepping into another universe.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
