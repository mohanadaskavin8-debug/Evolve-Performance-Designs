import { useEffect, useMemo, useState } from 'react';
import { useGetAccountOrderDetail, useSubmitReturnRequest } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Minus, Plus } from 'lucide-react';
import { SignIn, useUser } from '@clerk/react';
import { formatPrice } from '@/lib/utils';

export default function AccountReturnsNew() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container mx-auto px-6 md:px-12 max-w-3xl">
        <Link href="/account" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-white transition-colors mb-12">
          <ArrowLeft className="w-4 h-4" /> Operative Profile
        </Link>

        <h1 className="text-4xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6">
          Initiate Return
        </h1>
        <div className="w-24 h-1 bg-primary mb-12" />

        {!isLoaded ? null : !isSignedIn ? (
          <div className="border border-white/10 bg-black p-8 md:p-12 flex flex-col items-center gap-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Authentication required to initiate a return
            </p>
            <SignIn routing="hash" />
          </div>
        ) : (
          <ReturnForm />
        )}
      </div>
    </div>
  );
}

type Selection = Record<number, { selected: boolean; quantity: number }>;

function ReturnForm() {
  const submitReturn = useSubmitReturnRequest();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [orderIdInput, setOrderIdInput] = useState('');
  const [debouncedId, setDebouncedId] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [reason, setReason] = useState('');
  const [preferExchange, setPreferExchange] = useState(false);

  // Debounce the typed order ID before hitting the API
  useEffect(() => {
    const parsed = parseInt(orderIdInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDebouncedId(null);
      return;
    }
    const timer = setTimeout(() => setDebouncedId(parsed), 500);
    return () => clearTimeout(timer);
  }, [orderIdInput]);

  const { data: order, isFetching, error } = useGetAccountOrderDetail(debouncedId ?? 0, {
    query: { enabled: debouncedId !== null, queryKey: ['account-order', debouncedId], retry: false },
  });

  // Reset the item selection whenever a different order is loaded
  useEffect(() => {
    if (!order) {
      setSelection({});
      return;
    }
    const init: Selection = {};
    for (const item of order.items) {
      init[item.id] = { selected: false, quantity: 1 };
    }
    setSelection(init);
  }, [order?.id]);

  const lookupError = error
    ? ((error.data as any)?.error as string) || 'Order not found. Check the ID from your confirmation.'
    : null;

  const selectedCount = useMemo(
    () => Object.values(selection).filter((s) => s.selected).length,
    [selection],
  );

  const toggleItem = (itemId: number) => {
    setSelection((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId]?.selected },
    }));
  };

  const stepQty = (itemId: number, delta: number, max: number) => {
    setSelection((prev) => {
      const cur = prev[itemId];
      if (!cur) return prev;
      const next = Math.min(max, Math.max(1, cur.quantity + delta));
      return { ...prev, [itemId]: { ...cur, quantity: next } };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !reason.trim() || selectedCount === 0) return;

    const items = order.items
      .filter((i) => selection[i.id]?.selected)
      .map((i) => ({
        orderItemId: i.id,
        quantity: selection[i.id].quantity,
        reason: reason.trim(),
      }));

    try {
      await submitReturn.mutateAsync({
        data: {
          orderId: order.id,
          reason: reason.trim(),
          preferExchange,
          items,
        },
      });
      toast({ title: 'Signal Transmitted', description: 'Return request received. Comms will follow.' });
      setLocation('/account');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: (err?.data as any)?.error || err?.message || 'Failed to submit request.',
      });
    }
  };

  return (
    <div className="border border-white/10 bg-black p-8 md:p-12">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Order Internal ID (Number)
          </label>
          <input
            type="number"
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            placeholder="e.g. 1042"
            className="w-full bg-transparent border border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary transition-colors"
            required
          />
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
            Found in your deployment history on the Operative Profile
          </p>
        </div>

        {isFetching && (
          <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Locating deployment…
          </div>
        )}

        {!isFetching && lookupError && debouncedId !== null && (
          <p className="font-mono text-xs uppercase tracking-widest text-destructive border border-destructive/40 bg-destructive/10 px-4 py-3">
            {lookupError}
          </p>
        )}

        {order && (
          <div>
            <label className="block font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
              Select gear to extract — {order.orderNumber}
            </label>
            <div className="border border-white/10 divide-y divide-white/10">
              {order.items.map((item) => {
                const sel = selection[item.id];
                return (
                  <div key={item.id} className={`flex flex-col md:flex-row md:items-center gap-4 p-4 transition-colors ${sel?.selected ? 'bg-primary/5' : ''}`}>
                    <label className="flex items-center gap-4 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sel?.selected ?? false}
                        onChange={() => toggleItem(item.id)}
                        className="w-4 h-4 bg-transparent border border-white/20 accent-primary"
                      />
                      <div>
                        <p className="font-display font-bold uppercase tracking-wider text-white">{item.productName}</p>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                          {item.variantSku}
                          {item.size ? ` // ${item.size}` : ''}
                          {item.color ? ` // ${item.color}` : ''}
                          {' — '}{formatPrice(item.unitPriceInCents)}
                        </p>
                      </div>
                    </label>
                    {sel?.selected && (
                      <div className="flex items-center gap-3 md:ml-auto">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Qty</span>
                        <div className="flex items-center border border-white/20">
                          <button type="button" onClick={() => stepQty(item.id, -1, item.quantity)} className="p-2 text-white hover:bg-white/10 transition-colors" aria-label="Decrease quantity">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-3 font-mono text-sm text-white">{sel.quantity}</span>
                          <button type="button" onClick={() => stepQty(item.id, 1, item.quantity)} className="p-2 text-white hover:bg-white/10 transition-colors" aria-label="Increase quantity">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">of {item.quantity}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Reason for extraction
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full bg-transparent border border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary transition-colors resize-none"
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="exchange"
            checked={preferExchange}
            onChange={(e) => setPreferExchange(e.target.checked)}
            className="w-4 h-4 bg-transparent border border-white/20 accent-primary"
          />
          <label htmlFor="exchange" className="font-mono text-xs uppercase tracking-widest text-white">
            Prefer Exchange over Refund
          </label>
        </div>

        <button
          type="submit"
          disabled={submitReturn.isPending || !order || selectedCount === 0 || !reason.trim()}
          className="w-full bg-white text-black py-4 font-mono font-bold uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-all disabled:opacity-50 mt-4"
        >
          {submitReturn.isPending
            ? 'Transmitting…'
            : selectedCount === 0
              ? 'Select gear to return'
              : `Transmit Request (${selectedCount})`}
        </button>
      </form>
    </div>
  );
}
