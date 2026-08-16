import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminBootstrap, getAdminGetMeQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert } from 'lucide-react';

export default function SetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [secretKey, setSecretKey] = useState('');
  
  const bootstrap = useAdminBootstrap();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) return;

    bootstrap.mutate({ data: { secretKey } }, {
      onSuccess: async () => {
        toast({
          title: 'Setup Complete',
          description: 'You are now registered as an Owner.',
        });
        // Refresh the admin check so the guard sees the new owner role
        // before we navigate — otherwise it bounces back to /setup.
        await queryClient.resetQueries({ queryKey: getAdminGetMeQueryKey() });
        setLocation('/dashboard');
      },
      onError: (err: any) => {
        toast({
          variant: 'destructive',
          title: 'Setup Failed',
          description: err.data?.error || err.message || 'Invalid bootstrap secret.',
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-primary/20">
        <CardHeader className="space-y-3 text-center">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl tracking-tight">System Initialization</CardTitle>
          <CardDescription>
            Enter the bootstrap secret to claim ownership of this workspace. This can only be done once.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secretKey">Bootstrap Secret Key</Label>
              <Input 
                id="secretKey" 
                type="password"
                placeholder="Enter BOOTSTRAP_SECRET..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="font-mono"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full font-bold tracking-wide" 
              disabled={bootstrap.isPending || !secretKey.trim()}
            >
              {bootstrap.isPending ? 'VERIFYING...' : 'CLAIM OWNERSHIP'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
