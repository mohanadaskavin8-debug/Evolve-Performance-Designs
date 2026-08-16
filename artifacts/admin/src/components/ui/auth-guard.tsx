import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useUser } from '@clerk/clerk-react';
import { useAdminGetMe } from '@workspace/api-client-react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [, setLocation] = useLocation();
  const { data: adminUser, error, isLoading } = useAdminGetMe({
    query: {
      enabled: isLoaded && isSignedIn,
      queryKey: [] as any,
      retry: false
    }
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation('/sign-in');
    }
  }, [isLoaded, isSignedIn, setLocation]);

  useEffect(() => {
    if (error) {
      const errData = (error as any)?.data;
      if (errData?.isFirstSetup) {
        setLocation('/setup');
      } else {
        // Just an unauthorized user
      }
    }
  }, [error, setLocation]);

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground text-sm font-mono tracking-widest uppercase">INITIALIZING COCKPIT</p>
        </div>
      </div>
    );
  }

  if (isLoaded && !isSignedIn) {
    return null;
  }

  if (error && (error as any)?.data?.isFirstSetup) {
    return null; // Will redirect
  }

  if (error || !adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border shadow-xl p-8 rounded-xl text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground">Your account ({user?.primaryEmailAddress?.emailAddress}) does not have administrator privileges for Evolve Performance.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
