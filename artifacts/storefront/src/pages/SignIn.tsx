import { SignIn } from '@clerk/react';

export default function SignInPage() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <div className="min-h-screen bg-background pt-32 pb-24 flex flex-col items-center px-6">
      <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-[0.2em] text-white mb-4">
        Operative Login
      </h1>
      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-10">
        Authenticate to access your profile and order history
      </p>
      <SignIn
        routing="path"
        path={`${base}/sign-in`}
        signUpUrl={`${base}/sign-up`}
        fallbackRedirectUrl={`${base}/account`}
        appearance={{
          elements: {
            card: 'shadow-xl border border-white/10 bg-white/[0.02] rounded-none',
            headerTitle: 'text-white font-display uppercase tracking-widest',
            headerSubtitle: 'text-muted-foreground font-mono text-xs uppercase tracking-widest',
            socialButtonsBlockButton: 'border-white/20 text-white hover:bg-white/10',
            dividerLine: 'bg-white/10',
            dividerText: 'text-muted-foreground',
            formFieldLabel: 'text-white font-mono uppercase text-xs tracking-widest',
            formFieldInput: 'bg-black/40 border-white/20 text-white rounded-none',
            formButtonPrimary: 'bg-primary hover:bg-primary/90 text-white font-mono font-bold uppercase tracking-widest rounded-none',
            footerActionText: 'text-muted-foreground',
            footerActionLink: 'text-primary hover:text-primary/90 font-medium',
          },
        }}
      />
    </div>
  );
}
