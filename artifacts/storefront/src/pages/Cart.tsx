import {
  useGetShopCart,
  useUpdateShopCartLine,
  useRemoveShopCartLine,
  getGetShopCartQueryKey,
} from '@workspace/api-client-react';
import { useCartId, storeCartId, formatPrice, getProductImage } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Trash2, ArrowRight, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function Cart() {
  const cartId = useCartId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const { data: cart, isLoading } = useGetShopCart(
    { cartId: cartId ?? undefined },
    { query: { queryKey: getGetShopCartQueryKey({ cartId: cartId ?? undefined }), enabled: !!cartId } },
  );

  // Shopify carts expire after a while — clear the stale id so the badge resets.
  useEffect(() => {
    if (cartId && cart && cart.id === null) {
      storeCartId(null);
    }
  }, [cartId, cart]);

  const updateLine = useUpdateShopCartLine();
  const removeLine = useRemoveShopCartLine();

  const invalidateCart = () => {
    queryClient.invalidateQueries({ queryKey: getGetShopCartQueryKey({ cartId: cartId ?? undefined }) });
  };

  const handleUpdateQuantity = async (lineId: string, newQuantity: number) => {
    if (newQuantity < 1 || !cartId) return;
    try {
      await updateLine.mutateAsync({ data: { cartId, lineId, quantity: newQuantity } });
      invalidateCart();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: (err?.data as any)?.error || err.message });
    }
  };

  const handleRemove = async (lineId: string) => {
    if (!cartId) return;
    try {
      await removeLine.mutateAsync({ data: { cartId, lineId } });
      invalidateCart();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: (err?.data as any)?.error || err.message });
    }
  };

  // Checkout happens on Shopify's secure hosted checkout — payment, shipping
  // options and taxes are all handled there.
  const handleCheckout = () => {
    if (!cart?.checkoutUrl) return;
    setCheckoutLoading(true);
    window.location.href = cart.checkoutUrl;
  };

  if (cartId && isLoading) {
    return (
      <div className="min-h-screen pt-32 bg-background flex justify-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const isEmpty = !cartId || !cart?.lines.length;

  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container mx-auto px-6 md:px-12 max-w-6xl">
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6">
          Loadout
        </h1>
        <div className="w-24 h-1 bg-primary mb-12" />

        {isEmpty ? (
          <div className="border border-white/10 bg-white/[0.02] p-16 text-center">
            <h3 className="text-2xl font-display font-bold uppercase tracking-widest text-white mb-4">No gear equipped</h3>
            <p className="font-mono text-muted-foreground uppercase tracking-widest mb-8">Your loadout is currently empty.</p>
            <Link href="/products" className="inline-block bg-white text-black px-8 py-3 font-mono uppercase tracking-widest hover:bg-primary hover:text-white transition-colors">
              Access Armory
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-8 flex flex-col gap-6">
              {cart.lines.map(line => (
                <div key={line.id} className="border border-white/10 bg-black flex flex-col sm:flex-row items-center gap-6 p-4 relative group">
                  <div className="w-full sm:w-48 h-24 sm:h-auto sm:aspect-video relative overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                    <img 
                      src={getProductImage(line.productHandle, line.imageUrl)} 
                      alt={line.productTitle} 
                      className="strap-panorama absolute inset-0 opacity-80"
                    />
                  </div>
                  
                  <div className="flex-1 flex flex-col sm:flex-row justify-between w-full gap-4">
                    <div>
                      <Link href={`/products/${line.productHandle}`} className="font-display font-bold uppercase tracking-widest text-white text-lg hover:text-primary transition-colors block mb-1">
                        {line.productTitle}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Variant: {line.variantTitle}
                      </p>
                      <p className="font-mono font-bold text-white tracking-widest">
                        {formatPrice(line.priceInCents)}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center border border-white/20">
                        <button 
                          onClick={() => handleUpdateQuantity(line.id, line.quantity - 1)}
                          className="px-3 py-1 text-white hover:bg-white/10 transition-colors font-mono"
                        >-</button>
                        <div className="w-8 text-center font-mono text-white text-sm">{line.quantity}</div>
                        <button 
                          onClick={() => handleUpdateQuantity(line.id, line.quantity + 1)}
                          className="px-3 py-1 text-white hover:bg-white/10 transition-colors font-mono"
                        >+</button>
                      </div>
                      
                      <button 
                        onClick={() => handleRemove(line.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-2"
                        title="Remove item"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-4">
              <div className="border border-white/10 bg-white/[0.02] p-8 sticky top-32">
                <h3 className="font-display font-bold uppercase tracking-widest text-white mb-6 border-b border-white/10 pb-4">Logistics</h3>

                <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="text-white">{formatPrice(cart.subtotalInCents)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping &amp; Taxes</span>
                    <span className="text-white/60 normal-case text-xs pt-0.5">Calculated at checkout</span>
                  </div>
                  <div className="border-t border-white/10 pt-4 flex justify-between font-bold text-lg mt-4">
                    <span className="text-white">Total</span>
                    <span className="text-primary">{formatPrice(cart.subtotalInCents)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || !cart.checkoutUrl}
                  className="w-full bg-white text-black hover:bg-primary hover:text-white py-4 font-mono font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkoutLoading ? (
                    <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Deploy Order <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center mt-3 flex items-center justify-center gap-2">
                  <Lock className="w-3 h-3" /> Secure checkout by Shopify
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
