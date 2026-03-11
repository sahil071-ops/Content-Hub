import { ContentCard } from '@/components/content/content-card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileSearch } from 'lucide-react';
import type { ContentItem } from '@/types/database';

interface ContentGridProps {
  items: ContentItem[];
  view?: 'grid' | 'list';
  loading?: boolean;
}

export function ContentGrid({ items, view = 'grid', loading }: ContentGridProps) {
  if (loading) {
    return (
      <div className={view === 'grid'
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
        : 'space-y-2'
      }>
        {Array.from({ length: 8 }).map((_, i) => (
          <ContentSkeleton key={i} view={view} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileSearch className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="font-semibold text-muted-foreground">No content found</h3>
        <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm">
          Try adjusting your filters or search terms, or upload new content.
        </p>
      </div>
    );
  }

  return (
    <div className={view === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
      : 'space-y-2'
    }>
      {items.map((item) => (
        <ContentCard key={item.id} item={item} view={view} />
      ))}
    </div>
  );
}

function ContentSkeleton({ view }: { view: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <div className="flex items-center gap-4 p-4 rounded-lg border">
        <Skeleton className="h-14 w-14 rounded-md shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Skeleton className="aspect-[16/9] w-full" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}
