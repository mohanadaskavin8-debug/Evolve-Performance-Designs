import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { MotionConfig } from 'framer-motion';
import { setBaseUrl } from '@workspace/api-client-react';

import AppShell from '@/components/layout/AppShell';
import Home from '@/pages/Home';
import Shop from '@/pages/Shop';
import Category from '@/pages/Category';
import ProductDetail from '@/pages/ProductDetail';
import CollectionDetail from '@/pages/CollectionDetail';
import Cart from '@/pages/Cart';
import Support from '@/pages/Support';
import Unsubscribe from '@/pages/Unsubscribe';
import ConfirmSubscription from '@/pages/ConfirmSubscription';
import ContentPage from '@/pages/ContentPage';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

// Configure the API client base URL
setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, ''));

function Router() {
  return (
    <AppShell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/category/:slug" component={Category} />
          <Route path="/products" component={Shop} />
          <Route path="/products/:slug" component={ProductDetail} />
          <Route path="/collections/:slug" component={CollectionDetail} />
          <Route path="/cart" component={Cart} />
          <Route path="/support" component={Support} />
          <Route path="/unsubscribe" component={Unsubscribe} />
          <Route path="/confirm-subscription" component={ConfirmSubscription} />
          <Route path="/pages/:pageKey" component={ContentPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppShell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  // Always dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* reducedMotion="user" makes framer-motion honor the OS reduce-motion setting */}
        <MotionConfig reducedMotion="user">
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </MotionConfig>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
