import { useState, useRef } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useAdminGetOrder, getAdminGetOrderQueryKey, useAdminOrderAction, useAdminPushOrderFulfillment } from '@workspace/api-client-react';
import { ShipmentStatusBadge } from '@/pages/fulfillment';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/lib/format';
import { OrderStatusBadge } from '@/pages/orders/index';
import { ArrowLeft, Package, Truck, AlertTriangle, ShieldCheck, CheckCircle2, RotateCcw, Box, Send, RefreshCw, FileText, ExternalLink, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrderDetailPage() {
  const [, params] = useRoute('/orders/:id');
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;
  
  const { data: order, isLoading, error } = useAdminGetOrder(id, {
    query: { enabled: !!id, queryKey: getAdminGetOrderQueryKey(id) }
  });

  if (error) {
    return (
      <AdminLayout title="Order Details">
        <div className="p-6 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 font-mono text-sm">
          Failed to load order: {(error as any)?.data?.error || error.message}
        </div>
      </AdminLayout>
    );
  }

  if (isLoading || !order) {
    return (
      <AdminLayout title="Order Details">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="col-span-2 h-[600px] rounded-xl" />
            <Skeleton className="col-span-1 h-[600px] rounded-xl" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Order ${order.orderNumber}`}>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/orders" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders
        </Link>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <Badge variant="outline" className="font-mono text-xs">{formatDate(order.createdAt)}</Badge>
        </div>
      </div>

      {order.requiresManualReview && (
        <Card className="mb-6 border-destructive bg-destructive/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-bold text-sm tracking-wide uppercase">Fraud Risk Flagged</p>
                <p className="text-xs text-destructive/80">Stripe risk level: {order.stripeRiskLevel?.toUpperCase() || 'ELEVATED'} (Score: {order.stripeRiskScore})</p>
                <p className="text-xs text-destructive/80 mt-1">Automatic fulfillment is paused until this flag is cleared.</p>
              </div>
            </div>
            <OrderActionDialog 
              orderId={id} 
              action="clear_fraud_flag" 
              title="Clear Fraud Flag" 
              buttonText="Clear Flag" 
              buttonProps={{ variant: 'destructive', size: 'sm', className: "font-bold tracking-widest" }}
            >
              Are you sure you want to clear the fraud flag? This will allow the order to be processed normally.
            </OrderActionDialog>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Box className="w-5 h-5 text-primary" /> 
                Order Items ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {order.items.map(item => (
                  <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-secondary/20 transition-colors">
                    <div className="w-16 h-16 bg-secondary rounded-md flex-shrink-0 overflow-hidden border">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="w-6 h-6" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/products/${item.productSlug}`} className="font-bold text-foreground hover:text-primary hover:underline truncate block">
                        {item.productName}
                      </Link>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="font-mono text-[10px]">{item.variantSku}</Badge>
                        {(item.size || item.color) && (
                          <span className="font-mono text-xs text-foreground bg-primary/10 px-2 py-0.5 rounded">
                            {[item.size, item.color].filter(Boolean).join(' / ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 sm:gap-8 justify-between sm:justify-end shrink-0 mt-2 sm:mt-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Price</p>
                        <p className="font-mono text-sm">{formatCurrency(item.unitPriceInCents)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Qty</p>
                        <p className="font-mono font-bold">{item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Total</p>
                        <p className="font-mono font-bold text-primary">{formatCurrency(item.totalPriceInCents)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" /> 
                Fulfillment & Action
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <FulfillmentAutomationPanel order={order} orderId={id} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <OrderActionDialog 
                  orderId={id} 
                  action="mark_processing" 
                  title="Mark as Processing"
                  disabled={!['pending'].includes(order.status) || order.requiresManualReview}
                  buttonText="Start Processing"
                  buttonProps={{ className: "w-full", variant: "outline" }}
                />
                <OrderActionDialog 
                  orderId={id} 
                  action="mark_packaged" 
                  title="Mark as Packaged"
                  disabled={!['processing'].includes(order.status)}
                  buttonText="Mark Ready to Ship"
                  buttonProps={{ className: "w-full", variant: "outline" }}
                />
                <FulfillOrderDialog 
                  orderId={id} 
                  disabled={!['processing', 'ready_to_ship'].includes(order.status)} 
                />
              </div>

              {order.shipments && order.shipments.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Shipment History</h4>
                  {order.shipments.map(shipment => (
                    <div key={shipment.id} className="border rounded-lg bg-card shadow-sm overflow-hidden">
                      <div className="p-4 flex flex-col sm:flex-row justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <ShipmentStatusBadge status={(shipment as any).status || 'shipped'} />
                            <span className="font-bold">{shipment.carrier || 'Carrier TBD'}</span>
                            {(shipment as any).serviceCode && (
                              <span className="font-mono text-[10px] text-muted-foreground">{(shipment as any).serviceCode}</span>
                            )}
                          </div>
                          {shipment.trackingNumber && (
                            <div className="font-mono text-sm text-primary flex items-center gap-2">
                              {shipment.trackingNumber}
                              {shipment.trackingUrl && (
                                <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="text-xs underline text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                                  Track <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}
                          {(shipment as any).labelUrl && (
                            <a href={(shipment as any).labelUrl} target="_blank" rel="noreferrer" className="text-xs underline text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-1">
                              <FileText className="w-3 h-3" /> Shipping label
                            </a>
                          )}
                        </div>
                        <div className="text-right text-sm text-muted-foreground shrink-0">
                          <div>Shipped: {shipment.shippedAt ? formatDate(shipment.shippedAt) : 'Pending'}</div>
                          {shipment.estimatedDelivery && <div>ETA: {formatDate(shipment.estimatedDelivery)}</div>}
                        </div>
                      </div>
                      {((shipment as any).events?.length ?? 0) > 0 && (
                        <div className="border-t bg-secondary/10 px-4 py-3 space-y-2">
                          {(shipment as any).events.map((ev: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 text-xs">
                              <span className="font-mono text-muted-foreground whitespace-nowrap w-32 shrink-0">{formatDate(ev.occurredAt)}</span>
                              <span className={`font-bold uppercase tracking-wider w-28 shrink-0 ${ev.eventType === 'exception' ? 'text-destructive' : 'text-foreground/70'}`}>
                                {(ev.eventType || '').replace(/_/g, ' ')}
                              </span>
                              <span className="text-muted-foreground">
                                {ev.description}
                                {ev.location ? <span className="ml-1 font-mono">({ev.location})</span> : null}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & Customer */}
        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg text-primary">Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotalInCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatCurrency(order.shippingInCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(order.taxInCents)}</span>
                </div>
                {order.discountInCents > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-500 font-bold">
                    <span>Discount {order.discountCode ? `(${order.discountCode})` : ''}</span>
                    <span>-{formatCurrency(order.discountInCents)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg font-sans">
                  <span>Total</span>
                  <span>{formatCurrency(order.totalInCents)}</span>
                </div>
              </div>
            </CardContent>
            {['pending', 'processing', 'ready_to_ship'].includes(order.status) && (
              <CardContent className="p-6 pt-0 space-y-3">
                <Separator className="mb-4" />
                <OrderActionDialog 
                  orderId={id} 
                  action="cancel" 
                  title="Cancel Order" 
                  buttonText="Cancel Order" 
                  buttonProps={{ variant: 'secondary', className: "w-full text-destructive hover:bg-destructive hover:text-destructive-foreground font-bold tracking-wide" }}
                >
                  Are you sure you want to cancel this order? This cannot be undone.
                </OrderActionDialog>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Contact</h4>
                <div className="font-medium">{order.customerName || '-'}</div>
                <div className="text-sm text-primary underline">{order.customerEmail}</div>
                {order.customerId && (
                  <Link href={`/customers/${order.customerId}`} className="text-xs text-muted-foreground hover:text-foreground mt-2 inline-block">
                    View full profile &rarr;
                  </Link>
                )}
              </div>
              
              {order.shippingAddress && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Shipping Address</h4>
                  <div className="text-sm leading-relaxed text-foreground/80 font-mono bg-secondary/30 p-3 rounded-md border">
                    <div>{order.shippingAddress.name}</div>
                    <div>{order.shippingAddress.line1}</div>
                    {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
                    <div>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</div>
                    <div>{order.shippingAddress.countryCode}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function FulfillmentAutomationPanel({ order, orderId }: { order: any; orderId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pushMut = useAdminPushOrderFulfillment();

  const shipment = order.shipments?.[0];
  const status = shipment?.status as string | undefined;
  const pushable = ['paid', 'processing', 'packaged'].includes(order.status) && !order.requiresManualReview;
  const needsPush = !shipment || status === 'pending_push' || status === 'push_failed';

  const handlePush = () => {
    pushMut.mutate({ orderId }, {
      onSuccess: (result: any) => {
        if (result.pushed) {
          toast({ title: 'Pushed to ShipStation', description: 'The order is now in your ShipStation queue.' });
        } else {
          toast({ variant: 'destructive', title: 'Push failed', description: result.error || 'Unknown error — automatic retry is scheduled.' });
        }
        queryClient.invalidateQueries({ queryKey: getAdminGetOrderQueryKey(orderId) });
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Push failed', description: err.data?.error || err.message });
      },
    });
  };

  // Nothing useful to show for terminal or pre-payment states with no shipment
  if (!shipment && !pushable) return null;

  return (
    <div className="mb-6 p-4 border rounded-lg bg-secondary/10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm">ShipStation Automation</p>
              {shipment ? <ShipmentStatusBadge status={status!} /> : (
                <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">Not queued yet</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {order.requiresManualReview
                ? 'Paused — clear the fraud flag to resume automatic fulfillment.'
                : !shipment
                  ? 'This order will be queued for ShipStation automatically.'
                  : status === 'pending_push'
                    ? 'Queued — pushing to ShipStation shortly.'
                    : status === 'push_failed'
                      ? `Push failed after ${shipment.pushAttempts ?? 0} attempt${(shipment.pushAttempts ?? 0) === 1 ? '' : 's'} — retrying automatically.`
                      : status === 'pushed'
                        ? 'In your ShipStation queue — buy the label in ShipStation to continue.'
                        : 'Tracking updates and customer emails are automatic.'}
            </p>
          </div>
        </div>
        {pushable && needsPush && (
          <Button variant="outline" size="sm" onClick={handlePush} disabled={pushMut.isPending} className="shrink-0 gap-1.5 font-bold tracking-wide">
            {pushMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {status === 'push_failed' ? 'Retry Push' : 'Push Now'}
          </Button>
        )}
      </div>
      {status === 'push_failed' && shipment.lastPushError && (
        <p className="text-xs text-destructive font-mono mt-3 bg-destructive/10 border border-destructive/20 rounded px-3 py-2 break-words">
          {shipment.lastPushError}
        </p>
      )}
    </div>
  );
}

// Dialog Components
function OrderActionDialog({ 
  orderId, 
  action, 
  title, 
  children, 
  buttonText, 
  buttonProps, 
  disabled 
}: any) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminOrderAction();

  const handleConfirm = () => {
    mutation.mutate({ orderId, data: { action } }, {
      onSuccess: () => {
        toast({ title: 'Success', description: `Order updated.` });
        queryClient.invalidateQueries({ queryKey: getAdminGetOrderQueryKey(orderId) });
        setOpen(false);
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button disabled={disabled} {...buttonProps} onClick={() => setOpen(true)}>{buttonText}</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {children || `Are you sure you want to ${action.replace('_', ' ')}?`}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FulfillOrderDialog({ orderId, disabled }: { orderId: number, disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminOrderAction();

  const handleFulfill = () => {
    mutation.mutate({ orderId, data: { action: 'fulfill', carrier, trackingNumber, trackingUrl } as any }, {
      onSuccess: () => {
        toast({ title: 'Order Fulfilled', description: `Shipment details saved.` });
        queryClient.invalidateQueries({ queryKey: getAdminGetOrderQueryKey(orderId) });
        setOpen(false);
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button disabled={disabled} className="w-full font-bold tracking-wider" onClick={() => setOpen(true)}>Fulfill Order</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fulfill Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Carrier</Label>
            <Input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. USPS, FedEx, UPS" />
          </div>
          <div className="space-y-2">
            <Label>Tracking Number</Label>
            <Input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="Tracking number" className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label>Tracking URL (optional)</Label>
            <Input value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleFulfill} disabled={mutation.isPending}>Fulfill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
