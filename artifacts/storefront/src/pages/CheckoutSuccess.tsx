import { Link } from 'wouter';
import { CheckCircle, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCartQueryKey, useVerifyCheckoutSession } from '@workspace/api-client-react';
import { getCartSessionId, formatPrice } from '@/lib/utils';
import { motion } from 'framer-motion';

const MAX_POLL_MS = 30_000;

export default function CheckoutSuccess() {
  const queryClient = useQueryClient();

  const stripeSessionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session_id');
  }, []);

  const startedAt = useMemo(() => Date.now(), []);

  const { data: order, isLoading, isError } = useVerifyCheckoutSession(
    { session_id: stripeSessionId ?? '' },
    {
      query: {
        queryKey: ['checkout-verify', stripeSessionId],
        enabled: !!stripeSessionId,
        retry: false,
        // Webhook may lag behind the redirect — poll until the order appears or we time out
        refetchInterval: (query) => {
          if (query.state.data) return false;
          if (Date.now() - startedAt > MAX_POLL_MS) return false;
          return 2_000;
        },
      },
    },
  );

  const timedOut = !order && !isLoading && Date.now() - startedAt > MAX_POLL_MS;

  useEffect(() => {
    if (order) {
      // Clear cart cache on verified success — backend cleared it during checkout conversion
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey({ sessionId: getCartSessionId() }) });
    }
  }, [order, queryClient]);

  // No session_id in the URL — this page was reached directly, not from Stripe
  if (!stripeSessionId) {
    return (
      <StatusShell
        icon={<AlertTriangle className="w-12 h-12 text-yellow-500" />}
        iconWrapClass="bg-yellow-500/10 border-yellow-500/50"
        title="No Order Found"
        body="This page confirms completed payments. If you just placed an order, check your email for confirmation, or track your order below."
      />
    );
  }

  // Still waiting on webhook processing
  if (!order && !timedOut && !(isError && Date.now() - startedAt > MAX_POLL_MS)) {
    return (
      <StatusShell
        icon={<Loader2 className="w-12 h-12 text-primary animate-spin" />}
        iconWrapClass="bg-primary/20 border-primary"
        title="Confirming Payment"
        body="Verifying your transaction with command. This usually takes a few seconds — do not close this page."
        hideActions
      />
    );
  }

  // Timed out without finding the order
  if (!order) {
    return (
      <StatusShell
        icon={<AlertTriangle className="w-12 h-12 text-yellow-500" />}
        iconWrapClass="bg-yellow-500/10 border-yellow-500/50"
        title="Confirmation Pending"
        body="Your payment may still be processing. If you were charged, your order confirmation will arrive by email shortly. Contact support if it doesn't."
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-24 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full border border-white/10 bg-white/[0.02] p-12 md:p-20 text-center"
      >
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center border border-primary">
            <CheckCircle className="w-12 h-12 text-primary" />
          </div>
        </div>

        <h1 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6">
          Mission Accomplished
        </h1>

        <div className="font-mono text-sm uppercase tracking-widest text-white mb-4">
          Order <span className="text-primary">{order.orderNumber}</span>
          {typeof order.totalInCents === 'number' && (
            <span className="text-muted-foreground"> — {formatPrice(order.totalInCents)}</span>
          )}
        </div>

        <p className="font-mono text-muted-foreground uppercase tracking-widest leading-relaxed mb-12">
          Your order has been secured{order.email ? ` and confirmation sent to ${order.email}` : ''}. Intel and tracking data will be transmitted shortly. Prepare for deployment.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-6">
          <Link
            href="/track"
            className="bg-primary text-white px-8 py-4 font-mono font-bold uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
          >
            Track Status
          </Link>
          <Link
            href="/products"
            className="bg-transparent text-white border border-white/30 px-8 py-4 font-mono font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            Return to Armory <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

function StatusShell({
  icon,
  iconWrapClass,
  title,
  body,
  hideActions,
}: {
  icon: React.ReactNode;
  iconWrapClass: string;
  title: string;
  body: string;
  hideActions?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background pt-32 pb-24 flex items-center justify-center">
      <div className="max-w-2xl w-full border border-white/10 bg-white/[0.02] p-12 md:p-20 text-center">
        <div className="flex justify-center mb-8">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center border ${iconWrapClass}`}>
            {icon}
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6">
          {title}
        </h1>
        <p className="font-mono text-muted-foreground uppercase tracking-widest leading-relaxed mb-12">
          {body}
        </p>
        {!hideActions && (
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link
              href="/track"
              className="bg-primary text-white px-8 py-4 font-mono font-bold uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
            >
              Track Order
            </Link>
            <Link
              href="/support"
              className="bg-transparent text-white border border-white/30 px-8 py-4 font-mono font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              Contact Support <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
