import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ContentGrid } from '@/components/content/content-grid';
import { ContentFilters } from '@/components/content/content-filters';
import { ContentSearch } from '@/components/content/content-search';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutGrid, List, Upload } from 'lucide-react';
import Link from 'next/link';
import type { ContentItem, TagRow, UserRoleEnum } from '@/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Content Library' };
export const dynamic = 'force-dynamic';

interface LibraryPageProps {
  searchParams: {
    q?: string;
    type?: string | string[];
    product?: string | string[];
    topic?: string | string[];
    audience?: string | string[];
    status?: string | string[];
    sort?: string;
    view?: string;
  };
}

function toArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser!.id)
    .single() as { data: { role: string } | null; error: unknown };

  const userRole = ((userProfile as any)?.role || 'viewer') as UserRoleEnum;

  // Fetch tags for filter panel
  const { data: allTags } = await supabase
    .from('tags_master')
    .select('*')
    .order('name');

  const productTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'product');
  const topicTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'topic');

  // Build content query
  let query = supabase
    .from('content_items')
    .select('*')
    .order(
      searchParams.sort === 'oldest' ? 'created_at' :
      searchParams.sort === 'updated' ? 'updated_at' : 'created_at',
      { ascending: searchParams.sort === 'oldest' }
    );

  // Full text search
  if (searchParams.q) {
    query = query.or(
      `title.ilike.%${searchParams.q}%,description.ilike.%${searchParams.q}%`
    );
  }

  // Content type filter
  const types = toArray(searchParams.type);
  if (types.length > 0) {
    query = query.in('content_type', types as any[]);
  }

  // Product tag filter
  const products = toArray(searchParams.product);
  if (products.length > 0) {
    query = query.overlaps('product_tags', products);
  }

  // Topic tag filter
  const topics = toArray(searchParams.topic);
  if (topics.length > 0) {
    query = query.overlaps('topic_tags', topics);
  }

  // Audience filter (admin/marketing only)
  if (['admin', 'marketing'].includes(userRole)) {
    const audiences = toArray(searchParams.audience);
    if (audiences.length > 0) {
      query = query.overlaps('audience_tags', audiences as any[]);
    }

    // Status filter
    const statuses = toArray(searchParams.status);
    if (statuses.length > 0) {
      query = query.in('status', statuses as any[]);
    }
  }

  const { data: items, error } = await query;

  const view = (searchParams.view === 'list' ? 'list' : 'grid') as 'grid' | 'list';
  const canUpload = ['admin', 'marketing'].includes(userRole);

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Content Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items?.length ?? 0} item{items?.length !== 1 ? 's' : ''}
            {searchParams.q && ` matching "${searchParams.q}"`}
          </p>
        </div>
        {canUpload && (
          <Button asChild className="bg-[#2323A3] hover:bg-[#2323A3]/90">
            <Link href="/upload">
              <Upload className="h-4 w-4" />
              Upload
            </Link>
          </Button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <Suspense>
          <ContentFilters
            productTags={productTags}
            topicTags={topicTags}
            userRole={userRole}
          />
        </Suspense>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Search + controls bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Suspense>
              <ContentSearch className="flex-1" />
            </Suspense>

            <div className="flex items-center gap-2 shrink-0">
              {/* Sort */}
              <Suspense>
                <SortSelector current={searchParams.sort} />
              </Suspense>

              {/* View toggle */}
              <Suspense>
                <ViewToggle current={view} />
              </Suspense>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium">Failed to load content</p>
              <p className="mt-1 text-xs opacity-80">{error.message}</p>
            </div>
          ) : (
            <ContentGrid items={items || []} view={view} />
          )}
        </div>
      </div>
    </div>
  );
}

function SortSelector({ current }: { current?: string }) {
  return (
    <Select defaultValue={current || 'newest'}>
      <SelectTrigger className="w-40 h-9 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">Newest first</SelectItem>
        <SelectItem value="oldest">Oldest first</SelectItem>
        <SelectItem value="updated">Recently updated</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ViewToggle({ current }: { current: 'grid' | 'list' }) {
  return (
    <div className="flex rounded-md border overflow-hidden">
      <Link
        href="?view=grid"
        className={`flex items-center px-3 py-2 transition-colors ${
          current === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Link>
      <Link
        href="?view=list"
        className={`flex items-center px-3 py-2 transition-colors ${
          current === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
        aria-label="List view"
      >
        <List className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
