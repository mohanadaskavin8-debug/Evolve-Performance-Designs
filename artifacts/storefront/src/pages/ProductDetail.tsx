import { useRoute } from 'wouter';
import {
  useGetShopProductByHandle,
  useAddShopCartLines,
  getGetShopCartQueryKey,
} from '@workspace/api-client-react';
import { getProductImage, formatPrice, getStoredCartId, storeCartId } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, ArrowLeft, Shield, Truck, RotateCcw, AlertTriangle } from 'lucide-react';
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // (Re)initialize selection whenever a different product loads — the same
  // component instance is reused when navigating between product pages.
  useEffect(() => {
    if (!product) return;
    const defaultVariant = product.variants.find(v => v.availableForSale) || product.variants[0];
    setSelectedVariantId(defaultVariant?.id ?? null);
    setQuantity(1);
    setActiveImageIndex(0);
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

  const fallbackImage = getProductImage(product.handle, product.imageUrl);
  const productImages = product.images?.length ? product.images : [fallbackImage];
  const activeImage = productImages[activeImageIndex] ?? productImages[0];
  const hasMultipleImages = productImages.length > 1;

  const showPreviousImage = () => {
    setActiveImageIndex((current) =>
      current === 0 ? productImages.length - 1 : current - 1,
    );
  };

  const showNextImage = () => {
    setActiveImageIndex((current) =>
      current === productImages.length - 1 ? 0 : current + 1,
    );
  };

  const finishSwipe = (endX: number) => {
    if (touchStartX == null) return;
    const distance = endX - touchStartX;
    if (Math.abs(distance) > 45) {
      if (distance < 0) showNextImage();
      else showPreviousImage();
    }
    setTouchStartX(null);
  };

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

      {/* Full product image gallery */}
      <div className="w-full mb-16">
        <div className="mx-auto w-full max-w-5xl px-4 md:px-8">
          <div
            className="group/gallery relative w-full overflow-hidden touch-pan-y"
            onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
            onTouchEnd={(event) => finishSwipe(event.changedTouches[0]?.clientX ?? 0)}
          >
            <img
              key={activeImage}
              src={activeImage}
              alt={`${product.title} — image ${activeImageIndex + 1} of ${productImages.length}`}
              className="block w-full h-auto"
            />

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  aria-label="Show previous product image"
                  className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 bg-black/70 backdrop-blur-sm text-white flex items-center justify-center hover:bg-primary transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label="Show next product image"
                  className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 bg-black/70 backdrop-blur-sm text-white flex items-center justify-center hover:bg-primary transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <span className="absolute right-4 bottom-4 bg-black/75 px-3 py-2 font-mono text-xs text-white tracking-widest">
                  {activeImageIndex + 1} / {productImages.length}
                </span>
              </>
            )}
          </div>
        </div>

        {hasMultipleImages && (
          <div className="mx-auto w-full max-w-5xl px-4 md:px-8 pt-4">
            <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Product images">
              {productImages.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={`Show product image ${index + 1}`}
                  aria-current={activeImageIndex === index}
                  className={`h-20 w-24 md:h-24 md:w-32 shrink-0 border bg-black transition-colors ${
                    activeImageIndex === index
                      ? 'border-primary'
                      : 'border-white/15 hover:border-white/50'
                  }`}
                >
                  <img
                    src={image}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
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
