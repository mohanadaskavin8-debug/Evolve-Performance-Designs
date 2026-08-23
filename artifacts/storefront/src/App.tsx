import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { MotionConfig, AnimatePresence, motion } from 'framer-motion';
import { setBaseUrl } from '@workspace/api-client-react';

import { SiteIntro } from '@/components/SiteIntro';
import AppShell from '@/components/layout/AppShell';
import Home from '@/pages/Home';
import Shop from '@/pages/Shop';
import Category from '@/pages/Category';
import ProductDetail from '@/pages/ProductDetail';
import CollectionDetail from '@/pages/CollectionDetail';
import Cart from '@/pages/Cart';
import Support from '@/pages/Support';
import ContentPage from '@/pages/ContentPage';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

// Configure the API client base URL
setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, ''));

function Router() {
  const [location] = useLocation();

  return (
    <AppShell>
      <RoutedErrorBoundary>
        {/* Scroll reset waits for the old page's exit animation to finish */}
        <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full relative"
          >
            {/* Red sweep line transition effect */}
            <motion.div
              className="fixed top-0 left-0 w-full h-[2px] bg-primary z-[60] shadow-[0_0_15px_rgba(255,0,0,0.8)] pointer-events-none"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: [0, 1, 0], originX: [0, 0, 1] }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
            <Switch location={location}>
              <Route path="/" component={Home} />
              <Route path="/category/:slug" component={Category} />
              <Route path="/products" component={Shop} />
              <Route path="/products/:slug" component={ProductDetail} />
              <Route path="/collections/:slug" component={CollectionDetail} />
              <Route path="/cart" component={Cart} />
              <Route path="/support" component={Support} />
              <Route path="/pages/:pageKey" component={ContentPage} />
              <Route component={NotFound} />
            </Switch>
          </motion.div>
        </AnimatePresence>
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
            <SiteIntro />
            {/* data-site-root: SiteIntro marks this inert while the intro plays */}
            <div data-site-root>
              <Router />
            </div>
          </WouterRouter>
        </MotionConfig>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
