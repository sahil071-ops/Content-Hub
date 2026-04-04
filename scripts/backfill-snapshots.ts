/**
 * backfill-snapshots.ts
 *
 * One-time backfill: reads all rows from the legacy `mis_snapshots` table and
 * converts them into the normalised `metric_snapshots` format introduced in
 * migration 015.
 *
 * Safe to run multiple times — uses conflict detection to skip rows that
 * already exist (same snapshot_type + source + period_start).
 *
 * Usage:
 *   npx tsx scripts/backfill-snapshots.ts
 *
 * Required env vars (same as the app):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// ── Inline types (mirrors types/database.ts to avoid path-alias deps) ────────

interface MisSnapshotRow {
  id: string;
  source: string;      // 'ga4' | 'search_console' | 'youtube' | 'brevo'
  property: string;    // 'main' | 'es' | 'default'
  period_type: string; // 'weekly' | 'monthly' | 'quarterly' | 'annual'
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  pulled_at: string;
}

interface NormalizedMetrics {
  organic_sessions?: number;
  new_users?: number;
  returning_users?: number;
  bounce_rate?: number;
  india_sessions?: number;
  india_pct?: number;
  top_countries?: { country: string; sessions: number }[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  avg_position?: number;
  india_clicks?: number;
  india_impressions?: number;
  top_queries?: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  top_pages?: { page: string; clicks: number; impressions: number }[];
  views?: number;
  subscriber_count?: number;
  subscriber_change?: number;
  top_videos?: { title: string; views: number; video_id: string }[];
  campaigns_sent?: number;
  avg_open_rate?: number;
  avg_click_rate?: number;
  avg_ctor?: number;
  campaigns?: { name: string; open_rate: number; click_rate: number; ctor: number; unsubscribe_rate: number }[];
}

// ── Source key mapping ────────────────────────────────────────────────────────

type MetricSnapshotSource = 'ga4_main' | 'ga4_es' | 'gsc_main' | 'gsc_es' | 'youtube' | 'brevo';

function mapSource(source: string, property: string): MetricSnapshotSource | null {
  if (source === 'ga4' && property === 'main')           return 'ga4_main';
  if (source === 'ga4' && property === 'es')             return 'ga4_es';
  if (source === 'search_console' && property === 'main') return 'gsc_main';
  if (source === 'search_console' && property === 'es')  return 'gsc_es';
  if (source === 'youtube')                              return 'youtube';
  if (source === 'brevo')                                return 'brevo';
  return null;
}

// ── Data mapping: old mis_snapshots.data → NormalizedMetrics ─────────────────

function normalizeGA4(data: Record<string, unknown>): NormalizedMetrics {
  const countries = (data.top_countries as { country: string; sessions: number }[] | undefined) ?? [];
  const totalSessions = countries.reduce((s, c) => s + c.sessions, 0) || 1;
  const india = countries.find((c) => c.country === 'India');
  const indiaSessions = india?.sessions ?? 0;

  return {
    organic_sessions: numOr(data.organic_sessions),
    new_users:        numOr(data.new_users),
    returning_users:  numOr(data.returning_users),
    bounce_rate:      numOr(data.bounce_rate),
    india_sessions:   indiaSessions,
    india_pct:        Math.round((indiaSessions / totalSessions) * 100),
    top_countries:    countries.slice(0, 10),
  };
}

function normalizeGSC(data: Record<string, unknown>): NormalizedMetrics {
  const india = data.india as Record<string, unknown> | undefined;
  const rawQueries = (data.top_queries as unknown[]) ?? [];
  const rawPages   = (data.top_pages  as unknown[]) ?? [];

  return {
    clicks:           numOr(data.clicks),
    impressions:      numOr(data.impressions),
    ctr:              numOr(data.ctr),
    avg_position:     numOr(data.position),
    india_clicks:     india ? numOr(india.clicks) : undefined,
    india_impressions: india ? numOr(india.impressions) : undefined,
    top_queries: rawQueries.slice(0, 20).map((q) => {
      const r = q as Record<string, unknown>;
      return {
        query:       String(r.query ?? ''),
        clicks:      numOr(r.clicks),
        impressions: numOr(r.impressions),
        ctr:         numOr(r.ctr),
        position:    numOr(r.position),
      };
    }),
    top_pages: rawPages.slice(0, 10).map((p) => {
      const r = p as Record<string, unknown>;
      return {
        page:        String(r.page ?? ''),
        clicks:      numOr(r.clicks),
        impressions: numOr(r.impressions),
      };
    }),
  };
}

function normalizeYouTube(data: Record<string, unknown>): NormalizedMetrics {
  const rawVideos = (data.top_videos as unknown[]) ?? [];
  return {
    views:            numOr(data.views),
    subscriber_count: numOr(data.net_subscribers),
    top_videos: rawVideos.slice(0, 10).map((v) => {
      const r = v as Record<string, unknown>;
      return {
        title:    String(r.title ?? ''),
        views:    numOr(r.views),
        video_id: String(r.video_id ?? ''),
      };
    }),
  };
}

function normalizeBrevo(data: Record<string, unknown>): NormalizedMetrics {
  const rawCampaigns = (data.campaigns as unknown[]) ?? [];
  return {
    campaigns_sent:  rawCampaigns.length,
    avg_open_rate:   numOr(data.avg_open_rate),
    avg_click_rate:  numOr(data.avg_click_rate),
    avg_ctor:        numOr(data.avg_ctor),
    campaigns: rawCampaigns.slice(0, 20).map((c) => {
      const r = c as Record<string, unknown>;
      return {
        name:             String(r.name ?? ''),
        open_rate:        numOr(r.open_rate),
        click_rate:       numOr(r.click_rate),
        ctor:             numOr(r.ctor),
        unsubscribe_rate: numOr(r.unsubscribe_rate),
      };
    }),
  };
}

/** Safely convert an unknown value to a number (default 0). */
function numOr(v: unknown, def = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : def;
}

