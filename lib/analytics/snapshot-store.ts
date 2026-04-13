/**
 * snapshot-store.ts
 *
 * Shared helper called by:
 *   - /api/cron/snapshot-weekly
 *   - /api/cron/snapshot-monthly
 *   - /api/analytics/pull (manual "Pull now" button)
 *   - /api/analytics/backfill (historical backfill)
 *
 * Normalises raw pull results and writes to:
 *   - metric_snapshots  (one row per source, upserted — no duplicates)
 *   - youtube_snapshots (one point-in-time subscriber count per week)
 *   - metric_snapshots  with source = 'leads' (Supabase query, not external API)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GA4SnapshotData,
  GscSnapshotData,
  YoutubeSnapshotData,
  BrevoSnapshotData,
  NormalizedMetrics,
  MetricSnapshotSource,
} from '@/types/database';

interface PullResult {
  source: string;
  property: string;
  data: unknown;
}

function buildSource(source: string, property: string): MetricSnapshotSource | null {
  if (source === 'ga4' && property === 'main') return 'ga4_main';
  if (source === 'ga4' && property === 'es') return 'ga4_es';
  if (source === 'search_console' && property === 'main') return 'gsc_main';
  if (source === 'search_console' && property === 'es') return 'gsc_es';
  if (source === 'youtube') return 'youtube';
  if (source === 'brevo') return 'brevo';
  return null;
}

function normalizeGA4(data: GA4SnapshotData, _source: MetricSnapshotSource): NormalizedMetrics {
  const totalSessions = data.top_countries.reduce((s, c) => s + c.sessions, 0) || 1;
  const india = data.top_countries.find(c => c.country === 'India');
  return {
    organic_sessions: data.organic_sessions,
    new_users: data.new_users,
    returning_users: data.returning_users,
    bounce_rate: data.bounce_rate,
    india_sessions: india?.sessions ?? 0,
    india_pct: india ? Math.round((india.sessions / totalSessions) * 100) : 0,
    top_countries: data.top_countries,
  };
}

function normalizeGSC(data: GscSnapshotData): NormalizedMetrics {
  return {
    clicks: data.clicks,
    impressions: data.impressions,
    ctr: data.ctr,
    avg_position: data.position,
    india_clicks: data.india?.clicks ?? 0,
    india_impressions: data.india?.impressions ?? 0,
    top_queries: data.top_queries,
    top_pages: data.top_pages,
  };
}

function normalizeYouTube(data: YoutubeSnapshotData, subscriberChange: number | null): NormalizedMetrics {
  const metrics: NormalizedMetrics = {
    views: data.views,
    subscriber_count: data.net_subscribers,
    top_videos: data.top_videos.map(v => ({ title: v.title, views: v.views, video_id: v.video_id })),
  };
  if (subscriberChange !== null) {
    metrics.subscriber_change = subscriberChange;
  }
  return metrics;
}

function normalizeBrevo(data: BrevoSnapshotData): NormalizedMetrics {
  return {
    campaigns_sent: data.campaigns.length,
    avg_open_rate: data.avg_open_rate,
    avg_click_rate: data.avg_click_rate,
    avg_ctor: data.avg_ctor,
    campaigns: data.campaigns.map(c => ({
      name: c.name,
      open_rate: c.open_rate,
      click_rate: c.click_rate,
      ctor: c.ctor,
      unsubscribe_rate: c.unsubscribe_rate,
    })),
  };
}

/**
 * Upsert a single row into metric_snapshots.
 * Checks for an existing row with the same source + period_start + snapshot_type.
 * If found, updates the metrics. If not found, inserts a new row.
 */
async function upsertMetricSnapshot(
  serviceClient: SupabaseClient,
  row: {
    snapshot_type: string;
    period_start: string;
    period_end: string;
    source: MetricSnapshotSource;
    metrics: NormalizedMetrics;
  }
): Promise<void> {
  const { data: existing } = await serviceClient
    .from('metric_snapshots')
    .select('id')
    .eq('source', row.source)
    .eq('period_start', row.period_start)
    .eq('snapshot_type', row.snapshot_type)
    .maybeSingle();

  if (existing) {
    await serviceClient
      .from('metric_snapshots')
      .update({ metrics: row.metrics, period_end: row.period_end })
      .eq('id', (existing as { id: string }).id);
  } else {
    await serviceClient.from('metric_snapshots').insert(row);
  }
}

