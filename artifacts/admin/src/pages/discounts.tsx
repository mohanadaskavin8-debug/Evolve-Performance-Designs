import { useState } from 'react';
import { useAdminListDiscounts, useAdminCreateDiscount, useAdminUpdateDiscount, useAdminDeleteDiscount, getAdminListDiscountsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/format';
import { TicketPercent, Plus, Trash2, Edit2, Percent, DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function DiscountsPage() {
  const { data, isLoading, error } = useAdminListDiscounts();

  return (
    <AdminLayout title="Discounts">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">Manage promo codes and discounts.</p>
          <DiscountDialog />
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load discounts: {(error as any)?.data?.error || error.message}
            </div>
          ) : isLoading && !data ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead className="text-right">Rules</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.map((discount) => (
                    <TableRow key={discount.id} className="hover:bg-primary/5 transition-colors group">
                      <TableCell className="font-mono font-bold text-lg text-primary tracking-wider">
                        {discount.code}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center font-bold text-foreground">
                          {discount.discountType === 'percentage' ? (
                            <><Percent className="w-4 h-4 mr-1 text-muted-foreground" /> {discount.value}%</>
                          ) : (
                            <><DollarSign className="w-4 h-4 mr-1 text-muted-foreground" /> {formatCurrency(discount.value)}</>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={discount.active ? 'default' : 'secondary'} className={discount.active ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                          {discount.active ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {discount.usedCount} {discount.maxUses ? `/ ${discount.maxUses}` : 'uses'}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {discount.minimumOrderInCents ? `Min: ${formatCurrency(discount.minimumOrderInCents)}` : 'No minimum'}
                        {discount.expiresAt && <div className="mt-0.5">Expires: {formatDate(discount.expiresAt).split(',')[0]}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DiscountDialog discount={discount} />
                          <DeleteDiscountButton discount={discount} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <TicketPercent className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No discounts created yet.
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

function DiscountDialog({ discount }: { discount?: any }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [code, setCode] = useState(discount?.code || '');
  const [type, setType] = useState<any>(discount?.discountType || 'percentage');
  const [value, setValue] = useState(discount ? (discount.discountType === 'fixed' ? (discount.value / 100).toString() : discount.value.toString()) : '');
  const [minOrder, setMinOrder] = useState(discount?.minimumOrderInCents ? (discount.minimumOrderInCents / 100).toString() : '');
  const [active, setActive] = useState(discount ? discount.active : true);

  const createMut = useAdminCreateDiscount();
  const updateMut = useAdminUpdateDiscount();
  const isPending = createMut.isPending || updateMut.isPending;

  const handleSave = () => {
    const numericValue = parseFloat(value);
    const data: any = {
      code: code.toUpperCase(),
      active
    };

    if (!discount) {
      data.discountType = type;
      data.value = type === 'fixed' ? Math.round(numericValue * 100) : numericValue;
      data.minimumOrderInCents = minOrder ? Math.round(parseFloat(minOrder) * 100) : undefined;
      
      createMut.mutate({ data }, {
        onSuccess: () => {
          toast({ title: 'Discount Created' });
          queryClient.invalidateQueries({ queryKey: getAdminListDiscountsQueryKey() });
          setOpen(false);
          setCode(''); setValue(''); setMinOrder('');
        },
        onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
      });
    } else {
      data.minimumOrderInCents = minOrder ? Math.round(parseFloat(minOrder) * 100) : undefined;
      updateMut.mutate({ discountId: discount.id, data }, {
        onSuccess: () => {
          toast({ title: 'Discount Updated' });
          queryClient.invalidateQueries({ queryKey: getAdminListDiscountsQueryKey() });
          setOpen(false);
        },
        onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {discount ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="h-8 w-8 hover:bg-secondary"><Edit2 className="w-4 h-4 text-muted-foreground" /></Button>
      ) : (
        <Button onClick={() => setOpen(true)} className="font-bold tracking-wide"><Plus className="w-4 h-4 mr-2" /> Create Discount</Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{discount ? 'Edit Discount' : 'New Discount'}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Code</Label>
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="font-mono uppercase tracking-widest text-lg h-12" placeholder="e.g. SUMMER20" />
          </div>
          {!discount && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} className="font-mono" />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Minimum Order Value (USD, optional)</Label>
            <Input type="number" step="0.01" value={minOrder} onChange={e => setMinOrder(e.target.value)} className="font-mono" />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/20">
            <Label htmlFor={`active-${discount?.id || 'new'}`} className="cursor-pointer font-bold uppercase tracking-wider text-xs">Active Status</Label>
            <Switch id={`active-${discount?.id || 'new'}`} checked={active} onCheckedChange={c => setActive(!!c)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !code || (!discount && !value)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDiscountButton({ discount }: { discount: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminDeleteDiscount();

  const handleDelete = () => {
    if (!confirm(`Delete discount ${discount.code}?`)) return;
    mutation.mutate({ discountId: discount.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListDiscountsQueryKey() });
        toast({ title: 'Discount Deleted' });
      },
      onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
    });
  };

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive" onClick={handleDelete} disabled={mutation.isPending}>
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
