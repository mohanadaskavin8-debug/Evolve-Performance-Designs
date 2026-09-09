import { Link } from 'wouter';
import { ShopProduct } from '@workspace/api-client-react';
import { formatPrice, getProductImage } from '@/lib/utils';
import { categorizeProduct, getCategory } from '@/lib/categories';
import { motion } from 'framer-motion';

export function ProductCard({ product }: { product: ShopProduct }) {
  const categorySlug = categorizeProduct(product);
  const category = getCategory(categorySlug);
  
  const hasValidPrice = product.priceMinInCents > 0;

  return (
    <Link href={`/products/${product.handle}`} data-testid={`card-product-${product.handle}`}>
      <motion.div
        whileHover={{ y: -10, scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 12 }}
        className="group relative flex flex-col cursor-pointer h-full"
      >
        {/* The Card */}
        <div className="relative w-full aspect-[4/3] md:aspect-video border border-white/10 bg-black overflow-hidden red-underglow mb-3 md:mb-4 flex-shrink-0">
          {/* Scanlines layer */}
          <div className="absolute inset-0 scanlines opacity-30 z-20 mix-blend-overlay pointer-events-none" />
          
          <img
            src={getProductImage(product.handle, product.imageUrl)}
            alt={product.title}
            className="absolute inset-0 w-full h-full object-cover z-0 group-hover:scale-105 transition-transform duration-700 ease-out"
          />

          <div className="absolute inset-0 bg-black/20 z-10 group-hover:bg-transparent transition-colors duration-500 pointer-events-none" />
          
          {/* Center Action Overlay */}
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/90 flex flex-col items-center justify-center text-black backdrop-blur-sm shadow-[0_0_20px_rgba(255,0,0,0.8)] opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
               <span className="font-display font-bold uppercase tracking-widest text-[10px] md:text-xs mb-1">View +</span>
            </div>
          </div>

          <div className="absolute inset-0 border-[0px] border-primary/0 group-hover:border-[2px] group-hover:border-primary transition-all duration-300 z-30 pointer-events-none" />

          {/* Badges */}
          <div className="absolute top-4 right-4 z-40 flex flex-col gap-2 items-end">
            {product.theme && (
              <div className="bg-black/80 border border-primary/50 text-primary px-2 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur-md">
                {product.theme}
              </div>
            )}
            {!product.availableForSale && (
              <div className="bg-black/80 border border-white/20 text-white px-2 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur-md">
                Out of Stock
              </div>
            )}
          </div>
        </div>

        {/* Labels Beneath */}
        <div className="text-left w-full z-10 flex-1 flex flex-col justify-between">
          <h3 className="font-display font-bold uppercase tracking-[0.1em] text-sm sm:text-base md:text-xl text-white group-hover:text-primary transition-colors glitch-text line-clamp-2" data-text={product.title}>
            {product.title}
          </h3>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-[9px] md:text-xs font-mono uppercase tracking-wider md:tracking-widest text-muted-foreground mt-2 md:mt-3 border-t border-white/10 pt-2 md:pt-3">
            <span className="truncate">{category?.name || 'Lifting Straps'}</span>
            <span className="text-white group-hover:text-primary transition-colors duration-300 whitespace-nowrap font-bold">
              {!hasValidPrice 
                ? 'PRICE TBA'
                : product.priceMinInCents === product.priceMaxInCents 
                  ? formatPrice(product.priceMinInCents) 
                  : `${formatPrice(product.priceMinInCents)} - ${formatPrice(product.priceMaxInCents)}`}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
