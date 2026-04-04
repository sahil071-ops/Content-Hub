import Anthropic from '@anthropic-ai/sdk';
import { format, parseISO } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MisPeriodTypeEnum,
  HighlightItem,
  NormalizedMetrics,
  MetricSnapshotSource,
} from '@/types/database';

// Local type matching what we select from metric_snapshots
interface SnapshotQueryRow {
  snapshot_type: string;
  period_start: string;
  source: MetricSnapshotSource;
  metrics: NormalizedMetrics;
}

const INSUFFICIENT_DATA_HIGHLIGHT: HighlightItem = {
  id: 'no-history',
  source: 'ga4',
  text: 'Not enough historical data yet — insights will appear after 2 weekly snapshots have been collected.',
  sentiment: 'anomaly',
  tag: 'WATCH',
};

/**
 * Build a single formatted summary line for one period across all available sources.
 */
function formatPeriodLine(
  periodStart: string,
  sourceMap: Map<MetricSnapshotSource, NormalizedMetrics>,
  periodLabel: string,
): string {
  const parts: string[] = [];

  // GA4 — combine main + ES organic sessions
  const ga4Main = sourceMap.get('ga4_main');
  const ga4Es   = sourceMap.get('ga4_es');
  if (ga4Main || ga4Es) {
    const total  = (ga4Main?.organic_sessions ?? 0) + (ga4Es?.organic_sessions ?? 0);
    const detail = [
      ga4Main ? `main: ${(ga4Main.organic_sessions ?? 0).toLocaleString()}` : null,
      ga4Es   ? `ES: ${(ga4Es.organic_sessions ?? 0).toLocaleString()}`   : null,
    ].filter(Boolean).join(', ');
    parts.push(`GA4 sessions ${total.toLocaleString()}${detail ? ` (${detail})` : ''}`);
  }

  // GSC — combine main + ES clicks + impressions
  const gscMain = sourceMap.get('gsc_main');
  const gscEs   = sourceMap.get('gsc_es');
  if (gscMain || gscEs) {
    const totalClicks = (gscMain?.clicks ?? 0) + (gscEs?.clicks ?? 0);
    const totalImpr   = (gscMain?.impressions ?? 0) + (gscEs?.impressions ?? 0);
    const ctr = totalImpr > 0 ? ((totalClicks / totalImpr) * 100).toFixed(1) : '0';
    const detail = [
      gscMain ? `main: ${(gscMain.clicks ?? 0).toLocaleString()}` : null,
      gscEs   ? `ES: ${(gscEs.clicks ?? 0).toLocaleString()}`     : null,
    ].filter(Boolean).join(', ');
    parts.push(
      `GSC clicks ${totalClicks.toLocaleString()} / impressions ${totalImpr.toLocaleString()} / CTR ${ctr}%` +
      (detail ? ` (${detail})` : '')
    );
  }

  // YouTube — views + subscriber count
  const yt = sourceMap.get('youtube');
  if (yt) {
    const subs = yt.subscriber_count != null
      ? `, ${yt.subscriber_count.toLocaleString()} subscribers`
      : '';
    parts.push(`YouTube ${(yt.views ?? 0).toLocaleString()} views${subs}`);
  }

  // Brevo — open rate
  const brevo = sourceMap.get('brevo');
  if (brevo) {
    const sent = brevo.campaigns_sent ? ` (${brevo.campaigns_sent} campaigns)` : '';
    parts.push(`Brevo open rate ${brevo.avg_open_rate ?? 0}%${sent}`);
  }

  // Leads
  const leads = sourceMap.get('leads');
  if (leads) {
    parts.push(`Leads ${(leads.total_leads ?? 0).toLocaleString()}`);
  }

  let dateLabel: string;
  try {
    dateLabel = format(parseISO(periodStart), 'MMM d, yyyy');
  } catch {
    dateLabel = periodStart;
  }

  return `${periodLabel} of ${dateLabel}: ${parts.join(' | ')}`;
}

/**
 * Generate AI highlights from the last 8 metric_snapshots periods using Claude.
 *
 * Queries `metric_snapshots` directly — no raw pull data required.
 * Returns 4-6 actionable insights tagged as WIN / PROBLEM / OPPORTUNITY / WATCH.
 * Returns a single "not enough data" highlight if fewer than 2 snapshot periods exist.
 */
