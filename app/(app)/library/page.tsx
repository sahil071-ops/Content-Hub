import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ContentGrid } from '@/components/content/content-grid';
import { ContentFilters } from '@/components/content/content-filters';
import { ContentSearch } from '@/components/content/content-search';
import { ViewToggle, SortSelector } from '@/components/content/library-controls';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import Link from 'next/link';
import type { TagRow, UserRoleEnum, ContentTypeRow } from '@/types/database';
import type { ContentTypesMap } from '@/components/content/content-card';
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

  // Fetch dynamic content types (may not exist before migration 004)
  const { data: contentTypesData } = await supabase
    .from('content_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  const contentTypes = (contentTypesData || []) as ContentTypeRow[];
  // Build a lookup map for card badges
  const contentTypesMap: ContentTypesMap = Object.fromEntries(
    contentTypes.map((t) => [t.key, { label: t.label, color_classes: t.color_classes }])
  );

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
  const currentSort = searchParams.sort || 'newest';

  // Serialize searchParams for client components (avoids useSearchParams() suspension)
  const searchParamsStr = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((val) => [k, val]) : v ? [[k, v]] : []
    )
  ).toString();

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
      </div>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <Suspense>
          <ContentFilters
            productTags={productTags}
            topicTags={topicTags}
            userRole={userRole}
            contentTypes={contentTypes.length > 0 ? contentTypes : undefined}
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
              <SortSelector current={currentSort} searchParamsStr={searchParamsStr} />

              {/* View toggle */}
              <ViewToggle current={view} searchParamsStr={searchParamsStr} />

              {/* Upload button — always visible alongside controls */}
              {canUpload && (
                <Button asChild className="bg-[#2323A3] hover:bg-[#2323A3]/90">
                  <Link href="/upload">
                    <Upload className="h-4 w-4" />
                    Upload
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium">Failed to load content</p>
              <p className="mt-1 text-xs opacity-80">{error.message}</p>
            </div>
          ) : (
            <ContentGrid items={items || []} view={view} contentTypesMap={contentTypesMap} />
          )}
        </div>
      </div>
    </div>
  );
}

