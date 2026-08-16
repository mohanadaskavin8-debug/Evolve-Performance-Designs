import { Link } from 'wouter';
import { ProductCard as ProductCardType } from '@workspace/api-client-react';
import { formatPrice, getProductImage } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: ProductCardType;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.slug}`}>
      <motion.div 
        className="group relative flex flex-col gap-4 cursor-pointer h-full"
        whileHover={{ y: -5 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-card border border-border">
          <img
            src={product.primaryImageUrl || getProductImage(product.slug)}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="font-display font-bold uppercase tracking-widest text-white border border-white/50 px-6 py-2 rounded-full backdrop-blur-sm bg-black/20">
              View Gear
            </span>
          </div>
          {product.theme && (
            <Badge variant="secondary" className="absolute top-4 left-4 font-mono text-xs z-10 backdrop-blur-md bg-background/80 border-border">
              {product.theme}
            </Badge>
          )}
          {product.stockStatus === 'out_of_stock' && (
            <Badge variant="destructive" className="absolute top-4 right-4 font-mono text-xs z-10">
              Sold Out
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-display font-bold uppercase tracking-wide text-lg group-hover:text-primary transition-colors line-clamp-2">
              {product.name}
            </h3>
            <span className="font-mono font-bold whitespace-nowrap">
              {product.priceMin === product.priceMax 
                ? formatPrice(product.priceMin) 
                : `${formatPrice(product.priceMin)} - ${formatPrice(product.priceMax)}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
            <span className="font-mono uppercase">{product.collectionName}</span>
            {product.averageRating ? (
              <span className="flex items-center gap-1 font-mono">
                ★ {product.averageRating.toFixed(1)}
              </span>
            ) : null}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
