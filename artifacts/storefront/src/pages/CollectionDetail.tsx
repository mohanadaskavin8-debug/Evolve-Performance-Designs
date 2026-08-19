import { useRoute, Link } from 'wouter';
import { useGetShopCollectionByHandle } from '@workspace/api-client-react';
import { ProductCard } from '@/components/ProductCard';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export default function CollectionDetail() {
  const [, params] = useRoute('/collections/:slug');
  const slug = params?.slug || '';

  const { data: collection, isLoading, error } = useGetShopCollectionByHandle(slug, {
    query: { enabled: !!slug, queryKey: ['collection', slug] }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 bg-background flex justify-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen pt-32 bg-background text-center flex flex-col items-center">
        <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-white mb-4">Series Not Found</h1>
        <Link href="/products" className="bg-white text-black px-8 py-3 font-mono uppercase tracking-widest hover:bg-primary hover:text-white transition-colors">
          Return to Armory
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container mx-auto px-6 md:px-12">
        <Link href="/products?collection=all" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-white transition-colors mb-12">
          <ArrowLeft className="w-4 h-4" /> All Series
        </Link>
        
        <div className="mb-16 max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6">
            {collection.title} Series
          </h1>
          <div className="w-24 h-1 bg-primary mb-8" />
          <p className="font-mono text-muted-foreground uppercase tracking-widest leading-relaxed">
            {collection.description}
          </p>
        </div>

        {collection.products.length === 0 ? (
          <div className="py-32 text-center border border-white/10 bg-black/50 backdrop-blur-sm">
            <p className="font-mono text-muted-foreground uppercase tracking-widest">No gear active in this series.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-16">
            {collection.products.map((product, i) => (
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
        )}
      </div>
    </div>
  );
}
