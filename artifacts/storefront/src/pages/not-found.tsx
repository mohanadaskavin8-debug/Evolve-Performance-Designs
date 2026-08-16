import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
      
      <div className="relative z-10">
        <h1 className="text-8xl md:text-9xl font-display font-black text-destructive/80 mb-4 tracking-tighter">
          404
        </h1>
        <h2 className="text-2xl md:text-3xl font-display font-bold uppercase tracking-widest mb-6">
          Void Sector
        </h2>
        <p className="font-mono text-muted-foreground mb-12 max-w-md mx-auto">
          You have drifted outside known coordinates. The artifacts you seek are not in this quadrant.
        </p>
        <Button size="lg" asChild className="h-14 font-display uppercase tracking-widest px-8">
          <Link href="/">Return to Base</Link>
        </Button>
      </div>
    </div>
  );
}
