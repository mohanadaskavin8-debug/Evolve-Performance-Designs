import { useEffect, useMemo, useRef } from 'react';
import { useConfirmResubscribe } from '@workspace/api-client-react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

/**
 * Double opt-in landing page. The confirmation email links here; the page
 * posts the signed token once on load and shows the outcome.
 */
export default function ConfirmSubscription() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') ?? '', []);
  const confirm = useConfirmResubscribe();
  const fired = useRef(false);

  useEffect(() => {
    if (token && !fired.current) {
      fired.current = true;
      confirm.mutate({ data: { token } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const errorMessage = (confirm.error as any)?.data?.error as string | undefined;

  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container mx-auto px-6 md:px-12 max-w-xl">
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6 text-center">
          Comms Control
        </h1>
        <div className="w-24 h-1 bg-primary mx-auto mb-16" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-white/10 bg-white/[0.02] p-8 md:p-12 text-center"
        >
          {!token || confirm.isError ? (
            <>
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-6" />
              <h2 className="font-display font-bold uppercase tracking-[0.15em] text-white text-2xl mb-4" data-testid="text-resubscribe-error">
                {!token ? 'Invalid link' : 'Could not confirm'}
              </h2>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                {!token
                  ? 'This confirmation link is invalid or incomplete. Use the button from the confirmation email we sent you.'
                  : errorMessage || 'This confirmation link is invalid or has expired. Sign up again from the footer to get a fresh one.'}
              </p>
            </>
          ) : confirm.isSuccess ? (
            <>
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-6" />
              <h2 className="font-display font-bold uppercase tracking-[0.15em] text-white text-2xl mb-4" data-testid="text-resubscribe-success">
                You're back on the list
              </h2>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-8">
                {confirm.data?.email ? (
                  <span className="text-white">{confirm.data.email}</span>
                ) : (
                  'Your address'
                )}{' '}
                will receive training intel, drop alerts, and member-only deals again. Welcome back to the crew.
              </p>
              <Link
                href="/"
                className="inline-block bg-white text-black px-8 py-3 font-mono font-bold uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-colors"
              >
                Back to base
              </Link>
            </>
          ) : (
            <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">Confirming…</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
