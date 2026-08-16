import { useState } from 'react';
import { useAdminListActivity } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { Activity as ActivityIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ActivityPage() {
  const { data, isLoading, error } = useAdminListActivity(
    { limit: 100 },
    { query: { placeholderData: (prev: any) => prev, queryKey: [] as any } }
  );

  return (
    <AdminLayout title="Activity Log">
      <div className="flex flex-col gap-6">
        <p className="text-muted-foreground text-sm">System audit log of admin actions.</p>
        
        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load activity: {(error as any)?.data?.error || error.message}
            </div>
          ) : isLoading && !data ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.entries?.map((entry: any) => (
                    <TableRow key={entry.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{entry.actorName || entry.actorEmail || 'System'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase bg-secondary/50">
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-bold">{entry.entityLabel}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{entry.entityType} #{entry.entityId}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {entry.details || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.entries || data.entries.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        <ActivityIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No activity found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
