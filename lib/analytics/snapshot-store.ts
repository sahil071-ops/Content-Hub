/**
 * snapshot-store.ts
 *
 * Shared helper called by:
 *   - /api/cron/snapshot-weekly
 *   - /api/cron/snapshot-monthly
 *   - /api/analytics/pull (manual "Pull now" button)
 *
 * Normalises raw pull results and writes to:
 *   - metric_snapshots  (one row per source)
 *   - youtube_snapshots (one point-in-time subscriber count)
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
 * Normalize and store metric_snapshots rows for all API pull results.
 * Also writes a youtube_snapshots row for subscriber growth tracking.
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

  // ── 2. Build normalised rows ─────────────────────────────────────────
  const rows: {
    snapshot_type: string;
    period_start: string;
    period_end: string;
    source: MetricSnapshotSource;
    metrics: NormalizedMetrics;
  }[] = [];

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

    rows.push({ snapshot_type: snapshotType, period_start: periodStart, period_end: periodEnd, source, metrics });
  }

  if (rows.length > 0) {
    await serviceClient.from('metric_snapshots').insert(rows);
  }

  // ── 3. Store youtube_snapshots point-in-time row ─────────────────────
  if (ytResult) {
    const ytData = ytResult.data as YoutubeSnapshotData;
    await serviceClient.from('youtube_snapshots').insert({
      subscriber_count: ytData.net_subscribers,
      total_view_count: ytData.views_prev,
    });
  }
}

/**
 * Query leads table for the period and store a leads snapshot row.
 * Call this after storeMetricSnapshots — it uses the same service client.
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

  if (!leads || leads.length === 0) return;

  const totalLeads = leads.length;
  const spamCount = leads.filter((l: { is_spam: boolean }) => l.is_spam).length;
  const highValueCount = leads.filter((l: { is_high_value: boolean }) => l.is_high_value).length;
  const cleanCount = leads.filter((l: { is_spam: boolean }) => !l.is_spam).length;
  const indiaCount = leads.filter((l: { country: string | null }) => l.country === 'India').length;

  const byForm: Record<string, number> = {};
  for (const l of leads as { lead_source: string | null }[]) {
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

  await serviceClient.from('metric_snapshots').insert({
    snapshot_type: snapshotType,
    period_start: periodStart,
    period_end: periodEnd,
    source: 'leads' as MetricSnapshotSource,
    metrics,
  });
}