/**
 * Normalize and store metric_snapshots rows for all API pull results.
 * Uses upsert logic — safe to call multiple times for the same period.
 * Also writes a youtube_snapshots row for subscriber growth tracking (deduplicated per week).
 */
export async function storeMetricSnapshots(
  results: PullResult[],
  snapshotType: string,
  periodStart: string,
  periodEnd: string,
  serviceClient: SupabaseClient
): Promise<void> {
  // ── 1. Get previous YouTube subscriber count (before inserting new) ──
  let prevSubscriberCount: number | null = null;
  const ytResult = results.find(r => r.source === 'youtube');
  if (ytResult) {
    const { data: prevYt } = await serviceClient
      .from('youtube_snapshots')
      .select('subscriber_count')
      .order('pulled_at', { ascending: false })
      .limit(1)
      .single();
    prevSubscriberCount = (prevYt as { subscriber_count: number } | null)?.subscriber_count ?? null;
  }

  // ── 2. Build normalised rows and upsert each one ─────────────────────
  for (const r of results) {
    const source = buildSource(r.source, r.property);
    if (!source) continue;

    let metrics: NormalizedMetrics;

    if (source === 'ga4_main' || source === 'ga4_es') {
      metrics = normalizeGA4(r.data as GA4SnapshotData, source);
    } else if (source === 'gsc_main' || source === 'gsc_es') {
      metrics = normalizeGSC(r.data as GscSnapshotData);
    } else if (source === 'youtube') {
      const subscriberChange =
        prevSubscriberCount !== null
          ? (r.data as YoutubeSnapshotData).net_subscribers - prevSubscriberCount
          : null;
      metrics = normalizeYouTube(r.data as YoutubeSnapshotData, subscriberChange);
    } else if (source === 'brevo') {
      metrics = normalizeBrevo(r.data as BrevoSnapshotData);
    } else {
      continue;
    }

    await upsertMetricSnapshot(serviceClient, {
      snapshot_type: snapshotType,
      period_start: periodStart,
      period_end: periodEnd,
      source,
      metrics,
    });
  }

  // ── 3. Store youtube_snapshots point-in-time row (deduplicated per week) ──
  if (ytResult) {
    const ytData = ytResult.data as YoutubeSnapshotData;

    // Only insert if no youtube_snapshot was already taken during this period
    const { data: existingYtSnap } = await serviceClient
      .from('youtube_snapshots')
      .select('id')
      .gte('pulled_at', periodStart + 'T00:00:00')
      .lte('pulled_at', periodEnd + 'T23:59:59')
      .maybeSingle();

    if (!existingYtSnap) {
      await serviceClient.from('youtube_snapshots').insert({
        subscriber_count: ytData.net_subscribers,
        total_view_count: ytData.views_prev,
      });
    } else {
      // Update existing snapshot with latest subscriber count
      await serviceClient
        .from('youtube_snapshots')
        .update({ subscriber_count: ytData.net_subscribers, total_view_count: ytData.views_prev })
        .eq('id', (existingYtSnap as { id: string }).id);
    }
  }
}

/**
 * Query leads table for the period and store/update a leads snapshot row.
 * Uses upsert logic — safe to call multiple times for the same period.
 */
export async function storeLeadsSnapshot(
  snapshotType: string,
  periodStart: string,
  periodEnd: string,
  serviceClient: SupabaseClient
): Promise<void> {
  // Fetch all leads submitted in the period
  const { data: leads } = await serviceClient
    .from('leads')
    .select('id, is_spam, is_high_value, country, lead_source')
    .gte('submitted_at', periodStart)
    .lte('submitted_at', periodEnd + 'T23:59:59');

  const totalLeads = (leads ?? []).length;
  const spamCount = (leads ?? []).filter((l: { is_spam: boolean }) => l.is_spam).length;
  const highValueCount = (leads ?? []).filter((l: { is_high_value: boolean }) => l.is_high_value).length;
  const cleanCount = (leads ?? []).filter((l: { is_spam: boolean }) => !l.is_spam).length;
  const indiaCount = (leads ?? []).filter((l: { country: string | null }) => l.country === 'India').length;

  const byForm: Record<string, number> = {};
  for (const l of (leads ?? []) as { lead_source: string | null }[]) {
    const src = l.lead_source || 'Unknown';
    byForm[src] = (byForm[src] ?? 0) + 1;
  }

  const metrics: NormalizedMetrics = {
    total_leads: totalLeads,
    spam_count: spamCount,
    high_value_count: highValueCount,
    clean_count: cleanCount,
    india_count: indiaCount,
    by_form: byForm,
  };

  await upsertMetricSnapshot(serviceClient, {
    snapshot_type: snapshotType,
    period_start: periodStart,
    period_end: periodEnd,
    source: 'leads' as MetricSnapshotSource,
    metrics,
  });
}

