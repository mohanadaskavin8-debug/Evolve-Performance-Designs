import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAdminCreateProduct, useAdminCreateVariant } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function NewProductPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [createdProduct, setCreatedProduct] = useState<any>(null);

  const createProduct = useAdminCreateProduct();
  const createVariant = useAdminCreateVariant();

  // Form Data
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // Variant Data
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');

  const handleCreateProduct = () => {
    createProduct.mutate({
      data: {
        name,
        slug,
        description,
        theme,
        isFeatured,
        status: 'draft' // Create as draft initially
      }
    }, {
      onSuccess: (data) => {
        setCreatedProduct(data);
        toast({ title: 'Product Created', description: 'Now add a starting variant.' });
        setStep(2);
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message });
      }
    });
  };

  const handleCreateVariant = () => {
    if (!createdProduct) return;
    
    createVariant.mutate({
      productId: createdProduct.id,
      data: {
        sku,
        priceInCents: Math.round(parseFloat(price) * 100),
        stockQuantity: parseInt(stock, 10) || 0,
        active: true,
      }
    }, {
      onSuccess: () => {
        toast({ title: 'Variant Created', description: 'Product setup complete. Redirecting to detail view.' });
        setLocation(`/products/${createdProduct.slug}`);
      },
      onError: (err: any) => {
        toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message });
      }
    });
  };

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) {
      setSlug(newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    }
  };

  return (
    <AdminLayout title="New Product">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/products" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors font-medium w-fit">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Products
        </Link>
        
        <div className="flex items-center gap-2 mb-8 text-sm font-mono uppercase tracking-wider">
          <span className={`font-bold ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>1. Details</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className={`font-bold ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>2. Variants & Setup</span>
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>Basic information for the new product.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input id="name" value={name} onChange={handleNameChange} placeholder="e.g. Ronin Lifting Straps" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input id="slug" value={slug} onChange={e => setSlug(e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme">Theme/Collection Line</Label>
                <Input id="theme" value={theme} onChange={e => setTheme(e.target.value)} placeholder="e.g. Cyberpunk, Mecha" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={5} />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="featured" checked={isFeatured} onCheckedChange={(c) => setIsFeatured(!!c)} />
                <Label htmlFor="featured" className="cursor-pointer">Feature on homepage</Label>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-end">
              <Button 
                onClick={handleCreateProduct} 
                disabled={!name || !slug || createProduct.isPending}
                className="font-bold tracking-wide"
              >
                {createProduct.isPending ? 'Creating...' : 'Continue to Variants'}
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Initial Variant</CardTitle>
              <CardDescription>Create the first variant for {createdProduct?.name}. You can add more later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={sku} onChange={e => setSku(e.target.value)} className="font-mono" placeholder="e.g. STRP-RONIN-01" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (USD)</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    step="0.01" 
                    value={price} 
                    onChange={e => setPrice(e.target.value)} 
                    placeholder="29.99" 
                    className="font-mono" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Initial Stock</Label>
                  <Input 
                    id="stock" 
                    type="number" 
                    value={stock} 
                    onChange={e => setStock(e.target.value)} 
                    className="font-mono" 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-end">
              <Button 
                onClick={handleCreateVariant} 
                disabled={!sku || !price || createVariant.isPending}
                className="font-bold tracking-wide"
              >
                {createVariant.isPending ? 'Saving...' : 'Finish Setup'}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
