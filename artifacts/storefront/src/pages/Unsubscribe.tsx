import { useMemo, useState } from 'react';
import { useGetUnsubscribeInfo, useConfirmUnsubscribe } from '@workspace/api-client-react';
import { MailX, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

export default function Unsubscribe() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') ?? '', []);
  const [unsubscribed, setUnsubscribed] = useState(false);

  const { data: info, isLoading, error } = useGetUnsubscribeInfo(
    { token },
    { query: { enabled: !!token, queryKey: ['unsubscribe-info', token], retry: false } }
  );
  const confirm = useConfirmUnsubscribe();

  const handleConfirm = () => {
    confirm.mutate(
      { data: { token }, params: { token } },
      { onSuccess: () => setUnsubscribed(true) }
    );
  };

  const invalid = !token || (!isLoading && (error || !info));

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
          {isLoading && token ? (
            <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">Verifying link…</p>
          ) : unsubscribed ? (
            <>
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-6" />
              <h2 className="font-display font-bold uppercase tracking-[0.15em] text-white text-2xl mb-4">
                You're off the list
              </h2>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-8">
                {info?.email} will no longer receive marketing email from us. Order and shipping
                updates are unaffected. Changed your mind? Rejoin from the signup form anytime.
              </p>
              <Link
                href="/"
                className="inline-block bg-white text-black px-8 py-3 font-mono font-bold uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-colors"
              >
                Back to base
              </Link>
            </>
          ) : invalid ? (
            <>
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-6" />
              <h2 className="font-display font-bold uppercase tracking-[0.15em] text-white text-2xl mb-4">
                Invalid link
              </h2>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                This unsubscribe link is invalid or incomplete. Use the unsubscribe link from the
                bottom of any of our emails, or contact support and we'll take care of it.
              </p>
            </>
          ) : info?.alreadyUnsubscribed ? (
            <>
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-6" />
              <h2 className="font-display font-bold uppercase tracking-[0.15em] text-white text-2xl mb-4">
                Already unsubscribed
              </h2>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                {info.email} is already off our marketing list. No further action needed.
              </p>
            </>
          ) : (
            <>
              <MailX className="w-12 h-12 text-primary mx-auto mb-6" />
              <h2 className="font-display font-bold uppercase tracking-[0.15em] text-white text-2xl mb-4">
                Unsubscribe
              </h2>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-8">
                Stop marketing emails to <span className="text-white">{info?.email}</span>?
                You'll still receive order and shipping updates for any purchases.
              </p>
              {confirm.isError && (
                <p className="font-mono text-xs uppercase tracking-widest text-destructive mb-6">
                  {(confirm.error as any)?.data?.error || 'Something went wrong — try again.'}
                </p>
              )}
              <button
                onClick={handleConfirm}
                disabled={confirm.isPending}
                className="bg-white text-black px-8 py-3 font-mono font-bold uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
              >
                {confirm.isPending ? 'Working…' : 'Confirm unsubscribe'}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
