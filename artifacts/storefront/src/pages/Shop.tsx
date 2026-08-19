import { useListShopProducts, useListShopCollections } from '@workspace/api-client-react';
import { ProductCard } from '@/components/ProductCard';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

export default function Shop() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const collectionSlug = searchParams.get('collection');
  
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  const { data, isLoading } = useListShopProducts({
    collection: collectionSlug || undefined,
    limit: 50
  });

  const { data: collections } = useListShopCollections();

  // Extract unique themes from all products; theme filtering happens client-side
  const availableThemes = Array.from(new Set(data?.products.map(p => p.theme).filter(Boolean) as string[]));
  const visibleProducts = (data?.products ?? []).filter(p => !activeTheme || p.theme === activeTheme);

  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6">
            Armory / {collectionSlug ? collectionSlug.replace('-', ' ') : 'All Gear'}
          </h1>
          <div className="w-24 h-1 bg-primary mb-8" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-white/10 pb-8">
            {/* Collections Nav */}
            <div className="flex flex-wrap gap-6 font-mono text-sm uppercase tracking-widest">
              <Link 
                href="/products" 
                className={`${!collectionSlug ? 'text-white border-b border-primary pb-1' : 'text-muted-foreground hover:text-white'} transition-colors`}
              >
                All Series
              </Link>
              {collections?.map(c => (
                <Link 
                  key={c.id} 
                  href={`/products?collection=${c.handle}`}
                  className={`${collectionSlug === c.handle ? 'text-white border-b border-primary pb-1' : 'text-muted-foreground hover:text-white'} transition-colors`}
                >
                  {c.title}
                </Link>
              ))}
            </div>

            {/* Themes Filter (Optional if present) */}
            {availableThemes.length > 0 && (
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => setActiveTheme(null)}
                  className={`px-4 py-2 border font-mono text-xs uppercase tracking-widest transition-colors ${!activeTheme ? 'border-primary bg-primary/10 text-white' : 'border-white/20 text-muted-foreground hover:border-white/50'}`}
                >
                  All Themes
                </button>
                {availableThemes.map(theme => (
                  <button 
                    key={theme}
                    onClick={() => setActiveTheme(theme)}
                    className={`px-4 py-2 border font-mono text-xs uppercase tracking-widest transition-colors ${activeTheme === theme ? 'border-primary bg-primary/10 text-white' : 'border-white/20 text-muted-foreground hover:border-white/50'}`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product List */}
        {isLoading ? (
          <div className="flex flex-col gap-12">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-full h-[220px] bg-white/5 animate-pulse border border-white/10" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-16">
              {visibleProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>

            {visibleProducts.length === 0 && (
              <div className="py-32 text-center border border-white/10 bg-black/50 backdrop-blur-sm">
                <p className="font-mono text-muted-foreground uppercase tracking-widest">No gear available in this sector.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
