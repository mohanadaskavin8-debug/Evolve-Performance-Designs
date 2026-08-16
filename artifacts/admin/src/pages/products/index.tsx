import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAdminListProducts } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { Search, Filter, Plus, Package, Star, AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductsPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
  };

  const queryParams = {
    status: status !== 'all' ? status : undefined,
    search: debouncedSearch || undefined,
    limit: 50,
  };

  const { data, isLoading, error } = useAdminListProducts(
    queryParams,
    { query: { placeholderData: (prev: any) => prev, queryKey: [] as any } }
  );

  return (
    <AdminLayout title="Products">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <Tabs value={status} onValueChange={setStatus} className="w-full sm:w-auto">
            <TabsList className="bg-secondary p-1 h-auto">
              <TabsTrigger value="all" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">All</TabsTrigger>
              <TabsTrigger value="active" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">Active</TabsTrigger>
              <TabsTrigger value="draft" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">Draft</TabsTrigger>
              <TabsTrigger value="archived" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">Archived</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-3 w-full sm:w-auto">
            <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search products..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full sm:w-[250px] bg-card"
              />
              <Button type="submit" variant="secondary" size="icon"><Filter className="w-4 h-4" /></Button>
            </form>
            <Button onClick={() => setLocation('/products/new')} className="font-bold tracking-wide">
              <Plus className="w-4 h-4 mr-2" /> New Product
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load products: {(error as any)?.data?.error || error.message}
            </div>
          ) : isLoading && !data ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Inventory</TableHead>
                    <TableHead>Variants</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.products.map((product) => (
                    <TableRow 
                      key={product.id} 
                      className="cursor-pointer hover:bg-primary/5 group transition-colors"
                      onClick={() => setLocation(`/products/${product.id}`)}
                    >
                      <TableCell>
                        <div className="w-12 h-12 rounded-md bg-secondary flex items-center justify-center overflow-hidden border border-border/50">
                          {product.primaryImageUrl ? (
                            <img src={product.primaryImageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                          {product.name}
                          {product.isFeatured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-1">{product.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.status === 'active' ? 'default' : 'secondary'} className={product.status === 'active' ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-mono uppercase tracking-wider text-[10px]' : 'font-mono uppercase tracking-wider text-[10px]'}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm font-mono flex items-center gap-1.5 ${product.totalStock === 0 ? 'text-destructive font-bold' : product.totalStock < 10 ? 'text-amber-500 font-bold' : 'text-muted-foreground'}`}>
                          {product.totalStock === 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                          {product.totalStock} in stock
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {product.variantCount}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {product.priceMin === product.priceMax 
                          ? formatCurrency(product.priceMin) 
                          : `${formatCurrency(product.priceMin)} - ${formatCurrency(product.priceMax)}`}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No products found matching the current filters.
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
