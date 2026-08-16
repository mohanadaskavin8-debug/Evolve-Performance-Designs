import { useRoute } from 'wouter';
import { useGetPageContent } from '@workspace/api-client-react';

export default function ContentPage() {
  const [, params] = useRoute('/pages/:pageKey');
  const pageKey = params?.pageKey || '';

  const { data: page, isLoading, error } = useGetPageContent(pageKey, {
    query: { enabled: !!pageKey, queryKey: ['page', pageKey] }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 bg-background flex justify-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen pt-32 bg-background text-center flex flex-col items-center">
        <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-white mb-4">404 - Document Redacted</h1>
        <p className="font-mono text-muted-foreground uppercase tracking-widest">The intel you are looking for does not exist.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container mx-auto px-6 md:px-12 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-[0.2em] text-white mb-6">
          {page.title}
        </h1>
        <div className="w-24 h-1 bg-primary mb-16" />
        
        <div className="border border-white/10 bg-white/[0.02] p-8 md:p-12">
          {/* using prose for content formatting, injected from backend */}
          <div 
            className="prose prose-invert prose-p:font-mono prose-p:text-muted-foreground prose-p:leading-relaxed prose-headings:font-display prose-headings:uppercase prose-headings:tracking-widest prose-a:text-primary max-w-none"
            dangerouslySetInnerHTML={{ __html: page.body }}
          />
        </div>
        
        <div className="mt-8 font-mono text-xs uppercase tracking-widest text-white/30 text-right">
          Last Updated: {new Date(page.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
