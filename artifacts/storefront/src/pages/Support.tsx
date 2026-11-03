import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getProductImage } from '@/lib/utils';
import { SITE } from '@/content/site';
import { Copy, Mail, MessageSquare } from 'lucide-react';

/** Builds a mailto: link so the message opens, pre-filled, in the customer's own email app. */
function buildSupportMailto({ subject, message, orderNumber }: { subject: string; message: string; orderNumber: string }) {
  const order = orderNumber.trim();
  const fullSubject = order ? `[Order ${order}] ${subject.trim()}` : subject.trim();
  const body = order ? `Order number: ${order}\n\n${message.trim()}` : message.trim();
  return `mailto:${SITE.supportEmail}?subject=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(body)}`;
}

export default function Support() {
  const { toast } = useToast();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Fields are kept (not cleared) so the customer can copy them if no email app opens.
    window.location.href = buildSupportMailto({ subject, message, orderNumber });
    toast({
      title: "Opening Your Email App",
      description: `Your message is ready — just hit send. If nothing opened, email us at ${SITE.supportEmail}.`,
    });
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SITE.supportEmail);
      toast({ title: "Address Copied", description: SITE.supportEmail });
    } catch {
      toast({ title: "Our Email", description: SITE.supportEmail });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Banner */}
      <div className="w-full relative h-[40vh] bg-black flex items-center justify-center overflow-hidden">
        <img 
          src={getProductImage('desert-war')} 
          alt="Support Header"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="relative z-10 text-center px-4 mt-16">
          <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-[0.2em] text-white mb-4">
            Comms Channel
          </h1>
          <p className="font-mono text-muted-foreground uppercase tracking-widest max-w-lg mx-auto">
            Direct line to command. Report issues, request intel, or coordinate returns.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 md:px-12 py-20 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* Form */}
          <div>
            <h3 className="font-display font-bold uppercase tracking-widest text-white text-2xl mb-8 flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-primary" /> Open Channel
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Order Number (Optional)</label>
                <input 
                  type="text" 
                  value={orderNumber}
                  onChange={e => setOrderNumber(e.target.value)}
                  placeholder="EV-XXXXX"
                  className="w-full bg-black border border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Subject Designation</label>
                <input 
                  type="text" 
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-black border border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Transmission</label>
                <textarea 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={6}
                  className="w-full bg-black border border-white/20 px-4 py-3 text-white font-mono focus:outline-none focus:border-primary transition-colors resize-none"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-white text-black py-4 font-mono font-bold uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-all"
              >
                Send Transmission
              </button>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground text-center">
                Opens your email app with your message ready to send.
              </p>
            </form>
          </div>

          {/* Info */}
          <div className="space-y-12">
            <div className="border border-white/10 bg-white/[0.02] p-8">
              <h3 className="font-display font-bold uppercase tracking-widest text-white mb-4">Command Post</h3>
              <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest leading-relaxed mb-6">
                Our support operatives monitor frequencies Monday through Friday, 0900 - 1700 EST. Expected response time: 24-48 hours.
              </p>
              <div className="flex items-center gap-3 font-mono text-xs text-white uppercase tracking-widest">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <a href={`mailto:${SITE.supportEmail}`} className="text-[11px] tracking-wider md:text-xs md:tracking-widest hover:text-primary transition-colors break-all">
                  {SITE.supportEmail}
                </a>
                <button
                  type="button"
                  onClick={copyEmail}
                  aria-label="Copy email address"
                  className="ml-auto text-muted-foreground hover:text-primary transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="border border-white/10 bg-white/[0.02] p-8">
              <h3 className="font-display font-bold uppercase tracking-widest text-white mb-4">Intel Resources</h3>
              <ul className="space-y-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <li><a href="/pages/faq" className="hover:text-primary transition-colors block">Frequently Asked Questions</a></li>
                <li><a href="/pages/shipping-policy" className="hover:text-primary transition-colors block">Shipping & Deployment</a></li>
                <li><a href="/pages/return-policy" className="hover:text-primary transition-colors block">Return Protocols</a></li>
                <li><a href="/track" className="hover:text-primary transition-colors block">Track Current Ops</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
