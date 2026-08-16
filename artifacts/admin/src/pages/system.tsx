import { useAdminGetSystemStatus } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Database, Cloud, Activity, CheckCircle2, XCircle, AlertTriangle, Mail, Truck, KeyRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function SystemPage() {
  const { data, isLoading, error } = useAdminGetSystemStatus(
    { query: { refetchInterval: 10000, queryKey: [] as any } } // Refresh every 10s
  );

  const overall = data?.status; // healthy | degraded | unhealthy

  return (
    <AdminLayout title="System Status">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center bg-card border p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <div>
              <h2 className="font-bold">Global Status</h2>
              <p className="text-xs text-muted-foreground font-mono">Live monitoring</p>
            </div>
          </div>
          {isLoading ? <Skeleton className="h-8 w-24" /> : (
            <Badge
              variant={overall === 'unhealthy' ? 'destructive' : 'default'}
              className={`font-mono tracking-widest px-3 py-1 ${
                overall === 'healthy' ? 'bg-emerald-600' : overall === 'degraded' ? 'bg-amber-600' : ''
              }`}
            >
              {overall === 'healthy' ? 'ALL SYSTEMS OPERATIONAL' : overall === 'degraded' ? 'PARTIAL DEGRADATION' : 'SERVICE DISRUPTION'}
            </Badge>
          )}
        </div>

        {error ? (
          <div className="p-8 text-center text-destructive font-mono text-sm border border-destructive/20 rounded-lg bg-destructive/5">
            Failed to connect to monitoring service: {(error as any)?.data?.error || error.message}
          </div>
        ) : isLoading && !data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {data?.services.map((svc: any) => (
              <ServiceCard key={svc.name} service={svc} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function ServiceCard({ service }: { service: any }) {
  const state: 'healthy' | 'degraded' | 'unhealthy' =
    service.status === 'healthy' ? 'healthy' : service.status === 'degraded' ? 'degraded' : 'unhealthy';

  const getIcon = () => {
    const n = service.name.toLowerCase();
    if (n.includes('database')) return <Database className="w-5 h-5 text-muted-foreground" />;
    if (n.includes('api')) return <Server className="w-5 h-5 text-muted-foreground" />;
    if (n.includes('stripe')) return <Cloud className="w-5 h-5 text-muted-foreground" />;
    if (n.includes('clerk')) return <KeyRound className="w-5 h-5 text-muted-foreground" />;
    if (n.includes('resend') || n.includes('email')) return <Mail className="w-5 h-5 text-muted-foreground" />;
    if (n.includes('shipstation')) return <Truck className="w-5 h-5 text-muted-foreground" />;
    return <Activity className="w-5 h-5 text-muted-foreground" />;
  };

  const borderClass = state === 'healthy' ? 'border-border/50' : state === 'degraded' ? 'border-amber-500/50' : 'border-destructive';
  const badgeClass =
    state === 'healthy' ? 'text-emerald-600 border-emerald-500/30' :
    state === 'degraded' ? 'text-amber-600 border-amber-500/30' : 'text-destructive border-destructive/30';

  return (
    <Card className={`border ${borderClass}`}>
      <CardHeader className="pb-2 flex flex-row justify-between items-center">
        <CardTitle className="text-lg flex items-center gap-2 capitalize">
          {getIcon()} {service.name}
        </CardTitle>
        {state === 'healthy' ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : state === 'degraded' ? (
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        ) : (
          <XCircle className="w-5 h-5 text-destructive" />
        )}
      </CardHeader>
      <CardContent className="pt-4 border-t">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Latency</p>
            <p className="font-mono text-xl font-bold">{service.latencyMs != null ? `${service.latencyMs}ms` : '—'}</p>
          </div>
          <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-wider ${badgeClass}`}>
            {service.status}
          </Badge>
        </div>
        {service.message && state !== 'healthy' && (
          <p className={`text-xs mt-3 p-2 rounded border font-mono ${
            state === 'degraded'
              ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
              : 'text-destructive bg-destructive/10 border-destructive/20'
          }`}>
            {service.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
