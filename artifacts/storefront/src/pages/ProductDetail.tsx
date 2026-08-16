import { useState } from 'react';
import { useGetProductBySlug, useListProductReviews, useAddCartItem } from '@workspace/api-client-react';
import { getProductImage, formatPrice, getCartSessionId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

export default function ProductDetail({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { data: product, isLoading } = useGetProductBySlug(slug, { query: { queryKey: ['product', slug], enabled: !!slug } });
  const { data: reviews } = useListProductReviews(slug, { query: { queryKey: ['reviews', slug], enabled: !!slug } });
  
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  
  const addCartItem = useAddCartItem();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div className="aspect-[4/5] bg-card border border-border rounded-2xl animate-pulse" />
        <div className="flex flex-col gap-6">
          <div className="h-12 bg-card rounded-md w-3/4 animate-pulse" />
          <div className="h-8 bg-card rounded-md w-1/4 animate-pulse" />
          <div className="h-32 bg-card rounded-md animate-pulse" />
        </div>
      </div>
    );
  }
  
  if (!product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-display font-bold uppercase mb-4 text-destructive">404</h1>
        <p className="font-mono text-muted-foreground uppercase">Artifact not found in the database.</p>
      </div>
    );
  }

  const primaryVariant = selectedVariant 
    ? product.variants.find(v => v.id === selectedVariant) 
    : (product.variants.find(v => v.availableQuantity > 0) || product.variants[0]);

  const displayImage = activeImage || product.images[0]?.url || getProductImage(product.slug);

  const handleAddToCart = () => {
    if (!primaryVariant) return;
    
    addCartItem.mutate({
      data: {
        sessionId: getCartSessionId(),
        variantId: primaryVariant.id,
        quantity,
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Added to Inventory",
          description: `${quantity}x ${product.name} acquired.`,
        });
      },
      onError: (err) => {
        toast({
          title: "Failed to Add",
          description: (err.data as any)?.error || err.message || "Could not add to cart.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        
        {/* Visuals */}
        <div className="flex flex-col gap-4">
          <motion.div 
            className="aspect-[4/5] rounded-2xl overflow-hidden bg-card border border-border relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <img 
              key={displayImage}
              src={displayImage}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?q=80&w=1471&auto=format&fit=crop' }}
            />
          </motion.div>
          
          {(product.images.length > 1 || product.images.length === 0) && (
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              <button 
                onClick={() => setActiveImage(getProductImage(product.slug))}
                className={`w-20 h-24 sm:w-24 sm:h-32 rounded-lg overflow-hidden border-2 cursor-pointer flex-shrink-0 transition-colors ${!activeImage || activeImage === getProductImage(product.slug) ? 'border-primary' : 'border-border opacity-50 hover:opacity-100'}`}
              >
                <img src={getProductImage(product.slug)} alt="Theme" className="w-full h-full object-cover" />
              </button>
              {product.images.map(img => (
                <button 
                  key={img.id} 
                  onClick={() => setActiveImage(img.url)}
                  className={`w-20 h-24 sm:w-24 sm:h-32 rounded-lg overflow-hidden border-2 cursor-pointer flex-shrink-0 transition-colors ${activeImage === img.url ? 'border-primary' : 'border-border opacity-50 hover:opacity-100'}`}
                >
                  <img src={img.url} alt={product.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Info & Actions */}
        <motion.div 
          className="flex flex-col"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          {product.theme && (
            <Badge className="w-fit mb-4 font-mono uppercase tracking-widest">{product.theme}</Badge>
          )}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold uppercase tracking-tight mb-2">
            {product.name}
          </h1>
          <div className="text-2xl font-mono text-primary font-bold mb-6">
            {formatPrice(primaryVariant?.priceInCents)}
          </div>
          
          <p className="text-muted-foreground font-mono mb-8 leading-relaxed text-lg">
            {product.description}
          </p>
          
          {product.variants.length > 1 && (
            <div className="mb-8 p-6 bg-card border border-border rounded-xl">
              <label className="block text-sm font-display uppercase tracking-widest mb-4">Select Specification</label>
              <div className="flex flex-wrap gap-3">
                {product.variants.map(v => {
                  const isSelected = selectedVariant ? selectedVariant === v.id : primaryVariant?.id === v.id;
                  return (
                    <Button
                      key={v.id}
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => setSelectedVariant(v.id)}
                      className={`font-mono uppercase ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      disabled={v.availableQuantity <= 0}
                    >
                      {v.size || v.color || 'Standard'}
                      {v.availableQuantity <= 0 && ' (Sold Out)'}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
            <div className="flex items-center border border-border rounded-md bg-card h-14 w-full sm:w-auto shrink-0">
              <button className="px-6 h-full hover:text-primary transition-colors font-mono text-xl" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
              <span className="font-mono w-12 text-center text-lg">{quantity}</span>
              <button className="px-6 h-full hover:text-primary transition-colors font-mono text-xl" onClick={() => setQuantity(quantity + 1)}>+</button>
            </div>
            <Button 
              size="lg" 
              className="flex-1 h-14 font-display uppercase tracking-widest text-lg w-full relative overflow-hidden group"
              onClick={handleAddToCart}
              disabled={addCartItem.isPending || !primaryVariant || primaryVariant.availableQuantity <= 0}
            >
              <span className="relative z-10">{addCartItem.isPending ? 'EQUIPPING...' : 'ADD TO ARSENAL'}</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            </Button>
          </div>
          
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-card border border-border rounded-lg h-12 p-1 mb-6">
              <TabsTrigger value="details" className="font-display uppercase tracking-widest text-xs data-[state=active]:bg-background">Details</TabsTrigger>
              <TabsTrigger value="shipping" className="font-display uppercase tracking-widest text-xs data-[state=active]:bg-background">Logistics</TabsTrigger>
              <TabsTrigger value="reviews" className="font-display uppercase tracking-widest text-xs data-[state=active]:bg-background">Intel ({reviews?.length || 0})</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="font-mono text-sm text-muted-foreground space-y-4 leading-relaxed">
              <div className="grid grid-cols-2 gap-4">
                {product.materials && (
                  <div className="p-4 bg-card rounded-lg border border-border">
                    <strong className="text-foreground block mb-1 uppercase font-display tracking-wider">Materials</strong> 
                    {product.materials}
                  </div>
                )}
                {product.benefits && (
                  <div className="p-4 bg-card rounded-lg border border-border">
                    <strong className="text-foreground block mb-1 uppercase font-display tracking-wider">Benefits</strong> 
                    {product.benefits}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="shipping" className="font-mono text-sm text-muted-foreground p-4 bg-card rounded-lg border border-border">
              {product.shippingInfo || 'Global logistics network engaged. Standard deployment time: 3-5 standard cycles.'}
            </TabsContent>
            <TabsContent value="reviews" className="font-mono text-sm text-muted-foreground space-y-4">
              {reviews?.length ? (
                <div className="space-y-4">
                  {reviews.map(review => (
                    <div key={review.id} className="p-4 bg-card border border-border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-bold text-primary uppercase tracking-widest">{review.reviewerName}</span>
                        <span className="text-primary tracking-widest">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span>
                      </div>
                      <h4 className="font-bold mb-2 text-foreground font-display tracking-wider uppercase">{review.title}</h4>
                      <p className="leading-relaxed">{review.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-border rounded-lg bg-card">
                  No field reports yet. Be the first to deploy with this gear.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
