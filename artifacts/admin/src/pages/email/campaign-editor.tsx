import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAdminGetCampaign,
  getAdminGetCampaignQueryKey,
  useAdminUpdateCampaign,
  useAdminSendCampaign,
  useAdminCancelCampaign,
  useAdminTestSendCampaign,
  useAdminRenderCampaignPreview,
  useAdminListAudiences,
  getAdminListAudiencesQueryKey,
  useAdminCampaignAnalytics,
  getAdminCampaignAnalyticsQueryKey,
  useAdminMarketingOverview,
  getAdminMarketingOverviewQueryKey,
  getAdminListCampaignsQueryKey,
} from '@workspace/api-client-react';
import type { CampaignBlock } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Save, FlaskConical, Send, CalendarClock, XCircle, ChevronUp, ChevronDown, Trash2,
  Type, AlignLeft, Image as ImageIcon, Package, TicketPercent, MousePointerClick, Loader2,
} from 'lucide-react';

const errMsg = (e: any) => (e?.data as any)?.error || e?.message || 'Something went wrong';

const BLOCK_DEFS: { type: CampaignBlock['type']; label: string; icon: any }[] = [
  { type: 'headline', label: 'Headline', icon: Type },
  { type: 'text', label: 'Paragraph', icon: AlignLeft },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'product', label: 'Product', icon: Package },
  { type: 'discount', label: 'Discount', icon: TicketPercent },
  { type: 'button', label: 'Button', icon: MousePointerClick },
];

function newBlock(type: CampaignBlock['type']): CampaignBlock {
  const base: CampaignBlock = { id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type };
  switch (type) {
    case 'headline': return { ...base, text: 'Your headline here' };
    case 'text': return { ...base, text: '' };
    case 'image': return { ...base, url: '', alt: '' };
    case 'product': return { ...base, productId: null };
    case 'discount': return { ...base, code: '', note: '' };
    case 'button': return { ...base, label: 'Shop now', href: '/products' };
    default: return base;
  }
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  scheduled: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  sending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  sent: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  canceled: 'bg-muted text-muted-foreground',
};

