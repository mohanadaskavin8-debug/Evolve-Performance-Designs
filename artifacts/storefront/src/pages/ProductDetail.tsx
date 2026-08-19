import { useRoute } from 'wouter';
import {
  useGetShopProductByHandle,
  useAddShopCartLines,
  getGetShopCartQueryKey,
} from '@workspace/api-client-react';
import { getProductImage, formatPrice, getStoredCartId, storeCartId } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { ChevronRight, ArrowLeft, Shield, Truck, RotateCcw, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function ProductDetail() {
  const [, params] = useRoute('/products/:slug');
  const handle = params?.slug || '';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: product, isLoading, error } = useGetShopProductByHandle(handle, {
    query: { enabled: !!handle, queryKey: ['product', handle] }
  });

  const addLines = useAddShopCartLines();
  
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  // (Re)initialize selection whenever a different product loads — the same
  // component instance is reused when navigating between product pages.
  useEffect(() => {
    if (!product) return;
    const defaultVariant = product.variants.find(v => v.availableForSale) || product.variants[0];
    setSelectedVariantId(defaultVariant?.id ?? null);
    setQuantity(1);
  }, [product?.id]);

  const selectedVariant = product?.variants.find(v => v.id === selectedVariantId);
  const isOutOfStock = !!selectedVariant && !selectedVariant.availableForSale;
  const maxQuantity = selectedVariant?.quantityAvailable ?? null;

  const handleAddToCart = async () => {
    if (!selectedVariantId) return;
    setAdding(true);
    try {
      const cart = await addLines.mutateAsync({
        data: {
          cartId: getStoredCartId(),
          variantId: selectedVariantId,
          quantity
        }
      });
      storeCartId(cart.id);
      queryClient.invalidateQueries({ queryKey: getGetShopCartQueryKey({ cartId: cart.id ?? undefined }) });
      toast({
        title: "Added to loadout",
        description: `${quantity}x ${product?.title} ready for deployment.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (err?.data as any)?.error || err.message || "Failed to add item.",
      });
    } finally {
      setAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 bg-background flex justify-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen pt-32 bg-background text-center flex flex-col items-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-6" />
        <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-white mb-4">Intel Not Found</h1>
        <p className="font-mono text-muted-foreground uppercase tracking-widest mb-8">This gear does not exist or has been redacted.</p>
        <Link href="/products" className="bg-white text-black px-8 py-3 font-mono uppercase tracking-widest hover:bg-primary hover:text-white transition-colors">
          Return to Armory
        </Link>
      </div>
    );
  }

  const cinematicImage = getProductImage(product.handle, product.imageUrl);

  return (
    <div className="min-h-screen bg-background pt-24 pb-32">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-6 md:px-12 py-6 flex items-center gap-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
        <Link href="/products" className="hover:text-white transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Armory
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white">{product.title}</span>
      </div>

      {/* Cinematic Bleed Header */}
      <div className="w-full relative h-[30vh] md:h-[50vh] bg-black border-y border-white/10 flex items-center justify-center overflow-hidden mb-16">
        <img 
          src={cinematicImage} 
          alt={product.title}
          className="strap-panorama absolute inset-0 opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* Left Column: Details & Philosophy */}
        <div className="lg:col-span-7 space-y-12">
          <div>
            {product.theme && (
              <span className="inline-block border border-white/20 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
                Theme: {product.theme}
              </span>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold uppercase tracking-[0.1em] text-white mb-4 leading-tight">
              {product.title}
            </h1>
            <div className="text-2xl font-mono font-bold text-white tracking-wider mb-8">
              {selectedVariant ? formatPrice(selectedVariant.priceInCents) : formatPrice(product.variants[0]?.priceInCents)}
            </div>
            
            <div className="prose prose-invert prose-p:font-mono prose-p:text-muted-foreground prose-p:uppercase prose-p:tracking-wider prose-p:leading-relaxed max-w-none">
              <p>{product.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/10 pt-12">
            <div className="border border-white/5 bg-white/[0.02] p-6">
              <Shield className="w-6 h-6 text-primary mb-4" />
              <h4 className="font-display font-bold uppercase tracking-widest text-white mb-2">Specs</h4>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Military-grade webbing, reinforced stitching, edge-to-edge sublimation print.</p>
            </div>
            <div className="border border-white/5 bg-white/[0.02] p-6">
              <RotateCcw className="w-6 h-6 text-primary mb-4" />
              <h4 className="font-display font-bold uppercase tracking-widest text-white mb-2">Deployment</h4>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Ships worldwide. Shipping options and rates shown at checkout.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Configurator */}
        <div className="lg:col-span-5">
          <div className="border border-white/10 bg-black/40 backdrop-blur-xl p-8 sticky top-32">
            <h3 className="font-display font-bold uppercase tracking-widest text-white mb-8 border-b border-white/10 pb-4">Configuration</h3>
            
            {/* Variants */}
            {product.variants.length > 1 && (
              <div className="mb-8">
                <label className="block font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Select Variant</label>
                <div className="flex flex-wrap gap-3">
                  {product.variants.map((variant) => {
                    const isSelected = selectedVariantId === variant.id;
                    const isAvail = variant.availableForSale;
                    return (
                      <button
                        key={variant.id}
                        disabled={!isAvail}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`px-4 py-3 font-mono text-xs uppercase tracking-widest transition-all ${
                          isSelected 
                            ? 'bg-primary text-white border border-primary' 
                            : isAvail 
                              ? 'bg-transparent border border-white/20 text-white hover:border-white/60' 
                              : 'bg-white/5 border border-white/5 text-white/30 cursor-not-allowed line-through'
                        }`}
                      >
                        {variant.title || variant.sku}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-8">
              <label className="block font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Quantity</label>
              <div className="flex items-center border border-white/20 w-max">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 text-white hover:bg-white/10 transition-colors font-mono"
                  disabled={isOutOfStock}
                >-</button>
                <div className="w-12 text-center font-mono text-white text-sm">{quantity}</div>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 text-white hover:bg-white/10 transition-colors font-mono"
                  disabled={isOutOfStock || (maxQuantity != null && quantity >= maxQuantity)}
                >+</button>
              </div>
            </div>

            {/* Action */}
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock || adding}
              className={`w-full py-4 font-mono font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                isOutOfStock
                  ? 'bg-white/5 text-white/40 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-primary hover:text-white'
              }`}
            >
              {adding ? (
                <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isOutOfStock ? (
                'Inventory Depleted'
              ) : (
                'Initialize Loadout'
              )}
            </button>
            
            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
              <Truck className="w-4 h-4" /> Secure Global Shipping
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
