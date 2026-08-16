import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAdminListInventory, getAdminListInventoryQueryKey, useAdminAdjustInventory } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function InventoryPage() {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
  };

  const queryParams = {
    filter: (filter !== 'all' ? filter : undefined) as any,
    search: debouncedSearch || undefined,
    limit: 100,
  };

  const { data, isLoading, error } = useAdminListInventory(
    queryParams,
    { query: { placeholderData: (prev: any) => prev, queryKey: [] as any } }
  );

  return (
    <AdminLayout title="Inventory">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
            <TabsList className="bg-secondary p-1 h-auto">
              <TabsTrigger value="all" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">All Inventory</TabsTrigger>
              <TabsTrigger value="low_stock" className="py-2 px-4 text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-500">Low Stock</TabsTrigger>
              <TabsTrigger value="out_of_stock" className="py-2 px-4 text-xs font-bold tracking-wider uppercase text-destructive">Out of Stock</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search SKU or product..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-[300px] bg-card"
            />
            <Button type="submit" variant="secondary" size="icon"><Filter className="w-4 h-4" /></Button>
          </form>
        </div>

        {(((data as any)?.lowStockCount ?? 0) > 0 || ((data as any)?.outOfStockCount ?? 0) > 0) && filter === 'all' && (
          <div className="flex gap-4">
            {((data as any)?.outOfStockCount ?? 0) > 0 && (
              <Badge variant="destructive" className="px-3 py-1.5 font-mono text-sm font-bold shadow-sm">
                <AlertTriangle className="w-4 h-4 mr-2" /> {(data as any)?.outOfStockCount} Out of Stock
              </Badge>
            )}
            {((data as any)?.lowStockCount ?? 0) > 0 && (
              <Badge variant="outline" className="px-3 py-1.5 font-mono text-sm font-bold border-amber-500 text-amber-600 shadow-sm bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="w-4 h-4 mr-2" /> {(data as any)?.lowStockCount} Low Stock
              </Badge>
            )}
          </div>
        )}

        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load inventory: {(error as any)?.data?.error || error.message}
            </div>
          ) : isLoading && !data ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU / Variant</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((item) => (
                    <TableRow key={item.variantId} className="hover:bg-primary/5 group transition-colors">
                      <TableCell>
                        <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center overflow-hidden border">
                          {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-foreground">
                        {item.productName}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-primary text-sm font-bold">{item.sku}</div>
                        {(item.size || item.color) && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {[item.size, item.color].filter(Boolean).join(' / ')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant="outline" 
                          className={`font-mono font-bold text-sm border ${item.availableQuantity === 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : item.availableQuantity < 10 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}
                        >
                          {item.availableQuantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {item.reservedQuantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.stockQuantity}
                      </TableCell>
                      <TableCell className="text-right">
                        <AdjustInventoryDialog item={item} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        No inventory found matching the current filters.
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

function AdjustInventoryDialog({ item }: { item: any }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState('0');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminAdjustInventory();

  const handleAdjust = () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty === 0) return;

    mutation.mutate({
      data: {
        variantId: item.variantId,
        quantity: qty,
        notes: notes || 'Manual adjustment'
      }
    }, {
      onSuccess: () => {
        toast({ title: 'Inventory Adjusted', description: `${qty > 0 ? '+' : ''}${qty} units applied to ${item.sku}.` });
        queryClient.invalidateQueries({ queryKey: getAdminListInventoryQueryKey() });
        setOpen(false);
        setQuantity('0');
        setNotes('');
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRightLeft className="w-4 h-4 mr-2" /> Adjust
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Inventory: {item.sku}</DialogTitle>
          <DialogDescription>
            {item.productName} {[item.size, item.color].filter(Boolean).join(' / ')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          <div className="flex justify-between items-center bg-secondary/50 p-4 rounded-lg border">
            <div className="text-center">
              <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Current On Hand</p>
              <p className="font-mono text-2xl font-bold">{item.stockQuantity}</p>
            </div>
            <ArrowRightLeft className="w-6 h-6 text-muted-foreground mx-4" />
            <div className="text-center">
              <p className="text-xs uppercase font-bold text-primary mb-1">New On Hand</p>
              <p className="font-mono text-2xl font-bold text-primary">
                {item.stockQuantity + (parseInt(quantity) || 0)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adjustment Quantity (+/-)</Label>
            <Input 
              type="number" 
              value={quantity} 
              onChange={e => setQuantity(e.target.value)} 
              className="font-mono text-lg h-12" 
            />
            <p className="text-xs text-muted-foreground">Use negative numbers to remove stock.</p>
          </div>

          <div className="space-y-2">
            <Label>Reason / Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Received new shipment, Damaged item..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleAdjust} disabled={mutation.isPending || !quantity || parseInt(quantity) === 0}>
            {mutation.isPending ? 'Saving...' : 'Apply Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
