import { useState } from 'react';
import { useAdminGetSalesReport } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Package, Hash, DollarSign } from 'lucide-react';

export default function ReportsPage() {
  const [period, setPeriod] = useState<string>('month');

  const { data, isLoading, error } = useAdminGetSalesReport(
    { period } as any,
    { query: { placeholderData: (prev: any) => prev, queryKey: [] as any } }
  );

  return (
    <AdminLayout title="Financial Reports">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">Analyze sales performance and top products.</p>
          <div className="w-[180px]">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="font-bold tracking-wide">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center text-destructive font-mono text-sm border border-destructive/20 bg-destructive/5 rounded-lg">
            Failed to load reports: {(error as any)?.data?.error || error.message}
          </div>
        ) : isLoading && !data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Gross Revenue</p>
                    <p className="text-3xl font-bold font-mono text-primary">{formatCurrency(data.totalRevenueInCents)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-primary/20" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Orders</p>
                    <p className="text-3xl font-bold font-mono">{formatNumber(data.totalOrders)}</p>
                  </div>
                  <Package className="w-8 h-8 text-muted-foreground/20" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Avg Order Value</p>
                    <p className="text-3xl font-bold font-mono">{formatCurrency(data.avgOrderValueInCents)}</p>
                  </div>
                  <Hash className="w-8 h-8 text-muted-foreground/20" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Refunded</p>
                    <p className="text-3xl font-bold font-mono text-destructive">{formatCurrency(data.refundedInCents)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-destructive/20" />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                  <CardTitle>Sales Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.salesByDay} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
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
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="revenueInCents" radius={[4, 4, 0, 0]}>
                          {data.salesByDay.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={'hsl(var(--primary))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Top Products</CardTitle>
                  <CardDescription>By revenue this period</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topProducts?.map((p: any) => (
                        <TableRow key={p.productId} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-medium text-sm max-w-[150px] truncate" title={p.productName}>
                            {p.productName}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground text-sm">
                            {p.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-sm">
                            {formatCurrency(p.revenueInCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!data.topProducts || data.topProducts.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground p-8">No sales in this period.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
