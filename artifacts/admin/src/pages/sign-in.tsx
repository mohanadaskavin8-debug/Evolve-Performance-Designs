import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_hsl(var(--primary)/0.1)_0%,_transparent_50%)]" />
      <div className="z-10 w-full max-w-md flex flex-col items-center">
        <div className="mb-8 flex items-center gap-2 font-bold text-3xl tracking-tighter">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>
          </div>
          EVOLVE<span className="text-primary font-mono text-sm ml-1 tracking-widest mt-2">OS</span>
        </div>
        <SignIn 
          appearance={{
            elements: {
              card: "shadow-xl border bg-card rounded-xl",
              headerTitle: "text-foreground font-sans tracking-tight",
              headerSubtitle: "text-muted-foreground",
              socialButtonsBlockButton: "border-border text-foreground hover:bg-secondary",
              socialButtonsBlockButtonText: "font-medium",
              dividerLine: "bg-border",
              dividerText: "text-muted-foreground",
              formFieldLabel: "text-foreground font-medium",
              formFieldInput: "bg-input border-transparent rounded-md",
              formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide",
              footerActionText: "text-muted-foreground",
              footerActionLink: "text-primary hover:text-primary/90 font-medium"
            }
          }}
        />
      </div>
    </div>
  );
}
