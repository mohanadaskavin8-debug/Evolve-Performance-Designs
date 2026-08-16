import { useState } from 'react';
import { 
  useAdminListShippingZones, 
  useAdminCreateShippingZone, 
  useAdminUpdateShippingZone, 
  useAdminDeleteShippingZone, 
  useAdminCreateShippingRate,
  useAdminUpdateShippingRate,
  useAdminDeleteShippingRate,
  getAdminListShippingZonesQueryKey 
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { Globe, Plus, Trash2, Edit2, Truck, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function ShippingPage() {
  const { data: zones, isLoading, error } = useAdminListShippingZones();

  return (
    <AdminLayout title="Shipping & Logistics">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">Manage shipping zones and rates.</p>
          <ZoneDialog />
        </div>

        {error ? (
          <div className="p-8 text-center text-destructive font-mono text-sm border border-destructive/20 bg-destructive/5 rounded-lg">
            Failed to load shipping zones: {(error as any)?.data?.error || error.message}
          </div>
        ) : isLoading && !zones ? (
          <div className="space-y-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : zones?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center h-64 border-dashed bg-secondary/10">
            <Globe className="w-8 h-8 mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No shipping zones configured.</p>
            <div className="mt-4"><ZoneDialog /></div>
          </Card>
        ) : (
          <Accordion type="multiple" defaultValue={zones?.map(z => z.id.toString())} className="space-y-4">
            {zones?.map((zone) => (
              <AccordionItem key={zone.id} value={zone.id.toString()} className="border rounded-lg bg-card overflow-hidden shadow-sm">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/20">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-lg">{zone.name}</h3>
                        <p className="text-sm text-muted-foreground truncate max-w-[300px] sm:max-w-md">
                          {zone.countries.join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <Badge variant={zone.active ? 'default' : 'secondary'} className={zone.active ? 'bg-emerald-600' : ''}>
                        {zone.active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-xs">
                        {zone.rates.length} rates
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-6 px-6">
                  <div className="border-t pt-4 mt-2">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Shipping Rates</h4>
                      <div className="flex gap-2">
                        <ZoneDialog zone={zone} />
                        <DeleteZoneButton zone={zone} />
                        <RateDialog zoneId={zone.id} />
                      </div>
                    </div>

                    {zone.rates.length === 0 ? (
                      <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                        No rates configured for this zone. Customers won't be able to checkout if they live here.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {zone.rates.map(rate => (
                          <div key={rate.id} className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-colors">
                            <div className="flex items-center gap-3">
                              <Truck className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <div className="font-bold flex items-center gap-2">
                                  {rate.name}
                                  {rate.active ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <span className="text-[10px] text-muted-foreground uppercase bg-secondary px-1 py-0.5 rounded">Disabled</span>}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">{rate.estimatedDays}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="font-mono font-bold text-primary">{formatCurrency(rate.priceInCents)}</div>
                                {rate.minimumOrderInCents ? (
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Min {formatCurrency(rate.minimumOrderInCents)}</div>
                                ) : null}
                              </div>
                              <div className="flex flex-col gap-1">
                                <RateDialog zoneId={zone.id} rate={rate} />
                                <DeleteRateButton zoneId={zone.id} rate={rate} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </AdminLayout>
  );
}

// Zone Dialog
function ZoneDialog({ zone }: { zone?: any }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState(zone?.name || '');
  const [countries, setCountries] = useState(zone?.countries?.join(', ') || '');
  const [active, setActive] = useState(zone ? zone.active : true);

  const createMut = useAdminCreateShippingZone();
  const updateMut = useAdminUpdateShippingZone();
  const isPending = createMut.isPending || updateMut.isPending;

  const handleSave = () => {
    const data: any = {
      name,
      countries: countries.split(',').map((c: string) => c.trim()).filter(Boolean),
      active
    };

    if (!zone) {
      createMut.mutate({ data }, {
        onSuccess: () => {
          toast({ title: 'Zone Created' });
          queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });
          setOpen(false);
          setName(''); setCountries('');
        },
        onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
      });
    } else {
      updateMut.mutate({ zoneId: zone.id, data }, {
        onSuccess: () => {
          toast({ title: 'Zone Updated' });
          queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });
          setOpen(false);
        },
        onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {zone ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="h-8"><Edit2 className="w-3 h-3 mr-2" /> Edit Zone</Button>
      ) : (
        <Button onClick={() => setOpen(true)} className="font-bold tracking-wide"><Plus className="w-4 h-4 mr-2" /> New Zone</Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{zone ? 'Edit Shipping Zone' : 'New Shipping Zone'}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Zone Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Domestic (US)" />
          </div>
          <div className="space-y-2">
            <Label>Countries (comma separated ISO codes)</Label>
            <Input value={countries} onChange={e => setCountries(e.target.value)} placeholder="e.g. US, CA, GB" className="font-mono uppercase" />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/20">
            <Label htmlFor={`active-zone-${zone?.id || 'new'}`} className="cursor-pointer font-bold uppercase tracking-wider text-xs">Active Status</Label>
            <Switch id={`active-zone-${zone?.id || 'new'}`} checked={active} onCheckedChange={c => setActive(!!c)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !name || !countries}>Save Zone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteZoneButton({ zone }: { zone: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminDeleteShippingZone();

  const handleDelete = () => {
    if (!confirm(`Delete zone ${zone.name}? This removes all its rates.`)) return;
    mutation.mutate({ zoneId: zone.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });
        toast({ title: 'Zone Deleted' });
      },
      onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
    });
  };

  return (
    <Button variant="outline" size="sm" className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete} disabled={mutation.isPending}>
      <Trash2 className="w-3 h-3 mr-2" /> Delete
    </Button>
  );
}

// Rate Dialog
function RateDialog({ zoneId, rate }: { zoneId: number, rate?: any }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState(rate?.name || '');
  const [rateType, setRateType] = useState<any>(rate?.rateType || 'flat');
  const [price, setPrice] = useState(rate ? (rate.priceInCents / 100).toString() : '');
  const [minOrder, setMinOrder] = useState(rate?.minimumOrderInCents ? (rate.minimumOrderInCents / 100).toString() : '');
  const [estimatedDays, setEstimatedDays] = useState(rate?.estimatedDays || '');
  const [active, setActive] = useState(rate ? rate.active : true);
  const [carrierCode, setCarrierCode] = useState(rate?.carrierCode || '');
  const [serviceCode, setServiceCode] = useState(rate?.serviceCode || '');

  const createMut = useAdminCreateShippingRate();
  const updateMut = useAdminUpdateShippingRate();
  const isPending = createMut.isPending || updateMut.isPending;

  const handleSave = () => {
    const data: any = {
      name,
      rateType,
      priceInCents: Math.round(parseFloat(price) * 100) || 0,
      minimumOrderInCents: minOrder ? Math.round(parseFloat(minOrder) * 100) : undefined,
      estimatedDays,
      active,
      carrierCode: rateType === 'calculated' ? (carrierCode.trim() || null) : null,
      serviceCode: rateType === 'calculated' ? (serviceCode.trim() || null) : null,
    };

    if (!rate) {
      createMut.mutate({ zoneId, data }, {
        onSuccess: () => {
          toast({ title: 'Rate Created' });
          queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });
          setOpen(false);
          setName(''); setPrice(''); setMinOrder(''); setEstimatedDays('');
        },
        onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
      });
    } else {
      updateMut.mutate({ zoneId, rateId: rate.id, data }, {
        onSuccess: () => {
          toast({ title: 'Rate Updated' });
          queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });
          setOpen(false);
        },
        onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {rate ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="h-6 w-6"><Edit2 className="w-3 h-3 text-muted-foreground" /></Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)} className="h-8"><Plus className="w-3 h-3 mr-1" /> Add Rate</Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rate ? 'Edit Rate' : 'New Shipping Rate'}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Rate Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Shipping" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={rateType} onValueChange={setRateType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat Rate</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="calculated">Live Carrier Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{rateType === 'calculated' ? 'Fallback Price (USD)' : 'Price (USD)'}</Label>
              <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} disabled={rateType === 'free'} className="font-mono" />
            </div>
          </div>
          {rateType === 'calculated' && (
            <div className="space-y-3 p-3 border rounded-lg bg-secondary/20">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quotes the live carrier price from ShipStation at checkout. If ShipStation is
                unavailable or not connected, customers are charged the fallback price instead.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Carrier Code</Label>
                  <Input value={carrierCode} onChange={e => setCarrierCode(e.target.value)} placeholder="e.g. usps" className="font-mono lowercase" />
                </div>
                <div className="space-y-2">
                  <Label>Service Code</Label>
                  <Input value={serviceCode} onChange={e => setServiceCode(e.target.value)} placeholder="e.g. usps_priority_mail" className="font-mono lowercase" />
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Order Value (USD)</Label>
              <Input type="number" step="0.01" value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder="Optional" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Estimated Days</Label>
              <Input value={estimatedDays} onChange={e => setEstimatedDays(e.target.value)} placeholder="e.g. 3-5 business days" />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/20">
            <Label htmlFor={`active-rate-${rate?.id || 'new'}`} className="cursor-pointer font-bold uppercase tracking-wider text-xs">Active Status</Label>
            <Switch id={`active-rate-${rate?.id || 'new'}`} checked={active} onCheckedChange={c => setActive(!!c)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !name || (rateType === 'flat' && !price)}>Save Rate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRateButton({ zoneId, rate }: { zoneId: number, rate: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminDeleteShippingRate();

  const handleDelete = () => {
    if (!confirm(`Delete rate ${rate.name}?`)) return;
    mutation.mutate({ zoneId, rateId: rate.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });
        toast({ title: 'Rate Deleted' });
      },
      onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
    });
  };

  return (
    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={handleDelete} disabled={mutation.isPending}>
      <Trash2 className="w-3 h-3" />
    </Button>
  );
}
