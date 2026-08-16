import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { AuthGuard } from '@/components/ui/auth-guard';
import SetupPage from '@/pages/setup';
import SignInPage from '@/pages/sign-in';
import DashboardPage from '@/pages/dashboard';
import OrdersPage from '@/pages/orders/index';
import OrderDetailPage from '@/pages/orders/detail';
import ProductsPage from '@/pages/products/index';
import NewProductPage from '@/pages/products/new';
import InventoryPage from '@/pages/inventory';
import ReturnsPage from '@/pages/returns/index';
import ReturnDetailPage from '@/pages/returns/detail';
import CustomersPage from '@/pages/customers/index';
import CustomerDetailPage from '@/pages/customers/detail';
import ContentPage from '@/pages/content';
import DiscountsPage from '@/pages/discounts';
import TeamPage from '@/pages/team';
import SystemPage from '@/pages/system';
import SupportPage from '@/pages/support';
import ReviewsPage from '@/pages/reviews';
import ActivityPage from '@/pages/activity';
import ReportsPage from '@/pages/reports';
import ShippingPage from '@/pages/shipping';
import EmailPage from '@/pages/email/index';
import CampaignEditorPage from '@/pages/email/campaign-editor';
import FulfillmentPage from '@/pages/fulfillment';

const queryClient = new QueryClient();
const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/sign-in" component={SignInPage} />
        
        {/* Protected Routes */}
        <Route path="/setup">
          <AuthGuard><SetupPage /></AuthGuard>
        </Route>
        
        <Route path="/dashboard">
          <AuthGuard><DashboardPage /></AuthGuard>
        </Route>

        <Route path="/orders">
          <AuthGuard><OrdersPage /></AuthGuard>
        </Route>
        
        <Route path="/orders/:id">
          <AuthGuard><OrderDetailPage /></AuthGuard>
        </Route>

        <Route path="/products">
          <AuthGuard><ProductsPage /></AuthGuard>
        </Route>
        
        <Route path="/products/new">
          <AuthGuard><NewProductPage /></AuthGuard>
        </Route>

        <Route path="/inventory">
          <AuthGuard><InventoryPage /></AuthGuard>
        </Route>

        <Route path="/returns">
          <AuthGuard><ReturnsPage /></AuthGuard>
        </Route>
        
        <Route path="/returns/:id">
          <AuthGuard><ReturnDetailPage /></AuthGuard>
        </Route>

        <Route path="/customers">
          <AuthGuard><CustomersPage /></AuthGuard>
        </Route>
        
        <Route path="/customers/:id">
          <AuthGuard><CustomerDetailPage /></AuthGuard>
        </Route>

        <Route path="/content">
          <AuthGuard><ContentPage /></AuthGuard>
        </Route>
        
        <Route path="/discounts">
          <AuthGuard><DiscountsPage /></AuthGuard>
        </Route>

        <Route path="/shipping">
          <AuthGuard><ShippingPage /></AuthGuard>
        </Route>

        <Route path="/email">
          <AuthGuard><EmailPage /></AuthGuard>
        </Route>
        <Route path="/email/campaigns/:id">
          <AuthGuard><CampaignEditorPage /></AuthGuard>
        </Route>

        <Route path="/fulfillment">
          <AuthGuard><FulfillmentPage /></AuthGuard>
        </Route>
        
        <Route path="/team">
          <AuthGuard><TeamPage /></AuthGuard>
        </Route>
        
        <Route path="/support">
          <AuthGuard><SupportPage /></AuthGuard>
        </Route>
        
        <Route path="/reviews">
          <AuthGuard><ReviewsPage /></AuthGuard>
        </Route>
        
        <Route path="/activity">
          <AuthGuard><ActivityPage /></AuthGuard>
        </Route>
        
        <Route path="/reports">
          <AuthGuard><ReportsPage /></AuthGuard>
        </Route>
        
        <Route path="/system">
          <AuthGuard><SystemPage /></AuthGuard>
        </Route>
        
        <Route path="/">
          <AuthGuard>
            <RedirectToDashboard />
          </AuthGuard>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  setLocation('/dashboard');
  return null;
}

function App() {
  if (!CLERK_KEY) {
    return <div className="p-8 text-destructive font-mono">Missing VITE_CLERK_PUBLISHABLE_KEY</div>;
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
