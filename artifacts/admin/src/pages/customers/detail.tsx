import { useRoute, useLocation, Link } from 'wouter';
import { useAdminGetCustomer, getAdminGetCustomerQueryKey } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { OrderStatusBadge } from '@/pages/orders/index';
import { ArrowLeft, User, Mail, Phone, Calendar, ShoppingCart, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CustomerDetailPage() {
  const [, params] = useRoute('/customers/:id');
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;
  
  const { data: customer, isLoading, error } = useAdminGetCustomer(id, {
    query: { enabled: !!id, queryKey: getAdminGetCustomerQueryKey(id) }
  });

  if (error) {
    return (
      <AdminLayout title="Customer Profile">
        <div className="p-6 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 font-mono text-sm">
          Failed to load customer: {(error as any)?.data?.error || error.message}
        </div>
      </AdminLayout>
    );
  }

  if (isLoading || !customer) {
    return (
      <AdminLayout title="Customer Profile">
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </AdminLayout>
    );
  }

  const name = customer.firstName || customer.lastName ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Unknown Name';

  return (
    <AdminLayout title={name}>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/customers" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Customers
        </Link>
        <div className="flex items-center gap-3">
          <Badge variant={customer.status === 'active' ? 'default' : 'secondary'} className={customer.status === 'active' ? 'bg-emerald-600' : ''}>
            {customer.status?.toUpperCase() || 'UNKNOWN'}
          </Badge>
          {customer.marketingConsent && (
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 font-mono text-xs">
              Marketing: Opted-In
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b text-center pt-8">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                <User className="w-10 h-10 text-muted-foreground" />
              </div>
              <CardTitle className="text-2xl">{name}</CardTitle>
              <CardDescription className="font-mono">{customer.email}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="text-foreground">{customer.email}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span className="text-foreground">{customer.phone || 'No phone number'}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-foreground">Joined {formatDate(customer.createdAt)}</span>
              </div>
              {customer.clerkUserId && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Activity className="w-4 h-4" />
                  <span className="font-mono text-[10px] break-all">{customer.clerkUserId}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">Value Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 divide-x border-b">
                <div className="p-6 text-center">
                  <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Total Orders</p>
                  <p className="text-3xl font-bold font-mono">{customer.orderCount}</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Total Spent</p>
                  <p className="text-3xl font-bold font-mono text-primary">{formatCurrency(customer.totalSpentInCents)}</p>
                </div>
              </div>
              <div className="p-4 text-center text-sm text-muted-foreground">
                Avg Order Value: <span className="font-mono font-bold text-foreground">{customer.orderCount > 0 ? formatCurrency(Math.round(customer.totalSpentInCents / customer.orderCount)) : '$0.00'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 lg:col-span-2 space-y-6">
          <Card className="h-full">
            <CardHeader className="pb-4 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" /> Order History
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.recentOrders?.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => setLocation(`/orders/${order.id}`)}
                    >
                      <TableCell className="font-mono font-bold text-primary">{order.orderNumber}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                      <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatCurrency(order.totalInCents)}</TableCell>
                    </TableRow>
                  ))}
                  {(!customer.recentOrders || customer.recentOrders.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground p-8">No orders found for this customer.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
