import { useState } from 'react';
import {
  useAdminGetFulfillmentStatus,
  getAdminGetFulfillmentStatusQueryKey,
  useAdminListShipments,
  getAdminListShipmentsQueryKey,
  useAdminPushOrderFulfillment,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import {
  PackageCheck, Plug, RefreshCw, ExternalLink, FileText,
  AlertTriangle, CheckCircle2, Truck, Search, FlaskConical, Clock, Send,
} from 'lucide-react';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending_push: { label: 'Pending Push', className: 'bg-secondary text-secondary-foreground' },
  push_failed: { label: 'Push Failed', className: 'bg-destructive text-destructive-foreground' },
  pushed: { label: 'Pushed', className: 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-600/30' },
  label_created: { label: 'Label Created', className: 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-600/30' },
  shipped: { label: 'Shipped', className: 'bg-sky-600/15 text-sky-600 dark:text-sky-400 border border-sky-600/30' },
  in_transit: { label: 'In Transit', className: 'bg-cyan-600/15 text-cyan-600 dark:text-cyan-400 border border-cyan-600/30' },
  out_for_delivery: { label: 'Out for Delivery', className: 'bg-amber-600/15 text-amber-600 dark:text-amber-400 border border-amber-600/30' },
  delivered: { label: 'Delivered', className: 'bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-600/30' },
  exception: { label: 'Exception', className: 'bg-destructive/15 text-destructive border border-destructive/30' },
};

export function ShipmentStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { label: status, className: 'bg-secondary text-secondary-foreground' };
  return (
    <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-wider border-0 ${style.className}`}>
      {style.label}
    </Badge>
  );
}

export default function FulfillmentPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: status, isLoading: statusLoading, error: statusError } = useAdminGetFulfillmentStatus({
    query: { refetchInterval: 30000, queryKey: getAdminGetFulfillmentStatusQueryKey() },
  });

  const params = {
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
    limit: 50,
  };
  const { data: shipmentsData, isLoading: shipmentsLoading, error: shipmentsError } = useAdminListShipments(params, {
    query: { refetchInterval: 30000, queryKey: getAdminListShipmentsQueryKey(params) },
  });

  return (
    <AdminLayout title="Fulfillment">
      <div className="flex flex-col gap-6">
        {/* Connection status */}
        {statusLoading && !status ? (
          <Skeleton className="h-28 w-full" />
        ) : statusError ? (
          <div className="p-6 text-destructive font-mono text-sm border border-destructive/20 bg-destructive/5 rounded-lg">
            Failed to load fulfillment status: {(statusError as any)?.data?.error || statusError.message}
          </div>
        ) : status && !status.connected ? (
          <NotConnectedCard message={status.message} />
        ) : status ? (
          <Card className={status.healthy ? 'border-emerald-600/30' : 'border-amber-600/40'}>
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded flex items-center justify-center ${status.healthy ? 'bg-emerald-600/10 text-emerald-500' : 'bg-amber-600/10 text-amber-500'}`}>
                  <Plug className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">ShipStation Connected</h3>
                    {status.healthy ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {status.healthy
                      ? `${status.carrierCount ?? 0} carrier${(status.carrierCount ?? 0) === 1 ? '' : 's'} available — orders push automatically after payment`
                      : status.message || 'Connection degraded'}
                  </p>
                </div>
              </div>
              {status.testMode && (
                <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest text-amber-500 border-amber-500/40 gap-1.5 px-3 py-1.5 self-start sm:self-auto">
                  <FlaskConical className="w-3 h-3" /> Test Mode — no live carrier charges
                </Badge>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Pipeline stats */}
        {status && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Clock} label="Awaiting Push" value={status.pendingPushes} tone={status.pendingPushes > 0 ? 'amber' : 'default'} />
            <StatCard icon={AlertTriangle} label="Failed Pushes" value={status.failedPushes} tone={status.failedPushes > 0 ? 'destructive' : 'default'} />
            <StatCard icon={Truck} label="Active Shipments" value={status.activeShipments} tone="default" />
            <StatCard icon={PackageCheck} label="Delivered (30d)" value={status.deliveredLast30Days} tone="emerald" />
          </div>
        )}

        {/* Shipments table */}
        <Card>
          <CardHeader className="pb-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" /> Shipments
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Order #, email, tracking…"
                  className="pl-9 w-56 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(STATUS_STYLES).map(([value, s]) => (
                    <SelectItem key={value} value={value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {shipmentsError ? (
              <div className="p-8 text-center text-destructive font-mono text-sm">
                Failed to load shipments: {(shipmentsError as any)?.data?.error || shipmentsError.message}
              </div>
            ) : shipmentsLoading && !shipmentsData ? (
              <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !shipmentsData?.shipments.length ? (
              <div className="p-12 text-center text-muted-foreground">
                <PackageCheck className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No shipments yet. Paid orders appear here automatically.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipmentsData.shipments.map((s) => (
                    <ShipmentRow key={s.id} shipment={s} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function NotConnectedCard({ message }: { message?: string | null }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8">
        <div className="flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Plug className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-bold text-lg mb-2">ShipStation isn't connected yet</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Orders are safe — every paid order is queued locally and will push to ShipStation
            automatically the moment a connection exists. Nothing is lost while disconnected.
          </p>
          <div className="text-left w-full bg-secondary/30 border rounded-lg p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">How to connect</p>
            <ol className="text-sm space-y-2 list-decimal list-inside text-foreground/80">
              <li>Open the <span className="font-bold">Replit workspace</span> where this app runs.</li>
              <li>Ask the agent to connect <span className="font-bold">ShipStation</span>, or add it from the Integrations panel.</li>
              <li>Approve the connection with your ShipStation account — no API keys are stored in this app.</li>
              <li>Return here — the queue drains automatically within a minute.</li>
            </ol>
          </div>
          {message && (
            <p className="text-xs text-muted-foreground font-mono mt-4 bg-secondary/40 rounded px-3 py-2 w-full break-words">
              {message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: 'default' | 'amber' | 'destructive' | 'emerald' }) {
  const toneClass =
    tone === 'destructive' ? 'text-destructive' :
    tone === 'amber' ? 'text-amber-500' :
    tone === 'emerald' ? 'text-emerald-500' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
          <Icon className={`w-4 h-4 ${tone === 'default' ? 'text-muted-foreground' : toneClass}`} />
        </div>
        <p className={`font-mono text-3xl font-bold ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ShipmentRow({ shipment }: { shipment: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pushMut = useAdminPushOrderFulfillment();

  const handleRetry = () => {
    pushMut.mutate({ orderId: shipment.orderId }, {
      onSuccess: (result: any) => {
        if (result.pushed) {
          toast({ title: 'Pushed to ShipStation', description: `Order ${shipment.orderNumber} is queued for label purchase.` });
        } else {
          toast({ variant: 'destructive', title: 'Push failed', description: result.error || 'Unknown error — will retry automatically.' });
        }
        queryClient.invalidateQueries({ queryKey: getAdminListShipmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetFulfillmentStatusQueryKey() });
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Push failed', description: err.data?.error || err.message });
      },
    });
  };

  const canRetry = shipment.status === 'pending_push' || shipment.status === 'push_failed';

  return (
    <TableRow className="hover:bg-secondary/20">
      <TableCell>
        <Link href={`/orders/${shipment.orderId}`} className="font-mono font-bold text-primary hover:underline">
          {shipment.orderNumber}
        </Link>
        {shipment.destinationCountry && (
          <span className="ml-2 text-[10px] font-mono text-muted-foreground uppercase">{shipment.destinationCountry}</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{shipment.customerEmail || '—'}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <ShipmentStatusBadge status={shipment.status} />
          {shipment.status === 'push_failed' && shipment.lastPushError && (
            <span className="text-[10px] text-destructive font-mono max-w-[220px] truncate" title={shipment.lastPushError}>
              {shipment.lastPushError}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {shipment.carrier || '—'}
        {shipment.serviceCode && <span className="block text-[10px] font-mono text-muted-foreground">{shipment.serviceCode}</span>}
      </TableCell>
      <TableCell>
        {shipment.trackingNumber ? (
          <a
            href={shipment.trackingUrl ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            {shipment.trackingNumber} <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground font-mono">{formatDate(shipment.createdAt)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {shipment.labelUrl && (
            <a href={shipment.labelUrl} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                <FileText className="w-3 h-3" /> Label
              </Button>
            </a>
          )}
          {canRetry && (
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleRetry} disabled={pushMut.isPending}>
              {pushMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {shipment.status === 'push_failed' ? 'Retry' : 'Push Now'}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
