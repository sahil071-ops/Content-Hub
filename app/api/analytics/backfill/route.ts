import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { fetchGA4Data } from '@/lib/analytics/ga4';
import { fetchSearchConsoleData } from '@/lib/analytics/search-console';
import { fetchYouTubeData } from '@/lib/analytics/youtube';
import { fetchBrevoData } from '@/lib/analytics/brevo';
import { getPeriodDates } from '@/lib/analytics/periods';
import { storeMetricSnapshots, storeLeadsSnapshot, storeLinkedInSnapshot } from '@/lib/analytics/snapshot-store';
import { subWeeks, format, parseISO, isBefore } from 'date-fns';
import type { MisSourceEnum } from '@/types/database';

export const maxDuration = 300;

/**
 * Generate all weekly periods (Mon–Sun) from fromDate up to the most recently
 * completed week, returning them in chronological order.
 */
function getAllWeekPeriods(fromDate: string): Array<{ startDate: string; endDate: string }> {
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  const weeks: Array<{ startDate: string; endDate: string }> = [];

  // Last completed week
  const { startDate: lastStart, endDate: lastEnd } = getPeriodDates('weekly');
  let refDate = new Date(); // walk backwards from today

  while (true) {
    const { startDate, endDate } = getPeriodDates('weekly', refDate);
    // Stop if this week's start is before our fromDate
    if (isBefore(parseISO(startDate), parseISO(fromDate))) break;
    weeks.push({ startDate, endDate });
    // Step back by 1 week so next iteration returns the prior week
    refDate = subWeeks(refDate, 1);
    // Safety: if we've gone further back than lastStart, stop
    if (isBefore(parseISO(endDate), parseISO(lastStart))) break;
  }

  void lastEnd; // suppress unused variable warning
  return weeks.reverse(); // chronological order
}

