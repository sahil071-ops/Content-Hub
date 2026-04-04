import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPeriodDates } from '@/lib/analytics/periods';
import type { MisPeriodTypeEnum } from '@/types/database';

/**
 * Cron job handler for all MIS period types.
 * Called by Vercel Cron with ?period=weekly|monthly|quarterly|annual
 *
 * Vercel cron schedule (vercel.json):
 *   weekly:    0 0 30 * * 1   (Monday 00:30 UTC = 6:00 AM IST)
 *   monthly:   0 0 30 1 * *   (1st of month 00:30 UTC)
 *   quarterly: 0 0 30 1 1,4,7,10 *
 *   annual:    0 0 30 1 1 *
 *
 * Authorization: CRON_SECRET env var matches Vercel's Authorization header.
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const period = (request.nextUrl.searchParams.get('period') || 'weekly') as MisPeriodTypeEnum;
  const validPeriods: MisPeriodTypeEnum[] = ['weekly', 'monthly', 'quarterly', 'annual'];
  if (!validPeriods.includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();

  // Import dynamically to avoid circular deps
  const { fetchGA4Data } = await import('@/lib/analytics/ga4');
  const { fetchSearchConsoleData } = await import('@/lib/analytics/search-console');
  const { fetchYouTubeData } = await import('@/lib/analytics/youtube');
  const { fetchBrevoData } = await import('@/lib/analytics/brevo');
  const { generateMisHighlights } = await import('@/lib/analytics/ai-highlights');

  const dates = getPeriodDates(period);
  const { startDate, endDate, prevStartDate, prevEndDate } = dates;

  const results: { source: string; property: string; data: unknown }[] = [];
  const logs: { source: string; status: string; error?: string }[] = [];

  // GA4 Main
  const ga4Main = process.env.GA4_PROPERTY_ID_MAIN;
  if (ga4Main) {
    try {
      const data = await fetchGA4Data(ga4Main, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'ga4', property: 'main', data });
      logs.push({ source: 'ga4', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'ga4', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // GA4 ES
  const ga4Es = process.env.GA4_PROPERTY_ID_ES;
  if (ga4Es) {
    try {
      const data = await fetchGA4Data(ga4Es, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'ga4', property: 'es', data });
    } catch (e: unknown) {
      logs.push({ source: 'ga4', status: 'failed', error: String(e) });
    }
  }

  // GSC Main
  const gscMain = process.env.GSC_SITE_URL_MAIN;
  if (gscMain) {
    try {
      const data = await fetchSearchConsoleData(gscMain, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'search_console', property: 'main', data });
      logs.push({ source: 'search_console', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'search_console', status: 'failed', error: String(e) });
    }
  }

  // GSC ES
  const gscEs = process.env.GSC_SITE_URL_ES;
  if (gscEs) {
    try {
      const data = await fetchSearchConsoleData(gscEs, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'search_console', property: 'es', data });
    } catch (e: unknown) {
      logs.push({ source: 'search_console', status: 'failed', error: String(e) });
    }
  }

  // YouTube
  const ytChannel = process.env.YOUTUBE_CHANNEL_ID;
  if (ytChannel) {
    try {
      const data = await fetchYouTubeData(ytChannel, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'youtube', property: 'default', data });
      logs.push({ source: 'youtube', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'youtube', status: 'failed', error: String(e) });
    }
  }

  // Brevo
  if (process.env.BREVO_API_KEY) {
    try {
      const data = await fetchBrevoData(startDate, endDate);
      results.push({ source: 'brevo', property: 'default', data });
      logs.push({ source: 'brevo', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'brevo', status: 'failed', error: String(e) });
    }
  }

  // Store snapshots
  if (results.length > 0) {
    await serviceSupabase.from('mis_snapshots').insert(
      results.map((r) => ({
        source: r.source,
        property: r.property,
        period_type: period,
        period_start: startDate,
        period_end: endDate,
        data: r.data,
      }))
    );
  }

  // Store logs
  await serviceSupabase.from('mis_pull_logs').insert(
    logs.map((l) => ({
      source: l.source,
      period_type: period,
      status: l.status,
      error_message: l.error || null,
    }))
  );

  // Generate AI highlights
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const highlights = await generateMisHighlights(serviceSupabase, period);
      await serviceSupabase.from('mis_highlights').insert({
        period_start: startDate,
        period_end: endDate,
        period_type: period,
        highlights,
        feedback: {},
      });
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ success: true, period, pulled: results.length, logs });
}
