import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ContentHeatmap } from '@/components/analytics/content-heatmap';
import { TargetTracker } from '@/components/analytics/target-tracker';
import { ContentAnalyticsCharts } from '@/components/analytics/content-analytics-charts';
import type { UserRoleEnum, ContentItem, ContentTarget } from '@/types/database';
import type { Metadata } from 'next';
import { subDays, subMonths, parseISO, isAfter } from 'date-fns';

export const metadata: Metadata = { title: 'Content Analytics' };
export const dynamic = 'force-dynamic';

export default async function ContentAnalyticsPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase.from('users').select('role').eq('id', authUser!.id).single();
  const userRole = ((userProfile as any)?.role || 'viewer') as UserRoleEnum;

  const [
    { data: allItems },
    { data: contentTypesData },
    { data: targets },
    { data: productTagsData },
  ] = await Promise.all([
    supabase.from('content_items').select('id, content_type, status, product_tags, topic_tags, audience_tags, created_at, published_at'),
    supabase.from('content_types').select('key, label').eq('is_active', true).order('sort_order'),
    supabase.from('content_targets').select('*').eq('tag_type', 'product'),
    supabase.from('tags_master').select('name').eq('tag_type', 'product').order('name'),
  ]);

  const items = (allItems || []) as Pick<ContentItem, 'id' | 'content_type' | 'status' | 'product_tags' | 'topic_tags' | 'audience_tags' | 'created_at' | 'published_at'>[];
  const contentTypes = (contentTypesData || []) as { key: string; label: string }[];
  const contentTargets = (targets || []) as ContentTarget[];
  const productTags = ((productTagsData || []) as { name: string }[]).map((t) => t.name);

  // ── Scorecard calculations ──────────────────────────────

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const published = items.filter((i) => i.status === 'published');
  const draft = items.filter((i) => i.status === 'draft');
  const archived = items.filter((i) => i.status === 'archived');

  const addedThisMonth = items.filter((i) => isAfter(parseISO(i.created_at), thisMonthStart)).length;
  const addedLastMonth = items.filter((i) => {
    const d = parseISO(i.created_at);
    return isAfter(d, lastMonthStart) && !isAfter(d, lastMonthEnd);
  }).length;

  // Coverage score: what % of product tags have ≥1 piece of each major content type
  const MAJOR_TYPES = ['blog', 'video', 'pdf', 'image', 'presentation'];
  let coveredCount = 0;
  for (const product of productTags) {
    const productItems = items.filter((i) => i.product_tags.includes(product));
    const hasAllTypes = MAJOR_TYPES.every((t) => productItems.some((i) => i.content_type === t));
    if (hasAllTypes) coveredCount++;
  }
  const coverageScore = productTags.length > 0
    ? Math.round((coveredCount / productTags.length) * 100)
    : 0;

  // ── Chart data ──────────────────────────────────────────

  // Product distribution
  const productCounts: Record<string, number> = {};
  for (const item of items) {
    for (const tag of item.product_tags) {
      productCounts[tag] = (productCounts[tag] || 0) + 1;
    }
  }

  // Topic distribution
  const topicCounts: Record<string, number> = {};
  for (const item of items) {
    for (const tag of item.topic_tags) {
      topicCounts[tag] = (topicCounts[tag] || 0) + 1;
    }
  }

  // Content type breakdown
  const typeCounts: Record<string, number> = {};
  for (const item of items) {
    const label = contentTypes.find((t) => t.key === item.content_type)?.label || item.content_type;
    typeCounts[label] = (typeCounts[label] || 0) + 1;
  }

  // Audience coverage
  const audienceCounts: Record<string, number> = {};
  for (const item of items) {
    for (const tag of item.audience_tags) {
      audienceCounts[tag] = (audienceCounts[tag] || 0) + 1;
    }
  }

  // Timeline: items per month for last 12 months
  const monthlyTimeline: Record<string, number> = {};
  for (let m = 11; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyTimeline[key] = 0;
  }
  for (const item of items) {
    const d = parseISO(item.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyTimeline[key] !== undefined) monthlyTimeline[key]++;
  }

  // Product × content type heatmap
  const heatmapMatrix: Record<string, Record<string, number>> = {};
  const heatmapTypes = contentTypes.slice(0, 8).map((t) => t.label);
  for (const product of productTags.slice(0, 20)) {
    heatmapMatrix[product] = {};
    for (const ct of contentTypes.slice(0, 8)) {
      heatmapMatrix[product][ct.label] = items.filter(
        (i) => i.product_tags.includes(product) && i.content_type === ct.key
      ).length;
    }
  }

  // Target tracker: actual % per product tag
  const totalItems = items.length || 1;
  const productActuals = productTags.map((tag) => {
    const count = items.filter((i) => i.product_tags.includes(tag)).length;
    return {
      tag_name: tag,
      actual_percentage: Math.round((count / totalItems) * 1000) / 10,
      count,
      total: totalItems,
    };
  }).sort((a, b) => b.count - a.count);

  const isAdmin = userRole === 'admin';

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Content Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visual insights over your content library
        </p>
      </div>

      {/* ── Scorecards ─────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Items</p>
            <p className="text-3xl font-bold">{items.length.toLocaleString()}</p>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <span className="text-emerald-600">{published.length} pub</span>
              <span>{draft.length} draft</span>
              <span>{archived.length} arch</span>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">This Month</p>
            <p className="text-3xl font-bold">{addedThisMonth}</p>
            <p className="text-xs text-muted-foreground mt-2">{addedLastMonth} last month</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Coverage Score</p>
            <p className="text-3xl font-bold">{coverageScore}%</p>
            <p className="text-xs text-muted-foreground mt-2">
              {coveredCount}/{productTags.length} products fully covered
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Content Types</p>
            <p className="text-3xl font-bold">{Object.keys(typeCounts).length}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {productTags.length} products tagged
            </p>
          </div>
        </div>
      </section>

      {/* ── Interactive Charts ─────────────────────── */}
      <ContentAnalyticsCharts
        productCounts={productCounts}
        topicCounts={topicCounts}
        typeCounts={typeCounts}
        audienceCounts={audienceCounts}
        monthlyTimeline={monthlyTimeline}
      />

      {/* ── Heatmap ────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Product × Content Type Coverage Matrix
        </h2>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-4">
            Click any cell to view those items in the library. Red cells indicate gaps.
          </p>
          <ContentHeatmap
            products={productTags.slice(0, 20)}
            contentTypes={heatmapTypes}
            matrix={heatmapMatrix}
          />
        </div>
      </section>

      {/* ── Target Tracker ─────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Product Target Split
        </h2>
        <div className="rounded-lg border bg-card p-4 max-w-2xl">
          <p className="text-xs text-muted-foreground mb-4">
            {isAdmin
              ? 'Set target allocations per product and compare against actuals.'
              : 'Actual content allocation vs targets.'}
          </p>
          <TargetTracker
            actuals={productActuals}
            targets={contentTargets}
            isAdmin={isAdmin}
          />
        </div>
      </section>
    </div>
  );
}
