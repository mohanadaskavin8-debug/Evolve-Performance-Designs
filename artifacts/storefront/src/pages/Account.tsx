import { useState } from 'react';
import { SignIn, SignOutButton, useUser } from '@clerk/react';
import { 
  useGetAccountProfile, 
  useUpdateAccountProfile, 
  useListAccountOrders, 
  useListAccountAddresses, 
  useListAccountReturns,
  useCreateAccountAddress,
  useDeleteAccountAddress
} from '@workspace/api-client-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/utils';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Package, MapPin, RefreshCw, UserCircle, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Account() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null;

  return (
    <div className="container mx-auto px-4 py-12">
      {!isSignedIn ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="text-4xl font-display font-bold uppercase tracking-tight mb-8">Access Terminal</h1>
          <SignIn routing="hash" appearance={{ elements: { rootBox: "mx-auto" } }} />
        </div>
      ) : (
        <AccountDashboard />
      )}
    </div>
  );
}

function AccountDashboard() {
  const { user } = useUser();
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight mb-2">
            Command Center
          </h1>
          <p className="font-mono text-muted-foreground">Operative: {user?.primaryEmailAddress?.emailAddress}</p>
        </div>
        <SignOutButton>
          <Button variant="outline" className="font-display uppercase tracking-widest gap-2">
            <LogOut className="w-4 h-4" /> Disconnect
          </Button>
        </SignOutButton>
      </div>

      <Tabs defaultValue="orders" className="w-full flex flex-col md:flex-row gap-8">
        <TabsList className="flex md:flex-col justify-start h-auto bg-transparent p-0 space-y-0 space-x-2 md:space-x-0 md:space-y-2 w-full md:w-64 shrink-0 overflow-x-auto border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4">
          <TabsTrigger value="orders" className="data-[state=active]:bg-card data-[state=active]:border-border border border-transparent w-full justify-start px-4 py-3 font-display uppercase tracking-widest text-sm">
            <Package className="w-4 h-4 mr-2 hidden md:block" /> Deployment History
          </TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-card data-[state=active]:border-border border border-transparent w-full justify-start px-4 py-3 font-display uppercase tracking-widest text-sm">
            <UserCircle className="w-4 h-4 mr-2 hidden md:block" /> Dossier
          </TabsTrigger>
          <TabsTrigger value="addresses" className="data-[state=active]:bg-card data-[state=active]:border-border border border-transparent w-full justify-start px-4 py-3 font-display uppercase tracking-widest text-sm">
            <MapPin className="w-4 h-4 mr-2 hidden md:block" /> Safehouses
          </TabsTrigger>
          <TabsTrigger value="returns" className="data-[state=active]:bg-card data-[state=active]:border-border border border-transparent w-full justify-start px-4 py-3 font-display uppercase tracking-widest text-sm">
            <RefreshCw className="w-4 h-4 mr-2 hidden md:block" /> Returns
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 min-w-0">
          <TabsContent value="orders" className="m-0 focus-visible:outline-none">
            <OrdersTab />
          </TabsContent>
          <TabsContent value="profile" className="m-0 focus-visible:outline-none">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="addresses" className="m-0 focus-visible:outline-none">
            <AddressesTab />
          </TabsContent>
          <TabsContent value="returns" className="m-0 focus-visible:outline-none">
            <ReturnsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function OrdersTab() {
  const { data: ordersData, isLoading } = useListAccountOrders({}, { query: { queryKey: ['account-orders'] } });

  if (isLoading) return <div className="font-mono animate-pulse">Loading records...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold uppercase tracking-widest mb-6">Deployment History</h2>
      {ordersData?.length ? (
        <div className="space-y-4">
          {ordersData.map(order => (
            <div key={order.id} className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row justify-between gap-6 hover:border-primary/50 transition-colors">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-display font-bold uppercase tracking-wider text-xl">{order.orderNumber}</h3>
                  <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="font-mono uppercase text-[10px]">
                    {order.status}
                  </Badge>
                </div>
                <p className="font-mono text-sm text-muted-foreground mb-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                <p className="font-mono text-sm text-muted-foreground">{order.itemCount} item{order.itemCount > 1 ? 's' : ''} • {formatPrice(order.totalInCents)}</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="outline" className="font-display uppercase tracking-widest w-full md:w-auto" asChild>
                  <Link href={`/orders/${order.orderNumber}`}>View Details</Link>
                </Button>
                {order.trackingNumber && (
                  <Button variant="ghost" className="font-display uppercase tracking-widest w-full md:w-auto text-primary" asChild>
                    <Link href={`/track?orderNumber=${order.orderNumber}`}>Track Status</Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="font-mono text-muted-foreground uppercase tracking-widest mb-6">No deployments on record.</p>
          <Button asChild className="font-display uppercase tracking-widest">
            <Link href="/products">Visit Armory</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function ProfileTab() {
  const { data: profile, refetch } = useGetAccountProfile({ query: { queryKey: ['account-profile'] } });
  const updateProfile = useUpdateAccountProfile();
  const { toast } = useToast();
  
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [phone, setPhone] = useState(profile?.phone || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { data: { firstName, lastName, phone } },
      { 
        onSuccess: () => {
          toast({ title: "Dossier Updated", description: "Your operative profile has been synchronized." });
          refetch();
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to sync profile.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold uppercase tracking-widest mb-6">Operative Dossier</h2>
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-6 max-w-xl">
        <div>
          <Label className="font-display uppercase tracking-widest text-muted-foreground">Email Designation</Label>
          <Input value={profile?.email || ''} disabled className="mt-2 bg-background opacity-50 font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="font-display uppercase tracking-widest text-muted-foreground">First Name</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-2 bg-background font-mono" />
          </div>
          <div>
            <Label className="font-display uppercase tracking-widest text-muted-foreground">Last Name</Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} className="mt-2 bg-background font-mono" />
          </div>
        </div>
        <div>
          <Label className="font-display uppercase tracking-widest text-muted-foreground">Comm Link (Phone)</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-2 bg-background font-mono" />
        </div>
        <Button type="submit" disabled={updateProfile.isPending} className="font-display uppercase tracking-widest">
          {updateProfile.isPending ? 'Syncing...' : 'Update Records'}
        </Button>
      </form>
    </div>
  );
}

function AddressesTab() {
  const { data: addresses, refetch } = useListAccountAddresses({ query: { queryKey: ['account-addresses'] } });
  const createAddress = useCreateAccountAddress();
  const deleteAddress = useDeleteAccountAddress();
  const { toast } = useToast();
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', line1: '', line2: '', city: '', state: '', postalCode: '', countryCode: 'US' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAddress.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast({ title: "Safehouse Added", description: "New coordinates secured." });
          setShowForm(false);
          refetch();
        },
        onError: () => toast({ title: "Error", description: "Failed to establish coordinates.", variant: "destructive" })
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteAddress.mutate(
      { addressId: id },
      { onSuccess: () => refetch() }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-display font-bold uppercase tracking-widest">Safehouses</h2>
        <Button variant="outline" onClick={() => setShowForm(!showForm)} className="font-display uppercase tracking-widest">
          {showForm ? 'Cancel' : 'Add New'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-xl mb-8">
          <div>
            <Label className="font-display uppercase tracking-widest text-xs text-muted-foreground">Alias</Label>
            <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-background font-mono mt-1" />
          </div>
          <div>
            <Label className="font-display uppercase tracking-widest text-xs text-muted-foreground">Address Line 1</Label>
            <Input required value={formData.line1} onChange={e => setFormData({...formData, line1: e.target.value})} className="bg-background font-mono mt-1" />
          </div>
          <div>
            <Label className="font-display uppercase tracking-widest text-xs text-muted-foreground">Address Line 2 (Optional)</Label>
            <Input value={formData.line2} onChange={e => setFormData({...formData, line2: e.target.value})} className="bg-background font-mono mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-display uppercase tracking-widest text-xs text-muted-foreground">City</Label>
              <Input required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="bg-background font-mono mt-1" />
            </div>
            <div>
              <Label className="font-display uppercase tracking-widest text-xs text-muted-foreground">State/Province</Label>
              <Input required value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className="bg-background font-mono mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-display uppercase tracking-widest text-xs text-muted-foreground">Postal Code</Label>
              <Input required value={formData.postalCode} onChange={e => setFormData({...formData, postalCode: e.target.value})} className="bg-background font-mono mt-1" />
            </div>
            <div>
              <Label className="font-display uppercase tracking-widest text-xs text-muted-foreground">Country</Label>
              <Input required value={formData.countryCode} onChange={e => setFormData({...formData, countryCode: e.target.value})} className="bg-background font-mono mt-1 uppercase" maxLength={2} />
            </div>
          </div>
          <Button type="submit" disabled={createAddress.isPending} className="font-display uppercase tracking-widest mt-4">
            Save Coordinates
          </Button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addresses?.map(addr => (
          <div key={addr.id} className="bg-card border border-border rounded-xl p-6 relative group">
            {addr.isDefault && <Badge className="absolute top-4 right-4 font-mono uppercase text-[10px]">Primary</Badge>}
            <h3 className="font-display font-bold uppercase tracking-wider mb-2">{addr.name}</h3>
            <div className="font-mono text-sm text-muted-foreground space-y-1">
              <p>{addr.line1}</p>
              {addr.line2 && <p>{addr.line2}</p>}
              <p>{addr.city}, {addr.state} {addr.postalCode}</p>
              <p>{addr.countryCode}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute bottom-4 right-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDelete(addr.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {addresses?.length === 0 && !showForm && (
          <div className="col-span-full text-center py-12 font-mono text-muted-foreground uppercase">
            No safehouses established.
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnsTab() {
  const { data: returns } = useListAccountReturns({ query: { queryKey: ['account-returns'] } });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-display font-bold uppercase tracking-widest">Return Operations</h2>
        <Button asChild className="font-display uppercase tracking-widest">
          <Link href="/account/returns/new">Initiate Return</Link>
        </Button>
      </div>

      {returns?.length ? (
        <div className="space-y-4">
          {returns.map(req => (
            <div key={req.id} className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row justify-between gap-4">
              <div>
                <h3 className="font-display font-bold uppercase tracking-wider mb-1">RMA: {req.id}</h3>
                <p className="font-mono text-sm text-muted-foreground">Original Order: {req.orderNumber}</p>
                <p className="font-mono text-sm text-muted-foreground">Filed on {new Date(req.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2">
                <Badge variant={req.status === 'approved' ? 'default' : 'secondary'} className="font-mono uppercase tracking-widest">
                  {req.status}
                </Badge>
                {req.refundAmountInCents && (
                  <span className="font-mono font-bold text-primary">Refund: {formatPrice(req.refundAmountInCents)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="font-mono text-muted-foreground uppercase tracking-widest">No return operations on record.</p>
        </div>
      )}
    </div>
  );
}
