import { useState } from 'react';
import { 
  useAdminListContentPages, 
  useAdminGetHomepageSections, 
  useAdminGetSiteSettings,
  useAdminUpdateContentPage,
  useAdminUpdateHomepageSections,
  useAdminUpdateSiteSettings
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Save, FileText, LayoutTemplate, Settings2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ContentPage() {
  return (
    <AdminLayout title="Content & Settings">
      <Tabs defaultValue="pages" className="w-full">
        <TabsList className="bg-secondary p-1 h-auto mb-6">
          <TabsTrigger value="pages" className="py-2 px-4 text-xs font-bold tracking-wider uppercase"><FileText className="w-4 h-4 mr-2" /> Pages</TabsTrigger>
          <TabsTrigger value="homepage" className="py-2 px-4 text-xs font-bold tracking-wider uppercase"><LayoutTemplate className="w-4 h-4 mr-2" /> Homepage</TabsTrigger>
          <TabsTrigger value="settings" className="py-2 px-4 text-xs font-bold tracking-wider uppercase"><Settings2 className="w-4 h-4 mr-2" /> Site Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pages">
          <PagesTab />
        </TabsContent>
        
        <TabsContent value="homepage">
          <HomepageTab />
        </TabsContent>
        
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function PagesTab() {
  const { data: pages, isLoading } = useAdminListContentPages();
  const [editingPage, setEditingPage] = useState<any>(null);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-1 lg:col-span-1 space-y-2">
        {pages?.map((page) => (
          <Card 
            key={page.key} 
            className={`cursor-pointer transition-colors ${editingPage?.key === page.key ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}
            onClick={() => setEditingPage(page)}
          >
            <CardContent className="p-4">
              <div className="font-bold">{page.title}</div>
              <div className="text-xs font-mono text-muted-foreground mt-1">/{page.key}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="col-span-1 lg:col-span-2">
        {editingPage ? (
          <PageEditor page={editingPage} />
        ) : (
          <Card className="h-full min-h-[400px] flex items-center justify-center bg-secondary/10 border-dashed">
            <div className="text-center text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Select a page to edit</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function PageEditor({ page }: { page: any }) {
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminUpdateContentPage();

  const handleSave = () => {
    mutation.mutate({ pageKey: page.key, data: { title, body } }, {
      onSuccess: () => {
        toast({ title: 'Page Saved' });
        queryClient.invalidateQueries({ queryKey: [] as any }); // Use specific key if needed, or refetch all
      },
      onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message })
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4 border-b">
        <CardTitle>Edit Page: /{page.key}</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Body (Markdown)</Label>
          <Textarea value={body} onChange={e => setBody(e.target.value)} rows={15} className="font-mono text-sm leading-relaxed" />
        </div>
      </CardContent>
      <CardFooter className="bg-secondary/20 border-t p-4 flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending} className="font-bold tracking-wide">
          <Save className="w-4 h-4 mr-2" /> Save Page
        </Button>
      </CardFooter>
    </Card>
  );
}

function HomepageTab() {
  const { data: content, isLoading } = useAdminGetHomepageSections();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminUpdateHomepageSections();

  const [sections, setSections] = useState<any[]>([]);

  // We are mutating the local state immediately on data load, but react-query will cache it
  // This is a simple implementation. In a real app we'd use useEffect to sync state.
  if (content && sections.length === 0 && !isLoading) {
    setSections([...(content as any[])].sort((a, b) => a.position - b.position));
  }

  const handleToggle = (id: number, active: boolean) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, active } : s));
  };

  const handleSave = () => {
    const data = (sections || []).map((s, idx) => ({ id: s.id, position: idx, active: s.active }));
    mutation.mutate({ data: { sections: data } }, {
      onSuccess: () => {
        toast({ title: 'Sections Updated' });
        queryClient.invalidateQueries({ queryKey: [] as any });
      },
      onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message })
    });
  };

  if (isLoading) return <Skeleton className="h-[400px]" />;

  return (
    <Card>
      <CardHeader className="pb-4 border-b flex flex-row justify-between items-center">
        <div>
          <CardTitle>Homepage Sections</CardTitle>
          <CardDescription>Toggle visibility of sections on the storefront homepage.</CardDescription>
        </div>
        <Button onClick={handleSave} disabled={mutation.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save Layout
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {(sections || []).map(section => (
            <div key={section.id} className="p-4 flex items-center justify-between hover:bg-secondary/10 transition-colors">
              <div>
                <div className="font-bold">{section.title || section.key}</div>
                <div className="text-xs font-mono text-muted-foreground mt-1">Type: {section.sectionType}</div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`active-${section.id}`} className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                  {section.active ? 'Visible' : 'Hidden'}
                </Label>
                <Switch 
                  id={`active-${section.id}`} 
                  checked={section.active} 
                  onCheckedChange={(c) => handleToggle(section.id, c)} 
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsTab() {
  const { data: settings, isLoading } = useAdminGetSiteSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminUpdateSiteSettings();

  const [formData, setFormData] = useState<any>({});

  // Sync state once on load
  if (settings && Object.keys(formData).length === 0 && !isLoading) {
    setFormData(settings);
  }

  const handleChange = (k: string, v: string) => setFormData((prev: any) => ({ ...prev, [k]: v }));

  const handleSave = () => {
    mutation.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: 'Settings Saved' });
        queryClient.invalidateQueries({ queryKey: [] as any });
      },
      onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message })
    });
  };

  if (isLoading) return <Skeleton className="h-[600px]" />;

  return (
    <Card>
      <CardHeader className="pb-4 border-b flex flex-row justify-between items-center">
        <div>
          <CardTitle>Site Settings</CardTitle>
          <CardDescription>Global configuration for the storefront.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-2">General</h3>
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={formData.businessName || ''} onChange={e => handleChange('businessName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input value={formData.supportEmail || ''} onChange={e => handleChange('supportEmail', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={formData.currency || ''} onChange={e => handleChange('currency', e.target.value)} className="font-mono uppercase" />
              </div>
              <div className="space-y-2">
                <Label>Default Country</Label>
                <Input value={formData.defaultCountry || ''} onChange={e => handleChange('defaultCountry', e.target.value)} className="font-mono uppercase" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-2">Social & Banners</h3>
            <div className="space-y-2">
              <Label>Instagram URL</Label>
              <Input value={formData.socialInstagram || ''} onChange={e => handleChange('socialInstagram', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>TikTok URL</Label>
              <Input value={formData.socialTiktok || ''} onChange={e => handleChange('socialTiktok', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Announcement Banner Text</Label>
              <Input value={formData.announcementBanner || ''} onChange={e => handleChange('announcementBanner', e.target.value)} />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-secondary/20 border-t p-4 flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending} className="font-bold tracking-wide">
          <Save className="w-4 h-4 mr-2" /> Save Settings
        </Button>
      </CardFooter>
    </Card>
  );
}
