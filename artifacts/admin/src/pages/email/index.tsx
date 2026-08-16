import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAdminMarketingOverview,
  getAdminMarketingOverviewQueryKey,
  useAdminListCampaigns,
  getAdminListCampaignsQueryKey,
  useAdminCreateCampaign,
  useAdminDeleteCampaign,
  useAdminListSubscribers,
  getAdminListSubscribersQueryKey,
  useAdminListEmailTemplates,
  getAdminListEmailTemplatesQueryKey,
  useAdminUpdateEmailTemplate,
  useAdminListAutomations,
  getAdminListAutomationsQueryKey,
  useAdminUpdateAutomation,
} from '@workspace/api-client-react';
import type { Campaign, EmailTemplate, MarketingAutomationInfo } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Mail, Users, Send, MousePointerClick, Eye, Plus, Trash2, Pencil, FlaskConical, Zap } from 'lucide-react';

const errMsg = (e: any) => (e?.data as any)?.error || e?.message || 'Something went wrong';

function campaignStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-secondary text-secondary-foreground',
    scheduled: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    sending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    sent: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    canceled: 'bg-muted text-muted-foreground',
  };
  return <Badge className={`${map[status] ?? 'bg-secondary'} border-0 capitalize`}>{status}</Badge>;
}

function subscriberStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    unsubscribed: 'bg-muted text-muted-foreground',
    suppressed: 'bg-red-500/15 text-red-600 dark:text-red-400',
    bounced: 'bg-red-500/15 text-red-600 dark:text-red-400',
    complained: 'bg-red-500/15 text-red-600 dark:text-red-400',
  };
  return <Badge className={`${map[status] ?? 'bg-secondary'} border-0 capitalize`}>{status}</Badge>;
}

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const fmtPct = (v?: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

export default function EmailPage() {
  const { data: overview } = useAdminMarketingOverview({ query: { queryKey: getAdminMarketingOverviewQueryKey() } });

  return (
    <AdminLayout title="Email">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Campaigns, subscribers, and automatic emails — everything your store sends.
        </p>
        {overview && (
          overview.testMode ? (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 gap-1.5 whitespace-nowrap" data-testid="badge-test-mode">
              <FlaskConical className="w-3.5 h-3.5" /> Test mode — emails go to a safe test inbox
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 gap-1.5 whitespace-nowrap" data-testid="badge-live-mode">
              <Zap className="w-3.5 h-3.5" /> Live — emails go to real subscribers
            </Badge>
          )
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-secondary p-1 h-auto mb-6 flex-wrap justify-start">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="subscribers" data-testid="tab-subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          <TabsTrigger value="automations" data-testid="tab-automations">Automations</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="campaigns"><CampaignsTab /></TabsContent>
        <TabsContent value="subscribers"><SubscribersTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="automations"><AutomationsTab /></TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function OverviewTab() {
  const [, setLocation] = useLocation();
  const { data: overview, isLoading } = useAdminMarketingOverview({ query: { queryKey: getAdminMarketingOverviewQueryKey() } });

  if (isLoading) {
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  }
  if (!overview) return null;

  const stats = [
    { label: 'Active subscribers', value: overview.activeSubscribers.toLocaleString(), sub: `${overview.unsubscribedCount} unsubscribed · ${overview.suppressedCount} suppressed`, icon: Users },
    { label: 'Campaigns sent', value: overview.campaignsSent.toLocaleString(), sub: `${overview.campaignsTotal} total campaigns`, icon: Send },
    { label: 'Open rate', value: fmtPct(overview.openRate), sub: 'Across sent campaign emails', icon: Eye },
    { label: 'Click rate', value: fmtPct(overview.clickRate), sub: 'Across sent campaign emails', icon: MousePointerClick },
  ];

  return (
    <div className="space-y-6">
      {overview.testMode && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <p className="text-sm">
            <span className="font-medium">Test mode is on.</span>{' '}
            Campaign and automation emails are delivered to Resend's safe test inbox instead of real
            subscribers — send as much as you like while you set things up. When you're ready to send
            for real, ask to switch marketing email to live mode.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <s.icon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
            </div>
            <div className="text-2xl font-semibold" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Recent campaigns</h3>
        </div>
        {(overview.recentCampaigns ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No campaigns yet — create your first one from the Campaigns tab.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Delivered to</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(overview.recentCampaigns ?? []).map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-primary/5" onClick={() => setLocation(`/email/campaigns/${c.id}`)} data-testid={`row-recent-campaign-${c.id}`}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{campaignStatusBadge(c.status)}</TableCell>
                  <TableCell className="text-right">{c.sentCount ?? 0}{c.totalRecipients != null ? ` / ${c.totalRecipients}` : ''}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtDate(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function CampaignsTab() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: campaigns, isLoading } = useAdminListCampaigns({ query: { queryKey: getAdminListCampaignsQueryKey() } });
  const createMut = useAdminCreateCampaign();
  const deleteMut = useAdminDeleteCampaign();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    createMut.mutate(
      { data: { name, audienceKey: 'newsletter', subject: '', blocks: [] } },
      {
        onSuccess: (c) => {
          queryClient.invalidateQueries({ queryKey: getAdminListCampaignsQueryKey() });
          setNewOpen(false);
          setNewName('');
          setLocation(`/email/campaigns/${c.id}`);
        },
        onError: (e) => toast({ title: 'Could not create campaign', description: errMsg(e), variant: 'destructive' }),
      },
    );
  };

  const remove = () => {
    if (!deleting) return;
    deleteMut.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListCampaignsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getAdminMarketingOverviewQueryKey() });
          toast({ title: 'Campaign deleted' });
          setDeleting(null);
        },
        onError: (e) => { toast({ title: 'Could not delete', description: errMsg(e), variant: 'destructive' }); setDeleting(null); },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNewOpen(true)} data-testid="button-new-campaign">
          <Plus className="w-4 h-4 mr-1.5" /> New campaign
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !campaigns || campaigns.length === 0 ? (
        <Card className="border-dashed p-12 text-center">
          <Mail className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Design a branded email and send it to your subscribers.</p>
          <Button onClick={() => setNewOpen(true)} data-testid="button-new-campaign-empty">
            <Plus className="w-4 h-4 mr-1.5" /> Create your first campaign
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead className="text-right">Delivered to</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-primary/5" onClick={() => setLocation(`/email/campaigns/${c.id}`)} data-testid={`row-campaign-${c.id}`}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{campaignStatusBadge(c.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.audienceKey.replace(/_/g, ' ').replace(/^collection /, 'series: ')}</TableCell>
                  <TableCell className="text-right">{c.sentCount ?? 0}{c.totalRecipients != null ? ` / ${c.totalRecipients}` : ''}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtDate(c.createdAt)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {c.status === 'draft' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(c)} data-testid={`button-delete-campaign-${c.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>Give it a working name — you can change everything later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              placeholder="e.g. Autumn drop announcement"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              data-testid="input-new-campaign-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={!newName.trim() || createMut.isPending} data-testid="button-create-campaign">
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This draft will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubscribersTab() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = {
    ...(search ? { search } : {}),
    ...(status !== 'all' ? { status } : {}),
    limit: pageSize,
    offset: page * pageSize,
  };
  const { data, isLoading } = useAdminListSubscribers(params, { query: { queryKey: getAdminListSubscribersQueryKey(params) } });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by email or name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="sm:max-w-xs"
          data-testid="input-subscriber-search"
        />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
          <SelectTrigger className="sm:w-44" data-testid="select-subscriber-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            <SelectItem value="suppressed">Suppressed</SelectItem>
          </SelectContent>
        </Select>
        <div className="sm:ml-auto text-sm text-muted-foreground self-center" data-testid="text-subscriber-total">
          {total.toLocaleString()} {total === 1 ? 'person' : 'people'}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data || data.subscribers.length === 0 ? (
        <Card className="border-dashed p-12 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">No subscribers found</h3>
          <p className="text-sm text-muted-foreground">
            {search || status !== 'all' ? 'Try a different search or filter.' : 'People join via the storefront footer signup and by opting in at checkout.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.subscribers.map((s, i) => (
                <TableRow key={`${s.email}-${i}`} className="hover:bg-primary/5" data-testid={`row-subscriber-${i}`}>
                  <TableCell className="font-medium">{s.email}</TableCell>
                  <TableCell className="text-muted-foreground">{s.firstName || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{s.source}</Badge></TableCell>
                  <TableCell>{subscriberStatusBadge(s.status)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtDate(s.consentAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} data-testid="button-subscribers-prev">Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} data-testid="button-subscribers-next">Next</Button>
        </div>
      )}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, { title: string; blurb: string }> = {
  automation: { title: 'Automatic emails', blurb: 'Sent by the welcome and post-purchase automations.' },
  transactional: { title: 'Order & account emails', blurb: 'Sent around orders — always delivered, even to people not on the marketing list.' },
  marketing: { title: 'Marketing', blurb: 'Reusable marketing content.' },
};

function TemplatesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: templates, isLoading } = useAdminListEmailTemplates({ query: { queryKey: getAdminListEmailTemplatesQueryKey() } });
  const updateMut = useAdminUpdateEmailTemplate();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({ subject: '', headline: '', body: '', ctaLabel: '', ctaUrl: '' });

  const openEditor = (t: EmailTemplate) => {
    setForm({ subject: t.subject, headline: t.headline, body: t.body, ctaLabel: t.ctaLabel ?? '', ctaUrl: t.ctaUrl ?? '' });
    setEditing(t);
  };

  const save = () => {
    if (!editing) return;
    updateMut.mutate(
      { key: editing.key, data: { subject: form.subject, headline: form.headline, body: form.body, ctaLabel: form.ctaLabel || null, ctaUrl: form.ctaUrl || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListEmailTemplatesQueryKey() });
          toast({ title: 'Template saved', description: 'New emails will use the updated wording.' });
          setEditing(null);
        },
        onError: (e) => toast({ title: 'Could not save', description: errMsg(e), variant: 'destructive' }),
      },
    );
  };

  const groups = useMemo(() => {
    const g = new Map<string, EmailTemplate[]>();
    (templates ?? []).forEach((t) => {
      if (!g.has(t.category)) g.set(t.category, []);
      g.get(t.category)!.push(t);
    });
    return ['automation', 'transactional', 'marketing'].filter((c) => g.has(c)).map((c) => ({ category: c, items: g.get(c)! }));
  }, [templates]);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-8">
      {groups.map(({ category, items }) => (
        <div key={category}>
          <h3 className="font-semibold mb-1">{CATEGORY_LABELS[category]?.title ?? category}</h3>
          <p className="text-sm text-muted-foreground mb-3">{CATEGORY_LABELS[category]?.blurb}</p>
          <Card className="divide-y">
            {items.map((t) => (
              <div key={t.key} className="p-4 flex items-center justify-between gap-4" data-testid={`template-${t.key}`}>
                <div className="min-w-0">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-sm text-muted-foreground truncate">Subject: {t.subject}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEditor(t)} data-testid={`button-edit-template-${t.key}`}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
              </div>
            ))}
          </Card>
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit "{editing?.name}"</DialogTitle>
            <DialogDescription>{editing?.description || 'Changes apply to all future sends of this email.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject line</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="input-template-subject" />
            </div>
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} data-testid="input-template-headline" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} data-testid="input-template-body" />
              <p className="text-xs text-muted-foreground">
                You can use {'{{firstName}}'} and {'{{orderNumber}}'} — they're filled in automatically for each person.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Button label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} data-testid="input-template-cta-label" />
              </div>
              <div className="space-y-2">
                <Label>Button link</Label>
                <Input value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} placeholder="/products" data-testid="input-template-cta-url" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={updateMut.isPending || !form.subject.trim() || !form.headline.trim() || !form.body.trim()} data-testid="button-save-template">
              {updateMut.isPending ? 'Saving…' : 'Save template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const AUTOMATION_BLURBS: Record<string, string> = {
  welcome: 'Greets new subscribers shortly after they join your list from the storefront.',
  post_purchase: 'Follows up with customers after their order is delivered — great for review requests.',
};

function AutomationsTab() {
  const { data: automations, isLoading } = useAdminListAutomations({ query: { queryKey: getAdminListAutomationsQueryKey() } });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {(automations ?? []).map((a) => <AutomationCard key={a.key} automation={a} />)}
    </div>
  );
}

function AutomationCard({ automation: a }: { automation: MarketingAutomationInfo }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMut = useAdminUpdateAutomation();
  const [delay, setDelay] = useState(String(a.delayHours));

  useEffect(() => setDelay(String(a.delayHours)), [a.delayHours]);

  const save = (data: { enabled?: boolean; delayHours?: number }) => {
    updateMut.mutate(
      { key: a.key, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListAutomationsQueryKey() });
          toast({ title: 'Automation updated' });
        },
        onError: (e) => toast({ title: 'Could not update', description: errMsg(e), variant: 'destructive' }),
      },
    );
  };

  const delayChanged = delay !== '' && Number(delay) !== a.delayHours;

  return (
    <Card className="p-5 space-y-4" data-testid={`automation-${a.key}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{a.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{AUTOMATION_BLURBS[a.key] ?? ''}</p>
        </div>
        <Switch
          checked={a.enabled}
          disabled={updateMut.isPending}
          onCheckedChange={(v) => save({ enabled: v })}
          data-testid={`switch-automation-${a.key}`}
        />
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Wait time (hours)</Label>
          <Input
            type="number"
            min={0}
            max={720}
            value={delay}
            onChange={(e) => setDelay(e.target.value)}
            className="w-28"
            data-testid={`input-automation-delay-${a.key}`}
          />
        </div>
        {delayChanged && (
          <Button size="sm" disabled={updateMut.isPending} onClick={() => save({ delayHours: Math.max(0, Math.min(720, Number(delay))) })} data-testid={`button-save-delay-${a.key}`}>
            Save
          </Button>
        )}
        <div className="ml-auto text-right">
          <div className="text-lg font-semibold">{a.sent30d}</div>
          <div className="text-xs text-muted-foreground">sent in last 30 days</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground border-t pt-3">
        Wording comes from the "{a.templateKey}" template in the Templates tab.
        {a.key === 'welcome' && ' A wait time of 0 sends it right away.'}
      </p>
    </Card>
  );
}
