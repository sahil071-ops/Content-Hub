import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { fetchGA4Data } from '@/lib/analytics/ga4';
import { fetchSearchConsoleData } from '@/lib/analytics/search-console';
import { fetchYouTubeData } from '@/lib/analytics/youtube';
import { fetchBrevoData } from '@/lib/analytics/brevo';
import { generateMisHighlights } from '@/lib/analytics/ai-highlights';
import { getPeriodDates } from '@/lib/analytics/periods';
import { storeMetricSnapshots, storeLeadsSnapshot } from '@/lib/analytics/snapshot-store';
import type { MisPeriodTypeEnum, MisSourceEnum } from '@/types/database';

// Allow up to 5 minutes for a full pull
export const maxDuration = 300;

async function runPull(periodType: MisPeriodTypeEnum, serviceSupabase: ReturnType<typeof createServiceClient>) {
  const dates = getPeriodDates(periodType);
  const { startDate, endDate, prevStartDate, prevEndDate } = dates;

  const results: { source: MisSourceEnum; property: string; data: unknown }[] = [];
  const logs: { source: MisSourceEnum; property: string; status: 'success' | 'failed' | 'skipped'; error?: string }[] = [];

  const hasGoogleCreds = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  // ── GA4 Main Site ──────────────────────────────────────────
  const ga4Main = process.env.GA4_PROPERTY_ID_MAIN;
  if (ga4Main && hasGoogleCreds) {
    try {
      const data = await fetchGA4Data(ga4Main, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'ga4', property: 'main', data });
      logs.push({ source: 'ga4', property: 'main', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'ga4', property: 'main', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  } else {
    logs.push({
      source: 'ga4', property: 'main', status: 'skipped',
      error: !ga4Main ? 'GA4_PROPERTY_ID_MAIN not set' : 'Google service account credentials not set',
    });
  }

  // ── GA4 ES Site ────────────────────────────────────────────
  const ga4Es = process.env.GA4_PROPERTY_ID_ES;
  if (ga4Es && hasGoogleCreds) {
    try {
      const data = await fetchGA4Data(ga4Es, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'ga4', property: 'es', data });
      logs.push({ source: 'ga4', property: 'es', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'ga4', property: 'es', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  } else {
    logs.push({
      source: 'ga4', property: 'es', status: 'skipped',
      error: !ga4Es ? 'GA4_PROPERTY_ID_ES not set' : 'Google service account credentials not set',
    });
  }

  // ── Search Console Main ────────────────────────────────────
  const gscMain = process.env.GSC_SITE_URL_MAIN;
  if (gscMain && hasGoogleCreds) {
    try {
      const data = await fetchSearchConsoleData(gscMain, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'search_console', property: 'main', data });
      logs.push({ source: 'search_console', property: 'main', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'search_console', property: 'main', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  } else {
    logs.push({
      source: 'search_console', property: 'main', status: 'skipped',
      error: !gscMain ? 'GSC_SITE_URL_MAIN not set' : 'Google service account credentials not set',
    });
  }

  // ── Search Console ES ──────────────────────────────────────
  const gscEs = process.env.GSC_SITE_URL_ES;
  if (gscEs && hasGoogleCreds) {
    try {
      const data = await fetchSearchConsoleData(gscEs, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'search_console', property: 'es', data });
      logs.push({ source: 'search_console', property: 'es', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'search_console', property: 'es', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  } else {
    logs.push({
      source: 'search_console', property: 'es', status: 'skipped',
      error: !gscEs ? 'GSC_SITE_URL_ES not set' : 'Google service account credentials not set',
    });
  }

  // ── YouTube ────────────────────────────────────────────────
  const ytChannel = process.env.YOUTUBE_CHANNEL_ID;
  const hasYoutubeKey = !!process.env.YOUTUBE_API_KEY;
  if (ytChannel && hasGoogleCreds && hasYoutubeKey) {
    try {
      const data = await fetchYouTubeData(ytChannel, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'youtube', property: 'default', data });
      logs.push({ source: 'youtube', property: 'default', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'youtube', property: 'default', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  } else {
    const missing = [
      !ytChannel && 'YOUTUBE_CHANNEL_ID',
      !hasGoogleCreds && 'Google service account credentials',
      !hasYoutubeKey && 'YOUTUBE_API_KEY',
    ].filter(Boolean);
    logs.push({ source: 'youtube', property: 'default', status: 'skipped', error: `Not set: ${missing.join(', ')}` });
  }

  // ── Brevo ──────────────────────────────────────────────────
  if (process.env.BREVO_API_KEY) {
    try {
      const data = await fetchBrevoData(startDate, endDate);
      results.push({ source: 'brevo', property: 'default', data });
      logs.push({ source: 'brevo', property: 'default', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'brevo', property: 'default', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  } else {
    logs.push({ source: 'brevo', property: 'default', status: 'skipped', error: 'BREVO_API_KEY not set' });
  }

  // ── Store snapshots ────────────────────────────────────────
  if (results.length > 0) {
    const snapshots = results.map((r) => ({
      source: r.source,
      property: r.property,
      period_type: periodType,
      period_start: startDate,
      period_end: endDate,
      data: r.data,
    }));

    await serviceSupabase.from('mis_snapshots').insert(snapshots);
  }

  // ── Store pull logs (only success/failed, not skipped) ────
  const logsToStore = logs.filter((l) => l.status !== 'skipped');
  if (logsToStore.length > 0) {
    await serviceSupabase.from('mis_pull_logs').insert(
      logsToStore.map((l) => ({
        source: l.source,
        period_type: periodType,
        status: l.status as 'success' | 'failed' | 'partial',
        error_message: l.error || null,
      }))
    );
  }

  // ── Store metric_snapshots + youtube_snapshots ───────────────
  if (results.length > 0) {
    try {
      await storeMetricSnapshots(results as Parameters<typeof storeMetricSnapshots>[0], periodType, startDate, endDate, serviceSupabase);
    } catch { /* non-critical — raw mis_snapshots already stored */ }
    try {
      await storeLeadsSnapshot(periodType, startDate, endDate, serviceSupabase);
    } catch { /* non-critical */ }
  }

  // ── Generate AI highlights ─────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const highlights = await generateMisHighlights(serviceSupabase, periodType);

      await serviceSupabase.from('mis_highlights').insert({
        period_start: startDate,
        period_end: endDate,
        period_type: periodType,
        highlights,
        feedback: {},
      });
    } catch { /* highlights are non-critical */ }
  }

  return {
    results: results.length,
    logs,
    skipped: logs.filter((l) => l.status === 'skipped').length,
    failed: logs.filter((l) => l.status === 'failed').length,
  };
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { period_type } = await request.json() as { period_type: MisPeriodTypeEnum };
  const serviceSupabase = createServiceClient();

  try {
    const result = await runPull(period_type || 'monthly', serviceSupabase);
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Pull failed' }, { status: 500 });
  }
}
