import { useState } from 'react';
import { useListProducts, useListCollections } from '@workspace/api-client-react';
import { ProductCard } from '@/components/ProductCard';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function Shop() {
  const [search, setSearch] = useState('');
  
  const searchParams = new URLSearchParams(window.location.search);
  const initialCollection = searchParams.get('collection') || undefined;
  
  const [activeCollection, setActiveCollection] = useState<string | undefined>(initialCollection);

  const { data: productsData, isLoading } = useListProducts(
    { collection: activeCollection === 'all' ? undefined : activeCollection, search }, 
    { query: { queryKey: ['products', activeCollection, search] } }
  );
  
  const { data: collections } = useListCollections({ query: { queryKey: ['collections'] } });

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-12">
        <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tight mb-6">
          The Armory
        </h1>
        
        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center border-b border-border pb-8">
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
            <Button 
              variant={!activeCollection || activeCollection === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveCollection('all')}
              className="font-mono uppercase tracking-widest text-xs"
            >
              All Gear
            </Button>
            {collections?.map(c => (
              <Button 
                key={c.id}
                variant={activeCollection === c.slug ? 'default' : 'outline'}
                onClick={() => setActiveCollection(c.slug)}
                className="font-mono uppercase tracking-widest text-xs whitespace-nowrap"
              >
                {c.name}
              </Button>
            ))}
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="SEARCH GEAR..." 
              className="pl-10 font-mono uppercase bg-card border-border h-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-[4/5] bg-card border border-border animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <motion.div 
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
        >
          <AnimatePresence>
            {productsData?.products.map(product => (
              <motion.div 
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </AnimatePresence>
          {productsData?.products.length === 0 && (
            <div className="col-span-full py-24 text-center flex flex-col items-center">
              <div className="text-4xl mb-4 opacity-20">🗡️</div>
              <p className="font-mono text-muted-foreground uppercase tracking-widest">
                No gear found matching your criteria.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
