import { useState, useRef, useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { 
  useAdminGetProduct, 
  getAdminGetProductQueryKey,
  useAdminUpdateProduct,
  useAdminProductAction,
  useAdminCreateVariant,
  useAdminUpdateVariant,
  useAdminAddProductImage,
  useAdminDeleteProductImage
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { ArrowLeft, Save, Plus, ImageIcon, Trash2, Edit2, Archive, Globe, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductDetailPage() {
  const [, params] = useRoute('/products/:id');
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: product, isLoading, error } = useAdminGetProduct(id, {
    query: { enabled: !!id, queryKey: getAdminGetProductQueryKey(id) }
  });

  const updateProduct = useAdminUpdateProduct();
  const actionProduct = useAdminProductAction();

  // State for basic details (guarded init)
  const initializedId = useRef<number | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('');
  const [materials, setMaterials] = useState('');
  const [benefits, setBenefits] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    if (product && initializedId.current !== id) {
      initializedId.current = id;
      setName(product.name);
      setSlug(product.slug);
      setDescription(product.description || '');
      setTheme(product.theme || '');
      setMaterials(product.materials || '');
      setBenefits(product.benefits || '');
      setIsFeatured(!!product.isFeatured);
    }
  }, [product, id]);

  const handleSaveDetails = () => {
    updateProduct.mutate({
      productId: id,
      data: { name, slug, description, theme, materials, benefits, isFeatured }
    }, {
      onSuccess: () => {
        toast({ title: 'Success', description: 'Product details updated.' });
        queryClient.invalidateQueries({ queryKey: getAdminGetProductQueryKey(id) });
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message });
      }
    });
  };

  const handleAction = (action: 'publish' | 'unpublish' | 'archive' | 'restore') => {
    actionProduct.mutate({ productId: id, data: { action } }, {
      onSuccess: () => {
        toast({ title: 'Success', description: `Product ${action}ed.` });
        queryClient.invalidateQueries({ queryKey: getAdminGetProductQueryKey(id) });
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message });
      }
    });
  };

  if (error) {
    return (
      <AdminLayout title="Product Details">
        <div className="p-6 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 font-mono text-sm">
          Failed to load product: {(error as any)?.data?.error || error.message}
        </div>
      </AdminLayout>
    );
  }

  if (isLoading || !product) {
    return (
      <AdminLayout title="Product Details">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="col-span-2 h-[600px] rounded-xl" />
            <Skeleton className="col-span-1 h-[600px] rounded-xl" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Edit: ${product.name}`}>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/products" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Products
        </Link>
        <div className="flex items-center gap-3">
          <Badge variant={product.status === 'active' ? 'default' : 'secondary'} className={product.status === 'active' ? 'bg-emerald-600' : ''}>
            {product.status.toUpperCase()}
          </Badge>
          {product.status === 'draft' && (
            <Button size="sm" onClick={() => handleAction('publish')} className="bg-emerald-600 hover:bg-emerald-700">
              <Globe className="w-4 h-4 mr-2" /> Publish
            </Button>
          )}
          {product.status === 'active' && (
            <Button size="sm" variant="outline" onClick={() => handleAction('unpublish')}>
              Unpublish
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input value={slug} onChange={e => setSlug(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Theme/Collection Line</Label>
                <Input value={theme} onChange={e => setTheme(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Materials (Markdown)</Label>
                  <Textarea value={materials} onChange={e => setMaterials(e.target.value)} rows={3} className="font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label>Benefits (Markdown)</Label>
                  <Textarea value={benefits} onChange={e => setBenefits(e.target.value)} rows={3} className="font-mono text-xs" />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2 border-t">
                <Checkbox id="featured" checked={isFeatured} onCheckedChange={(c) => setIsFeatured(!!c)} />
                <Label htmlFor="featured" className="cursor-pointer">Feature on homepage</Label>
              </div>
            </CardContent>
            <CardFooter className="bg-secondary/20 border-t p-4 flex justify-end">
              <Button onClick={handleSaveDetails} disabled={updateProduct.isPending} className="font-bold tracking-wide">
                <Save className="w-4 h-4 mr-2" /> Save Details
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-4 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Variants</CardTitle>
                <CardDescription>Manage SKUs, sizes, colors, and pricing.</CardDescription>
              </div>
              <VariantDialog productId={id} />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>SKU</TableHead>
                    <TableHead>Attributes</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Compare At</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.variants.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono font-bold text-sm">{v.sku}</TableCell>
                      <TableCell>
                        {[v.size, v.color].filter(Boolean).length > 0 ? (
                          <div className="flex gap-1">
                            {v.size && <Badge variant="secondary" className="font-mono text-[10px] uppercase">{v.size}</Badge>}
                            {v.color && <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/30 text-primary">{v.color}</Badge>}
                          </div>
                        ) : <span className="text-muted-foreground text-xs italic">Default</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(v.priceInCents)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {v.compareAtPriceInCents ? formatCurrency(v.compareAtPriceInCents) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {v.active ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <Archive className="w-4 h-4 text-muted-foreground mx-auto" />}
                      </TableCell>
                      <TableCell>
                        <VariantDialog productId={id} variant={v} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {product.variants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground p-8">No variants found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Images</CardTitle>
              <ImageDialog productId={id} />
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-2 gap-3">
              {product.images.map((img) => (
                <div key={img.id} className="relative group aspect-square rounded-md overflow-hidden border">
                  <img src={img.url} alt={img.altText || ''} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <DeleteImageButton productId={id} imageId={img.id} />
                  </div>
                </div>
              ))}
              {product.images.length === 0 && (
                <div className="col-span-2 aspect-[2/1] border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground bg-secondary/10">
                  <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-sm font-medium">No images uploaded</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function VariantDialog({ productId, variant }: { productId: number, variant?: any }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [sku, setSku] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  const [comparePrice, setComparePrice] = useState('');
  const [active, setActive] = useState(true);
  const [stock, setStock] = useState(''); // Only used for creation

  useEffect(() => {
    if (open && variant) {
      setSku(variant.sku);
      setSize(variant.size || '');
      setColor(variant.color || '');
      setPrice((variant.priceInCents / 100).toString());
      setComparePrice(variant.compareAtPriceInCents ? (variant.compareAtPriceInCents / 100).toString() : '');
      setActive(variant.active);
    } else if (open && !variant) {
      setSku(''); setSize(''); setColor(''); setPrice(''); setComparePrice(''); setActive(true); setStock('0');
    }
  }, [open, variant]);

  const createMut = useAdminCreateVariant();
  const updateMut = useAdminUpdateVariant();
  const isPending = createMut.isPending || updateMut.isPending;

  const handleSave = () => {
    const data: any = {
      sku,
      size: size || undefined,
      color: color || undefined,
      priceInCents: Math.round(parseFloat(price) * 100),
      compareAtPriceInCents: comparePrice ? Math.round(parseFloat(comparePrice) * 100) : undefined,
      active
    };

    if (variant) {
      updateMut.mutate({ productId, variantId: variant?.id || 0, data }, {
        onSuccess: () => {
          toast({ title: 'Variant Updated' });
          queryClient.invalidateQueries({ queryKey: getAdminGetProductQueryKey(productId) });
          setOpen(false);
        },
        onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
      });
    } else {
      data.stockQuantity = parseInt(stock) || 0;
      createMut.mutate({ productId, data }, {
        onSuccess: () => {
          toast({ title: 'Variant Created' });
          queryClient.invalidateQueries({ queryKey: getAdminGetProductQueryKey(productId) });
          setOpen(false);
        },
        onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {variant ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="h-8 w-8 hover:bg-secondary"><Edit2 className="w-4 h-4 text-muted-foreground" /></Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)} className="h-8"><Plus className="w-4 h-4 mr-1" /> Add Variant</Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{variant ? 'Edit Variant' : 'New Variant'}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input value={sku} onChange={e => setSku(e.target.value)} className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Size (optional)</Label>
              <Input value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. OS, L" className="font-mono uppercase" />
            </div>
            <div className="space-y-2">
              <Label>Color (optional)</Label>
              <Input value={color} onChange={e => setColor(e.target.value)} placeholder="e.g. Onyx" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price (USD)</Label>
              <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Compare At Price (optional)</Label>
              <Input type="number" step="0.01" value={comparePrice} onChange={e => setComparePrice(e.target.value)} className="font-mono" />
            </div>
          </div>
          {!variant && (
            <div className="space-y-2">
              <Label>Initial Stock</Label>
              <Input type="number" value={stock} onChange={e => setStock(e.target.value)} className="font-mono" />
            </div>
          )}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox id="active" checked={active} onCheckedChange={c => setActive(!!c)} />
            <Label htmlFor="active">Active (Available for purchase)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !sku || !price}>Save Variant</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImageDialog({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminAddProductImage();

  const handleAdd = () => {
    mutation.mutate({ productId, data: { url, isPrimary: false } }, {
      onSuccess: () => {
        toast({ title: 'Image Added' });
        queryClient.invalidateQueries({ queryKey: getAdminGetProductQueryKey(productId) });
        setOpen(false);
        setUrl('');
      },
      onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="h-8"><Plus className="w-4 h-4" /></Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Product Image</DialogTitle></DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
            <p className="text-xs text-muted-foreground">In a real app, this would be a file uploader to S3/Cloudinary.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={mutation.isPending || !url}>Add Image</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteImageButton({ productId, imageId }: { productId: number, imageId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminDeleteProductImage();

  const handleDelete = () => {
    if (!confirm('Delete this image?')) return;
    mutation.mutate({} as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminGetProductQueryKey(productId) });
      },
      onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
    });
  };

  return (
    <Button variant="destructive" size="icon" className="rounded-full" onClick={handleDelete} disabled={mutation.isPending}>
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