export default function CampaignEditorPage() {
  const [, params] = useRoute('/email/campaigns/:id');
  const id = Number(params?.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading } = useAdminGetCampaign(id, {
    query: {
      queryKey: getAdminGetCampaignQueryKey(id),
      enabled: Number.isInteger(id) && id > 0,
      refetchInterval: (query: any) => (query?.state?.data?.status === 'sending' ? 4000 : false),
    },
  });
  const { data: audiences } = useAdminListAudiences({ query: { queryKey: getAdminListAudiencesQueryKey() } });
  const { data: overview } = useAdminMarketingOverview({ query: { queryKey: getAdminMarketingOverviewQueryKey() } });

  const status = campaign?.status ?? 'draft';
  const readOnly = status !== 'draft' && status !== 'scheduled';
  const showAnalytics = status === 'sending' || status === 'sent' || status === 'canceled';

  const { data: analytics } = useAdminCampaignAnalytics(id, {
    query: {
      queryKey: getAdminCampaignAnalyticsQueryKey(id),
      enabled: Number.isInteger(id) && id > 0 && showAnalytics,
      refetchInterval: status === 'sending' ? 4000 : false,
    },
  });

  // Editable state, initialized when the campaign loads
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [audienceKey, setAudienceKey] = useState('newsletter');
  const [blocks, setBlocks] = useState<CampaignBlock[]>([]);
  const loadedRef = useRef<number | null>(null);

  useEffect(() => {
    if (campaign && loadedRef.current !== campaign.id) {
      loadedRef.current = campaign.id;
      setName(campaign.name);
      setSubject(campaign.subject ?? '');
      setPreviewText(campaign.previewText ?? '');
      setAudienceKey(campaign.audienceKey);
      setBlocks((campaign.blocks ?? []) as CampaignBlock[]);
    }
  }, [campaign]);

  // Live preview
  const renderMut = useAdminRenderCampaignPreview();
  const [previewHtml, setPreviewHtml] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      renderMut.mutate(
        { data: { blocks, previewText: previewText || null } },
        { onSuccess: (d) => setPreviewHtml(d.html) },
      );
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, previewText]);

  const updateMut = useAdminUpdateCampaign();
  const sendMut = useAdminSendCampaign();
  const cancelMut = useAdminCancelCampaign();
  const testMut = useAdminTestSendCampaign();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getAdminGetCampaignQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getAdminListCampaignsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminMarketingOverviewQueryKey() });
  };

  const persist = () =>
    updateMut.mutateAsync({
      id,
      data: { name: name.trim() || 'Untitled campaign', subject, previewText: previewText || null, audienceKey, blocks },
    });

  const handleSave = async () => {
    try {
      await persist();
      invalidate();
      toast({ title: 'Saved' });
    } catch (e) {
      toast({ title: 'Could not save', description: errMsg(e), variant: 'destructive' });
    }
  };

  // Dialog state
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [sendOpen, setSendOpen] = useState(false);

  const handleTestSend = async () => {
    const email = testEmail.trim();
    if (!email) return;
    try {
      if (!readOnly) await persist();
      await testMut.mutateAsync({ id, data: { email } });
      toast({ title: 'Test email sent', description: `Check ${email} — subject is prefixed with [TEST].` });
      setTestOpen(false);
    } catch (e) {
      toast({ title: 'Test send failed', description: errMsg(e), variant: 'destructive' });
    }
  };

  const handleSchedule = async () => {
    if (!scheduleAt) return;
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      toast({ title: 'Pick a future time', variant: 'destructive' });
      return;
    }
    try {
      await persist();
      await sendMut.mutateAsync({ id, data: { scheduledAt: when.toISOString() } });
      invalidate();
      toast({ title: 'Campaign scheduled', description: `Goes out ${when.toLocaleString()}.` });
      setScheduleOpen(false);
    } catch (e) {
      toast({ title: 'Could not schedule', description: errMsg(e), variant: 'destructive' });
    }
  };

  const handleSendNow = async () => {
    try {
      if (!readOnly) await persist();
      await sendMut.mutateAsync({ id, data: {} });
      invalidate();
      toast({ title: 'Sending started', description: 'Emails are going out in the background.' });
      setSendOpen(false);
    } catch (e) {
      toast({ title: 'Could not send', description: errMsg(e), variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMut.mutateAsync({ id });
      invalidate();
      toast({ title: status === 'scheduled' ? 'Schedule removed' : 'Sending canceled' });
    } catch (e) {
      toast({ title: 'Could not cancel', description: errMsg(e), variant: 'destructive' });
    }
  };

  // Block helpers
  const changeBlock = (i: number, patch: Partial<CampaignBlock>) =>
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const moveBlock = (i: number, dir: -1 | 1) =>
    setBlocks((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const removeBlock = (i: number) => setBlocks((prev) => prev.filter((_, idx) => idx !== i));

  const currentAudience = audiences?.find((a) => a.key === audienceKey);

  if (!Number.isInteger(id) || id <= 0 || (!isLoading && !campaign)) {
    return (
      <AdminLayout title="Campaign">
        <Card className="border-dashed p-12 text-center">
          <h3 className="font-semibold mb-2">Campaign not found</h3>
          <Link href="/email" className="text-sm text-primary underline">Back to Email</Link>
        </Card>
      </AdminLayout>
    );
  }

  if (isLoading || !campaign) {
    return (
      <AdminLayout title="Campaign">
        <Skeleton className="h-96" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={campaign.name}>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/email')} data-testid="button-back-to-email">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Email
        </Button>
        <Badge className={`${STATUS_STYLES[status]} border-0 capitalize`} data-testid="badge-campaign-status">{status}</Badge>
        {overview?.testMode && (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 gap-1">
            <FlaskConical className="w-3 h-3" /> Test mode
          </Badge>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {!readOnly && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={updateMut.isPending} data-testid="button-save-campaign">
                <Save className="w-4 h-4 mr-1.5" /> {updateMut.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setTestOpen(true)} data-testid="button-test-send">
                <FlaskConical className="w-4 h-4 mr-1.5" /> Send test
              </Button>
              {status === 'draft' && (
                <Button variant="outline" onClick={() => setScheduleOpen(true)} data-testid="button-schedule">
                  <CalendarClock className="w-4 h-4 mr-1.5" /> Schedule
                </Button>
              )}
              <Button onClick={() => setSendOpen(true)} data-testid="button-send-now">
                <Send className="w-4 h-4 mr-1.5" /> Send now
              </Button>
            </>
          )}
          {(status === 'scheduled' || status === 'sending') && (
            <Button variant="outline" className="text-destructive" onClick={handleCancel} disabled={cancelMut.isPending} data-testid="button-cancel-campaign">
              <XCircle className="w-4 h-4 mr-1.5" /> {status === 'scheduled' ? 'Cancel schedule' : 'Stop sending'}
            </Button>
          )}
        </div>
      </div>

      {status === 'scheduled' && campaign.scheduledAt && (
        <Card className="p-4 mb-6 border-blue-500/40 bg-blue-500/5 text-sm">
          <CalendarClock className="w-4 h-4 inline mr-2 -mt-0.5" />
          Scheduled to send <span className="font-medium">{new Date(campaign.scheduledAt).toLocaleString()}</span>. You can still edit until then.
        </Card>
      )}
      {status === 'sending' && (
        <Card className="p-4 mb-6 border-amber-500/40 bg-amber-500/5 text-sm flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          Sending in the background — {analytics ? `${analytics.sent} of ${analytics.totalRecipients} delivered so far` : 'preparing recipients…'}
        </Card>
      )}
      {status === 'sent' && (
        <Card className="p-4 mb-6 border-emerald-500/40 bg-emerald-500/5 text-sm">
          Sent {campaign.completedAt ? new Date(campaign.completedAt).toLocaleString() : ''} to {analytics?.sent ?? campaign.sentCount ?? 0} people.
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold">Details</h3>
            <div className="space-y-2">
              <Label>Campaign name <span className="text-muted-foreground font-normal">(internal only)</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} data-testid="input-campaign-name" />
            </div>
            <div className="space-y-2">
              <Label>Subject line</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What subscribers see in their inbox" disabled={readOnly} data-testid="input-campaign-subject" />
            </div>
            <div className="space-y-2">
              <Label>Preview text <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="The short line shown after the subject" disabled={readOnly} data-testid="input-campaign-preview-text" />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select value={audienceKey} onValueChange={setAudienceKey} disabled={readOnly}>
                <SelectTrigger data-testid="select-campaign-audience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(audiences ?? []).map((a) => (
                    <SelectItem key={a.key} value={a.key}>{a.name} · {a.count.toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentAudience?.description && <p className="text-xs text-muted-foreground">{currentAudience.description}</p>}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Content</h3>
              <span className="text-xs text-muted-foreground">{blocks.length} block{blocks.length === 1 ? '' : 's'}</span>
            </div>

            {blocks.length === 0 && (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
                Add blocks below to build your email. The preview updates as you type.
              </p>
            )}

            <div className="space-y-3">
              {blocks.map((b, i) => (
                <BlockEditor
                  key={b.id}
                  block={b}
                  index={i}
                  count={blocks.length}
                  disabled={readOnly}
                  onChange={(patch) => changeBlock(i, patch)}
                  onMove={(dir) => moveBlock(i, dir)}
                  onRemove={() => removeBlock(i)}
                />
              ))}
            </div>

            {!readOnly && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {BLOCK_DEFS.map((d) => (
                  <Button key={d.type} variant="outline" size="sm" onClick={() => setBlocks((prev) => [...prev, newBlock(d.type)])} data-testid={`button-add-block-${d.type}`}>
                    <d.icon className="w-3.5 h-3.5 mr-1.5" /> {d.label}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden xl:sticky xl:top-6">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Preview</h3>
              {renderMut.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {previewHtml ? (
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                sandbox=""
                className="w-full h-[640px] bg-[#0a0a0b]"
                data-testid="iframe-campaign-preview"
              />
            ) : (
              <Skeleton className="h-[640px] rounded-none" />
            )}
          </Card>

          {showAnalytics && analytics && (
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Results</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Recipients', value: analytics.totalRecipients },
                  { label: 'Delivered', value: analytics.sent },
                  { label: 'Waiting', value: analytics.pending },
                  { label: 'Skipped', value: analytics.skipped },
                  { label: 'Failed', value: analytics.failed },
                  { label: 'Opened', value: analytics.opened },
                  { label: 'Clicked', value: analytics.clicked },
                  { label: 'Unsubscribed', value: analytics.unsubscribed },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-xl font-semibold" data-testid={`analytics-${s.label.toLowerCase()}`}>{s.value.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Skipped covers people who unsubscribed or lost consent between queueing and sending — they're never emailed.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Test send dialog */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a test email</DialogTitle>
            <DialogDescription>Sends the current design to one address with a [TEST] subject prefix. Test emails always go to the exact address you type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Email address</Label>
            <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" data-testid="input-test-email" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>Cancel</Button>
            <Button onClick={handleTestSend} disabled={!testEmail.trim() || testMut.isPending} data-testid="button-confirm-test-send">
              {testMut.isPending ? 'Sending…' : 'Send test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule this campaign</DialogTitle>
            <DialogDescription>It will start sending automatically at the chosen time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Send at</Label>
            <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} data-testid="input-schedule-at" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleSchedule} disabled={!scheduleAt || sendMut.isPending} data-testid="button-confirm-schedule">
              {sendMut.isPending ? 'Scheduling…' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send now dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send "{name || campaign.name}" now?</DialogTitle>
            <DialogDescription>
              Goes to <span className="font-medium">{currentAudience ? `${currentAudience.name} (${currentAudience.count.toLocaleString()} people)` : 'the selected audience'}</span>.
              Consent is re-checked for every person at send time.
            </DialogDescription>
          </DialogHeader>
          {overview?.testMode ? (
            <p className="text-sm rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
              <FlaskConical className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Test mode is on — every email diverts to Resend's safe test inbox. No real subscriber will receive it.
            </p>
          ) : (
            <p className="text-sm rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
              Live mode — real subscribers will receive this email.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={handleSendNow} disabled={sendMut.isPending} data-testid="button-confirm-send">
              {sendMut.isPending ? 'Starting…' : 'Send campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function BlockEditor({
  block, index, count, disabled, onChange, onMove, onRemove,
}: {
  block: CampaignBlock;
  index: number;
  count: number;
  disabled: boolean;
  onChange: (patch: Partial<CampaignBlock>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const def = BLOCK_DEFS.find((d) => d.type === block.type);
  return (
    <div className="border rounded-md p-3 space-y-2 bg-card" data-testid={`block-editor-${index}`}>
      <div className="flex items-center gap-2">
        {def && <def.icon className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{def?.label ?? block.type}</span>
        {!disabled && (
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)} data-testid={`button-block-up-${index}`}>
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === count - 1} onClick={() => onMove(1)} data-testid={`button-block-down-${index}`}>
              <ChevronDown className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove} data-testid={`button-block-remove-${index}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {block.type === 'headline' && (
        <Input value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Headline text" disabled={disabled} />
      )}
      {block.type === 'text' && (
        <Textarea rows={3} value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Write your paragraph… blank lines split paragraphs." disabled={disabled} />
      )}
      {block.type === 'image' && (
        <div className="space-y-2">
          <Input value={block.url ?? ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="Image URL (https://…)" disabled={disabled} />
          <div className="grid grid-cols-2 gap-2">
            <Input value={block.alt ?? ''} onChange={(e) => onChange({ alt: e.target.value })} placeholder="Describe the image" disabled={disabled} />
            <Input value={block.href ?? ''} onChange={(e) => onChange({ href: e.target.value })} placeholder="Link when clicked (optional)" disabled={disabled} />
          </div>
        </div>
      )}
      {block.type === 'product' && (
        <div className="space-y-1">
          <Input
            type="number"
            min={1}
            value={block.productId ?? ''}
            onChange={(e) => onChange({ productId: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="Product ID"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">Find the ID on the Products page — the preview shows the live product card with image and price.</p>
        </div>
      )}
      {block.type === 'discount' && (
        <div className="grid grid-cols-2 gap-2">
          <Input value={block.code ?? ''} onChange={(e) => onChange({ code: e.target.value })} placeholder="Code, e.g. EVOLVE10" disabled={disabled} />
          <Input value={block.note ?? ''} onChange={(e) => onChange({ note: e.target.value })} placeholder="Note, e.g. 10% off straps" disabled={disabled} />
        </div>
      )}
      {block.type === 'button' && (
        <div className="grid grid-cols-2 gap-2">
          <Input value={block.label ?? ''} onChange={(e) => onChange({ label: e.target.value })} placeholder="Button label" disabled={disabled} />
          <Input value={block.href ?? ''} onChange={(e) => onChange({ href: e.target.value })} placeholder="/products or https://…" disabled={disabled} />
        </div>
      )}
    </div>
  );
}
