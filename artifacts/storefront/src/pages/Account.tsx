import { useEffect } from 'react';
import { useListAccountOrders, useGetAccountProfile } from '@workspace/api-client-react';
import { useUser, SignOutButton } from '@clerk/react';
import { formatPrice } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { LogOut, Package, ArrowRight, CornerUpLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Account() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);
  
  const { data: profile, isLoading: profileLoading } = useGetAccountProfile({
    query: { enabled: isSignedIn, queryKey: ['account-profile'] }
  });

  const { data: ordersData, isLoading: ordersLoading } = useListAccountOrders(
    { limit: 10 },
    { query: { enabled: isSignedIn, queryKey: ['account-orders'] } }
  );

  if (!isLoaded || profileLoading || ordersLoading) {
    return (
      <div className="min-h-screen pt-32 bg-background flex justify-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    // Redirecting to /sign-in via the effect above
    return (
      <div className="min-h-screen pt-32 bg-background flex justify-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container mx-auto px-6 md:px-12 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6">
              Operative Profile
            </h1>
            <div className="w-24 h-1 bg-primary" />
          </div>
          <SignOutButton>
            <button className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-white transition-colors">
              <LogOut className="w-4 h-4" /> Disconnect
            </button>
          </SignOutButton>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Sidebar / Identity */}
          <div className="lg:col-span-4">
            <div className="border border-white/10 bg-white/[0.02] p-8">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center border border-primary mb-6">
                <span className="font-display font-bold text-2xl text-primary uppercase">
                  {profile?.firstName?.[0] || user.firstName?.[0] || 'O'}
                  {profile?.lastName?.[0] || user.lastName?.[0] || 'P'}
                </span>
              </div>
              <h3 className="font-display font-bold uppercase tracking-widest text-white text-xl mb-2">
                {profile?.firstName || user.firstName} {profile?.lastName || user.lastName}
              </h3>
              <p className="font-mono text-sm text-muted-foreground break-all mb-8">{profile?.email || user.primaryEmailAddress?.emailAddress}</p>
              
              <div className="space-y-4 font-mono text-xs uppercase tracking-widest">
                <Link href="/account/returns/new" className="flex items-center justify-between border border-white/10 p-4 hover:border-primary hover:text-white text-muted-foreground transition-colors group">
                  <span>Initiate Return</span>
                  <CornerUpLeft className="w-4 h-4 group-hover:text-primary" />
                </Link>
                <Link href="/support" className="flex items-center justify-between border border-white/10 p-4 hover:border-primary hover:text-white text-muted-foreground transition-colors group">
                  <span>Support Comms</span>
                  <ArrowRight className="w-4 h-4 group-hover:text-primary" />
                </Link>
              </div>
            </div>
          </div>

          {/* Orders */}
          <div className="lg:col-span-8">
            <h3 className="font-display font-bold uppercase tracking-[0.15em] text-white text-2xl mb-8 flex items-center gap-3">
              <Package className="w-6 h-6 text-primary" /> Deployment History
            </h3>

            {!ordersData || ordersData.length === 0 ? (
              <div className="border border-white/10 bg-black p-12 text-center">
                <p className="font-mono text-muted-foreground uppercase tracking-widest mb-6">No previous deployments found.</p>
                <Link href="/products" className="bg-white text-black px-6 py-3 font-mono font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-colors">
                  Access Armory
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {ordersData.map((order, i) => (
                  <motion.div 
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="border border-white/10 bg-black p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-white/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <span className="font-display font-bold text-white text-xl uppercase tracking-widest">
                          {order.orderNumber}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 bg-white/10 text-white">
                          {order.status}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                        {new Date(order.createdAt).toLocaleDateString()} • {order.itemCount} items
                      </p>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full md:w-auto">
                      <span className="font-mono font-bold text-lg text-white">
                        {formatPrice(order.totalInCents)}
                      </span>
                      <Link 
                        href={`/orders/${order.orderNumber}`}
                        className="bg-transparent border border-white/20 px-6 py-2 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors w-full md:w-auto text-center"
                      >
                        View Intel
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