/**
 * POST /api/analytics/backfill
 * Admin-only. Pulls historical weekly snapshots for all missing periods from
 * fromDate (default 2026-01-01) to the most recently completed week.
 *
 * Body: { from_date?: string } — ISO date string (YYYY-MM-DD), defaults to 2026-01-01
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if ((profile as { role: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { from_date?: string };
  const fromDate = body.from_date ?? '2026-01-01';

  const serviceSupabase = createServiceClient();
  const hasGoogleCreds = !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );

  // Get all week periods since fromDate
  const allWeeks = getAllWeekPeriods(fromDate);

  if (allWeeks.length === 0) {
    return NextResponse.json({ success: true, message: 'No weeks to backfill', weeks_processed: 0, weeks_skipped: 0 });
  }

  // Determine which periods already have at least one metric_snapshot
  const { data: existingSnapshots } = await serviceSupabase
    .from('metric_snapshots')
    .select('period_start')
    .eq('snapshot_type', 'weekly')
    .in('period_start', allWeeks.map(w => w.startDate));

  const existingPeriods = new Set((existingSnapshots ?? []).map((r: { period_start: string }) => r.period_start));

  // Only process weeks that have NO existing snapshot at all
  const missingWeeks = allWeeks.filter(w => !existingPeriods.has(w.startDate));

  const summary: Array<{
    period: string;
    sources: string[];
    skipped: boolean;
  }> = [];

  for (const { startDate, endDate } of missingWeeks) {
    const results: { source: MisSourceEnum; property: string; data: unknown }[] = [];
    const sources: string[] = [];

    // GA4 Main
    const ga4Main = process.env.GA4_PROPERTY_ID_MAIN;
    if (ga4Main && hasGoogleCreds) {
      try {
        // For historical pulls, prev period = same duration before current
        const prevStart = format(subWeeks(parseISO(startDate), 1), 'yyyy-MM-dd');
        const prevEnd   = format(subWeeks(parseISO(endDate),   1), 'yyyy-MM-dd');
        const data = await fetchGA4Data(ga4Main, startDate, endDate, prevStart, prevEnd);
        results.push({ source: 'ga4', property: 'main', data });
        sources.push('ga4_main');
      } catch { /* skip */ }
    }

    // GA4 ES
    const ga4Es = process.env.GA4_PROPERTY_ID_ES;
    if (ga4Es && hasGoogleCreds) {
      try {
        const prevStart = format(subWeeks(parseISO(startDate), 1), 'yyyy-MM-dd');
        const prevEnd   = format(subWeeks(parseISO(endDate),   1), 'yyyy-MM-dd');
        const data = await fetchGA4Data(ga4Es, startDate, endDate, prevStart, prevEnd);
        results.push({ source: 'ga4', property: 'es', data });
        sources.push('ga4_es');
      } catch { /* skip */ }
    }

    // GSC Main
    const gscMain = process.env.GSC_SITE_URL_MAIN;
    if (gscMain && hasGoogleCreds) {
      try {
        const prevStart = format(subWeeks(parseISO(startDate), 1), 'yyyy-MM-dd');
        const prevEnd   = format(subWeeks(parseISO(endDate),   1), 'yyyy-MM-dd');
        const data = await fetchSearchConsoleData(gscMain, startDate, endDate, prevStart, prevEnd);
        results.push({ source: 'search_console', property: 'main', data });
        sources.push('gsc_main');
      } catch { /* skip */ }
    }

    // GSC ES
    const gscEs = process.env.GSC_SITE_URL_ES;
    if (gscEs && hasGoogleCreds) {
      try {
        const prevStart = format(subWeeks(parseISO(startDate), 1), 'yyyy-MM-dd');
        const prevEnd   = format(subWeeks(parseISO(endDate),   1), 'yyyy-MM-dd');
        const data = await fetchSearchConsoleData(gscEs, startDate, endDate, prevStart, prevEnd);
        results.push({ source: 'search_console', property: 'es', data });
        sources.push('gsc_es');
      } catch { /* skip */ }
    }

    // YouTube
    const ytChannel = process.env.YOUTUBE_CHANNEL_ID;
    if (ytChannel && hasGoogleCreds && process.env.YOUTUBE_API_KEY) {
      try {
        const prevStart = format(subWeeks(parseISO(startDate), 1), 'yyyy-MM-dd');
        const prevEnd   = format(subWeeks(parseISO(endDate),   1), 'yyyy-MM-dd');
        const data = await fetchYouTubeData(ytChannel, startDate, endDate, prevStart, prevEnd);
        results.push({ source: 'youtube', property: 'default', data });
        sources.push('youtube');
      } catch { /* skip — YouTube API may not have historical per-period data */ }
    }

    // Brevo
    if (process.env.BREVO_API_KEY) {
      try {
        const data = await fetchBrevoData(startDate, endDate);
        results.push({ source: 'brevo', property: 'default', data });
        sources.push('brevo');
      } catch { /* skip */ }
    }

    // Store API results
    if (results.length > 0) {
      try {
        await storeMetricSnapshots(
          results as Parameters<typeof storeMetricSnapshots>[0],
          'weekly', startDate, endDate, serviceSupabase
        );
      } catch { /* continue to next week */ }
    }

    // Leads + LinkedIn — always (Supabase queries, no API dependency)
    try {
      await storeLeadsSnapshot('weekly', startDate, endDate, serviceSupabase);
      sources.push('leads');
    } catch { /* skip */ }
    try {
      await storeLinkedInSnapshot('weekly', startDate, endDate, serviceSupabase);
      sources.push('linkedin');
    } catch { /* skip */ }

    summary.push({ period: startDate, sources, skipped: false });
  }

  const skippedCount = allWeeks.length - missingWeeks.length;

  return NextResponse.json({
    success: true,
    from_date: fromDate,
    total_weeks_found: allWeeks.length,
    weeks_already_present: skippedCount,
    weeks_backfilled: missingWeeks.length,
    detail: summary,
  });
}
