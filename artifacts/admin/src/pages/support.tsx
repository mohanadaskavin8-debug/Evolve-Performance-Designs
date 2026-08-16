import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAdminListSupport, useAdminUpdateSupportTicket, getAdminListSupportQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/format';
import { Search, Filter, MessageSquare, AlertCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function SupportPage() {
  const [status, setStatus] = useState<string>('open');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
  };

  const queryParams = {
    status: status !== 'all' ? status : undefined,
    search: debouncedSearch || undefined,
    limit: 50,
  };

  const { data, isLoading, error } = useAdminListSupport(
    queryParams,
    { query: { placeholderData: (prev: any) => prev, queryKey: [] as any } }
  );

  return (
    <AdminLayout title="Support Tickets">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <Tabs value={status} onValueChange={setStatus} className="w-full sm:w-auto">
            <TabsList className="bg-secondary p-1 h-auto">
              <TabsTrigger value="all" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">All</TabsTrigger>
              <TabsTrigger value="open" className="py-2 px-4 text-xs font-bold tracking-wider uppercase text-primary">Open</TabsTrigger>
              <TabsTrigger value="in_progress" className="py-2 px-4 text-xs font-bold tracking-wider uppercase">In Progress</TabsTrigger>
              <TabsTrigger value="resolved" className="py-2 px-4 text-xs font-bold tracking-wider uppercase text-emerald-600">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search email or subject..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-[300px] bg-card"
            />
            <Button type="submit" variant="secondary" size="icon"><Filter className="w-4 h-4" /></Button>
          </form>
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load tickets: {(error as any)?.data?.error || error.message}
            </div>
          ) : isLoading && !data ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.tickets.map((ticket) => (
                    <TableRow 
                      key={ticket.id} 
                      className="cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <TableCell className="font-mono font-bold text-foreground">
                        TKT-{ticket.id}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{ticket.name || '-'}</div>
                        <div className="text-xs text-muted-foreground">{ticket.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-foreground max-w-xs truncate">{ticket.subject}</div>
                        {ticket.orderNumber && (
                          <div className="text-xs text-primary font-mono mt-0.5">Order: {ticket.orderNumber}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={ticket.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ticket.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(ticket.createdAt).split(',')[0]}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.tickets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No support tickets found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {selectedTicket && (
        <TicketDialog ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </AdminLayout>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'high') return <Badge variant="destructive" className="font-mono text-[10px] uppercase"><AlertCircle className="w-3 h-3 mr-1" /> High</Badge>;
  if (priority === 'medium') return <Badge variant="outline" className="font-mono text-[10px] uppercase border-amber-500 text-amber-600">Medium</Badge>;
  return <Badge variant="secondary" className="font-mono text-[10px] uppercase">Low</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'open') return <Badge variant="default" className="font-mono text-[10px] uppercase bg-primary">Open</Badge>;
  if (status === 'in_progress') return <Badge variant="secondary" className="font-mono text-[10px] uppercase">In Progress</Badge>;
  if (status === 'resolved') return <Badge variant="outline" className="font-mono text-[10px] uppercase border-emerald-500 text-emerald-600">Resolved</Badge>;
  return <Badge variant="outline" className="font-mono text-[10px] uppercase">{status}</Badge>;
}

function TicketDialog({ ticket, onClose }: { ticket: any, onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);

  const mutation = useAdminUpdateSupportTicket();

  const handleSave = () => {
    mutation.mutate({ ticketId: ticket.id, data: { status, priority } }, {
      onSuccess: () => {
        toast({ title: 'Ticket Updated' });
        queryClient.invalidateQueries({ queryKey: getAdminListSupportQueryKey() });
        onClose();
      },
      onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center pr-6">
            <span>TKT-{ticket.id}: {ticket.subject}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 bg-secondary/30 p-4 rounded-lg border">
              <h4 className="text-xs uppercase font-bold text-muted-foreground mb-1">Customer</h4>
              <p className="font-bold">{ticket.name || 'No name provided'}</p>
              <p className="text-sm font-mono text-primary">{ticket.email}</p>
            </div>
            {ticket.orderNumber && (
              <div className="flex-1 bg-secondary/30 p-4 rounded-lg border">
                <h4 className="text-xs uppercase font-bold text-muted-foreground mb-1">Related Order</h4>
                <p className="font-mono font-bold text-lg">{ticket.orderNumber}</p>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold text-muted-foreground">Message</h4>
            <div className="bg-card border p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
              {ticket.message}
            </div>
            <p className="text-xs text-muted-foreground text-right mt-1">Submitted on {formatDate(ticket.createdAt)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
