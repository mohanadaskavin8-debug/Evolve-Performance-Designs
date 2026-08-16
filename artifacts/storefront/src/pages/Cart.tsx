import { useGetCart, useUpdateCartItem, useRemoveCartItem, useCreateCheckoutSession, useQueryShippingRates } from '@workspace/api-client-react';
import { getCartSessionId, formatPrice, getProductImage } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCartQueryKey } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Trash2, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/react';

// Must stay in sync with the allowed_countries list in the checkout session.
const SHIP_COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'JP', label: 'Japan' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AE', label: 'United Arab Emirates' },
];

interface RateOption {
  id: number;
  name: string;
  description: string;
  priceInCents: number;
  estimatedDays: string;
}

export default function Cart() {
  const sessionId = getCartSessionId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const { data: cart, isLoading } = useGetCart({ sessionId }, {
    query: { queryKey: getGetCartQueryKey({ sessionId }) }
  });

  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const createCheckout = useCreateCheckoutSession();
  const queryRates = useQueryShippingRates();

  const [shipCountry, setShipCountry] = useState('');
  const [shipPostal, setShipPostal] = useState('');
  const [rateOptions, setRateOptions] = useState<RateOption[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<number | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);

  // Countries without postal codes (rates can be quoted from country alone).
  const NO_POSTAL = ['AE'];
  const needsPostal = !!shipCountry && !NO_POSTAL.includes(shipCountry);

  const fetchRates = async (code: string, postal: string) => {
    if (!code) return;
    setRatesLoading(true);
    try {
      const rates = await queryRates.mutateAsync({
        data: { countryCode: code, sessionId, postalCode: postal.trim() || undefined },
      });
      const sorted = [...rates].sort((a, b) => a.priceInCents - b.priceInCents);
      setRateOptions(sorted);
      setSelectedRateId(sorted.length ? sorted[0].id : null);
    } catch {
      setRateOptions([]);
      setSelectedRateId(null);
    } finally {
      setRatesLoading(false);
    }
  };

  const handleCountryChange = async (code: string) => {
    setShipCountry(code);
    // A postal code belongs to one country — never reuse it for a new destination.
    setShipPostal('');
    setSelectedRateId(null);
    setRateOptions([]);
    if (!code) return;
    await fetchRates(code, '');
  };

  // Re-quote when the postal code is committed (blur / Enter) so carrier
  // rates reflect the real destination.
  const handlePostalCommit = async () => {
    if (shipCountry) await fetchRates(shipCountry, shipPostal);
  };

  const selectedRate = rateOptions.find(r => r.id === selectedRateId) ?? null;

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      await updateItem.mutateAsync({ itemId, data: { quantity: newQuantity, sessionId } });
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey({ sessionId }) });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleRemove = async (itemId: string) => {
    try {
      await removeItem.mutateAsync({ itemId, params: { sessionId } });
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey({ sessionId }) });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleCheckout = async () => {
    if (!cart?.items.length) return;
    setCheckoutLoading(true);
    try {
      const res = await createCheckout.mutateAsync({
        data: {
          sessionId,
          clerkUserId: user?.id,
          customerEmail: user?.primaryEmailAddress?.emailAddress,
          shippingZoneRateId: selectedRateId ?? undefined,
          countryCode: shipCountry || undefined,
          postalCode: shipPostal.trim() || undefined,
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: `${window.location.origin}/cart`
        }
      });
      window.location.href = res.checkoutUrl;
    } catch (err: any) {
      toast({ variant: "destructive", title: "Checkout Error", description: err.message });
      setCheckoutLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 bg-background flex justify-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const isEmpty = !cart?.items.length;

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
              {cart.items.map(item => (
                <div key={item.id} className="border border-white/10 bg-black flex flex-col sm:flex-row items-center gap-6 p-4 relative group">
                  <div className="w-full sm:w-48 h-24 sm:h-auto sm:aspect-video relative overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                    <img 
                      src={item.imageUrl || getProductImage(item.productSlug)} 
                      alt={item.productName} 
                      className="strap-panorama absolute inset-0 opacity-80"
                    />
                  </div>
                  
                  <div className="flex-1 flex flex-col sm:flex-row justify-between w-full gap-4">
                    <div>
                      <Link href={`/products/${item.productSlug}`} className="font-display font-bold uppercase tracking-widest text-white text-lg hover:text-primary transition-colors block mb-1">
                        {item.productName}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Variant: {item.size || item.color || item.variantSku}
                      </p>
                      <p className="font-mono font-bold text-white tracking-widest">
                        {formatPrice(item.priceInCents)}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center border border-white/20">
                        <button 
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          className="px-3 py-1 text-white hover:bg-white/10 transition-colors font-mono"
                        >-</button>
                        <div className="w-8 text-center font-mono text-white text-sm">{item.quantity}</div>
                        <button 
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          className="px-3 py-1 text-white hover:bg-white/10 transition-colors font-mono"
                        >+</button>
                      </div>
                      
                      <button 
                        onClick={() => handleRemove(item.id)}
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

                <div className="mb-8">
                  <label className="block font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Deployment Zone</label>
                  <select
                    value={shipCountry}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full bg-black border border-white/20 text-white font-mono text-xs uppercase tracking-widest px-3 py-3 focus:outline-none focus:border-primary"
                  >
                    <option value="">Select country…</option>
                    {SHIP_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>

                  {needsPostal && (
                    <input
                      type="text"
                      value={shipPostal}
                      onChange={(e) => setShipPostal(e.target.value)}
                      onBlur={handlePostalCommit}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      placeholder="Postal / ZIP code"
                      autoComplete="postal-code"
                      className="mt-3 w-full bg-black border border-white/20 text-white font-mono text-xs uppercase tracking-widest px-3 py-3 focus:outline-none focus:border-primary placeholder:text-muted-foreground/60"
                    />
                  )}

                  {ratesLoading && (
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-3 animate-pulse">Calculating rates…</p>
                  )}
                  {!ratesLoading && shipCountry && rateOptions.length === 0 && (
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-3">No shipping options for this destination yet — we'll confirm shipping after your order.</p>
                  )}
                  {rateOptions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {rateOptions.map(rate => (
                        <label
                          key={rate.id}
                          className={`flex items-start gap-3 border px-3 py-3 cursor-pointer transition-colors ${selectedRateId === rate.id ? 'border-primary bg-primary/10' : 'border-white/15 hover:border-white/40'}`}
                        >
                          <input
                            type="radio"
                            name="shippingRate"
                            checked={selectedRateId === rate.id}
                            onChange={() => setSelectedRateId(rate.id)}
                            className="mt-0.5 accent-primary"
                          />
                          <span className="flex-1">
                            <span className="flex justify-between gap-2 font-mono text-xs uppercase tracking-widest text-white">
                              <span>{rate.name}</span>
                              <span>{rate.priceInCents === 0 ? 'Free' : formatPrice(rate.priceInCents)}</span>
                            </span>
                            {rate.estimatedDays && (
                              <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{rate.estimatedDays}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="text-white">{formatPrice(cart.subtotalInCents)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span className={selectedRate ? 'text-white' : ''}>
                      {selectedRate
                        ? (selectedRate.priceInCents === 0 ? 'Free' : formatPrice(selectedRate.priceInCents))
                        : 'Select destination'}
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-4 flex justify-between font-bold text-lg mt-4">
                    <span className="text-white">Total</span>
                    <span className="text-primary">{formatPrice(cart.subtotalInCents + (selectedRate?.priceInCents ?? 0))}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || ratesLoading || !shipCountry || (rateOptions.length > 0 && selectedRateId == null)}
                  className="w-full bg-white text-black hover:bg-primary hover:text-white py-4 font-mono font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkoutLoading ? (
                    <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Deploy Order <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
                {!shipCountry && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center mt-3">Select a deployment zone to continue</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
