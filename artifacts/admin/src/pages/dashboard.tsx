import { useAdminGetDashboard, getAdminGetDashboardQueryKey } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/format';
import { AlertCircle, TrendingUp, Package, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function DashboardPage() {
  const { data, isLoading, error } = useAdminGetDashboard();

  if (error) {
    return (
      <AdminLayout title="Dashboard">
        <div className="p-6 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 font-mono text-sm">
          Failed to load dashboard: {(error as any)?.data?.error || error.message}
        </div>
      </AdminLayout>
    );
  }

  if (isLoading || !data) {
    return (
      <AdminLayout title="Dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="col-span-2 h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      {/* Action Items Feed */}
      {data.attentionItems.length > 0 && (
        <div className="mb-8 space-y-3">
          {data.attentionItems.map((item, idx) => (
            <Link key={idx} href={item.href}>
              <div className="group flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg cursor-pointer transition-colors">
                <div className="flex items-center gap-3 text-primary">
                  {item.severity === 'high' ? <AlertTriangle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="bg-background text-foreground font-mono text-sm">
                    {item.count}
                  </Badge>
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard 
          title="Today's Revenue" 
          value={formatCurrency(data.revenue.todayInCents)}
          icon={TrendingUp}
          trend={`${data.revenue.monthGrowthPct > 0 ? '+' : ''}${data.revenue.monthGrowthPct.toFixed(1)}% this month`}
          trendPositive={data.revenue.monthGrowthPct >= 0}
        />
        <MetricCard 
          title="Orders Processing" 
          value={formatNumber(data.orders.processing)}
          icon={Package}
          subValue={`${data.orders.readyToShip} ready to ship`}
        />
        <MetricCard 
          title="New Customers" 
          value={formatNumber(data.customers.newThisWeek)}
          icon={Users}
          subValue={`${formatNumber(data.customers.total)} total`}
        />
        <MetricCard 
          title="Inventory Alerts" 
          value={formatNumber(data.inventory.outOfStockCount)}
          icon={AlertTriangle}
          subValue={`${data.inventory.lowStockCount} low stock`}
          valueColor={data.inventory.outOfStockCount > 0 ? "text-destructive" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>Revenue over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.salesByDay} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { weekday: 'short' })} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    tickFormatter={(val) => `$${val/100}`} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--secondary))' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border shadow-md p-3 rounded-lg">
                            <p className="text-sm font-medium mb-1">{new Date(label).toLocaleDateString()}</p>
                            <p className="text-primary font-mono font-bold text-lg">
                              {formatCurrency(payload[0].value as number)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {payload[0].payload.orderCount} orders
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="revenueInCents" radius={[4, 4, 0, 0]}>
                    {data.salesByDay.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === data.salesByDay.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.6)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="col-span-1 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest activity</CardDescription>
            </div>
            <Link href="/orders" className="text-sm text-primary font-medium hover:underline">View All</Link>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px]">Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentOrders.map(order => (
                  <TableRow key={order.id} className="cursor-pointer group" onClick={() => window.location.href = `/admin/orders/${order.id}`}>
                    <TableCell className="font-mono text-xs font-medium group-hover:text-primary transition-colors">{order.orderNumber}</TableCell>
                    <TableCell>
                      <div className="truncate w-[120px] text-sm">{order.customerName || order.customerEmail}</div>
                      <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{order.status.replace('_', ' ')}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(order.totalInCents)}</TableCell>
                  </TableRow>
                ))}
                {data.recentOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No recent orders</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function MetricCard({ title, value, icon: Icon, trend, trendPositive, subValue, valueColor }: any) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`text-3xl font-bold font-mono tracking-tight ${valueColor || ''}`}>{value}</p>
          </div>
          <div className="p-3 bg-secondary rounded-lg">
            <Icon className="w-5 h-5 text-secondary-foreground" />
          </div>
        </div>
        {(trend || subValue) && (
          <div className="mt-4 pt-4 border-t flex items-center text-sm">
            {trend && (
              <span className={`font-medium ${trendPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive'}`}>
                {trend}
              </span>
            )}
            {subValue && (
              <span className="text-muted-foreground">{subValue}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
