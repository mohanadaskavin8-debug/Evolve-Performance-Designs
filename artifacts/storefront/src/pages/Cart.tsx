import { useState, useEffect } from 'react';
import { 
  useGetCart, 
  useUpdateCartItem, 
  useRemoveCartItem, 
  useCreateCheckoutSession, 
  useListShippingZones,
  useValidateDiscountCode
} from '@workspace/api-client-react';
import { getCartSessionId, getProductImage, formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Loader2, ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@clerk/react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Cart() {
  const sessionId = getCartSessionId();
  const { data: cart, isLoading, refetch } = useGetCart({ sessionId }, { query: { queryKey: ['cart', sessionId] } });
  
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const createCheckout = useCreateCheckoutSession();
  const validateDiscount = useValidateDiscountCode();
  
  const { data: zones } = useListShippingZones({ query: { queryKey: ['shipping-zones'] } });
  const { user } = useUser();
  const { toast } = useToast();

  const [discountCode, setDiscountCode] = useState('');
  const [activeDiscount, setActiveDiscount] = useState<{code: string, amount: number} | null>(null);
  const [shippingZoneId, setShippingZoneId] = useState<string>('');

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateItem.mutate(
      { itemId, data: { quantity: newQuantity, sessionId } },
      { onSuccess: () => refetch() }
    );
  };

  const handleRemove = async (itemId: string) => {
    // Pass sessionId as query param so the server can verify cart ownership
    try {
      await fetch(`/api/cart/items/${encodeURIComponent(itemId)}?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      refetch();
    } catch {
      toast({ title: "Error", description: "Could not remove item.", variant: "destructive" });
    }
  };

  const handleApplyDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountCode.trim()) return;
    
    validateDiscount.mutate(
      { data: { code: discountCode, sessionId } },
      {
        onSuccess: (res) => {
          if (res.valid) {
            setActiveDiscount({ code: res.code, amount: res.discountInCents || 0 });
            toast({ title: "Discount Applied", description: "Code accepted." });
          } else {
            toast({ title: "Invalid Code", description: (res as any).error || "Code not recognized.", variant: "destructive" });
            setActiveDiscount(null);
          }
        },
        onError: () => {
          toast({ title: "Error", description: "Could not validate code.", variant: "destructive" });
        }
      }
    );
  };

  const handleCheckout = () => {
    if (!cart?.items.length) return;
    
    createCheckout.mutate(
      {
        data: {
          sessionId,
          clerkUserId: user?.id,
          customerEmail: user?.primaryEmailAddress?.emailAddress,
          discountCode: activeDiscount?.code,
          shippingZoneRateId: shippingZoneId ? parseInt(shippingZoneId, 10) : undefined,
          successUrl: `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/cart`,
        }
      },
      {
        onSuccess: (res) => {
          window.location.href = res.checkoutUrl;
        },
        onError: (err) => {
          toast({ title: "Checkout Error", description: (err.data as any)?.error || err.message || "Could not initialize checkout.", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center font-mono">LOADING INVENTORY...</div>;
  }

  if (!cart?.items.length) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-lg">
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight mb-6">Your Arsenal is Empty</h1>
        <p className="font-mono text-muted-foreground mb-10">You haven't equipped any gear yet.</p>
        <Button size="lg" className="w-full font-display uppercase tracking-widest text-lg h-14" asChild>
          <Link href="/products">Browse The Armory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight mb-12">Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence>
            {cart.items.map(item => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col sm:flex-row gap-6 p-4 bg-card border border-border rounded-xl relative group"
              >
                <Link href={`/products/${item.productSlug}`} className="w-full sm:w-32 h-32 shrink-0 bg-background rounded-lg overflow-hidden block">
                  <img 
                    src={item.imageUrl || getProductImage(item.productSlug)} 
                    alt={item.productName} 
                    className="w-full h-full object-cover"
                  />
                </Link>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-display font-bold uppercase tracking-wide text-lg line-clamp-1">{item.productName}</h3>
                      <p className="font-mono text-sm text-muted-foreground">
                        {item.size || item.color || 'Standard'} | SKU: {item.variantSku}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-primary whitespace-nowrap">
                      {formatPrice(item.priceInCents * item.quantity)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center border border-border rounded-md bg-background h-10">
                      <button 
                        className="px-4 h-full hover:text-primary transition-colors disabled:opacity-50" 
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        disabled={updateItem.isPending}
                      >-</button>
                      <span className="font-mono w-8 text-center text-sm">{item.quantity}</span>
                      <button 
                        className="px-4 h-full hover:text-primary transition-colors disabled:opacity-50" 
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        disabled={updateItem.isPending}
                      >+</button>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(item.id)}
                      disabled={removeItem.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl p-6 sticky top-24">
            <h2 className="font-display font-bold uppercase tracking-widest text-xl mb-6 border-b border-border pb-4">Summary</h2>
            
            <div className="space-y-4 font-mono text-sm mb-6 border-b border-border pb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(cart.subtotalInCents)}</span>
              </div>
              
              {activeDiscount && (
                <div className="flex justify-between text-primary">
                  <span>Discount ({activeDiscount.code})</span>
                  <span>-{formatPrice(activeDiscount.amount)}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleApplyDiscount} className="mb-6 flex gap-2">
              <Input 
                placeholder="PROMO CODE" 
                className="font-mono uppercase bg-background" 
                value={discountCode}
                onChange={e => setDiscountCode(e.target.value)}
              />
              <Button type="submit" variant="secondary" className="font-display uppercase tracking-widest" disabled={validateDiscount.isPending}>
                Apply
              </Button>
            </form>

            <div className="mb-8">
              <label className="block text-xs font-display uppercase tracking-widest text-muted-foreground mb-2">Estimate Shipping</label>
              <Select value={shippingZoneId} onValueChange={setShippingZoneId}>
                <SelectTrigger className="font-mono uppercase bg-background">
                  <SelectValue placeholder="Select Destination" />
                </SelectTrigger>
                <SelectContent>
                  {zones?.map(zone => (
                    <SelectItem key={zone.id} value={zone.rates[0]?.id.toString() || '0'}>
                      {zone.name} ({zone.rates[0]?.estimatedDays || 'TBD'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between items-center mb-8 pt-4 border-t border-border">
              <span className="font-display font-bold uppercase tracking-widest text-lg">Total</span>
              <span className="font-mono font-bold text-2xl text-primary">
                {formatPrice(Math.max(0, cart.subtotalInCents - (activeDiscount?.amount || 0)))}
              </span>
            </div>

            <Button 
              size="lg" 
              className="w-full h-14 font-display uppercase tracking-widest text-lg relative group overflow-hidden"
              onClick={handleCheckout}
              disabled={createCheckout.isPending}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {createCheckout.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SECURE GEAR'}
                {!createCheckout.isPending && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
