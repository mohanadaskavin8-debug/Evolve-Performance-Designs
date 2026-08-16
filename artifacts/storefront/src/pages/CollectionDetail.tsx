import { useGetCollectionBySlug } from '@workspace/api-client-react';
import { ProductCard } from '@/components/ProductCard';
import { motion } from 'framer-motion';

export default function CollectionDetail({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { data: collection, isLoading } = useGetCollectionBySlug(slug, { query: { queryKey: ['collection', slug], enabled: !!slug } });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="h-16 w-1/3 bg-card animate-pulse rounded-lg mb-4" />
        <div className="h-6 w-1/2 bg-card animate-pulse rounded-md mb-12" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1,2,3,4].map(i => <div key={i} className="aspect-[4/5] bg-card border border-border animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-display font-bold uppercase mb-4 text-destructive">404</h1>
        <p className="font-mono text-muted-foreground uppercase">Collection not found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-card border-b border-border py-20 relative overflow-hidden">
        {collection.imageUrl && (
          <>
            <img src={collection.imageUrl} alt={collection.name} className="absolute inset-0 w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </>
        )}
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-display font-bold uppercase tracking-tight mb-4">
            {collection.name}
          </h1>
          <p className="font-mono text-muted-foreground max-w-2xl mx-auto text-lg">
            {collection.description}
          </p>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {collection.products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
          {collection.products.length === 0 && (
            <div className="col-span-full text-center py-24 font-mono text-muted-foreground uppercase">
              No gear in this collection yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
