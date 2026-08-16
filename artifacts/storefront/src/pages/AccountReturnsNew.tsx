import { useState, useEffect } from 'react';
import { useSubmitReturnRequest } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { SignIn, useUser } from '@clerk/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPrice } from '@/lib/utils';

interface OrderItem {
  id: number;
  productName: string;
  variantSku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPriceInCents: number;
}

interface OrderDetail {
  id: number;
  orderNumber: string;
  items: OrderItem[];
}

export default function AccountReturnsNew() {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return null;
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      {!isSignedIn ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <h1 className="text-3xl font-display font-bold uppercase tracking-tight mb-8">Access Terminal</h1>
          <SignIn routing="hash" />
        </div>
      ) : (
        <ReturnForm />
      )}
    </div>
  );
}

function ReturnForm() {
  const submitReturn = useSubmitReturnRequest();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [orderIdInput, setOrderIdInput] = useState('');
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [selectedItems, setSelectedItems] = useState<Record<number, { selected: boolean; quantity: number; reason: string }>>({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [preferExchange, setPreferExchange] = useState(false);

  // Fetch order detail when user provides an order ID
  useEffect(() => {
    const parsed = parseInt(orderIdInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setOrderDetail(null);
      setOrderError(null);
      setSelectedItems({});
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setOrderLoading(true);
      setOrderError(null);
      try {
        const res = await fetch(`/api/account/orders/${parsed}`, { credentials: 'include' });
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setOrderDetail(null);
          setOrderError(data.error || 'Order not found. Check the ID and try again.');
          setSelectedItems({});
        } else {
          const data: OrderDetail = await res.json();
          setOrderDetail(data);
          // Initialize selection state
          const init: Record<number, { selected: boolean; quantity: number; reason: string }> = {};
          for (const item of data.items) {
            init[item.id] = { selected: false, quantity: 1, reason };
          }
          setSelectedItems(init);
        }
      } catch {
        if (!cancelled) setOrderError('Could not load order. Please try again.');
      } finally {
        if (!cancelled) setOrderLoading(false);
      }
    }, 600);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [orderIdInput]);

  const toggleItem = (itemId: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId].selected },
    }));
  };

  const setItemQty = (itemId: number, qty: number) => {
    setSelectedItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], quantity: qty } }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderDetail || !reason) return;

    const items = orderDetail.items
      .filter(i => selectedItems[i.id]?.selected)
      .map(i => ({
        orderItemId: i.id,
        quantity: selectedItems[i.id].quantity,
        reason,
        notes: notes || undefined,
      }));

    if (items.length === 0) {
      toast({ title: "No Items Selected", description: "Please select at least one item to return.", variant: "destructive" });
      return;
    }

    submitReturn.mutate(
      {
        data: {
          orderId: orderDetail.id,
          reason,
          preferExchange,
          items,
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Operation Initiated", description: "Your return request has been filed." });
          setLocation('/account');
        },
        onError: (err) => {
          toast({ title: "Error", description: (err.data as any)?.error || err.message || "Failed to submit return request.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div>
      <Link href="/account" className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> Abort Operation
      </Link>
      
      <h1 className="text-4xl font-display font-bold uppercase tracking-tight mb-2">Initiate Return</h1>
      <p className="font-mono text-muted-foreground mb-8">File an RMA request for a recent deployment.</p>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-6">
        {/* Order ID lookup */}
        <div>
          <Label className="font-display uppercase tracking-widest text-muted-foreground mb-2 block">Order ID (Numeric)</Label>
          <Input 
            required 
            type="number"
            value={orderIdInput} 
            onChange={e => setOrderIdInput(e.target.value)} 
            placeholder="e.g. 1042" 
            className="bg-background font-mono h-12" 
          />
          <p className="text-xs text-muted-foreground mt-2 font-mono">Found in your order history.</p>
        </div>

        {/* Order lookup status */}
        {orderLoading && (
          <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Looking up order…
          </div>
        )}
        {orderError && (
          <p className="text-sm text-destructive font-mono">{orderError}</p>
        )}

        {/* Item selection */}
        {orderDetail && orderDetail.items.length > 0 && (
          <div>
            <Label className="font-display uppercase tracking-widest text-muted-foreground mb-3 block">
              Select Items to Return — Order {orderDetail.orderNumber}
            </Label>
            <div className="space-y-3">
              {orderDetail.items.map(item => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedItems[item.id]?.selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background'
                  }`}
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!selectedItems[item.id]?.selected}
                      onChange={() => toggleItem(item.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 accent-primary mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="font-display font-bold uppercase tracking-wide text-sm">{item.productName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {[item.size, item.color].filter(Boolean).join(' / ') || 'Standard'} · SKU: {item.variantSku}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        {formatPrice(item.unitPriceInCents)} × {item.quantity} ordered
                      </p>
                      {selectedItems[item.id]?.selected && (
                        <div className="mt-3 flex items-center gap-3" onClick={e => e.stopPropagation()}>
                          <Label className="font-mono text-xs text-muted-foreground">Return qty:</Label>
                          <div className="flex items-center border border-border rounded h-8">
                            <button
                              type="button"
                              className="px-3 h-full hover:text-primary transition-colors"
                              onClick={() => setItemQty(item.id, Math.max(1, (selectedItems[item.id]?.quantity || 1) - 1))}
                            >-</button>
                            <span className="font-mono w-6 text-center text-sm">{selectedItems[item.id]?.quantity || 1}</span>
                            <button
                              type="button"
                              className="px-3 h-full hover:text-primary transition-colors"
                              onClick={() => setItemQty(item.id, Math.min(item.quantity, (selectedItems[item.id]?.quantity || 1) + 1))}
                            >+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {orderDetail && orderDetail.items.length === 0 && (
          <p className="text-sm text-muted-foreground font-mono">No returnable items found in this order.</p>
        )}

        {/* Reason */}
        <div>
          <Label className="font-display uppercase tracking-widest text-muted-foreground mb-2 block">Primary Reason</Label>
          <Select value={reason} onValueChange={setReason} required>
            <SelectTrigger className="bg-background font-mono h-12">
              <SelectValue placeholder="Select Reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wrong_size">Wrong Size / Fit Issue</SelectItem>
              <SelectItem value="defective">Defective / Damaged</SelectItem>
              <SelectItem value="not_as_pictured">Not as described/pictured</SelectItem>
              <SelectItem value="changed_mind">Changed Mind</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="font-display uppercase tracking-widest text-muted-foreground mb-2 block">Detailed Report (Optional)</Label>
          <Textarea 
            value={notes} 
            onChange={e => setNotes(e.target.value)} 
            className="bg-background font-mono min-h-[120px] resize-none" 
            placeholder="Provide additional context for the logistics team..." 
          />
        </div>

        <div className="flex items-center gap-3 p-4 border border-border rounded-lg bg-background">
          <input 
            type="checkbox" 
            id="exchange" 
            className="w-4 h-4 accent-primary" 
            checked={preferExchange}
            onChange={e => setPreferExchange(e.target.checked)}
          />
          <Label htmlFor="exchange" className="font-display uppercase tracking-widest cursor-pointer">I prefer an exchange over a refund</Label>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={submitReturn.isPending || !orderDetail || !reason}
          className="w-full h-14 font-display uppercase tracking-widest text-lg mt-4"
        >
          {submitReturn.isPending ? 'Transmitting...' : 'Submit Request'}
        </Button>
      </form>
    </div>
  );
}
