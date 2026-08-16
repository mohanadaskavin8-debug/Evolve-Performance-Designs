import { useAdminGetSystemStatus } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Database, Cloud, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function SystemPage() {
  const { data, isLoading, error } = useAdminGetSystemStatus(
    { query: { refetchInterval: 10000, queryKey: [] as any } } // Refresh every 10s
  );

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
            <Badge variant={data?.status === 'ok' ? 'default' : 'destructive'} className={data?.status === 'ok' ? 'bg-emerald-600 font-mono tracking-widest px-3 py-1' : 'font-mono tracking-widest px-3 py-1'}>
              {data?.status === 'ok' ? 'ALL SYSTEMS OPERATIONAL' : 'DEGRADED PERFORMANCE'}
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
  const isUp = service.status === 'up';
  
  const getIcon = () => {
    switch(service.name.toLowerCase()) {
      case 'database': return <Database className="w-5 h-5 text-muted-foreground" />;
      case 'api': return <Server className="w-5 h-5 text-muted-foreground" />;
      case 'stripe': return <Cloud className="w-5 h-5 text-muted-foreground" />;
      case 'clerk': return <Cloud className="w-5 h-5 text-muted-foreground" />;
      default: return <Activity className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className={`border ${isUp ? 'border-border/50' : 'border-destructive'}`}>
      <CardHeader className="pb-2 flex flex-row justify-between items-center">
        <CardTitle className="text-lg flex items-center gap-2 capitalize">
          {getIcon()} {service.name}
        </CardTitle>
        {isUp ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <XCircle className="w-5 h-5 text-destructive" />
        )}
      </CardHeader>
      <CardContent className="pt-4 border-t">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Latency</p>
            <p className="font-mono text-xl font-bold">{service.latencyMs}ms</p>
          </div>
          <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-wider ${isUp ? 'text-emerald-600 border-emerald-500/30' : 'text-destructive border-destructive/30'}`}>
            {service.status}
          </Badge>
        </div>
        {service.message && !isUp && (
          <p className="text-xs text-destructive mt-3 bg-destructive/10 p-2 rounded border border-destructive/20 font-mono">
            {service.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
