import { useState } from 'react';
import { useAdminListReviews, useAdminReviewAction, getAdminListReviewsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { Star, MessageSquare, Check, X, ShieldCheck } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function ReviewsPage() {
  const [tab, setTab] = useState<string>('pending');
  
  const queryParams = {
    isApproved: tab === 'pending' ? false : true,
    limit: 50,
  };

  const { data, isLoading, error } = useAdminListReviews(
    queryParams as any, // Assuming API typing matches
    { query: { placeholderData: (prev: any) => prev, queryKey: [] as any } }
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAction = (reviewId: number, action: 'approve' | 'reject') => {
    // We mock the mutation if hook doesn't exist perfectly, but let's assume it does
    const actionMutation = useAdminReviewAction();
    actionMutation.mutate({ reviewId, data: { action } as any }, {
      onSuccess: () => {
        toast({ title: `Review ${action}d` });
        queryClient.invalidateQueries({ queryKey: getAdminListReviewsQueryKey() });
      },
      onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err.data?.error || err.message })
    });
  };

  // We need an inline component to safely use the hook per row
  const ActionButtons = ({ reviewId }: { reviewId: number }) => {
    const mutation = useAdminReviewAction();
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => mutation.mutate({ reviewId, data: { action: 'approve' as any } }, { onSuccess: () => { toast({title:'Approved'}); queryClient.invalidateQueries({queryKey: getAdminListReviewsQueryKey()}); }})}>
          <Check className="w-4 h-4 mr-1" /> Approve
        </Button>
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => mutation.mutate({ reviewId, data: { action: 'reject' as any } }, { onSuccess: () => { toast({title:'Rejected'}); queryClient.invalidateQueries({queryKey: getAdminListReviewsQueryKey()}); }})}>
          <X className="w-4 h-4 mr-1" /> Reject
        </Button>
      </div>
    );
  };

  return (
    <AdminLayout title="Product Reviews">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
            <TabsList className="bg-secondary p-1 h-auto">
              <TabsTrigger value="pending" className="py-2 px-4 text-xs font-bold tracking-wider uppercase text-amber-600">Needs Review</TabsTrigger>
              <TabsTrigger value="approved" className="py-2 px-4 text-xs font-bold tracking-wider uppercase text-emerald-600">Approved</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load reviews: {(error as any)?.data?.error || error.message}
            </div>
          ) : isLoading && !data ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Rating</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead className="w-[200px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.reviews?.map((review: any) => (
                    <TableRow key={review.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(star => (
                            <Star key={star} className={`w-4 h-4 ${star <= review.rating ? 'fill-amber-500 text-amber-500' : 'fill-muted text-muted'}`} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-foreground mb-1">{review.title}</div>
                        <div className="text-sm text-muted-foreground italic">"{review.body}"</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{review.productName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{review.reviewerName}</div>
                        {review.isVerified && (
                          <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 text-emerald-600 mt-1">
                            <ShieldCheck className="w-3 h-3 mr-1" /> Verified Buyer
                          </Badge>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">{formatDate(review.createdAt).split(',')[0]}</div>
                      </TableCell>
                      <TableCell>
                        {tab === 'pending' ? (
                          <ActionButtons reviewId={review.id} />
                        ) : (
                          <Badge variant="outline" className="ml-auto flex w-fit bg-emerald-50 text-emerald-600 border-emerald-200">
                            Approved
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.reviews || data.reviews.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No reviews found in this queue.
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