function normalizeData(
  source: string,
  data: Record<string, unknown>,
): NormalizedMetrics | null {
  try {
    if (source === 'ga4')            return normalizeGA4(data);
    if (source === 'search_console') return normalizeGSC(data);
    if (source === 'youtube')        return normalizeYouTube(data);
    if (source === 'brevo')          return normalizeBrevo(data);
  } catch {
    return null;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Fetch all legacy mis_snapshots ─────────────────────────
  console.log('Fetching rows from mis_snapshots…');
  const { data: legacyRows, error: fetchError } = await supabase
    .from('mis_snapshots')
    .select('id, source, property, period_type, period_start, period_end, data, pulled_at')
    .order('period_start', { ascending: true });

  if (fetchError) {
    // Table may not exist in all environments
    if (fetchError.message?.includes('does not exist') || fetchError.code === '42P01') {
      console.log('No existing snapshots to backfill — starting fresh.');
      return;
    }
    console.error('ERROR fetching mis_snapshots:', fetchError.message);
    process.exit(1);
  }

  if (!legacyRows || legacyRows.length === 0) {
    console.log('No existing snapshots to backfill — starting fresh.');
    return;
  }

  console.log(`Found ${legacyRows.length} legacy rows to process.`);

  // ── 2. Fetch existing metric_snapshots keys (for deduplication) ──
  const { data: existingRows } = await supabase
    .from('metric_snapshots')
    .select('snapshot_type, source, period_start');

  const existingKeys = new Set<string>(
    (existingRows ?? []).map(
      (r: { snapshot_type: string; source: string; period_start: string }) =>
        `${r.snapshot_type}:${r.source}:${r.period_start}`
    )
  );

  console.log(`Found ${existingKeys.size} existing metric_snapshots rows (these will be skipped).`);

  // ── 3. Process and insert ─────────────────────────────────────
  let migrated = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const row of legacyRows as MisSnapshotRow[]) {
    const mappedSource = mapSource(row.source, row.property);
    if (!mappedSource) {
      console.log(`  SKIP  unknown source/property: ${row.source}/${row.property}`);
      skipped++;
      continue;
    }

    const dedupeKey = `${row.period_type}:${mappedSource}:${row.period_start}`;
    if (existingKeys.has(dedupeKey)) {
      skipped++;
      continue;
    }

    const metrics = normalizeData(row.source, row.data);
    if (!metrics) {
      console.log(`  FAIL  could not normalize ${row.source}/${row.property} ${row.period_start}`);
      failed++;
      continue;
    }

    const { error: insertError } = await supabase.from('metric_snapshots').insert({
      snapshot_type: row.period_type,
      period_start:  row.period_start,
      period_end:    row.period_end,
      source:        mappedSource,
      metrics,
      pulled_at:     row.pulled_at,
    });

    if (insertError) {
      console.log(`  FAIL  insert error for ${mappedSource} ${row.period_start}: ${insertError.message}`);
      failed++;
    } else {
      existingKeys.add(dedupeKey); // Prevent re-insert within this run
      migrated++;
    }
  }

  // ── 4. Summary ────────────────────────────────────────────────
  console.log('');
  console.log('─────────────────────────────────────');
  console.log(`Backfill complete:`);
  console.log(`  Migrated : ${migrated}`);
  console.log(`  Skipped  : ${skipped}  (already existed or unknown source)`);
  console.log(`  Failed   : ${failed}`);
  console.log('─────────────────────────────────────');

  if (failed > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
