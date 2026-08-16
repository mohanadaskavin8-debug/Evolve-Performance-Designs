import { useGetPageContent } from '@workspace/api-client-react';

export default function ContentPage({ params }: { params: { pageKey: string } }) {
  const { pageKey } = params;
  const { data: content, isLoading } = useGetPageContent(pageKey, { query: { queryKey: ['page-content', pageKey], enabled: !!pageKey } });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-3xl">
        <div className="h-12 w-2/3 bg-card animate-pulse rounded-md mb-12" />
        <div className="space-y-4">
          <div className="h-4 bg-card animate-pulse rounded-md w-full" />
          <div className="h-4 bg-card animate-pulse rounded-md w-full" />
          <div className="h-4 bg-card animate-pulse rounded-md w-5/6" />
          <div className="h-4 bg-card animate-pulse rounded-md w-4/5" />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-display font-bold uppercase tracking-tight mb-4 text-destructive">404 - Archive Not Found</h1>
        <p className="font-mono text-muted-foreground uppercase tracking-widest">The requested data fragment does not exist.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-20 max-w-3xl">
      <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tight mb-12 border-b border-border pb-8">
        {content.title}
      </h1>
      <div 
        className="prose prose-invert prose-p:font-mono prose-p:text-muted-foreground prose-headings:font-display prose-headings:uppercase prose-headings:tracking-widest prose-a:text-primary max-w-none"
        dangerouslySetInnerHTML={{ __html: content.body }}
      />
    </div>
  );
}
