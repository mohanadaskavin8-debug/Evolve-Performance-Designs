import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAdminListReturns } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Undo2, ChevronRight } from 'lucide-react';

export default function ReturnsPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<string>('all');

  const queryParams = {
    status: status !== 'all' ? status : undefined,
    limit: 50,
  };

  const { data, isLoading, error } = useAdminListReturns(
    queryParams,
    { query: { placeholderData: (prev: any) => prev, queryKey: [] as any } }
  );

  return (
    <AdminLayout title="Returns & Exchanges">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <Tabs value={status} onValueChange={setStatus} className="w-full sm:w-auto">
            <TabsList className="bg-secondary p-1 h-auto">
              <TabsTrigger value="all" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">All</TabsTrigger>
              <TabsTrigger value="requested" className="py-2 px-4 text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-500">Requested</TabsTrigger>
              <TabsTrigger value="approved" className="py-2 px-4 text-xs font-bold tracking-wider uppercase text-primary">Approved</TabsTrigger>
              <TabsTrigger value="processing" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">Processing</TabsTrigger>
              <TabsTrigger value="completed" className="py-2 px-4 text-xs font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-500">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load returns: {(error as any)?.data?.error || error.message}
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
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.returns.map((req) => (
                    <TableRow 
                      key={req.id} 
                      className="cursor-pointer hover:bg-primary/5 group transition-colors"
                      onClick={() => setLocation(`/returns/${req.id}`)}
                    >
                      <TableCell className="font-mono font-bold text-foreground">
                        RET-{req.id}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(req.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-primary hover:underline">
                        <Link href={`/orders/${req.orderNumber}`} onClick={e => e.stopPropagation()}>
                          {req.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{req.customerName || '-'}</div>
                        <div className="text-xs text-muted-foreground">{req.customerEmail}</div>
                      </TableCell>
                      <TableCell>
                        <ReturnStatusBadge status={req.status} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-xs font-bold uppercase tracking-wider ${req.preferExchange ? 'border-primary text-primary' : ''}`}>
                          {req.preferExchange ? 'Exchange' : 'Refund'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.returns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <Undo2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No returns found matching the current filters.
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

export function ReturnStatusBadge({ status }: { status: string }) {
  const getProps = () => {
    switch (status) {
      case 'requested': return { variant: 'default' as const, label: 'Requested', className: "bg-amber-500 hover:bg-amber-600 text-white" };
      case 'approved': return { variant: 'default' as const, label: 'Approved', className: "bg-primary text-primary-foreground" };
      case 'processing': return { variant: 'secondary' as const, label: 'Processing' };
      case 'completed': return { variant: 'default' as const, label: 'Completed', className: "bg-emerald-600 hover:bg-emerald-700 text-white" };
      case 'denied': return { variant: 'destructive' as const, label: 'Denied' };
      default: return { variant: 'outline' as const, label: status.replace('_', ' ') };
    }
  };
  
  const props = getProps();
  return (
    <Badge variant={props.variant} className={`font-mono text-[10px] uppercase tracking-wider font-bold ${props.className || ''}`}>
      {props.label}
    </Badge>
  );
}
