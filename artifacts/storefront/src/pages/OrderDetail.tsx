import { useState } from 'react';
import { useLookupOrder } from '@workspace/api-client-react';
import { getProductImage, formatPrice } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useUser } from '@clerk/react';
import { ArrowLeft, Package } from 'lucide-react';

export default function OrderDetail({ params }: { params: { orderNumber: string } }) {
  const { orderNumber } = params;
  const { user, isLoaded } = useUser();
  
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress || '');
  const [submittedEmail, setSubmittedEmail] = useState(user?.primaryEmailAddress?.emailAddress || '');
  
  // Only query if we have an email submitted
  const { data: order, isLoading, error } = useLookupOrder(
    { orderNumber, email: submittedEmail },
    { query: { queryKey: ['order', orderNumber, submittedEmail], enabled: !!submittedEmail && !!orderNumber } }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedEmail(email);
  };

  if (!isLoaded) return null;

  if (!submittedEmail) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-md text-center">
        <Package className="w-16 h-16 mx-auto mb-6 text-muted-foreground" />
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight mb-4">Verify Identity</h1>
        <p className="font-mono text-muted-foreground mb-8">Enter the email associated with order {orderNumber} to view details.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input 
            type="email"
            placeholder="EMAIL@EXAMPLE.COM" 
            className="h-14 font-mono uppercase bg-card text-center"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Button type="submit" size="lg" className="h-14 font-display uppercase tracking-widest">
            Access Records
          </Button>
        </form>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center font-mono">RETRIEVING INTEL...</div>;
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-md text-center">
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight text-destructive mb-4">Access Denied</h1>
        <p className="font-mono text-muted-foreground mb-8">Order not found or email mismatch.</p>
        <Button variant="outline" onClick={() => setSubmittedEmail('')} className="font-display uppercase tracking-widest">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Link href="/account" className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Records
      </Link>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight mb-2">
            Order {order.orderNumber}
          </h1>
          <p className="font-mono text-muted-foreground">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
        </div>
        <Badge className="font-mono uppercase tracking-widest text-sm px-4 py-2" variant={order.status === 'delivered' ? 'default' : 'secondary'}>
          {order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <h3 className="font-display font-bold uppercase tracking-widest text-xl mb-6 border-b border-border pb-4">Secured Artifacts</h3>
          <div className="space-y-6">
            {order.items.map(item => (
              <div key={item.id} className="flex gap-4">
                <div className="w-20 h-24 bg-background rounded-md overflow-hidden shrink-0 border border-border">
                  <img src={item.imageUrl || getProductImage(item.productSlug)} alt={item.productName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-display font-bold uppercase tracking-wider">{item.productName}</h4>
                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        {item.size || item.color || 'Standard'} • QTY: {item.quantity}
                      </p>
                    </div>
                    <span className="font-mono font-bold whitespace-nowrap">{formatPrice(item.totalPriceInCents)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-display font-bold uppercase tracking-widest text-xl mb-6 border-b border-border pb-4">Financials</h3>
            <div className="space-y-3 font-mono text-sm mb-4">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotalInCents)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{formatPrice(order.shippingInCents)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{formatPrice(order.taxInCents)}</span>
              </div>
              {order.discountInCents > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discountInCents)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-border font-display font-bold text-lg uppercase tracking-widest">
              <span>Total</span>
              <span className="text-primary">{formatPrice(order.totalInCents)}</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-display font-bold uppercase tracking-widest text-xl mb-6 border-b border-border pb-4">Logistics</h3>
            <div className="font-mono text-sm text-muted-foreground space-y-1">
              <p className="font-bold text-foreground mb-2">{order.shippingAddress.name}</p>
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
              <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
              <p>{order.shippingAddress.countryCode}</p>
            </div>
            {order.trackingNumber && (
              <div className="mt-6 pt-6 border-t border-border">
                <Button variant="outline" className="w-full font-display uppercase tracking-widest" asChild>
                  <Link href={`/track?orderNumber=${order.orderNumber}&email=${encodeURIComponent(submittedEmail)}`}>Track Package</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
