import { useListShopProducts } from '@workspace/api-client-react';
import { useRoute, Link } from 'wouter';
import { motion } from 'framer-motion';
import { ProductCard } from '@/components/ProductCard';
import { getCategory, categorizeProduct } from '@/lib/categories';

export default function Category() {
  const [, params] = useRoute('/category/:slug');
  const category = getCategory(params?.slug);

  const { data, isLoading } = useListShopProducts({ limit: 50 });

  if (!category) {
    return (
      <div className="min-h-screen bg-black pt-40 pb-24 text-center">
        <p className="font-mono text-muted-foreground uppercase tracking-widest mb-8 glitch-text" data-text="Unknown sector.">
          Unknown sector.
        </p>
        <Link href="/" className="font-mono text-sm uppercase tracking-widest text-primary hover:text-white transition-colors">
          Return to base
        </Link>
      </div>
    );
  }

  const products = (data?.products ?? []).filter(
    (p) => categorizeProduct(p) === category.slug,
  );

  return (
    <div className="min-h-screen bg-black pt-32 pb-24 relative overflow-hidden">
      <div className="absolute inset-0 scanlines opacity-20 pointer-events-none" />
      <div className="container mx-auto px-6 md:px-12 relative z-10">
        <div className="mb-20 text-center">
          <motion.p 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-4"
          >
            {category.code} / Select your design
          </motion.p>
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="text-5xl md:text-7xl lg:text-8xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6 glitch-text"
            data-text={category.name}
          >
            {category.name}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="font-mono text-sm md:text-base text-muted-foreground uppercase tracking-widest max-w-2xl mx-auto"
          >
            {category.tagline}
          </motion.p>
          <motion.div 
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="w-24 h-1 bg-primary mx-auto mt-8 origin-center shadow-[0_0_15px_rgba(255,0,0,0.8)]" 
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 gap-y-16 max-w-6xl mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full aspect-[4/3] md:aspect-video bg-white/5 animate-pulse border border-white/10" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-32 text-center border border-white/10 bg-black/50 backdrop-blur-sm red-underglow max-w-2xl mx-auto mt-12"
          >
            <p className="font-mono text-muted-foreground uppercase tracking-widest glitch-text" data-text="New drops incoming. Check back soon.">
              New drops incoming. Check back soon.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 gap-y-16 max-w-6xl mx-auto">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
