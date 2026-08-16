import { useState, useRef } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useAdminGetReturn, getAdminGetReturnQueryKey, useAdminReturnAction } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/lib/format';
import { ReturnStatusBadge } from '@/pages/returns/index';
import { ArrowLeft, Box, Check, X, Undo2, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReturnDetailPage() {
  const [, params] = useRoute('/returns/:id');
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;
  
  const { data: ret, isLoading, error } = useAdminGetReturn(id, {
    query: { enabled: !!id, queryKey: getAdminGetReturnQueryKey(id) }
  });

  if (error) {
    return (
      <AdminLayout title="Return Details">
        <div className="p-6 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 font-mono text-sm">
          Failed to load return: {(error as any)?.data?.error || error.message}
        </div>
      </AdminLayout>
    );
  }

  if (isLoading || !ret) {
    return (
      <AdminLayout title="Return Details">
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Return RET-${ret.id}`}>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/returns" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Returns
        </Link>
        <div className="flex items-center gap-3">
          <ReturnStatusBadge status={ret.status} />
          <span className="font-mono text-xs text-muted-foreground">{formatDate(ret.createdAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Box className="w-5 h-5 text-primary" /> 
                Items to {ret.preferExchange ? 'Exchange' : 'Return'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {ret.items.map(item => (
                  <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-secondary/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate">{item.productName || 'Unknown Product'}</div>
                      <div className="text-sm text-muted-foreground font-mono mt-1">{item.variantSku}</div>
                      <div className="mt-3 bg-secondary/50 p-3 rounded text-sm text-foreground border border-border/50">
                        <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground block mb-1">Reason</span>
                        {item.reason}
                        {item.notes && <p className="mt-1 text-muted-foreground italic">"{item.notes}"</p>}
                      </div>
                    </div>
                    <div className="text-center sm:text-right shrink-0">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Qty</p>
                      <p className="font-mono font-bold text-2xl">{item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">Customer Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-foreground leading-relaxed bg-secondary/30 p-4 rounded-lg border">
                {ret.reason || 'No additional notes provided by customer.'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-1 space-y-6">
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="pb-4 border-b bg-primary/5">
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {ret.status === 'requested' && (
                <div className="grid grid-cols-2 gap-3">
                  <ReturnActionDialog returnId={ret.id} action="approve" title="Approve Return" buttonText="Approve" buttonProps={{ className: "w-full font-bold tracking-wide", variant: "default" }}>
                    Approve this return request? The customer will be notified to send the items back.
                  </ReturnActionDialog>
                  <ReturnActionDialog returnId={ret.id} action="deny" title="Deny Return" buttonText="Deny" buttonProps={{ className: "w-full font-bold tracking-wide", variant: "destructive" }}>
                    Deny this return request? The customer will be notified.
                  </ReturnActionDialog>
                </div>
              )}

              {ret.status === 'approved' && (
                <ReturnActionDialog returnId={ret.id} action="receive_items" title="Mark Items Received" buttonText="Items Received" buttonProps={{ className: "w-full font-bold tracking-wide bg-amber-500 hover:bg-amber-600 text-white" }}>
                  Mark the items as physically received? This will move the return to Processing.
                </ReturnActionDialog>
              )}

              {ret.status === 'processing' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">Items received. Choose resolution:</p>
                  {!ret.preferExchange && (
                    <IssueRefundDialog returnId={ret.id} defaultAmount={ret.refundAmountInCents || 0} />
                  )}
                  {ret.preferExchange && (
                    <ReturnActionDialog returnId={ret.id} action="issue_exchange" title="Complete Exchange" buttonText="Mark Exchange Issued" buttonProps={{ className: "w-full font-bold tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white" }}>
                      Mark this exchange as completed? Ensure you have created a zero-dollar replacement order for the customer.
                    </ReturnActionDialog>
                  )}
                </div>
              )}

              {ret.status === 'completed' && (
                <div className="text-center p-4 bg-emerald-500/10 text-emerald-600 rounded-lg border border-emerald-500/20 font-bold tracking-wide flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" /> Resolved
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider block mb-1">Customer</span>
                <span className="font-medium block">{ret.customerEmail}</span>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider block mb-1">Original Order</span>
                <Link href={`/orders/${ret.orderId}`} className="font-mono font-bold text-primary hover:underline">
                  {ret.orderNumber}
                </Link>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider block mb-1">Resolution Preference</span>
                <Badge variant="outline" className={`font-mono text-xs font-bold uppercase tracking-wider ${ret.preferExchange ? 'border-primary text-primary' : ''}`}>
                  {ret.preferExchange ? 'Exchange' : 'Refund'}
                </Badge>
              </div>
              {ret.refundAmountInCents && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider block mb-1">Refund Amount</span>
                    <span className="font-mono font-bold text-lg text-emerald-600 dark:text-emerald-500">{formatCurrency(ret.refundAmountInCents)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

// Dialogs

function ReturnActionDialog({ returnId, action, title, children, buttonText, buttonProps }: any) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminReturnAction();

  const handleConfirm = () => {
    mutation.mutate({ returnId, data: { action, notes } }, {
      onSuccess: () => {
        toast({ title: 'Success', description: `Return updated.` });
        queryClient.invalidateQueries({ queryKey: getAdminGetReturnQueryKey(returnId) });
        setOpen(false);
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button {...buttonProps} onClick={() => setOpen(true)}>{buttonText}</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p>{children}</p>
          <div className="space-y-2">
            <Label>Internal Notes (Optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a note for staff..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={mutation.isPending}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueRefundDialog({ returnId, defaultAmount }: { returnId: number, defaultAmount: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((defaultAmount / 100).toFixed(2));
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminReturnAction();

  const handleConfirm = () => {
    mutation.mutate({ 
      returnId,
      data: { 
        action: 'issue_refund', 
        refundAmountInCents: Math.round(parseFloat(amount) * 100),
        notes 
      } 
    }, {
      onSuccess: () => {
        toast({ title: 'Refund Issued' });
        queryClient.invalidateQueries({ queryKey: getAdminGetReturnQueryKey(returnId) });
        setOpen(false);
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className="w-full font-bold tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setOpen(true)}>
        <CreditCard className="w-4 h-4 mr-2" /> Issue Refund
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Refund</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Refund Amount (USD)</Label>
            <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="font-mono text-lg h-12" />
          </div>
          <div className="space-y-2">
            <Label>Internal Notes (Optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for custom amount..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={mutation.isPending || parseFloat(amount) <= 0}>Issue Refund</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
