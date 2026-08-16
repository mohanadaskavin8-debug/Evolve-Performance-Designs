import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAdminListCustomers } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { Search, Filter, ChevronRight, Users, Mail, Phone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CustomersPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
  };

  const queryParams = {
    search: debouncedSearch || undefined,
    limit: 50,
  };

  const { data, isLoading, error } = useAdminListCustomers(
    queryParams,
    { query: { placeholderData: (prev: any) => prev, queryKey: [] as any } }
  );

  return (
    <AdminLayout title="Customers">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full max-w-md relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card"
            />
            <Button type="submit" variant="secondary" size="icon"><Filter className="w-4 h-4" /></Button>
          </form>
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load customers: {(error as any)?.data?.error || error.message}
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
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.customers.map((customer) => (
                    <TableRow 
                      key={customer.id} 
                      className="cursor-pointer hover:bg-primary/5 group transition-colors"
                      onClick={() => setLocation(`/customers/${customer.id}`)}
                    >
                      <TableCell>
                        <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {customer.firstName || customer.lastName ? `${customer.firstName || ''} ${customer.lastName || ''}` : 'Unknown Name'}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">Joined {formatDate(customer.createdAt).split(',')[0]}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {customer.email}
                        </div>
                        {customer.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <Phone className="w-3 h-3" /> {customer.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.status === 'active' ? 'default' : 'secondary'} className={customer.status === 'active' ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-mono uppercase tracking-wider text-[10px]' : 'font-mono uppercase tracking-wider text-[10px]'}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-muted-foreground">
                        {customer.orderCount}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">
                        {formatCurrency(customer.totalSpentInCents)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.customers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No customers found.
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