/**
 * Aggregate published linkedin_posts for the period and store/update source='linkedin' snapshot.
 * Uses upsert logic — safe to call multiple times for the same period.
 * Always stores a row (with zeros) even when no posts exist — preserves the timeline.
 */
export async function storeLinkedInSnapshot(
  snapshotType: string,
  periodStart: string,
  periodEnd: string,
  serviceClient: SupabaseClient
): Promise<void> {
  interface LiPostRow {
    post_date: string;
    post_text: string | null;
    engagement_rate: number | null;
    impressions: number | null;
    reactions: number | null;
    comments: number | null;
    shares: number | null;
    post_url: string | null;
    account: { name: string } | { name: string }[] | null;
  }

  const { data: posts } = await serviceClient
    .from('linkedin_posts')
    .select('post_date, post_text, engagement_rate, impressions, reactions, comments, shares, post_url, account:linkedin_accounts!account_id(name)')
    .eq('status', 'published')
    .gte('post_date', periodStart)
    .lte('post_date', periodEnd);

  const rows = (posts ?? []) as LiPostRow[];

  /** Resolve account name from Supabase join (returns object or array) */
  function accountName(row: LiPostRow): string {
    if (!row.account) return 'Unknown';
    if (Array.isArray(row.account)) return row.account[0]?.name ?? 'Unknown';
    return row.account.name;
  }

  const totalImpressions  = rows.reduce((s, p) => s + (p.impressions ?? 0), 0);
  const avgEngagementRate = rows.length > 0
    ? rows.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / rows.length
    : 0;
  const totalReactions = rows.reduce((s, p) => s + (p.reactions ?? 0), 0);
  const totalComments  = rows.reduce((s, p) => s + (p.comments  ?? 0), 0);
  const totalShares    = rows.reduce((s, p) => s + (p.shares    ?? 0), 0);

  // Best post = highest engagement_rate
  const bestRow = rows.length > 0
    ? rows.reduce((best, p) => (p.engagement_rate ?? 0) > (best.engagement_rate ?? 0) ? p : best, rows[0])
    : null;

  // Per-account aggregation
  const byAccountAcc: Record<string, { posts: number; engSum: number; totalImpressions: number }> = {};
  for (const p of rows) {
    const name = accountName(p);
    if (!byAccountAcc[name]) byAccountAcc[name] = { posts: 0, engSum: 0, totalImpressions: 0 };
    byAccountAcc[name].posts           += 1;
    byAccountAcc[name].engSum          += (p.engagement_rate ?? 0);
    byAccountAcc[name].totalImpressions += (p.impressions    ?? 0);
  }
  const by_account: NormalizedMetrics['by_account'] = {};
  for (const [name, acc] of Object.entries(byAccountAcc)) {
    by_account[name] = {
      posts: acc.posts,
      avg_engagement_rate: acc.posts > 0 ? Math.round((acc.engSum / acc.posts) * 100) / 100 : 0,
      total_impressions: acc.totalImpressions,
    };
  }

  const metrics: NormalizedMetrics = {
    posts_published:     rows.length,
    total_impressions:   totalImpressions,
    avg_engagement_rate: Math.round(avgEngagementRate * 100) / 100,
    total_reactions:     totalReactions,
    total_comments:      totalComments,
    total_shares:        totalShares,
    best_post: bestRow ? {
      post_date:         bestRow.post_date,
      account_name:      accountName(bestRow),
      post_text_preview: (bestRow.post_text ?? '').slice(0, 120),
      impressions:       bestRow.impressions ?? 0,
      engagement_rate:   bestRow.engagement_rate ?? 0,
      post_url:          bestRow.post_url,
    } : undefined,
    by_account: Object.keys(by_account).length > 0 ? by_account : undefined,
  };

  await upsertMetricSnapshot(serviceClient, {
    snapshot_type: snapshotType,
    period_start:  periodStart,
    period_end:    periodEnd,
    source:        'linkedin' as MetricSnapshotSource,
    metrics,
  });
}
