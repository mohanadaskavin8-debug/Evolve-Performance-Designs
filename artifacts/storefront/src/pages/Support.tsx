import { useState } from 'react';
import { useSubmitSupportRequest, useGetSiteSettings } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, MessageSquare } from 'lucide-react';
import { useUser } from '@clerk/react';

export default function Support() {
  const { user } = useUser();
  const { data: settings } = useGetSiteSettings({ query: { queryKey: ['site-settings'] } });
  const submitSupport = useSubmitSupportRequest();
  const { toast } = useToast();

  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress || '');
  const [name, setName] = useState(user?.fullName || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSupport.mutate(
      {
        data: {
          email,
          name,
          subject,
          message,
          orderNumber: orderNumber || undefined,
          clerkUserId: user?.id,
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Transmission Sent", description: "Our support operatives have received your message." });
          setSubject('');
          setMessage('');
        },
        onError: (err) => {
          toast({ title: "Transmission Failed", description: (err.data as any)?.error || err.message || "Could not send message.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="container mx-auto px-4 py-20 max-w-5xl">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tight mb-4">
          Comms Channel
        </h1>
        <p className="font-mono text-muted-foreground text-lg max-w-2xl mx-auto">
          Need backup? Drop a transmission. Our operatives are on standby.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-1 space-y-8">
          <div className="bg-card border border-border p-6 rounded-xl text-center">
            <Mail className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="font-display font-bold uppercase tracking-widest mb-2">Direct Line</h3>
            <p className="font-mono text-muted-foreground">{settings?.supportEmail || 'support@evolveperformance.com'}</p>
          </div>
          
          <div className="bg-card border border-border p-6 rounded-xl text-center">
            <MessageSquare className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="font-display font-bold uppercase tracking-widest mb-2">Response Time</h3>
            <p className="font-mono text-muted-foreground">Standard deployment: 24-48 hours during operation cycles.</p>
          </div>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-card border border-border p-8 rounded-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="font-display uppercase tracking-widest text-muted-foreground mb-2 block">Designation (Name)</Label>
                <Input required value={name} onChange={e => setName(e.target.value)} className="bg-background font-mono h-12" />
              </div>
              <div>
                <Label className="font-display uppercase tracking-widest text-muted-foreground mb-2 block">Comms Address (Email)</Label>
                <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-background font-mono h-12" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="font-display uppercase tracking-widest text-muted-foreground mb-2 block">Subject</Label>
                <Input required value={subject} onChange={e => setSubject(e.target.value)} className="bg-background font-mono h-12" />
              </div>
              <div>
                <Label className="font-display uppercase tracking-widest text-muted-foreground mb-2 block">Order Number (Optional)</Label>
                <Input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} className="bg-background font-mono h-12 uppercase" placeholder="EP-..." />
              </div>
            </div>

            <div>
              <Label className="font-display uppercase tracking-widest text-muted-foreground mb-2 block">Transmission Body</Label>
              <Textarea 
                required 
                value={message} 
                onChange={e => setMessage(e.target.value)} 
                className="bg-background font-mono min-h-[200px] resize-y" 
              />
            </div>

            <Button type="submit" size="lg" disabled={submitSupport.isPending} className="w-full h-14 font-display uppercase tracking-widest text-lg">
              {submitSupport.isPending ? 'TRANSMITTING...' : 'SEND TRANSMISSION'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
