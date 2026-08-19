import { Link } from 'wouter';
import { ShopProduct } from '@workspace/api-client-react';
import { formatPrice, getProductImage } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ProductCardProps {
  product: ShopProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.handle}`}>
      <motion.div 
        className="group relative flex flex-col cursor-pointer border border-white/10 bg-black overflow-hidden"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* The Panorama Strip */}
        <div className="relative w-full h-[120px] md:h-[180px] lg:h-[220px] overflow-hidden bg-black flex items-center justify-center">
          <img
            src={getProductImage(product.handle, product.imageUrl)}
            alt={product.title}
            className="strap-panorama absolute inset-0 transition-transform duration-1000 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
          
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-95 group-hover:scale-100">
            <div className="border border-primary/50 bg-black/50 backdrop-blur-md px-8 py-3 text-white font-mono uppercase tracking-[0.2em] text-xs">
              View Specs
            </div>
          </div>

          {product.theme && (
            <div className="absolute top-4 left-4 bg-black/80 border border-white/20 backdrop-blur-md px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground z-10">
              {product.theme}
            </div>
          )}
          
          {!product.availableForSale && (
            <div className="absolute top-4 right-4 bg-destructive text-destructive-foreground px-3 py-1 font-mono text-[10px] uppercase tracking-widest z-10">
              Out of Stock
            </div>
          )}
        </div>

        {/* Product Meta */}
        <div className="p-6 flex flex-col md:flex-row md:items-end justify-between gap-4 bg-background/50 backdrop-blur-sm border-t border-white/5">
          <div>
            <h3 className="font-display font-bold uppercase tracking-[0.15em] text-xl group-hover:text-primary transition-colors text-white">
              {product.title}
            </h3>
            <p className="font-mono text-xs text-muted-foreground mt-2 uppercase tracking-widest">
              Lifting Straps
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-lg font-bold text-white tracking-wider">
              {product.priceMinInCents === product.priceMaxInCents 
                ? formatPrice(product.priceMinInCents) 
                : `${formatPrice(product.priceMinInCents)} - ${formatPrice(product.priceMaxInCents)}`}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
