import { useListShopProducts, useGetHomepageContent, ShopProduct } from '@workspace/api-client-react';
import { ProductCard } from '@/components/ProductCard';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowRight, Play, ShieldCheck, Truck, Lock } from 'lucide-react';
import { formatPrice, getProductImage } from '@/lib/utils';
import { CATEGORIES, categorizeProduct, CategoryDef } from '@/lib/categories';

function HomeCategoryPanel({ category, image, testId, delay, products }: { category: CategoryDef, image: string, testId: string, delay: number, products: ShopProduct[] }) {
  const minPrice = Math.min(...products.map(p => p.priceMinInCents).filter(p => p > 0));
  const hasValidPrice = minPrice > 0 && minPrice !== Infinity;
  
  return (
    <Link href={`/category/${category.slug}`} data-testid={testId} className="block w-full group relative cursor-pointer">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.8, delay, ease: "easeOut" } }}
        whileHover={{ y: -12, scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 260, damping: 13 }}
        className="flex flex-col items-center w-full"
      >
        {/* The Card */}
        <div className="relative w-full aspect-[4/3] md:aspect-video border border-white/10 bg-black overflow-hidden red-underglow mb-6">
          <div className="absolute inset-0 scanlines opacity-30 z-20 pointer-events-none mix-blend-overlay" />
          
          <img
            src={image}
            className="absolute inset-0 w-full h-full object-cover z-0 group-hover:scale-105 transition-transform duration-700 ease-out"
            alt={category.name}
          />

          <div className="absolute inset-0 bg-black/25 group-hover:bg-black/5 transition-colors duration-700 z-10" />

          {/* Hover border effect inside the panel */}
          <div className="absolute inset-0 border-[0px] border-primary/0 group-hover:border-[4px] group-hover:border-primary transition-all duration-500 z-30 pointer-events-none" />

          {/* Commerce Chips */}
          <div className="absolute top-4 right-4 z-40 flex flex-col items-end gap-2 pointer-events-none">
            <div className="bg-black/80 border border-white/20 text-white px-2 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur-md">
              {products.length} Design{products.length === 1 ? '' : 's'}
            </div>
            {hasValidPrice && (
              <div className="bg-black/80 border border-primary/50 text-primary px-2 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur-md">
                From {formatPrice(minPrice)}
              </div>
            )}
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

  const liftingStraps = products.filter(p => categorizeProduct(p) === 'lifting-straps');

  if (contentLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const tickerItems = [
    "FREE WORLDWIDE SHIPPING OVER $75",
    "NEW DROPS INCOMING",
    "EP-01 LIFTING STRAPS",
    "EP-02 WRIST WRAPS",
    "BUILT FOR HEAVY PULLS",
  ];

  return (
    <div className="bg-black">
      {/* 2-Panel Cinematic Hero */}
      <section className="min-h-[90vh] bg-black pt-24 pb-20 flex flex-col justify-center border-b border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.1),transparent_60%)] pointer-events-none" />
        
        <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <HomeCategoryPanel category={CATEGORIES[0]} image={liftingImage} testId="hero-lifting-straps" delay={0.2} products={liftingStraps} />
            <HomeCategoryPanel category={CATEGORIES[1]} image={wristImage} testId="hero-wrist-wraps" delay={0.4} products={wristWraps} />
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

      {/* Infinite Marquee Ticker */}
      <div className="w-full overflow-hidden bg-primary py-3 flex relative z-20 border-y border-white/10">
        <motion.div 
          className="flex whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        >
          {/* Double the items for seamless loop */}
          {[...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
            <div key={i} className="flex items-center">
              <span className="text-black font-display font-bold uppercase tracking-[0.2em] text-sm md:text-base px-8">
                {item}
              </span>
              <span className="text-black/50 text-xl font-black">·</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Compact Trust/Benefit Strip */}
      <section className="py-12 bg-black border-b border-white/5 relative z-20">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <ShieldCheck className="w-8 h-8 text-primary mb-3" />
              <h4 className="text-white font-display font-bold uppercase tracking-[0.1em] text-sm mb-1">Secure Checkout</h4>
              <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">Encrypted by Shopify</p>
            </div>
            <div className="flex flex-col items-center">
              <Truck className="w-8 h-8 text-primary mb-3" />
              <h4 className="text-white font-display font-bold uppercase tracking-[0.1em] text-sm mb-1">Global Deploy</h4>
              <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">Worldwide Shipping</p>
            </div>
            <div className="flex flex-col items-center">
              <Lock className="w-8 h-8 text-primary mb-3" />
              <h4 className="text-white font-display font-bold uppercase tracking-[0.1em] text-sm mb-1">Built For War</h4>
              <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">Heavy Pull Rated</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Gear (Shoppable Product Row) */}
      <section className="py-24 relative z-20 bg-black border-b border-white/5">
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white glitch-text" data-text="LATEST DROPS">
                LATEST DROPS
              </h2>
              <div className="w-24 h-1 bg-primary mt-6 shadow-[0_0_10px_rgba(255,0,0,0.8)]" />
            </motion.div>
            <Link href="/products" className="font-mono text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group">
              ALL GEAR <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 gap-y-12">
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
      <section className="py-24 relative overflow-hidden bg-black">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 scanlines opacity-50 z-20 pointer-events-none" />
          <motion.img 
            src={getProductImage('ninja-fire')} 
            className="w-full h-full object-cover opacity-40" 
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
            className="max-w-3xl mx-auto text-center border border-primary/20 bg-black/80 backdrop-blur-xl p-10 md:p-16 shadow-[0_0_50px_rgba(255,0,0,0.15)] red-underglow"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6 glitch-text" data-text="More Than A Strap">
              More Than A Strap
            </h2>
            <div className="w-16 h-1 bg-primary mx-auto mb-6 shadow-[0_0_10px_rgba(255,0,0,0.8)]" />
            <p className="font-mono text-muted-foreground leading-relaxed tracking-widest uppercase text-xs md:text-sm">
              Original cinematic frames woven with military-grade materials. Engineered for extreme tension. When you wrap the bar, step into another universe.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