export async function generateMisHighlights(
  serviceClient: SupabaseClient,
  periodType: MisPeriodTypeEnum = 'weekly',
): Promise<HighlightItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  // ── Fetch last 8 periods × up to 8 sources = 64 rows ─────────────
  const { data: rows, error } = await serviceClient
    .from('metric_snapshots')
    .select('snapshot_type, period_start, source, metrics')
    .eq('snapshot_type', periodType)
    .order('period_start', { ascending: false })
    .limit(64);

  if (error || !rows || rows.length === 0) {
    return [INSUFFICIENT_DATA_HIGHLIGHT];
  }

  // ── Group by period_start ─────────────────────────────────────────
  const byPeriod = new Map<string, Map<MetricSnapshotSource, NormalizedMetrics>>();
  for (const row of rows as SnapshotQueryRow[]) {
    if (!byPeriod.has(row.period_start)) {
      byPeriod.set(row.period_start, new Map());
    }
    byPeriod.get(row.period_start)!.set(row.source, row.metrics);
  }

  // Sort ascending (oldest first), cap at 8 periods
  const sortedPeriods = Array.from(byPeriod.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8);

  if (sortedPeriods.length < 2) {
    return [INSUFFICIENT_DATA_HIGHLIGHT];
  }

  const periodLabel = periodType === 'monthly' ? 'Month' : 'Week';

  const dataBlock = sortedPeriods
    .map(([periodStart, sourceMap]) => formatPeriodLine(periodStart, sourceMap, periodLabel))
    .join('\n');

  // ── Prompts ───────────────────────────────────────────────────────
  const systemPrompt = `You are a senior digital marketing analyst reviewing 8 weeks of performance data for Axis India (axis-india.com), a B2B industrial technology company based in India that manufactures electrical components including cable glands, earthing systems, and lightning arresters. Their marketing is primarily a branding and inbound lead generation activity. They sell to distributors, electrical contractors, and industrial buyers primarily in India but also internationally.

You are given weekly snapshots of their marketing data across YouTube, Google Analytics (main site + Spanish site), Google Search Console (main site + Spanish site), Brevo email, and lead capture.

Generate 4-6 highlights. Each highlight must:
1. Identify a TREND across multiple weeks — not just a one-week change
2. State what is happening in plain English
3. Explain what it likely means for their business specifically
4. If it is a problem or opportunity, state one specific action they should take

Tag each highlight as one of: WIN / PROBLEM / OPPORTUNITY / WATCH

Focus on:
- Metrics that have been consistently improving over 3+ weeks
- Metrics that have been consistently declining over 3+ weeks
- Sudden changes that break a trend (investigate these)
- Cross-source correlations (e.g. impressions growing but CTR flat = ranking improving but titles need work)

Do NOT generate highlights that just restate a number from a single week. Every highlight must reference a pattern across time or a meaningful correlation between sources.

Examples of BAD highlights:
- "Search Console clicks increased 404% this week"
- "YouTube recorded 7,761 views"

Examples of GOOD highlights:
- "OPPORTUNITY: Search Console impressions have grown steadily for 6 weeks (+180% total) but CTR has stayed flat at under 1%. Your pages are ranking better but not getting clicked — rewriting meta titles and descriptions on your top 10 pages could significantly increase traffic without any additional SEO work."
- "WIN: YouTube views have grown every week for the past 5 weeks, from 3,200 to 7,800. Problem-focused titles like 'Are You Crimping Your Bimetallic Lugs The Wrong Way?' are driving this — apply this format to your next 5 videos."
- "WATCH: Leads dropped 30% over the past 3 weeks while website traffic stayed flat. This suggests a conversion issue on the site — check if any forms have broken recently."

Respond with ONLY valid JSON — an array of objects with these exact fields:
[
  {
    "id": "unique-string",
    "source": "ga4|search_console|youtube|brevo|leads",
    "text": "The full highlight text — must be 2-4 sentences with trend analysis and recommended action.",
    "sentiment": "positive|warning|anomaly",
    "tag": "WIN|PROBLEM|OPPORTUNITY|WATCH",
    "data_points": ["Specific data point from the history", "Another data point"]
  }
]

Tag mapping guide:
- WIN: something is performing well above expectations — celebrate and learn from it
- PROBLEM: something is broken, declining significantly, or needs immediate attention
- OPPORTUNITY: something is within reach but currently underperforming — specific action will improve it
- WATCH: something is unusual, ambiguous, or worth monitoring — not yet good or bad`;

  const userPrompt = `Analyze this ${periodType} marketing performance history (${sortedPeriods.length} ${periodType === 'monthly' ? 'months' : 'weeks'}, oldest first) and generate 4-6 highlights that identify trends across the full period:

${dataBlock}`;

  // ── Claude API call ───────────────────────────────────────────────
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') return [];

  try {
    const raw = content.text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(raw) as HighlightItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [{
      id: 'fallback-1',
      source: 'ga4',
      text: 'Marketing data has been collected. Highlights could not be parsed — check logs.',
      sentiment: 'anomaly',
      tag: 'WATCH',
    }];
  }
}
