import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAdminListOrders, getAdminListOrdersQueryKey } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { Search, Filter, ShieldAlert, ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrdersPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Handle search with a manual timeout rather than complex debouncing for simplicity
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
  };

  const queryParams = {
    status: status !== 'all' ? status : undefined,
    search: debouncedSearch || undefined,
    limit: 50,
  };

  const { data, isLoading, error } = useAdminListOrders(
    queryParams,
    { query: { placeholderData: (prev: any) => prev, queryKey: [] as any } }
  );

  return (
    <AdminLayout title="Orders">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <Tabs value={status} onValueChange={setStatus} className="w-full sm:w-auto">
            <TabsList className="bg-secondary p-1 h-auto">
              <TabsTrigger value="all" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">All</TabsTrigger>
              <TabsTrigger value="pending" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">Pending</TabsTrigger>
              <TabsTrigger value="processing" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">Processing</TabsTrigger>
              <TabsTrigger value="ready_to_ship" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">Ready to Ship</TabsTrigger>
              <TabsTrigger value="fulfilled" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">Fulfilled</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search orders..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-[300px] bg-card"
            />
            <Button type="submit" variant="secondary" size="icon"><Filter className="w-4 h-4" /></Button>
          </form>
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load orders: {(error as any)?.data?.error || error.message}
            </div>
          ) : isLoading && !data ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.orders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="cursor-pointer hover:bg-primary/5 group transition-colors"
                      onClick={() => setLocation(`/orders/${order.id}`)}
                    >
                      <TableCell className="font-mono font-bold text-foreground">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.customerName || '-'}</div>
                        <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <OrderStatusBadge status={order.status} />
                          {order.requiresManualReview && (
                            <Badge variant="destructive" className="h-5 px-1.5 uppercase text-[9px] tracking-wider font-bold">
                              <ShieldAlert className="w-3 h-3 mr-1" /> Risk
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {order.itemCount} items
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(order.totalInCents)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.orders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        No orders found matching the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  const getProps = () => {
    switch (status) {
      case 'pending': return { variant: 'secondary' as const, label: 'Pending' };
      case 'processing': return { variant: 'default' as const, label: 'Processing', className: "bg-blue-600 hover:bg-blue-700 text-white" };
      case 'ready_to_ship': return { variant: 'default' as const, label: 'Ready to Ship', className: "bg-amber-500 hover:bg-amber-600 text-white" };
      case 'fulfilled': return { variant: 'default' as const, label: 'Fulfilled', className: "bg-emerald-600 hover:bg-emerald-700 text-white" };
      case 'cancelled': return { variant: 'destructive' as const, label: 'Cancelled' };
      case 'refunded': return { variant: 'destructive' as const, label: 'Refunded' };
      default: return { variant: 'outline' as const, label: status.replace('_', ' ') };
    }
  };
  
  const props = getProps();
  return (
    <Badge variant={props.variant} className={`font-mono text-xs uppercase tracking-wider ${props.className || ''}`}>
      {props.label}
    </Badge>
  );
}
