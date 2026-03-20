import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { fetchGA4Data } from '@/lib/analytics/ga4';
import { fetchSearchConsoleData } from '@/lib/analytics/search-console';
import { fetchYouTubeData } from '@/lib/analytics/youtube';
import { fetchBrevoData } from '@/lib/analytics/brevo';
import { generateMisHighlights } from '@/lib/analytics/ai-highlights';
import { getPeriodDates } from '@/lib/analytics/periods';
import type { MisPeriodTypeEnum, MisSourceEnum } from '@/types/database';

// Allow up to 5 minutes for a full pull
export const maxDuration = 300;

async function runPull(periodType: MisPeriodTypeEnum, serviceSupabase: ReturnType<typeof createServiceClient>) {
  const dates = getPeriodDates(periodType);
  const { startDate, endDate, prevStartDate, prevEndDate } = dates;

  const results: { source: MisSourceEnum; property: string; data: unknown }[] = [];
  const logs: { source: MisSourceEnum; status: 'success' | 'failed' | 'partial'; error?: string }[] = [];

  // ── GA4 Main Site ──────────────────────────────────────────
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

  // ── GA4 ES Site ────────────────────────────────────────────
  const ga4Es = process.env.GA4_PROPERTY_ID_ES;
  if (ga4Es) {
    try {
      const data = await fetchGA4Data(ga4Es, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'ga4', property: 'es', data });
    } catch (e: unknown) {
      logs.push({ source: 'ga4', status: 'failed', error: `ES: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  // ── Search Console Main ────────────────────────────────────
  const gscMain = process.env.GSC_SITE_URL_MAIN;
  if (gscMain) {
    try {
      const data = await fetchSearchConsoleData(gscMain, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'search_console', property: 'main', data });
      logs.push({ source: 'search_console', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'search_console', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Search Console ES ──────────────────────────────────────
  const gscEs = process.env.GSC_SITE_URL_ES;
  if (gscEs) {
    try {
      const data = await fetchSearchConsoleData(gscEs, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'search_console', property: 'es', data });
    } catch (e: unknown) {
      logs.push({ source: 'search_console', status: 'failed', error: `ES: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  // ── YouTube ────────────────────────────────────────────────
  const ytChannel = process.env.YOUTUBE_CHANNEL_ID;
  if (ytChannel) {
    try {
      const data = await fetchYouTubeData(ytChannel, startDate, endDate, prevStartDate, prevEndDate);
      results.push({ source: 'youtube', property: 'default', data });
      logs.push({ source: 'youtube', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'youtube', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Brevo ──────────────────────────────────────────────────
  if (process.env.BREVO_API_KEY) {
    try {
      const data = await fetchBrevoData(startDate, endDate);
      results.push({ source: 'brevo', property: 'default', data });
      logs.push({ source: 'brevo', status: 'success' });
    } catch (e: unknown) {
      logs.push({ source: 'brevo', status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
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

  // ── Store pull logs ────────────────────────────────────────
  await serviceSupabase.from('mis_pull_logs').insert(
    logs.map((l) => ({
      source: l.source,
      period_type: periodType,
      status: l.status,
      error_message: l.error || null,
    }))
  );

  // ── Generate AI highlights ─────────────────────────────────
  if (results.length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      const highlights = await generateMisHighlights(
        results as Parameters<typeof generateMisHighlights>[0],
        periodType,
        startDate,
        endDate
      );

      await serviceSupabase.from('mis_highlights').insert({
        period_start: startDate,
        period_end: endDate,
        period_type: periodType,
        highlights,
        feedback: {},
      });
    } catch { /* highlights are non-critical */ }
  }

  return { results: results.length, logs };
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
