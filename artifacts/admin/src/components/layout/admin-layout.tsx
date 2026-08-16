import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { UserButton } from '@clerk/clerk-react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Undo2, 
  Package, 
  Box, 
  Users, 
  TicketPercent, 
  Mail, 
  Truck, 
  PackageCheck, 
  LifeBuoy, 
  MessageSquare, 
  FileText, 
  ShieldAlert, 
  Activity, 
  BarChart3, 
  Server
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/returns', label: 'Returns', icon: Undo2 },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/inventory', label: 'Inventory', icon: Box },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/discounts', label: 'Discounts', icon: TicketPercent },
  { href: '/email', label: 'Email', icon: Mail },
  { href: '/shipping', label: 'Shipping', icon: Truck },
  { href: '/fulfillment', label: 'Fulfillment', icon: PackageCheck },
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/reviews', label: 'Reviews', icon: MessageSquare },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/team', label: 'Team', icon: ShieldAlert },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/system', label: 'System', icon: Server },
];

export function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col sticky top-0 md:h-screen">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-sidebar-foreground tracking-tight">
            <img
              src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/brand/ep-logo-white.png`}
              alt="Evolve Performance"
              className="w-7 h-7 dark:block hidden"
            />
            <img
              src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/brand/ep-logo.png`}
              alt="Evolve Performance"
              className="w-7 h-7 dark:hidden block"
            />
            EVOLVE<span className="text-primary font-mono text-xs ml-1 tracking-widest mt-1">OS</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + '/');
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border flex items-center gap-3">
          <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-8 h-8' } }} />
          <div className="flex flex-col text-xs">
            <span className="font-medium text-sidebar-foreground">Admin Account</span>
            <span className="text-sidebar-foreground/50">Manage settings</span>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 lg:px-8 border-b bg-card sticky top-0 z-10">
          <h1 className="text-lg font-semibold tracking-tight">{title || 'Dashboard'}</h1>
          <div className="flex items-center gap-4">
            {/* Contextual actions could go here */}
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
