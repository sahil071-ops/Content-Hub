import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchGA4Data } from '@/lib/analytics/ga4';
import { fetchSearchConsoleData } from '@/lib/analytics/search-console';
import { fetchYouTubeData } from '@/lib/analytics/youtube';
import { fetchBrevoData } from '@/lib/analytics/brevo';
import { getPeriodDates } from '@/lib/analytics/periods';
import { storeMetricSnapshots, storeLeadsSnapshot, storeLinkedInSnapshot } from '@/lib/analytics/snapshot-store';
import type { MisSourceEnum } from '@/types/database';

/**
 * GET /api/cron/snapshot-weekly
 * Runs every Monday at 02:30 UTC (08:00 IST).
 * Pulls data from all configured APIs and writes normalised metrics to
 * metric_snapshots + youtube_snapshots for proper period-over-period comparison.
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const dates = getPeriodDates('weekly');
  const { startDate, endDate, prevStartDate, prevEndDate } = dates;

  const results: { source: MisSourceEnum; property: string; data: unknown }[] = [];
  const logs: { source: string; status: string; error?: string }[] = [];

  const hasGoogleCreds = !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );

  // GA4 Main
  const ga4Main = process.env.GA4_PROPERTY_ID_MAIN;
  if (ga4Main && hasGoogleCreds) {
    try {
      const data = await fetchGA4Data(ga4Main, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'ga4', property: 'main', data });
      logs.push({ source: 'ga4_main', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'ga4_main', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // GA4 ES
  const ga4Es = process.env.GA4_PROPERTY_ID_ES;
  if (ga4Es && hasGoogleCreds) {
    try {
      const data = await fetchGA4Data(ga4Es, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'ga4', property: 'es', data });
      logs.push({ source: 'ga4_es', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'ga4_es', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // GSC Main
  const gscMain = process.env.GSC_SITE_URL_MAIN;
  if (gscMain && hasGoogleCreds) {
    try {
      const data = await fetchSearchConsoleData(gscMain, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'search_console', property: 'main', data });
      logs.push({ source: 'gsc_main', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'gsc_main', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // GSC ES
  const gscEs = process.env.GSC_SITE_URL_ES;
  if (gscEs && hasGoogleCreds) {
    try {
      const data = await fetchSearchConsoleData(gscEs, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'search_console', property: 'es', data });
      logs.push({ source: 'gsc_es', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'gsc_es', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // YouTube
  const ytChannel = process.env.YOUTUBE_CHANNEL_ID;
  const hasYoutubeKey = !!process.env.YOUTUBE_API_KEY;
  if (ytChannel && hasGoogleCreds && hasYoutubeKey) {
    try {
      const data = await fetchYouTubeData(ytChannel, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'youtube', property: 'default', data });
      logs.push({ source: 'youtube', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'youtube', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Brevo
  if (process.env.BREVO_API_KEY) {
    try {
      const data = await fetchBrevoData(startDate, endDate);
      results.push({ source: 'brevo', property: 'default', data });
      logs.push({ source: 'brevo', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'brevo', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Store metric_snapshots + youtube_snapshots
  if (results.length > 0) {
    await storeMetricSnapshots(results as Parameters<typeof storeMetricSnapshots>[0], 'weekly', startDate, endDate, serviceClient);
  }

  // Store leads snapshot from Supabase
  try {
    await storeLeadsSnapshot('weekly', startDate, endDate, serviceClient);
    logs.push({ source: 'leads', status: 'success' });
  } catch (e: unknown) {
    logs.push({ source: 'leads', status: 'failed', error: e instanceof Error ? e.message : String(e) });
  }

  // Store LinkedIn snapshot from linkedin_posts table
  try {
    await storeLinkedInSnapshot('weekly', startDate, endDate, serviceClient);
    logs.push({ source: 'linkedin', status: 'success' });
  } catch (e: unknown) {
    logs.push({ source: 'linkedin', status: 'failed', error: e instanceof Error ? e.message : String(e) });
  }

  // Log to mis_pull_logs
  const logsToStore = logs.filter(l => l.status !== 'skipped');
  if (logsToStore.length > 0) {
    await serviceClient.from('mis_pull_logs').insert(
      logsToStore.map(l => ({
        source: l.source,
        period_type: 'weekly',
        status: l.status as 'success' | 'failed' | 'partial',
        error_message: l.error || null,
      }))
    );
  }

  return NextResponse.json({
    success: true,
    period: 'weekly',
    period_start: startDate,
    period_end: endDate,
    snapshots_stored: results.length,
    logs,
  });
}
